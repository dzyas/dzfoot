from datetime import datetime, timezone
from app import db
from flask_login import UserMixin

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    name = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class Conversation(db.Model):
    """Model for storing conversation metadata"""
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationship with messages
    messages = db.relationship('Message', backref='conversation', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Conversation {self.id}: {self.title}>'
        
    def to_dict(self):
        """Convert conversation to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.isoformat(),
            'last_updated': self.last_updated.isoformat(),
            'message_count': len(self.messages)
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
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Additional fields for feedback and extra data
    feedback = db.Column(db.Boolean, nullable=True)  # Positive or negative feedback
    message_metadata = db.Column(db.JSON, nullable=True)  # For storing additional information like tokens, model, etc.
    
    def __repr__(self):
        return f'<Message {self.id}: {self.role}>'