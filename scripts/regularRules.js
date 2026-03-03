// Cấu trúc: Độ dài hậu tố -> { Hậu tố: Hàm xử lý }
const suffixRules = {
    // Ưu tiên xử lý đuôi dài trước (để tránh nhầm lẫn)
    3: {
        "ies": (stem) => {
            // Quy tắc: Phụ âm + y -> ies
            // Logic ngược: Bỏ ies, thêm y
            // Ví dụ: flies -> fl + y = fly
            return { root: stem + "y", tag: "noun_plural_or_verb_3rd" };
        },
        "ves": (stem) => {
            // Quy tắc: f/fe -> ves
            // Logic ngược: Bỏ ves, thử thêm f hoặc fe
            // Ví dụ: wolves -> wol + f = wolf / knives -> kni + fe = knife
            // Vì có 2 khả năng, ta trả về mảng để hàm chính kiểm tra từ điển
            return [
                { root: stem + "f", tag: "noun_plural" },
                { root: stem + "fe", tag: "noun_plural" }
            ];
        },
        "ing": (stem) => {
            // Quy tắc -ing có nhiều trường hợp:
            // 1. Double consonant: giving -> giv -> give (bỏ 1 phụ âm, thêm e)
            // 2. Silent e: making -> mak -> make (thêm e)
            // 3. Normal: playing -> play (giữ nguyên)
            
            const candidates = [];
            const vowels = 'aeiou';
            
            // Trường hợp 1: Double consonant (giving, running, sitting)
            // Kiểm tra: stem kết thúc bằng 2 phụ âm giống nhau
            if (stem.length >= 2) {
                const lastChar = stem[stem.length - 1];
                const secondLastChar = stem[stem.length - 2];
                
                if (lastChar === secondLastChar && !vowels.includes(lastChar)) {
                    // Bỏ 1 phụ âm kép
                    const withoutDouble = stem.slice(0, -1);
                    
                    // Ưu tiên: Thử thêm 'e' trước (giving -> giv -> give)
                    candidates.push({ root: withoutDouble + "e", tag: "verb_ing" });
                    
                    // Sau đó thử không thêm gì (running -> runn -> run)
                    candidates.push({ root: withoutDouble, tag: "verb_ing" });
                    
                    // Return early nếu phát hiện double consonant
                    // Vì đây là pattern rõ ràng nhất
                    return candidates;
                }
            }
            
            // Trường hợp 2: Silent e (making, taking, writing)
            // Thử thêm 'e' vào cuối stem
            candidates.push({ root: stem + "e", tag: "verb_ing" });
            
            // Trường hợp 3: Normal (playing, working)
            // Giữ nguyên stem
            candidates.push({ root: stem, tag: "verb_ing" });
            
            return candidates;
        }
    },
    2: {
        "es": (stem) => {
            // Quy tắc: s, ss, sh, ch, x, z, o + es
            // Logic ngược: Bỏ es đi là xong
            // Ví dụ: watches -> watch
            return { root: stem, tag: "noun_plural_or_verb_3rd" };
        },
        "ed": (stem) => {
            // Quy tắc -ed có nhiều trường hợp:
            // 1. Double consonant: stopped -> stopp -> stop
            // 2. Silent e: liked -> lik -> like
            // 3. Normal: played -> play
            
            const candidates = [];
            const vowels = 'aeiou';
            
            // Trường hợp 1: Double consonant (stopped, planned)
            if (stem.length >= 2) {
                const lastChar = stem[stem.length - 1];
                const secondLastChar = stem[stem.length - 2];
                
                if (lastChar === secondLastChar && !vowels.includes(lastChar)) {
                    // Bỏ 1 phụ âm kép
                    candidates.push({ root: stem.slice(0, -1), tag: "verb_past" });
                }
            }
            
            // Trường hợp 2: Silent e (liked, moved)
            candidates.push({ root: stem + "e", tag: "verb_past" });
            
            // Trường hợp 3: Normal (played, worked)
            candidates.push({ root: stem, tag: "verb_past" });
            
            return candidates;
        }
    },
    1: {
        "s": (stem) => {
            // Quy tắc: Thêm s
            // Logic ngược: Bỏ s
            // Ví dụ: cats -> cat
            // LƯU Ý: Phải cẩn thận với từ kết thúc bằng s sẵn (bus, lens) -> Cần check từ điển
            return { root: stem, tag: "noun_plural_or_verb_3rd" };
        }
    }
};

// Import lookupTermWithFreq for word validation
import { lookupTermWithFreq } from "./storage.js";

// Hàm kiểm tra xem một từ có tồn tại trong từ điển không
async function isValidWord(word) {
    if (!word) return false;
    
    try {
        console.log(`      🔍 isValidWord checking: "${word}"`);
        // Use lookupTermWithFreq to check if word exists in dictionary
        // Use first_match mode for faster lookup
        const result = await lookupTermWithFreq(word.toLowerCase(), { mode: "first_match" });
        
        // With first_match mode, result has { entry, resource, freqs }
        // With stacked mode, result has { results, freqs }
        const exists = result && (result.entry !== null && result.entry !== undefined);
        
        console.log(`      📖 Lookup result for "${word}": ${exists ? 'FOUND' : 'NOT FOUND'} (entry: ${result?.entry ? 'exists' : 'null'})`);
        console.log(`      ${exists ? '✓' : '✗'} Word "${word}" ${exists ? 'EXISTS' : 'DOES NOT EXIST'} in dictionary`);
        return exists;
    } catch (error) {
        console.warn(`      ⚠️ isValidWord error for "${word}":`, error);
        return false;
    }
}

// Hàm trả về từ gốc (Root) và thông tin ngữ pháp (Tag)
async function getRegularRoot(word) {
    console.log(`📝 getRegularRoot called for: "${word}"`);
    const len = word.length;
    
    // Chỉ xử lý từ có độ dài tối thiểu (ví dụ > 3 ký tự) để tránh cắt nhầm từ ngắn (is, as, us)
    if (len <= 3) {
        console.log(`  ⏭️ Word too short (${len} chars), skipping`);
        return null;
    }

    // QUÉT TỪ HẬU TỐ DÀI NHẤT (3) XUỐNG NGẮN NHẤT (1)
    for (let suffixLen = 3; suffixLen > 0; suffixLen--) {
        // Lấy đuôi (ví dụ: 'ies')
        const suffix = word.slice(-suffixLen);
        
        // Lấy phần thân (ví dụ: 'flies' -> 'fl')
        const stem = word.slice(0, -suffixLen);

        console.log(`  🔍 Checking suffix "${suffix}" (len=${suffixLen}), stem="${stem}"`);

        // Kiểm tra xem đuôi này có trong luật không
        if (suffixRules[suffixLen] && suffixRules[suffixLen][suffix]) {
            console.log(`  ✓ Found rule for suffix "${suffix}"`);
            const ruleFn = suffixRules[suffixLen][suffix];
            const potentialRoots = ruleFn(stem); // Nhận kết quả từ hàm xử lý

            // Xử lý kết quả (vì ruleFn có thể trả về 1 đối tượng hoặc 1 mảng đối tượng)
            const candidates = Array.isArray(potentialRoots) ? potentialRoots : [potentialRoots];
            console.log(`  📋 Generated ${candidates.length} candidate(s):`, candidates.map(c => c.root));

            // DUYỆT QUA CÁC ỨNG VIÊN
            for (const candidate of candidates) {
                console.log(`    🔎 Checking candidate: "${candidate.root}"`);
                // *** BƯỚC QUAN TRỌNG NHẤT: CHECK TỪ ĐIỂN ***
                // Nếu 'wolf' có trong từ điển -> CHỐT LUÔN!
                const exists = await isValidWord(candidate.root);
                console.log(`    ${exists ? '✓' : '✗'} Dictionary check: "${candidate.root}" ${exists ? 'FOUND' : 'not found'}`);
                if (exists) {
                    console.log(`✓ Regular lemmatization: ${word} -> ${candidate.root}`);
                    return candidate; // Trả về { root: 'wolf', tag: '...' }
                }
            }
        }
    }

    console.log(`  ❌ No valid lemmatization found for: "${word}"`);
    // Nếu chạy hết vòng lặp mà không tìm ra, nghĩa là từ này không biến đổi (hoặc từ điển thiếu)
    return null;
}

// ES MODULE EXPORT (cho background.js)
export { getRegularRoot };
