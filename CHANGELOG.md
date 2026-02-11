# Changelog

All notable changes to the Kensho Scoring System will be documented in this file.

## [4.0.0] - 2026-02-11

### 🚀 Major Evolution: Scoring System Overhaul
This major release focuses on complete architectural refactoring of the scoring console and the introduction of a high-performance "Hard Operator Mode".

### Added
- **Hard Operator Mode - No Blur**: A new aggressive visual mode for the scoring console designed for maximum performance and visibility in high-pressure environments.
- **Dynamic Scoreboard**: Font-size and contrast adjustments for the scoreboard, featuring 'Courier New' for a solid mechanical feel.

### Changed
- **Architectural Refactor**: Separated scoring logic from `scoring.html` into a dedicated modular JavaScript file `js/scoring.js`.
- **UI/UX Cleanup**:
  - Removed all `italic` fonts across the scoring console for a cleaner, modern look.
  - Eliminated legacy and heavy visual effects including the aurora background to reduce DOM complexity.
  - Consolidated all operator-specific styles into an external `css/scoring.css`.
- **Performance**: Significant reduction in HTML file size and DOM element count, resulting in faster load times and smoother interactions.

### Fixed
- Resolved minor CSS nesting and syntax issues in custom operator styles.
- Improved real-time data synchronization stability during scoring.


## [2.6.1] - 2026-02-02

### Added
- **Smart Athlete Import**: Intelligent duplicate detection and automatic data updates for participants.
- **Premium Custom Dialogs**: Glassmorphism modals replacing native browser alerts and prompts.
- **Secure Data Reset**: Required word-match confirmation ("HAPUS") for sensitive deletions.

### Fixed
- **Login Friction**: Auto-select password on error for instant correction.
- **UI Bug**: Fixed literal `\n` characters in confirmation dialogs.

## [2.6.0] - 2026-02-02

### Added
- **Match Schedule Tab**: New "Jadwal Pertandingan" tab in the public portal with real-time locking.
- **Desktop Update Notifications**: Implemented a sleek new update notification system with changelog support and real-time progress bar.
- **Improved Public Access**: Centralized "Bagikan Link" button and universal locking toggles for all major tabs.

## [2.5.3] - 2026-02-01

### Added
- **Tab Locking System**: Admins can now lock/unlock Brackets, Winners, and Medal Tally tabs for public access.
- **Enhanced Visuals**: Expanded event logo sizes in the official portal and admin settings for a more majestic and premium feel.

## [2.5.2] - 2026-02-01

### Added
- **Penghitungan Medali**: Implemented medal tally calculation and display in verification tab.
- **Improved Bracket Generation**: Refined participant drawing logic with conflict detection for teams.
- **Navigation Fix**: Corrected back navigation from bracket view to return to the proper event tab.

### Fixed
- Resolved ReferenceError in scoring dashboard initialization.
- Improved UI alignment and column sizing in athlete and class lists.

## [2.0.0] - 2026-01-23

### 🚀 Major Release: Kensho Next Generation
This release marks the evolution of Kensho from a scoring tool to a comprehensive tournament command center.

### Added
- **New KenshoBuilder Architecture**: 
  - Created a dedicated `KenshoBuilder` folder for better organization.
  - Implemented a "Nexus Studio" bright theme (eye-friendly, soft slate colors).
  - Added a high-precision drafting grid for easier bracket layout.
  - Added "Master Template" logic for 16-participant brackets (Fixed Bracket Template).
  - Added `coming-soon.html` as a surprise landing page for the new builder.
- **Security & Surprise Mechanism**:
  - Locked builder access in the Dashboard with a symbolic lock icon (🔒).
  - Redirected builder links to the "Coming Soon" surprise page.

### Changed
- **UI/UX Aesthetics**:
  - Updated scoring headers and visual states for better clarity.
  - Switched from dark-mode-only to a balanced professional "Studio" light theme in the builder.
  - Improved Dashboard layout with "Coming Soon" status for the builder module.
- **Code Refactor**:
  - Separated CSS (`css/builder.css`) and JavaScript (`js/builder.js`) from the main HTML files.
  - Standardized versioning across the ecosystem.

### Fixed
- Improved element snapping accuracy in the builder.
- Cleaned up the project root by moving legacy files to `_OLD_BUILDER_ARCHIVE`.

---
*Created by Kensho Technology Ecosystem*
