# Research Tree — Remaining Work

> Items are roughly ordered by priority/impact.

---

## Short-term

- [ ] **File path management UI** — Allow users to set/edit `file_path` on resources from the UI (file picker dialog)
- [ ] **Graph node context menu** — Right-click on graph nodes (subject + resource) to spawn/delete from the graph itself, not just the PDF
- [ ] **Progress aggregation** — Compute aggregate progress for a subject based on weighted average of its resources
- [ ] **Import/export** — JSON dump/load of the full research tree (subjects, resources, edges, bookmarks, tags)

## Medium-term

- [ ] **Subject-edge visualization** — Show subject-to-subject relationships on the graph (parent-child edges currently work; show spawn source)
- [ ] **Filter by tags** — Filter the subject/resource tree by tags
- [ ] **Resource type icons** — Different icons/colors for article, book, video, repo, forum, etc.
- [ ] **Edge labels on graph** — Show relationship labels on resource graph edges
- [ ] **Full-text search across bookmarks** — Include bookmark quotes in search results

## Long-term

- [ ] **Electron/Tauri desktop wrapper** — Package the app as a standalone desktop app
- [ ] **Drag-and-drop PDF import** — Drop a PDF onto the app to create a resource automatically
- [ ] **Page-level progress tracking** — Track which pages you've read within a PDF
- [ ] **Citation export** — Export a bibliography from selected resources
- [ ] **Graph node collapse/expand** — Collapse subject branches in the D3.js graph
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
