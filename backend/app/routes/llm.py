import json
import os
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Bookmark, Item
from app.schemas.item import ItemRead
from app.services.db_helpers import get_or_404
from app.services.llm_service import get_llm_provider
from app.services.notebooklm_service import notebooklm_service

router = APIRouter(prefix="/llm", tags=["llm"])


def extract_item_content(item: Item, max_pages: int = 15) -> tuple[str, str]:
    """
    Extracts text content from local PDF, remote PDF/URL, item summary, or title.
    Returns (extracted_text, source_reference).
    """
    url_or_path = item.file_path or item.source_url or ""
    source_ref = url_or_path if url_or_path else f"Item '{item.title}'"

    # 1. Local file path check
    if url_or_path and not (url_or_path.startswith("http://") or url_or_path.startswith("https://")):
        path = Path(url_or_path)
        if not (path.exists() and path.is_file()):
            try:
                from app.services.collection_service import collection_service
                alt = collection_service.get_active_files_dir() / path.name
                if alt.exists() and alt.is_file():
                    path = alt
            except Exception:
                pass
        if path.exists() and path.is_file():
            try:
                import fitz
                doc = fitz.open(str(path))
                chunks = []
                for page_num in range(min(len(doc), max_pages)):
                    text = doc.load_page(page_num).get_text()
                    if text and text.strip():
                        chunks.append(text.strip())
                if chunks:
                    return "\n\n".join(chunks), source_ref
            except Exception as e:
                print(f"Error reading local PDF {path}: {e}")

    # 2. Remote URL (http:// or https://)
    if url_or_path and (url_or_path.startswith("http://") or url_or_path.startswith("https://")):
        target_url = url_or_path
        if "arxiv.org/abs/" in target_url:
            target_url = target_url.replace("arxiv.org/abs/", "arxiv.org/pdf/")
        if "arxiv.org/pdf/" in target_url and not target_url.endswith(".pdf"):
            target_url += ".pdf"
        
        try:
            import ssl
            import urllib.request
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(
                target_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            )
            with urllib.request.urlopen(req, context=ctx, timeout=25) as resp:
                content = resp.read()
                try:
                    import fitz
                    doc = fitz.open(stream=content, filetype="pdf")
                    chunks = []
                    for page_num in range(min(len(doc), max_pages)):
                        text = doc.load_page(page_num).get_text()
                        if text and text.strip():
                            chunks.append(text.strip())
                    if chunks:
                        return "\n\n".join(chunks), target_url
                except Exception:
                    import re
                    text_content = content.decode("utf-8", errors="ignore")
                    text_cleaned = re.sub(r'<script.*?>.*?</script>', '', text_content, flags=re.DOTALL)
                    text_cleaned = re.sub(r'<style.*?>.*?</style>', '', text_cleaned, flags=re.DOTALL)
                    text_cleaned = re.sub(r'<[^>]+>', ' ', text_cleaned)
                    text_cleaned = re.sub(r'\s+', ' ', text_cleaned).strip()
                    if text_cleaned:
                        return text_cleaned[:12000], target_url
        except Exception as e:
            print(f"Error fetching remote resource {target_url}: {e}")

    fallback_text = item.summary or item.title
    return fallback_text, source_ref


def bg_generate_llm_summary(item_id: str, prompt: str, context: str | None):
    db = SessionLocal()
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            return
        
        llm = get_llm_provider()
        try:
            summary_text = llm.chat(prompt)
            payload = {
                "__ai_summary__": True,
                "status": "done",
                "prompt": prompt,
                "context": context,
                "result": summary_text,
                "error": None,
            }
        except Exception as err:
            payload = {
                "__ai_summary__": True,
                "status": "error",
                "prompt": prompt,
                "context": context,
                "result": "",
                "error": str(err),
            }
        item.summary = json.dumps(payload)
        db.commit()
    except Exception as e:
        print(f"Background LLM generation failed for item {item_id}: {e}")
        db.rollback()
    finally:
        db.close()


class SummarizeRequest(BaseModel):
    text: str
    context: str | None = None


class SpawnSummaryRequest(BaseModel):
    parent_item_id: str
    selected_text: str | None = None
    page: int | None = None
    custom_title: str | None = None


class RegenerateSummaryRequest(BaseModel):
    item_id: str
    prompt: str
    context: str | None = None


class AcceptSummaryRequest(BaseModel):
    item_id: str


class CreateNotebookRequest(BaseModel):
    title: str
    parent_item_id: str | None = None
    initial_text: str | None = None
    page: int | None = None


class LinkOrCreateNotebookRequest(BaseModel):
    item_id: str
    action: str  # "create_new" | "attach_existing"
    notebook_id: str | None = None
    custom_title: str | None = None


class NotebookChatRequest(BaseModel):
    item_id: str
    message: str


class AddNotebookResourceRequest(BaseModel):
    notebook_id: str
    title: str
    content: str


@router.post("/summarize")
def summarize_text(req: SummarizeRequest):
    llm = get_llm_provider()
    summary = llm.summarize(req.text, req.context)
    return {"summary": summary}


@router.post("/spawn-summary", response_model=ItemRead)
def spawn_llm_summary(req: SpawnSummaryRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    parent = get_or_404(db, Item, req.parent_item_id)

    if req.selected_text and req.selected_text.strip():
        extracted_text = req.selected_text.strip()
        source_ref = f"selected text from '{parent.title}'"
    else:
        extracted_text, source_ref = extract_item_content(parent)

    prompt_str = (
        f"Please provide a concise, high-quality, structured summary of the following article/content "
        f"from '{parent.title}' ({source_ref}):\n\n"
        f"{extracted_text}"
    )

    context_str = f"Source item: {parent.title}"

    initial_payload = {
        "__ai_summary__": True,
        "status": "pending",
        "prompt": prompt_str,
        "context": context_str,
        "result": "",
        "error": None,
    }

    title = req.custom_title or f"Summary: {parent.title[:40]}"

    child_item = Item(
        title=title,
        type="note",
        summary=json.dumps(initial_payload),
        parent_item_id=parent.id,
        source_url=None,
        file_path=None,
    )
    db.add(child_item)
    db.flush()

    parent_bookmark = Bookmark(
        item_id=parent.id,
        page=req.page,
        quote=req.selected_text or f"Summary of {parent.title}",
        note=f"LLM Summary: {child_item.title}",
        spawned_item_id=child_item.id,
    )
    db.add(parent_bookmark)

    child_cross_bookmark = Bookmark(
        item_id=child_item.id,
        page=req.page,
        quote=f"Source item: {parent.title}",
        note=f"Spawned from parent item {parent.id}",
        spawned_item_id=parent.id,
    )
    db.add(child_cross_bookmark)

    db.commit()
    db.refresh(child_item)

    background_tasks.add_task(bg_generate_llm_summary, child_item.id, prompt_str, context_str)
    return child_item


@router.post("/regenerate", response_model=ItemRead)
def regenerate_summary(req: RegenerateSummaryRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, req.item_id)
    
    payload = {
        "__ai_summary__": True,
        "status": "pending",
        "prompt": req.prompt,
        "context": req.context,
        "result": "",
        "error": None,
    }
    item.summary = json.dumps(payload)
    db.commit()
    db.refresh(item)

    background_tasks.add_task(bg_generate_llm_summary, item.id, req.prompt, req.context)
    return item


@router.post("/accept-summary", response_model=ItemRead)
def accept_summary(req: AcceptSummaryRequest, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, req.item_id)
    if not item.summary:
        return item

    try:
        data = json.loads(item.summary)
        if isinstance(data, dict) and data.get("__ai_summary__"):
            item.summary = data.get("result", "")
    except Exception:
        pass

    db.commit()
    db.refresh(item)
    return item


@router.post("/notebooks/create", response_model=ItemRead)
def create_notebook_item(req: CreateNotebookRequest, db: Session = Depends(get_db)):
    parent_item = None
    if req.parent_item_id:
        parent_item = db.query(Item).filter(Item.id == req.parent_item_id).first()

    initial_payload = {
        "notebook_id": None,
        "status": "unlinked",
        "chat_history": [],
        "initial_text": req.initial_text,
    }

    item = Item(
        title=req.title,
        type="notebook",
        summary=json.dumps(initial_payload),
        source_url=None,
        parent_item_id=req.parent_item_id,
    )
    db.add(item)
    db.flush()

    if parent_item:
        parent_bookmark = Bookmark(
            item_id=parent_item.id,
            page=req.page,
            quote=req.initial_text or f"NotebookLM: {req.title}",
            note=f"NotebookLM Instance: {item.title}",
            spawned_item_id=item.id,
        )
        db.add(parent_bookmark)

        child_cross_bookmark = Bookmark(
            item_id=item.id,
            page=req.page,
            quote=f"Source item: {parent_item.title}",
            note=f"Spawned from parent item {parent_item.id}",
            spawned_item_id=parent_item.id,
        )
        db.add(child_cross_bookmark)

    db.commit()
    db.refresh(item)
    return item


@router.get("/notebooks/list")
def list_categorized_notebooks(db: Session = Depends(get_db)):
    return notebooklm_service.get_categorized_notebooks(db)


@router.post("/notebooks/link-or-create", response_model=ItemRead)
def link_or_create_notebook(req: LinkOrCreateNotebookRequest, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, req.item_id)
    
    # Parse existing summary JSON payload if present
    summary_data = {}
    if item.summary:
        try:
            summary_data = json.loads(item.summary)
        except Exception:
            summary_data = {}

    parent_item = item.parent if item.parent_item_id else None
    notes = []

    if req.action == "create_new":
        target_title = req.custom_title or item.title
        nb_data = notebooklm_service.create_notebook(title=target_title, db=db)
        notebook_id = nb_data["notebook_id"]
        notebook_url = nb_data["url"]
        if nb_data.get("notes"):
            notes.append(nb_data["notes"])
    else:
        if not req.notebook_id:
            raise HTTPException(status_code=400, detail="notebook_id required for attach_existing action")
        notebook_id = req.notebook_id
        notebook_url = f"https://notebooklm.google.com/notebook/{notebook_id}"

    # Ingest father resource into notebook if parent item exists
    if parent_item:
        res_info = notebooklm_service.add_parent_resource(notebook_id, parent_item)
        if res_info.get("status") == "added":
            notes.append(f"Successfully loaded parent resource '{parent_item.title}' into notebook.")

    # Ingest initial_text if stored in item's summary
    initial_text = summary_data.get("initial_text")
    if initial_text and initial_text.strip():
        notebooklm_service.add_resource(
            notebook_id=notebook_id,
            title="Selection Snippet",
            content=initial_text.strip(),
            resource_type="text"
        )

    summary_data["notebook_id"] = notebook_id
    summary_data["notebook_url"] = notebook_url
    summary_data["status"] = "ready"
    if notes:
        summary_data["notes"] = "\n".join(notes)

    item.source_url = notebook_url
    item.summary = json.dumps(summary_data)
    db.commit()
    db.refresh(item)
    return item


@router.get("/notebooks/{item_id}/history")
def get_notebook_history(item_id: str, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, item_id)

    summary_data = {}
    if item.summary:
        try:
            summary_data = json.loads(item.summary)
        except Exception:
            summary_data = {}

    notebook_id = summary_data.get("notebook_id")
    if not notebook_id and item.source_url and "/notebook/" in item.source_url:
        notebook_id = item.source_url.split("/notebook/")[1]

    # Try downloading latest active chat state directly from Google NotebookLM CLI
    if notebook_id:
        cloud_messages = notebooklm_service.get_cloud_history(notebook_id)
        if cloud_messages:
            summary_data["chat_history"] = cloud_messages
            item.summary = json.dumps(summary_data)
            db.commit()
            return {"history": cloud_messages, "source": "cloud"}

    # Fallback to locally saved history
    local_history = summary_data.get("chat_history", [])
    return {"history": local_history, "source": "local"}


@router.post("/notebooks/chat")
def chat_notebook(req: NotebookChatRequest, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, req.item_id)
    
    summary_data = {}
    if item.summary:
        try:
            summary_data = json.loads(item.summary)
        except Exception:
            summary_data = {}

    notebook_id = summary_data.get("notebook_id")
    if not notebook_id and item.source_url:
        notebook_id = item.source_url.split("/notebook/")[1] if "/notebook/" in item.source_url else item.source_url

    if not notebook_id:
        raise HTTPException(status_code=400, detail="Item is not linked to a NotebookLM notebook instance yet.")

    history = summary_data.get("chat_history", [])
    history.append({"sender": "user", "text": req.message})

    reply = notebooklm_service.chat(notebook_id, req.message)
    history.append({"sender": "notebooklm", "text": reply})

    summary_data["chat_history"] = history
    item.summary = json.dumps(summary_data)
    db.commit()

    return {"reply": reply, "history": history}


@router.get("/notebooks/{item_id}/sources")
def get_notebook_sources(item_id: str, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, item_id)

    summary_data = {}
    if item.summary:
        try:
            summary_data = json.loads(item.summary)
        except Exception:
            summary_data = {}

    notebook_id = summary_data.get("notebook_id")
    if not notebook_id and item.source_url and "/notebook/" in item.source_url:
        notebook_id = item.source_url.split("/notebook/")[1]

    if not notebook_id:
        return {"notebook_id": None, "sources": []}

    sources = notebooklm_service.list_notebook_sources(notebook_id)
    return {"notebook_id": notebook_id, "sources": sources}


@router.post("/notebooks/add-resource")
def add_notebook_resource(req: AddNotebookResourceRequest):
    res = notebooklm_service.add_resource(req.notebook_id, req.title, req.content)
    return res


