# models.py

# يجب حذف السطر العلوي والسفلي '-- START/END OF FILE --' عند لصق هذا الكود في ملفك الفعلي.

from datetime import datetime, timezone
# تأكد من أن مسار الاستيراد صحيح بناءً على هيكل مشروعك
# إذا كان models.py في نفس المجلد الذي يحتوي على app.py:
from .app import db
# إذا كان models.py في مجلد فرعي (مثل 'models') و app.py في الجذر:
# from ..app import db

from flask_login import UserMixin
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship

# تأكد من تثبيت psycopg2-binary إذا كنت تستخدم PostgreSQL
# تأكد من تثبيت python-dotenv لقراءة متغيرات البيئة (.env)

# --- نموذج المستخدم (اختياري إذا لم تستخدم تسجيل الدخول/المستخدمين الآن) ---
# يرث من db.Model لتفاعل SQLAlchemy و UserMixin لـ Flask-Login
class User(UserMixin, db.Model):
    # تعريف جدول المستخدمين
    # استخدام اسم جمع هو ممارسة جيدة لتجنب تعارض الأسماء المحجوزة في بعض قواعد البيانات
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=True) # يمكن أن يكون nullable=True إذا لم يتم تعيين كلمة مرور
    name = Column(String(100), nullable=True)
    # استخدام DateTime مع timezone=True مناسب لقواعد بيانات مثل PostgreSQL
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # تعريف العلاقة العكسية إذا كنت تريد الوصول للمحادثات من كائن المستخدم
    # conversations = relationship('Conversation', backref='user', lazy='dynamic')

    def __repr__(self):
        return f'<User {self.username}>'

    # Flask-Login يتطلب التوابع التالية (موجودة في UserMixin)
    # is_authenticated, is_active, is_anonymous, get_id()
# --------------------------------------------------------------------------


# --- نموذج المحادثة ---
class Conversation(db.Model):
    """Model for storing conversation metadata"""
    # تعريف جدول المحادثات
    # نستخدم الاسم الذي استخدمته في كودك الأخير 'conversation'، مع ملاحظة أن اسم الجمع 'conversations' هو الممارسة الشائعة
    __tablename__ = 'conversation'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False, default="محادثة جديدة") # إضافة قيمة افتراضية

    # استخدام DateTime مع timezone=True مناسب لقواعد بيانات مثل PostgreSQL
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    # استخدام 'updated_at' للتناسق مع ما كان متوقعاً في app.py، بدلاً من 'last_updated'
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # تعريف العلاقة مع جدول الرسائل (Message)
    # backref='conversation': يضيف خاصية 'conversation' إلى نموذج Message للوصول إلى المحادثة الأم
    # cascade='all, delete-orphan': يضمن حذف الرسائل عند حذف المحادثة الأم
    # lazy='dynamic': يسمح بتنفيذ استعلامات إضافية (مثل .count() أو .all()) على العلاقة بكفاءة
    # تمت إزالة backref_kw={'lazy': 'joined'} لحل خطأ TypeError
    messages = relationship('Message', backref='conversation', cascade='all, delete-orphan', lazy='dynamic')

    # إذا كان لديك نموذج مستخدم وتريد ربط المحادثات بالمستخدمين
    # user_id = Column(Integer, ForeignKey('users.id'), nullable=True) # nullable=True إذا كانت المحادثة يمكن أن تكون بدون مستخدم
    # user = relationship('User', backref='conversations') # العلاقة للمستخدم

    def __repr__(self):
        return f'<Conversation {self.id}: {self.title}>'

    def to_dict(self):
        """Convert conversation to dictionary for JSON serialization"""
        # تحويل كائنات datetime التي تحتوي على timezone إلى صيغة ISO 8601 للتسلسل إلى JSON
        return {
            'id': self.id,
            'title': self.title,
            # استخدام updated_at للتناسق
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
            # حاول التحويل إلى عدد صحيح إذا كنت تستخدم Integer IDs
            int_id = int(conversation_id)
            return cls.query.get(int_id)
        except (ValueError, TypeError):
            # إذا لم يكن بالإمكان التحويل أو كان invalid input (مثلاً ليس عدداً)، أرجع None
            return None

    @classmethod
    def get_all_conversations(cls):
        """Get all conversations ordered by updated_at descending"""
        # استخدام updated_at للترتيب
        return cls.query.order_by(cls.updated_at.desc()).all()
# --------------------------------------------------------------------------


# --- نموذج الرسالة ---
class Message(db.Model):
    """Model for storing individual messages in a conversation"""
    # تعريف جدول الرسائل
    # نستخدم الاسم الذي استخدمته في كودك الأخير 'message'، مع ملاحظة أن اسم الجمع 'messages' هو الممارسة الشائعة
    __tablename__ = 'message'

    id = Column(Integer, primary_key=True)

    # تحديد foreign_key على اسم الجدول الصريح لـ conversation
    # إذا استخدمت UUID في Conversation ID، فستحتاج لتغيير نوع العمود هنا أيضاً
    conversation_id = Column(Integer, ForeignKey('conversation.id'), nullable=False)

    role = Column(String(50), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)

    # استخدام 'created_at' للتناسق مع نموذج Conversation، بدلاً من 'timestamp'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # حقول إضافية للملاحظات والبيانات الوصفية (اختياري، بناءً على كودك السابق)
    feedback = Column(Boolean, nullable=True)  # Positive or negative feedback (مثال على استخدام حقل إضافي)
    # db.JSON مدعوم بشكل طبيعي في PostgreSQL. يخزن كـ JSONB افتراضيا في الإصدارات الحديثة.
    message_metadata = Column(JSON, nullable=True)  # For storing additional info like tokens, model, etc.

    def __repr__(self):
        return f'<Message {self.id}: {self.role} (Conv: {self.conversation_id})>'

    def to_dict(self):
        """Convert message to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'role': self.role,
            'content': self.content,
            # استخدام created_at
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    # --- إضافة تابع حذف رسائل المحادثة الذي كان متوقعاً في app.py ---
    @classmethod
    def delete_by_conversation_id(cls, conversation_id):
        """Delete all messages for a given conversation ID"""
        # تأكد من استخدام معرف المحادثة الصحيح هنا (Integer)
        try:
            int_id = int(conversation_id)
            # استخدام delete() مع synchronize_session='evaluate' يكون فعالاً
            # عند حذف عدد كبير من الكائنات
            cls.query.filter_by(conversation_id=int_id).delete(synchronize_session='evaluate')
            db.session.commit() # قم بتثبيت الحذف في قاعدة البيانات
        except (ValueError, TypeError):
             # التعامل مع معرف غير صالح إذا لزم الأمر (هنا نتجاهله ببساطة)
             print(f"Warning: Attempted to delete messages with invalid conversation_id: {conversation_id}")
             pass # أو يمكنك إلقاء استثناء إذا كان مطلوباً معالجة هذا الخطأ

# --------------------------------------------------------------------------

# ملاحظة هامة:
# تأكد من أن ملف app.py يقوم بتهيئة db بشكل صحيح قبل استيراد models
# وأن app.py يقوم باستيراد النماذج: `from models import User, Conversation, Message`
# وأن سكربت create_tables.py يقوم باستدعاء db.create_all() في سياق التطبيق.
