import { Paths, File as ExpoFile, Directory } from 'expo-file-system';
import { unzip } from 'react-native-zip-archive';
import { Snackbar } from 'react-native-snackbar';
// Use absolute path alias to resolve module discovery issues
import { populateIndex } from '@/services/DataService';

const RELEASE_BASE = "https://github.com/dipantan/suttacentral-api-server/releases/latest/download";
const DATA_URL = `${RELEASE_BASE}/data.zip`;
const VERSION_URL = `${RELEASE_BASE}/data.json`;

const ZIP_PATH = `${Paths.cache.uri}data.zip`;
const DATA_DIR_URI = `${Paths.document.uri}sutta_data/`;
const VERSION_PATH = `${DATA_DIR_URI}version.json`;

export interface VersionInfo {
  commit: string;
  timestamp: string;
}

export async function checkForUpdates(): Promise<VersionInfo | false> {
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
    Snackbar.show({
      text: `New Sutta data available`,
      duration: Snackbar.LENGTH_INDEFINITE,
      action: {
        text: 'UPDATE',
        textColor: '#34C759',
        onPress: () => {
          // This would ideally trigger the sync process.
          // For now, we'll just log it. The component calling this 
          // should handle the actual trigger if needed.
          console.log("User requested update via Snackbar");
        },
      },
    });

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

export async function syncData(onProgress: (percent: number | null) => void): Promise<boolean> {
  try {
    const updateInfo = await checkForUpdates();
    if (!updateInfo) return true;

    console.log("Starting data sync...");
    Snackbar.show({
      text: 'Starting data sync...',
      duration: Snackbar.LENGTH_SHORT,
    });

    const zipFile = new ExpoFile(ZIP_PATH);
    const downloadTask = ExpoFile.createDownloadTask(DATA_URL, zipFile, {
      onProgress: (progress) => {
        const percent = Math.round((progress.bytesWritten / progress.totalBytes) * 100);
        onProgress(percent / 100);
      }
    });

    const result = await downloadTask.downloadAsync();
    if (!result) throw new Error("Download failed");

    const dataDir = new Directory(DATA_DIR_URI);
    if (!(await dataDir.exists)) {
      await dataDir.create({ intermediates: true });
    }

    console.log("Extracting data...");
    onProgress(null); // Switch to indeterminate
    Snackbar.show({
      text: 'Extracting files...',
      duration: Snackbar.LENGTH_SHORT,
    });
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

    const versionFile = new ExpoFile(VERSION_PATH);
    await versionFile.write(JSON.stringify(updateInfo));

    console.log("Populating index...");
    Snackbar.show({
      text: 'Finalizing index...',
      duration: Snackbar.LENGTH_SHORT,
    });
    await populateIndex();

    if (await zipFile.exists) {
      await zipFile.delete();
    }

    console.log("Sync complete!");
    Snackbar.show({
      text: 'Sync complete!',
      duration: Snackbar.LENGTH_LONG,
      backgroundColor: '#34C759'
    });
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    Snackbar.show({
      text: 'Sync failed!',
      duration: Snackbar.LENGTH_LONG,
      backgroundColor: '#FF3B30'
    });
    return false;
  }
}
