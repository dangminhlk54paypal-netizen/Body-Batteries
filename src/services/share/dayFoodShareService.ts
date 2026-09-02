import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';

// Renders the (off-screen, full-height, never-clipped) ShareDayFoodCard into
// a PNG and opens the OS share sheet — the "share my day as an image" flow.
//
// Uses captureRef (not captureScreen): captureScreen only grabs the pixels
// currently on the physical display, so a food list longer than the viewport
// would come out cropped exactly like a manual screenshot. captureRef snapshots
// the full off-screen view regardless of what's scrolled into view on the real
// screen — which is the whole point of this feature (Session 25).
//
// result: 'tmpfile' (the library default) writes straight to a temp file and
// hands back its URI — no manual FileSystem/base64 juggling needed, and the
// file is cleaned up automatically when the app closes.
export async function shareTodayFoodCard(
  cardRef: RefObject<View | null>,
  language: Language
): Promise<void> {
  const uri = await captureRef(cardRef, { format: 'png', quality: 1 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: translate(language, 'components.todayMeals.shareDialogTitle'),
    });
  }
}
