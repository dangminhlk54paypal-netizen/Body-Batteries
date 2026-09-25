// Search-only keywords for Vietnamese dishes, by catalog id — how someone who
// ate the dish abroad might describe it in English or German ("beef noodle
// soup", "Frühlingsrolle", "sticky rice"). NEVER displayed (so not UI text for
// i18n purposes — same status as the search-only part of nameDe); they only
// widen what the search box finds. Accents/umlauts are fine: the search
// normalizes them. Keep entries short and descriptive, not translations.
export const FOOD_SEARCH_ALIASES: Record<string, string> = {
  rice_noodle_pho: 'pho noodles flat rice noodles reisnudeln',
  bun_vermicelli: 'rice noodles vermicelli reisnudeln glasnudeln',
  dish_pho_bo: 'noodle soup beef soup nudelsuppe rind',
  dish_pho_ga: 'noodle soup chicken soup nudelsuppe hähnchen huhn',
  dish_bun_bo_hue: 'spicy beef noodle soup scharfe nudelsuppe',
  dish_bun_cha: 'grilled pork noodles vermicelli gegrilltes schweinefleisch nudeln',
  dish_com_tam: 'broken rice pork chop bruchreis kotelett',
  dish_banh_mi: 'vietnamese sandwich baguette sandwich',
  dish_goi_cuon: 'summer roll fresh roll rice paper roll sommerrolle',
  dish_cha_gio: 'egg roll spring roll fried roll frühlingsrolle',
  dish_com_chien: 'fried rice gebratener reis',
  dish_xoi: 'sticky rice glutinous rice klebreis',
  dish_chao: 'congee rice soup reisbrei reissuppe',
  dish_hu_tieu: 'noodle soup pork noodle soup nudelsuppe',
  dish_mi_quang: 'turmeric noodles noodle salad kurkuma nudeln',
  dish_banh_xeo: 'crispy pancake crepe pfannkuchen',
  dish_canh_chua: 'sour fish soup tamarind soup saure suppe',
};
