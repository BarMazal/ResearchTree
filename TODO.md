# Research Tree — Remaining Work

---

## Graph interactions

- [ ] **Delete items from graph** — Right-click node context menu to delete an item (with undo/confirm)
- [ ] **Branch/spawn from graph node** — Right-click → spawn a new item linked to the current one
- [ ] **Draw connections between nodes** — Click two nodes to create an edge with a relationship label
- [ ] **Multi-select** — Shift+click or Ctrl+click to select multiple nodes for batch operations (delete, cluster, connect)
- [ ] **Cluster selected nodes** — Group selected items into a visual cluster (tag-based or explicit grouping)

## Short-term

- [ ] **File path management UI** — Allow users to set/edit `file_path` on resources from the UI (file picker dialog)
- [ ] **Progress aggregation** — Compute aggregate progress for a subject based on weighted average of its resources
- [ ] **Import/export** — JSON dump/load of the full research tree (items, edges, bookmarks, tags)

## Medium-term

- [ ] **Filter by tags** — Filter the item graph by tags
- [ ] **Resource type icons** — Different icons/colors for article, book, video, repo, forum, etc.
- [ ] **Edge labels on graph** — Show relationship labels on resource graph edges
- [ ] **Full-text search across bookmarks** — Include bookmark quotes in search results

## Long-term

- [ ] **Electron/Tauri desktop wrapper** — Package the app as a standalone desktop app
- [ ] **Drag-and-drop PDF import** — Drop a PDF onto the app to create a resource automatically
- [ ] **Page-level progress tracking** — Track which pages you've read within a PDF
- [ ] **Citation export** — Export a bibliography from selected resources
- [ ] **Auto-tagging** — Suggest tags based on resource content
- [ ] **Sync** — Cloud sync or multi-machine support
- [ ] **Mobile-friendly** — Responsive layout for tablets

## Technical debt

- [ ] **Error boundaries** — Graceful error handling in React components
- [ ] **Loading states** — Spinners/skeletons for all async operations
- [ ] **Pagination** — For large numbers of resources
- [ ] **Database migrations** — Alembic setup for schema changes
- [ ] **Testing** — Unit tests for API endpoints
- [ ] **Accessibility** — Keyboard navigation, ARIA labels


If you want, I can next add:


A grid or ruled-paper background for equations and flow sketches.
True formula editing for latex items with a live source + preview split.
