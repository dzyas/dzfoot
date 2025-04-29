import os
import logging
import requests
import json

logger = logging.getLogger(__name__)

# Initialize OpenRouter client with API key
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

def call_openrouter_api(messages, model="openai/gpt-3.5-turbo", temperature=0.7, max_tokens=1000):
    """
    Call the OpenRouter API to generate a response
    Support for Gemini 1.5, Gemini Pro, Claude and GPT-4 models
    """
    try:
        if not OPENROUTER_API_KEY:
            logger.warning("OpenRouter API key not found, returning None")
            return None

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://your-app-url.com",  # Optional but recommended
            "X-Title": "Yasmin AI Application",  # Optional but recommended
        }

        # Fix model IDs for Gemini
        if model in ["google/gemini-1.5-pro", "gemini-1.5-pro"]:
            model = "google/gemini-pro"
        elif model in ["google/gemini-1.5-flash", "gemini-1.5-flash"]:
            model = "google/gemini-pro"

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            data=json.dumps(payload),
        )

        if response.status_code != 200:
            logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
            return None

        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        return content
    except Exception as e:
        logger.error(f"Error calling OpenRouter API: {e}")
        return None

def get_available_models():
    """
    Get a list of available models from OpenRouter
    """
    try:
        if not OPENROUTER_API_KEY:
            logger.warning("OpenRouter API key not found, returning empty list")
            return []

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }

        response = requests.get(
            f"{OPENROUTER_BASE_URL}/models",
            headers=headers,
        )

        if response.status_code != 200:
            logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
            return []

        models = response.json()["data"]
        
        # Filter and format models for display
        formatted_models = []
        for model in models:
            formatted_models.append({
                "id": model["id"],
                "name": model["name"],
                "description": model.get("description", ""),
                "context_length": model.get("context_length", 0),
                "pricing": {
                    "prompt": model.get("pricing", {}).get("prompt", 0),
                    "completion": model.get("pricing", {}).get("completion", 0),
                }
            })
        
        return formatted_models
    except Exception as e:
        logger.error(f"Error getting available models from OpenRouter: {e}")
        return []