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
        let done = false;
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            resolve([]);
        }, 5000);

        const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim();
        const readSpeakerMeta = (button, fallbackCountry) => {
            const row = button.closest("li") || button.closest(".pronunciations") || button.parentElement;
            const profileAnchor =
                row?.querySelector(".ofLink a") ||
                row?.querySelector(".ofLink") ||
                row?.querySelector('a[href*="/profiles/"]');
            const speaker = normalize(profileAnchor?.textContent) || "Unknown speaker";

            const fromText = normalize(row?.querySelector(".from")?.textContent || "");
            const regionText = normalize(fromText.replace(/^from\s+/i, ""));
            const region = regionText || fallbackCountry || "Unknown region";

            return { speaker, region };
        };

        const parseContainer = (container, fallbackCountry, results) => {
            if (!container) return;
            const playButtons = container.querySelectorAll(".play");
            playButtons.forEach((btn) => {
                const onClickAttr = btn.getAttribute("onclick") || "";
                const match = onClickAttr.match(/Play\(\d+,'([^']+)'/i);
                if (!match || !match[1]) return;
                const { speaker, region } = readSpeakerMeta(btn, fallbackCountry);
                results.push({
                    url: `https://audio00.forvo.com/mp3/${atob(match[1])}`,
                    country: fallbackCountry,
                    region,
                    speaker,
                });
            });
        };

        chrome.runtime.sendMessage({ action: "fetchForvo", term: term }, (response) => {
            if (done) return;
            done = true;
            clearTimeout(timer);

            if (!response || !response.success) {
                resolve([]);
                return;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(response.data, "text/html");
            const results = [];

            parseContainer(doc.querySelector("#pronunciations-list-en_uk"), "United Kingdom", results);
            parseContainer(doc.querySelector("#pronunciations-list-en_usa"), "United States", results);

            resolve(results);
        });
    });
}
