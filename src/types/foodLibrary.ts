// "Nguồn của tôi" — food tables the user imports from their own files (CSV
// now, .xlsx later). The app is only the engine and the on-device store: the
// rows stay the user's data, converted to per-100 g on the way in
// (domain/food/library/libraryMapping.ts) and kept in SQLite
// (library_sources / library_foods, data/db/schema.ts).

// The app-side fields a column of the file can be mapped to.
export type LibraryField =
  | 'name'
  | 'energy'
  | 'protein'
  | 'fat'
  | 'carb'
  | 'fiber'
  | 'sugar'
  | 'water'
  | 'servingG'
  | 'key'
  | 'category'
  | 'nameEn'
  | 'nameDe'
  | 'salt'
  | 'sodium'
  | 'calcium'
  | 'iron'
  | 'potassium'
  | 'magnesium'
  | 'zinc'
  | 'epa'
  | 'dha';

// One cell of the file: always text from a CSV, text or a number from a
// spreadsheet (a number cell has no decimal mark to interpret).
export type LibraryCell = string | number;

// Field → index of the column in the file's header row.
export type ColumnMapping = Partial<Record<LibraryField, number>>;

export interface LibraryImportOptions {
  // Whether the file's numbers are per 100 g or per one serving (then the
  // servingG column says how many grams one serving is).
  basis: 'per100g' | 'perServing';
  energyUnit: 'kcal' | 'kj';
  decimal: '.' | ',';
  // Unit of the mineral and omega-3 columns. Salt is always grams (labels).
  mineralUnit: 'mg' | 'g';
}

// Everything needed to read the file the same way again.
export interface LibraryMappingConfig {
  // Absent on sources imported before .xlsx support = 'csv'.
  format?: 'csv' | 'xlsx';
  // The worksheet used, for an .xlsx.
  sheetName?: string;
  delimiter: ',' | ';' | '\t';
  // The header row as it was, so a re-import can match columns by name.
  header: string[];
  columns: ColumnMapping;
  options: LibraryImportOptions;
}

// One imported file.
export interface LibrarySource {
  // Short base-36 id, no "_" (it is part of every food id: lib_<id>_<key>).
  id: string;
  // The user's own name for it — shown as the badge in food search.
  name: string;
  fileName: string;
  // Off = left out of search. Its foods still resolve for meals already logged.
  enabled: boolean;
  foodCount: number;
  mapping: LibraryMappingConfig | null;
  createdAt: number;
  updatedAt: number;
}
