from app.ai.anthropic_native import AnthropicNativeAdapter
from app.ai.base import ChatAdapter
from app.ai.openai_compatible import OpenAICompatibleAdapter
from app.models import AIProvider


def build_adapter(provider: AIProvider) -> ChatAdapter:
    if provider.provider_type == "anthropic_native":
        return AnthropicNativeAdapter(api_key=provider.api_key, base_url=provider.base_url)
    if provider.provider_type == "openai_compatible":
        return OpenAICompatibleAdapter(base_url=provider.base_url, api_key=provider.api_key)
    raise ValueError(f"Unbekannter provider_type: {provider.provider_type}")


# Vorbelegte Presets, die die Einstellungsseite als Vorschlag anbietet.
# Der Nutzer trägt nur noch den API-Key ein (bei Ollama gar keinen).
PROVIDER_PRESETS = {
    "ollama": {
        "provider_type": "openai_compatible",
        "base_url": "http://localhost:11434/v1",
        "default_model": "llama3.1",
        "needs_key": False,
    },
    "chatgpt": {
        "provider_type": "openai_compatible",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "needs_key": True,
    },
    "claude": {
        "provider_type": "anthropic_native",
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-sonnet-4-6",
        "needs_key": True,
    },
    "openrouter": {
        "provider_type": "openai_compatible",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "anthropic/claude-sonnet-4.6",
        "needs_key": True,
    },
}
