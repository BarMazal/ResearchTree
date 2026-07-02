from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine
from app.routes import api_router


def _migrate_legacy_bookmarks_columns() -> None:
    # Keep older local SQLite DBs compatible after resource->item rename.
    with engine.connect() as conn:
        cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(bookmarks)"))
        }

        if "resource_id" in cols:
            # Recreate table without resource_id to fix foreign key and NOT NULL integrity errors
            conn.execute(text("PRAGMA foreign_keys = OFF"))
            conn.execute(text("""
                CREATE TABLE bookmarks_new (
                    id VARCHAR(36) PRIMARY KEY,
                    item_id VARCHAR(36) NOT NULL,
                    page INTEGER,
                    chapter VARCHAR(500),
                    quote TEXT,
                    note TEXT,
                    spawned_item_id VARCHAR(36),
                    created_at DATETIME NOT NULL,
                    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
                    FOREIGN KEY(spawned_item_id) REFERENCES items(id) ON DELETE SET NULL
                )
            """))
            has_item_id = "item_id" in cols
            has_spawned = "spawned_item_id" in cols
            select_item_id = "COALESCE(item_id, resource_id)" if has_item_id else "resource_id"
            select_spawned = "spawned_item_id" if has_spawned else "NULL"
            
            conn.execute(text(f"""
                INSERT INTO bookmarks_new (id, item_id, page, chapter, quote, note, spawned_item_id, created_at)
                SELECT id, {select_item_id}, page, chapter, quote, note, {select_spawned}, created_at
                FROM bookmarks
            """))
            conn.execute(text("DROP TABLE bookmarks"))
            conn.execute(text("ALTER TABLE bookmarks_new RENAME TO bookmarks"))
            conn.execute(text("PRAGMA foreign_keys = ON"))
            conn.commit()
            return

        if "item_id" not in cols:
            conn.execute(text("ALTER TABLE bookmarks ADD COLUMN item_id VARCHAR(36)"))

        if "spawned_item_id" not in cols:
            conn.execute(text("ALTER TABLE bookmarks ADD COLUMN spawned_item_id VARCHAR(36)"))

        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    try:
        _migrate_legacy_bookmarks_columns()
    except Exception:
        pass

    for col in ["graph_x", "graph_y"]:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE items ADD COLUMN {col} FLOAT"))
                conn.commit()
        except Exception:
            pass
    yield


app = FastAPI(title="Research Tree API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
