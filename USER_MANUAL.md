# Research Tree — User Manual

A visual research knowledge base for organizing articles, papers, tutorials, and ideas into a navigable tree/graph.

---

## Concepts

### Subject
A **subject** is a research topic area (e.g., "Reinforcement Learning", "Dynamic Programming"). Subjects form a tree:
- A subject can have **child subjects** (building blocks, prerequisites)
- A subject can have **sibling subjects** (parallel/comparison topics)
- Each subject has a **progress** indicator (aggregate of its resources)

### Resource
A **resource** is a concrete item within a subject:
- Article, book, tutorial, video, GitHub repo, forum link, note, etc.
- Can have a **file path** pointing to a local PDF
- Has its own **progress** tracking (0–100%)
- Can have **tags**, **summary**, **bookmarks**

### Bookmark
A saved quote from a PDF with page number and optional note.

---

## Getting Started

### 1. Start the application

Run both servers (in separate terminals or use the all-in-one script):

```powershell
# Terminal 1 — Backend:
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload

# Terminal 2 — Frontend:
cd frontend
npm run dev
```

Or use the scripts:

```powershell
.\scripts\start-all.ps1
```

Open **http://127.0.0.1:5173** in your browser.

### 2. Create your first subject

1. In the sidebar, subjects are listed as a tree
2. Use the API directly or via the UI to create your first subject
3. For now, you can use the backend API:

```powershell
curl -X POST http://127.0.0.1:8000/api/subjects `
  -H "Content-Type: application/json" `
  -d '{"title": "Reinforcement Learning", "summary": "My RL research"}'
```

### 3. Add resources

```powershell
curl -X POST http://127.0.0.1:8000/api/resources `
  -H "Content-Type: application/json" `
  -d '{"subject_id": "<subject-id>", "title": "Sutton & Barto", "type": "book", "file_path": "C:\\Papers\\rl_book.pdf"}'
```

---

## Workflows

### Reading a PDF

1. Select a resource that has a `file_path` set
2. The PDF viewer opens on the right
3. Use the **Prev/Next** buttons to navigate pages
4. The page counter shows current page / total pages

### Taking notes from a PDF

1. Select text in the PDF
2. **Right-click** on the selection
3. A context menu appears with options:

| Option | What it does |
|---|---|
| **Bookmark selection** | Saves the selected text + page number + optional note |
| **Spawn child subject** | Creates a new subject (child of current) named from the selection |
| **Spawn sibling subject** | Creates a new sibling subject |
| **Spawn resource** | Creates a new resource within the current subject |
| **Mark progress here** | Sets the resource progress based on current page / total pages |

4. A dialog appears for each action — fill in details and confirm

### Browsing the research tree

- **Subject Graph** (top-left panel): D3.js interactive tree of all subjects
  - Zoom with mouse wheel
  - Pan by dragging
  - Click a node to select that subject
  - Color indicates progress (red → yellow → green)
- **Resource Graph** (below subject graph): Force-directed graph of resources in the selected subject
  - Drag nodes to rearrange
  - Click to select
- **Sidebar tree**: Text-based collapsible tree for quick navigation

### Managing resources

- Click a resource to select it
- The detail panel shows:
  - **Title** — editable
  - **Progress** — slider
  - **Tags** — add/remove with autocomplete
  - **Summary** — editable text
  - **Bookmarks** — saved quotes from the PDF

---

## API Reference

### Subjects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/subjects` | List all subjects |
| POST | `/api/subjects` | Create a subject |
| GET | `/api/subjects/{id}` | Get a subject |
| PUT | `/api/subjects/{id}` | Update a subject |
| DELETE | `/api/subjects/{id}` | Delete a subject |

### Resources

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/resources?subject_id=` | List resources (optional filter) |
| POST | `/api/resources` | Create a resource |
| GET | `/api/resources/{id}` | Get a resource |
| PUT | `/api/resources/{id}` | Update a resource |
| DELETE | `/api/resources/{id}` | Delete a resource |

### Bookmarks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/bookmarks/resource/{id}` | List bookmarks for a resource |
| POST | `/api/bookmarks` | Create a bookmark |
| DELETE | `/api/bookmarks/{id}` | Delete a bookmark |

### Resource Edges

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/resource-edges` | List all edges |
| POST | `/api/resource-edges` | Create an edge |
| DELETE | `/api/resource-edges/{id}` | Delete an edge |

### Tags

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create a tag |
| DELETE | `/api/tags/{id}` | Delete a tag |

### Search

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/search/resources?q=` | Search resources |
| GET | `/api/search/subjects?q=` | Search subjects |

### Files

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/files/{resource_id}` | Serve a resource's attached PDF file |

---

## Keyboard Shortcuts

None yet — planned for future versions.

---

## Troubleshooting

**"API offline" shown in the UI**
→ Make sure the backend is running on port 8000.

**PDF doesn't load**
→ Check that the resource's `file_path` points to an existing PDF file on disk.
→ The path must be accessible by the backend process.

**"Backend not found" when starting**
→ Run `pip install -e .` from the `backend/` directory first to install dependencies.
