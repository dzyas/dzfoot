import os
import logging
import uuid
import json
import requests
import io
import base64
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template, redirect, url_for, send_file, session, flash
from stability_sdk import client
import stability_sdk.interfaces.gooseai.generation.generation_pb2 as generation
from googletrans import Translator
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename
from PIL import Image, ExifTags, ImageDraw, ImageFont
import numpy as np
import cv2
# Import OpenAI service
import openai_service

# --- Setup Logging ---
log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(level=log_level, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Base Class for SQLAlchemy models ---
class Base(DeclarativeBase):
    pass

# --- Initialize Flask and SQLAlchemy ---
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload size
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

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
STABILITY_API_KEY = os.environ.get("STABILITY_API_KEY")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")

if not OPENROUTER_API_KEY:
    logger.warning("OPENROUTER_API_KEY environment variable is not set. OpenRouter functionality will be simulated.")
if not STABILITY_API_KEY:
    logger.warning("STABILITY_API_KEY environment variable is not set. Image generation won't be available.")
if not ELEVENLABS_API_KEY:
    logger.warning("ELEVENLABS_API_KEY environment variable is not set. Text-to-speech functionality won't be available.")

# Other app settings
APP_TITLE = "ياسمين - المساعد الذكي"

# Ensure all models are imported so their tables will be created
from models import Conversation, Message  # noqa: E402

# Create all tables if they don't exist
with app.app_context():
    db.create_all()

# --- Helper Functions ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# --- OpenRouter API function ---
def call_openrouter_api(messages, model="openai/gpt-3.5-turbo", temperature=0.7, max_tokens=1000):
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
    if text.strip():
        # For long texts, add breaks to help with pacing and clarity
        if len(text) > 100:
            sentences = text.split('.')
            processed = ""
            for i, sentence in enumerate(sentences):
                if sentence.strip():
                    processed += sentence.strip() + ".\n" if i < len(sentences)-1 else sentence.strip()
            return processed

    return text

def generate_image(prompt, size=512):
    """Generate image using Stability AI"""
    try:
        if not STABILITY_API_KEY:
            logger.warning("STABILITY_API_KEY environment variable is not set. Image generation won't work.")
            return None
            
        stability_api = client.StabilityInference(
            key=STABILITY_API_KEY,
            verbose=True,
        )

        answers = stability_api.generate(
            prompt=prompt,
            height=size,
            width=size,
            samples=1,
        )

        for resp in answers:
            for artifact in resp.artifacts:
                if artifact.finish_reason == generation.FILTER:
                    return None
                if artifact.type == generation.ARTIFACT_IMAGE:
                    return artifact.binary
        return None
    except Exception as e:
        logger.error(f"Error generating image: {e}")
        return None

def translate_text(text, target_lang):
    """Translate text to target language"""
    try:
        translator = Translator()
        result = translator.translate(text, dest=target_lang)
        return result.text
    except Exception as e:
        logger.error(f"Error translating text: {e}")
        return None

def text_to_speech(text, voice_id="EXAVITQu4vr4xnSDxMaL"):
    """Convert text to speech using ElevenLabs API"""
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

def generate_ai_response(messages_list, model="gpt-4o", temperature=0.7, max_tokens=2000):
    """Generate an AI response based on the user's input using OpenAI API or OpenRouter"""
    if not messages_list:
        return "مرحباً! كيف يمكنني مساعدتك اليوم؟"

    # Get the latest user message
    user_message = messages_list[-1]["content"].lower() if messages_list[-1]["role"] == "user" else ""
    
    # Check if we should use a specific OpenRouter model
    use_openrouter_model = None
    
    # Gemini model support via OpenRouter
    if "gemini" in model.lower():
        use_openrouter_model = "anthropic/claude-3-opus"  # Fallback to Claude since Gemini isn't available on OpenRouter
    # Claude support via OpenRouter
    elif "claude" in model.lower():
        use_openrouter_model = "anthropic/claude-3-opus"
    
    # Try OpenRouter first if specifically requested model
    if use_openrouter_model and OPENROUTER_API_KEY:
        # Add system instruction if not present
        has_system_message = any(msg.get("role") == "system" for msg in messages_list)
        formatted_messages = messages_list.copy()
        
        if not has_system_message:
            formatted_messages.insert(0, {
                "role": "system",
                "content": "أنت مساعد ذكي ومفيد باللغة العربية اسمه ياسمين. أجب دائماً باللغة العربية الفصحى ما لم يطلب المستخدم لغة أخرى. قدم معلومات دقيقة وشاملة. تجنب الإجابات الطويلة جداً. اليوم هو 24 أبريل 2025."
            })
            
        openrouter_response = call_openrouter_api(formatted_messages, use_openrouter_model, temperature, max_tokens)
        if openrouter_response:
            return openrouter_response
    
    # Try OpenAI if not already using OpenRouter or OpenRouter failed
    openai_response = None
    if os.environ.get("OPENAI_API_KEY") and not use_openrouter_model:
        # Add system instruction if not present
        has_system_message = any(msg.get("role") == "system" for msg in messages_list)
        formatted_messages = messages_list.copy()
        
        if not has_system_message:
            formatted_messages.insert(0, {
                "role": "system",
                "content": "أنت مساعد ذكي ومفيد باللغة العربية اسمه ياسمين. أجب دائماً باللغة العربية الفصحى ما لم يطلب المستخدم لغة أخرى. قدم معلومات دقيقة وشاملة. تجنب الإجابات الطويلة جداً. اليوم هو 24 أبريل 2025."
            })
            
        openai_response = openai_service.generate_chat_response(formatted_messages, "gpt-4o")
    
    # If we got a response from OpenAI, return it
    if openai_response:
        return openai_response
        
    # If OpenAI failed or not available, try OpenRouter as a fallback
    if not use_openrouter_model:  # Don't try again if we already tried OpenRouter
        openrouter_response = call_openrouter_api(messages_list, "openai/gpt-3.5-turbo", temperature, max_tokens)
        if openrouter_response:
            return openrouter_response

    # If both APIs failed, use our fallback responses
    logger.warning("All API calls failed, using fallback responses")

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
        return """يمكنني مساعدتك في عدة أمور، مثل:
- الإجابة على الأسئلة في مختلف المجالات
- توليد صور بناءً على وصفك
- مساعدتك في كتابة وتصحيح النصوص
- التفاعل معك بالعربية والإنجليزية
- توليد نصوص صوتية من النص المكتوب
- الترجمة بين اللغات
- توليد وتفسير الكود البرمجي
- وأكثر من ذلك!

ما الذي ترغب في مساعدتي به اليوم؟"""

    return default_offline_response

# --- Image Recognition Functions ---
def analyze_image(image_path):
    """Perform basic image analysis on the uploaded image"""
    try:
        # Open the image with PIL
        image = Image.open(image_path)
        
        # Get basic image info
        width, height = image.size
        format_type = image.format
        mode = image.mode
        
        # Extract EXIF data if available
        exif_data = {}
        if hasattr(image, '_getexif') and image._getexif():
            exif = {
                ExifTags.TAGS[k]: v
                for k, v in image._getexif().items()
                if k in ExifTags.TAGS
            }
            
            # Filter relevant EXIF data
            relevant_tags = ['Make', 'Model', 'DateTime', 'ExposureTime', 'FNumber', 'ISOSpeedRatings']
            exif_data = {k: exif[k] for k in relevant_tags if k in exif}
        
        # Color analysis
        if mode == 'RGB':
            # Convert to numpy array for easier manipulation
            img_array = np.array(image)
            average_color = img_array.mean(axis=(0, 1)).astype(int)
            
            # Determine dominant color by sampling
            # Resize to make processing faster
            small_img = image.resize((50, 50))
            result = small_img.convert('RGB').getcolors(2500)
            dominant_color = sorted(result, key=lambda x: x[0], reverse=True)[0][1]
        else:
            average_color = None
            dominant_color = None
        
        # Create a simple analysis result
        analysis = {
            "dimensions": f"{width}x{height}",
            "format": format_type,
            "mode": mode,
            "average_color": average_color.tolist() if isinstance(average_color, np.ndarray) else average_color,
            "dominant_color": dominant_color,
            "exif": exif_data
        }
        
        return analysis
    
    except Exception as e:
        logger.error(f"Error analyzing image: {e}")
        return {"error": str(e)}

def detect_objects_in_image(image_path):
    """
    Detect basic objects in an image using OpenCV and return an annotated image
    This is a simple demonstration using pretrained models
    """
    try:
        # Read the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Could not read the image")
            
        # Convert to RGB (OpenCV uses BGR)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Convert to grayscale for Haar cascade detection
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Load face cascade
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        # Create a PIL image for drawing
        pil_image = Image.fromarray(image_rgb)
        draw = ImageDraw.Draw(pil_image)
        
        # Draw rectangles around faces and add labels
        objects_found = []
        
        for (x, y, w, h) in faces:
            draw.rectangle([x, y, x+w, y+h], outline="red", width=3)
            draw.text((x, y-20), "وجه", fill="red")
            objects_found.append("وجه")
        
        # Add more object detection as needed
        # Save the annotated image
        output_path = image_path.replace(".", "_annotated.")
        pil_image.save(output_path)
        
        return {
            "annotated_image": output_path,
            "objects_detected": objects_found,
            "object_count": len(objects_found)
        }
        
    except Exception as e:
        logger.error(f"Error detecting objects in image: {e}")
        return {"error": str(e)}

def generate_image_description(image_path):
    """
    Generate a description of the image content using AI
    Using OpenAI's vision capabilities for accurate image analysis
    """
    try:
        # Check for OpenAI API key
        if os.environ.get("OPENAI_API_KEY"):
            # Use OpenAI vision model to analyze the image
            image_description = openai_service.analyze_image_with_openai(image_path)
            if image_description:
                return image_description
                
        # Fallback to basic analysis if OpenAI fails or no API key
        analysis = analyze_image(image_path)
        
        # Try to detect objects in the image
        object_detection = detect_objects_in_image(image_path)
        detected_objects = object_detection.get("objects_detected", []) if isinstance(object_detection, dict) else []
        
        # Create a prompt for the AI to describe the image
        prompt = f"""
        أنا أرى صورة بأبعاد {analysis.get('dimensions', 'غير معروفة')}. 
        
        تم العثور على العناصر التالية في الصورة: {', '.join(detected_objects) if detected_objects else 'لم يتم التعرف على أي عناصر'}.
        
        بناءً على التحليل الأساسي، الصورة تحتوي على ألوان متنوعة.
        
        يُرجى وصف الصورة بناءً على هذه المعلومات التقنية.
        """
        
        # Create messages list for OpenRouter API
        messages = [
            {
                "role": "system",
                "content": "أنت مساعد ذكي متخصص في تحليل الصور ووصفها. قدم وصفاً محتملاً للصورة بناءً على البيانات التقنية المتاحة."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        # Get AI response
        description = call_openrouter_api(messages, "openai/gpt-4", 0.7, 300)
        
        if not description:
            description = "لم أتمكن من توليد وصف دقيق للصورة في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً."
        
        return description
    
    except Exception as e:
        logger.error(f"Error generating image description: {e}")
        return "عذراً، لم أتمكن من تحليل الصورة بسبب خطأ فني."

# --- Flask Routes ---
@app.route('/')
def index():
    """Display the main chat interface"""
    return render_template('index.html', app_title=APP_TITLE, elevenlabs_available=bool(ELEVENLABS_API_KEY))

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages and generate responses"""
    try:
        data = request.json
        user_message = data.get('message')
        conversation_id = data.get('conversation_id')
        model = data.get('model', 'openai/gpt-3.5-turbo')
        temperature = float(data.get('temperature', 0.7))
        max_tokens = int(data.get('max_tokens', 2000))

        # Create a new conversation if needed
        if not conversation_id:
            conversation = Conversation(title=user_message[:30] + "..." if len(user_message) > 30 else user_message)
            db.session.add(conversation)
            db.session.commit()
            conversation_id = conversation.id
        else:
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                return jsonify({"error": "Conversation not found"}), 404

        # Get previous messages for context
        previous_messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp).all()
        messages_for_ai = []

        # Format messages for the AI
        for msg in previous_messages:
            messages_for_ai.append({
                "role": msg.role,
                "content": msg.content
            })

        # Add the new user message
        messages_for_ai.append({
            "role": "user",
            "content": user_message
        })

        # Save the user message to the database
        user_msg = Message(
            conversation_id=conversation_id,
            role="user",
            content=user_message,
            timestamp=datetime.now(timezone.utc)
        )
        db.session.add(user_msg)
        db.session.commit()

        # Generate AI response
        ai_response = generate_ai_response(messages_for_ai, model, temperature, max_tokens)

        # Save the AI response to the database
        assistant_msg = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=ai_response,
            timestamp=datetime.now(timezone.utc)
        )
        db.session.add(assistant_msg)
        db.session.commit()

        # Update conversation title if this is the first exchange
        if len(previous_messages) == 0:
            conversation.title = user_message[:30] + "..." if len(user_message) > 30 else user_message
            db.session.commit()

        return jsonify({
            "message": ai_response,
            "conversation_id": conversation_id
        })

    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get all conversations"""
    try:
        conversations = Conversation.query.order_by(Conversation.last_updated.desc()).all()
        return jsonify({
            "conversations": [
                {
                    "id": conv.id,
                    "title": conv.title,
                    "created_at": conv.created_at.isoformat(),
                    "last_updated": conv.last_updated.isoformat()
                }
                for conv in conversations
            ]
        })
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a specific conversation with messages"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404

        messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp).all()
        
        return jsonify({
            "conversation": {
                "id": conversation.id,
                "title": conversation.title,
                "created_at": conversation.created_at.isoformat(),
                "last_updated": conversation.last_updated.isoformat()
            },
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat()
                }
                for msg in messages
            ]
        })
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation and all its messages"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404

        # Delete all messages in the conversation
        Message.query.filter_by(conversation_id=conversation_id).delete()
        
        # Delete the conversation
        db.session.delete(conversation)
        db.session.commit()
        
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>/messages', methods=['DELETE'])
def clear_conversation(conversation_id):
    """Clear all messages in a conversation but keep the conversation"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({"error": "Conversation not found"}), 404

        # Delete all messages in the conversation
        Message.query.filter_by(conversation_id=conversation_id).delete()
        db.session.commit()
        
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error clearing conversation: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/text-to-speech', methods=['POST'])
def api_text_to_speech():
    """Generate speech from text"""
    try:
        data = request.json
        text = data.get('text')
        voice_id = data.get('voice_id', 'EXAVITQu4vr4xnSDxMaL')  # Default to male voice

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Generate speech using ElevenLabs
        audio_content = text_to_speech(text, voice_id)
        
        if not audio_content:
            return jsonify({"error": "Failed to generate speech"}), 500
            
        # Return the audio as base64
        audio_base64 = base64.b64encode(audio_content).decode('utf-8')
        return jsonify({"audio": audio_base64})
        
    except Exception as e:
        logger.error(f"Error in text-to-speech endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-image', methods=['POST'])
def api_generate_image():
    """Generate an image from a text prompt"""
    try:
        data = request.json
        prompt = data.get('prompt')
        size = int(data.get('size', 512))
        
        if not prompt:
            return jsonify({"error": "No prompt provided"}), 400
            
        # Generate the image
        image_binary = generate_image(prompt, size)
        
        if not image_binary:
            return jsonify({"error": "Failed to generate image"}), 500
            
        # Save the image to a file with a unique filename
        filename = f"image_{uuid.uuid4()}.png"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_binary)
            
        # Return the image URL
        image_url = url_for('static', filename=f'uploads/{filename}')
        return jsonify({"image_url": image_url})
        
    except Exception as e:
        logger.error(f"Error in generate-image endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def api_translate():
    """Translate text to a different language"""
    try:
        data = request.json
        text = data.get('text')
        target_lang = data.get('target_lang', 'en')
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
            
        # Translate the text
        translated_text = translate_text(text, target_lang)
        
        if not translated_text:
            return jsonify({"error": "Failed to translate text"}), 500
            
        return jsonify({"translated_text": translated_text})
        
    except Exception as e:
        logger.error(f"Error in translate endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-code', methods=['POST'])
def api_generate_code():
    """Generate code based on a description"""
    try:
        data = request.json
        description = data.get('description')
        language = data.get('language', 'python')
        
        if not description:
            return jsonify({"error": "No description provided"}), 400
        
        # Check for OpenAI API key and use if available
        if os.environ.get("OPENAI_API_KEY"):
            generated_code = openai_service.generate_code(description, language)
            if generated_code:
                return jsonify({"code": generated_code})
                
        # Create a prompt for code generation (fallback)
        prompt = f"اكتب الكود التالي بلغة {language}: {description}. قدم شرحاً مفصلاً للكود مع تعليقات داخل الكود باللغة العربية."
        
        messages = [
            {
                "role": "system",
                "content": "أنت مبرمج محترف ومعلم. يجب أن تكتب كوداً نظيفاً وفعالاً مع شرح مفصل وتعليقات."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        # Generate code using the AI (OpenRouter fallback)
        generated_code = call_openrouter_api(messages, "openai/gpt-4", 0.7, 2000)
        
        if not generated_code:
            return jsonify({"error": "Failed to generate code"}), 500
            
        return jsonify({"generated_code": generated_code})
        
    except Exception as e:
        logger.error(f"Error in generate-code endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Handle image upload and analysis"""
    try:
        # Check if the post request has the file part
        if 'image' not in request.files:
            return jsonify({"error": "No image part in the request"}), 400
            
        file = request.files['image']
        
        # If user does not select file, browser also
        # submits an empty part without filename
        if file.filename == '':
            return jsonify({"error": "No image selected"}), 400
            
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Add unique identifier to prevent filename collisions
            base, ext = os.path.splitext(filename)
            unique_filename = f"{base}_{uuid.uuid4().hex}{ext}"
            
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            
            # Analyze the image
            analysis = analyze_image(filepath)
            
            # Detect objects
            detection_result = detect_objects_in_image(filepath)
            
            # Generate description
            description = generate_image_description(filepath)
            
            # Return analysis results
            return jsonify({
                "filename": unique_filename,
                "file_url": url_for('static', filename=f'uploads/{unique_filename}'),
                "analysis": analysis,
                "detection": detection_result,
                "description": description
            })
        else:
            return jsonify({"error": "File type not allowed"}), 400
            
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        return jsonify({"error": str(e)}), 500

# --- Feature Pages Routes ---
@app.route('/image_generator')
def image_generator():
    """Image generator page"""
    return render_template('image_generator.html', app_title=f"{APP_TITLE} - توليد الصور")

@app.route('/code_generator')
def code_generator():
    """Code generator page"""
    return render_template('code_generator.html', app_title=f"{APP_TITLE} - توليد الكود")

@app.route('/audio_generator')
def audio_generator():
    """Audio generator page"""
    return render_template('audio_generator.html', app_title=f"{APP_TITLE} - توليد الصوت", elevenlabs_available=bool(ELEVENLABS_API_KEY))

@app.route('/image_recognition')
def image_recognition():
    """Image recognition page"""
    return render_template('image_recognition.html', app_title=f"{APP_TITLE} - التعرف على الصور")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
