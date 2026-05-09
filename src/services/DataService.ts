import * as SQLite from 'expo-sqlite';
import { Paths, File as ExpoFile } from 'expo-file-system';

const DB_NAME = 'sutta_db.sqlite';
const DATA_DIR = `${Paths.document.uri}sutta_data/`;
const INDEX_PATH = `${DATA_DIR}sutta_index.json`;

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sutta_index (
      uid TEXT PRIMARY KEY,
      file_path TEXT NOT NULL
    );
  `);
  
  return db;
}

export async function populateIndex() {
  const database = await getDb();
  
  const indexFile = new ExpoFile(INDEX_PATH);
  if (!indexFile.exists) {
    console.error("Index file not found at:", INDEX_PATH);
    return;
  }

  const rawIndex = await indexFile.text();
  const data = JSON.parse(rawIndex);

  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM sutta_index');
    const statement = await database.prepareAsync(
      'INSERT INTO sutta_index (uid, file_path) VALUES ($uid, $filePath)'
    );
    
    try {
      for (const [uid, entry] of Object.entries(data) as [string, any][]) {
        const filePath = entry.translations?.sujato || entry.root;
        if (filePath) {
          await statement.executeAsync({ $uid: uid, $filePath: filePath });
        }
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

export async function getSuttaPath(uid: string): Promise<string | null> {
  const database = await getDb();
  const result = await database.getFirstAsync<{ file_path: string }>(
    'SELECT file_path FROM sutta_index WHERE uid = ?',
    [uid]
  );
  return result ? result.file_path : null;
}

export async function getSuttaContent(uid: string): Promise<any | null> {
  const filePath = await getSuttaPath(uid);
  if (!filePath) return null;

  const fullPath = `${DATA_DIR}bilara-data/${filePath}`;
  try {
    const suttaFile = new ExpoFile(fullPath);
    if (!suttaFile.exists) return null;
    
    const content = await suttaFile.text();
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading sutta ${uid} at ${fullPath}:`, error);
    return null;
  }
}

export async function searchSuttas(query: string): Promise<{ uid: string; file_path: string }[]> {
  const database = await getDb();
  return await database.getAllAsync<{ uid: string; file_path: string }>(
    'SELECT uid, file_path FROM sutta_index WHERE uid LIKE ? LIMIT 50',
    [`%${query}%`]
  );
}

export async function getRandomSuttas(limit: number = 10): Promise<{ uid: string; file_path: string }[]> {
  const database = await getDb();
  return await database.getAllAsync<{ uid: string; file_path: string }>(
    'SELECT uid, file_path FROM sutta_index ORDER BY RANDOM() LIMIT ?',
    [limit]
  );
}

/**
 * Reads a menu JSON file from the extracted data.
 */
export async function getMenu(menuId: string): Promise<any[] | null> {
  const menuPath = `${DATA_DIR}menus/${menuId}.json`;
  try {
    const menuFile = new ExpoFile(menuPath);
    if (!menuFile.exists) return null;
    
    const content = await menuFile.text();
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading menu ${menuId}:`, error);
    return null;
  }
}
