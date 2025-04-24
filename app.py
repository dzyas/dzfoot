import os
import logging
import uuid
import json
import requests
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# --- Setup Logging ---
log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(level=log_level, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Base Class for SQLAlchemy models ---
class Base(DeclarativeBase):
    pass

# --- Initialize Flask and SQLAlchemy ---
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)  # needed for url_for to generate with https

# --- Load sensitive settings from environment variables ---
app.secret_key = os.environ.get("SESSION_SECRET")
if not app.secret_key:
    logger.warning("SESSION_SECRET environment variable not set. Using a default insecure key for development.")
    app.secret_key = "default-insecure-secret-key-for-development"

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    logger.warning("DATABASE_URL environment variable not set. Using SQLite for development.")
    DATABASE_URL = "sqlite:///yasmin_chat.db"
else:
    # Render may provide 'postgres://' instead of 'postgresql://'
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 280,  # Slightly less than 5 minutes (common for timeouts)
    "pool_pre_ping": True,  # To check the connection before using it
    "pool_timeout": 10,   # Wait time to get a connection from the pool
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize SQLAlchemy with the app and Base model
db = SQLAlchemy(model_class=Base)
db.init_app(app)

# --- Load API Keys ---
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")

if not OPENROUTER_API_KEY:
    logger.warning("OPENROUTER_API_KEY environment variable is not set. OpenRouter functionality will be simulated.")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY environment variable is not set. Direct Gemini API integration won't be available.")
if not ELEVENLABS_API_KEY:
    logger.warning("ELEVENLABS_API_KEY environment variable is not set. Text-to-speech functionality won't be available.")

# Other app settings
APP_TITLE = "ياسمين - المساعد الذكي"

# Ensure all models are imported so their tables will be created
from models import Conversation, Message  # noqa: E402

# Create all tables if they don't exist
with app.app_context():
    db.create_all()

# --- OpenRouter API function ---
def call_openrouter_api(messages, model="gemini-1.5-pro", temperature=0.7, max_tokens=2000):
    """
    Call the OpenRouter API to generate a response
    Support for Gemini 1.5, Gemini Pro, Claude and GPT-4 models
    """
    if not OPENROUTER_API_KEY:
        logger.warning("OpenRouter API key not found, returning fallback response")
        return None

    # API endpoint
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    # Convert our messages to the correct format
    formatted_messages = []
    
    # Add system instruction optimized for Arabic responses if not present
    has_system_message = any(msg.get("role") == "system" for msg in messages)
    if not has_system_message:
        formatted_messages.append({
            "role": "system",
            "content": "أنت مساعد ذكي ومفيد باللغة العربية اسمه ياسمين. أجب دائماً باللغة العربية الفصحى ما لم يطلب المستخدم لغة أخرى. قدم معلومات دقيقة وشاملة. تجنب الإجابات الطويلة جداً. اليوم هو 24 أبريل 2025."
        })
    
    # Add the user messages
    for msg in messages:
        # Ensure roles are correctly formatted for OpenRouter
        role = msg["role"]
        formatted_messages.append({
            "role": role,
            "content": msg["content"]
        })
    
    # Special handling for Gemini models
    is_gemini = "gemini" in model.lower()
    
    # Build the request payload
    payload = {
        "model": model,
        "messages": formatted_messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    
    # Add Gemini specific parameters if using a Gemini model
    if is_gemini:
        payload["top_p"] = 0.95
        payload["top_k"] = 40
    
    # Set the headers with API key
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://yasmin-chat.app",
        "X-Title": "Yasmin Chat App"
    }
    
    try:
        # Make the API request
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        
        if response.status_code == 200:
            # Parse the response JSON
            response_data = response.json()
            
            # Extract the generated text
            if "choices" in response_data and len(response_data["choices"]) > 0:
                return response_data["choices"][0]["message"]["content"]
            else:
                logger.error(f"Invalid response format from OpenRouter: {response_data}")
                return None
        else:
            logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Error calling OpenRouter API: {e}")
        return None

# --- Fallback responses (for when APIs fail) ---
offline_responses = {
    "السلام عليكم": "وعليكم السلام! أنا ياسمين. للأسف، لا يوجد اتصال بالإنترنت حالياً.",
    "كيف حالك": "أنا بخير شكراً لك. لكن لا يمكنني الوصول للنماذج الذكية الآن بسبب انقطاع الإنترنت.",
    "مرحبا": "أهلاً بك! أنا ياسمين. أعتذر، خدمة الإنترنت غير متوفرة حالياً.",
    "شكرا": "على الرحب والسعة! أتمنى أن يعود الاتصال قريباً.",
    "مع السلامة": "إلى اللقاء! آمل أن أتمكن من مساعدتك بشكل أفضل عند عودة الإنترنت."
}
default_offline_response = "أعتذر، لا يمكنني معالجة طلبك الآن. يبدو أن هناك مشكلة في الاتصال بالإنترنت أو بخدمات الذكاء الاصطناعي."

# --- ElevenLabs Text-to-Speech API ---
def preprocess_arabic_text(text):
    """
    Preprocess Arabic text to improve pronunciation with ElevenLabs.
    This helps improve the speech output quality for Arabic text.
    """
    # Add model hints to help with pronunciation
    if text.strip():
        # Add language instruction as a hint for the model
        enhanced_text = "[تُنطق بالعربية الفصحى]\n" + text
        
        # For long texts, add breaks to help with pacing and clarity
        if len(text) > 100:
            sentences = text.split('.')
            processed = ""
            for i, sentence in enumerate(sentences):
                if sentence.strip():
                    processed += sentence.strip() + ".\n" if i < len(sentences)-1 else sentence.strip()
            
            # More detailed pronunciation hints
            return "[نص عربي للقراءة ببطء ووضوح]\n" + processed
        
        return enhanced_text
    
    return text

def text_to_speech(text, voice_id="EXAVITQu4vr4xnSDxMaL"):
    """Convert text to speech using ElevenLabs API"""
    ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
    
    if not ELEVENLABS_API_KEY:
        logger.warning("ELEVENLABS_API_KEY environment variable is not set. Text-to-speech functionality won't work.")
        return None
    
    # Preprocess Arabic text to improve pronunciation
    processed_text = preprocess_arabic_text(text)
    
    # ElevenLabs API endpoint
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    
    # Set the headers with API key
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    # Build the request payload with optimized settings for Arabic
    payload = {
        "text": processed_text,
        "model_id": "eleven_multilingual_v2",  # Use the multilingual model for better language support
        "voice_settings": {
            "stability": 0.75,           # Higher stability for clearer pronunciation
            "similarity_boost": 0.75,    # Higher similarity for more consistent voice
            "style": 0.5,                # Moderate style interpolation
            "use_speaker_boost": True    # Enhance speaker clarity
        }
    }
    
    try:
        # Make the API request
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            return response.content
        else:
            logger.error(f"ElevenLabs API error: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Error calling ElevenLabs API: {e}")
        return None

# --- AI response generation with OpenRouter ---
def generate_ai_response(messages_list, model="gemini-1.5-pro", temperature=0.7, max_tokens=2000):
    """Generate an AI response based on the user's input using OpenRouter API or fallback"""
    if not messages_list:
        return "مرحباً! كيف يمكنني مساعدتك اليوم؟"
    
    # Get the latest user message
    user_message = messages_list[-1]["content"].lower() if messages_list[-1]["role"] == "user" else ""
    
    # Try to get a response from OpenRouter API
    openrouter_response = call_openrouter_api(messages_list, model, temperature, max_tokens)
    
    # If we got a response from OpenRouter, return it
    if openrouter_response:
        return openrouter_response
    
    # If OpenRouter failed, use our fallback responses
    logger.warning("OpenRouter API call failed, using fallback responses")
    
    # Check for offline responses
    for key, response in offline_responses.items():
        if key in user_message:
            return response
    
    # Some predefined responses for common questions
    if "من أنت" in user_message or "عرفني عن نفسك" in user_message:
        return "أنا ياسمين، مساعدة ذكية اصطناعية مصممة للتحدث باللغة العربية. يمكنني مساعدتك في الإجابة على الأسئلة، وتقديم المعلومات، والدردشة معك بطريقة طبيعية."
    
    elif "كيف حالك" in user_message:
        return "أنا بخير، شكراً لسؤالك! كيف يمكنني مساعدتك اليوم؟"
    
    elif "ماذا يمكنك أن تفعل" in user_message or "ما هي قدراتك" in user_message:
        return "يمكنني مساعدتك في العديد من الأمور مثل الإجابة على الأسئلة، وتقديم المعلومات، وإجراء محادثات، وتلخيص النصوص، وكتابة المحتوى، والمزيد. ما الذي ترغب في مساعدتي به؟"
    
    # Default response
    return default_offline_response

# --- API Routes ---
@app.route('/')
def index():
    """Render the main page"""
    elevenlabs_available = bool(os.environ.get("ELEVENLABS_API_KEY"))
    return render_template('index.html', app_title=APP_TITLE, elevenlabs_available=elevenlabs_available)

@app.route('/api/voices', methods=['GET'])
def get_voices():
    """Get available ElevenLabs voices"""
    voices = [
        {"id": "EXAVITQu4vr4xnSDxMaL", "name": "آدم"},
        {"id": "21m00Tcm4TlvDq8ikWAM", "name": "راشيل"},
        {"id": "ONIBU1mnHqbNnNtBkZMM", "name": "أمير"},
        {"id": "jsCqWAovK2LkecY7zXl4", "name": "سارة"},
        {"id": "XrExE9yKIg1WjnnlVkGX", "name": "فهد"},
        {"id": "SOYHLrjzK2X1ezoPC6cr", "name": "ليلى"},
        {"id": "pNInz6obpgDQGcFmaJgB", "name": "هدى"},
        {"id": "29vD33N1CtxCmqQRPOHJ", "name": "نور"}
    ]
    return jsonify({
        "success": True,
        "voices": voices
    })

@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get all conversations"""
    try:
        logger.info("جاري جلب المحادثات...")
        conversations = Conversation.get_all_conversations()
        logger.info(f"تم جلب {len(conversations)} محادثة")
        
        return jsonify({
            "success": True,
            "conversations": [conv.to_dict() for conv in conversations]
        })
    
    except Exception as e:
        logger.error(f"Database error when fetching conversations: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في قاعدة البيانات"
        }), 500

@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation"""
    try:
        new_conversation = Conversation(title="محادثة جديدة")
        db.session.add(new_conversation)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "conversation": new_conversation.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database error when creating conversation: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في إنشاء محادثة جديدة"
        }), 500

@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a specific conversation by ID"""
    try:
        conversation = Conversation.get_by_id(conversation_id)
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        return jsonify({
            "success": True,
            "conversation": conversation.to_dict()
        })
    
    except Exception as e:
        logger.error(f"Error fetching conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في استرجاع المحادثة"
        }), 500

@app.route('/api/conversations/<conversation_id>', methods=['PUT'])
def update_conversation(conversation_id):
    """Update a conversation title"""
    try:
        data = request.get_json()
        title = data.get('title')
        
        if not title:
            return jsonify({
                "success": False,
                "error": "عنوان المحادثة مطلوب"
            }), 400
        
        conversation = Conversation.get_by_id(conversation_id)
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        conversation.title = title
        conversation.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "conversation": conversation.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في تحديث المحادثة"
        }), 500

@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation"""
    try:
        conversation = Conversation.get_by_id(conversation_id)
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        db.session.delete(conversation)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "تم حذف المحادثة بنجاح"
        })
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في حذف المحادثة"
        }), 500

@app.route('/api/conversations/<conversation_id>/messages', methods=['GET'])
def get_messages(conversation_id):
    """Get all messages for a conversation"""
    try:
        conversation = Conversation.get_by_id(conversation_id)
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        return jsonify({
            "success": True,
            "messages": [message.to_dict() for message in conversation.messages]
        })
    
    except Exception as e:
        logger.error(f"Error fetching messages for conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في استرجاع الرسائل"
        }), 500

@app.route('/api/conversations/<conversation_id>/messages', methods=['POST'])
def create_message(conversation_id):
    """Create a new message and get AI response"""
    try:
        data = request.get_json()
        user_message = data.get('message')
        model = data.get('model', 'gemini-1.5-pro')
        temperature = float(data.get('temperature', 0.7))
        max_tokens = int(data.get('max_tokens', 2000))
        voice_enabled = data.get('voice_enabled', False)
        voice_id = data.get('voice_id', "EXAVITQu4vr4xnSDxMaL")  # Default to Adam voice
        
        if not user_message:
            return jsonify({
                "success": False,
                "error": "الرسالة مطلوبة"
            }), 400
        
        conversation = Conversation.get_by_id(conversation_id)
        if not conversation:
            # Create a new conversation if it doesn't exist
            conversation = Conversation(
                id=uuid.UUID(conversation_id) if conversation_id != 'new' else uuid.uuid4(),
                title="محادثة جديدة"
            )
            db.session.add(conversation)
        
        # Add user message to conversation
        user_msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=user_message
        )
        db.session.add(user_msg)
        
        # Prepare conversation history for AI
        conversation_history = [
            {"role": msg.role, "content": msg.content}
            for msg in conversation.messages
        ]
        conversation_history.append({"role": "user", "content": user_message})
        
        # Get AI response
        ai_response = generate_ai_response(conversation_history, model, temperature, max_tokens)
        
        # Add AI response to conversation
        ai_msg = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=ai_response
        )
        db.session.add(ai_msg)
        
        # Update conversation title if it's the first message
        if len(conversation.messages) <= 2 and conversation.title == "محادثة جديدة":
            # Use the first few words of user message as the title
            words = user_message.split()
            title = " ".join(words[:4]) + ("..." if len(words) > 4 else "")
            conversation.title = title
        
        # Generate speech if requested
        audio_data = None
        if voice_enabled:
            audio_data = text_to_speech(ai_response, voice_id)
        
        conversation.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        
        response_data = {
            "success": True,
            "conversation_id": str(conversation.id),
            "messages": [
                user_msg.to_dict(),
                ai_msg.to_dict()
            ]
        }
        
        # Add voice data to response if available
        if audio_data:
            # Convert binary audio data to base64 for JSON response
            import base64
            response_data["audio"] = base64.b64encode(audio_data).decode('utf-8')
        
        return jsonify(response_data)
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating message for conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في إنشاء الرسالة"
        }), 500

@app.route('/api/conversations/<conversation_id>/clear', methods=['POST'])
def clear_conversation(conversation_id):
    """Clear all messages from a conversation"""
    try:
        conversation = Conversation.get_by_id(conversation_id)
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        # Delete all messages
        Message.delete_by_conversation_id(conversation.id)
        
        # Reset conversation title
        conversation.title = "محادثة جديدة"
        conversation.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "تم مسح المحادثة بنجاح"
        })
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error clearing conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في مسح المحادثة"
        }), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        "success": False,
        "error": "الصفحة غير موجودة"
    }), 404

@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors"""
    return jsonify({
        "success": False,
        "error": "حدث خطأ في الخادم"
    }), 500
