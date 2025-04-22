import os
import logging
import requests
import json
import uuid
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Text, DateTime, ForeignKey, select, delete, update, desc, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.exc import SQLAlchemyError

# --- Setup Logging ---
log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(level=log_level, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Base Class for SQLAlchemy models ---
class Base(DeclarativeBase):
    pass

# --- Initialize Flask and SQLAlchemy ---
app = Flask(__name__)

# --- Load sensitive settings from environment variables ---
app.secret_key = os.environ.get("SESSION_SECRET")
if not app.secret_key:
    logger.warning("SESSION_SECRET environment variable not set. Using a default insecure key for now.")
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
    "pool_pre_ping": True, # To check the connection before using it
    "pool_timeout": 10,   # Wait time to get a connection from the pool
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize SQLAlchemy with the app and Base model
db = SQLAlchemy(model_class=Base)
db.init_app(app)

# --- Load API Keys ---
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not OPENROUTER_API_KEY:
    logger.warning("OPENROUTER_API_KEY environment variable is not set. OpenRouter functionality will be disabled.")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY environment variable is not set. Gemini backup functionality will be disabled.")

# Other app settings
APP_URL = os.environ.get("APP_URL")
if not APP_URL:
    logger.warning("APP_URL environment variable is not set. Using a default which might cause issues with OpenRouter Referer check.")
    # Use Replit's domain as the APP_URL if available
    replit_slug = os.environ.get('REPL_SLUG')
    replit_owner = os.environ.get('REPL_OWNER')
    if replit_slug and replit_owner:
        APP_URL = f"https://{replit_slug}.{replit_owner}.repl.co"
    else:
        APP_URL = "http://localhost:5000"

APP_TITLE = "ياسمين - المساعد الذكي"

# --- Define Database Models ---
class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(100), nullable=False, default="محادثة جديدة")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship with messages (one-to-many)
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="selectin"
    )

    def add_message(self, role: str, content: str):
        """ Helper method to add a message to this conversation """
        new_message = Message(
            conversation_id=self.id,
            role=role,
            content=content
        )
        db.session.add(new_message)
        self.updated_at = datetime.now(timezone.utc)
        return new_message

    def to_dict(self):
        """ Serialize conversation and its messages to a dictionary """
        return {
            "id": str(self.id),
            "title": self.title,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "messages": [message.to_dict() for message in self.messages]
        }

    def __repr__(self):
        return f"<Conversation(id={self.id}, title='{self.title}')>"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Back-reference to conversation (many-to-one)
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    def to_dict(self):
        """ Serialize message to a dictionary """
        return {
            "id": self.id,
            "conversation_id": str(self.conversation_id),
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat()
        }

    def __repr__(self):
        return f"<Message(id={self.id}, role='{self.role}', conv_id={self.conversation_id})>"


# --- Fallback responses (for when APIs fail) ---
offline_responses = {
    "السلام عليكم": "وعليكم السلام! أنا ياسمين. للأسف، لا يوجد اتصال بالإنترنت حالياً.",
    "كيف حالك": "أنا بخير شكراً لك. لكن لا يمكنني الوصول للنماذج الذكية الآن بسبب انقطاع الإنترنت.",
    "مرحبا": "أهلاً بك! أنا ياسمين. أعتذر، خدمة الإنترنت غير متوفرة حالياً.",
    "شكرا": "على الرحب والسعة! أتمنى أن يعود الاتصال قريباً.",
    "مع السلامة": "إلى اللقاء! آمل أن أتمكن من مساعدتك بشكل أفضل عند عودة الإنترنت."
}
default_offline_response = "أعتذر، لا يمكنني معالجة طلبك الآن. يبدو أن هناك مشكلة في الاتصال بالإنترنت أو بخدمات الذكاء الاصطناعي."

# --- Function to call OpenRouter API ---
def call_openrouter_api(messages_list, model, temperature, max_tokens=512):
    """Call the OpenRouter API"""
    if not OPENROUTER_API_KEY:
        logger.warning("OpenRouter API key not available.")
        return None, "مفتاح OpenRouter API غير متوفر"
    
    try:
        openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": messages_list,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(
            openrouter_url,
            headers=headers,
            json=data,
            timeout=30
        )
        
        response.raise_for_status()
        response_data = response.json()
        
        if 'choices' not in response_data or len(response_data['choices']) == 0:
            logger.error(f"OpenRouter response missing choices: {response_data}")
            return None, "خطأ في استجابة OpenRouter"
        
        content = response_data['choices'][0]['message']['content']
        return content, None
    
    except requests.exceptions.Timeout:
        logger.error("OpenRouter API request timed out.")
        return None, "استجابة النموذج استغرقت وقتاً طويلاً"
    except requests.exceptions.HTTPError as e:
        logger.error(f"OpenRouter API HTTP error ({e.response.status_code}): {e.response.text}")
        return None, f"خطأ HTTP من OpenRouter: {e.response.status_code}"
    except requests.exceptions.RequestException as e:
        logger.error(f"OpenRouter API request error: {e}")
        return None, f"خطأ في طلب OpenRouter: {str(e)}"
    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"Error parsing OpenRouter response: {e}")
        return None, "خطأ في تحليل استجابة OpenRouter"


# --- Function to call Gemini API ---
def call_gemini_api(messages_list, temperature, max_tokens=512):
    """Call the Gemini API as a backup"""
    if not GEMINI_API_KEY:
        logger.warning("Gemini API key not available for backup.")
        return None, "مفتاح Gemini API غير متوفر"
    
    try:
        # Convert messages format for Gemini
        gemini_contents = []
        for msg in messages_list:
            role = "user" if msg["role"] == "user" else "model"
            gemini_contents.append({"role": role, "parts": [{"text": msg["content"]}]})
        
        # Ensure last message is from user (required in some Gemini API versions)
        if gemini_contents and gemini_contents[-1]['role'] != 'user':
            logger.warning("Gemini API call adjusted: Last message was not from user.")
            # Could potentially return an error here instead
        
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}"
        
        response = requests.post(
            url=gemini_url,
            headers={'Content-Type': 'application/json'},
            json={
                "contents": gemini_contents,
                "generationConfig": {
                    "maxOutputTokens": max_tokens,
                    "temperature": temperature
                }
            },
            timeout=30
        )
        
        response.raise_for_status()
        response_data = response.json()
        
        # Check for blocked responses
        if 'candidates' not in response_data or not response_data['candidates']:
            block_reason = response_data.get('promptFeedback', {}).get('blockReason', 'Unknown reason')
            logger.error(f"Gemini response blocked. Reason: {block_reason}")
            return None, f"الرد محظور بواسطة فلتر السلامة: {block_reason}"
        
        # Extract text
        text_parts = []
        for part in response_data['candidates'][0]['content']['parts']:
            if 'text' in part:
                text_parts.append(part['text'])
        
        if text_parts:
            return "".join(text_parts).strip(), None
        else:
            logger.warning(f"No text found in Gemini response parts.")
            return None, "لم يتم العثور على نص في استجابة Gemini"
    
    except requests.exceptions.Timeout:
        logger.error("Gemini API request timed out.")
        return None, "استجابة النموذج الاحتياطي (Gemini) استغرقت وقتاً طويلاً"
    except requests.exceptions.HTTPError as e:
        logger.error(f"Gemini API HTTP error ({e.response.status_code}): {e.response.text}")
        return None, f"خطأ HTTP من Gemini: {e.response.status_code}"
    except requests.exceptions.RequestException as e:
        logger.error(f"Gemini API request error: {e}")
        return None, f"خطأ في طلب Gemini: {str(e)}"
    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"Error parsing Gemini response: {e}")
        return None, "خطأ في تحليل استجابة Gemini"


# --- API Routes ---

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html', app_title=APP_TITLE)


@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get all conversations"""
    try:
        conversations = db.session.execute(
            select(Conversation).order_by(desc(Conversation.updated_at))
        ).scalars().all()
        
        return jsonify({
            "success": True,
            "conversations": [conv.to_dict() for conv in conversations]
        })
    
    except SQLAlchemyError as e:
        logger.error(f"Database error when fetching conversations: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ أثناء جلب المحادثات"
        }), 500


@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a specific conversation by ID"""
    try:
        conversation = db.session.execute(
            select(Conversation).filter_by(id=conversation_id)
        ).scalar_one_or_none()
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        return jsonify(conversation.to_dict())
    
    except ValueError:
        return jsonify({
            "success": False,
            "error": "معرف المحادثة غير صالح"
        }), 400
    
    except SQLAlchemyError as e:
        logger.error(f"Database error when fetching conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ أثناء جلب المحادثة"
        }), 500


@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation"""
    try:
        conversation = db.session.execute(
            select(Conversation).filter_by(id=conversation_id)
        ).scalar_one_or_none()
        
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
    
    except ValueError:
        return jsonify({
            "success": False,
            "error": "معرف المحادثة غير صالح"
        }), 400
    
    except SQLAlchemyError as e:
        logger.error(f"Database error when deleting conversation {conversation_id}: {e}")
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "حدث خطأ أثناء حذف المحادثة"
        }), 500


@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation with an initial message and get AI response"""
    data = request.json
    
    if not data or 'messages' not in data or not isinstance(data['messages'], list) or len(data['messages']) == 0:
        return jsonify({
            "success": False,
            "error": "البيانات المرسلة غير صالحة"
        }), 400
    
    # Extract parameters
    messages = data['messages']
    model = data.get('model', 'mistral-7b-instruct')
    temperature = data.get('temperature', 0.7)
    max_tokens = data.get('max_tokens', 512)
    
    try:
        # Create a new conversation
        title = "محادثة جديدة"
        if len(messages) > 0 and messages[0]['role'] == 'user':
            # Use first user message as title (truncated)
            user_message = messages[0]['content']
            title = user_message[:50] + ("..." if len(user_message) > 50 else "")
        
        conversation = Conversation(title=title)
        db.session.add(conversation)
        # Commit to get the ID before adding messages
        db.session.commit()
        
        # Add all messages
        for message in messages:
            if 'role' in message and 'content' in message:
                conversation.add_message(message['role'], message['content'])
        
        # Get AI response
        response_text, error = call_ai_service(messages, model, temperature, max_tokens)
        
        if error:
            # If AI service failed, add a message explaining the issue
            conversation.add_message('assistant', f"عذرًا، حدث خطأ أثناء معالجة طلبك: {error}")
            db.session.commit()
            
            return jsonify({
                "success": False,
                "conversation_id": str(conversation.id),
                "error": error,
                "response": f"عذرًا، حدث خطأ أثناء معالجة طلبك: {error}"
            }), 200  # Still return 200 to allow client to continue
        
        # Add AI response to conversation
        conversation.add_message('assistant', response_text)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "conversation_id": str(conversation.id),
            "response": response_text
        })
    
    except SQLAlchemyError as e:
        logger.error(f"Database error when creating conversation: {e}")
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "حدث خطأ أثناء إنشاء المحادثة"
        }), 500


@app.route('/api/conversations/<conversation_id>/messages', methods=['POST'])
def add_message(conversation_id):
    """Add a message to an existing conversation and get AI response"""
    data = request.json
    
    if not data or 'messages' not in data or not isinstance(data['messages'], list) or len(data['messages']) == 0:
        return jsonify({
            "success": False,
            "error": "البيانات المرسلة غير صالحة"
        }), 400
    
    # Extract parameters
    messages = data['messages']
    model = data.get('model', 'mistral-7b-instruct')
    temperature = data.get('temperature', 0.7)
    max_tokens = data.get('max_tokens', 512)
    
    try:
        # Get the conversation
        conversation = db.session.execute(
            select(Conversation).filter_by(id=conversation_id)
        ).scalar_one_or_none()
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        # Find the last user message (should be the newest in the list)
        last_user_message = None
        for message in reversed(messages):
            if message['role'] == 'user':
                last_user_message = message
                break
        
        if not last_user_message:
            return jsonify({
                "success": False,
                "error": "لم يتم العثور على رسالة المستخدم"
            }), 400
        
        # Add user message to conversation
        conversation.add_message('user', last_user_message['content'])
        
        # Get AI response
        response_text, error = call_ai_service(messages, model, temperature, max_tokens)
        
        if error:
            # If AI service failed, add a message explaining the issue
            conversation.add_message('assistant', f"عذرًا، حدث خطأ أثناء معالجة طلبك: {error}")
            db.session.commit()
            
            return jsonify({
                "success": False,
                "error": error,
                "response": f"عذرًا، حدث خطأ أثناء معالجة طلبك: {error}"
            }), 200  # Still return 200 to allow client to continue
        
        # Add AI response to conversation
        conversation.add_message('assistant', response_text)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "response": response_text
        })
    
    except ValueError:
        return jsonify({
            "success": False,
            "error": "معرف المحادثة غير صالح"
        }), 400
    
    except SQLAlchemyError as e:
        logger.error(f"Database error when adding message to conversation {conversation_id}: {e}")
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "حدث خطأ أثناء إضافة الرسالة"
        }), 500


def call_ai_service(messages, model, temperature, max_tokens):
    """Try primary and backup AI services, with fallback to offline responses"""
    # TEMPORARY DISABLED - Skip offline responses to force API use
    # if len(messages) > 0 and messages[-1]['role'] == 'user':
    #     user_message = messages[-1]['content'].lower()
    #     for key, response in offline_responses.items():
    #         if key.lower() in user_message:
    #             logger.info(f"Using offline response for '{key}'")
    #             return response, None
    
    # Try OpenRouter first
    response, error = call_openrouter_api(messages, model, temperature, max_tokens)
    if response:
        return response, None
    
    logger.warning(f"OpenRouter API failed: {error}. Trying Gemini as backup...")
    
    # If OpenRouter fails, try Gemini
    response, error = call_gemini_api(messages, temperature, max_tokens)
    if response:
        return response, None
    
    logger.error(f"Both AI services failed. OpenRouter error: {error}")
    
    # If both fail, return default offline response
    return default_offline_response, "فشل الاتصال بخدمات الذكاء الاصطناعي"


# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({
        "success": False,
        "error": "المورد غير موجود"
    }), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({
        "success": False,
        "error": "حدث خطأ داخلي في الخادم"
    }), 500
