import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// Snapshots an (off-screen, full-height) view into a PNG and opens the OS share
// sheet — the one "share as image" path behind every poster card (the day's
// food, the strength chart).
//
// Uses captureRef (not captureScreen): captureScreen only grabs the pixels
// currently on the physical display, so content longer than the viewport
// would come out cropped exactly like a manual screenshot. captureRef snapshots
// the full off-screen view regardless of what's scrolled into view (Session 25).
//
// result: 'tmpfile' (the library default) writes straight to a temp file and
// hands back its URI, cleaned up automatically when the app closes.
export async function shareViewAsImage(viewRef: RefObject<View | null>, dialogTitle: string): Promise<void> {
  const uri = await captureRef(viewRef, { format: 'png', quality: 1 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
  }
}
