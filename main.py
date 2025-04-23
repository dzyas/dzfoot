import os
import logging
import uuid
import json
import requests
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Text, DateTime, ForeignKey, select, delete, update, desc
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

if not OPENROUTER_API_KEY:
    logger.warning("OPENROUTER_API_KEY environment variable is not set. OpenRouter functionality will be simulated.")

# Other app settings
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

# --- OpenRouter API function ---
def call_openrouter_api(messages, model="gemini-1.5-pro", temperature=0.7):
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
    
    for msg in messages:
        # Ensure roles are correctly formatted for OpenRouter
        role = msg["role"]
        formatted_messages.append({
            "role": role,
            "content": msg["content"]
        })
    
    # Special handling for Gemini 2 (upcoming models) and other Google models
    is_gemini = "gemini" in model.lower()
    
    # Build the request payload
    payload = {
        "model": model,
        "messages": formatted_messages,
        "temperature": temperature,
        "max_tokens": 2000
    }
    
    # Add Gemini specific parameters if using a Gemini model
    if is_gemini:
        payload["top_p"] = 0.95
        payload["top_k"] = 40
        # Add system instruction optimized for Arabic responses
        if formatted_messages and formatted_messages[0]["role"] != "system":
            formatted_messages.insert(0, {
                "role": "system",
                "content": "أنت مساعد ذكي ومفيد باللغة العربية اسمه ياسمين. أجب دائماً باللغة العربية الفصحى ما لم يطلب المستخدم لغة أخرى. قدم معلومات دقيقة وشاملة. تجنب الإجابات الطويلة جداً"
            })
    
    # Set the headers with API key
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://yasmin-chat.replit.app",
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

# --- AI response generation with OpenRouter ---
def generate_ai_response(messages_list, model="gemini-1.5-pro", temperature=0.7):
    """Generate an AI response based on the user's input using OpenRouter API or fallback"""
    if not messages_list:
        return "مرحباً! كيف يمكنني مساعدتك اليوم؟"
    
    # Get the latest user message
    user_message = messages_list[-1]["content"].lower() if messages_list[-1]["role"] == "user" else ""
    
    # Try to get a response from OpenRouter API
    openrouter_response = call_openrouter_api(messages_list, model, temperature)
    
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
    return f"شكراً لرسالتك. أنا ياسمين، وأحاول أن أساعدك قدر المستطاع. يمكنك طرح أي سؤال وسأحاول الإجابة عليه."

# --- API Routes ---

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html', app_title=APP_TITLE)

@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get all conversations"""
    try:
        logger.info("جاري جلب المحادثات...")
        conversations = db.session.execute(
            select(Conversation).order_by(desc(Conversation.updated_at))
        ).scalars().all()
        logger.info(f"تم جلب {len(conversations)} محادثة")
        
        return jsonify({
            "success": True,
            "conversations": [conv.to_dict() for conv in conversations]
        })
    
    except SQLAlchemyError as e:
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
    
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error when creating conversation: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في قاعدة البيانات"
        }), 500

@app.route('/api/conversations/<uuid:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a specific conversation"""
    try:
        conversation = db.session.get(Conversation, conversation_id)
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        return jsonify({
            "success": True,
            "conversation": conversation.to_dict()
        })
    
    except SQLAlchemyError as e:
        logger.error(f"Database error when fetching conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في قاعدة البيانات"
        }), 500

@app.route('/api/conversations/<uuid:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation"""
    try:
        conversation = db.session.get(Conversation, conversation_id)
        
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
    
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error when deleting conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في قاعدة البيانات"
        }), 500

@app.route('/api/conversations/<uuid:conversation_id>/messages', methods=['POST'])
def add_message(conversation_id):
    """Add a message to a conversation"""
    try:
        data = request.json
        
        if not data or 'content' not in data:
            return jsonify({
                "success": False,
                "error": "محتوى الرسالة مطلوب"
            }), 400
        
        conversation = db.session.get(Conversation, conversation_id)
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        # Add user message
        user_message = conversation.add_message('user', data['content'])
        
        # Get all messages for context
        messages_list = [
            {"role": msg.role, "content": msg.content}
            for msg in conversation.messages
        ]
        
        # Generate AI response (simple for now)
        model = data.get('model', 'gpt-3.5-turbo')
        temperature = float(data.get('temperature', 0.7))
        
        ai_response = generate_ai_response(messages_list, model, temperature)
        
        # Add AI response to conversation
        ai_message = conversation.add_message('assistant', ai_response)
        
        # Update conversation title if this is the first user message
        if len(conversation.messages) <= 2 and conversation.title == "محادثة جديدة":
            # Extract a title from the first user message
            title = data['content'][:30] + "..." if len(data['content']) > 30 else data['content']
            conversation.title = title
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "user_message": user_message.to_dict(),
            "ai_message": ai_message.to_dict()
        })
    
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error when adding message to conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في قاعدة البيانات"
        }), 500

@app.route('/api/conversations/<uuid:conversation_id>/regenerate', methods=['POST'])
def regenerate_response(conversation_id):
    """Regenerate the last AI response"""
    try:
        data = request.json
        conversation = db.session.get(Conversation, conversation_id)
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "المحادثة غير موجودة"
            }), 404
        
        messages = conversation.messages
        
        if not messages or len(messages) < 2:
            return jsonify({
                "success": False,
                "error": "لا توجد رسائل كافية لإعادة التوليد"
            }), 400
        
        # Get the last message
        last_message = messages[-1]
        
        # Ensure the last message is from the assistant
        if last_message.role != 'assistant':
            return jsonify({
                "success": False,
                "error": "آخر رسالة ليست من المساعد"
            }), 400
        
        # Get all messages except the last one for context
        messages_list = [
            {"role": msg.role, "content": msg.content}
            for msg in messages[:-1]  # Exclude the last message
        ]
        
        # Generate new AI response
        model = data.get('model', 'gpt-3.5-turbo')
        temperature = float(data.get('temperature', 0.7))
        
        new_response = generate_ai_response(messages_list, model, temperature)
        
        # Update the last message with the new response
        last_message.content = new_response
        last_message.created_at = datetime.now(timezone.utc)
        conversation.updated_at = datetime.now(timezone.utc)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "regenerated_message": last_message.to_dict()
        })
    
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Database error when regenerating response for conversation {conversation_id}: {e}")
        return jsonify({
            "success": False,
            "error": "حدث خطأ في قاعدة البيانات"
        }), 500


# --- Initialize Database ---
def init_db():
    with app.app_context():
        try:
            db.create_all()
            logger.info("تم إنشاء قاعدة البيانات بنجاح")
        except Exception as e:
            logger.error(f"خطأ في إنشاء قاعدة البيانات: {e}")
            raise

init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)