import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { Snackbar } from 'react-native-snackbar';
import { unzip } from 'react-native-zip-archive';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
// Use absolute path alias to resolve module discovery issues
import { buildFullTextIndex, isDataReady, populateIndex } from '@/services/DataService';

const RELEASE_BASE = "https://github.com/dipantan/suttacentral-api-server/releases/latest/download";
const DATA_URL = `${RELEASE_BASE}/data.zip`;
const VERSION_URL = `${RELEASE_BASE}/data.json`;

const ZIP_PATH = `${Paths.cache.uri}data.zip`;
const DATA_DIR_URI = `${Paths.document.uri}sutta_data/`;
const VERSION_PATH = `${DATA_DIR_URI}version.json`;

const SYNC_NOTIF_ID = "sutta-library-sync-status";

async function setupSyncNotificationChannel() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('sync-channel', {
        name: 'Library Sync Progress',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0],
        enableVibrate: false,
      });
    } catch (e) {}
  }
}

async function updateSyncNotification(title: string, body: string) {
  try {
    await setupSyncNotificationChannel();
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
}

async function completeSyncNotification() {
  try {
    await Notifications.dismissNotificationAsync(SYNC_NOTIF_ID);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Sutta Library Ready 🎉",
        body: "All suttas and global search indexing are now complete for offline use.",
        sound: true,
      },
      trigger: null,
    });
  } catch (e) {}
}

export interface VersionInfo {
  commit: string;
  timestamp?: string;
  date?: string;
  updated_at?: string;
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
      Snackbar.show({
        text: `New Sutta data available`,
        duration: Snackbar.LENGTH_INDEFINITE,
        action: {
          text: 'UPDATE',
          textColor: '#34C759',
          onPress: () => {
            Snackbar.dismiss();
            console.log("User requested update via Snackbar");
            if (onUpdateAction) {
              onUpdateAction();
            }
          },
        },
      });
    }

    return latest;
  } catch (error) {
    console.log("Offline or network unreachable during update check:", error);
    return false;
  }
}

export interface SyncProgress {
  percent: number | null;
  message: string;
}

export async function syncData(
  onProgress: (progress: SyncProgress) => void,
): Promise<boolean> {
  try {
    Snackbar.dismiss();
    onProgress({ percent: 0, message: "Checking for updates..." });
    updateSyncNotification("Sutta Library Sync", "Checking for database updates...");

    const ready = await isDataReady();
    const updateInfo = await checkForUpdates(undefined, false);

    // If data is ready and no updates are available, skip.
    if (ready && !updateInfo) {
      console.log("Data is ready and no updates found. Skipping sync.");
      onProgress({ percent: 1, message: "Data is up to date" });
      await Notifications.dismissNotificationAsync(SYNC_NOTIF_ID);
      return true;
    }

    // If updateInfo is false but we are not ready, we need to get the latest version info anyway
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

    console.log("Starting data sync...");
    onProgress({ percent: 0, message: "Connecting to server..." });
    updateSyncNotification("Sutta Library Sync", "Connecting to server...");

    const zipFile = new ExpoFile(ZIP_PATH);
    let lastNotifTime = 0;

    const downloadTask = ExpoFile.createDownloadTask(DATA_URL, zipFile, {
      onProgress: (progress) => {
        const percent = Math.round((progress.bytesWritten / progress.totalBytes) * 100);
        onProgress({
          percent: percent / 100,
          message: "Downloading Sutta data...",
        });

        // Throttle system notification updates to every 1.5s to avoid system overhead
        const now = Date.now();
        if (now - lastNotifTime > 1500 || percent === 100) {
          lastNotifTime = now;
          updateSyncNotification("Sutta Library Sync", `Downloading data archive... ${percent}%`);
        }
      }
    });

    const result = await downloadTask.downloadAsync();
    if (!result) throw new Error("Download failed");

    const dataDir = new Directory(DATA_DIR_URI);
    if (!(await dataDir.exists)) {
      await dataDir.create({ intermediates: true });
    }

    console.log("Extracting data...");
    const unzipStartTime = Date.now();
    onProgress({ percent: null, message: "Extracting Sutta database..." });
    updateSyncNotification("Sutta Library Sync", "Extracting text files...");

    await unzip(result.uri, dataDir.uri);

    // Normalize structure if zipped with a 'data' folder
    const nestedData = new Directory(`${dataDir.uri}data/`);
    if (await nestedData.exists) {
      onProgress({ percent: null, message: "Optimizing directory structure..." });
      updateSyncNotification("Sutta Library Sync", "Optimizing file directory...");
      console.log("Normalizing nested data folder...");
      const contents = await nestedData.list();
      for (const item of contents) {
        const dest = item instanceof Directory 
          ? new Directory(`${dataDir.uri}${item.name}/`)
          : new ExpoFile(`${dataDir.uri}${item.name}`);
        
        if (await dest.exists) {
          await dest.delete();
        }
        await item.move(dest as any);
      }
      await nestedData.delete();
    }

    const unzipDuration = ((Date.now() - unzipStartTime) / 1000).toFixed(2);
    console.log(`Extraction process completed in ${unzipDuration}s`);

    const versionFile = new ExpoFile(VERSION_PATH);
    await versionFile.write(JSON.stringify(finalUpdateInfo));

    console.log("Populating index...");
    onProgress({ percent: 0, message: "Indexing database..." });
    updateSyncNotification("Sutta Library Sync", "Indexing master database...");
    
    await populateIndex((progressPercent) => {
      const pct = Math.round(progressPercent * 100);
      onProgress({
        percent: progressPercent,
        message: "Indexing database...",
      });

      const now = Date.now();
      if (now - lastNotifTime > 1500 || pct === 100) {
        lastNotifTime = now;
        updateSyncNotification("Sutta Library Sync", `Indexing master database... ${pct}%`);
      }
    });

    if (await zipFile.exists) {
      await zipFile.delete();
    }

    // Run Full-Text Search indexing sequentially as part of initial setup pipeline
    console.log("Building full text search index...");
    onProgress({ percent: 0, message: "Building search index..." });
    updateSyncNotification("Library Search Indexing", "Building search index...");

    await buildFullTextIndex((processed, total) => {
      if (total > 0) {
        const ftsPercent = processed / total;
        const pct = Math.round(ftsPercent * 100);
        onProgress({
          percent: ftsPercent,
          message: "Building search index...",
        });

        const now = Date.now();
        if (now - lastNotifTime > 1500 || processed === total) {
          lastNotifTime = now;
          updateSyncNotification("Library Search Indexing", `Indexing search library... ${pct}% (${processed}/${total})`);
        }
      }
    });

    console.log("Sync complete!");
    onProgress({ percent: 1, message: "Sync complete!" });
    await completeSyncNotification();

    Snackbar.show({
      text: 'Sync complete!',
      duration: Snackbar.LENGTH_LONG,
      backgroundColor: '#34C759'
    });
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    onProgress({ percent: null, message: "Sync failed!" });
    try { await Notifications.dismissNotificationAsync(SYNC_NOTIF_ID); } catch (e) {}
    Snackbar.show({
      text: 'Sync failed!',
      duration: Snackbar.LENGTH_LONG,
      backgroundColor: '#FF3B30'
    });
    return false;
  }
}
