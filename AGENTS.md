# Research Tree — AGENTS.md

## Dev commands

### Backend
```powershell
cd backend
# first time:
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .

# run:
uvicorn app.main:app --reload
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

### Quick start (both servers)
```powershell
.\scripts\start-all.ps1
```

### Stop servers
```powershell
.\scripts\stop-all.ps1
```

## Project structure
```
ResearchTree/
├── backend/
│   └── app/
│       ├── main.py           # FastAPI entry point
│       ├── config.py         # Settings
│       ├── database.py       # SQLAlchemy engine + session
│       ├── models/           # SQLAlchemy models
│       │   ├── subject.py
│       │   ├── resource.py
│       │   ├── resource_edge.py
│       │   ├── bookmark.py
│       │   └── tag.py
│       ├── schemas/          # Pydantic request/response
│       ├── routes/           # FastAPI route handlers
│       └── services/         # Business logic
├── frontend/
│   └── src/
│       ├── api/              # HTTP client
│       ├── store/            # Zustand state management
│       ├── components/
│       │   ├── GraphView/    # D3.js subject + resource graph
│       │   ├── PDFViewer/    # PDF.js viewer + context menu
│       │   ├── NodePanel/    # Resource detail, progress, tags
│       │   └── Sidebar/      # Search, subject tree
│       └── styles/
├── scripts/                  # Start/stop scripts
├── USER_MANUAL.md            # User documentation
└── TODO.md                   # Remaining work
```

## Conventions
- Python backend: FastAPI + SQLAlchemy + Pydantic
- Frontend: React + TypeScript + Tailwind CSS v4 + Zustand
- No comments in code unless necessary
- Models go in `backend/app/models/`, routes in `backend/app/routes/`, schemas in `backend/app/schemas/`
- Frontend components go in `frontend/src/components/<FeatureName>/`
- API client calls go through `frontend/src/api/client.ts`

## Data model
- **Subject** = research topic area (e.g., "Reinforcement Learning"); forms a tree via `parent_subject_id`
- **Resource** = article, book, PDF, repo, link, etc. within a subject; has progress, tags, file_path
- **ResourceEdge** = relationship between two resources (sibling, reference, comparison)
- **Bookmark** = saved quote from a PDF with page number
- **Tag** = label applied to resources
