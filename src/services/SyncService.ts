import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { Snackbar } from 'react-native-snackbar';
import { unzip } from 'react-native-zip-archive';
// Use absolute path alias to resolve module discovery issues
import { isDataReady, populateIndex } from '@/services/DataService';

const RELEASE_BASE = "https://github.com/dipantan/suttacentral-api-server/releases/latest/download";
const DATA_URL = `${RELEASE_BASE}/data.zip`;
const VERSION_URL = `${RELEASE_BASE}/data.json`;

const ZIP_PATH = `${Paths.cache.uri}data.zip`;
const DATA_DIR_URI = `${Paths.document.uri}sutta_data/`;
const VERSION_PATH = `${DATA_DIR_URI}version.json`;

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
    const response = await fetch(VERSION_URL);
    if (!response.ok) return false;
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
    console.error("Error checking for updates:", error);
    Snackbar.show({
      text: 'Failed to check for updates',
      duration: Snackbar.LENGTH_SHORT,
      backgroundColor: '#FF3B30'
    });
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
    const ready = await isDataReady();
    const updateInfo = await checkForUpdates(undefined, false);

    // If data is ready and no updates are available, skip.
    if (ready && !updateInfo) {
      console.log("Data is ready and no updates found. Skipping sync.");
      onProgress({ percent: 1, message: "Data is up to date" });
      return true;
    }

    // If updateInfo is false but we are not ready, we need to get the latest version info anyway
    let finalUpdateInfo = updateInfo;
    if (!finalUpdateInfo) {
      const response = await fetch(VERSION_URL);
      if (response.ok) {
        finalUpdateInfo = await response.json();
      }
    }

    if (!finalUpdateInfo) {
      throw new Error("Could not retrieve version information for sync.");
    }

    console.log("Starting data sync...");
    onProgress({ percent: 0, message: "Connecting to server..." });

    const zipFile = new ExpoFile(ZIP_PATH);
    const downloadTask = ExpoFile.createDownloadTask(DATA_URL, zipFile, {
      onProgress: (progress) => {
        const percent = Math.round((progress.bytesWritten / progress.totalBytes) * 100);
        onProgress({
          percent: percent / 100,
          message: "Downloading Sutta data...",
        });
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
    await unzip(result.uri, dataDir.uri);
    
    // DEBUG: Log contents to see what actually got extracted
    try {
      const actualContents = await dataDir.list();
      console.log("Extracted items in sutta_data:", actualContents.map(i => i.name).join(", "));
    } catch (e) {
      console.error("Failed to list extracted contents", e);
    }

    // Normalize structure if zipped with a 'data' folder
    const nestedData = new Directory(`${dataDir.uri}data/`);
    if (await nestedData.exists) {
      onProgress({ percent: null, message: "Optimizing directory structure..." });
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
    console.log(`Extraction process (including normalization) completed in ${unzipDuration}s`);

    const versionFile = new ExpoFile(VERSION_PATH);
    await versionFile.write(JSON.stringify(finalUpdateInfo));

    console.log("Populating index...");
    onProgress({ percent: 0, message: "Indexing database..." });
    
    await populateIndex((progressPercent) => {
      onProgress({
        percent: progressPercent,
        message: "Indexing database...",
      });
    });

    if (await zipFile.exists) {
      await zipFile.delete();
    }

    console.log("Sync complete!");
    onProgress({ percent: 1, message: "Sync complete!" });
    Snackbar.show({
      text: 'Sync complete!',
      duration: Snackbar.LENGTH_LONG,
      backgroundColor: '#34C759'
    });
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    onProgress({ percent: null, message: "Sync failed!" });
    Snackbar.show({
      text: 'Sync failed!',
      duration: Snackbar.LENGTH_LONG,
      backgroundColor: '#FF3B30'
    });
    return false;
  }
}
