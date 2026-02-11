/* --- FILE: audioManager.js (Hoặc đầu file popupDictionary.js) --- */

// 1. Cấu hình mặc định (Sau này sẽ lấy từ Storage)
const AudioConfig = {
    autoPlay: true,           // Tự động phát khi hiện popup
    preferredAccent: 'US',    // 'US' (Mỹ) hoặc 'UK' (Anh)
    maxDisplay: 3,            // Chỉ hiện tối đa 3 loa
    shortcuts: {
        playPrimary: 'Space', // Phím Space (kết hợp Ctrl)
        playAll: 'KeyA'       // Phím A (kết hợp Ctrl)
    }
};

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
