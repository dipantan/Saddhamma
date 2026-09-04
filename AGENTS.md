# Saddhamma (সদ্ধম্ম) — AI Agent & Developer Guide

Welcome to the **Saddhamma** repository. This document serves as the authoritative operational and architectural guide for AI agents and human contributors working on this codebase.

---

## ☸️ Project Overview

**Saddhamma** is a high-performance, offline-first mobile application and spiritual practice companion for reading and studying canonical Buddhist texts from the Pāli Canon (Sutta Piṭaka, Vinaya Piṭaka, and Abhidhamma Piṭaka). It is built with **React Native** and **Expo SDK 56**, backed by **SQLite FTS5** for instant offline full-text search.

### Core Goals
- **Distraction-Free Offline Study**: Instant local access to thousands of canonical texts without internet dependency.
- **Bilingual Canon**: Side-by-side or stacked English translations (primarily by Bhikkhu Sujato) and Pāli root texts, with Taisho (Chinese) and Sanskrit fallback support.
- **Mindful Practice Companion**: Thoughtful, doctrinal practice tools including a meditation timer, Gradual Training check-ins, reading history, and consistency tracking.
- **Doctrinal Integrity**: Adherence to canonical principles—strictly avoiding commercialization, competitive gamification, or quantifying spiritual attainments (e.g., samādhi or jhāna).

---

## 🛠️ Tech Stack & Key Dependencies

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Framework** | Expo SDK 56 (`~56.0.8`) | Managed React Native framework |
| **Runtime** | React Native `0.85.3`, React `19.2.3` | Mobile app engine with Hermes V1 & React Compiler |
| **Language** | TypeScript `~6.0.3` | Strict mode typing (`tsconfig.json`) |
| **Navigation** | Expo Router `~56.2.8` | File-based typed routing (`app.json: experiments.typedRoutes`) |
| **Database** | `expo-sqlite` `~56.0.4` | Embedded SQLite with FTS5 virtual tables, WAL mode, prepared statements |
| **Storage & I/O** | `expo-file-system` `~56.0.7`, `react-native-zip-archive` `^7.1.1` | Flat JSON file storage and ZIP bundle extraction |
| **UI Primitives** | `@expo/ui` `~56.0.15`, React Native core | Modern native UI components & BottomSheet |
| **Animations** | `react-native-reanimated` `4.3.1` | Smooth 60 FPS transitions and breathing timer animations |
| **Notifications** | `expo-notifications` `~56.0.18` | Sutta of the day reminders & background sync status |
| **Speech** | `expo-speech` `~56.0.3` | Text-to-Speech (TTS) for sutta recitation |
| **Build & CI/CD**| EAS CLI, GitHub Workflows | Local/cloud APK builds and data sync automation |

---

## 🏗️ Architecture & Data Flow

Saddhamma is engineered around a hybrid local-first storage architecture: **flat JSON file storage** for content text paired with a **SQLite FTS5 database** for fast indexing and querying.

### 1. Data Synchronization Pipeline (`src/services/SyncService.ts`)
- **Remote Bundle**: Pulls pre-processed and minified data from `dipantan/suttacentral-api-server` GitHub releases (`data.zip` ~16 MB).
- **Download & Extract**: Uses `expo-file-system` to download and `react-native-zip-archive` to unpack into `${Paths.document.uri}sutta_data/`.
- **Version Tracking**: Compares remote commit hash (`data.json`) against local `${Paths.document.uri}sutta_data/version.json`.
- **Foreground & Background Notifications**: Dispatches native notifications on Android during sync and completion.

### 2. SQLite Database & Full-Text Search (`src/services/DataService.ts`)
Database file: `sutta_db.sqlite` (configured with `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;`).

#### Tables Schema
1. **`sutta_index`**:
   ```sql
   CREATE TABLE IF NOT EXISTS sutta_index (
     uid TEXT PRIMARY KEY,
     title TEXT,
     data TEXT NOT NULL
   );
   ```
2. **`sutta_metadata`**:
   ```sql
   CREATE TABLE IF NOT EXISTS sutta_metadata (
     uid TEXT PRIMARY KEY,
     translated_name TEXT,
     root_name TEXT,
     acronym TEXT,
     blurb TEXT
   );
   ```
3. **`sutta_fts`** (Virtual Table using FTS5):
   ```sql
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
   ```

#### 3-Tiered Search Engine
When a user searches via `searchSuttas(query)`:
- **Tier 1 (Exact UID match)**: Matches normalized UID (e.g. `"mn10"`, `"sn56.11"`) with rank `-1000`.
- **Tier 2 (Prefix UID match)**: Matches `LIKE 'query%'` with rank `-500`.
- **Tier 3 (FTS5 BM25 search)**: Evaluates match with column weights:
  - `root_title`: 20.0
  - `translated_title`: 20.0
  - `acronym`: 15.0
  - `blurb`: 10.0
  - `translation_text`: 5.0
  - `root_text`: 5.0
- **Deduplication & Snippets**: Results are merged, deduplicated by UID (lowest search_rank wins), and highlighted via FTS5 `snippet()`.

### 3. User Data Flat-File Storage (`Paths.document.uri`)
To keep user data simple, inspectable, and immune to schema migrations, user-generated content is stored in JSON files:
- `bookmarks.json`: Saved sutta bookmarks (`Bookmark[]`).
- `user_notes.json`: Freeform notes per sutta UID (`Record<string, string>`).
- `user_annotations.json`: Colored highlights (`yellow` | `green` | `blue` | `purple`) and per-segment annotations (`SegmentAnnotation`).
- `meditation_logs.json`: Meditation session duration, timestamp, and reflections (`MeditationLog[]`).
- `gradual_training.json`: Daily binary check-ins (`GradualTrainingCheckIn`).
- `reading_history.json`: Recently viewed suttas (`ReadingLog[]`).
- `reader_settings.json`: Reader configuration (font size, display mode, line height, reminder schedule).

### 4. Online Fallback Mechanism
If a sutta or legacy translation is not present in local storage (or is non-Pāli such as Taisho/Chinese/Sanskrit), the app automatically queries `https://suttacentral.net/api/suttas/{uid}/{authorUid}` with timeout protection, parses the HTML into structured segment paragraphs, and caches the result directly into `sutta_index` for subsequent offline reads.

---

## 📂 Project Directory Structure

```text
Saddhamma/
├── .agents/
│   └── skills/                 # Agent skill definitions (Expo UI, native fetching, etc.)
├── assets/                     # Static media, icons, and adaptive icons
├── docs/                       # Web landing page and documentation site
├── markdowns/                  # Architecture specs & feature analysis documents
├── scripts/
│   ├── publish-release.js      # EAS build artifact fetcher & GitHub release publisher
│   └── reset-project.js        # Fresh template reset script
├── src/
│   ├── app/                    # Expo Router file-based route tree
│   │   ├── (tabs)/             # Main app tab layout
│   │   │   ├── (home)/         # Root collections & daily sutta screen
│   │   │   ├── (saved)/        # Bookmarks & saved items screen
│   │   │   └── (settings)/     # Appearance, reader options, reminders, & dev logs
│   │   ├── (content)/          # Modal & reader screens
│   │   │   ├── menu/[id].tsx   # Canonical hierarchy navigation menu
│   │   │   ├── reader/[uid].tsx# Sutta reader (bilingual, annotations, TTS, in-page search)
│   │   │   ├── search.tsx      # Global FTS5 search interface
│   │   │   ├── timer.tsx       # Meditation timer with breathing animation & bells
│   │   │   └── logs.tsx        # Practice logs, Gradual Training check-in & badges
│   │   └── _layout.tsx         # App entry, ThemeProvider, global indexing bar, notifications
│   ├── components/             # Reusable UI primitives (ErrorBoundary, LoadingState, etc.)
│   ├── services/
│   │   ├── DataService.ts      # Core SQLite manager, FTS5 indexer, and JSON store
│   │   ├── LoggerService.ts    # File-based crash logger & diagnostic utility
│   │   └── SyncService.ts      # GitHub Release bundle download & unzipping
│   └── theme/
│       ├── ThemeContext.tsx    # Theme provider (system, light, dark modes)
│       └── tokens.ts           # Design tokens: spacing, radius, colors, typography
├── app.json                    # Expo application configuration & plugins
├── eas.json                    # EAS build profiles (development, preview, production)
├── package.json                # Project dependencies and lifecycle scripts
└── tsconfig.json               # TypeScript path alias configuration (@/* -> src/*)
```

---

## 🎨 Design System & Theming

The application utilizes a custom design token system in [`src/theme/tokens.ts`](file:///e:/Projects/react%20native/Saddhamma/src/theme/tokens.ts) and [`ThemeContext.tsx`](file:///e:/Projects/react%20native/Saddhamma/src/theme/ThemeContext.tsx):

- **Color Palette**:
  - Warm Saffron / Ochre (`palette.saffron400`, `#FFD54F`): Theravāda monastic robes aesthetic, accents, active indicators.
  - Serene Teal (`palette.teal600`, `palette.teal200`): Calm secondary accent for meditation and mindfulness.
  - Brand Blue (`#208AEF` / `#5EABF5`): Interactive links and primary actions.
  - Warm Reading Neutrals: Off-white (`#F8F6F2`) for light reading; deep charcoal (`#121212` / `#1E1E1E`) for dark mode.
  - Pāli Distinction: Distinct warm brown/gold (`textPali`) for root Pāli terms.
- **Spacing**: 4-point grid (`xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 20`, `xxl: 24`, `xxxl: 32`).
- **Typography**: Platform-native serif fonts (`Georgia` on iOS, `serif` on Android) for sutta text to maximize reading comfort.
- **Theme Modes**: Supports `"system"`, `"light"`, and `"dark"` via `useTheme()`. Always pull colors from `const { colors } = useTheme();`.

---

## 🧘 Critical Doctrinal Guidelines

When modifying practice, check-in, or text features, strictly observe canonical guidance:
1. **No Competitive Gamification**: Badges and streaks exist strictly for mindful consistency. Never introduce scores, leaderboards, or language suggesting that spiritual stages (e.g., *jhāna*, *samādhi*, *sotāpatti*) are quantifiable goals or metrics.
2. **Binary Gradual Training**: The Gradual Training (*Anupubbikathā*) check-in is binary (`boolean` yes/no). Do NOT convert these into 1–5 star ratings or quality sliders.
3. **Precept Clarity**: Clarify that lay practice refers to the 5 precepts (*kāmesu micchācāra*), distinguishing from monastic celibacy (*abrahmacariya*).
4. **Attribution**: Always maintain translator credit and SuttaCentral source attribution.

---

## 📜 Key Development Commands

All commands should be executed from the project root using `yarn`:

| Command | Action |
| :--- | :--- |
| `yarn start` | Start the Expo Metro development server |
| `yarn android` | Run app on connected Android device or emulator |
| `yarn ios` | Run app on iOS simulator (macOS required) |
| `yarn web` | Start web development server |
| `yarn lint` | Run ESLint across TypeScript source files |
| `yarn build:preview` | Trigger EAS cloud build for Android APK |
| `yarn build:preview:local` | Build Android APK locally with EAS CLI |
| `yarn release [tag]` | Run `scripts/publish-release.js` to download EAS build & create GitHub release |

---

## 🤖 Guidelines for AI Agents

When editing or extending this codebase:

1. **Path Aliasing**: Always use the `@/` alias for imports inside `src/` (e.g., `import { useTheme } from "@/theme";`).
2. **SQLite Safety & Hot Reloads**:
   - Always access the database through `getDb()` in `DataService.ts`.
   - Never create independent SQLite connection instances outside `DataService`.
   - Use `withTransactionAsync` for batch insertions and prepare statements with `prepareAsync` / `finalizeAsync` to prevent deadlocks or resource leaks.
3. **Background Tasks & Thread Safety**:
   - FTS indexing (`buildFullTextIndex()`) processes in small batches with brief async pauses (`setTimeout(resolve, 10)`) to ensure the UI thread never drops frames.
   - Guard asynchronous tasks with `isMounted` checks or cancellation tokens when interacting with component state.
4. **Typography & Styling**:
   - Avoid hardcoding hex colors or pixel sizes directly in styles. Use `colors.*` from `useTheme()` and `spacing` / `radius` from `@/theme/tokens`.
5. **Expo Router Conventions**:
   - Keep screen components default-exported.
   - Use `useLocalSearchParams<{ param: string }>()` with explicit TypeScript generic arguments.
   - Modals and full-screen modals must match route configuration in `src/app/_layout.tsx`.
6. **Error Handling**:
   - Wrap risky I/O and network operations with `try / catch` and log critical errors using `LoggerService.log()`.
   - Use `CustomErrorBoundary` for UI fallback rendering on fatal exceptions.
