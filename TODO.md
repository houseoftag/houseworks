# Houseworks Project TODO

## Stage 1: The Skeleton (MVP)
- [x] **Board Interface Improvements**
    - [x] Implement Group Expand/Collapse in `BoardTable`
    - [x] Add Inline "Add Item" row at the bottom of each group
    - [x] Integrate Drag & Drop (Items, Groups, Columns) directly into `BoardTable`
    - [x] Add Column Summary (e.g., Status progress bar at the bottom of groups)
- [x] **Column Types Enhancements**
    - [x] Text: Improve inline editing experience
    - [x] Status: Better dropdown UI with color indicators
    - [x] Person: Better user selection UI
    - [x] Date: Date picker with overdue highlighting (Red text for past dates)
- [x] **Authentication & Team**
    - [x] Refine Invite System (ensure email flow works)
    - [x] Team Management View (Admin table to list/deactivate users)

## Stage 2: Automations & Real-time
- [x] **Automation Engine Expansion**
    - [x] Add more triggers (e.g., "When item created")
    - [x] Add more actions (e.g., "Set status")
    - [ ] Add "When due date arrives" (requires scheduler)
- [ ] **Real-time Updates**
    - [x] Implement optimistic UI for cell updates
    - [ ] Consider WebSockets or polling for multi-user sync
