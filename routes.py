from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from app import app, db
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import current_user, login_required
import os
import logging
import uuid
import base64
import html
from werkzeug.utils import secure_filename
import json
from flask_socketio import SocketIO, join_room, leave_room, emit
from models import Conversation, Message, User
from services.chatbot_service import ChatbotService

chatbot = ChatbotService()

# Import services
try:
    from services.openai_service import generate_chat_response as openai_generate
    from services.openai_service import generate_image_with_openai, generate_code
    from services.gemini_service import generate_gemini_response
    from services.openrouter_service import call_openrouter_api, get_available_models
    from services.elevenlabs_service import text_to_speech, get_available_voices
    from services.anthropic_service import generate_claude_response
    api_services_available = True
except ImportError as e:
    print(f"Error importing services: {e}")
    # Define fallback functions
    def openai_generate(messages, **kwargs): return "API service unavailable"
    def generate_image_with_openai(prompt, **kwargs): return None
    def generate_code(prompt, **kwargs): return "API service unavailable"
    def generate_gemini_response(messages, **kwargs): return "API service unavailable"
    def call_openrouter_api(messages, **kwargs): return "API service unavailable"
    def generate_claude_response(messages, **kwargs): return "API service unavailable"
    def get_available_models(): return []
    def text_to_speech(text, **kwargs): return None
    def get_available_voices(): return []
    api_services_available = False

# Initialize SocketIO with basic settings for cross-domain support
socketio = SocketIO(app, 
                   cors_allowed_origins="*", 
                   async_mode='threading',
                   logger=True, 
                   engineio_logger=True)

# Configure logging
logger = logging.getLogger(__name__)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static/uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
import magic
import hashlib
import os

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_MIMETYPES = {'image/jpeg', 'image/png', 'image/gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 ميجابايت

def secure_file_hash(file):
    """إنشاء اسم آمن للملف باستخدام SHA-256"""
    hash_obj = hashlib.sha256()
    for chunk in iter(lambda: file.read(4096), b""):
        hash_obj.update(chunk)
    file.seek(0)
    return hash_obj.hexdigest()

def allowed_file(file):
    """التحقق من نوع وحجم الملف"""
    if file.content_length > MAX_FILE_SIZE:
        return False

    filename = file.filename.lower()
    if not '.' in filename:
        return False

    ext = filename.rsplit('.', 1)[1]
    if ext not in ALLOWED_EXTENSIONS:
        return False

    # التحقق من نوع الملف الفعلي
    mime = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)

    return mime in ALLOWED_MIMETYPES

def generate_ai_response(messages_list, model="gpt-4o", temperature=0.7, max_tokens=2000):
    """Generate an AI response based on the user's input using OpenAI, Claude, Gemini or OpenRouter APIs"""
    try:
        # Determine which service to use based on the model
        if model.startswith("gpt"):
            response = openai_generate(messages_list, model=model, temperature=temperature, max_tokens=max_tokens)
        elif model.startswith("gemini"):
            response = generate_gemini_response(messages_list, model=model, temperature=temperature, max_tokens=max_tokens)
        elif model.startswith("claude") or "anthropic" in model:
            # Extract just the model name from "anthropic/claude-3-opus" format
            claude_model = model.split('/')[-1] if '/' in model else model
            response = generate_claude_response(messages_list, model=claude_model, temperature=temperature, max_tokens=max_tokens)
        else:
            # Use OpenRouter for other models
            response = call_openrouter_api(messages_list, model=model, temperature=temperature, max_tokens=max_tokens)

        if not response:
            return "عذراً، لم أتمكن من توليد استجابة. يرجى المحاولة مرة أخرى."

        return response
    except Exception as e:
        logger.error(f"Error generating AI response: {e}")
        # Fallback to simpler model if the selected one fails
        try:
            return openai_generate(messages_list, model="gpt-3.5-turbo", temperature=temperature, max_tokens=max_tokens)
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى لاحقاً."

# Home route - render index template
@app.route('/')
def index():
    return render_template('index.html')

# Features hub route
@app.route('/features_hub')
def features_hub():
    return render_template('features_hub.html')

# Login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = 'remember' in request.form

        # Validate form inputs
        if not username or not password:
            flash('يرجى إدخال اسم المستخدم وكلمة المرور.', 'error')
            return render_template('login.html')

        # Get user from database
        user = User.query.filter_by(username=username).first()

        # Check if user exists and password is correct
        if user and check_password_hash(user.password_hash, password):
            from flask_login import login_user
            login_user(user, remember=remember)
            next_page = request.args.get('next')

            # Redirect to next page or features hub
            if next_page:
                return redirect(next_page)
            else:
                return redirect(url_for('features_hub'))
        else:
            flash('اسم المستخدم أو كلمة المرور غير صحيحة.', 'error')

    return render_template('login.html')

# Register route
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        password_confirm = request.form.get('password_confirm')
        name = request.form.get('name', '')

        # Validate form inputs
        if not username or not email or not password:
            flash('يرجى ملء جميع الحقول المطلوبة.', 'error')
            return render_template('register.html')

        if password != password_confirm:
            flash('كلمات المرور غير متطابقة.', 'error')
            return render_template('register.html')

        # Check if username or email already exists
        if User.query.filter_by(username=username).first():
            flash('اسم المستخدم موجود بالفعل.', 'error')
            return render_template('register.html')

        if User.query.filter_by(email=email).first():
            flash('البريد الإلكتروني موجود بالفعل.', 'error')
            return render_template('register.html')

        # Create new user
        new_user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            name=name
        )

        # Add user to database
        db.session.add(new_user)
        db.session.commit()

        flash('تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

# Logout route
@app.route('/logout')
def logout():
    from flask_login import logout_user
    logout_user()
    flash('تم تسجيل الخروج بنجاح.', 'info')
    return redirect(url_for('index'))

# Chat with Yasmin route
@app.route('/chat')
def chat():
    # Create a new conversation if needed
    conversation_id = request.args.get('conversation_id')

    # Get username from session storage or use a default
    username = request.args.get('username', 'زائر')

    # Get available models
    models = get_available_models()
    default_models = [
        {"id": "gpt-4o", "name": "GPT-4o"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet"},
        {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus"},
        {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet"},
        {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku"},
        {"id": "anthropic/claude-3-opus", "name": "Claude 3 Opus (OpenRouter)"},
        {"id": "anthropic/claude-3-sonnet", "name": "Claude 3 Sonnet (OpenRouter)"},
    ]

    all_models = models + default_models if models else default_models

    # Get available voices
    voices = get_available_voices()

    return render_template(
        'chat.html', 
        app_title='الدردشة مع ياسمين',
        conversation_id=conversation_id,
        models=all_models,
        voices=voices,
        username=username
    )

# Chat room route - supporting both URL formats
@app.route('/chat-room')
@app.route('/chat_room')
def chat_room():
    return render_template('chat_room.html', app_title='غرفة الدردشة')

# Image generator route
@app.route('/image-generator')
def image_generator():
    return render_template(
        'image_generator.html',
        app_title='توليد الصور - ياسمين'
    )

# Code generator route
@app.route('/code-generator')
def code_generator():
    return render_template(
        'code_generator.html',
        app_title='توليد الكود - ياسمين'
    )

# Audio generator route
@app.route('/audio-generator')
def audio_generator():
    # Get available voices
    voices = get_available_voices()

    return render_template(
        'audio_generator.html',
        app_title='توليد الصوت - ياسمين',
        voices=voices
    )

# Image recognition route
@app.route('/image-recognition')
def image_recognition():
    return render_template(
        'image_recognition.html',
        app_title='التعرف على الصور - ياسمين'
    )

# API endpoint for generating chat responses
@app.route('/api/chat', methods=['POST'])
def api_chat():
    """Handle chat messages and generate responses"""
    try:
        data = request.json
        user_message = data.get('message')
        conversation_id = data.get('conversation_id')
        model = data.get('model', 'openai/gpt-3.5-turbo')
        temperature = float(data.get('temperature', 0.7))
        max_tokens = int(data.get('max_tokens', 2000))

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

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

# API endpoint for text-to-speech
@app.route('/api/text-to-speech', methods=['POST'])
def api_text_to_speech():
    """Generate speech from text"""
    try:
        data = request.json
        text = data.get('text')
        voice_id = data.get('voice_id', 'EXAVITQu4vr4xnSDxMaL')

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Generate speech using ElevenLabs
        result = text_to_speech(text, voice_id)

        if isinstance(result, dict) and "error" in result:
            return jsonify(result), 500

        # Return the audio as base64
        audio_base64 = base64.b64encode(result).decode('utf-8') if result else None

        if not audio_base64:
            return jsonify({"error": "Failed to generate speech"}), 500

        return jsonify({"audio": audio_base64})

    except Exception as e:
        logger.error(f"Error in text-to-speech endpoint: {e}")
        return jsonify({"error": str(e)}), 500

# API endpoint for generating images
@app.route('/api/generate-image', methods=['POST'])
def api_generate_image():
    data = request.json
    prompt = data.get('prompt')
    size = data.get('size', 1024)

    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400

    # Size mapping
    size_map = {
        256: "256x256",
        512: "512x512",
        768: "768x768",
        1024: "1024x1024"
    }

    size_str = size_map.get(size, "1024x1024")

    result = generate_image_with_openai(prompt, size=size_str)

    if not result:
        return jsonify({'error': 'Failed to generate image'}), 500

    return jsonify({
        'image_url': result['url'],
        'prompt': prompt
    })

# API endpoint for generating code
@app.route('/api/generate-code', methods=['POST'])
def api_generate_code():
    data = request.json
    prompt = data.get('prompt')
    language = data.get('language')

    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400

    result = generate_code(prompt, language)

    return jsonify({
        'code': result,
        'prompt': prompt
    })

# API endpoint for getting available models
@app.route('/api/models', methods=['GET'])
def api_models():
    models = get_available_models()

    # Add default models if no models returned from OpenRouter
    if not models:
        models = [
            {"id": "gpt-4o", "name": "GPT-4o"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet"},
            {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus"},
            {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet"},
            {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku"},
            {"id": "anthropic/claude-3-opus", "name": "Claude 3 Opus (OpenRouter)"},
            {"id": "anthropic/claude-3-sonnet", "name": "Claude 3 Sonnet (OpenRouter)"},
        ]

    return jsonify({'models': models})

# API endpoint for getting available voices
@app.route('/api/voices', methods=['GET'])
def api_voices():
    voices = get_available_voices()
    return jsonify({'voices': voices})

# API endpoints for conversations
@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get all conversations"""
    try:
        conversations = Conversation.get_all_conversations()
        return jsonify({
            'conversations': [conversation.to_dict() for conversation in conversations]
        })
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        return jsonify({'error': 'Error getting conversations'}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a specific conversation with messages"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404

        messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp).all()

        return jsonify({
            'conversation': conversation.to_dict(),
            'messages': [{
                'id': message.id,
                'role': message.role,
                'content': message.content,
                'timestamp': message.timestamp.isoformat(),
                'feedback': message.feedback,
                'metadata': message.message_metadata
            } for message in messages]
        })
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        return jsonify({'error': 'Error getting conversation'}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation and all its messages"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404

        db.session.delete(conversation)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Conversation deleted'})
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        db.session.rollback()
        return jsonify({'error': 'Error deleting conversation'}), 500

@app.route('/api/clear_conversation/<int:conversation_id>', methods=['POST'])
def clear_conversation(conversation_id):
    """Clear all messages in a conversation but keep the conversation"""
    try:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404

        Message.query.filter_by(conversation_id=conversation_id).delete()
        db.session.commit()

        return jsonify({'success': True, 'message': 'Conversation cleared'})
    except Exception as e:
        logger.error(f"Error clearing conversation: {e}")
        db.session.rollback()
        return jsonify({'error': 'Error clearing conversation'}), 500

# Socket.IO events for chat room
@socketio.on('connect')
def handle_connect():
    client_id = request.sid
    logger.info(f'Client connected: {client_id}')
    # Send initial connection acknowledgment to client
    emit('server_status', {
        'status': 'connected',
        'message': 'تم الاتصال بالخادم بنجاح',
        'sid': client_id,
        'timestamp': datetime.now(timezone.utc).isoformat()
    })

@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid if hasattr(request, 'sid') else 'unknown'
    username = session.get('username', 'unknown')
    room = session.get('room', 'unknown')
    logger.info(f'Client disconnected: {client_id}, Username: {username}, Room: {room}')

    # If user was in a room, notify others
    if room != 'unknown':
        try:
            emit('status', {
                'msg': f'{username} غادر الغرفة (انقطاع الاتصال).',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, to=room)
        except Exception as e:
            logger.error(f"Error sending disconnect notification: {e}")

@socketio.on('join')
def handle_join(data):
    try:
        client_id = request.sid
        logger.info(f"Join attempt from client {client_id}: {data}")

        # Validate data
        if not data or not isinstance(data, dict):
            logger.warning(f"Invalid join data from {client_id}: {data}")
            emit('join_response', {
                'success': False,
                'msg': 'بيانات غير صالحة'
            })
            return

        username = data.get('username')
        room = data.get('room', 'default_room')

        # Validate username
        if not username or not isinstance(username, str) or len(username.strip()) == 0:
            logger.warning(f"Invalid username from {client_id}: {username}")
            emit('join_response', {
                'success': False,
                'msg': 'يرجى إدخال اسم مستخدم صالح'
            })
            return

        # Store in session
        session['username'] = username
        session['room'] = room
        logger.info(f"User {username} joining room {room} from client {client_id}")

        # Join the room
        join_room(room)

        # Send success response to the client
        emit('join_response', {
            'success': True,
            'username': username,
            'room': room,
            'sid': client_id,
            'msg': f'تم الانضمام إلى الغرفة بنجاح'
        })

        # Notify others in the room
        emit('status', {
            'msg': f'{username} انضم إلى الغرفة.',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, to=room)

        logger.info(f"User {username} successfully joined room {room}")
    except Exception as e:
        logger.error(f"Error in handle_join: {e}")
        # Try to send error response
        try:
            emit('join_response', {
                'success': False,
                'msg': 'حدث خطأ أثناء الانضمام. يرجى المحاولة مرة أخرى.'
            })
        except:
            logger.error("Failed to send error response for join event")

@socketio.on('leave')
def handle_leave(data):
    username = data.get('username', session.get('username', 'زائر'))
    room = data.get('room', session.get('room', 'default_room'))

    if not username or not room:
        return

    # مغادرة الغرفة
    leave_room(room)

    # إخطار الآخرين في الغرفة
    emit('status', {
        'msg': f'{username} غادر الغرفة.',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, to=room)

@socketio.on('message')
def handle_message(data):
    try:
        client_id = request.sid
        logger.info(f"Message event from client {client_id}")

        # Validate data
        if not data or not isinstance(data, dict):
            logger.warning(f"Invalid message data from {client_id}: {data}")
            return

        # Get username from session or data
        username = session.get('username', data.get('username', 'زائر'))
        message = data.get('message')
        room = session.get('room', 'default_room')

        # Validate message
        if not message or not isinstance(message, str) or len(message.strip()) == 0:
            logger.warning(f"Empty or invalid message from {username} ({client_id})")
            # Optionally send error to client
            emit('message_error', {
                'msg': 'الرسالة فارغة أو غير صالحة'
            })
            return

        logger.info(f"Broadcasting message from {username} in room {room}")

        # Sanitize message to prevent any HTML/script injection
        message = html.escape(message)

        # Process message with AI if mentioned
        if message.startswith('@ياسمين'):
            ai_response = chatbot.get_response(message[8:])  # Remove @ياسمين
            emit('message', {
                'username': 'ياسمين',
                'message': ai_response,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, to=room)
        emit('message', {
            'username': username,
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, to=room)

        logger.info(f"Message from {username} successfully broadcast to room {room}")
    except Exception as e:
        logger.error(f"Error in handle_message: {e}")
        # Try to send error response
        try:
            emit('message_error', {
                'msg': 'حدث خطأ أثناء إرسال الرسالة'
            })
        except:
            logger.error("Failed to send message error response")

# Error handler for 404
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html', app_title='صفحة غير موجودة - ياسمين'), 404

# Error handler for 500
@app.errorhandler(500)
def server_error(e):
    return render_template('500.html', app_title='خطأ في الخادم - ياسمين'), 500

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400

        image = request.files['image']
        if image.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if not allowed_file(image):
            return jsonify({'error': 'File type not allowed'}), 400

        # Process the image here.  This needs a real implementation.
        description = analyze_image(image)  # analyze_image function is undefined. Needs implementation.
        return jsonify({'description': description})

    except Exception as e:
        app.logger.error(f"Error processing image: {e}")
        return jsonify({'error': 'Failed to process image'}), 500

def analyze_image(image):
    """Placeholder for image analysis.  Replace with actual image processing logic."""
    # This is a placeholder and needs to be replaced with actual image processing code.
    # For example, you might use a library like OpenCV to extract features or use a cloud-based API.
    return "Image analysis not implemented yet."