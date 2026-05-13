import { Directory, File as ExpoFile, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";

const DB_NAME = "sutta_db.sqlite";
const DATA_DIR = `${Paths.document.uri}sutta_data/`;
const INDEX_PATH = `${DATA_DIR}sutta_index.json`;
const SETTINGS_PATH = `${Paths.document.uri}reader_settings.json`;

export async function saveSettings(settings: any): Promise<void> {
  try {
    const file = new ExpoFile(SETTINGS_PATH);
    await file.write(JSON.stringify(settings));
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
    return (result?.count || 0) > 0;
  } catch (error) {
    console.error("isDataReady DB check failed:", error);
    return false;
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      return db;
    } catch (e) {
      // If previous attempt failed, clear it and try again
      dbPromise = null;
    }
  }

  dbPromise = (async () => {
    try {
      const instance = await SQLite.openDatabaseAsync(DB_NAME);

      // Migration logic: Check if sutta_index exists and has the 'data' column
      const tableInfo = await instance.getAllAsync<any>(
        "PRAGMA table_info(sutta_index)",
      );
      const hasDataColumn = tableInfo.some((col) => col.name === "data");

      if (tableInfo.length > 0 && !hasDataColumn) {
        console.log("Old schema detected, dropping old sutta_index table...");
        await instance.execAsync("DROP TABLE IF EXISTS sutta_index");
      }

      await instance.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sutta_index (
          uid TEXT PRIMARY KEY,
          title TEXT,
          data TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS sutta_fts USING fts5(
          uid,
          title,
          content,
          tokenize = 'trigram'
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
    await database.withTransactionAsync(async () => {
      console.log("Cleaning old index data...");
      await database.execAsync("DELETE FROM sutta_index");
      await database.execAsync("DELETE FROM sutta_fts");

      let processed = 0;
      for (const [uid, entry] of entries) {
        const title = entry.title || uid;
        const entryData = JSON.stringify(entry);

        await database.runAsync(
          "INSERT INTO sutta_index (uid, title, data) VALUES (?, ?, ?)",
          [uid, title, entryData]
        );
        
        await database.runAsync(
          "INSERT INTO sutta_fts (uid, title, content) VALUES (?, ?, ?)",
          [uid, title, ""]
        );

        processed++;
        if (onProgress && processed % 100 === 0) {
          onProgress(processed / total);
        }
      }
    });
    console.log(`Index populated successfully with ${total} entries.`);
  } catch (err) {
    console.error("Error during withTransactionAsync in populateIndex:", err);
    throw err;
  }
}

/**
 * Background task to index the full content of all suttas.
 * Processes in batches to avoid blocking the main thread.
 */
export async function buildFullTextIndex(
  onProgress?: (processed: number, total: number) => void,
) {
  const database = await getDb();

  // Find uids that need content indexing
  const pending = await database.getAllAsync<{ uid: string }>(
    'SELECT uid FROM sutta_fts WHERE content = "" OR content IS NULL',
  );

  if (pending.length === 0) return;

  const total = pending.length;
  let processed = 0;
  const batchSize = 25;

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);

    await database.withTransactionAsync(async () => {
      const updateStmt = await database.prepareAsync(
        "UPDATE sutta_fts SET content = ? WHERE uid = ?",
      );

      try {
        for (const item of batch) {
          try {
            const rawContent = await getSuttaContent(item.uid);
            if (rawContent) {
              let contentStr = "";
              if (typeof rawContent === "object") {
                // Bilara JSON: extract values from segments
                contentStr = Object.values(rawContent).join(" ");
              } else if (typeof rawContent === "string") {
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
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
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

  let rootText = {};
  let translationText = {};
  let commentText = {};
  let htmlText = {};

  // Load Root
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
  if (entry.translations) {
    if (!entry.translations[selectedAuthor]) {
      selectedAuthor = Object.keys(entry.translations)[0] || "sujato";
    }

    if (entry.translations[selectedAuthor]) {
      const transFilename = entry.translations[selectedAuthor];
      try {
        // Translation file
        const transFile = new ExpoFile(
          `${baseDir}translation/en/${selectedAuthor}/${transFilename}`,
        );
        if (await transFile.exists) {
          translationText = JSON.parse(await transFile.text());
        }

        // Comment file (often matching the translation filename pattern)
        const commentFilename = transFilename.replace("_translation-en-", "_comment-en-");
        const commentFile = new ExpoFile(
          `${baseDir}comment/en/${selectedAuthor}/${commentFilename}`,
        );
        if (await commentFile.exists) {
          commentText = JSON.parse(await commentFile.text());
        }
      } catch (e) {}
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
  };
}

export async function searchSuttas(query: string): Promise<any[]> {
  const database = await getDb();

  const normalizedUid = query
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/:/g, ".");

  return await database.getAllAsync(
    `
    SELECT 
      f.uid, 
      f.title, 
      snippet(sutta_fts, 1, '<b>', '</b>', '...', 10) as highlight,
      snippet(sutta_fts, 2, '<b>', '</b>', '...', 15) as content_highlight
    FROM sutta_fts f
    JOIN sutta_index i ON f.uid = i.uid
    WHERE f.uid = ? OR f.uid LIKE ? OR f.uid = ? OR f.uid LIKE ? OR sutta_fts MATCH ? 
    ORDER BY (f.uid = ? OR f.uid = ?) DESC, rank 
    LIMIT 30
  `,
    [
      query,
      `${query}%`,
      normalizedUid,
      `${normalizedUid}%`,
      query,
      query,
      normalizedUid,
    ],
  );
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
