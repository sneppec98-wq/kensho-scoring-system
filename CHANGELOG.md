# Changelog

All notable changes to the Kensho Scoring System will be documented in this file.

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
