# create_tables.py
import os
# تأكد من أن مسار الاستيراد صحيح بناءً على هيكل مشروعك
from app import app, db
from models import * # استيراد جميع النماذج للتأكد من أن db.create_all يراها

with app.app_context():
    print("Checking/creating database tables...")
    # db.drop_all() # اختياري: لإعادة إنشاء كل شيء من الصفر في كل مرة (للتطوير فقط!)
    db.create_all()
    print("Database tables checked/created successfully.")
