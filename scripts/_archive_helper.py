import os
import sys
import shutil
import sqlite3
import zipfile
import uuid
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

def main():
    root = Path(__file__).parent.parent.resolve()
    backend_dir = root / "backend"
    collections_dir = backend_dir / "collections"
    collections_archive = backend_dir / "collections_archive"
    db_legacy = backend_dir / "research_tree.db"
    db_legacy_archive = backend_dir / "research_tree_archive.db"
    user_home_collections = Path.home() / "ResearchTree" / "collections"

    bundle_dir = root / "ResearchTree_Bundle"
    zip_path = root / "ResearchTree_archive.zip"
    bundle_zip_path = bundle_dir / "ResearchTree_archive.zip"

    print("==================================================")
    print(" ResearchTree - Archive Code and Local Files      ")
    print("==================================================")
    print(f"Root Directory: {root}\n")

    # --------------------------------------------------------------------------
    # STAGE 1: Duplicate collections and database to temporary staging
    # --------------------------------------------------------------------------
    print("[STAGE 1/4] Duplicating collections and database to staging...")
    
    # Ensure missing schema columns are added first
    if user_home_collections.exists():
        for p in user_home_collections.iterdir():
            if p.is_dir():
                ensure_db_schema_columns(p / "research_tree.db")
    if collections_dir.exists():
        for p in collections_dir.iterdir():
            if p.is_dir():
                ensure_db_schema_columns(p / "research_tree.db")
    ensure_db_schema_columns(db_legacy)

    if collections_archive.exists():
        shutil.rmtree(collections_archive)
    collections_archive.mkdir(parents=True, exist_ok=True)

    # 1. Copy user home collections (~/ResearchTree/collections/)
    if user_home_collections.exists():
        for p in user_home_collections.iterdir():
            if p.is_dir():
                dest = collections_archive / p.name
                shutil.copytree(p, dest)
                print(f"  -> Duplicated home collection '{p.name}' -> 'backend/collections_archive/{p.name}'")

    # 2. Copy backend collections if not already copied
    if collections_dir.exists():
        for p in collections_dir.iterdir():
            if p.is_dir() and not (collections_archive / p.name).exists():
                shutil.copytree(p, collections_archive / p.name)
                print(f"  -> Duplicated backend collection '{p.name}' -> 'backend/collections_archive/{p.name}'")

    if db_legacy.exists() and not (collections_archive / "Default").exists():
        if db_legacy_archive.exists():
            os.remove(db_legacy_archive)
        shutil.copy2(db_legacy, db_legacy_archive)
        print("  -> Duplicated 'backend/research_tree.db' -> 'backend/research_tree_archive.db'")

    # --------------------------------------------------------------------------
    # STAGE 2: Verify local files outside storage & copy into collections_archive
    # --------------------------------------------------------------------------
    print("\n[STAGE 2/4] Verifying and copying local files into archive storage...")

    def process_db(db_path: Path, files_dir: Path, col_name: str):
        if not db_path.exists():
            return
        files_dir.mkdir(parents=True, exist_ok=True)
        user_home_files = user_home_collections / col_name / "files"
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        copied_count = 0
        updated_count = 0
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='items'")
            if not cursor.fetchone():
                return

            cursor.execute("SELECT id, title, file_path FROM items WHERE file_path IS NOT NULL AND file_path != ''")
            rows = cursor.fetchall()
            for item_id, title, file_path in rows:
                if file_path.startswith("http://") or file_path.startswith("https://"):
                    continue
                
                src = Path(file_path)
                if not src.is_absolute():
                    full_src = root / file_path
                    if full_src.exists() and full_src.is_file():
                        src = full_src

                if not (src.exists() and src.is_file()):
                    target_name = src.name
                    parts = target_name.split("_", 1)
                    target_suffix = parts[1] if (len(parts) > 1 and len(parts[0]) == 8) else target_name

                    found = None
                    search_dirs = [files_dir, user_home_files, root / "backend" / "collections" / col_name / "files"]
                    for search_dir in search_dirs:
                        if search_dir and search_dir.exists():
                            candidate = search_dir / target_name
                            if candidate.exists() and candidate.is_file():
                                found = candidate
                                break
                            candidate_s = search_dir / target_suffix
                            if candidate_s.exists() and candidate_s.is_file():
                                found = candidate_s
                                break
                            for f in search_dir.iterdir():
                                if f.is_file() and (f.name == target_suffix or f.name.endswith(f"_{target_suffix}")):
                                    found = f
                                    break
                            if found:
                                break
                    if found:
                        src = found

                if src.exists() and src.is_file():
                    try:
                        src.relative_to(files_dir)
                        already_inside = True
                    except ValueError:
                        already_inside = False

                    if not already_inside:
                        safe_name = src.name
                        parts = safe_name.split("_", 1)
                        if not (len(parts) > 1 and len(parts[0]) == 8):
                            safe_name = f"{uuid.uuid4().hex[:8]}_{src.name}"

                        dest = files_dir / safe_name
                        if src != dest:
                            shutil.copy2(src, dest)
                            copied_count += 1

                        new_path = f"backend/collections/{col_name}/files/{safe_name}"
                        cursor.execute("UPDATE items SET file_path = ? WHERE id = ?", (new_path, item_id))
                        updated_count += 1
                        print(f"  [Copied File] '{title}' -> {new_path}")
                    else:
                        rel_in_files = src.name
                        new_path = f"backend/collections/{col_name}/files/{rel_in_files}"
                        if file_path != new_path:
                            cursor.execute("UPDATE items SET file_path = ? WHERE id = ?", (new_path, item_id))
                            updated_count += 1
                else:
                    print(f"  [Warning] Local file path not found on disk: '{file_path}' (Item: {title})")
            conn.commit()
        finally:
            conn.close()

    if collections_archive.exists():
        for item in collections_archive.iterdir():
            if item.is_dir():
                col_db = item / "research_tree.db"
                col_files = item / "files"
                process_db(col_db, col_files, item.name)

    if db_legacy_archive.exists():
        default_files = collections_archive / "Default" / "files"
        process_db(db_legacy_archive, default_files, "Default")

    # --------------------------------------------------------------------------
    # STAGE 3: Create Bundle folder & zip archive
    # --------------------------------------------------------------------------
    print("\n[STAGE 3/4] Creating Bundle folder and zip archive...")
    if zip_path.exists():
        os.remove(zip_path)

    exclude_dir_names = {".venv", "node_modules", ".git", ".idea", "__pycache__", "ResearchTree_Bundle", "collections"}
    exclude_files = {db_legacy, zip_path}

    count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for current_root, dirs, files in os.walk(root):
            current_path = Path(current_root)

            dirs[:] = [
                d for d in dirs
                if d not in exclude_dir_names
                and not (current_path / d == collections_dir)
                and not (current_path / d == bundle_dir)
            ]

            for file in files:
                file_p = current_path / file

                if file_p == db_legacy or file_p == zip_path or file.endswith(".zip"):
                    continue

                arcname = file_p.relative_to(root)
                zf.write(file_p, arcname)
                count += 1

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"  -> Successfully archived {count} files ({size_mb:.2f} MB)")

    # Prepare bundle folder
    if bundle_dir.exists():
        shutil.rmtree(bundle_dir)
    bundle_dir.mkdir(parents=True, exist_ok=True)

    # Copy zip archive into bundle folder
    shutil.copy2(zip_path, bundle_zip_path)

    # Copy extract/setup script and helper into bundle folder
    setup_ps1 = root / "scripts" / "setup_archived_code_and_files.ps1"
    setup_py = root / "scripts" / "_setup_helper.py"
    if setup_ps1.exists():
        shutil.copy2(setup_ps1, bundle_dir / "setup_archived_code_and_files.ps1")
    if setup_py.exists():
        shutil.copy2(setup_py, bundle_dir / "_setup_helper.py")
    print("  -> Created 'ResearchTree_Bundle/' with zip file AND 'setup_archived_code_and_files.ps1'")

    # --------------------------------------------------------------------------
    # STAGE 4: Clean up temporary archive staging files
    # --------------------------------------------------------------------------
    print("\n[STAGE 4/4] Cleaning up temporary archive staging files...")
    if collections_archive.exists():
        shutil.rmtree(collections_archive)
        print("  -> Removed temporary 'backend/collections_archive'")

    if db_legacy_archive.exists():
        os.remove(db_legacy_archive)
        print("  -> Removed temporary 'backend/research_tree_archive.db'")

    print("\n==================================================")
    print(" Archive Completed Successfully!                  ")
    print(f" Bundle Directory: {bundle_dir}")
    print(" Contains: ResearchTree_archive.zip & setup_archived_code_and_files.ps1")
    print("==================================================")

if __name__ == "__main__":
    main()
