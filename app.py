
import os
import logging
import eventlet
eventlet.monkey_patch()

"""
ياسمين - مساعد ذكي متعدد المهام

هذا التطبيق يوفر واجهة محادثة ذكية مع القدرات التالية:
- محادثة ذكية باستخدام نماذج متعددة (GPT، Claude، Gemini)
- توليد وتحليل الصور
- توليد الأكواد البرمجية
- تحويل النص إلى كلام
- دردشة جماعية في الوقت الحقيقي
"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_login import LoginManager
from flask_socketio import SocketIO

# تهيئة السجلات
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# تهيئة قاعدة البيانات
class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# تهيئة التطبيق مع تحسينات الأداء
app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000  # تخزين مؤقت لمدة سنة
app.config['TEMPLATES_AUTO_RELOAD'] = False  # تعطيل إعادة تحميل القوالب تلقائياً في الإنتاج
app.config["SECRET_KEY"] = os.environ.get("SESSION_SECRET", "yasmin-dev-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///yasmin.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# تهيئة قاعدة البيانات
db.init_app(app)

# تهيئة مدير تسجيل الدخول
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'يرجى تسجيل الدخول للوصول إلى هذه الصفحة.'

# تهيئة SocketIO
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# تحميل المستخدم
@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

# إنشاء جداول قاعدة البيانات
with app.app_context():
    db.create_all()

from routes import *
