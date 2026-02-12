// Hàm gọi Google Translate API miễn phí
export async function translateText(text, targetLang = 'vi') {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Google trả về mảng lồng nhau, ta cần gộp các mảnh câu lại
        return data[0].map(item => item[0]).join('');
    } catch (error) {
        console.error("Lỗi dịch thuật:", error);
        return null;
    }
}