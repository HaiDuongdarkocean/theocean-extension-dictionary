console.log("Config Manager module loaded");

// configManager.js

// 1. Đối tượng chứa các giá trị mặc định (Default Settings)
// Tại sao: Để nếu người dùng chưa cài đặt gì, Extension vẫn chạy được mà không bị lỗi undefined.
const DEFAULT_CONFIG = {
    tts: {
        enabled: true,
        autoPlay: false,
        voices: ["", "", ""], // Slot 1, 2, 3
        preferredLang: "en-US",
        maxDisplay: 1,
        autoplayCount: 0
    },
    sentence: {
        showSentence: true,
        showTranslation: true,
    },
    translateEnabled: false,
    lookupMode: "hover",
    lookupResultMode: "stacked", // "stacked" | "first_match"
    forvo: {
        enabled: true,
        mode: "auto", // "auto" | "manual"
        maxDisplay: 3,
        autoplayCount: 1,
        autoplayOnNavigate: false
    },
    image: {
        enabled: true,
        autoLoadCount: 3,
        maxLinks: 20,
        retryLimit: 5
    },
    popup: {
        defaultFeature: "forvo" // "forvo" | "images" | "tts" | "sentence" | "none"
    }
};

// 2. Hàm lấy toàn bộ cài đặt
// Tại sao: Dùng async/await để code trông như đọc văn bản, không bị "callback hell".
export async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["userConfig"], (result) => {
            const userCfg = result.userConfig || {};
            resolve({
                ...DEFAULT_CONFIG,
                ...userCfg,
                tts: {
                    ...DEFAULT_CONFIG.tts,
                    ...(userCfg.tts || {}),
                },
                sentence: {
                    ...DEFAULT_CONFIG.sentence,
                    ...(userCfg.sentence || {}),
                },
                forvo: {
                    ...DEFAULT_CONFIG.forvo,
                    ...(userCfg.forvo || {}),
                },
                image: {
                    ...DEFAULT_CONFIG.image,
                    ...(userCfg.image || {}),
                },
                popup: {
                    ...DEFAULT_CONFIG.popup,
                    ...(userCfg.popup || {}),
                },
            });
        });
    });
}

// 3. Hàm lưu cài đặt
export async function saveConfig(newConfig) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ userConfig: newConfig }, () => {
            console.log("✅ Đã lưu cài đặt mới");
            resolve();
        });
    });
}

// // Giả lập lưu dữ liệu
// chrome.storage.sync.set({ 
//     userConfig: { tts: { enabled: false, voices: ["Google US English"] } } 
// }, () => {
//     console.log("1. Đã lưu thử");
    
//     // Thử lấy ra xem có đúng không
//     chrome.storage.sync.get(["userConfig"], (res) => {
//         console.log("2. Dữ liệu lấy ra:", res.userConfig);
//         console.log("3. Trạng thái TTS:", res.userConfig.tts.enabled ? "Đang Bật" : "Đang Tắt");
//     });
// });
