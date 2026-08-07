"""
Claude direkt über die native Anthropic Messages API.
Eigener Adapter, da das Anfrageformat von der OpenAI-Familie abweicht
(system-Prompt als Top-Level-Feld statt als Message, anderer Response-Body).
"""
import httpx

from app.ai.base import ChatAdapter

ANTHROPIC_API_VERSION = "2023-06-01"


class AnthropicNativeAdapter(ChatAdapter):
    def __init__(self, api_key: str, base_url: str = "https://api.anthropic.com/v1"):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def chat(self, system_prompt: str, user_prompt: str, model: str) -> str:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/messages", headers=headers, json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            return "".join(block["text"] for block in data["content"] if block["type"] == "text")
