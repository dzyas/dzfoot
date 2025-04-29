
from datetime import datetime, timezone
from app import db # تأكد من أن 'app' متاح للاستيراد
from flask_login import UserMixin
# قد تحتاج لاستيراد json إذا كنت تستخدمه بشكل مباشر في مكان آخر غير db.JSON
# import json

class User(UserMixin, db.Model):
    # تعريف جدول المستخدمين
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    name = db.Column(db.String(100))
    # استخدام DateTime مع timezone=True لقاعدة بيانات PostgreSQL
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<User {self.username}>'

class Conversation(db.Model):
    """Model for storing conversation metadata"""
    # تعريف جدول المحادثات
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    # استخدام DateTime مع timezone=True لقاعدة بيانات PostgreSQL
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_updated = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # تعريف العلاقة مع جدول الرسائل (Message)
    messages = db.relationship('Message', backref='conversation', cascade='all, delete-orphan', lazy='dynamic') # يمكن استخدام lazy='dynamic' إذا كنت تتوقع عدد كبير من الرسائل
    
    def __repr__(self):
        return f'<Conversation {self.id}: {self.title}>'
        
    def to_dict(self):
        """Convert conversation to dictionary for JSON serialization"""
        # تحويل كائنات datetime التي تحتوي على timezone إلى صيغة ISO 8601 للتسلسل إلى JSON
        return {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            # قد تحتاج لعد (count) الرسائل هنا إذا كنت تستخدم lazy='dynamic'
            'message_count': self.messages.count() if hasattr(self.messages, 'count') else len(self.messages) 
        }
    
    @classmethod
    def get_by_id(cls, conversation_id):
        """Get conversation by ID"""
        return cls.query.get(conversation_id)
    
    @classmethod
    def get_all_conversations(cls):
        """Get all conversations ordered by last_updated"""
        return cls.query.order_by(cls.last_updated.desc()).all()

class Message(db.Model):
    """Model for storing individual messages in a conversation"""
    # تعريف جدول الرسائل
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    # استخدام DateTime مع timezone=True لقاعدة بيانات PostgreSQL
    timestamp = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # حقول إضافية للملاحظات والبيانات الوصفية
    feedback = db.Column(db.Boolean, nullable=True)  # Positive or negative feedback
    # db.JSON يدعم بشكل طبيعي في PostgreSQL. يخزن كـ JSONB افتراضيا في الإصدارات الحديثة.
    message_metadata = db.Column(db.JSON, nullable=True)  # For storing additional information like tokens, model, etc.
    
    def __repr__(self):
        return f'<Message {self.id}: {self.role} (Conv: {self.conversation_id})>'
