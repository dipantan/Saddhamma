# Saddhamma (সদ্ধম্ম)

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2056-000000.svg?logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.85-61DAFB.svg?logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-brightgreen.svg)]()

> A high-performance, offline-first reader and spiritual practice companion for Pāli Canon Buddhist texts (Suttas), built with **React Native**, **Expo SDK 56**, and **SQLite FTS5**.

---

## 📖 Table of Contents

- [Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ System Architecture & Data Flow](#️-system-architecture--data-flow)
- [📂 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [📦 Data Synchronization Pipeline](#-data-synchronization-pipeline)
- [📜 Available Scripts](#-available-scripts)
- [🙏 Credits & License](#-credits--license)

---

## 🌟 Overview

**Saddhamma** is designed to provide a distraction-free, lightning-fast, and deeply immersive reading experience for the Sutta Piṭaka. Optimized specifically for offline mobile use, it extracts, indexes, and indexes thousands of canonical Pāli texts locally, allowing users to search, read, bookmark, and track their daily mindfulness practice anytime, anywhere.

---

## ✨ Key Features

### 📖 **Offline-First Reader & Navigation**
- **Complete Canonical Hierarchy**: Easily navigate the Piṭakas (Dīgha Nikāya, Majjhima Nikāya, Saṁyutta Nikāya, Aṅguttara Nikāya, and Khuddaka Nikāya) with smooth tree-based navigation.
- **Bilingual Display**: Side-by-side English translation and Pāli root text rendering for deep textual study.
- **Legacy HTML Fallback**: Full compatibility and graceful rendering for unsegmented legacy texts.
- **Segment Copying & Sharing**: Copy individual segments or entire suttas with automated translator attribution.

### 🔍 **High-Performance Full-Text Search (FTS5)**
- **Universal Local Search**: Instant, diacritic-insensitive search powered by SQLite FTS5 index across thousands of suttas.
- **Fast Lookup**: Rapid navigation by Sutta UID (e.g., `dn1`, `mn10`, `sn56.11`).

### 🧘 **Mindfulness & Practice Companion**
- **Integrated Meditation Timer**: Customizable presets, gentle chime bells, halfway reminders, notes, and ambient breathing animations.
- **Gradual Training Check-in**: Daily reflection tracker following the canonical Gradual Training (*Anupubbikathā*) sequence (Sense Restraint, Moderation in Eating, Wakefulness, Mindfulness & Clear Comprehension, and Precepts).
- **Practice Analytics & Gamification**: Mindful consistency streaks and practice badges without competitive or goal-obsessed metrics.

### 🎨 **Modern & Accessible UI**
- **Theme Engine**: Built-in dark mode and high-contrast customizable themes optimized for low-light reading.
- **Typography & Layout**: Scalable text sizes, line spacing controls, and clean reading layouts.
- **Bookmarks & Annotations**: Save favorite suttas and attach personal reflections or highlights per segment.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | [Expo SDK 56](https://expo.dev/) | React Native cross-platform application runtime |
| **Routing** | [Expo Router](https://docs.expo.dev/router/introduction/) | File-based typed routing with native tabs and stacks |
| **Database** | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) | Embedded SQLite with FTS5 virtual tables and prepared statements |
| **Storage & I/O** | [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) & `react-native-zip-archive` | Local compressed bundle extraction and raw file streaming |
| **Animations** | [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) | 60 FPS UI animations for timer and transitions |
| **Styling** | Custom Design Tokens & Context | Centralized light/dark theme system |
| **UI Components** | `@expo/ui` & Custom Primitives | Accessible native bottom sheets and UI controls |

---

## 🏗️ System Architecture & Data Flow

Saddhamma is built around a resilient offline synchronization and local indexing architecture:

```
┌──────────────────────────────────────────────────────────┐
│              GitHub Release Data Pipeline                │
│       (Compressed minified bilara-data bundle ZIP)        │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │   SyncService (Resumable Download & Extraction Task)    │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │   DataService (SQLite Indexer & FTS5 Virtual Tables)   │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │       Expo Router Reader UI & Fast Search Engine        │
 └───────────────────────────┬────────────────────────────┘
```

1. **Sync Service (`SyncService.ts`)**: Checks remote release metadata, downloads the compressed `data.zip` via resilient download tasks, and handles versioning.
2. **Data Indexer (`DataService.ts`)**: Parses minified JSON text structures, building SQLite index tables and FTS5 search indexes for instant offline queries.
3. **Universal UI**: Renders segmented texts in React Native with real-time state synchronization for notes, bookmarks, and reader settings.

---

## 📂 Project Structure

```text
Saddhamma/
├── .github/workflows/      # CI/CD pipelines (Daily data sync workflows)
├── assets/                 # Application icons, splash screens, and static media
├── docs/                   # Architecture specs and data structure documentation
├── scripts/                # Build and bundle utilities (data minification & releases)
├── src/
│   ├── app/                # Expo Router file-based navigation
│   │   ├── (tabs)/         # Bottom tab navigation (Home, Saved, Settings)
│   │   ├── (content)/      # Content screens (Reader, Search, Menu, Timer, Logs)
│   │   └── _layout.tsx     # Main application layout & provider wrapper
│   ├── components/         # Reusable UI components (Headers, Error Boundaries, Loaders)
│   ├── services/           # Core logic (DataService, SyncService, LoggerService)
│   └── theme/              # Centralized theme tokens, colors, and ThemeContext
├── app.json                # Expo application configuration
├── eas.json                # Expo Application Services build profiles
├── package.json            # Dependencies and npm scripts
└── tsconfig.json           # TypeScript compilation settings
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your development machine:
- **Node.js**: `v18.0.0` or higher (LTS recommended)
- **Package Manager**: `yarn` or `npm`
- **Expo Go App**: Installed on your mobile device (Android/iOS) or an Android Emulator / iOS Simulator.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dipantan/Saddhamma.git
   cd Saddhamma
   ```

2. **Install dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

### Running the App

1. **Start the Metro bundler**
   ```bash
   npx expo start
   # or
   yarn start
   ```

2. **Launch on specific target**
   - **Android**: Press `a` in the terminal or run `yarn android`
   - **iOS**: Press `i` in the terminal or run `yarn ios`
   - **Web**: Press `w` in the terminal or run `yarn web`

---

## 📦 Data Synchronization Pipeline

The app utilizes a specialized build pipeline to package Pāli Canon texts from SuttaCentral (`bilara-data`):
- **Pruning**: Excludes non-English translations and unnecessary metadata to maintain a compact payload (~16 MB).
- **Minification**: Removes unnecessary whitespace and comments across thousands of JSON data files.
- **Deflate Compression**: Packs files using Level 9 DEFLATE compression for fast over-the-air sync.
- **Dynamic Mapping**: Generates a unified master index (`sutta_index.json`) mapping UIDs directly to canonical paths.

---

## 📜 Available Scripts

In the project directory, you can run:

- `yarn start`: Starts the Expo development server.
- `yarn android`: Runs the app on an connected Android device or emulator.
- `yarn ios`: Runs the app on an iOS simulator.
- `yarn web`: Starts the web development server.
- `yarn lint`: Runs ESLint to check code quality.
- `yarn build:preview`: Initiates an EAS cloud build for Android preview profile.
- `yarn build:preview:local`: Builds an Android APK locally via EAS CLI.
- `yarn release`: Executes the release publishing script (`scripts/publish-release.js`).

---

## 🙏 Credits & License

### Credits & Gratitude
- **SuttaCentral**: Deepest gratitude to SuttaCentral for providing open access to the Pāli Canon texts and translations.
- **Translations**: Primary English translations by **Bhikkhu Sujato** and other contributors.

### License
This project is open-source software licensed under the **[GPL-3.0-only License](LICENSE)**.

---

<p align="center">
  Built with ❤️ for the Dhamma and the Sangha.
</p>
