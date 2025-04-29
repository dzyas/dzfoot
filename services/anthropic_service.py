"""
خدمة Anthropic Claude API
"""
import os
import json
import logging
from anthropic import Anthropic

# الحصول على مفتاح API من المتغيرات البيئية
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    logging.warning("ANTHROPIC_API_KEY is not set. Anthropic services may not work.")

client = Anthropic(api_key=ANTHROPIC_API_KEY)

def generate_claude_response(messages, model="claude-3-5-sonnet-20241022", temperature=0.7, max_tokens=2000):
    """
    إنشاء رد باستخدام نماذج Claude من Anthropic
    the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
    """
    try:
        # تحويل رسائل بتنسيق OpenAI إلى تنسيق Anthropic
        anthropic_messages = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content")
            
            if role == "system":
                # رسائل النظام يتم التعامل معها بشكل مختلف في Anthropic
                anthropic_messages.append({
                    "role": "user",
                    "content": f"System: {content}"
                })
                anthropic_messages.append({
                    "role": "assistant",
                    "content": "I'll follow those instructions."
                })
            else:
                # تحويل أدوار OpenAI (user, assistant) إلى أدوار Anthropic
                anthropic_role = role if role in ["user", "assistant"] else "user"
                anthropic_messages.append({
                    "role": anthropic_role,
                    "content": content
                })
        
        # إرسال الطلب إلى Anthropic API
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=anthropic_messages
        )
        
        return response.content[0].text
    except Exception as e:
        logging.error(f"Error generating Claude response: {e}")
        return None

def format_image_for_claude(image_path):
    """تنسيق صورة للاستخدام مع واجهة برمجة تطبيقات Claude المتعددة الوسائط"""
    import base64
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def analyze_image_with_claude(image_path, prompt="قم بوصف هذه الصورة بالتفصيل باللغة العربية."):
    """
    تحليل صورة باستخدام قدرات الرؤية في Claude
    """
    try:
        image_base64 = format_image_for_claude(image_path)
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64
                            }
                        }
                    ]
                }
            ]
        )
        
        return response.content[0].text
    except Exception as e:
        logging.error(f"Error analyzing image with Claude: {e}")
        return "حدث خطأ أثناء تحليل الصورة. يرجى المحاولة مرة أخرى."