/* --- FILE: audioManager.js (Hoặc đầu file popupDictionary.js) --- */

// Keep a mutable config object so popupDictionary.js can read updated values.
const AudioConfig = {
  forvoEnabled: true,
  forvoMode: "auto", // "auto" | "manual"
  autoPlayCount: 1,
  preferredAccent: "US",
  maxDisplay: 3,
  shortcuts: {
    playPrimary: "Space",
    playAll: "KeyA",
  },
};

function loadAudioConfig() {
  chrome.storage.sync.get(["userConfig"], (result) => {
    const cfg = result.userConfig || {};
    const forvo = cfg.forvo || {};

    AudioConfig.forvoEnabled = forvo.enabled !== false;
    AudioConfig.forvoMode = forvo.mode || "auto";
    AudioConfig.maxDisplay = Math.min(3, Math.max(1, Number(forvo.maxDisplay) || 3));
    const rawAuto = Number(forvo.autoplayCount);
    const auto = Number.isFinite(rawAuto) ? rawAuto : 1;
    AudioConfig.autoPlayCount = Math.max(0, Math.min(AudioConfig.maxDisplay, auto));
  });
}

loadAudioConfig();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.userConfig) {
    loadAudioConfig();
  }
});

window.AudioConfig = AudioConfig;

// 2. Hàm lọc và sắp xếp Audio (Quan trọng nhất)
function processAudioList(rawList) {
    if (!rawList || rawList.length === 0) return [];

    // Bước 2.1: Phân loại điểm số ưu tiên
    // Nếu thích US: US = 2 điểm, UK = 1 điểm, Khác = 0 điểm
    const scoredList = rawList.map(item => {
        let score = 0;
        const country = item.country || "";
        
        if (AudioConfig.preferredAccent === 'US') {
            if (country.includes("United States")) score = 2;
            else if (country.includes("United Kingdom")) score = 1;
        } else { // Thích UK hơn
            if (country.includes("United Kingdom")) score = 2;
            else if (country.includes("United States")) score = 1;
        }
        
        // Ưu tiên thêm cho bản thu có nhiều vote (nếu có dữ liệu vote)
        // item.votes là giả định, Forvo có trường này
        if (item.votes) score += (item.votes * 0.1); 

        return { ...item, score };
    });

    // Bước 2.2: Sắp xếp dựa trên điểm số (Cao xếp trước)
    scoredList.sort((a, b) => b.score - a.score);

    // Bước 2.3: Cắt lấy top 3 và trả về
    return {
        topList: scoredList.slice(0, AudioConfig.maxDisplay),
        hasMore: scoredList.length > AudioConfig.maxDisplay,
        fullList: scoredList // Lưu lại để dùng cho nút "More"
    };
}

async function fetchAudioFromForvo(term) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "fetchForvo", term: term }, (response) => {

            if (!response || !response.success) {
                resolve([]);
                return;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(response.data, "text/html");

            const results = [];

            // ===== 1️⃣ LẤY UK =====
            const ukContainer = doc.querySelector("#pronunciations-list-en_uk");
            if (ukContainer) {
                const ukButtons = ukContainer.querySelectorAll(".play");

                ukButtons.forEach(btn => {
                    const onClickAttr = btn.getAttribute("onclick");
                    const match = onClickAttr?.match(/Play\(\d+,'([^']+)'/i);

                    if (match && match[1]) {
                        results.push({
                            url: `https://audio00.forvo.com/mp3/${atob(match[1])}`,
                            country: "United Kingdom"
                        });
                    }
                });
            }

            // ===== 2️⃣ LẤY US =====
            const usContainer = doc.querySelector("#pronunciations-list-en_usa");
            if (usContainer) {
                const usButtons = usContainer.querySelectorAll(".play");

                usButtons.forEach(btn => {
                    const onClickAttr = btn.getAttribute("onclick");
                    const match = onClickAttr?.match(/Play\(\d+,'([^']+)'/i);

                    if (match && match[1]) {
                        results.push({
                            url: `https://audio00.forvo.com/mp3/${atob(match[1])}`,
                            country: "United States"
                        });
                    }
                });
            }

            resolve(results);
        });
    });
}
