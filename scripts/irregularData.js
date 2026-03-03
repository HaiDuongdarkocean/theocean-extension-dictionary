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
  ["abide", "abode/abided", "abode/abided"],
  ["arise", "arose", "arisen"],
  ["awake", "awoke", "awoken"],
  ["backslide", "backslid", "backslidden"],
  ["be", "was/were", "been"], // Trường hợp đặc biệt sẽ xử lý riêng
  ["bear", "bore", "born"],
  ["beat", "beat", "beaten"],
  ["become", "became", "become"],
  ["befall", "befell", "befallen"],
  ["begin", "began", "begun"],
  ["behold", "beheld", "beheld"],
  ["bend", "bent", "bent"],
  ["beset", "beset", "beset"],
  ["bespeak", "bespoke", "bespoken"],
  ["bet", "bet", "bet"],
  ["bid", "bid", "bid"],
  ["bind", "bound", "bound"],
  ["bite", "bit", "bitten"],
  ["bleed", "bled", "bled"],
  ["blow", "blew", "blown"],
  ["break", "broke", "broken"],
  ["breed", "bred", "bred"],
  ["bring", "brought", "brought"],
  ["broadcast", "broadcast", "broadcast"],
  ["browbeat", "browbeat", "browbeaten"],
  ["build", "built", "built"],
  ["burn", "burnt/burned", "burnt/burned"],
  ["burst", "burst", "burst"],
  ["bust", "bust/busted", "bust/busted"],
  ["buy", "bought", "bought"],
  ["cast", "cast", "cast"],
  ["catch", "caught", "caught"],
  ["choose", "chose", "chosen"],
  ["cling", "clung", "clung"],
  ["clothe", "clothed/clad", "clothed/clad"],
  ["come", "came", "come"],
  ["cost", "cost", "cost"],
  ["creep", "crept", "crept"],
  ["cut", "cut", "cut"],
  ["deal", "dealt", "dealt"],
  ["dig", "dug", "dug"],
  ["dive", "dove/dived", "dived"],
  ["do", "did", "done"],
  ["draw", "drew", "drawn"],
  ["dream", "dreamt/dreamed", "dreamt/dreamed"],
  ["drink", "drank", "drunk"],
  ["drive", "drove", "driven"],
  ["eat", "ate", "eaten"],
  ["fall", "fell", "fallen"],
  ["feed", "fed", "fed"],
  ["feel", "felt", "felt"],
  ["fight", "fought", "fought"],
  ["find", "found", "found"],
  ["flee", "fled", "fled"],
  ["fly", "flew", "flown"],
  ["forbid", "forbade", "forbidden"],
  ["forget", "forgot", "forgotten"],
  ["forgive", "forgave", "forgiven"],
  ["freeze", "froze", "frozen"],
  ["get", "got", "got/gotten"],
  ["give", "gave", "given"],
  ["go", "went", "gone"],
  ["grow", "grew", "grown"],
  ["hang", "hung", "hung"],
  ["have", "had", "had"],
  ["hear", "heard", "heard"],
  ["hide", "hid", "hidden"],
  ["hit", "hit", "hit"],
  ["hold", "held", "held"],
  ["hurt", "hurt", "hurt"],
  ["keep", "kept", "kept"],
  ["know", "knew", "known"],
  ["lay", "laid", "laid"],
  ["lead", "led", "led"],
  ["leave", "left", "left"],
  ["lend", "lent", "lent"],
  ["let", "let", "let"],
  ["lie", "lay", "lain"],
  ["lose", "lost", "lost"],
  ["make", "made", "made"],
  ["mean", "meant", "meant"],
  ["meet", "met", "met"],
  ["pay", "paid", "paid"],
  ["put", "put", "put"],
  ["read", "read", "read"],
  ["ride", "rode", "ridden"],
  ["ring", "rang", "rung"],
  ["rise", "rose", "risen"],
  ["run", "ran", "run"],
  ["say", "said", "said"],
  ["see", "saw", "seen"],
  ["seek", "sought", "sought"],
  ["sell", "sold", "sold"],
  ["send", "sent", "sent"],
  ["set", "set", "set"],
  ["shake", "shook", "shaken"],
  ["shine", "shone", "shone"],
  ["shoot", "shot", "shot"],
  ["show", "showed", "shown"],
  ["shut", "shut", "shut"],
  ["sing", "sang", "sung"],
  ["sink", "sank", "sunk"],
  ["sit", "sat", "sat"],
  ["sleep", "slept", "slept"],
  ["speak", "spoke", "spoken"],
  ["spend", "spent", "spent"],
  ["stand", "stood", "stood"],
  ["steal", "stole", "stolen"],
  ["swim", "swam", "swum"],
  ["take", "took", "taken"],
  ["teach", "taught", "taught"],
  ["tear", "tore", "torn"],
  ["tell", "told", "told"],
  ["think", "thought", "thought"],
  ["throw", "threw", "thrown"],
  ["understand", "understood", "understood"],
  ["wake", "woke", "woken"],
  ["wear", "wore", "worn"],
  ["win", "won", "won"],
  ["write", "wrote", "written"],
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

// 3. XỬ LÝ ĐẶC BIỆT CHO "BE" (is, am, are, being)
// Thêm các dạng hiện tại và phân từ hiện tại của "be"
irregularMap.set("is", { root: "be", type: "verb_present_3rd", desc: "Hiện tại ngôi 3 số ít" });
irregularMap.set("am", { root: "be", type: "verb_present_1st", desc: "Hiện tại ngôi 1 số ít" });
irregularMap.set("are", { root: "be", type: "verb_present_plural", desc: "Hiện tại số nhiều" });
irregularMap.set("being", { root: "be", type: "verb_present_participle", desc: "Phân từ hiện tại" });

// ES MODULE EXPORT (cho background.js)
export { irregularMap };
// console.log("Tra 'mice':", irregularMap.get("mice"));
// console.log("Tra 'went':", irregularMap.get("went"));
// console.log("Tra 'written':", irregularMap.get("written"));
// console.log("✅ Tra 'is':", irregularMap.get("is"));
// console.log("✅ Tra 'am':", irregularMap.get("am"));
// console.log("✅ Tra 'are':", irregularMap.get("are"));
// console.log("✅ Tra 'was':", irregularMap.get("was"));
// console.log("✅ Tra 'were':", irregularMap.get("were"));
// console.log("✅ Tra 'being':", irregularMap.get("being"));