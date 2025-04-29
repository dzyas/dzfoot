/**
 * هذا الملف يتعامل مع اختيار النماذج في القائمة الجانبية
 * ويتيح الاختيار بين مختلف نماذج الذكاء الاصطناعي
 */

document.addEventListener('DOMContentLoaded', function() {
    // التعامل مع اختيار النماذج في القائمة الجانبية
    const assistantModels = document.querySelectorAll('.assistant-model');

    // دالة لتحويل النص إلى كلام
    function speakText(text) {
        fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                voice_id: "21m00Tcm4TlvDq8ikWAM" // صوت راشيل العربي
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.audio) {
                const audio = new Audio('data:audio/mpeg;base64,' + data.audio);
                audio.play();
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // تحديد النموذج المحفوظ سابقاً
    const savedModel = localStorage.getItem('model') || 'gpt-4o';

    // تحديث المتغير currentModel في app.js إذا كان موجوداً
    if (window.currentModel !== undefined) {
        window.currentModel = savedModel;
    }

    // تعيين النموذج النشط
    assistantModels.forEach(model => {
        const modelId = model.getAttribute('data-model');

        // تحديد النموذج المحفوظ كنشط
        if (modelId === savedModel) {
            model.classList.add('active');
        }

        // إضافة حدث النقر لاختيار النموذج
        model.addEventListener('click', function() {
            // إزالة الفئة النشطة من جميع النماذج
            assistantModels.forEach(m => m.classList.remove('active'));

            // إضافة الفئة النشطة للنموذج المحدد
            this.classList.add('active');

            // حفظ النموذج المحدد في التخزين المحلي
            const selectedModel = this.getAttribute('data-model');
            localStorage.setItem('model', selectedModel);

            // تحديث المتغير currentModel في app.js إذا كان موجوداً
            if (window.currentModel !== undefined) {
                window.currentModel = selectedModel;
            }

            // عرض إشعار بالنموذج المحدد
            if (window.showToast) {
                const modelName = this.querySelector('.model-name').textContent;
                window.showToast(`تم اختيار ${modelName}`, 'success');

                // تشغيل الصوت عند اختيار النموذج
                speakText(`تم اختيار ${modelName}`);
            }
        });

        // إضافة زر الصوت لكل نموذج
        const soundButton = document.createElement('button');
        soundButton.className = 'sound-button';
        soundButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        soundButton.onclick = (e) => {
            e.stopPropagation();
            const modelName = model.querySelector('.model-name').textContent;
            speakText(modelName);
        };
        model.appendChild(soundButton);
    });
});