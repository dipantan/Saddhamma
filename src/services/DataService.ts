import * as SQLite from 'expo-sqlite';
import { Paths, File as ExpoFile, Directory } from 'expo-file-system';

const DB_NAME = 'sutta_db.sqlite';
const DATA_DIR = `${Paths.document.uri}sutta_data/`;
const INDEX_PATH = `${DATA_DIR}sutta_index.json`;

let db: SQLite.SQLiteDatabase | null = null;

export async function isDataReady(): Promise<boolean> {
  const indexFile = new ExpoFile(INDEX_PATH);
  return await indexFile.exists;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sutta_index (
      uid TEXT PRIMARY KEY,
      file_path TEXT NOT NULL
    );

    -- Full-Text Search table with Trigram Tokenizer
    -- This handles Pali diacritics and fuzzy matching automatically
    CREATE VIRTUAL TABLE IF NOT EXISTS sutta_fts USING fts5(
      uid,
      title,
      content,
      tokenize = 'trigram'
    );
  `);
  
  return db;
}

export async function populateIndex(onProgress?: (progress: number) => void) {
  const database = await getDb();
  
  const indexFile = new ExpoFile(INDEX_PATH);
  if (!(await indexFile.exists)) {
    throw new Error(`Index file not found at ${INDEX_PATH}`);
  }

  const rawIndex = await indexFile.text();
  const data = JSON.parse(rawIndex);
  const entries = Object.entries(data) as [string, any][];
  const total = entries.length;

  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM sutta_index');
    await database.runAsync('DELETE FROM sutta_fts');
    
    const indexStmt = await database.prepareAsync(
      'INSERT INTO sutta_index (uid, file_path) VALUES (?, ?)'
    );
    const ftsStmt = await database.prepareAsync(
      'INSERT INTO sutta_fts (uid, title, content) VALUES (?, ?, ?)'
    );
    
    try {
      let processed = 0;
      for (const [uid, entry] of entries) {
        let filePath = "";
        let title = entry.title || uid;
        
        if (entry.translations?.sujato) {
          filePath = `translation/en/sujato/${entry.translations.sujato}`;
        } else if (entry.root) {
          filePath = `root/pli/ms/${entry.root}`;
        }

        if (filePath) {
          await indexStmt.executeAsync([uid, filePath]);
          
          // Index for FTS
          // For now we index the title. Content indexing can be heavy, 
          // but we'll include a placeholder for it here.
          await ftsStmt.executeAsync([uid, title, ""]);
        }

        processed++;
        if (onProgress && processed % 50 === 0) {
          onProgress(processed / total);
        }
      }
    } finally {
      await indexStmt.finalizeAsync();
      await ftsStmt.finalizeAsync();
    }
  });

  console.log(`Index populated with ${total} entries.`);
}

/**
 * Background task to index the full content of all suttas.
 * Processes in batches to avoid blocking the main thread.
 */
export async function buildFullTextIndex(onProgress?: (processed: number, total: number) => void) {
  const database = await getDb();
  
  // Find uids that need content indexing
  const pending = await database.getAllAsync<{ uid: string }>(
    'SELECT uid FROM sutta_fts WHERE content = "" OR content IS NULL'
  );
  
  if (pending.length === 0) return;
  
  const total = pending.length;
  let processed = 0;
  const batchSize = 25;
  
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    
    await database.withTransactionAsync(async () => {
      const updateStmt = await database.prepareAsync(
        'UPDATE sutta_fts SET content = ? WHERE uid = ?'
      );
      
      try {
        for (const item of batch) {
          try {
            const rawContent = await getSuttaContent(item.uid);
            if (rawContent) {
              let contentStr = "";
              if (typeof rawContent === 'object') {
                // Bilara JSON: extract values from segments
                contentStr = Object.values(rawContent).join(" ");
              } else if (typeof rawContent === 'string') {
                // Legacy HTML: strip tags
                contentStr = stripHtml(rawContent);
              }
              
              if (contentStr) {
                await updateStmt.executeAsync([contentStr, item.uid]);
              }
            }
          } catch (err) {
            console.error(`Error indexing content for ${item.uid}:`, err);
          }
          processed++;
        }
      } finally {
        await updateStmt.finalizeAsync();
      }
    });
    
    if (onProgress) {
      onProgress(processed, total);
    }
    
    // Small delay to keep the UI responsive
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/**
 * Strips HTML tags from a string.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '');
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

  const isPublished = await (new Directory(`${DATA_DIR}bilara-data-published/`)).exists;
  const bilaraDirName = isPublished ? "bilara-data-published" : "bilara-data";
  const fullPath = `${DATA_DIR}${bilaraDirName}/${filePath}`;
  
  try {
    const suttaFile = new ExpoFile(fullPath);
    if (!(await suttaFile.exists)) {
      console.error(`Sutta file not found at: ${fullPath}`);
      try {
        const baseDir = new Directory(`${DATA_DIR}${bilaraDirName}/`);
        const contents = await baseDir.list();
        console.log(`Contents of ${bilaraDirName}:`, contents.map(i => i.name).join(", "));
      } catch (e) {}
      return null;
    }
    
    const content = await suttaFile.text();
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading sutta ${uid} at ${fullPath}:`, error);
    return null;
  }
}

export async function searchSuttas(query: string): Promise<any[]> {
  const database = await getDb();
  
  // Normalize query for UID search (e.g., "sn 56 11" -> "sn56.11")
  // 1. Remove spaces and colons
  // 2. Ensure dots are handled correctly (SuttaCentral uses dots for SN/AN nesting)
  const normalizedUid = query.toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/:/g, '.');  // Replace colons with dots
  
  // Search by exact normalized UID, partial UID, or content match
  return await database.getAllAsync(`
    SELECT 
      f.uid, 
      f.title, 
      i.file_path,
      snippet(sutta_fts, 1, '<b>', '</b>', '...', 10) as highlight,
      snippet(sutta_fts, 2, '<b>', '</b>', '...', 15) as content_highlight
    FROM sutta_fts f
    JOIN sutta_index i ON f.uid = i.uid
    WHERE f.uid = ? OR f.uid LIKE ? OR f.uid = ? OR f.uid LIKE ? OR sutta_fts MATCH ? 
    ORDER BY (f.uid = ? OR f.uid = ?) DESC, rank 
    LIMIT 30
  `, [query, `${query}%`, normalizedUid, `${normalizedUid}%`, query, query, normalizedUid]);
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
    if (!(await menuFile.exists)) return null;
    
    const content = await menuFile.text();
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading menu ${menuId}:`, error);
    return null;
  }
}
