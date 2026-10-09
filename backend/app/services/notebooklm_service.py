import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.models.notebook import AppCreatedNotebook


def get_notebooklm_cli_path() -> str:
    venv_dir = Path(sys.executable).parent
    cli_exe = venv_dir / ("notebooklm.exe" if sys.platform == "win32" else "notebooklm")
    if cli_exe.exists():
        return str(cli_exe)
    return "notebooklm"


class NotebookLMService:
    """
    Modular NotebookLM Integration Service.
    Interfaces with notebooklm-py CLI and SDK to create cloud NotebookLM notebooks and attach resources.
    """

    def list_cloud_notebooks(self) -> List[Dict[str, Any]]:
        cli = get_notebooklm_cli_path()
        try:
            cmd = [cli, "list", "--json"]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                return data.get("notebooks", [])
        except Exception as e:
            print(f"Failed to list cloud notebooks via CLI: {e}")
        return []

    def get_categorized_notebooks(self, db: Session) -> Dict[str, List[Dict[str, Any]]]:
        cloud_notebooks = self.list_cloud_notebooks()
        
        # Get set of all notebook IDs created by ResearchTree
        app_nb_ids = {
            nb.notebook_id for nb in db.query(AppCreatedNotebook.notebook_id).all()
        }

        app_created = []
        other_account = []

        for nb in cloud_notebooks:
            nb_id = nb.get("id")
            nb_data = {
                "id": nb_id,
                "title": nb.get("title") or "(Untitled Notebook)",
                "created_at": nb.get("created_at"),
                "modified_at": nb.get("modified_at"),
                "url": f"https://notebooklm.google.com/notebook/{nb_id}",
            }
            if nb_id in app_nb_ids:
                app_created.append(nb_data)
            else:
                other_account.append(nb_data)

        return {
            "app_created": app_created,
            "other_account": other_account,
        }

    def create_notebook(self, title: str, db: Session) -> Dict[str, Any]:
        cli = get_notebooklm_cli_path()
        notebook_id = None
        notebook_url = None
        status = "ready"
        notes = []

        try:
            cmd = [cli, "create", title, "--json"]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                nb_info = data.get("notebook", {})
                notebook_id = nb_info.get("id")
                if notebook_id:
                    notebook_url = f"https://notebooklm.google.com/notebook/{notebook_id}"
                    notes.append(f"Successfully created cloud notebook '{title}'")
                    
                    # Record in DB tracking table for app-created notebooks
                    try:
                        record = AppCreatedNotebook(notebook_id=notebook_id, title=title)
                        db.add(record)
                        db.commit()
                    except Exception as err:
                        print(f"Failed to record AppCreatedNotebook: {err}")
            else:
                notes.append(f"CLI create returned code {res.returncode}: {res.stderr.strip()}")
        except Exception as e:
            notes.append(f"Failed to execute notebooklm CLI create: {e}")

        if not notebook_id:
            notebook_id = f"nb-{uuid.uuid4().hex[:8]}"
            notebook_url = f"https://notebooklm.google.com/notebook/{notebook_id}"
            status = "fallback"

        return {
            "notebook_id": notebook_id,
            "title": title,
            "url": notebook_url,
            "status": status,
            "notes": "\n".join(notes),
        }

    def add_parent_resource(self, notebook_id: str, parent_item: Any) -> Dict[str, Any]:
        cli = get_notebooklm_cli_path()
        parent_title = getattr(parent_item, "title", "Parent Resource")
        file_path = getattr(parent_item, "file_path", None)
        source_url = getattr(parent_item, "source_url", None)

        # Case A: Parent item has a local file on disk
        if file_path and not (file_path.startswith("http://") or file_path.startswith("https://")):
            if os.path.exists(file_path):
                try:
                    cmd = [cli, "source", "add", "-n", notebook_id, "--type", "file", file_path, "--title", parent_title, "--json"]
                    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
                    if res.returncode == 0:
                        return {"status": "added", "title": parent_title, "type": "file"}
                except Exception as e:
                    print(f"Error adding file source to notebook {notebook_id}: {e}")

        # Case B: Parent item has a remote HTTP/HTTPS URL
        if source_url and (source_url.startswith("http://") or source_url.startswith("https://")):
            target_url = source_url
            if "arxiv.org/abs/" in target_url:
                target_url = target_url.replace("arxiv.org/abs/", "arxiv.org/pdf/")
            if "arxiv.org/pdf/" in target_url and not target_url.endswith(".pdf"):
                target_url += ".pdf"
            try:
                cmd = [cli, "source", "add", "-n", notebook_id, "--type", "url", target_url, "--json"]
                res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
                if res.returncode == 0:
                    return {"status": "added", "title": parent_title, "type": "url"}
            except Exception as e:
                print(f"Error adding URL source to notebook {notebook_id}: {e}")

        # Case C: Fallback to extracted text from parent item
        try:
            from app.routes.llm import extract_item_content
            extracted_text, _ = extract_item_content(parent_item)
            if extracted_text and extracted_text.strip():
                return self.add_resource(
                    notebook_id=notebook_id,
                    title=f"Source: {parent_title}",
                    content=extracted_text.strip(),
                    resource_type="text"
                )
        except Exception as e:
            print(f"Error extracting parent content for notebook {notebook_id}: {e}")

        return {"status": "skipped"}

    def add_resource(
        self,
        notebook_id: str,
        title: str,
        content: str,
        resource_type: str = "text"
    ) -> Dict[str, Any]:
        cli = get_notebooklm_cli_path()
        try:
            cmd = [cli, "source", "add", "-n", notebook_id, "--type", resource_type, content, "--title", title, "--json"]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
            if res.returncode == 0:
                return {"status": "added", "title": title}
            else:
                return {"status": "error", "title": title, "stderr": res.stderr}
        except Exception as e:
            return {"status": "error", "title": title, "note": str(e)}

    def list_notebook_sources(self, notebook_id: str) -> List[Dict[str, Any]]:
        cli = get_notebooklm_cli_path()
        try:
            cmd = [cli, "source", "list", "-n", notebook_id, "--json"]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                return data.get("sources", [])
        except Exception as e:
            print(f"Failed to list notebook sources via CLI: {e}")
        return []

    def get_cloud_history(self, notebook_id: str) -> List[Dict[str, str]]:
        cli = get_notebooklm_cli_path()
        try:
            cmd = [cli, "history", "-n", notebook_id, "--show-all", "--json"]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                qa_pairs = data.get("qa_pairs", [])
                messages = []
                for qa in qa_pairs:
                    q = qa.get("question")
                    a = qa.get("answer")
                    if q:
                        messages.append({"sender": "user", "text": q})
                    if a:
                        messages.append({"sender": "notebooklm", "text": a})
                return messages
        except Exception as e:
            print(f"Failed to fetch notebook history via CLI: {e}")
        return []

    def chat(self, notebook_id: str, message: str) -> str:
        cli = get_notebooklm_cli_path()
        try:
            cmd = [cli, "ask", "-n", notebook_id, message]
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
            if res.stderr.strip():
                return f"[NotebookLM Output: {res.stderr.strip()}]"
        except Exception as e:
            print(f"NotebookLM CLI ask failed: {e}")

        # Fallback using LLM provider
        try:
            from app.services.llm_service import get_llm_provider
            llm = get_llm_provider()
            return llm.chat(message, system_prompt=f"You are NotebookLM assistant for notebook {notebook_id}.")
        except Exception as err:
            return f"[NotebookLM Error: {err}]"


notebooklm_service = NotebookLMService()
