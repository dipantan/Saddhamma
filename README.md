# Saddhamma

Saddhamma is a high-performance, offline-first reader for Buddhist texts (Suttas from the Pāli Canon), built with **Expo SDK 56** and **React Native**.

## ✨ Features

- **Offline-First**: Download and index the entire Pāli Canon for fast, local access without an internet connection.
- **High Performance**: Optimized for mobile devices using local SQLite indexing and Full-Text Search (FTS5).
- **Universal Search**: Fast, diacritic-insensitive search across thousands of texts.
- **Smart Sync**: Resilient data synchronization with GitHub Release assets, featuring automatic update notifications.
- **Modern UI**: Clean, accessible reading experience with dark mode support and customizable themes.
- **Deep Navigation**: Easily explore the Piṭakas (Sutta, Vinaya, Abhidhamma) with a hierarchical menu system.

## 🛠️ Tech Stack

- **Framework**: [Expo SDK 56](https://expo.dev/) (React Native)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Database**: [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) with FTS5 support
- **FileSystem**: [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) for raw data management
- **Animations**: [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/)
- **Icons**: [expo-symbols](https://docs.expo.dev/versions/latest/sdk/symbols/)

## 🚀 Getting Started

### Prerequisites

- Node.js (LTS)
- Yarn or npm
- Expo Go (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Saddhamma.git
   cd Saddhamma
   ```

2. **Install dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

3. **Start the development server**
   ```bash
   npx expo start
   ```

### 📱 Running on Device

- Scan the QR code with the **Expo Go** app (Android) or the **Camera** app (iOS).
- For native builds, use:
  ```bash
  npm run android
  # or
  npm run ios
  ```

## 🏗️ Architecture

The app is designed with a robust offline sync engine:

1. **Sync Engine** ([SyncService.ts](src/services/SyncService.ts)): Fetches compressed data from GitHub, extracts it, and manages versioning.
2. **Data Indexer** ([DataService.ts](src/services/DataService.ts)): Populates a local SQLite database with metadata and Full-Text Search indexes from the extracted JSON files.
3. **Reader UI**: A segmented text renderer optimized for long-form reading.

## 📜 License

This project is licensed under the **GPL-3.0-only** License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for the Dhamma.
