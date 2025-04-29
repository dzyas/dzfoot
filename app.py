
import os
import logging
import eventlet
eventlet.monkey_patch() # تطبيق monkey-patching بواسطة eventlet

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

# تهيئة قاعدة البيانات باستخدام DeclarativeBase
class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# تهيئة التطبيق مع تحسينات الأداء وإعدادات الأمان
app = Flask(__name__)
# إعدادات التخزين المؤقت لملفات Static (سنة واحدة)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000
# تعطيل إعادة تحميل القوالب تلقائياً في بيئة الإنتاج
app.config['TEMPLATES_AUTO_RELOAD'] = False
# مفتاح سري لإدارة الجلسات، يُفضل أخذه من متغير بيئة
app.config["SECRET_KEY"] = os.environ.get("SESSION_SECRET", "yasmin-dev-secret-key")

# === التعديل الرئيسي هنا: استخدام متغير البيئة لسلسلة اتصال قاعدة البيانات ===
# Render سيقوم بتعيين متغير البيئة 'DATABASE_URL' تلقائياً عند ربط خدمة الويب بقاعدة بيانات PostgreSQL.
# نستخدم os.environ.get للحصول على هذه القيمة، مع fallback لـ SQLite للتطوير المحلي إذا لم يتم تعيين المتغير.
# قم بتغيير هذا لـ 'sqlite:///yasmin.db' فقط إذا كنت تريد تشغيل التطبيق محلياً بالـ SQLite ولا تستخدم متغير بيئة
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL") 
# =========================================================================

# تعطيل تتبع تعديلات الكائنات في SQLAlchemy لتجنب استهلاك الذاكرة غير الضروري
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# تهيئة قاعدة البيانات مع إعدادات التطبيق
db.init_app(app)

# === تمت إزالة كتلة db.create_all() من هنا ===
# يجب تشغيل db.create_all() أو migrations كخطوة منفصلة قبل بدء الخادم الرئيسي
# انظر التعليمات أدناه حول إنشاء سكربت create_tables.py وتعديل أمر التشغيل في Render
# ==============================================


# تهيئة مدير تسجيل الدخول للمصادقة وإدارة المستخدمين
login_manager = LoginManager()
login_manager.init_app(app)
# تحديد نقطة النهاية لصفحة تسجيل الدخول
login_manager.login_view = 'login'
# رسالة تظهر للمستخدمين غير المسجلين الذين يحاولون الوصول لصفحات محمية
login_manager.login_message = 'يرجى تسجيل الدخول للوصول إلى هذه الصفحة.'

# تهيئة SocketIO للاتصالات في الوقت الحقيقي (Real-time communication)
socketio = SocketIO(
    app,
    cors_allowed_origins="*", # السماح بالطلبات من أي أصل (للتطوير/الاختبار، قد تحتاج لتحديد أصول معينة في الإنتاج)
    async_mode='eventlet', # استخدام eventlet كوضع غير متزامن
    logger=True, # تمكين سجلات SocketIO
    engineio_logger=True, # تمكين سجلات EngineIO
    ping_timeout=60, # المهلة قبل اعتبار العميل غير متصل (بالثواني)
    ping_interval=25 # الفاصل الزمني لإرسال حزم ping للتحقق من اتصال العميل (بالثواني)
)

# دالة لتحميل المستخدم من قاعدة البيانات بناءً على معرف المستخدم (ID)
@login_manager.user_loader
def load_user(user_id):
    # استيراد نموذج User هنا لتجنب مشاكل الاستيراد الدائري إذا كان models.py يستورد app
    from models import User
    return User.query.get(int(user_id))

# استيراد المسارات (Routes) بعد تهيئة التطبيق وقاعدة البيانات
# تأكد من وجود ملف routes.py يحتوي على تعريف مسارات التطبيق
from routes import *


# هذا الجزء يستخدم لتشغيل التطبيق محلياً باستخدام SocketIO/eventlet
# في بيئة الإنتاج على Render، سيقوم Gunicorn بتشغيل التطبيق
# و eventlet.monkey_patch() سيضمن التوافق مع SocketIO.
# لذلك، يمكنك ترك هذا الجزء معلقاً أو استخدامه للاختبار المحلي.
# if __name__ == '__main__':
#     # استخدم المنفذ الذي تحدده Render أو المنفذ الافتراضي 5000 محلياً
#     port = int(os.environ.get('PORT', 5000))
#     socketio.run(app, debug=True, host='0.0.0.0', port=port)
