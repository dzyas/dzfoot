import os
import logging
import requests
import json
from datetime import datetime

logger = logging.getLogger(__name__)

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

# التحقق من وجود المفتاح
if not ELEVENLABS_API_KEY:
    logger.warning("ElevenLabs API key not found. Please set ELEVENLABS_API_KEY environment variable.")

# تحسين معالجة الأخطاء
def handle_api_error(response):
    """معالجة أخطاء API بشكل أفضل"""
    try:
        error_data = response.json()
        error_message = error_data.get('detail', {}).get('message', 'Unknown error')
        return error_message
    except:
        return f"Error: {response.status_code}"

def text_to_speech(text, voice_id="21m00Tcm4TlvDq8ikWAM"):  # تعيين الصوت العربي كافتراضي
    """تحويل النص إلى صوت باستخدام ElevenLabs API مع دعم محسن للغة العربية"""
    try:
        if not ELEVENLABS_API_KEY:
            logger.warning("ELEVENLABS_API_KEY not found")
            return {"error": "API key not configured"}

        if not text:
            return {"error": "No text provided"}

        url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }

        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.8,
                "similarity_boost": 0.8,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code == 200:
            return {"audio": response.content}
        elif response.status_code == 401:
            logger.error("Invalid API key or unauthorized access")
            return {"error": "Unauthorized access"}
        elif response.status_code == 422:
            logger.error("Invalid voice ID or other validation error")
            return {"error": "Invalid voice ID or parameters"}
        else:
            error_msg = f"ElevenLabs API error: {response.status_code}"
            logger.error(f"{error_msg} - {response.text}")
            return {"error": error_msg}

    except requests.exceptions.RequestException as e:
        logger.error(f"Network error in text_to_speech: {e}")
        return {"error": "Network error occurred"}
    except Exception as e:
        logger.error(f"Unexpected error in text_to_speech: {e}")
        return {"error": "An unexpected error occurred"}

def get_available_voices():
    """الحصول على قائمة الأصوات المتاحة"""
    try:
        if not ELEVENLABS_API_KEY:
            logger.warning("ELEVENLABS_API_KEY not found")
            return get_default_voices()

        url = f"{ELEVENLABS_BASE_URL}/voices"
        headers = {"xi-api-key": ELEVENLABS_API_KEY}
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            voices_data = response.json()
            return voices_data.get("voices", get_default_voices())
        else:
            logger.error(f"Failed to fetch voices: {response.status_code}")
            return get_default_voices()
            
    except Exception as e:
        logger.error(f"Error fetching voices: {e}")
        return get_default_voices()

def get_default_voices():
    """قائمة الأصوات الافتراضية"""
    return [
        {
            "voice_id": "EXAVITQu4vr4xnSDxMaL",
            "name": "آدم - صوت رجالي عربي",
            "preview_url": None
        },
        {
            "voice_id": "21m00Tcm4TlvDq8ikWAM",
            "name": "راشيل - صوت نسائي عربي",
            "preview_url": None
        }
    ]