import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { unzip } from 'react-native-zip-archive';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { closeDb, getDb, isDataReady } from '@/services/DataService';

const RELEASE_BASE = "https://github.com/dipantan/suttacentral-api-server/releases/latest/download";
const SQLITE_ZIP_URL = `${RELEASE_BASE}/sutta_db.zip`;
const VERSION_URL = `${RELEASE_BASE}/data.json`;

const CACHE_ZIP_PATH = `${Paths.cache.uri}sutta_db.zip`;
const STAGING_DIR_URI = `${Paths.cache.uri}sqlite_staging/`;
const SQLITE_DIR_URI = `${Paths.document.uri}SQLite/`;
const SQLITE_DB_PATH = `${SQLITE_DIR_URI}sutta_db.sqlite`;
const SQLITE_WAL_PATH = `${SQLITE_DIR_URI}sutta_db.sqlite-wal`;
const SQLITE_SHM_PATH = `${SQLITE_DIR_URI}sutta_db.sqlite-shm`;
const DATA_DIR_URI = `${Paths.document.uri}sutta_data/`;
const VERSION_PATH = `${DATA_DIR_URI}version.json`;

const SYNC_NOTIF_ID = "sutta-library-sync-status";

let isSyncActive = false;
let activeNotificationPromise: Promise<void> | null = null;

async function setupSyncNotificationChannel() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('sync-channel', {
        name: 'Library Sync Progress',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0],
        enableVibrate: false,
      });
    } catch {}
  }
}

async function updateSyncNotification(title: string, body: string) {
  if (!isSyncActive) return;
  const notifTask = (async () => {
    try {
      await setupSyncNotificationChannel();
      if (!isSyncActive) return;
      await Notifications.scheduleNotificationAsync({
        identifier: SYNC_NOTIF_ID,
        content: {
          title,
          body,
          sound: false,
          priority: Notifications.AndroidNotificationPriority.LOW,
        },
        trigger: null,
      });
    } catch (e) {
      console.log("Failed to update sync notification:", e);
    }
  })();
  activeNotificationPromise = notifTask;
  await notifTask;
}

async function completeSyncNotification() {
  try {
    isSyncActive = false;
    if (activeNotificationPromise) {
      try {
        await activeNotificationPromise;
      } catch {}
    }
    await Notifications.dismissNotificationAsync(SYNC_NOTIF_ID);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await Notifications.scheduleNotificationAsync({
      identifier: SYNC_NOTIF_ID,
      content: {
        title: "Sutta Library Ready 🎉",
        body: "All suttas and pre-indexed search are now ready for offline use.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    });
  } catch (e) {
    console.log("Failed to complete sync notification:", e);
  }
}

export interface VersionInfo {
  commit: string;
  timestamp?: string;
  date?: string;
  updated_at?: string;
  sqlite_bundle?: string;
  sqlite_db?: string;
}

export async function getLocalVersion(): Promise<VersionInfo | null> {
  try {
    const versionFile = new ExpoFile(VERSION_PATH);
    if (await versionFile.exists) {
      const content = await versionFile.text();
      return JSON.parse(content);
    }
    return null;
  } catch (error) {
    console.error("Error reading local version:", error);
    return null;
  }
}

export async function checkForUpdates(
  onUpdateAction?: () => void,
  showNotification: boolean = true
): Promise<VersionInfo | false> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    let response;
    try {
      response = await fetch(VERSION_URL, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (!response || !response.ok) return false;
    const latest: VersionInfo = await response.json();

    const versionFile = new ExpoFile(VERSION_PATH);
    if (await versionFile.exists) {
      const localContent = await versionFile.text();
      const local: VersionInfo = JSON.parse(localContent);
      if (local.commit === latest.commit) {
        console.log("Data is already up to date.");
        return false;
      }
    }

    // Notify user that an update is available
    if (showNotification) {
      Alert.alert(
        "New Sutta Data Available",
        "A new pre-indexed version of the canonical texts and translations is available. Would you like to update now?",
        [
          { text: "Later", style: "cancel" },
          {
            text: "Update",
            onPress: () => {
              console.log("User requested update via Alert");
              if (onUpdateAction) {
                onUpdateAction();
              }
            },
          },
        ],
        { cancelable: true }
      );
    }

    return latest;
  } catch (error) {
    console.log("Offline or network unreachable during update check:", error);
    return false;
  }
}

export type SyncStage =
  | 'checking'
  | 'downloading'
  | 'extracting'
  | 'optimizing'
  | 'indexing_db'
  | 'search_indexing'
  | 'complete'
  | 'failed';

export interface SyncProgress {
  percent: number | null;
  message: string;
  stage?: SyncStage;
}

export async function syncData(
  onProgress: (progress: SyncProgress) => void,
): Promise<boolean> {
  try {
    isSyncActive = true;
    onProgress({ percent: 0, message: "Checking for updates...", stage: 'checking' });
    updateSyncNotification("Sutta Library Sync", "Checking for database updates...");

    const ready = await isDataReady();
    const updateInfo = await checkForUpdates(undefined, false);

    // If data is ready and no updates are available, skip.
    if (ready && !updateInfo) {
      console.log("Data is ready and no updates found. Skipping sync.");
      isSyncActive = false;
      onProgress({ percent: 1, message: "Data is up to date", stage: 'complete' });
      await Notifications.dismissNotificationAsync(SYNC_NOTIF_ID);
      return true;
    }

    // If updateInfo is false but we are not ready, retrieve version info
    let finalUpdateInfo = updateInfo;
    if (!finalUpdateInfo) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(VERSION_URL, { signal: controller.signal });
        if (response && response.ok) {
          finalUpdateInfo = await response.json();
        }
      } catch (e) {
        console.error("Network fetch failed in syncData:", e);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!finalUpdateInfo) {
      throw new Error("Could not retrieve version information for sync.");
    }

    console.log("Starting database bundle download...");
    onProgress({ percent: 0, message: "Connecting to server...", stage: 'downloading' });
    updateSyncNotification("Sutta Library Sync", "Connecting to server...");

    const cacheZipFile = new ExpoFile(CACHE_ZIP_PATH);
    if (await cacheZipFile.exists) {
      try { await cacheZipFile.delete(); } catch {}
    }

    let lastNotifTime = 0;

    const downloadTask = ExpoFile.createDownloadTask(SQLITE_ZIP_URL, cacheZipFile, {
      onProgress: (progress) => {
        const percent = Math.round((progress.bytesWritten / progress.totalBytes) * 100);
        onProgress({
          percent: percent / 100,
          message: "Downloading pre-indexed database...",
          stage: 'downloading',
        });

        // Throttle system notification updates to every 1.5s
        const now = Date.now();
        if (now - lastNotifTime > 1500 || percent === 100) {
          lastNotifTime = now;
          updateSyncNotification("Sutta Library Sync", `Downloading pre-indexed database... ${percent}%`);
        }
      }
    });

    const result = await downloadTask.downloadAsync();
    if (!result) throw new Error("Download failed");

    onProgress({ percent: null, message: "Installing database...", stage: 'extracting' });
    updateSyncNotification("Sutta Library Sync", "Installing database...");

    // 1. Release active SQLite connection locks
    await closeDb();

    // 2. Prepare staging directory
    const stagingDir = new Directory(STAGING_DIR_URI);
    if (await stagingDir.exists) {
      try { await stagingDir.delete(); } catch {}
    }
    await stagingDir.create({ intermediates: true });

    // 3. Unzip the single sqlite database file from archive into staging
    await unzip(result.uri, stagingDir.uri);

    // 4. Locate extracted sqlite file
    const stagedDbFile = new ExpoFile(`${stagingDir.uri}sutta_db.sqlite`);
    if (!(await stagedDbFile.exists)) {
      throw new Error("Extracted archive did not contain sutta_db.sqlite");
    }

    // 5. Ensure target SQLite directory exists
    const sqliteDir = new Directory(SQLITE_DIR_URI);
    if (!(await sqliteDir.exists)) {
      await sqliteDir.create({ intermediates: true });
    }

    // 6. Delete old WAL / SHM files to prevent corruption with replaced DB
    try {
      const walFile = new ExpoFile(SQLITE_WAL_PATH);
      if (await walFile.exists) await walFile.delete();
      const shmFile = new ExpoFile(SQLITE_SHM_PATH);
      if (await shmFile.exists) await shmFile.delete();
    } catch (e) {
      console.warn("Could not remove old WAL/SHM files:", e);
    }

    // 7. Replace the database file with the newly extracted pre-indexed database
    const targetDbFile = new ExpoFile(SQLITE_DB_PATH);
    if (await targetDbFile.exists) {
      try { await targetDbFile.delete(); } catch {}
    }
    await stagedDbFile.move(targetDbFile);

    // 8. Clean up staging directory and downloaded zip
    try {
      await stagingDir.delete();
      if (await cacheZipFile.exists) await cacheZipFile.delete();
    } catch (e) {}

    // 9. Save version info
    const dataDir = new Directory(DATA_DIR_URI);
    if (!(await dataDir.exists)) {
      await dataDir.create({ intermediates: true });
    }
    const versionFile = new ExpoFile(VERSION_PATH);
    await versionFile.write(JSON.stringify(finalUpdateInfo));

    // 10. Reopen database connection to verify ready state
    console.log("Verifying new database instance...");
    const db = await getDb();
    const countCheck = await db.getFirstAsync<{ count: number }>("SELECT count(*) as count FROM sutta_index");
    console.log(`Database ready with ${countCheck?.count || 0} suttas.`);

    console.log("Sync complete!");
    onProgress({ percent: 1, message: "Sync complete!", stage: 'complete' });
    await completeSyncNotification();

    Alert.alert(
      "Sync Complete",
      "Sutta library and pre-indexed search have been successfully installed and are ready for offline use.",
      [{ text: "OK" }],
      { cancelable: true }
    );
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    isSyncActive = false;
    if (activeNotificationPromise) {
      try { await activeNotificationPromise; } catch {}
    }
    onProgress({ percent: null, message: "Sync failed!", stage: 'failed' });
    try { await Notifications.dismissNotificationAsync(SYNC_NOTIF_ID); } catch {}
    Alert.alert(
      "Sync Failed",
      "An error occurred while synchronizing the Sutta library. Please check your internet connection.",
      [{ text: "OK" }],
      { cancelable: true }
    );
    return false;
  }
}
