import json
import os
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings


class CollectionService:
    """
    Manages isolated Collections (Workspaces).
    Each collection maintains its own SQLite database and file storage directory under:
      ~/ResearchTree/collections/<Collection_Name>/
    """

    def __init__(self):
        self.root_dir = Path.home() / "ResearchTree" / "collections"
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.active_file = Path.home() / "ResearchTree" / "active_collection.txt"

        self._active_collection_name = self._load_active_name()
        self._current_engine = None
        self._current_sessionmaker = None

    def _load_active_name(self) -> str:
        if self.active_file.exists():
            try:
                name = self.active_file.read_text(encoding="utf-8").strip()
                if name:
                    return name
            except Exception:
                pass
        return "Default"

    def _save_active_name(self, name: str) -> None:
        try:
            self.active_file.write_text(name, encoding="utf-8")
        except Exception as e:
            print(f"Failed to write active collection file: {e}")

    def get_collection_dir(self, name: str) -> Path:
        return self.root_dir / name

    def get_collection_db_path(self, name: str) -> Path:
        return self.get_collection_dir(name) / "research_tree.db"

    def get_collection_files_dir(self, name: str) -> Path:
        p = self.get_collection_dir(name) / "files"
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_active_collection_name(self) -> str:
        return self._active_collection_name

    def get_active_files_dir(self) -> Path:
        return self.get_collection_files_dir(self._active_collection_name)

    def initialize(self) -> None:
        """
        Initializes collection storage layout and performs automatic legacy data migration.
        """
        # Migrate legacy single database/files into Default collection if present
        default_dir = self.get_collection_dir("Default")
        legacy_db = Path(__file__).parent.parent.parent / "research_tree.db"
        legacy_files = Path.home() / "ResearchTree" / "files"

        if not default_dir.exists():
            default_dir.mkdir(parents=True, exist_ok=True)
            default_files = default_dir / "files"
            default_files.mkdir(parents=True, exist_ok=True)

            if legacy_db.exists():
                try:
                    shutil.copy2(legacy_db, default_dir / "research_tree.db")
                    print(f"Migrated legacy database to Default collection.")
                except Exception as e:
                    print(f"Legacy DB migration failed: {e}")

            if legacy_files.exists() and legacy_files.is_dir() and legacy_files != default_files:
                try:
                    for f in legacy_files.glob("*"):
                        if f.is_file():
                            shutil.copy2(f, default_files / f.name)
                    print(f"Migrated legacy files to Default collection.")
                except Exception as e:
                    print(f"Legacy files migration failed: {e}")

        # Ensure active collection directory exists
        active_dir = self.get_collection_dir(self._active_collection_name)
        if not active_dir.exists():
            active_dir.mkdir(parents=True, exist_ok=True)
            (active_dir / "files").mkdir(parents=True, exist_ok=True)

        self._setup_engine(self._active_collection_name)

    def _setup_engine(self, name: str) -> None:
        if self._current_engine:
            try:
                self._current_engine.dispose()
            except Exception:
                pass

        db_path = self.get_collection_db_path(name)
        db_url = f"sqlite:///{db_path}"

        engine = create_engine(
            db_url,
            echo=False,
            connect_args={"check_same_thread": False},
        )

        from app.database import Base
        from app.main import _migrate_legacy_bookmarks_columns
        Base.metadata.create_all(bind=engine)

        try:
            with engine.connect() as conn:
                cols = {row[1] for row in conn.execute(text("PRAGMA table_info(bookmarks)"))}
                if "resource_id" in cols or "item_id" not in cols:
                    _migrate_legacy_bookmarks_columns()
        except Exception:
            pass

        for col, col_type in [
            ("graph_x", "FLOAT"),
            ("graph_y", "FLOAT"),
            ("is_archived", "BOOLEAN DEFAULT 0"),
            ("merged_into_id", "VARCHAR(36)"),
            ("flags", "TEXT DEFAULT '[]'"),
            ("is_local", "BOOLEAN DEFAULT 0"),
            ("is_resolved", "BOOLEAN DEFAULT 0"),
            ("blocker_reason", "TEXT"),
            ("resolution_note", "TEXT"),
            ("last_accessed_at", "DATETIME"),
        ]:
            try:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE items ADD COLUMN {col} {col_type}"))
                    conn.commit()
            except Exception:
                pass

        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO item_edges (id, source_item_id, target_item_id, relationship)
                    SELECT
                        LOWER(HEX(RANDOMBLOB(4)) || '-' || HEX(RANDOMBLOB(2)) || '-' || HEX(RANDOMBLOB(2)) || '-' || HEX(RANDOMBLOB(2)) || '-' || HEX(RANDOMBLOB(6))),
                        a.parent_item_id,
                        a.merged_into_id,
                        'parent_child'
                    FROM items a
                    JOIN items p ON p.id = a.merged_into_id
                    WHERE a.is_archived = 1
                      AND a.parent_item_id IS NOT NULL
                      AND a.merged_into_id IS NOT NULL
                      AND a.parent_item_id != a.merged_into_id
                      AND a.parent_item_id != COALESCE(p.parent_item_id, '')
                      AND NOT EXISTS (
                          SELECT 1 FROM item_edges e
                          WHERE e.source_item_id = a.parent_item_id
                            AND e.target_item_id = a.merged_into_id
                      )
                """))
                conn.commit()
        except Exception:
            pass

        self._current_engine = engine

        self._current_sessionmaker = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        self._active_collection_name = name
        self._save_active_name(name)

    def get_session(self) -> Session:
        if not self._current_sessionmaker:
            self.initialize()
        return self._current_sessionmaker()

    def list_collections(self) -> List[Dict[str, Any]]:
        self.root_dir.mkdir(parents=True, exist_ok=True)
        collections = []

        for p in self.root_dir.iterdir():
            if p.is_dir():
                name = p.name
                db_path = p / "research_tree.db"
                files_dir = p / "files"

                item_count = 0
                if db_path.exists():
                    try:
                        eng = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
                        with eng.connect() as conn:
                            res = conn.execute(text("SELECT COUNT(*) FROM items"))
                            item_count = res.scalar() or 0
                        eng.dispose()
                    except Exception:
                        item_count = 0

                file_count = 0
                size_bytes = 0
                if files_dir.exists():
                    for f in files_dir.glob("*"):
                        if f.is_file():
                            file_count += 1
                            size_bytes += f.stat().st_size

                created_at = datetime.fromtimestamp(p.stat().st_ctime, tz=timezone.utc).isoformat()

                collections.append({
                    "name": name,
                    "is_active": (name == self._active_collection_name),
                    "item_count": item_count,
                    "file_count": file_count,
                    "size_bytes": size_bytes,
                    "created_at": created_at,
                })

        return sorted(collections, key=lambda c: c["name"])

    def create_collection(self, name: str) -> Dict[str, Any]:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Collection name cannot be empty")

        col_dir = self.get_collection_dir(clean_name)
        if col_dir.exists():
            raise ValueError(f"Collection '{clean_name}' already exists")

        col_dir.mkdir(parents=True, exist_ok=True)
        (col_dir / "files").mkdir(parents=True, exist_ok=True)

        # Switch to new collection
        self._setup_engine(clean_name)
        return {
            "name": clean_name,
            "status": "created",
            "is_active": True,
        }

    def switch_collection(self, name: str) -> Dict[str, Any]:
        clean_name = name.strip()
        col_dir = self.get_collection_dir(clean_name)
        if not col_dir.exists():
            raise ValueError(f"Collection '{clean_name}' does not exist")

        self._setup_engine(clean_name)
        return {
            "name": clean_name,
            "status": "switched",
            "is_active": True,
        }

    def export_collection(self, name: str) -> Path:
        col_dir = self.get_collection_dir(name)
        if not col_dir.exists():
            raise ValueError(f"Collection '{name}' does not exist")

        temp_zip = Path.home() / "ResearchTree" / f"{name}_export.rtree"
        with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(col_dir):
                for file in files:
                    full_path = Path(root) / file
                    rel_path = full_path.relative_to(col_dir)
                    zf.write(full_path, arcname=rel_path)
        return temp_zip

    def import_collection_bundle(self, bundle_zip_path: Path, new_name: str | None = None) -> str:
        if not bundle_zip_path.exists():
            raise ValueError("Bundle file not found")

        target_name = new_name or bundle_zip_path.stem.replace("_export", "")
        col_dir = self.get_collection_dir(target_name)
        if col_dir.exists():
            target_name = f"{target_name}_{uuid.uuid4().hex[:4]}"
            col_dir = self.get_collection_dir(target_name)

        col_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(bundle_zip_path, "r") as zf:
            zf.extractall(col_dir)

        return target_name

    def deep_copy_subtree(self, item_id: str, target_collection_name: str) -> Dict[str, Any]:
        """
        Deep copies an item and all its descendant children, bookmarks, edges, and physical files
        from the active collection into target_collection_name.
        """
        source_session = self.get_session()
        target_dir = self.get_collection_dir(target_collection_name)
        if not target_dir.exists():
            source_session.close()
            raise ValueError(f"Target collection '{target_collection_name}' does not exist")

        target_db_path = self.get_collection_db_path(target_collection_name)
        target_files_dir = self.get_collection_files_dir(target_collection_name)

        target_eng = create_engine(f"sqlite:///{target_db_path}", connect_args={"check_same_thread": False})
        target_sessionmaker = sessionmaker(bind=target_eng)
        target_session = target_sessionmaker()

        from app.models import Bookmark, Item, ItemEdge

        try:
            root_item = source_session.query(Item).filter(Item.id == item_id).first()
            if not root_item:
                raise ValueError(f"Source item '{item_id}' not found")

            # Collect all descendant items in hierarchy
            all_source_items = source_session.query(Item).all()
            children_map: dict[str, list[Item]] = {}
            for item in all_source_items:
                if item.parent_item_id:
                    children_map.setdefault(item.parent_item_id, []).append(item)

            items_to_copy: list[Item] = []

            def collect(curr: Item):
                items_to_copy.append(curr)
                for child in children_map.get(curr.id, []):
                    collect(child)

            collect(root_item)

            # Id mapping: source_id -> target_id
            id_map: dict[str, str] = {}
            for item in items_to_copy:
                id_map[item.id] = str(uuid.uuid4())

            # Copy items and files
            for item in items_to_copy:
                new_file_path = item.file_path

                # Copy local physical file to target collection's storage directory
                if item.file_path and os.path.exists(item.file_path):
                    src_path = Path(item.file_path)
                    new_filename = f"{uuid.uuid4()}{src_path.suffix}"
                    dest_path = target_files_dir / new_filename
                    try:
                        shutil.copy2(src_path, dest_path)
                        new_file_path = str(dest_path)
                    except Exception as err:
                        print(f"Failed to copy file {src_path} for deep copy: {err}")

                new_parent_id = id_map.get(item.parent_item_id) if item.parent_item_id else None
                if item.id == root_item.id:
                    new_parent_id = None  # Copied root is top-level in target collection

                new_item = Item(
                    id=id_map[item.id],
                    title=item.title,
                    type=item.type,
                    file_path=new_file_path,
                    source_url=item.source_url,
                    summary=item.summary,
                    progress=item.progress,
                    graph_x=item.graph_x,
                    graph_y=item.graph_y,
                    parent_item_id=new_parent_id,
                )
                target_session.add(new_item)

            target_session.flush()

            # Copy Bookmarks
            source_item_ids = set(id_map.keys())
            bookmarks = source_session.query(Bookmark).filter(Bookmark.item_id.in_(source_item_ids)).all()
            for bm in bookmarks:
                new_bm = Bookmark(
                    id=str(uuid.uuid4()),
                    item_id=id_map[bm.item_id],
                    page=bm.page,
                    chapter=bm.chapter,
                    quote=bm.quote,
                    note=bm.note,
                    spawned_item_id=id_map.get(bm.spawned_item_id) if bm.spawned_item_id else None,
                )
                target_session.add(new_bm)

            # Copy Edges between copied items
            edges = source_session.query(ItemEdge).filter(
                ItemEdge.source_item_id.in_(source_item_ids),
                ItemEdge.target_item_id.in_(source_item_ids)
            ).all()
            for edge in edges:
                new_edge = ItemEdge(
                    id=str(uuid.uuid4()),
                    source_item_id=id_map[edge.source_item_id],
                    target_item_id=id_map[edge.target_item_id],
                    relationship=edge.relationship,
                )
                target_session.add(new_edge)

            target_session.commit()
            return {
                "copied_count": len(items_to_copy),
                "target_root_id": id_map[root_item.id],
                "target_collection": target_collection_name,
            }
        except Exception as e:
            target_session.rollback()
            raise e
        finally:
            source_session.close()
            target_session.close()
            target_eng.dispose()


collection_service = CollectionService()
