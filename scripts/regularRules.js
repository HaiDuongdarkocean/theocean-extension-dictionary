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
        }
    },
    2: {
        "es": (stem) => {
            // Quy tắc: s, ss, sh, ch, x, z, o + es
            // Logic ngược: Bỏ es đi là xong
            // Ví dụ: watches -> watch
            return { root: stem, tag: "noun_plural_or_verb_3rd" };
        }, 
        // Sau này con có thể thêm 'ed' vào đây
        // "ed": (stem) => ... 
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

// Hàm kiểm tra xem một từ có tồn tại trong từ điển không
// (Hàm này giả định con đã có biến dictionary dạng Map hoặc Set)
// Phải có chữ async ở đầu
async function isValidWord(word) {
    if (!word) return false;
    
    // Đợi kết quả từ IndexedDB gửi về
    const result = await getDefinitionSendMessage(word.toLowerCase());
    
    // Nếu kết quả khác null nghĩa là từ đó có tồn tại trong DB
    return result !== null;
}

// Hàm trả về từ gốc (Root) và thông tin ngữ pháp (Tag)
async function getRegularRoot(word) {
    const len = word.length;
    
    // Chỉ xử lý từ có độ dài tối thiểu (ví dụ > 3 ký tự) để tránh cắt nhầm từ ngắn (is, as, us)
    if (len <= 3) return null; 

    // QUÉT TỪ HẬU TỐ DÀI NHẤT (3) XUỐNG NGẮN NHẤT (1)
    for (let suffixLen = 3; suffixLen > 0; suffixLen--) {
        // Lấy đuôi (ví dụ: 'ies')
        const suffix = word.slice(-suffixLen);
        
        // Lấy phần thân (ví dụ: 'flies' -> 'fl')
        const stem = word.slice(0, -suffixLen);

        // Kiểm tra xem đuôi này có trong luật không
        if (suffixRules[suffixLen] && suffixRules[suffixLen][suffix]) {
            const ruleFn = suffixRules[suffixLen][suffix];
            const potentialRoots = ruleFn(stem); // Nhận kết quả từ hàm xử lý

            // Xử lý kết quả (vì ruleFn có thể trả về 1 đối tượng hoặc 1 mảng đối tượng)
            const candidates = Array.isArray(potentialRoots) ? potentialRoots : [potentialRoots];

            // DUYỆT QUA CÁC ỨNG VIÊN
            for (const candidate of candidates) {
                // *** BƯỚC QUAN TRỌNG NHẤT: CHECK TỪ ĐIỂN ***
                // Nếu 'wolf' có trong từ điển -> CHỐT LUÔN!
                const exists = await isValidWord(candidate.root);
                if (exists) {
                    console.log(`Tỉa từ thành công: ${word} -> ${candidate.root}`);
                    return candidate; // Trả về { root: 'wolf', tag: '...' }
                }
            }
        }
    }

    // Nếu chạy hết vòng lặp mà không tìm ra, nghĩa là từ này không biến đổi (hoặc từ điển thiếu)
    return null;
}