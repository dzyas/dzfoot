import json
import os
import logging
from openai import OpenAI
from PIL import Image
import base64
import io

logger = logging.getLogger(__name__)

# Initialize OpenAI client with API key
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

def generate_chat_response(messages, model="gpt-4o"):
    """
    Generate a chat response using OpenAI's chat completion API
    # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
    # do not change this unless explicitly requested by the user
    """
    try:
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key not found, returning None")
            return None

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=1500
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating OpenAI chat response: {e}")
        return None

def analyze_sentiment(text):
    """
    Analyze the sentiment of a text using OpenAI
    Returns a rating from 1-5 and confidence score
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are a sentiment analysis expert. "
                    + "Analyze the sentiment of the text and provide a rating "
                    + "from 1 to 5 stars and a confidence score between 0 and 1. "
                    + "Respond with JSON in this format: "
                    + "{'rating': number, 'confidence': number}",
                },
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "rating": max(1, min(5, round(result["rating"]))),
            "confidence": max(0, min(1, result["confidence"])),
        }
    except Exception as e:
        logger.error(f"Failed to analyze sentiment: {e}")
        return {"rating": 3, "confidence": 0}

def analyze_image_with_openai(image_path):
    """
    Analyze an image using OpenAI's vision capabilities
    """
    try:
        # Convert image to base64 string
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "قم بتحليل هذه الصورة بالتفصيل باللغة العربية. صف العناصر الرئيسية فيها، والسياق، وأي جوانب ملحوظة. ركز على وصف دقيق وشامل.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                        },
                    ],
                }
            ],
            max_tokens=800,
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error analyzing image with OpenAI: {e}")
        return "حدث خطأ أثناء تحليل الصورة. يرجى المحاولة مرة أخرى."

def generate_image_with_openai(prompt):
    """
    Generate an image using DALL-E 3
    """
    try:
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key not found, returning None")
            return None
            
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            n=1,
            size="1024x1024",
        )
        
        return {"url": response.data[0].url}
    except Exception as e:
        logger.error(f"Error generating image with OpenAI: {e}")
        return None

def generate_code(prompt, language=None):
    """
    Generate code based on a description
    """
    try:
        system_prompt = "أنت مبرمج محترف. اكتب كودًا عالي الجودة استنادًا إلى الوصف المقدم."
        
        if language:
            system_prompt += f" استخدم لغة {language} لكتابة الكود."
        
        system_prompt += " قدم تعليقات توضيحية وشرحًا للكود. تأكد من أن الكود قابل للتنفيذ وخالٍ من الأخطاء."
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating code with OpenAI: {e}")
        return "حدث خطأ أثناء توليد الكود. يرجى المحاولة مرة أخرى."