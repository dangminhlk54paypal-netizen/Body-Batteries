import type { RefObject } from 'react';
import type { View } from 'react-native';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import { shareViewAsImage } from './imageShareService';

// "Share my day as an image": the (off-screen, full-height, never-clipped)
// ShareDayFoodCard → PNG → OS share sheet. See imageShareService for why
// captureRef and not a screenshot.
export async function shareTodayFoodCard(cardRef: RefObject<View | null>, language: Language): Promise<void> {
  await shareViewAsImage(cardRef, translate(language, 'components.todayMeals.shareDialogTitle'));
}
