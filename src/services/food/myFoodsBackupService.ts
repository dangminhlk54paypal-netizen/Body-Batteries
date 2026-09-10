import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getCustomFoods, addCustomFoodAndRegister } from '../../data/food/customFoodRegistry';
import {
  getAllOverridesSync,
  upsertOverrideAndRegister,
} from '../../data/food/foodOverrideRegistry';
import {
  parseMyFoodsBackup,
  serializeMyFoodsBackup,
  type ParsedBackup,
  type RejectedBackup,
} from '../../domain/food/myFoodsBackup';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';

// Read/write side of the personal food-list backup. All the parsing rules
// live in domain/food/myFoodsBackup.ts; this module only touches the file
// system, the registries, and the share sheet.

const FILE_PREFIX = 'BodyBatteries_MyFoods_';
const FILE_SUFFIX = '.json';

function nowTimestamp(): number {
  return Date.now();
}

function stampFor(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export interface ExportResult {
  uri: string;
  customFoodCount: number;
  overrideCount: number;
}

// Writes the user's own foods + corrections into the app's document directory
// (persistent and visible in the Files app, same as the Excel exports) and
// opens the share sheet. The file stays behind either way, which is also what
// makes importFromDocumentDirectory able to find it later.
export async function exportMyFoods(language: Language): Promise<ExportResult> {
  const customFoods = getCustomFoods();
  const overrides = getAllOverridesSync();
  const timestamp = nowTimestamp();
  const json = serializeMyFoodsBackup(customFoods, overrides, timestamp);

  const file = new File(Paths.document, `${FILE_PREFIX}${stampFor(timestamp)}${FILE_SUFFIX}`);
  file.create({ overwrite: true });
  file.write(json);
  const uri = file.uri;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: translate(language, 'myFoods.export.shareDialogTitle'),
    });
  }
  return { uri, customFoodCount: customFoods.length, overrideCount: overrides.length };
}

export interface BackupFile {
  name: string;
  uri: string;
}

// Lists candidate backup files sitting in the app's document directory,
// newest name first. This is the import "picker" — no expo-document-picker
// dependency is added: the documents directory is exposed in the Files app,
// so a file copied in there (from iCloud, AirDrop, another phone) shows up
// here. Any .json is offered, not just ours, since a user may well rename
// their backup; parseMyFoodsBackup is what actually validates it.
export async function listBackupFiles(): Promise<BackupFile[]> {
  const entries = Paths.document.list();
  return entries
    .filter((entry): entry is File => entry instanceof File)
    .filter((file) => file.name.toLowerCase().endsWith(FILE_SUFFIX))
    .sort((a, b) => b.name.localeCompare(a.name))
    .map((file) => ({ name: file.name, uri: file.uri }));
}

export interface ImportResult {
  customFoodsImported: number;
  overridesImported: number;
}

// Reads and validates one backup file, then MERGES it in: every food is
// written through the normal registry entry points, so the in-memory search
// index updates immediately and an id already present is replaced rather than
// duplicated. Nothing is deleted — importing adds to the current list, it
// never wipes foods the file happens not to mention.
export async function importMyFoods(uri: string): Promise<ImportResult | RejectedBackup> {
  let text: string;
  try {
    text = await new File(uri).text();
  } catch {
    return { ok: false, reasonKey: 'unreadable' };
  }

  const parsed: ParsedBackup | RejectedBackup = parseMyFoodsBackup(text);
  if (!parsed.ok) return parsed;

  for (const item of parsed.backup.customFoods) {
    await addCustomFoodAndRegister(item);
  }
  for (const item of parsed.backup.overrides) {
    await upsertOverrideAndRegister(item);
  }
  return {
    customFoodsImported: parsed.backup.customFoods.length,
    overridesImported: parsed.backup.overrides.length,
  };
}
