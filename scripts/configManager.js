console.log("Config Manager module loaded");

// configManager.js

// 1. Đối tượng chứa các giá trị mặc định (Default Settings)
// Tại sao: Để nếu người dùng chưa cài đặt gì, Extension vẫn chạy được mà không bị lỗi undefined.
const DEFAULT_CONFIG = {
    tts: {
        enabled: true,
        autoPlay: false,
        voices: ["", "", ""], // Slot 1, 2, 3
        preferredLang: "en-US"
    },
    image: {
        enabled: true,
        autoLoadCount: 3
    }
};

// 2. Hàm lấy toàn bộ cài đặt
// Tại sao: Dùng async/await để code trông như đọc văn bản, không bị "callback hell".
export async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["userConfig"], (result) => {
            // Merge cài đặt của user với mặc định (cái gì user chưa chỉnh thì lấy mặc định)
            resolve(result.userConfig || DEFAULT_CONFIG);
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