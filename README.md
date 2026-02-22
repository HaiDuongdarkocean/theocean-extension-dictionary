# 🌊 The0cean - Tiện Ích Học Tiếng Anh Thông Minh

> Tiện ích Chrome mạnh mẽ cho người học tiếng Anh với tra từ điển thông minh, nhận diện phrasal verb, tích hợp Anki và nhiều tính năng khác.

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/yourusername/the0cean)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📋 Mục Lục

- [Tính Năng](#-tính-năng)
- [Cài Đặt](#-cài-đặt)
- [Hướng Dẫn Nhanh](#-hướng-dẫn-nhanh)
- [Tính Năng Chi Tiết](#-tính-năng-chi-tiết)
  - [Tra Từ Điển](#1-tra-từ-điển)
  - [OCEAN Engine (Phrasal Verbs & Idioms)](#2-ocean-engine-phrasal-verbs--idioms)
  - [Tích Hợp Anki](#3-tích-hợp-anki)
  - [Âm Thanh & Phát Âm](#4-âm-thanh--phát-âm)
  - [Hình Ảnh](#5-hình-ảnh)
- [Cài Đặt & Tùy Chỉnh](#-cài-đặt--tùy-chỉnh)
- [Phím Tắt](#-phím-tắt)
- [Câu Hỏi Thường Gặp](#-câu-hỏi-thường-gặp)
- [Xử Lý Sự Cố](#-xử-lý-sự-cố)
- [Đóng Góp](#-đóng-góp)
- [Giấy Phép](#-giấy-phép)

---

## ✨ Tính Năng

### 🎯 Tính Năng Chính
- **Tra Từ Tức Thì** - Di chuột qua từ để xem nghĩa
- **OCEAN Engine** - Nhận diện thông minh phrasal verb và thành ngữ theo ngữ cảnh
- **Hai Từ Điển** - Cambridge Dictionary + Từ điển Anh-Việt được cài sẵn
- **Tích Hợp Anki** - Tạo thẻ flashcard một cú nhấp chuột
- **Âm Thanh Forvo** - Phát âm của người bản ngữ từ Forvo.com
- **Text-to-Speech** - Nhiều giọng đọc TTS tùy chỉnh
- **Tìm Hình Ảnh** - Học trực quan với hình ảnh tự động
- **Trích Xuất Câu** - Tự động lấy câu ví dụ và dịch
- **Danh Sách Tần Suất** - Dữ liệu tần suất từ Wikipedia và TV/Movies

### 🚀 Tính Năng Nâng Cao
- **Lemmatization Thông Minh** - Nhận dạng các dạng từ (was → be, handed → hand)
- **Possessive Placeholder** - Khớp tất cả dạng sở hữu (my/your/his/her/its/our/their/one's)
- **Tự Động Map Field** - Tự động nhận diện field Anki
- **Phát Hiện Trùng Lặp** - Ngăn tạo thẻ Anki trùng
- **Cập Nhật Hàng Loạt** - Cập nhật nhiều note Anki cùng lúc
- **Phím Tắt Tùy Chỉnh** - Cấu hình phím tắt theo ý muốn
- **Hỗ Trợ Dark Mode** - Tự động chuyển theme

---

## 📦 Cài Đặt

### Phương Pháp 1: Chrome Web Store (Khuyến Nghị)
1. Truy cập [Chrome Web Store](#) (sắp ra mắt)
2. Nhấn "Thêm vào Chrome"
3. Xong! Extension đã sẵn sàng

### Phương Pháp 2: Cài Đặt Thủ Công (Developer Mode)
1. Tải phiên bản mới nhất từ [Releases](https://github.com/yourusername/the0cean/releases)
2. Giải nén file ZIP
3. Mở Chrome và vào `chrome://extensions/`
4. Bật "Developer mode" (góc trên bên phải)
5. Nhấn "Load unpacked"
6. Chọn thư mục đã giải nén
7. Xong!

### Thiết Lập Lần Đầu
Khi cài đặt lần đầu, extension tự động:
- ✅ Import Cambridge Dictionary
- ✅ Import Từ điển Anh-Việt
- ✅ Import Danh sách tần suất Wikipedia
- ✅ Cấu hình từ điển ngoài mặc định (Cambridge + Oxford)

**Không cần thiết lập thủ công!** Chỉ cần cài và dùng.

<!-- ---

## 🚀 Hướng Dẫn Nhanh

### Workflow Tối Ưu: Từ Tra Từ Đến Anki (5 Giây)

```
┌─────────────────────────────────────────────────────────────┐
│  1. Di chuột qua từ                                         │
│     ↓                                                        │
│  2. Popup hiện ra                                           │
│     ↓                                                        │
│  3. Nhấn Ctrl+Enter                                         │
│     ↓                                                        │
│  4. Thẻ Anki được tạo tự động                              │
│     ✓ Từ vựng                                               │
│     ✓ Định nghĩa                                            │
│     ✓ Câu ví dụ + Dịch                                      │
│     ✓ Audio Forvo                                           │
│     ✓ Hình ảnh                                              │
└─────────────────────────────────────────────────────────────┘
```

### Sử Dụng Cơ Bản (3 Bước)

#### Bước 1: Tra Từ
- **Di chuột qua từ** trên bất kỳ trang web nào
- Popup hiện ngay lập tức với định nghĩa

#### Bước 2: Xem Thông Tin
- **Định nghĩa** hiển thị ngay
- **Nhấn các tab** để xem thêm:
  - 🔊 **Forvo** - Phát âm người bản ngữ
  - 🖼️ **Images** - Hình ảnh minh họa
  - 🗣️ **TTS** - Đọc câu ví dụ
  - 📝 **Sentence** - Câu ví dụ và dịch

#### Bước 3: Thêm Vào Anki (Tùy Chọn)
- **Nhấn `Ctrl+Enter`** - Thẻ tạo tự động
- Hoặc **nhấn nút "Add to Anki"**
- Thẻ có đầy đủ: từ, nghĩa, câu, audio, hình

### Tips Sử Dụng Nhanh

💡 **Tra từ nhanh hơn:**
- Dùng chế độ Hover (mặc định) - không cần nhấn gì
- Hoặc Ctrl+Hover nếu muốn kiểm soát

💡 **Thêm Anki nhanh hơn:**
- Nhớ phím tắt `Ctrl+Enter` - không cần click chuột
- Bật "Auto-play audio" để nghe phát âm ngay

💡 **Học hiệu quả hơn:**
- Xem hình ảnh để nhớ lâu hơn
- Đọc câu ví dụ để hiểu ngữ cảnh
- Nghe nhiều phát âm để cải thiện listening

---

## 🎯 Tính Năng Chi Tiết

### 1. Tra Từ Điển

#### Chế Độ Hover (Mặc Định)
Chỉ cần di chuột qua từ để xem nghĩa.

#### Chế Độ Tra Từ
Bạn có thể thay đổi chế độ kích hoạt trong Cài đặt:
- **Hover** - Tự động khi di chuột
- **Ctrl+Hover** - Giữ Ctrl khi di chuột
- **Alt+Hover** - Giữ Alt khi di chuột
- **Shift+Hover** - Giữ Shift khi di chuột

#### Từ Điển Hỗ Trợ
- Cambridge Dictionary (định nghĩa tiếng Anh)
- Từ điển Anh-Việt (dịch nghĩa)
- Từ điển tùy chỉnh (import file JSON của bạn)

---

### 2. OCEAN Engine (Phrasal Verbs & Idioms)

OCEAN Engine là hệ thống thông minh để phát hiện phrasal verb và thành ngữ trong ngữ cảnh.

#### Chức Năng
- Phát hiện phrasal verb như "hand back", "give up", "look into"
- Nhận dạng thành ngữ như "under your nose", "break the ice"
- Hiểu các dạng động từ khác nhau (was/were/is/are → be)
- Khớp các biến thể sở hữu (my/your/his/her/its/our/their/one's)

#### Ví Dụ
Khi bạn di chuột qua "was" trong câu:
> "The answer **was** right under my nose"

OCEAN phát hiện thành ngữ **"be (right) under your nose"** và hiển thị:
- ✅ Định nghĩa đầy đủ của thành ngữ
- ✅ Ngữ cảnh: "was right under my nose"
- ✅ Tất cả biến thể (be/is/was/were under my/your/his/her nose)

#### Cách Hoạt Động
1. **Lemmatization** - Chuyển từ về dạng gốc (was → be)
2. **Pattern Matching** - Tìm kiếm các mẫu phrasal
3. **Phân Tích Ngữ Cảnh** - Xác minh khớp trong câu
4. **Xếp Hạng Ưu Tiên** - Hiển thị kết quả phù hợp nhất

---

### 3. Tích Hợp Anki

Tạo thẻ flashcard Anki trực tiếp từ popup chỉ với một cú nhấp chuột hoặc phím tắt.

#### So Sánh Workflow

**Cách truyền thống (60 giây):**
```
1. Gặp từ mới → Copy từ
2. Mở Google Translate → Paste → Đọc nghĩa
3. Mở Cambridge Dictionary → Tìm định nghĩa
4. Copy định nghĩa
5. Mở Forvo → Tìm phát âm → Tải về
6. Mở Google Images → Tìm hình → Tải về
7. Mở Anki → Tạo thẻ mới
8. Paste từ, nghĩa, câu
9. Upload audio, hình
10. Lưu thẻ
```
⏱️ **Tổng thời gian: ~60 giây**

**Với The0cean (3 giây):**
```
1. Di chuột qua từ
2. Nhấn Ctrl+Enter
3. Xong!
```
⏱️ **Tổng thời gian: ~3 giây**
🚀 **Nhanh hơn 20 lần!**

#### Yêu Cầu
1. Cài đặt [Anki Desktop](https://apps.ankiweb.net/)
2. Cài đặt add-on [AnkiConnect](https://ankiweb.net/shared/info/2055492159)
3. Giữ Anki chạy ở background

#### Thiết Lập (Một Lần)
1. Mở cài đặt extension (nhấn icon extension → Options)
2. Vào tab "Anki"
3. Chọn deck và note type của bạn
4. Field mapping **tự động** - chỉ cần kiểm tra lại
5. Nhấn "Save"

#### Tạo Thẻ Nhanh Bằng Phím Tắt

**Quy trình tối ưu (3 giây):**

1. **Di chuột qua từ** → Popup hiện ra
2. **Nhấn `Ctrl+Enter`** → Thẻ được tạo ngay lập tức
3. **Xong!** Thẻ đã có trong Anki

**Quy trình chi tiết:**

```
Bước 1: Di chuột qua từ "example"
   ↓
Popup hiện ra với định nghĩa
   ↓
Bước 2: Nhấn Ctrl+Enter (không cần click chuột)
   ↓
Thẻ được tạo tự động với:
   ✓ Target word: "example"
   ✓ Definition: "a thing characteristic of its kind..."
   ✓ Sentence: "for example, the website has audio..."
   ✓ Sentence translation: "ví dụ, trang web có âm thanh..."
   ✓ Audio: [Forvo pronunciation]
   ✓ Images: [3 hình ảnh liên quan]
   ↓
Thông báo: "Added to Anki successfully"
```

**Lưu ý quan trọng:**
- ⚡ **Không cần click chuột** - chỉ cần phím tắt
- ⚡ **Không cần chờ** - thẻ tạo ngay lập tức
- ⚡ **Tất cả field tự động** - không cần điền thủ công
- ⚡ **Audio tự động** - Forvo audio được thêm vào thẻ
- ⚡ **Hình ảnh tự động** - nếu bật trong settings

**Tùy chỉnh phím tắt:**
1. Vào Settings → Dictionary → Shortcuts
2. Tìm "Add to Anki"
3. Nhấn vào phím tắt hiện tại
4. Nhấn tổ hợp phím mới (ví dụ: `Alt+A`, `Ctrl+S`)
5. Lưu lại

#### Tạo Thẻ Bằng Chuột (Phương Pháp Thay Thế)
1. Tra một từ
2. Nhấn nút "Add to Anki" trong popup
3. Xong! Thẻ được tạo với đầy đủ thông tin

#### Tính Năng Nâng Cao
- **Phát Hiện Trùng Lặp** - Cảnh báo nếu thẻ đã tồn tại
- **Cập Nhật Thẻ Có Sẵn** - Cập nhật thay vì tạo trùng
- **Cập Nhật Hàng Loạt** - Chọn nhiều note để cập nhật cùng lúc
- **Xem Trong Browser** - Nhảy đến Anki browser sau khi thêm

---

### 4. Âm Thanh & Phát Âm

#### Forvo Audio
- Phát âm của người bản ngữ từ Forvo.com
- Nhiều người nói cho mỗi từ
- Thông tin quốc gia/vùng miền
- Tùy chọn tự động phát

#### Text-to-Speech (TTS)
- Giọng đọc TTS tích hợp trình duyệt
- Chọn nhiều giọng đọc
- Đọc câu ví dụ
- Tùy chỉnh tốc độ và cao độ

#### Cài Đặt Audio
- **Chế Độ Forvo**: Tự động tải hoặc Thủ công
- **Số Lượng Tự Động Phát**: 0-3 phát âm
- **Giọng TTS**: Chọn tối đa 3 giọng
- **Lựa Chọn Giọng**: Lọc theo quốc gia/ngôn ngữ

---

### 5. Hình Ảnh

Tự động tìm hình ảnh cho người học trực quan.

#### Tính Năng
- Tích hợp Google Images
- Tự động tải N hình ảnh đầu tiên
- Nhấn để xem kích thước đầy đủ
- Thêm vào thẻ Anki

#### Cài Đặt
- **Bật/Tắt**: Bật/tắt tìm hình ảnh
- **Số Hình Tối Đa**: 5-20 hình
- **Số Hình Tự Động Tải**: 1-5 hình
- **Giới Hạn Thử Lại**: 0-10 lần thử cho hình lỗi

---

## ⚙️ Cài Đặt & Tùy Chỉnh

### Cài Đặt Từ Điển
- **Import Từ Điển**: Thêm từ điển JSON tùy chỉnh
- **Chế Độ Tra**: Hover, Ctrl+Hover, Alt+Hover, Shift+Hover
- **Chế Độ Kết Quả**: Stacked (tất cả từ điển) hoặc First Match (khớp đầu tiên)
- **Tab Mặc Định**: Tab nào mở đầu tiên (Forvo/Images/TTS/Sentence)

### Cài Đặt Anki
- **Deck**: Chọn deck đích
- **Note Type**: Chọn note type (model)
- **Field Mapping**: Tự động map, kiểm tra và điều chỉnh
- **Cho Phép Trùng**: Bật/tắt phát hiện trùng lặp
- **Tags**: Thêm tag tùy chỉnh vào thẻ

### Cài Đặt Audio
- **Forvo**: Bật/tắt, số lượng tự động phát
- **TTS**: Chọn giọng, số lượng tự động phát
- **Lựa Chọn Giọng**: Lọc theo quốc gia, test giọng

### Cài Đặt Câu
- **Hiện Câu**: Hiển thị câu ví dụ
- **Hiện Dịch**: Hiển thị dịch câu
- **Tự Động Dịch**: Dùng Google Translate

### Cài Đặt Hình Ảnh
- **Bật Hình Ảnh**: Bật/tắt tìm hình
- **Số Link Tối Đa**: Số hình cần tìm
- **Tự Động Tải**: Số hình tự động tải

### Từ Điển Ngoài
Thêm link từ điển ngoài với placeholder:
- `{term}` - Từ đang tra
- `{sentence}` - Câu ví dụ

Ví dụ:
```
https://dictionary.cambridge.org/dictionary/english/{term}
https://www.oxfordlearnersdictionaries.com/definition/english/{term}
```

---

## ⌨️ Phím Tắt

### Phím Tắt Mặc Định
| Hành Động | Phím Tắt | Mô Tả |
|-----------|----------|-------|
| Đóng popup | `Esc` | Đóng popup hiện tại |
| Đóng tất cả | `Esc Esc` | Nhấn 2 lần để đóng tất cả popup |
| Audio tiếp | `D` | Phát âm Forvo tiếp theo |
| Audio trước | `A` | Phát âm Forvo trước đó |
| Phát audio | `S` | Phát audio hiện tại |
| Hình tiếp | `→` | Hình ảnh tiếp theo |
| Hình trước | `←` | Hình ảnh trước đó |
| Thêm Anki | `Ctrl+Enter` | Tạo thẻ Anki |

### Tùy Chỉnh
1. Vào Settings → Dictionary → Shortcuts
2. Nhấn vào phím tắt muốn sửa
3. Nhấn tổ hợp phím mới
4. Nhấn "Save"

---

## ❓ Câu Hỏi Thường Gặp

### Hỏi: Có cần kết nối internet không?
**Đáp:** Có, cho:
- Forvo audio (cần internet)
- Tìm hình ảnh (cần internet)
- Google Translate (cần internet)

Không cần internet cho:
- Tra từ điển (hoạt động offline)
- TTS (tích hợp trình duyệt)
- Tích hợp Anki (local)

### Hỏi: Có thể dùng từ điển riêng không?
**Đáp:** Có! Vào Settings → Dictionary → Import Dictionary và upload file JSON. Định dạng hỗ trợ:
- Migaku Dictionary JSON
- Yomitan Dictionary ZIP

### Hỏi: Làm sao thêm dịch tiếng Việt?
**Đáp:** Từ điển Anh-Việt đã được cài sẵn. Nếu cần thêm:
1. Tìm file từ điển JSON tương thích
2. Import qua Settings → Dictionary

### Hỏi: Tại sao Anki không hoạt động?
**Đáp:** Kiểm tra:
1. ✅ Anki Desktop đang chạy
2. ✅ Add-on AnkiConnect đã cài
3. ✅ Deck và note type đã chọn trong settings
4. ✅ Field mapping đã cấu hình

### Hỏi: Có thể tắt một số tính năng không?
**Đáp:** Có! Tất cả tính năng có thể bật/tắt trong Settings:
- Forvo audio
- Hình ảnh
- TTS
- Dịch câu
- Tự động dịch

---

## 🔧 Xử Lý Sự Cố

### Popup không hiện
1. Kiểm tra chế độ tra trong Settings (Hover vs Ctrl+Hover)
2. Thử refresh trang
3. Kiểm tra extension có bật trong `chrome://extensions/`

### Kết nối Anki thất bại
1. Mở Anki Desktop
2. Vào Tools → Add-ons → AnkiConnect → Config
3. Xác minh `webBindAddress` là `127.0.0.1`
4. Khởi động lại Anki

### Audio không phát
1. Kiểm tra chế độ Forvo (Auto vs Manual)
2. Thử nhấn nút "Load audio"
3. Kiểm tra kết nối internet
4. Thử TTS làm phương án dự phòng

### Hình ảnh không tải
1. Kiểm tra hình ảnh có bật trong Settings
2. Kiểm tra kết nối internet
3. Thử tăng giới hạn thử lại
4. Một số từ có thể không có hình

### Không tìm thấy từ điển
1. Vào Settings → Dictionary
2. Kiểm tra từ điển đã import chưa
3. Thử import lại từ điển
4. Kiểm tra console lỗi (F12)

---

## 🤝 Đóng Góp

Chúng tôi hoan nghênh mọi đóng góp!

### Báo Lỗi
1. Kiểm tra [issues hiện có](https://github.com/yourusername/the0cean/issues)
2. Tạo issue mới với mô tả chi tiết
3. Bao gồm các bước tái hiện

### Đề Xuất Tính Năng
1. Mở [feature request](https://github.com/yourusername/the0cean/issues/new)
2. Mô tả tính năng và use case
3. Giải thích tại sao nó hữu ích

### Đóng Góp Code
1. Fork repository
2. Tạo feature branch (`git checkout -b feature/tinh-nang-tuyet-voi`)
3. Commit thay đổi (`git commit -m 'Thêm tính năng tuyệt vời'`)
4. Push lên branch (`git push origin feature/tinh-nang-tuyet-voi`)
5. Mở Pull Request

---

## 📄 Giấy Phép

Dự án này được cấp phép theo giấy phép MIT - xem file [LICENSE](LICENSE) để biết chi tiết.

---

## 🙏 Cảm Ơn

- **Cambridge Dictionary** - Dữ liệu từ điển
- **Forvo** - Phát âm
- **Anki** - Hệ thống flashcard
- **AnkiConnect** - Tích hợp Anki
- **Contributors** - Mọi người đã giúp cải thiện extension này

---

## 📞 Hỗ Trợ

- **GitHub Issues**: [Báo lỗi hoặc đề xuất tính năng](https://github.com/yourusername/the0cean/issues)
- **Email**: support@the0cean.com

---

<div align="center">

**Được tạo với ❤️ cho người học tiếng Anh**

[⭐ Star trên GitHub](https://github.com/yourusername/the0cean) | [🐛 Báo Lỗi](https://github.com/yourusername/the0cean/issues) | [💡 Đề Xuất Tính Năng](https://github.com/yourusername/the0cean/issues)

</div> -->
