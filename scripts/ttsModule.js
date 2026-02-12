console.log("TTS module loaded");

// ttsModule.js

export const TTSModule = {
    // 1. Lấy danh sách giọng đọc từ trình duyệt
    getAvailableVoices: () => {
        return new Promise((resolve) => {
            const voices = chrome.tts.getVoices((v) => resolve(v));
        });
    },

    // 2. Hàm phát âm thanh
    // Tại sao: Tách riêng để sau này nếu con muốn đổi từ Chrome TTS sang Edge TTS, 
    // con chỉ cần sửa đúng 1 chỗ này thôi.
    speak: (text, voiceName) => {
        if (!text) return;
        
        const options = {
            rate: 1.0,
            pitch: 1.0,
            onEvent: (event) => {
                if (event.type === 'start') console.log("📣 Đang nói...");
                if (event.type === 'end') console.log("🏁 Nói xong.");
            }
        };

        if (voiceName) options.voiceName = voiceName;

        chrome.tts.speak(text, options);
    },

    // 3. Dừng nói
    stop: () => {
        chrome.tts.stop();
    }
};