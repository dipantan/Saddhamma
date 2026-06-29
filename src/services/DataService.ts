import { Directory, File as ExpoFile, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import * as Notifications from "expo-notifications";

const DB_NAME = "sutta_db.sqlite";
const DATA_DIR = `${Paths.document.uri}sutta_data/`;
const INDEX_PATH = `${DATA_DIR}sutta_index.json`;
const SETTINGS_PATH = `${Paths.document.uri}reader_settings.json`;
const BOOKMARKS_PATH = `${Paths.document.uri}bookmarks.json`;
const NOTES_PATH = `${Paths.document.uri}user_notes.json`;
const HIGHLIGHTS_PATH = `${Paths.document.uri}user_highlights.json`;
const ANNOTATIONS_PATH = `${Paths.document.uri}user_annotations.json`;
const MEDITATION_LOGS_PATH = `${Paths.document.uri}meditation_logs.json`;
const GRADUAL_TRAINING_PATH = `${Paths.document.uri}gradual_training.json`;
const READING_LOGS_PATH = `${Paths.document.uri}reading_history.json`;

export interface SegmentAnnotation {
  segId: string;
  color: "yellow" | "green" | "blue" | "purple";
  note?: string;
  updatedAt: number;
}

export interface MeditationLog {
  id: string;
  timestamp: number;
  durationMinutes: number;
  notes?: string;
}

export interface GradualTrainingCheckIn {
  date: string; // YYYY-MM-DD
  senseRestraint: boolean;
  moderationEating: boolean;
  wakefulness: boolean;
  mindfulnessClearComprehension: boolean;
  preceptsObserved: boolean;
  notes?: string;
}

export interface ReadingLog {
  uid: string;
  title: string;
  timestamp: number;
}

export interface Bookmark {
  uid: string;
  translated_name: string;
  root_name?: string;
  timestamp: number;
}

type IndexProgressCallback = (processed: number, total: number) => void;
let indexListeners: IndexProgressCallback[] = [];
let isIndexingActive = false;
let lastProgress = { processed: 0, total: 0 };

export function addIndexListener(callback: IndexProgressCallback) {
  indexListeners.push(callback);
  callback(lastProgress.processed, lastProgress.total);
  return () => {
    indexListeners = indexListeners.filter(l => l !== callback);
  };
}

export function isIndexingInProgress() {
  return isIndexingActive;
}

export async function getBookmarks(): Promise<Bookmark[]> {
  try {
    const file = new ExpoFile(BOOKMARKS_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    console.error("Error loading bookmarks:", error);
    return [];
  }
}

export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  try {
    const file = new ExpoFile(BOOKMARKS_PATH);
    await file.write(JSON.stringify(bookmarks));
  } catch (error) {
    console.error("Error saving bookmarks:", error);
  }
}

export async function toggleBookmark(
  uid: string, 
  translated_name: string, 
  root_name?: string
): Promise<boolean> {
  const bookmarks = await getBookmarks();
  const existingIndex = bookmarks.findIndex(b => b.uid === uid);
  let isBookmarked = false;
  
  if (existingIndex >= 0) {
    bookmarks.splice(existingIndex, 1);
  } else {
    bookmarks.unshift({ 
      uid, 
      translated_name, 
      root_name, 
      timestamp: Date.now() 
    });
    isBookmarked = true;
  }
  
  await saveBookmarks(bookmarks);
  return isBookmarked;
}

export async function checkBookmark(uid: string): Promise<boolean> {
  const bookmarks = await getBookmarks();
  return bookmarks.some(b => b.uid === uid);
}

export async function saveSettings(settings: any): Promise<void> {
  try {
    const file = new ExpoFile(SETTINGS_PATH);
    let current: any = {};
    if (await file.exists) {
      try {
        const content = await file.text();
        current = JSON.parse(content);
      } catch (e) {
        console.error("Error reading current settings during save:", e);
      }
    }
    const updated = { ...current, ...settings };
    await file.write(JSON.stringify(updated));
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

export async function loadSettings(): Promise<any | null> {
  try {
    const file = new ExpoFile(SETTINGS_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    return null;
  } catch (error) {
    console.error("Error loading settings:", error);
    return null;
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function isDataReady(): Promise<boolean> {
  const rootIndex = new ExpoFile(INDEX_PATH);
  const fileExists = await rootIndex.exists;
  if (!fileExists) {
    const generatedIndex = new ExpoFile(`${DATA_DIR}generated/sutta_index.json`);
    if (!(await generatedIndex.exists)) return false;
  }

  // Even if file exists, verify database is populated
  try {
    const database = await getDb();
    const result = await database.getFirstAsync<{ count: number }>(
      "SELECT count(*) as count FROM sutta_index"
    );
    const indexReady = (result?.count || 0) > 0;

    if (indexReady) {
      // Check if metadata is populated, if not build it in the background
      database.getFirstAsync<{ count: number }>(
        "SELECT count(*) as count FROM sutta_metadata"
      ).then((metaResult) => {
        if ((metaResult?.count || 0) === 0) {
          console.log("Metadata table is empty. Rebuilding in background...");
          populateMetadata(database).catch((err) => {
            console.error("Failed to build metadata in background:", err);
          });
        }
      }).catch((err) => {
        console.error("Failed to query sutta_metadata count:", err);
      });
    }

    return indexReady;
  } catch (error) {
    console.error("isDataReady DB check failed:", error);
    return false;
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  const globalAny = globalThis as any;

  if (dbPromise) {
    try {
      const db = await dbPromise;
      return db;
    } catch (e) {
      // If previous attempt failed, clear it and try again
      dbPromise = null;
    }
  }

  // Hot Reload protection: Close old SQLite connections to release zombie locks
  if (globalAny.__dbInstance) {
    try {
      const oldDb = globalAny.__dbInstance;
      globalAny.__dbInstance = null;
      await oldDb.closeAsync();
      console.log("[DB] Closed previous database instance to release locks.");
    } catch (e) {
      console.error("[DB] Error closing previous database connection:", e);
    }
  }

  dbPromise = (async () => {
    try {
      const instance = await SQLite.openDatabaseAsync(DB_NAME);
      globalAny.__dbInstance = instance; // Store instance globally to clean up on reload

      // Migration logic: Check if sutta_index exists and has the 'data' column
      const tableInfo = await instance.getAllAsync<any>(
        "PRAGMA table_info(sutta_index)",
      );
      const hasDataColumn = tableInfo.some((col) => col.name === "data");

      if (tableInfo.length > 0 && !hasDataColumn) {
        console.log("Old schema detected, dropping old sutta_index table...");
        await instance.execAsync("DROP TABLE IF EXISTS sutta_index");
        await instance.execAsync("DROP TABLE IF EXISTS sutta_metadata");
      }

      // Migration: detect old 3-column trigram FTS table and replace with
      // new 7-column unicode61 FTS table for weighted search + diacritics
      let needsFtsRebuild = false;
      try {
        const ftsCheck = await instance.getAllAsync<any>(
          "PRAGMA table_info(sutta_fts)",
        );
        // Old schema has 3 columns (uid, title, content)
        // New schema has 7 columns (uid, root_title, translated_title, acronym, blurb, translation_text, root_text)
        const hasOldSchema = ftsCheck.length > 0 && ftsCheck.length <= 3;
        const hasNewColumns = ftsCheck.some((col: any) => col.name === "root_title");
        if (hasOldSchema || (ftsCheck.length > 0 && !hasNewColumns)) {
          console.log("Old FTS schema detected. Rebuilding with new 7-column schema...");
          needsFtsRebuild = true;
        }
      } catch (e) {
        // FTS table doesn't exist yet, that's fine
        needsFtsRebuild = true;
      }

      if (needsFtsRebuild) {
        await instance.execAsync("DROP TABLE IF EXISTS sutta_fts");
      }

      await instance.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS sutta_index (
          uid TEXT PRIMARY KEY,
          title TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sutta_metadata (
          uid TEXT PRIMARY KEY,
          translated_name TEXT,
          root_name TEXT,
          acronym TEXT,
          blurb TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS sutta_fts USING fts5(
          uid,
          root_title,
          translated_title,
          acronym,
          blurb,
          translation_text,
          root_text,
          tokenize = 'unicode61 remove_diacritics 2'
        );
      `);

      return instance;
    } catch (error) {
      dbPromise = null; // Reset on error
      throw error;
    }
  })();

  return dbPromise;
}

export async function populateIndex(onProgress?: (progress: number) => void) {
  const database = await getDb();
  if (!database) throw new Error("Database not initialized");

  let indexFile = new ExpoFile(INDEX_PATH);
  if (!(await indexFile.exists)) {
    const fallbackPath = `${DATA_DIR}generated/sutta_index.json`;
    console.log(`Index not found at root, checking fallback: ${fallbackPath}`);
    indexFile = new ExpoFile(fallbackPath);
  }

  if (!(await indexFile.exists)) {
    throw new Error(`Index file not found in sutta_data or generated/ folder.`);
  }

  const rawIndex = await indexFile.text();
  const data = JSON.parse(rawIndex);
  const entries = Object.entries(data) as [string, any][];
  const total = entries.length;

  console.log(`Starting index population for ${total} entries...`);

  try {
    // Step 1: Populate the main sutta_index table
    await database.withTransactionAsync(async () => {
      console.log("Cleaning old index data...");
      await database.execAsync("DELETE FROM sutta_index");

      let processed = 0;
      for (const [uid, entry] of entries) {
        const title = entry.title || uid;
        const entryData = JSON.stringify(entry);

        await database.runAsync(
          "INSERT INTO sutta_index (uid, title, data) VALUES (?, ?, ?)",
          [uid, title, entryData]
        );

        processed++;
        if (onProgress && processed % 100 === 0) {
          onProgress(processed / total);
        }
      }
    });
    console.log(`sutta_index populated with ${total} entries.`);

    // Step 2: Populate metadata from menu files
    try {
      await populateMetadata(database);
    } catch (metaErr) {
      console.error("Error populating metadata in populateIndex:", metaErr);
    }

    // Step 3: Populate FTS with uid + metadata columns (title/acronym/blurb)
    // Body text columns are left empty — filled by buildFullTextIndex()
    await populateFtsMetadata(database);

  } catch (err) {
    console.error("Error during withTransactionAsync in populateIndex:", err);
    throw err;
  }
}

/**
 * Populates the FTS table with metadata-only columns (titles, acronym, blurb).
 * Body text columns (translation_text, root_text) are left empty for
 * background indexing by buildFullTextIndex().
 */
async function populateFtsMetadata(database: SQLite.SQLiteDatabase) {
  console.log("Populating FTS metadata columns...");

  // Clear and rebuild FTS from sutta_index + sutta_metadata
  await database.execAsync("DELETE FROM sutta_fts");

  const rows = await database.getAllAsync<any>(
    `SELECT 
       i.uid,
       i.title,
       m.translated_name,
       m.root_name,
       m.acronym,
       m.blurb
     FROM sutta_index i
     LEFT JOIN sutta_metadata m ON i.uid = m.uid`
  );

  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await database.withTransactionAsync(async () => {
      const stmt = await database.prepareAsync(
        `INSERT INTO sutta_fts (uid, root_title, translated_title, acronym, blurb, translation_text, root_text)
         VALUES (?, ?, ?, ?, ?, '', '')`
      );
      try {
        for (const row of batch) {
          await stmt.executeAsync([
            row.uid,
            row.root_name || row.title || "",
            row.translated_name || "",
            row.acronym || "",
            stripHtml(row.blurb || ""),
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    });
  }

  console.log(`FTS metadata populated for ${rows.length} entries.`);
}

export async function populateMetadata(database: SQLite.SQLiteDatabase) {
  console.log("Starting metadata index population...");
  const menusDir = new Directory(`${DATA_DIR}menus/`);
  if (!(await menusDir.exists)) {
    console.warn("Menus directory does not exist, cannot populate metadata.");
    return;
  }

  const files = await menusDir.list();
  const metadataMap = new Map<string, any>();

  const walkMenuNode = (node: any) => {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const child of node) {
        walkMenuNode(child);
      }
      return;
    }

    if (node.uid) {
      const uid = node.uid;
      if (node.translated_name || node.root_name || node.acronym || node.blurb) {
        let existing = metadataMap.get(uid);
        if (!existing) {
          existing = {};
          metadataMap.set(uid, existing);
        }
        if (node.translated_name) existing.translated_name = node.translated_name.trim();
        if (node.root_name) existing.root_name = node.root_name.trim();
        if (node.acronym) existing.acronym = node.acronym.trim();
        if (node.blurb) existing.blurb = node.blurb.trim();
      }
    }

    if (node.children) {
      walkMenuNode(node.children);
    }
  };

  const batchSize = 100;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (file) => {
        if (file instanceof ExpoFile && file.name.endsWith(".json")) {
          try {
            const content = await file.text();
            const data = JSON.parse(content);
            walkMenuNode(data);
          } catch (e) {
            console.error(`Error parsing menu file ${file.name}:`, e);
          }
        }
      })
    );
  }

  console.log(`Parsed metadata for ${metadataMap.size} unique UIDs. Inserting into DB...`);

  await database.withTransactionAsync(async () => {
    await database.execAsync("DELETE FROM sutta_metadata");
    const insertMetaStmt = await database.prepareAsync(
      "INSERT INTO sutta_metadata (uid, translated_name, root_name, acronym, blurb) VALUES (?, ?, ?, ?, ?)"
    );
    try {
      for (const [uid, meta] of metadataMap.entries()) {
        await insertMetaStmt.executeAsync([
          uid,
          meta.translated_name || null,
          meta.root_name || null,
          meta.acronym || null,
          meta.blurb || null,
        ]);
      }
    } finally {
      await insertMetaStmt.finalizeAsync();
    }
  });

  console.log("Metadata index populated successfully.");
}

/**
 * Background task to index the full body content of all suttas.
 * Uses DELETE + INSERT pattern (not UPDATE) because FTS5 virtual tables
 * don't support UPDATE reliably. Preserves metadata columns from
 * the initial FTS population.
 * Processes in batches to avoid blocking the main thread.
 */
export async function buildFullTextIndex(
  onProgress?: (processed: number, total: number) => void,
) {
  if (isIndexingActive) return;
  isIndexingActive = true;
  
  try {
    const database = await getDb();

    // Find UIDs that need body content indexing (translation_text is empty)
    const pending = await database.getAllAsync<{ uid: string }>(
      `SELECT uid FROM sutta_fts WHERE translation_text = '' AND root_text = ''`,
    );

    if (pending.length === 0) {
      isIndexingActive = false;
      return;
    }

    const total = pending.length;
    let processed = 0;
    const batchSize = 50;

    // Check base directory structure ONCE outside the loop
    const isPublished = await new Directory(`${DATA_DIR}bilara-data-published/`).exists;
    const bilaraDirName = isPublished ? "bilara-data-published" : "bilara-data";
    const baseDir = `${DATA_DIR}${bilaraDirName}/`;

    // Lightweight text loader specifically optimized for indexing
    const loadTextForIndexing = async (entry: any) => {
      let rootStr = "";
      let translationStr = "";

      if (!entry) return { rootStr, translationStr };

      if (entry.online_cached) {
        if (entry.translation_text) {
          translationStr = Object.values(entry.translation_text).map(v => stripHtml(v as string)).join(" ");
        }
        if (entry.root_text) {
          rootStr = Object.values(entry.root_text).map(v => stripHtml(v as string)).join(" ");
        }
        return { rootStr, translationStr };
      }

      if (entry.root) {
        try {
          const rootFile = new ExpoFile(`${baseDir}root/pli/ms/${entry.root}`);
          if (await rootFile.exists) {
            const parsed = JSON.parse(await rootFile.text());
            rootStr = Object.values(parsed).map(v => stripHtml(v as string)).join(" ");
          }
        } catch (e) {}
      }

      if (entry.online_translation_text) {
        translationStr = Object.values(entry.online_translation_text).map(v => stripHtml(v as string)).join(" ");
      } else if (entry.translations) {
        const selectedAuthor = entry.translations["sujato"] ? "sujato" : (Object.keys(entry.translations)[0] || "sujato");
        const transPath = entry.translations[selectedAuthor];
        if (transPath) {
          try {
            if (transPath.endsWith(".html")) {
              const transFile = new ExpoFile(`${baseDir}${transPath}`);
              if (await transFile.exists) {
                translationStr = stripHtml(await transFile.text());
              }
            } else {
              const transFile = new ExpoFile(`${baseDir}translation/en/${selectedAuthor}/${transPath}`);
              if (await transFile.exists) {
                const parsed = JSON.parse(await transFile.text());
                translationStr = Object.values(parsed).map(v => stripHtml(v as string)).join(" ");
              }
            }
          } catch (e) {}
        }
      }

      return { rootStr, translationStr };
    };

    // Prepare SQLite Statements once for the entire indexing run
    const deleteStmt = await database.prepareAsync(
      "DELETE FROM sutta_fts WHERE uid = ?",
    );
    const insertStmt = await database.prepareAsync(
      `INSERT INTO sutta_fts (uid, root_title, translated_title, acronym, blurb, translation_text, root_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    try {
      for (let i = 0; i < pending.length; i += batchSize) {
        const batchUids = pending.slice(i, i + batchSize).map(p => p.uid);
        const placeholders = batchUids.map(() => "?").join(",");

        // Batch query metadata and index JSON data for all items in this batch simultaneously
        const rows = await database.getAllAsync<any>(
          `SELECT 
             i.uid,
             i.title,
             i.data,
             m.translated_name,
             m.root_name,
             m.acronym,
             m.blurb
           FROM sutta_index i
           LEFT JOIN sutta_metadata m ON i.uid = m.uid
           WHERE i.uid IN (${placeholders})`,
          batchUids,
        );

        const payloads: any[] = [];

        for (const row of rows) {
          try {
            let entry = null;
            if (row.data) {
              try { entry = JSON.parse(row.data); } catch (e) {}
            }
            const { rootStr, translationStr } = await loadTextForIndexing(entry);

            payloads.push({
              uid: row.uid,
              root_title: row.root_name || row.title || "",
              translated_title: row.translated_name || "",
              acronym: row.acronym || "",
              blurb: stripHtml(row.blurb || ""),
              translation_text: translationStr.trim(),
              root_text: rootStr.trim(),
            });
          } catch (err) {
            console.error(`Error processing content for ${row.uid}:`, err);
          }
        }

        // Fast batch writes using Expo SDK native withTransactionAsync (prevents app freeze/deadlocks)
        await database.withTransactionAsync(async () => {
          for (const payload of payloads) {
            try {
              await deleteStmt.executeAsync([payload.uid]);
              await insertStmt.executeAsync([
                payload.uid,
                payload.root_title,
                payload.translated_title,
                payload.acronym,
                payload.blurb,
                payload.translation_text,
                payload.root_text,
              ]);
            } catch (err) {
              console.error(`Error writing FTS index for ${payload.uid}:`, err);
            }
            processed++;
          }
        });

        if (onProgress) {
          onProgress(processed, total);
        }
        
        lastProgress = { processed, total };
        indexListeners.forEach(l => l(processed, total));

        // Yield execution briefly to keep UI smooth and responsive
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      await deleteStmt.finalizeAsync();
      await insertStmt.finalizeAsync();
    }
  } catch (error) {
    console.error("Error building full text index:", error);
  } finally {
    isIndexingActive = false;
    indexListeners.forEach(l => l(lastProgress.total || 0, lastProgress.total || 0));
  }
}

/**
 * Finds a leaf node in the stored menu JSON files under DATA_DIR/menus/.
 */
export async function findLeafNodeInMenus(uid: string): Promise<any | null> {
  const menusDir = new Directory(`${DATA_DIR}menus/`);
  if (!(await menusDir.exists)) return null;

  try {
    const files = await menusDir.list();
    
    const walk = (node: any): any | null => {
      if (!node || typeof node !== "object") return null;

      if (Array.isArray(node)) {
        for (const child of node) {
          const found = walk(child);
          if (found) return found;
        }
        return null;
      }

      if (node.uid && node.uid.toLowerCase() === uid.toLowerCase() && (node.node_type === "leaf" || node.type === "text")) {
        return node;
      }

      if (node.children) {
        return walk(node.children);
      }

      return null;
    };

    for (const file of files) {
      if (file instanceof ExpoFile && file.name.endsWith(".json")) {
        try {
          const content = await file.text();
          const data = JSON.parse(content);
          const found = walk(data);
          if (found) return found;
        } catch (e) {
          // Ignore parsing errors for individual files
        }
      }
    }
  } catch (err) {
    console.error("Error reading menus directory:", err);
  }

  return null;
}

/**
 * Strips HTML tags from a string.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, "");
}

export async function getSuttaContent(
  uid: string,
  author: string = "sujato",
): Promise<any | null> {
  const lowerUid = uid.toLowerCase();
  const database = await getDb();

  const result = await database.getFirstAsync<any>(
    "SELECT data FROM sutta_index WHERE uid = ?",
    [uid],
  );

  let entry: any = null;
  if (result) {
    entry = JSON.parse(result.data);
  }

  // If this entry was previously fetched online and cached, return it directly
  if (entry && entry.online_cached) {
    let resolvedRootLang = entry.root_lang;
    if (!resolvedRootLang) {
      if (lowerUid.startsWith("t") || lowerUid.startsWith("da") || lowerUid.startsWith("ma") || lowerUid.startsWith("sa") || lowerUid.startsWith("ea")) {
        resolvedRootLang = "lzh";
      } else if (lowerUid.startsWith("arv")) {
        resolvedRootLang = "san";
      } else {
        resolvedRootLang = "pli";
      }
    }
    return {
      uid: entry.uid,
      root_text: entry.root_text || {},
      translation_text: entry.translation_text || {},
      comment_text: entry.comment_text || {},
      html_text: entry.html_text || {},
      author_uid: entry.author_uid || author,
      root_lang: resolvedRootLang,
    };
  }

  let rootText: Record<string, string> = {};
  let translationText: Record<string, string> = {};
  let commentText: Record<string, string> = {};
  let htmlText: Record<string, string> = {};

  // Check if we have local translation paths. If not (or if not in database at all), trigger online fallback fetch
  const hasLocalTranslations = entry?.translations && Object.keys(entry.translations).length > 0;
  const hasLocalRoot = entry?.root;

  if (!entry || (!hasLocalTranslations && !hasLocalRoot)) {
    try {
      console.log(`[Online Fallback] Fetching non-Pāli/missing sutta content online for ${uid}...`);
      
      const leafNode = await findLeafNodeInMenus(uid);
      let authorUid = author;
      let lang = "en";

      if (leafNode) {
        const translations = leafNode.translations || [];
        let selectedTrans = null;

        if (author && author !== "sujato") {
          selectedTrans = translations.find((t: any) => t.author_uid === author);
        }

        if (!selectedTrans) {
          // Prioritize English translation
          selectedTrans = translations.find((t: any) => t.lang === "en");
        }

        if (!selectedTrans && leafNode.root_lang_iso) {
          // Fallback to the root language translation (e.g. lzh for taisho)
          selectedTrans = translations.find((t: any) => t.lang === leafNode.root_lang_iso);
        }

        if (!selectedTrans && translations.length > 0) {
          // Just take the first available translation
          selectedTrans = translations[0];
        }

        if (selectedTrans) {
          authorUid = selectedTrans.author_uid;
          lang = selectedTrans.lang;
        } else {
          if (leafNode.root_lang_iso) {
            lang = leafNode.root_lang_iso;
          }
          if (!authorUid || authorUid === "sujato") {
            if (lowerUid.startsWith("t") || lowerUid.startsWith("da") || lowerUid.startsWith("ma") || lowerUid.startsWith("sa") || lowerUid.startsWith("ea")) {
              authorUid = "taisho";
            } else {
              authorUid = "common";
            }
          }
        }
      } else {
        if (!authorUid || authorUid === "sujato") {
          if (lowerUid.startsWith("t") || lowerUid.startsWith("da") || lowerUid.startsWith("ma") || lowerUid.startsWith("sa") || lowerUid.startsWith("ea")) {
            authorUid = "taisho";
            lang = "lzh";
          } else {
            authorUid = "common";
            lang = "en";
          }
        }
      }

      const siteLang = "en";
      const fetchUrl = `https://suttacentral.net/api/suttas/${uid}/${authorUid}?lang=${lang}&siteLanguage=${siteLang}`;
      console.log(`[Online Fallback] Fetching URL: ${fetchUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      let response;
      try {
        response = await fetch(fetchUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (response && response.ok) {
        const json = await response.json();
        
        // SuttaCentral API return structures for non-Pāli texts
        const rootObj = json.root_text;
        const transObj = json.translation;
        
        const parseHtmlToParagraphs = (html: string) => {
          if (!html) return {};
          const regex = /<(p|h1|h2|h3|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
          let match;
          const paragraphs: Record<string, string> = {};
          let idx = 1;
          while ((match = regex.exec(html)) !== null) {
            let tag = match[1].toLowerCase();
            const attrs = match[2];
            const text = match[3]
              .replace(/<a[^>]*>[^<]*<\/a>/gi, "") // Remove anchor refs
              .replace(/<\/?[^>]+(>|$)/g, "") // Remove inner tags
              .trim();
            if (text.length > 0) {
              if (tag === "li" && attrs.includes("division")) tag = "division";
              paragraphs[`${uid}:legacy:${tag}:${idx}`] = text;
              idx++;
            }
          }
          return paragraphs;
        };

        if (rootObj && rootObj.text) {
          rootText = parseHtmlToParagraphs(rootObj.text);
        }
        if (transObj && transObj.text) {
          translationText = parseHtmlToParagraphs(transObj.text);
        }

        if (Object.keys(rootText).length > 0 || Object.keys(translationText).length > 0) {
          const finalAuthorUid = transObj?.author_uid || rootObj?.author_uid || authorUid;
          const rootLang = leafNode?.root_lang_iso || rootObj?.lang || (lowerUid.startsWith("t") || lowerUid.startsWith("da") || lowerUid.startsWith("ma") || lowerUid.startsWith("sa") || lowerUid.startsWith("ea") ? "lzh" : "pli");
          const cachedEntry = {
            uid,
            online_cached: true,
            root_text: rootText,
            translation_text: translationText,
            comment_text: {},
            html_text: {},
            author_uid: finalAuthorUid,
            root_lang: rootLang,
          };

          try {
            await database.runAsync(
              "INSERT OR REPLACE INTO sutta_index (uid, title, data) VALUES (?, ?, ?)",
              [uid, transObj?.title || rootObj?.title || uid, JSON.stringify(cachedEntry)]
            );
            console.log(`[Online Fallback] Successfully cached ${uid} to database.`);
          } catch (dbErr) {
            console.error(`[Online Fallback] Failed to cache ${uid} to database:`, dbErr);
          }

          return {
            uid,
            root_text: rootText,
            translation_text: translationText,
            comment_text: {},
            html_text: {},
            author_uid: finalAuthorUid,
            root_lang: rootLang,
          };
        }
      }
    } catch (onlineErr) {
      console.error(`[Online Fallback] Failed to fetch sutta ${uid} online:`, onlineErr);
    }
  }

  // If we don't have a database entry and online fetch failed, return null
  if (!entry) return null;

  const isPublished = await new Directory(`${DATA_DIR}bilara-data-published/`).exists;
  const bilaraDirName = isPublished ? "bilara-data-published" : "bilara-data";
  const baseDir = `${DATA_DIR}${bilaraDirName}/`;
  if (entry.root) {
    try {
      const rootFile = new ExpoFile(`${baseDir}root/pli/ms/${entry.root}`);
      if (await rootFile.exists) {
        rootText = JSON.parse(await rootFile.text());
      }
    } catch (e) {}
  }

  // Load Translation and Comments
  let selectedAuthor = author;
  if (entry && entry.online_translation_text) {
    translationText = entry.online_translation_text;
    selectedAuthor = entry.online_author_uid || selectedAuthor;
  } else if (entry.translations) {
    if (!entry.translations[selectedAuthor]) {
      selectedAuthor = Object.keys(entry.translations)[0] || "sujato";
    }

    if (entry.translations[selectedAuthor]) {
      const transPath = entry.translations[selectedAuthor];
      try {
        // Check if it's a legacy HTML file or a standard Bilara JSON
        if (transPath.endsWith(".html")) {
          // Legacy HTML: load from its specific path (relative to baseDir)
          const transFile = new ExpoFile(`${baseDir}${transPath}`);
          if (await transFile.exists) {
            const html = await transFile.text();
            const regex = /<(p|h1|h2|h3|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
            let match;
            const paragraphs: { tag: string; text: string }[] = [];
            while ((match = regex.exec(html)) !== null) {
              let tag = match[1].toLowerCase();
              const attrs = match[2];
              const text = match[3]
                .replace(/<a[^>]*>[^<]*<\/a>/gi, "")
                .replace(/<\/?[^>]+(>|$)/g, "")
                .trim();
              if (text.length > 0) {
                if (tag === "li" && attrs.includes("division")) tag = "division";
                paragraphs.push({ tag, text });
              }
            }
            translationText = {};
            paragraphs.forEach((p, idx) => {
              translationText[`${uid}:legacy:${p.tag}:${idx + 1}`] = p.text;
            });
          }
        } else {
          // Standard Bilara JSON
          const transFile = new ExpoFile(
            `${baseDir}translation/en/${selectedAuthor}/${transPath}`,
          );
          if (await transFile.exists) {
            translationText = JSON.parse(await transFile.text());
          }

          // Comment file (often matching the translation filename pattern)
          const commentFilename = transPath.replace("_translation-en-", "_comment-en-");
          const commentFile = new ExpoFile(
            `${baseDir}comment/en/${selectedAuthor}/${commentFilename}`,
          );
          if (await commentFile.exists) {
            commentText = JSON.parse(await commentFile.text());
          }
        }
      } catch (e) {
        console.error(`Error loading translation for ${uid}:`, e);
      }
    }
  }

  // Fallback: search legacy HTML files directly if translationText is empty
  if (Object.keys(translationText).length === 0 && entry.root) {
    try {
      const relSuffix = entry.root.replace(/_root-pli-ms\.json$/, ".html");
      const LEGACY_AUTHORS = [
        "unandamedha",
        "unarada",
        "thittila",
        "ukumarabhivamsa",
        "sujato",
        "anandajoti",
        "rhysdavids_litt",
        "aung-rhysdavids",
        "narada",
        "law",
        "agganyani",
      ];
      const authorsToTry = [
        selectedAuthor,
        ...LEGACY_AUTHORS.filter((a) => a !== selectedAuthor),
      ];

      let foundPath: string | null = null;
      let foundAuthor: string | null = null;

      for (const auth of authorsToTry) {
        const testPath = `legacy/en/${auth}/${relSuffix}`;
        const file = new ExpoFile(`${baseDir}${testPath}`);
        if (await file.exists) {
          foundPath = testPath;
          foundAuthor = auth;
          break;
        }
      }

      if (foundPath && foundAuthor) {
        const file = new ExpoFile(`${baseDir}${foundPath}`);
        const html = await file.text();
        const regex = /<(p|h1|h2|h3|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
        let match;
        const paragraphs: { tag: string; text: string }[] = [];
        while ((match = regex.exec(html)) !== null) {
          let tag = match[1].toLowerCase();
          const attrs = match[2];
          const text = match[3]
            .replace(/<a[^>]*>[^<]*<\/a>/gi, "")
            .replace(/<\/?[^>]+(>|$)/g, "")
            .trim();
          if (text.length > 0) {
            if (tag === "li" && attrs.includes("division")) tag = "division";
            paragraphs.push({ tag, text });
          }
        }
        translationText = {};
        paragraphs.forEach((p, idx) => {
          translationText[`${uid}:legacy:${p.tag}:${idx + 1}`] = p.text;
        });
        selectedAuthor = foundAuthor;
      }
    } catch (err) {
      console.error(`Error searching fallback legacy translations for ${uid}:`, err);
    }
  }

  // Fallback 2: Try online fallback fetch for legacy translation if still empty
  if (Object.keys(translationText).length === 0) {
    try {
      console.log(`[Online Fallback Legacy] Fetching translation online for ${uid}...`);
      const leafNode = await findLeafNodeInMenus(uid);
      let authorUid = selectedAuthor;
      if (leafNode) {
        const translations = leafNode.translations || [];
        const enTrans = translations.find((t: any) => t.lang === "en");
        if (enTrans) {
          authorUid = enTrans.author_uid;
        }
      }

      // Default fallback authors by book if not found
      if (!authorUid || authorUid === "sujato") {
        const lowerUid = uid.toLowerCase();
        if (lowerUid.startsWith("ds")) {
          authorUid = "rhysdavids_litt";
        } else if (lowerUid.startsWith("vb")) {
          authorUid = "thittila";
        } else if (lowerUid.startsWith("kv")) {
          authorUid = "aung-rhysdavids";
        } else if (lowerUid.startsWith("pp")) {
          authorUid = "law";
        } else if (lowerUid.startsWith("dt")) {
          authorUid = "narada";
        }
      }

      const fetchUrl = `https://suttacentral.net/api/suttas/${uid}/${authorUid}?lang=en`;
      console.log(`[Online Fallback Legacy] Fetching URL: ${fetchUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      let response;
      try {
        response = await fetch(fetchUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (response && response.ok) {
        const json = await response.json();
        const transObj = json.translation || json.root_text;
        if (transObj && transObj.text) {
          const html = transObj.text;
          const regex = /<(p|h1|h2|h3|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
          let match;
          const paragraphs: { tag: string; text: string }[] = [];
          while ((match = regex.exec(html)) !== null) {
            let tag = match[1].toLowerCase();
            const attrs = match[2];
            const text = match[3]
              .replace(/<a[^>]*>[^<]*<\/a>/gi, "")
              .replace(/<\/?[^>]+(>|$)/g, "")
              .trim();
            if (text.length > 0) {
              if (tag === "li" && attrs.includes("division")) tag = "division";
              paragraphs.push({ tag, text });
            }
          }
          translationText = {};
          paragraphs.forEach((p, idx) => {
            translationText[`${uid}:legacy:${p.tag}:${idx + 1}`] = p.text;
          });
          selectedAuthor = authorUid;

          // Cache the translation inside the database!
          try {
            const result = await database.getFirstAsync<any>(
              "SELECT data FROM sutta_index WHERE uid = ?",
              [uid]
            );
            if (result) {
              const dbEntry = JSON.parse(result.data);
              dbEntry.online_translation_text = translationText;
              dbEntry.online_author_uid = authorUid;
              await database.runAsync(
                "UPDATE sutta_index SET data = ? WHERE uid = ?",
                [JSON.stringify(dbEntry), uid]
              );
              console.log(`[Online Fallback Legacy] Cached translation for ${uid} successfully.`);
            }
          } catch (cacheErr) {
            console.error("[Online Fallback Legacy] Failed to cache translation:", cacheErr);
          }
        }
      }
    } catch (onlineErr) {
      console.error(`[Online Fallback Legacy] Failed to fetch translation online for ${uid}:`, onlineErr);
    }
  }

  // Load HTML (optional)
  if (entry.root) {
    try {
      const htmlRelPath = entry.root.replace("_root-pli-ms.json", "_html.json");
      const htmlFile = new ExpoFile(`${baseDir}html/pli/ms/${htmlRelPath}`);
      if (await htmlFile.exists) {
        htmlText = JSON.parse(await htmlFile.text());
      }
    } catch (e) {}
  }

  return {
    uid,
    root_text: rootText,
    translation_text: translationText,
    comment_text: commentText,
    html_text: htmlText,
    author_uid: selectedAuthor,
    root_lang: "pli",
  };
}

export async function resolveSuttaTitle(uid: string): Promise<string | null> {
  try {
    const database = await getDb();
    const result = await database.getFirstAsync<any>(
      "SELECT data FROM sutta_index WHERE uid = ?",
      [uid],
    );
    if (!result) return null;
    const entry = JSON.parse(result.data);

    const isPublished = await new Directory(`${DATA_DIR}bilara-data-published/`).exists;
    const bilaraDirName = isPublished ? "bilara-data-published" : "bilara-data";
    const baseDir = `${DATA_DIR}${bilaraDirName}/`;

    let title: string | null = null;

    // Try translation first (default: "sujato")
    if (entry.translations) {
      const selectedAuthor = Object.keys(entry.translations)[0] || "sujato";
      const transPath = entry.translations[selectedAuthor];
      if (transPath) {
        if (transPath.endsWith(".html")) {
          const transFile = new ExpoFile(`${baseDir}${transPath}`);
          if (await transFile.exists) {
            const html = await transFile.text();
            title = stripHtml(html).split("\n")[0]?.trim() || null;
          }
        } else {
          const transFile = new ExpoFile(
            `${baseDir}translation/en/${selectedAuthor}/${transPath}`,
          );
          if (await transFile.exists) {
            const trans = JSON.parse(await transFile.text());
            title = trans[`${uid}:0.2`] || trans[`${uid}:0.1`] || null;
            if (!title) {
              const keys = Object.keys(trans);
              const fallback = keys.find(k => k.startsWith(`${uid}:0.2`) || k.endsWith(":0.2"));
              if (fallback) title = trans[fallback];
            }
          }
        }
      }
    }

    // Try fallback legacy HTML filesystem lookup if no title resolved yet
    if (!title && entry.root) {
      const relSuffix = entry.root.replace(/_root-pli-ms\.json$/, ".html");
      const LEGACY_AUTHORS = [
        "unandamedha",
        "unarada",
        "thittila",
        "ukumarabhivamsa",
        "sujato",
        "anandajoti",
        "rhysdavids_litt",
        "aung-rhysdavids",
        "narada",
        "law",
        "agganyani",
      ];
      for (const auth of LEGACY_AUTHORS) {
        const testPath = `legacy/en/${auth}/${relSuffix}`;
        const file = new ExpoFile(`${baseDir}${testPath}`);
        if (await file.exists) {
          const html = await file.text();
          const match = html.match(/<h1>([^<]*)<\/h1>/i);
          if (match) {
            title = stripHtml(match[1]).trim();
          }
          break;
        }
      }
    }

    // Try root (Pali) if translation is missing
    if (!title && entry.root) {
      const rootFile = new ExpoFile(`${baseDir}root/pli/ms/${entry.root}`);
      if (await rootFile.exists) {
        const root = JSON.parse(await rootFile.text());
        title = root[`${uid}:0.2`] || root[`${uid}:0.1`] || null;
        if (!title) {
          const keys = Object.keys(root);
          const fallback = keys.find(k => k.startsWith(`${uid}:0.2`) || k.endsWith(":0.2"));
          if (fallback) title = root[fallback];
        }
      }
    }

    if (title) {
      title = title.trim();
      // Cache it in sutta_metadata table
      await database.runAsync(
        `INSERT INTO sutta_metadata (uid, translated_name) 
         VALUES (?, ?) 
         ON CONFLICT(uid) DO UPDATE SET translated_name = excluded.translated_name`,
        [uid, title],
      );
      return title;
    }
  } catch (err) {
    console.error(`Error resolving sutta title for ${uid}:`, err);
  }
  return null;
}

/**
 * Escapes special FTS5 query syntax characters.
 * Wraps each word in quotes to prevent FTS5 from interpreting
 * operators like AND, OR, NOT, NEAR, or prefix * in user input.
 */
function buildFtsQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '""';

  // Split into words, wrap each in double quotes to disable operator parsing
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    // Single word: use prefix match with *
    const escaped = words[0].replace(/"/g, '""');
    return `"${escaped}" *`;
  }
  // Multiple words: match each word (implicit AND in FTS5)
  return words.map(w => `"${w.replace(/"/g, '""')}"`).join(" ");
}

export async function searchSuttas(query: string): Promise<any[]> {
  const database = await getDb();
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  // Normalize UID format: "SN 56.11" -> "sn56.11", "sn56:11" -> "sn56.11"
  const normalizedUid = trimmedQuery
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/:/g, ".");

  // ── Tier 1: Exact UID match ──
  const exactMatches = await database.getAllAsync<any>(
    `SELECT 
       i.uid, 
       COALESCE(m.translated_name, i.title) as title,
       m.root_name,
       m.acronym,
       m.blurb,
       NULL as highlight,
       NULL as content_highlight,
       -1000 as search_rank
     FROM sutta_index i
     LEFT JOIN sutta_metadata m ON i.uid = m.uid
     WHERE i.uid = ? OR i.uid = ?`,
    [trimmedQuery, normalizedUid],
  );

  // ── Tier 2: UID prefix match ──
  const prefixMatches = await database.getAllAsync<any>(
    `SELECT 
       i.uid, 
       COALESCE(m.translated_name, i.title) as title,
       m.root_name,
       m.acronym,
       m.blurb,
       NULL as highlight,
       NULL as content_highlight,
       -500 as search_rank
     FROM sutta_index i
     LEFT JOIN sutta_metadata m ON i.uid = m.uid
     WHERE (i.uid LIKE ? OR i.uid LIKE ?)
       AND i.uid != ? AND i.uid != ?
     LIMIT 20`,
    [
      `${trimmedQuery}%`,
      `${normalizedUid}%`,
      trimmedQuery,
      normalizedUid,
    ],
  );

  // ── Tier 3: FTS5 weighted search ──
  // Column weights: uid(0), root_title(20), translated_title(20),
  //                 acronym(15), blurb(10), translation_text(5), root_text(5)
  let ftsMatches: any[] = [];
  try {
    const ftsQuery = buildFtsQuery(trimmedQuery);
    ftsMatches = await database.getAllAsync<any>(
      `SELECT 
         uid,
         root_title,
         translated_title,
         acronym as fts_acronym,
         blurb as fts_blurb,
         snippet(sutta_fts, 2, '<b>', '</b>', '…', 10) as highlight,
         snippet(sutta_fts, 5, '<b>', '</b>', '…', 15) as content_highlight,
         bm25(sutta_fts, 0, 20.0, 20.0, 15.0, 10.0, 5.0, 5.0) as search_rank
       FROM sutta_fts
       WHERE sutta_fts MATCH ?
       ORDER BY search_rank ASC
       LIMIT 80`,
      [ftsQuery],
    );
  } catch (ftsErr) {
    console.error("FTS search error:", ftsErr);
  }

  // Enrich FTS matches with metadata from sutta_metadata
  const ftsUids = ftsMatches.map(r => r.uid);
  let metaMap = new Map<string, any>();
  if (ftsUids.length > 0) {
    // Batch-fetch metadata for FTS results
    const placeholders = ftsUids.map(() => "?").join(",");
    const metaRows = await database.getAllAsync<any>(
      `SELECT 
         i.uid,
         COALESCE(m.translated_name, i.title) as title,
         m.root_name,
         m.acronym,
         m.blurb
       FROM sutta_index i
       LEFT JOIN sutta_metadata m ON i.uid = m.uid
       WHERE i.uid IN (${placeholders})`,
      ftsUids,
    );
    for (const row of metaRows) {
      metaMap.set(row.uid, row);
    }
  }

  const enrichedFts = ftsMatches.map(fts => {
    const meta = metaMap.get(fts.uid);
    return {
      uid: fts.uid,
      title: meta?.title || fts.translated_title || fts.root_title || fts.uid,
      root_name: meta?.root_name || fts.root_title || null,
      acronym: meta?.acronym || fts.fts_acronym || null,
      blurb: meta?.blurb || fts.fts_blurb || null,
      highlight: fts.highlight,
      content_highlight: fts.content_highlight,
      search_rank: fts.search_rank,
    };
  });

  // ── Merge & Deduplicate ──
  // Keep the best (lowest) search_rank for each UID
  const allResults = [...exactMatches, ...prefixMatches, ...enrichedFts];
  const dedupMap = new Map<string, any>();
  for (const item of allResults) {
    const existing = dedupMap.get(item.uid);
    if (!existing || item.search_rank < existing.search_rank) {
      // Merge: keep snippet data from FTS even if UID match won
      if (existing) {
        if (!item.highlight && existing.highlight) item.highlight = existing.highlight;
        if (!item.content_highlight && existing.content_highlight) item.content_highlight = existing.content_highlight;
        if (!item.blurb && existing.blurb) item.blurb = existing.blurb;
      }
      dedupMap.set(item.uid, item);
    } else if (existing) {
      // Keep snippets from lower-ranked duplicate
      if (!existing.highlight && item.highlight) existing.highlight = item.highlight;
      if (!existing.content_highlight && item.content_highlight) existing.content_highlight = item.content_highlight;
    }
  }

  const deduped = Array.from(dedupMap.values());
  deduped.sort((a, b) => a.search_rank - b.search_rank);

  // Limit to 50 results
  const limited = deduped.slice(0, 50);

  // Dynamically resolve titles if they fell back to the raw uid/id
  const resolved = await Promise.all(
    limited.map(async (item) => {
      if (item.title && item.title.toLowerCase() === item.uid.toLowerCase()) {
        const title = await resolveSuttaTitle(item.uid);
        if (title) {
          item.title = title;
        }
      }
      return item;
    })
  );

  return resolved;
}

export async function getRandomSuttas(
  limit: number = 10,
): Promise<{ uid: string; title: string }[]> {
  const database = await getDb();
  return await database.getAllAsync<{ uid: string; title: string }>(
    "SELECT uid, title FROM sutta_index ORDER BY RANDOM() LIMIT ?",
    [limit],
  );
}

export async function getMenu(menuId: string): Promise<any | null> {
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

export async function getRootCategories(): Promise<any[]> {
  try {
    const dataDir = new Directory(DATA_DIR);
    if (!(await dataDir.exists)) {
      console.warn("sutta_data directory does not exist");
      return [];
    }

    const items = await dataDir.list();
    const allItems = [...items];
    
    // Also check generated/ and menus/ subdirectories
    for (const item of items) {
      if (item instanceof Directory && (item.name === "generated" || item.name === "menus")) {
        try {
          const subItems = await item.list();
          allItems.push(...subItems);
        } catch (e) {}
      }
    }

    // Find a file that looks like a menu file or root structure
    const menuFileItem = allItems.find(i => {
      if (!(i instanceof ExpoFile)) return false;
      const name = i.name.toLowerCase();
      return (name === "root.json" || name.includes("menu")) && name.endsWith(".json");
    });

    if (!menuFileItem || !(menuFileItem instanceof ExpoFile)) {
      console.warn("No root menu file found in sutta_data or subdirectories. Found:", allItems.map(i => i.name).join(", "));
      return [];
    }

    console.log(`Loading categories from: ${menuFileItem.uri}`);
    const content = await menuFileItem.text();
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) return [];

    const orderMap: Record<string, number> = {
      sutta: 1,
      vinaya: 2,
      abhidhamma: 3
    };

    return data
      .filter((item: any) => 
        item.node_type === "root" && 
        (
          (item.children && item.children.length > 0) || 
          item.yellow_brick_road === true ||
          (item.yellow_brick_road_count && item.yellow_brick_road_count > 0)
        )
      )
      .sort((a, b) => {
        const orderA = orderMap[a.uid] || 99;
        const orderB = orderMap[b.uid] || 99;
        return orderA - orderB;
      });
  } catch (error) {
    console.error("Error finding root categories:", error);
    return [];
  }
}

export async function getUserNotes(): Promise<Record<string, string>> {
  try {
    const file = new ExpoFile(NOTES_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    return {};
  } catch (error) {
    console.error("Error loading user notes:", error);
    return {};
  }
}

export async function saveUserNote(uid: string, noteText: string): Promise<void> {
  try {
    const notes = await getUserNotes();
    if (noteText.trim()) {
      notes[uid] = noteText;
    } else {
      delete notes[uid];
    }
    const file = new ExpoFile(NOTES_PATH);
    await file.write(JSON.stringify(notes));
  } catch (error) {
    console.error("Error saving user note:", error);
  }
}

export async function getUserAnnotations(): Promise<Record<string, SegmentAnnotation>> {
  try {
    const file = new ExpoFile(ANNOTATIONS_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    // Backward compatibility check for old user_highlights.json
    const oldFile = new ExpoFile(HIGHLIGHTS_PATH);
    if (await oldFile.exists) {
      const content = await oldFile.text();
      const parsed = JSON.parse(content);
      const migrated: Record<string, SegmentAnnotation> = {};
      if (Array.isArray(parsed)) {
        parsed.forEach((id: string) => {
          migrated[id] = { segId: id, color: "yellow", updatedAt: Date.now() };
        });
      } else if (typeof parsed === "object" && parsed !== null) {
        Object.assign(migrated, parsed);
      }
      await file.write(JSON.stringify(migrated));
      return migrated;
    }
    return {};
  } catch (error) {
    console.error("Error loading user annotations:", error);
    return {};
  }
}

export async function saveSegmentAnnotation(
  segId: string,
  color: "yellow" | "green" | "blue" | "purple",
  note?: string
): Promise<Record<string, SegmentAnnotation>> {
  try {
    const annotations = await getUserAnnotations();
    annotations[segId] = {
      segId,
      color,
      note: note?.trim() || undefined,
      updatedAt: Date.now(),
    };
    const file = new ExpoFile(ANNOTATIONS_PATH);
    await file.write(JSON.stringify(annotations));
    return annotations;
  } catch (error) {
    console.error("Error saving segment annotation:", error);
    return {};
  }
}

export async function deleteSegmentAnnotation(segId: string): Promise<Record<string, SegmentAnnotation>> {
  try {
    const annotations = await getUserAnnotations();
    delete annotations[segId];
    const file = new ExpoFile(ANNOTATIONS_PATH);
    await file.write(JSON.stringify(annotations));
    return annotations;
  } catch (error) {
    console.error("Error deleting segment annotation:", error);
    return {};
  }
}

export async function getUserHighlights(): Promise<string[]> {
  try {
    const file = new ExpoFile(HIGHLIGHTS_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    console.error("Error loading user highlights:", error);
    return [];
  }
}

export async function toggleUserHighlight(uid: string): Promise<boolean> {
  try {
    const highlights = await getUserHighlights();
    const idx = highlights.indexOf(uid);
    let highlighted = false;
    if (idx >= 0) {
      highlights.splice(idx, 1);
    } else {
      highlights.push(uid);
      highlighted = true;
    }
    const file = new ExpoFile(HIGHLIGHTS_PATH);
    await file.write(JSON.stringify(highlights));
    return highlighted;
  } catch (error) {
    console.error("Error toggling user highlight:", error);
    return false;
  }
}

export async function getMeditationLogs(): Promise<MeditationLog[]> {
  try {
    const file = new ExpoFile(MEDITATION_LOGS_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    console.error("Error loading meditation logs:", error);
    return [];
  }
}

export async function addMeditationLog(durationMinutes: number, notes?: string): Promise<void> {
  try {
    const logs = await getMeditationLogs();
    const newLog: MeditationLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      durationMinutes,
      notes,
    };
    logs.unshift(newLog);
    const file = new ExpoFile(MEDITATION_LOGS_PATH);
    await file.write(JSON.stringify(logs));
  } catch (error) {
    console.error("Error saving meditation log:", error);
  }
}

export async function deleteMeditationLog(id: string): Promise<void> {
  try {
    const logs = await getMeditationLogs();
    const updated = logs.filter(l => l.id !== id);
    const file = new ExpoFile(MEDITATION_LOGS_PATH);
    await file.write(JSON.stringify(updated));
  } catch (error) {
    console.error("Error deleting meditation log:", error);
  }
}

export async function getGradualTrainingLogs(): Promise<Record<string, GradualTrainingCheckIn>> {
  try {
    const file = new ExpoFile(GRADUAL_TRAINING_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    return {};
  } catch (error) {
    console.error("Error loading gradual training logs:", error);
    return {};
  }
}

export async function saveGradualTrainingLog(date: string, checkIn: GradualTrainingCheckIn): Promise<void> {
  try {
    const logs = await getGradualTrainingLogs();
    logs[date] = checkIn;
    const file = new ExpoFile(GRADUAL_TRAINING_PATH);
    await file.write(JSON.stringify(logs));
  } catch (error) {
    console.error("Error saving gradual training log:", error);
  }
}

export async function getReadingLogs(): Promise<ReadingLog[]> {
  try {
    const file = new ExpoFile(READING_LOGS_PATH);
    if (await file.exists) {
      const content = await file.text();
      return JSON.parse(content);
    }
    return [];
  } catch (error) {
    console.error("Error loading reading logs:", error);
    return [];
  }
}

export async function addReadingLog(uid: string, title: string): Promise<void> {
  try {
    const logs = await getReadingLogs();
    const now = Date.now();
    const duplicate = logs.find(l => l.uid === uid && now - l.timestamp < 5 * 60 * 1000);
    if (duplicate) return;

    const newLog: ReadingLog = {
      uid,
      title,
      timestamp: now,
    };
    logs.unshift(newLog);
    if (logs.length > 100) {
      logs.splice(100);
    }
    const file = new ExpoFile(READING_LOGS_PATH);
    await file.write(JSON.stringify(logs));
  } catch (error) {
    console.error("Error saving reading log:", error);
  }
}

export async function clearReadingLogs(): Promise<void> {
  try {
    const file = new ExpoFile(READING_LOGS_PATH);
    await file.write(JSON.stringify([]));
  } catch (error) {
    console.error("Error clearing reading logs:", error);
  }
}

export async function deleteReadingLog(uid: string, timestamp: number): Promise<void> {
  try {
    const logs = await getReadingLogs();
    const updated = logs.filter(l => !(l.uid === uid && l.timestamp === timestamp));
    const file = new ExpoFile(READING_LOGS_PATH);
    await file.write(JSON.stringify(updated));
  } catch (error) {
    console.error("Error deleting reading log:", error);
  }
}

export async function getDailySutta(date: Date = new Date()): Promise<{ uid: string; title: string; acronym?: string } | null> {
  try {
    const database = await getDb();
    
    // Filter suttas to include only Sutta Pitaka collections from the Pali Canon
    const sqlFilter = `
      (
        uid LIKE 'dn%'
        OR uid LIKE 'mn%'
        OR uid LIKE 'sn%'
        OR uid LIKE 'an%'
        OR uid LIKE 'khp%'
        OR uid LIKE 'kp%'
        OR uid LIKE 'dhp%'
        OR uid LIKE 'ud%'
        OR uid LIKE 'iti%'
        OR uid LIKE 'snp%'
        OR uid LIKE 'vv%'
        OR uid LIKE 'pv%'
        OR uid LIKE 'thag%'
        OR uid LIKE 'thig%'
        OR uid LIKE 'ap%'
        OR uid LIKE 'bv%'
        OR uid LIKE 'cp%'
        OR uid LIKE 'ja%'
        OR uid LIKE 'nd1%'
        OR uid LIKE 'nd2%'
        OR uid LIKE 'ps%'
        OR uid LIKE 'mil%'
        OR uid LIKE 'ne%'
        OR uid LIKE 'nett%'
        OR uid LIKE 'pe%'
      )
    `;

    const countResult = await database.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM sutta_index WHERE ${sqlFilter}`
    );
    const count = countResult?.count || 0;
    if (count === 0) return null;

    // Daily seed YYYYMMDD
    const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

    // Try up to 20 suttas to find one with an English translation
    for (let attempt = 0; attempt < 20; attempt++) {
      const offset = (seed + attempt) % count;
      const row = await database.getFirstAsync<{ uid: string; title: string; data: string }>(
        `SELECT uid, title, data FROM sutta_index WHERE ${sqlFilter} LIMIT 1 OFFSET ?`,
        [offset]
      );
      if (row) {
        try {
          const parsed = JSON.parse(row.data);
          // Only pick if it has an English translation
          if (parsed.translations && Object.keys(parsed.translations).length > 0) {
            return {
              uid: row.uid,
              title: row.title,
              acronym: parsed.acronym || row.uid.toUpperCase(),
            };
          }
        } catch (e) {}
      }
    }

    // Fallback: just return the first row from seed
    const fallbackOffset = seed % count;
    const fallbackRow = await database.getFirstAsync<{ uid: string; title: string; data: string }>(
      `SELECT uid, title, data FROM sutta_index WHERE ${sqlFilter} LIMIT 1 OFFSET ?`,
      [fallbackOffset]
    );
    if (fallbackRow) {
      try {
        const parsed = JSON.parse(fallbackRow.data);
        return {
          uid: fallbackRow.uid,
          title: fallbackRow.title,
          acronym: parsed.acronym || fallbackRow.uid.toUpperCase(),
        };
      } catch (e) {
        return {
          uid: fallbackRow.uid,
          title: fallbackRow.title,
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error getting daily sutta:", error);
    return null;
  }
}

export async function syncSuttaReminders(): Promise<void> {
  try {
    const saved = await loadSettings();
    if (!saved || !saved.reminderEnabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("[Notification] Cancelled all scheduled notifications because reminder is disabled.");
      return;
    }

    const { reminderHour = 9, reminderMinute = 0, reminderFrequency = "daily" } = saved;
    
    // Request permission first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== "granted") {
      console.log("[Notification] Permission not granted, skipping rescheduling.");
      return;
    }

    // Cancel all current scheduled notifications to start clean
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("[Notification] Cleaning previous schedule...");

    const today = new Date();

    if (reminderFrequency === "daily") {
      // Schedule for the next 7 days
      console.log("[Notification] Scheduling 7 days of daily suttas...");
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + i);
        targetDate.setHours(reminderHour, reminderMinute, 0, 0);

        if (targetDate.getTime() <= Date.now()) {
          continue;
        }

        const dailySutta = await getDailySutta(targetDate);
        if (!dailySutta) continue;

        const suttaTitle = `${dailySutta.acronym}: ${dailySutta.title}`;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Daily Sutta Inspiration",
            body: `Sutta of the Day: ${suttaTitle}`,
            data: { url: `/reader/${dailySutta.uid}` },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: targetDate,
          },
        });
      }
    } else if (reminderFrequency === "weekly") {
      // Schedule for the next 4 weeks (e.g. on Sundays)
      console.log("[Notification] Scheduling 4 weeks of weekly suttas...");
      const nextSunday = new Date(today);
      nextSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
      nextSunday.setHours(reminderHour, reminderMinute, 0, 0);
      if (nextSunday.getTime() <= Date.now()) {
        nextSunday.setDate(nextSunday.getDate() + 7);
      }

      for (let i = 0; i < 4; i++) {
        const targetDate = new Date(nextSunday);
        targetDate.setDate(nextSunday.getDate() + i * 7);

        const dailySutta = await getDailySutta(targetDate);
        if (!dailySutta) continue;

        const suttaTitle = `${dailySutta.acronym}: ${dailySutta.title}`;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Weekly Sutta Inspiration",
            body: `Weekly Sutta: ${suttaTitle}`,
            data: { url: `/reader/${dailySutta.uid}` },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: targetDate,
          },
        });
      }
    } else {
      // Once
      console.log("[Notification] Scheduling single sutta reminder...");
      const targetDate = new Date();
      targetDate.setHours(reminderHour, reminderMinute, 0, 0);
      if (targetDate.getTime() < Date.now()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const dailySutta = await getDailySutta(targetDate);
      if (dailySutta) {
        const suttaTitle = `${dailySutta.acronym}: ${dailySutta.title}`;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Sutta Inspiration",
            body: `Your scheduled Sutta: ${suttaTitle}`,
            data: { url: `/reader/${dailySutta.uid}` },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: targetDate,
          },
        });
      }
    }
    console.log("[Notification] Rescheduling complete.");
  } catch (error) {
    console.error("[Notification] Rescheduling failed:", error);
  }
}



