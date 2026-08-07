"""
Deckt alle Anbieter ab, die die OpenAI-Chat-Completions-API sprechen:

- Ollama lokal:      base_url="http://localhost:11434/v1", api_key=None
- ChatGPT/OpenAI:    base_url="https://api.openai.com/v1", api_key="sk-..."
- OpenRouter:        base_url="https://openrouter.ai/api/v1", api_key="sk-or-..."

Nur base_url + api_key unterscheiden sich - der Request-Code bleibt gleich.
"""
import httpx

from app.ai.base import ChatAdapter


class OpenAICompatibleAdapter(ChatAdapter):
    def __init__(self, base_url: str, api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def chat(self, system_prompt: str, user_prompt: str, model: str) -> str:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", headers=headers, json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
