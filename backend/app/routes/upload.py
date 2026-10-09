import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File

from app.services.collection_service import collection_service

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    storage = collection_service.get_active_files_dir()
    storage.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "file").suffix
    name = f"{uuid.uuid4()}{ext}"
    dest = storage / name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"file_path": str(dest)}
