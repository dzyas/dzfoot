import json
import os
import logging
from openai import OpenAI
import base64

logger = logging.getLogger(__name__)

# Initialize OpenAI client with API key
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

def generate_chat_response(messages, model="gpt-4", temperature=0.7, max_tokens=1500):
    try:
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key not found")
            return "عذراً، مفتاح API غير متوفر"

        # Add Arabic instruction
        messages.insert(0, {
            "role": "system", 
            "content": "يجب تقديم الإجابات باللغة العربية الفصحى مع التشكيل للكلمات المهمة."
        })

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        return "عذراً، حدث خطأ في معالجة الطلب"

def analyze_image_with_openai(image_path):
    try:
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')

        response = client.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "قم بتحليل هذه الصورة بالتفصيل باللغة العربية"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            }],
            max_tokens=800
        )

        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        return "عذراً، حدث خطأ في تحليل الصورة"

def generate_image_with_openai(prompt, size="1024x1024", style="vivid"):
    try:
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key not found")
            return None

        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            n=1,
            size="1024x1024",
            quality="standard"
        )

        return {"url": response.data[0].url}
    except Exception as e:
        logger.error(f"Image generation error: {e}")
        return None

def generate_code(prompt, language=None):
    try:
        system_prompt = "أنت مبرمج محترف. اكتب كوداً عالي الجودة."
        if language:
            system_prompt += f" استخدم لغة {language}."

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )

        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Code generation error: {e}")
        return "عذراً، حدث خطأ في توليد الكود"