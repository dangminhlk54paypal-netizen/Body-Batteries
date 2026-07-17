import React, { useEffect } from 'react';
import { Modal, Pressable, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // How far below its resting position the sheet starts before sliding up
  // (and how far it slides down to dismiss).
  sheetOffset?: number;
}

// Drag distance past which a release dismisses the sheet, even at low
// velocity — a quarter of a typical sheetOffset feels like a natural
// "I meant to swipe this away" gesture.
const DISMISS_DISTANCE = 100;
// Fast flicks dismiss even if the drag distance itself is short.
const DISMISS_VELOCITY = 800;

export function BottomSheet({ visible, onClose, children, sheetOffset = 500 }: BottomSheetProps) {
  const styles = useThemedStyles(createStyles);
  const translateY = useSharedValue(sheetOffset);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(sheetOffset, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 220 });
      }
    });

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 280 });
    } else {
      translateY.value = sheetOffset;
    }
  }, [visible, sheetOffset, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayDismiss} onPress={onClose} />
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={styles.handle} />
            {children}
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayDismiss: { flex: 1 },
  sheet: {
    backgroundColor: c.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    // Without flexShrink the sheet keeps its natural (content) height and
    // overflows both the 85% cap and the keyboard-shrunk overlay — the inner
    // ScrollView then never scrolls and the confirm row ends up under the
    // keyboard. Shrinking here (and in each modal's inner wrapper) is what
    // actually hands the missing space down to the ScrollView.
    flexShrink: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
});
