# Group 08 — Design System, Navigation, Native Components

Effort: M

Overview
- Establish a consistent RN design system using NativeWind, set up navigation (tabs/stack), and replace web modals with native equivalents.

Deliverables
- Theme tokens (colors, spacing, typography) and dark mode support.
- Navigation shell (tab + stack) with native transitions and haptics.
- Native components: action sheets, date/time pickers, loading indicators, sheets/modals.

Tasks
- Design system
  - NativeWind config; color tokens; dynamic type scale; high-contrast support.
  - Safe Area handling, responsive spacing, platform status bar styles.
- Navigation
  - React Navigation tabs/stacks; deep link integration with Group 04.
  - Screen transitions and back behavior aligned with iOS HIG.
- Components
  - Replace web modals with native sheets; action menus via action sheets.
  - Add haptic feedback for key interactions.
- Testing
  - Snapshot tests for key components; RTL interaction tests.

Acceptance Criteria
- Core screens share consistent styling; dark mode toggles correctly.
- Navigation behaves per iOS conventions; deep links open the correct screens.
- Native components integrated and accessible.

Dependencies
- Groups 01–02; coordinates with 04, 06, 07.

External Dependencies / Blockers
- None.

Integration Points
- Shared tokens usable by all feature groups; coordinates with a11y (Group 11).

