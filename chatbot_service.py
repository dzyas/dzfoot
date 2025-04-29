
import os
import logging
from flask import current_app
import google.generativeai as genai
from openai import OpenAI
from anthropic import Anthropic
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

def initialize_api_clients():
    """تهيئة عملاء API مع معالجة الأخطاء"""
    clients = {}
    
    # OpenAI
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            clients['openai'] = OpenAI(api_key=api_key)
        else:
            logger.warning("OpenAI API key not found")
    except Exception as e:
        logger.error(f"Error initializing OpenAI client: {e}")
    
    # Anthropic
    try:
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if api_key:
            clients['anthropic'] = Anthropic(api_key=api_key)
        else:
            logger.warning("Anthropic API key not found")
    except Exception as e:
        logger.error(f"Error initializing Anthropic client: {e}")
    
    return clients

# Initialize API clients
api_clients = initialize_api_clients()

class ChatbotService:
    def __init__(self):
        self.clients = api_clients
        
    def analyze_sentiment(self, message: str) -> dict:
        """تحليل المشاعر في الرسالة"""
        try:
            if 'openai' in self.clients:
                response = self.clients['openai'].chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{
                        "role": "system",
                        "content": "قم بتحليل مشاعر النص التالي وإرجاع النتيجة كـ JSON يحتوي على: المشاعر الرئيسية، درجة الإيجابية (0-1)، والسياق العاطفي"
                    }, {
                        "role": "user",
                        "content": message
                    }]
                )
                return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error in sentiment analysis: {e}")
            return {"error": "فشل تحليل المشاعر"}
    
    def generate_summary(self, messages: list) -> str:
        """توليد ملخص للمحادثة"""
        try:
            if 'openai' in self.clients:
                conversation = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])
                response = self.clients['openai'].chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{
                        "role": "system",
                        "content": "قم بتلخيص المحادثة التالية في نقاط رئيسية موجزة"
                    }, {
                        "role": "user",
                        "content": conversation
                    }]
                )
                return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return "فشل توليد الملخص"
    
    def get_response(self, message: str) -> str:
        """Get response from available AI models"""
        try:
            # Try OpenAI first
            if 'openai' in self.clients:
                response = self.clients['openai'].chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": message}]
                )
                return response.choices[0].message.content
                
            # Fallback to Anthropic
            if 'anthropic' in self.clients:
                response = self.clients['anthropic'].messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=1000,
                    messages=[{"role": "user", "content": message}]
                )
                return response.content
                
            return "عذراً، لا يمكنني الوصول إلى أي نموذج ذكاء اصطناعي حالياً."
            
        except Exception as e:
            logger.error(f"Error in chatbot response: {e}")
            return "عذراً، حدث خطأ أثناء معالجة رسالتك."
