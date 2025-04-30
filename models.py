# models.py

# هذا الملف يحتوي على تعريفات نماذج قاعدة البيانات باستخدام SQLAlchemy.

from datetime import datetime, timezone
# تأكد من أن مسار الاستيراد صحيح بناءً على هيكل مشروعك.
# إذا كان models.py في نفس المجلد الذي يحتوي على app.py:
from app import db
# إذا كان models.py في مجلد فرعي (مثل 'models') و app.py في الجذر:
# from ..app import db

from flask_login import UserMixin # مطلوب لنموذج User إذا كنت تستخدم Flask-Login
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship, Session # استيراد Session لاستخدام db.session

# ملاحظة: تم افتراض استخدام Integer ID كمعرف أساسي للمحادثات والرسائل بناءً على الأكواد الأخيرة.
# إذا كنت تفضل UUIDs، ستحتاج لتغيير نوع العمود هنا إلى UUID (من sqlalchemy.dialects.postgresql import UUID)
# وتعديل أي كود يتعامل مع المعرفات في app.py/routes.py لتحويلها إلى UUID.

# --- نموذج المستخدم (اختياري إذا لم تستخدم تسجيل الدخول/المستخدمين حالياً) ---
# يرث من db.Model لتفاعل SQLAlchemy و UserMixin لـ Flask-Login
class User(UserMixin, db.Model):
    # تعريف جدول المستخدمين
    # استخدام اسم جمع 'users' كممارسة جيدة لتجنب تعارض الأسماء المحجوزة
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=True) # يمكن أن يكون nullable=True
    name = Column(String(100), nullable=True)
    # استخدام DateTime مع timezone=True مناسب لقواعد بيانات مثل PostgreSQL
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'

    # Flask-Login يتطلب التوابع التالية (موجودة في UserMixin)
    # is_authenticated, is_active, is_anonymous, get_id()
# --------------------------------------------------------------------------


# --- نموذج المحادثة ---
class Conversation(db.Model):
    """Model for storing conversation metadata"""
    # تعريف جدول المحادثات
    # تم استخدام 'conversation' بناءً على كودك الأخير، مع ملاحظة أن 'conversations' هي الممارسة الشائعة
    __tablename__ = 'conversation'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False, default="محادثة جديدة")

    # استخدام DateTime مع timezone=True مناسب لقواعد بيانات مثل PostgreSQL
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    # استخدام 'updated_at' للتناسق مع ما كان متوقعاً في app.py
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # تعريف العلاقة مع جدول الرسائل (Message)
    # backref='conversation': يضيف خاصية 'conversation' إلى نموذج Message
    # cascade='all, delete-orphan': يضمن حذف الرسائل عند حذف المحادثة الأم
    # lazy='dynamic': يسمح بتنفيذ استعلامات إضافية (مثل .count() أو .all()) بكفاءة
    # تم حذف backref_kw={'lazy': 'joined'} لحل خطأ TypeError
    messages = relationship('Message', backref='conversation', cascade='all, delete-orphan', lazy='dynamic')

    # إذا كان لديك نموذج مستخدم وتريد ربط المحادثات بالمستخدمين (اختياري)
    # user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    # user = relationship('User', backref='conversations')

    def __repr__(self):
        return f'<Conversation {self.id}: {self.title}>'

    def to_dict(self):
        """Convert conversation to dictionary for JSON serialization"""
        # تحويل كائنات datetime التي تحتوي على timezone إلى صيغة ISO 8601
        return {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # عد الرسائل باستخدام count() لأن lazy='dynamic'
            'message_count': self.messages.count()
            # إذا كان لديك ربط بالمستخدم: 'user_id': self.user_id
        }

    @classmethod
    def get_by_id(cls, conversation_id):
        """Get conversation by ID (assuming Integer ID)"""
        try:
            # حاول التحويل إلى عدد صحيح
            int_id = int(conversation_id)
            return cls.query.get(int_id)
        except (ValueError, TypeError):
            # إذا لم يكن بالإمكان التحويل، أرجع None
            return None

    @classmethod
    def get_all_conversations(cls):
        """Get all conversations ordered by updated_at descending"""
        return cls.query.order_by(cls.updated_at.desc()).all()
# --------------------------------------------------------------------------


# --- نموذج الرسالة ---
class Message(db.Model):
    """Model for storing individual messages in a conversation"""
    # تعريف جدول الرسائل
    # تم استخدام 'message' بناءً على كودك الأخير، مع ملاحظة أن 'messages' هي الممارسة الشائعة
    __tablename__ = 'message'

    id = Column(Integer, primary_key=True)

    # تحديد foreign_key على اسم الجدول الصريح لـ conversation
    conversation_id = Column(Integer, ForeignKey('conversation.id'), nullable=False)

    role = Column(String(50), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)

    # استخدام 'created_at' للتناسق
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # حقول إضافية للملاحظات والبيانات الوصفية (اختياري، بناءً على كودك السابق)
    feedback = Column(Boolean, nullable=True)  # Positive or negative feedback
    # db.JSON مدعوم بشكل طبيعي في PostgreSQL.
    message_metadata = Column(JSON, nullable=True)

    def __repr__(self):
        return f'<Message {self.id}: {self.role} (Conv: {self.conversation_id})>'

    def to_dict(self):
        """Convert message to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    # --- إضافة تابع حذف رسائل المحادثة الذي كان متوقعاً في app.py ---
    @classmethod
    def delete_by_conversation_id(cls, conversation_id):
        """Delete all messages for a given conversation ID"""
        try:
            int_id = int(conversation_id)
            # استخدام db.session.query().filter_by().delete() مع synchronize_session='evaluate'
            # هو الطريقة الموصى بها للحذف بالجملة في SQLAlchemy
            db.session.query(cls).filter_by(conversation_id=int_id).delete(synchronize_session='evaluate')
            db.session.commit() # تثبيت الحذف
        except (ValueError, TypeError):
             # التعامل مع معرف غير صالح إذا لزم الأمر (هنا نطبع تحذير ونتجاهل)
             print(f"Warning: Attempted to delete messages with invalid conversation_id: {conversation_id}")
             pass
        except Exception as e:
            # التعامل مع أي أخطاء قاعدة بيانات أخرى أثناء الحذف
            db.session.rollback() # التراجع عن أي تغييرات غير مكتملة
            print(f"Error deleting messages for conversation {conversation_id}: {e}")
            raise # يمكنك إعادة إلقاء الخطأ إذا أردت معالجته في مكان آخر
# --------------------------------------------------------------------------

# ملاحظة:
# تأكد من أن ملف app.py يقوم بتهيئة db بشكل صحيح قبل استيراد models.
# مثال في app.py:
# db = SQLAlchemy(model_class=Base) # أو تهيئة مشابهة
# ... إعدادات التطبيق ...
# db.init_app(app)
# ... ثم استيراد models ...
# from . import models # أو من models import ...
# ... ثم التأكد من تشغيل create_tables.py كجزء من عملية النشر ...
