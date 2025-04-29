import os
import logging
import google.generativeai as genai
import base64

logger = logging.getLogger(__name__)

# Initialize the Gemini API
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    logger.warning("Google API key not found. Gemini services will not be available.")

def generate_gemini_response(messages, model="gemini-1.5-pro", temperature=0.7, max_tokens=2000):
    """
    Generate a chat response using Google's Gemini API
    """
    try:
        if not GOOGLE_API_KEY:
            logger.warning("Google API key not found, returning None")
            return None
        
        # Configure the model
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
            "top_p": 0.95,
            "top_k": 40,
        }
        
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
        
        # Convert messages from OpenAI format to Gemini format
        gemini_messages = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            gemini_messages.append({"role": role, "parts": [msg["content"]]})
        
        # Initialize the model
        model = genai.GenerativeModel(
            model_name=model,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        
        # Generate response
        chat = model.start_chat(history=gemini_messages)
        response = chat.send_message(gemini_messages[-1]["parts"][0])
        
        return response.text
    except Exception as e:
        logger.error(f"Error generating Gemini response: {e}")
        return None

def analyze_image_with_gemini(image_path, prompt="قم بوصف هذه الصورة بالتفصيل باللغة العربية."):
    """
    Analyze an image using Gemini's vision capabilities
    """
    try:
        if not GOOGLE_API_KEY:
            logger.warning("Google API key not found, returning None")
            return None
        
        # Load the image
        with open(image_path, "rb") as f:
            image_data = f.read()
        
        # Configure the model
        generation_config = {
            "temperature": 0.4,
            "max_output_tokens": 1024,
            "top_p": 0.95,
            "top_k": 40,
        }
        
        # Initialize the model
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            generation_config=generation_config
        )
        
        # Generate response
        response = model.generate_content([prompt, {"mime_type": "image/jpeg", "data": image_data}])
        
        return response.text
    except Exception as e:
        logger.error(f"Error analyzing image with Gemini: {e}")
        return "حدث خطأ أثناء تحليل الصورة. يرجى المحاولة مرة أخرى."