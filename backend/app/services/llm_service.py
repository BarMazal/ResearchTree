import json
import urllib.request
from abc import ABC, abstractmethod

from app.config import settings


class BaseLLMProvider(ABC):
    @abstractmethod
    def summarize(self, text: str, context: str | None = None) -> str:
        pass

    @abstractmethod
    def chat(self, prompt: str, system_prompt: str | None = None) -> str:
        pass


class OllamaProvider(BaseLLMProvider):
    def __init__(self, base_url: str = settings.ollama_url, default_model: str = settings.ollama_model):
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model

    def _get_candidate_models(self) -> list[str]:
        candidates = []
        try:
            req = urllib.request.Request(f"{self.base_url}/api/tags", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                available = set(m.get("name") for m in data.get("models", []) if m.get("name"))

                if self.default_model in available:
                    candidates.append(self.default_model)
                for fallback in ["tinyllama:latest", "llama3:latest", "llama3.1:latest", "minicpm-v:latest"]:
                    if fallback in available and fallback not in candidates:
                        candidates.append(fallback)
                for m in available:
                    if m not in candidates:
                        candidates.append(m)
        except Exception:
            pass
        if not candidates:
            candidates.append(self.default_model)
        return candidates

    def summarize(self, text: str, context: str | None = None) -> str:
        prompt = (
            "Provide a concise, high-quality, structured summary of the following content. "
            "Highlight key concepts, findings, and actionable takeaways.\n\n"
        )
        if context:
            prompt += f"Context: {context}\n\n"
        prompt += f"Content:\n{text[:8000]}"
        return self.chat(prompt)

    def chat(self, prompt: str, system_prompt: str | None = None) -> str:
        candidates = self._get_candidate_models()
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        last_error = ""
        for model in candidates:
            payload = {
                "model": model,
                "prompt": full_prompt,
                "stream": False,
            }
            req = urllib.request.Request(
                f"{self.base_url}/api/generate",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    result = json.loads(resp.read().decode("utf-8"))
                    response_text = result.get("response", "").strip()
                    if response_text:
                        return response_text
            except Exception as e:
                last_error = str(e)
                continue

        return f"[Ollama Error: Could not generate response with model candidate(s) {candidates} ({last_error})]"


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str | None = settings.openai_api_key, model: str = settings.openai_model):
        self.api_key = api_key
        self.model = model

    def summarize(self, text: str, context: str | None = None) -> str:
        prompt = f"Summarize the following text:\n\n{text[:8000]}"
        return self.chat(prompt)

    def chat(self, prompt: str, system_prompt: str | None = None) -> str:
        if not self.api_key:
            return "[OpenAI Error: Missing API Key]"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
        }
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"].strip()
        except Exception as e:
            return f"[OpenAI Error: {e}]"


def get_llm_provider() -> BaseLLMProvider:
    provider_name = settings.llm_provider.lower()
    if provider_name == "openai":
        return OpenAIProvider()
    return OllamaProvider()
