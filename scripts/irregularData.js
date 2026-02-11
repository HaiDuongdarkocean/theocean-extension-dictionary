// A. DANH TỪ BẤT QUY TẮC
// Cấu trúc: [Số ít, Số nhiều]
const irregularNounsSource = [
    ["man", "men"],
    ["woman", "women"],
    ["child", "children"],
    ["tooth", "teeth"],
    ["foot", "feet"],
    ["person", "people"],
    ["mouse", "mice"],
    ["goose", "geese"],
    ["ox", "oxen"],
    ["louse", "lice"],
    ["datum", "data"],
    ["medium", "media"],
    ["bacterium", "bacteria"],
    ["curriculum", "curricula"],
    ["analysis", "analyses"],
    ["crisis", "crises"],
    ["thesis", "theses"],
    ["basis", "bases"],
    ["phenomenon", "phenomena"],
    ["criterion", "criteria"],
    ["sheep", "sheep"], // Không đổi
    ["fish", "fish"],
    ["deer", "deer"],
    ["series", "series"],
    ["species", "species"],
    ["aircraft", "aircraft"],
    ["vita", "vitae"],
    ["focus", "foci"],
    ["nucleus", "nuclei"],
    ["fungus", "fungi"],
    ["cactus", "cacti"],
    ["stimulus", "stimuli"],
    ["syllabus", "syllabi"],
    ["vertebra", "vertebrae"]
];

// B. ĐỘNG TỪ BẤT QUY TẮC (Top phổ biến)
// Cấu trúc: [V1 (Nguyên thể), V2 (Quá khứ), V3 (Phân từ 2)]
const irregularVerbsSource = [
    ["be", "was/were", "been"], // Trường hợp đặc biệt sẽ xử lý riêng
    ["become", "became", "become"],
    ["begin", "began", "begun"],
    ["break", "broke", "broken"],
    ["bring", "brought", "brought"],
    ["build", "built", "built"],
    ["buy", "bought", "bought"],
    ["catch", "caught", "caught"],
    ["choose", "chose", "chosen"],
    ["come", "came", "come"],
    ["cost", "cost", "cost"],
    ["cut", "cut", "cut"],
    ["do", "did", "done"],
    ["draw", "drew", "drawn"],
    ["drink", "drank", "drunk"],
    ["drive", "drove", "driven"],
    ["eat", "ate", "eaten"],
    ["fall", "fell", "fallen"],
    ["feel", "felt", "felt"],
    ["fight", "fought", "fought"],
    ["find", "found", "found"],
    ["fly", "flew", "flown"],
    ["forget", "forgot", "forgotten"],
    ["get", "got", "gotten"], // US English (UK là got)
    ["give", "gave", "given"],
    ["go", "went", "gone"],
    ["grow", "grew", "grown"],
    ["have", "had", "had"],
    ["hear", "heard", "heard"],
    ["hit", "hit", "hit"],
    ["hold", "held", "held"],
    ["hurt", "hurt", "hurt"],
    ["keep", "kept", "kept"],
    ["know", "knew", "known"],
    ["leave", "left", "left"],
    ["let", "let", "let"],
    ["lose", "lost", "lost"],
    ["make", "made", "made"],
    ["mean", "meant", "meant"],
    ["meet", "met", "met"],
    ["pay", "paid", "paid"],
    ["put", "put", "put"],
    ["read", "read", "read"], // Lưu ý: Viết giống nhau nhưng đọc khác
    ["run", "ran", "run"],
    ["say", "said", "said"],
    ["see", "saw", "seen"],
    ["sell", "sold", "sold"],
    ["send", "sent", "sent"],
    ["show", "showed", "shown"], // V2 có thể là showed, V3 shown
    ["shut", "shut", "shut"],
    ["sing", "sang", "sung"],
    ["sit", "sat", "sat"],
    ["sleep", "slept", "slept"],
    ["speak", "spoke", "spoken"],
    ["spend", "spent", "spent"],
    ["stand", "stood", "stood"],
    ["swim", "swam", "swum"],
    ["take", "took", "taken"],
    ["teach", "taught", "taught"],
    ["tell", "told", "told"],
    ["think", "thought", "thought"],
    ["throw", "threw", "thrown"],
    ["understand", "understood", "understood"],
    ["wake", "woke", "woken"],
    ["wear", "wore", "worn"],
    ["win", "won", "won"],
    ["write", "wrote", "written"]
];

// Khởi tạo Map
const irregularMap = new Map();

// 1. NẠP DANH TỪ
irregularNounsSource.forEach(([singular, plural]) => {
    // Nếu gặp từ "men", trả về gốc "man"
    irregularMap.set(plural, { 
        root: singular, 
        type: "noun_plural",
        desc: "Danh từ số nhiều bất quy tắc" 
    });
});

// 2. NẠP ĐỘNG TỪ
irregularVerbsSource.forEach(([v1, v2, v3]) => {
    // Xử lý trường hợp đặc biệt "was/were"
    if (v2.includes('/')) {
        const variants = v2.split('/');
        variants.forEach(variant => {
            irregularMap.set(variant, { root: v1, type: "verb_past_v2", desc: "Quá khứ đơn (V2)" });
        });
    } else {
        // Nạp V2
        // Kiểm tra xem đã có chưa (tránh ghi đè nếu V2 giống V1, ví dụ: cut)
        if (!irregularMap.has(v2)) {
             irregularMap.set(v2, { root: v1, type: "verb_past_v2", desc: "Quá khứ đơn (V2)" });
        }
    }

    // Nạp V3
    // Kiểm tra xem đã có chưa (tránh ghi đè nếu V3 giống V2 hoặc V1)
    // Ưu tiên V3 nếu nó khác V2 (như 'gone' vs 'went')
    // Nếu V2 == V3 (như 'met'), thì giữ nguyên là V2/V3
    if (!irregularMap.has(v3)) {
        irregularMap.set(v3, { root: v1, type: "verb_participle_v3", desc: "Quá khứ phân từ (V3)" });
    } else {
        // Nếu từ này đã tồn tại (ví dụ 'cut' đã được nạp ở V1 hoặc V2), ta cập nhật thêm tag
        const existing = irregularMap.get(v3);
        if (existing.root === v1 && !existing.type.includes("v3")) {
             existing.type += "/v3"; // Đánh dấu là cả V2 và V3
             existing.desc += " & Phân từ 2";
        }
    }
});

// XUẤT RA GLOBAL ĐỂ DÙNG Ở CÁC FILE KHÁC
window.irregularMap = irregularMap;

console.log("--- ĐÃ NẠP XONG BẢN ĐỒ BẤT QUY TẮC ---");
console.log(`Đã học được: ${irregularMap.size} biến thể từ.`);
// Test thử
console.log("Tra 'mice':", irregularMap.get("mice"));
console.log("Tra 'went':", irregularMap.get("went"));
console.log("Tra 'written':", irregularMap.get("written"));