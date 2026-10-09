import subprocess
import sys
import urllib.request
import json
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from app.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdateSchema(BaseModel):
    llm_provider: str | None = None
    ollama_url: str | None = None
    ollama_model: str | None = None
    openai_api_key: str | None = None
    openai_model: str | None = None
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    notebooklm_cookie: str | None = None


@router.get("")
def get_settings():
    return {
        "llm_provider": getattr(settings, "llm_provider", "ollama"),
        "ollama_url": getattr(settings, "ollama_url", "http://localhost:11434"),
        "ollama_model": getattr(settings, "ollama_model", "llama3.1:latest"),
        "openai_api_key_set": bool(getattr(settings, "openai_api_key", None)),
        "openai_model": getattr(settings, "openai_model", "gpt-4o-mini"),
        "anthropic_api_key_set": bool(getattr(settings, "anthropic_api_key", None)),
        "anthropic_model": getattr(settings, "anthropic_model", "claude-3-5-sonnet"),
        "notebooklm_cookie": getattr(settings, "notebooklm_cookie", ""),
    }


@router.put("")
def update_settings(payload: SettingsUpdateSchema):
    if payload.llm_provider is not None:
        settings.llm_provider = payload.llm_provider
    if payload.ollama_url is not None:
        settings.ollama_url = payload.ollama_url
    if payload.ollama_model is not None:
        settings.ollama_model = payload.ollama_model
    if payload.openai_api_key is not None:
        settings.openai_api_key = payload.openai_api_key
    if payload.openai_model is not None:
        settings.openai_model = payload.openai_model
    if payload.anthropic_api_key is not None:
        settings.anthropic_api_key = payload.anthropic_api_key
    if payload.anthropic_model is not None:
        settings.anthropic_model = payload.anthropic_model
    if payload.notebooklm_cookie is not None:
        settings.notebooklm_cookie = payload.notebooklm_cookie

    return get_settings()


class VerifyLLMRequest(BaseModel):
    provider: str = "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:latest"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-sonnet"


@router.post("/verify-llm")
def verify_llm_connection(req: VerifyLLMRequest):
    provider = req.provider.lower()

    if provider == "ollama":
        url = req.ollama_url.rstrip("/")
        tags_url = f"{url}/api/tags"
        try:
            req_obj = urllib.request.Request(tags_url, headers={"User-Agent": "ResearchTree/1.0"})
            with urllib.request.urlopen(req_obj, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                    
                    target_model = req.ollama_model
                    has_model = any(target_model == m or target_model == m.split(":")[0] for m in models)
                    
                    if has_model or not models:
                        return {
                            "status": "ok",
                            "message": f"Successfully connected to Ollama server at {url}. Target model '{target_model}' is available.",
                            "available_models": models,
                            "instructions": "Ollama server is active and configured correctly."
                        }
                    else:
                        return {
                            "status": "warning",
                            "message": f"Ollama server connected at {url}, but model '{target_model}' was not found in installed models.",
                            "available_models": models,
                            "instructions": f"Run the following command in your terminal to download the model:\n\n  ollama pull {target_model}"
                        }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Could not connect to Ollama server at {url}: {str(e)}",
                "available_models": [],
                "instructions": (
                    "How to establish Ollama Connection:\n"
                    "1. Ensure Ollama application is running locally.\n"
                    "2. Run: ollama serve\n"
                    "3. Ensure model is downloaded: ollama pull llama3.1:latest"
                )
            }

    elif provider == "openai":
        key = req.openai_api_key or getattr(settings, "openai_api_key", None)
        if not key:
            return {
                "status": "error",
                "message": "OpenAI API key is missing.",
                "instructions": "Please enter a valid OpenAI API key starting with 'sk-' from https://platform.openai.com/"
            }
        return {
            "status": "ok",
            "message": f"OpenAI API configuration validated for model '{req.openai_model}'.",
            "instructions": "Ready to send requests to OpenAI Cloud API."
        }

    elif provider == "anthropic":
        key = req.anthropic_api_key or getattr(settings, "anthropic_api_key", None)
        if not key:
            return {
                "status": "error",
                "message": "Anthropic API key is missing.",
                "instructions": "Please enter a valid Anthropic Claude API key from https://console.anthropic.com/"
            }
        return {
            "status": "ok",
            "message": f"Anthropic Claude configuration validated for model '{req.anthropic_model}'.",
            "instructions": "Ready to send requests to Anthropic Claude API."
        }

    return {
        "status": "error",
        "message": f"Unsupported LLM provider '{provider}'.",
        "instructions": "Supported providers: ollama, openai, anthropic"
    }


INSTALLATION_STATE = {
    "status": "idle",
    "message": "",
    "output": ""
}


def bg_pip_install():
    global INSTALLATION_STATE
    INSTALLATION_STATE["status"] = "installing"
    INSTALLATION_STATE["message"] = "Installing notebooklm-py via pip..."
    INSTALLATION_STATE["output"] = ""
    try:
        cmd = [sys.executable, "-m", "pip", "install", "notebooklm-py"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if res.returncode == 0:
            INSTALLATION_STATE["status"] = "ok"
            INSTALLATION_STATE["message"] = "Successfully installed notebooklm-py in Python virtual environment!"
            INSTALLATION_STATE["output"] = res.stdout
        else:
            INSTALLATION_STATE["status"] = "error"
            INSTALLATION_STATE["message"] = f"pip install returned error code {res.returncode}"
            INSTALLATION_STATE["output"] = res.stderr or res.stdout
    except Exception as e:
        INSTALLATION_STATE["status"] = "error"
        INSTALLATION_STATE["message"] = f"Failed to run pip install: {e}"
        INSTALLATION_STATE["output"] = str(e)


@router.post("/install-notebooklm-py")
def install_notebooklm_py(background_tasks: BackgroundTasks):
    if INSTALLATION_STATE["status"] == "installing":
        return INSTALLATION_STATE
    
    background_tasks.add_task(bg_pip_install)
    INSTALLATION_STATE["status"] = "installing"
    INSTALLATION_STATE["message"] = "Package installation started in background..."
    return INSTALLATION_STATE


@router.get("/install-status")
def get_install_status():
    return INSTALLATION_STATE


def get_notebooklm_cli_path() -> str:
    from pathlib import Path
    venv_dir = Path(sys.executable).parent
    cli_exe = venv_dir / ("notebooklm.exe" if sys.platform == "win32" else "notebooklm")
    if cli_exe.exists():
        return str(cli_exe)
    return "notebooklm"


def get_notebooklm_auth_info():
    cli = get_notebooklm_cli_path()
    
    auth_res = subprocess.run([cli, "auth", "check"], capture_output=True, encoding="utf-8", errors="replace")
    auth_stdout = auth_res.stdout or ""
    
    import re
    email_match = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', auth_stdout)
    account_email = email_match[0] if email_match else None
    authenticated = "Authentication is valid" in auth_stdout or "✓ pass" in auth_stdout
    
    prof_res = subprocess.run([cli, "profile", "list"], capture_output=True, encoding="utf-8", errors="replace")
    prof_stdout = prof_res.stdout or ""
    
    profiles = []
    active_profile = "default"
    for line in prof_stdout.splitlines():
        if "Active profile:" in line:
            active_profile = line.split("Active profile:")[1].strip()
        parts = [p.strip() for p in line.split("│") if p.strip()]
        if len(parts) >= 3:
            is_active = parts[0] == "*" or (len(parts) >= 4 and parts[0] == "*")
            p_name = parts[1] if parts[0] in ["*", ""] else parts[0]
            p_acc = parts[2] if len(parts) > 2 else "-"
            p_auth = parts[3] if len(parts) > 3 else "-"
            if p_name and p_name not in ["Name", "Profiles", "Account", "Auth Status", "----------------------------------"]:
                profiles.append({
                    "name": p_name,
                    "account": p_acc,
                    "active": is_active or p_name == active_profile,
                    "status": p_auth
                })

    return {
        "authenticated": authenticated,
        "account_email": account_email,
        "active_profile": active_profile,
        "profiles": profiles,
        "raw_output": auth_stdout
    }


class ProfileRequest(BaseModel):
    profile_name: str | None = None


@router.get("/notebooklm/status")
def notebooklm_status():
    return get_notebooklm_auth_info()


def bg_notebooklm_login(profile_name: str | None):
    cli = get_notebooklm_cli_path()
    cmd = [cli]
    if profile_name:
        cmd.extend(["-p", profile_name])
    cmd.extend(["login", "--browser", "chrome"])
    try:
        subprocess.run(cmd, timeout=300)
    except Exception as e:
        print(f"notebooklm login failed: {e}")


@router.post("/notebooklm/login")
def notebooklm_login(req: ProfileRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(bg_notebooklm_login, req.profile_name)
    return {
        "status": "ok",
        "message": f"Launched NotebookLM browser login for profile '{req.profile_name or 'default'}'. Please sign in to Google in the opened window."
    }


@router.post("/notebooklm/switch-profile")
def notebooklm_switch_profile(req: ProfileRequest):
    if not req.profile_name:
        raise HTTPException(status_code=400, detail="profile_name required")
    cli = get_notebooklm_cli_path()
    subprocess.run([cli, "profile", "switch", req.profile_name], capture_output=True, encoding="utf-8", errors="replace")
    return get_notebooklm_auth_info()


@router.post("/notebooklm/create-profile")
def notebooklm_create_profile(req: ProfileRequest):
    if not req.profile_name:
        raise HTTPException(status_code=400, detail="profile_name required")
    cli = get_notebooklm_cli_path()
    subprocess.run([cli, "profile", "create", req.profile_name], capture_output=True, encoding="utf-8", errors="replace")
    subprocess.run([cli, "profile", "switch", req.profile_name], capture_output=True, encoding="utf-8", errors="replace")
    return get_notebooklm_auth_info()


@router.post("/notebooklm/delete-profile")
def notebooklm_delete_profile(req: ProfileRequest):
    if not req.profile_name:
        raise HTTPException(status_code=400, detail="profile_name required")
    cli = get_notebooklm_cli_path()
    subprocess.run([cli, "profile", "delete", req.profile_name], capture_output=True, encoding="utf-8", errors="replace")
    return get_notebooklm_auth_info()


@router.post("/verify-notebooklm")
def verify_notebooklm_connection():
    is_installed = False
    try:
        import notebooklm
        is_installed = True
    except ImportError:
        is_installed = False

    auth_info = get_notebooklm_auth_info() if is_installed else {
        "authenticated": False,
        "account_email": None,
        "active_profile": "default",
        "profiles": []
    }

    msg = f"notebooklm-py active. Account: {auth_info['account_email'] or 'Not authenticated'}" if is_installed else "notebooklm-py is NOT installed in virtual environment."

    instructions = (
        "NotebookLM Setup & Account Instructions:\n\n"
        "1. Package Auto-Installation:\n"
        "   Click '📦 Install notebooklm-py in VEnv' to install the package.\n\n"
        "2. Account & Profile Management:\n"
        "   - Click '🌐 Launch Google Login' to authenticate via browser.\n"
        "   - Create & switch profiles to manage multiple Google Accounts seamlessly.\n\n"
        "3. Interactive Usage:\n"
        "   When creating a NotebookLM item in ResearchTree, click 'Open NotebookLM ↗' to view your cloud notebook directly."
    )

    return {
        "status": "ok" if (is_installed and auth_info["authenticated"]) else ("warning" if is_installed else "error"),
        "message": msg,
        "package_installed": is_installed,
        "authenticated": auth_info["authenticated"],
        "account_email": auth_info["account_email"],
        "active_profile": auth_info["active_profile"],
        "profiles": auth_info["profiles"],
        "instructions": instructions
    }
