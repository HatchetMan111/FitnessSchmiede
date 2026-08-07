"""
Gemeinsame Schnittstelle, die beide Adapter erfüllen.

Warum nur zwei Adapter für vier Anbieter:
- Ollama (lokal), ChatGPT/OpenAI und OpenRouter sprechen alle dasselbe
  "OpenAI-kompatible" Anfrageformat - ein Adapter reicht, es ändert sich nur
  base_url und api_key.
- Claude (Anthropic) nutzt ein eigenes Nachrichtenformat und bekommt daher
  einen eigenen, nativen Adapter.

Ein neuer OpenAI-kompatibler Anbieter (z.B. ein weiterer lokaler Server)
lässt sich dadurch rein über die Einstellungen hinzufügen, ganz ohne
Code-Änderung.
"""
from abc import ABC, abstractmethod


class ChatAdapter(ABC):
    @abstractmethod
    async def chat(self, system_prompt: str, user_prompt: str, model: str) -> str:
        """Sendet einen einzelnen Chat-Request und gibt den Antworttext zurück."""
        raise NotImplementedError
