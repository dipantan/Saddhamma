import { Paths, File as ExpoFile, Directory } from 'expo-file-system';
import { unzip } from 'react-native-zip-archive';
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
    if (versionFile.exists) {
      const localContent = await versionFile.text();
      const local: VersionInfo = JSON.parse(localContent);
      if (local.commit === latest.commit) {
        console.log("Data is already up to date.");
        return false;
      }
    }
    return latest;
  } catch (error) {
    console.error("Error checking for updates:", error);
    return false;
  }
}

export async function syncData(onProgress: (percent: number) => void): Promise<boolean> {
  try {
    const updateInfo = await checkForUpdates();
    if (!updateInfo) return true;

    console.log("Starting data sync...");

    const zipFile = new ExpoFile(ZIP_PATH);
    const downloadTask = ExpoFile.createDownloadTask(DATA_URL, zipFile, {
      onProgress: (progress) => {
        const percent = progress.bytesWritten / progress.totalBytes;
        onProgress(percent);
      }
    });

    const result = await downloadTask.downloadAsync();
    if (!result) throw new Error("Download failed");

    const dataDir = new Directory(DATA_DIR_URI);
    if (!dataDir.exists) {
      await dataDir.create({ intermediates: true });
    }

    console.log("Extracting data...");
    await unzip(result.uri, dataDir.uri);

    const versionFile = new ExpoFile(VERSION_PATH);
    await versionFile.write(JSON.stringify(updateInfo));

    console.log("Populating index...");
    await populateIndex();

    if (zipFile.exists) {
      await zipFile.delete();
    }

    console.log("Sync complete!");
    return true;
  } catch (error) {
    console.error("Sync error:", error);
    return false;
  }
}
