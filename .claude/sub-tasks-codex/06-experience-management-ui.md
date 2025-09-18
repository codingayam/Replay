# Group 06 — Experience Management UI (Lists, Edit/Delete)

Effort: M

Overview
- Port the existing Note/Experience management features to RN using performant list primitives and native gestures.
- Provide pull-to-refresh, pagination/infinite scroll, and contextual actions.

Deliverables
- RN `FlatList/SectionList`-based experiences screen with empty/error/loading states.
- `NoteCard` RN equivalent with accessible touch targets and dynamic type support.
- Swipe-to-edit/delete and pull-to-refresh interactions.
- Integration with API for CRUD operations and optimistic UI.

Tasks
- Data layer
  - Connect to API via shared client and types; shape data for lists.
  - Implement pagination or incremental fetch; cache and refresh policies.
- UI & interactions
  - RN components styled via NativeWind; safe areas respected.
  - Gesture Handler for swipe actions; haptic feedback.
  - Pull-to-refresh + retry states; skeleton loaders.
- Testing
  - Unit tests for list renderers and reducers.
  - RTL tests for gestures and action buttons (mocked).

Acceptance Criteria
- Experiences list renders smoothly (60fps target), supports refresh and pagination.
- Edit/delete actions work with optimistic updates and server reconciliation.
- Basic RTL tests pass; a11y roles/labels present for list items.

Dependencies
- Groups 01, 02, and 04 (auth) for data access and context.

External Dependencies / Blockers
- None beyond API availability.

Integration Points
- Shares design tokens/components with Group 08.
- Utilizes offline support (Group 10) when available.

