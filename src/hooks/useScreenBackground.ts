import type { ViewStyle } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';

const SEE_THROUGH: ViewStyle = { backgroundColor: 'transparent' };

// Tab screens paint their own `c.bg`; with the ambient glow on
// (AmbientBackground.tsx, drawn once behind the navigator) they must let it
// show through instead. Spread after the screen's container style:
// `style={[styles.container, screenBg]}`. Cards keep their solid surfaces.
export function useScreenBackground(): ViewStyle | null {
  const ambient = useSettingsStore((s) => s.ambientBackgroundEnabled);
  return ambient ? SEE_THROUGH : null;
}
