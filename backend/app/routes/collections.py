from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.models.collection import (
    CollectionCreateRequest,
    CollectionSwitchRequest,
    CopySubtreeRequest,
)
from app.services.collection_service import collection_service

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("")
def list_collections():
    return {
        "active": collection_service.get_active_collection_name(),
        "collections": collection_service.list_collections(),
    }


@router.post("/create")
def create_collection(req: CollectionCreateRequest):
    try:
        res = collection_service.create_collection(req.name)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/switch")
def switch_collection(req: CollectionSwitchRequest):
    try:
        res = collection_service.switch_collection(req.name)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/{name}")
def export_collection(name: str):
    try:
        zip_path = collection_service.export_collection(name)
        return FileResponse(
            str(zip_path),
            media_type="application/zip",
            filename=f"{name}_export.rtree",
            headers={"Content-Disposition": f"attachment; filename={name}_export.rtree"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_collection(file: UploadFile = File(...)):
    try:
        temp_dest = Path.home() / "ResearchTree" / f"import_{file.filename}"
        with open(temp_dest, "wb") as f:
            f.write(await file.read())

        target_name = collection_service.import_collection_bundle(temp_dest)
        if temp_dest.exists():
            temp_dest.unlink()

        return {
            "status": "imported",
            "name": target_name,
            "message": f"Successfully imported collection bundle as '{target_name}'",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import bundle: {e}")


@router.post("/copy-subtree")
def copy_subtree(req: CopySubtreeRequest):
    try:
        res = collection_service.deep_copy_subtree(req.item_id, req.target_collection)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
