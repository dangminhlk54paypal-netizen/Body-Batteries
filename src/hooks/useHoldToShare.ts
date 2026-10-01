import { useRef, useState } from 'react';
import { Alert, type View } from 'react-native';
import { shareViewAsImage } from '../services/share/imageShareService';
import * as haptics from '../lib/haptics';
import { useT } from '../i18n/useT';

// "Hold to save / share": put `ref` (plus collapsable={false} and a solid
// background, or the PNG comes out transparent) on the view to capture, and
// `onLongPress` on whatever the user holds. The OS share sheet that opens
// offers "Save Image" (→ Photos) next to Messages, Zalo… — no photo-library
// permission or extra native module needed.
// `dialogTitle` is already translated: t('…') at the call site, so the
// usedKeys test sees the key.
export function useHoldToShare(dialogTitle: string) {
  const { t } = useT();
  const ref = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  async function onLongPress() {
    if (sharing) return; // a second hold while the sheet is opening
    haptics.tapLight();
    setSharing(true);
    try {
      await shareViewAsImage(ref, dialogTitle);
    } catch (e) {
      console.warn('hold-to-share capture failed:', e);
      Alert.alert(t('common.error'), t('common.shareImageFailed'));
    } finally {
      setSharing(false);
    }
  }

  return { ref, onLongPress, sharing };
}
