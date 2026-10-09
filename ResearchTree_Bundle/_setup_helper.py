import os
import sys
import shutil
import sqlite3
import zipfile
import uuid
import argparse
from pathlib import Path

def ensure_db_schema_columns(db_path: Path):
    if not db_path.exists():
        return
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='items'")
        if cursor.fetchone():
            existing_cols = {row[1] for row in cursor.execute("PRAGMA table_info(items)").fetchall()}
            for col, col_type in [
                ("graph_x", "FLOAT"),
                ("graph_y", "FLOAT"),
                ("opacity", "FLOAT DEFAULT 1.0"),
                ("is_archived", "BOOLEAN DEFAULT 0"),
                ("merged_into_id", "VARCHAR(36)"),
                ("flags", "TEXT DEFAULT '[]'"),
                ("is_local", "BOOLEAN DEFAULT 0"),
                ("is_resolved", "BOOLEAN DEFAULT 0"),
                ("blocker_reason", "TEXT"),
                ("resolution_note", "TEXT"),
                ("last_accessed_at", "DATETIME"),
            ]:
                if col not in existing_cols:
                    try:
                        cursor.execute(f"ALTER TABLE items ADD COLUMN {col} {col_type}")
                    except Exception:
                        pass
            conn.commit()
        conn.close()
    except Exception:
        pass

def merge_sqlite_databases(src_db: Path, dest_db: Path, src_files_dir: Path, dest_files_dir: Path, col_name: str, mode: str):
    """
    Intelligently merges src_db into dest_db with file copying and ID remapping.
    mode can be 'override', 'duplicate', or 'interactive'.
    """
    if not src_db.exists():
        return

    dest_files_dir.mkdir(parents=True, exist_ok=True)
    ensure_db_schema_columns(src_db)

    # --------------------------------------------------------------------------
    # CASE 1: Destination database does not exist or is empty -> Direct Copy
    # --------------------------------------------------------------------------
    if not dest_db.exists() or dest_db.stat().st_size == 0:
        dest_db.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_db, dest_db)
        if src_files_dir.exists():
            for f in src_files_dir.iterdir():
                if f.is_file():
                    shutil.copy2(f, dest_files_dir / f.name)
        print(f"  -> Created collection database and restored files for '{col_name}'")
        return

    ensure_db_schema_columns(dest_db)

    # --------------------------------------------------------------------------
    # CASE 2: Destination database exists -> Intelligent Merge
    # --------------------------------------------------------------------------
    src_conn = sqlite3.connect(src_db)
    dest_conn = sqlite3.connect(dest_db)
    
    src_curr = src_conn.cursor()
    dest_curr = dest_conn.cursor()

    try:
        # Check if items table exists in src_db
        src_curr.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='items'")
        if not src_curr.fetchone():
            return

        # Fetch all items from src_db
        src_curr.execute("SELECT * FROM items")
        columns = [description[0] for description in src_curr.description]
        src_items = src_curr.fetchall()

        id_map = {}  # old_id -> new_id
        sticky_action = None  # Remembers choices like OA, DA, SA for all remaining collisions

        for item_tuple in src_items:
            item_dict = dict(zip(columns, item_tuple))
            item_id = item_dict['id']
            title = item_dict['title']
            file_path = item_dict.get('file_path')

            # Find all colliding items in dest_db by ID or Title
            dest_curr.execute("SELECT id FROM items WHERE id = ? OR title = ?", (item_id, title))
            colliding_ids = [row[0] for row in dest_curr.fetchall()]
            collision = len(colliding_ids) > 0
            
            chosen_action = mode
            if collision:
                if sticky_action:
                    chosen_action = sticky_action
                elif mode == 'interactive':
                    print(f"\n[COLLISION DETECTED] Item '{title}' already exists in collection '{col_name}' at:\n  '{dest_db}'")
                    print("  (Note: ResearchTree stores user databases in your User profile folder, which persists from previous runs).")
                    choice = input("  Action? [O]verride / [D]uplicate / [S]kip / [OA] Override All / [DA] Duplicate All / [SA] Skip All (default: O): ").strip().upper()
                    if choice in ('OA', 'O ALL', 'OVERRIDE ALL'):
                        chosen_action = 'override'
                        sticky_action = 'override'
                    elif choice == 'O':
                        chosen_action = 'override'
                    elif choice in ('SA', 'S ALL', 'SKIP ALL'):
                        chosen_action = 'skip'
                        sticky_action = 'skip'
                    elif choice == 'S':
                        chosen_action = 'skip'
                    elif choice in ('DA', 'D ALL', 'DUPLICATE ALL'):
                        chosen_action = 'duplicate'
                        sticky_action = 'duplicate'
                    elif choice == 'D':
                        chosen_action = 'duplicate'
                    else:
                        chosen_action = 'override'

            if collision and chosen_action == 'skip':
                print(f"  [Skipped] '{title}'")
                continue

            new_file_path = file_path

            # Handle physical file copy
            if file_path and not (file_path.startswith("http://") or file_path.startswith("https://")):
                filename = Path(file_path).name
                src_file = src_files_dir / filename
                if src_file.exists():
                    dest_file = dest_files_dir / filename
                    if dest_file.exists() and chosen_action == 'duplicate':
                        safe_filename = f"{uuid.uuid4().hex[:8]}_{filename}"
                        dest_file = dest_files_dir / safe_filename
                        new_file_path = f"backend/collections/{col_name}/files/{safe_filename}"
                        shutil.copy2(src_file, dest_file)
                    else:
                        shutil.copy2(src_file, dest_file)
                        new_file_path = f"backend/collections/{col_name}/files/{filename}"

            if chosen_action == 'override' and collision:
                for cid in colliding_ids:
                    dest_curr.execute("DELETE FROM items WHERE id = ?", (cid,))
                    dest_curr.execute("DELETE FROM bookmarks WHERE item_id = ? OR spawned_item_id = ?", (cid, cid))
                    dest_curr.execute("DELETE FROM item_edges WHERE source_item_id = ? OR target_item_id = ?", (cid, cid))
                    dest_curr.execute("DELETE FROM item_tags WHERE item_id = ?", (cid,))

            new_id = item_id
            if collision and chosen_action == 'duplicate':
                new_id = str(uuid.uuid4())
                id_map[item_id] = new_id

            item_dict['id'] = new_id
            item_dict['file_path'] = new_file_path
            
            # Map parent_item_id if parent was duplicated
            if item_dict.get('parent_item_id') in id_map:
                item_dict['parent_item_id'] = id_map[item_dict['parent_item_id']]

            placeholders = ", ".join(["?"] * len(columns))
            col_names = ", ".join(columns)
            vals = [item_dict[c] for c in columns]
            dest_curr.execute(f"INSERT OR REPLACE INTO items ({col_names}) VALUES ({placeholders})", vals)
            status = "Overwritten" if (collision and chosen_action == 'override') else ("Duplicated" if (collision and chosen_action == 'duplicate') else "Merged")
            print(f"  [{status}] '{title}' -> ID: {new_id}")

        # ----------------------------------------------------------------------
        # Merge Bookmarks
        # ----------------------------------------------------------------------
        src_curr.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='bookmarks'")
        if src_curr.fetchone():
            src_curr.execute("SELECT * FROM bookmarks")
            bm_cols = [description[0] for description in src_curr.description]
            for bm_tuple in src_curr.fetchall():
                bm = dict(zip(bm_cols, bm_tuple))
                bm['id'] = str(uuid.uuid4())
                bm['item_id'] = id_map.get(bm['item_id'], bm['item_id'])
                if bm.get('spawned_item_id'):
                    bm['spawned_item_id'] = id_map.get(bm['spawned_item_id'], bm['spawned_item_id'])
                
                placeholders = ", ".join(["?"] * len(bm_cols))
                col_names = ", ".join(bm_cols)
                vals = [bm[c] for c in bm_cols]
                dest_curr.execute(f"INSERT OR REPLACE INTO bookmarks ({col_names}) VALUES ({placeholders})", vals)

        # ----------------------------------------------------------------------
        # Merge Item Edges
        # ----------------------------------------------------------------------
        src_curr.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='item_edges'")
        if src_curr.fetchone():
            src_curr.execute("SELECT * FROM item_edges")
            edge_cols = [description[0] for description in src_curr.description]
            for edge_tuple in src_curr.fetchall():
                edge = dict(zip(edge_cols, edge_tuple))
                edge['id'] = str(uuid.uuid4())
                edge['source_item_id'] = id_map.get(edge['source_item_id'], edge['source_item_id'])
                edge['target_item_id'] = id_map.get(edge['target_item_id'], edge['target_item_id'])
                
                placeholders = ", ".join(["?"] * len(edge_cols))
                col_names = ", ".join(edge_cols)
                vals = [edge[c] for c in edge_cols]
                dest_curr.execute(f"INSERT OR REPLACE INTO item_edges ({col_names}) VALUES ({placeholders})", vals)

        # ----------------------------------------------------------------------
        # Merge Tags and ItemTags
        # ----------------------------------------------------------------------
        src_curr.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'")
        if src_curr.fetchone():
            src_curr.execute("SELECT * FROM tags")
            tag_cols = [description[0] for description in src_curr.description]
            tag_name_map = {}  # src_tag_id -> dest_tag_id
            
            dest_curr.execute("SELECT id, name FROM tags")
            dest_tags_by_name = {row[1]: row[0] for row in dest_curr.fetchall()}

            for tag_tuple in src_curr.fetchall():
                t = dict(zip(tag_cols, tag_tuple))
                tag_name = t['name']
                if tag_name in dest_tags_by_name:
                    tag_name_map[t['id']] = dest_tags_by_name[tag_name]
                else:
                    new_tag_id = t['id']
                    placeholders = ", ".join(["?"] * len(tag_cols))
                    col_names = ", ".join(tag_cols)
                    vals = [t[c] for c in tag_cols]
                    dest_curr.execute(f"INSERT OR REPLACE INTO tags ({col_names}) VALUES ({placeholders})", vals)
                    dest_tags_by_name[tag_name] = new_tag_id
                    tag_name_map[t['id']] = new_tag_id

            src_curr.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='item_tags'")
            if src_curr.fetchone():
                src_curr.execute("SELECT item_id, tag_id FROM item_tags")
                for src_item_id, src_tag_id in src_curr.fetchall():
                    mapped_item_id = id_map.get(src_item_id, src_item_id)
                    mapped_tag_id = tag_name_map.get(src_tag_id, src_tag_id)
                    dest_curr.execute("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)", (mapped_item_id, mapped_tag_id))

        dest_conn.commit()
    finally:
        src_conn.close()
        dest_conn.close()

def main():
    parser = argparse.ArgumentParser(description="Restoration & Merging Helper for ResearchTree")
    parser.add_argument("--interactive", action="store_true", help="Prompt interactively on conflicts")
    parser.add_argument("--silent_override", action="store_true", help="Automatically override conflicting records")
    parser.add_argument("--silent_duplicate", action="store_true", help="Automatically duplicate conflicting records")
    args = parser.parse_args()

    mode = "override"
    if args.interactive:
        mode = "interactive"
    elif args.silent_duplicate:
        mode = "duplicate"

    current_dir = Path(__file__).parent.resolve()
    if current_dir.name == "ResearchTree_Bundle":
        parent = current_dir.parent
        if parent.name == "ResearchTree" or (parent / "backend").exists():
            root = parent
        else:
            root = parent / "ResearchTree"
    elif current_dir.name == "scripts":
        root = current_dir.parent
    else:
        root = current_dir

    root.mkdir(parents=True, exist_ok=True)
    backend_dir = root / "backend"
    collections_dir = backend_dir / "collections"
    collections_archive = backend_dir / "collections_archive"
    db_legacy = backend_dir / "research_tree.db"
    db_legacy_archive = backend_dir / "research_tree_archive.db"
    user_home_collections = Path.home() / "ResearchTree" / "collections"

    # Search for archive zip in current script folder first, then root folder
    candidate_zips = [
        current_dir / "ResearchTree_archive.zip",
        root / "ResearchTree_archive.zip",
        root / "ResearchTree_Bundle" / "ResearchTree_archive.zip"
    ]
    target_zip = next((z for z in candidate_zips if z.exists()), None)

    print("[STAGE 1/4] Extracting archive files...")
    if target_zip:
        with zipfile.ZipFile(target_zip, "r") as zf:
            zf.extractall(root)
        print(f"  -> Extracted '{target_zip}' into '{root}'")
    else:
        print("  -> 'ResearchTree_archive.zip' not found, proceeding with uncompressed staging files if present...")

    print(f"\n[STAGE 2/4] Merging collections and database from archive (Mode: {mode})...")

    processed_collections = set()

    # 1. Merge collections in collections_archive into BOTH user home collections AND backend/collections
    if collections_archive.exists():
        user_home_collections.mkdir(parents=True, exist_ok=True)
        collections_dir.mkdir(parents=True, exist_ok=True)

        for col_folder in collections_archive.iterdir():
            if col_folder.is_dir():
                src_col_db = col_folder / "research_tree.db"
                src_col_files = col_folder / "files"
                
                # Dest 1: User home collection dir (~/ResearchTree/collections/<col>/)
                dest_home_folder = user_home_collections / col_folder.name
                dest_home_db = dest_home_folder / "research_tree.db"
                dest_home_files = dest_home_folder / "files"

                # Dest 2: Backend root collection dir (backend/collections/<col>/)
                dest_backend_folder = collections_dir / col_folder.name
                dest_backend_db = dest_backend_folder / "research_tree.db"
                dest_backend_files = dest_backend_folder / "files"

                print(f" -> Processing collection '{col_folder.name}'...")
                merge_sqlite_databases(src_col_db, dest_home_db, src_col_files, dest_home_files, col_folder.name, mode)
                merge_sqlite_databases(src_col_db, dest_backend_db, src_col_files, dest_backend_files, col_folder.name, "override")
                processed_collections.add(col_folder.name)
        
        shutil.rmtree(collections_archive)
        print("  -> Merged 'backend/collections_archive' and cleaned staging folder")

    # 2. Merge legacy root DB if present (only if Default collection was not already restored above)
    if db_legacy_archive.exists():
        if "Default" in processed_collections:
            # Default collection was already processed from collections_archive.
            # Mirror the restored Default DB to backend/research_tree.db if needed.
            default_home_db = user_home_collections / "Default" / "research_tree.db"
            if default_home_db.exists():
                shutil.copy2(default_home_db, db_legacy)
        else:
            dest_default_files_home = user_home_collections / "Default" / "files"
            dest_default_files_backend = collections_dir / "Default" / "files"
            print(" -> Processing legacy root database...")
            merge_sqlite_databases(db_legacy_archive, user_home_collections / "Default" / "research_tree.db", dest_default_files_home, dest_default_files_home, "Default", mode)
            merge_sqlite_databases(db_legacy_archive, db_legacy, dest_default_files_backend, dest_default_files_backend, "Default", "override")
        
        if db_legacy_archive.exists():
            os.remove(db_legacy_archive)
        print("  -> Cleaned staging legacy database")

if __name__ == "__main__":
    main()
