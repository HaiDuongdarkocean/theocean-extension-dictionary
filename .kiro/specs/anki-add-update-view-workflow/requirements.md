# Anki Add/Update/View Workflow - Requirements Document

## 1. Tổng quan (Overview)

### 1.1 Mục đích
Cải thiện quy trình thêm, cập nhật và xem thẻ Anki trong popup dictionary, đảm bảo trải nghiệm người dùng mượt mà và phản hồi rõ ràng.

### 1.2 Phạm vi
- Kiểm tra kết nối Anki khi mở popup
- Kiểm tra cấu hình allowDuplicate để quyết định hiển thị nút Add
- Xử lý logic thêm thẻ Anki với phản hồi thành công/thất bại
- Hiển thị nút View để xem thẻ đã thêm trong Anki Browser
- Hiển thị nút Update CHỈ sau khi Add thành công
- Quản lý trạng thái UI (nút, feedback bar) theo kết quả từ Anki

### 1.3 Thay đổi chính so với yêu cầu ban đầu
1. **Kiểm tra kết nối Anki**: Nút "Add to Anki" chỉ hiển thị khi Anki đang chạy
2. **Kiểm tra allowDuplicate**: Nếu cấu hình không cho phép duplicate và thẻ đã tồn tại, disable nút Add
3. **Nút Update chỉ sau Add**: Nút "Update card" CHỈ xuất hiện sau khi user nhấn Add thành công, không xuất hiện khi chỉ auto-check phát hiện duplicate

## 2. User Stories

### 2.1 US-01: Thêm thẻ Anki thành công
**Là** người dùng  
**Tôi muốn** thêm từ vào Anki và nhận phản hồi rõ ràng  
**Để** biết thẻ đã được thêm thành công và có thể xem/sửa thẻ đó

**Acceptance Criteria:**
- Khi nhấn nút "Add to Anki", hệ thống gửi request đến Anki
- Nếu thành công:
  - Hiển thị thông báo trong `.yomi-feedback-bar`: "Added {term} to Anki"
  - Hiển thị link "View" để mở Anki Browser
  - Nút "Add to Anki" đổi text thành "Added" và bị disable
  - Hiển thị nút "Update card" để cho phép chỉnh sửa
  - Lưu noteId trả về từ Anki để sử dụng cho View và Update

### 2.2 US-02: Thêm thẻ Anki thất bại
**Là** người dùng  
**Tôi muốn** nhận thông báo lỗi rõ ràng khi thêm thẻ thất bại  
**Để** biết nguyên nhân và có thể thử lại

**Acceptance Criteria:**
- Khi thêm thẻ thất bại (lỗi kết nối, lỗi cấu hình, v.v.):
  - Hiển thị thông báo lỗi trong `.yomi-feedback-bar`: "Error: {error_message}"
  - Nút "Add to Anki" vẫn enabled để người dùng thử lại
  - Không hiển thị nút View hoặc Update

### 2.3 US-03: Xem thẻ trong Anki Browser
**Là** người dùng  
**Tôi muốn** xem thẻ vừa thêm trong Anki Browser  
**Để** kiểm tra nội dung thẻ

**Acceptance Criteria:**
- Sau khi thêm thẻ thành công, hiển thị link "View" trong feedback bar
- Khi nhấn "View", mở Anki Browser với query tìm noteId vừa thêm
- Sử dụng action "openBrowser" với noteIds từ response

### 2.4 US-04: Cập nhật thẻ đã thêm
**Là** người dùng  
**Tôi muốn** cập nhật nội dung thẻ vừa thêm  
**Để** sửa lỗi hoặc bổ sung thông tin

**Acceptance Criteria:**
- Sau khi thêm thẻ thành công, hiển thị nút "Update card"
- Khi nhấn "Update card":
  - Gửi request cập nhật với noteId đã lưu
  - Sử dụng dữ liệu hiện tại từ popup (definition, images, audio đã chọn)
  - Nếu thành công: Hiển thị thông báo "Updated" và disable nút
  - Nếu thất bại: Hiển thị thông báo lỗi

### 2.6 US-06: Kiểm tra cấu hình allowDuplicate
**Là** người dùng  
**Tôi muốn** nút "Add to Anki" chỉ hiển thị khi cấu hình cho phép  
**Để** tránh nhầm lẫn khi không thể thêm thẻ trùng

**Acceptance Criteria:**
- Khi popup mở, kiểm tra cấu hình `allowDuplicate` từ `options.html/anki`
- Nếu `allowDuplicate = false`:
  - Kiểm tra xem thẻ đã tồn tại chưa (auto-check)
  - Nếu thẻ đã tồn tại: Nút "Add to Anki" bị disable hoặc ẩn
  - Nếu thẻ chưa tồn tại: Nút "Add to Anki" enabled
- Nếu `allowDuplicate = true`:
  - Nút "Add to Anki" luôn enabled
- Nút "Update card" CHỈ xuất hiện sau khi nút "Add to Anki" thực hiện thành công

### 2.7 US-07: Kiểm tra kết nối Anki khi mở popup
**Là** người dùng  
**Tôi muốn** biết ngay khi Anki không khả dụng  
**Để** không lãng phí thời gian cố gắng thêm thẻ

**Acceptance Criteria:**
- Khi popup mở, kiểm tra kết nối Anki (ping Anki Connect)
- Nếu không kết nối được:
  - Nút "Add to Anki" KHÔNG hiển thị
  - Không có View/Update button
  - Có thể hiển thị icon/tooltip nhỏ báo "Anki not connected"
- Nếu kết nối thành công:
  - Hiển thị nút "Add to Anki" theo logic allowDuplicate
**Là** người dùng  
**Tôi muốn** biết khi thẻ đã tồn tại trong Anki  
**Để** tránh tạo thẻ trùng lặp

**Acceptance Criteria:**
- Khi thêm thẻ và phát hiện duplicate:
  - Hiển thị thông báo: "Note already in Anki"
  - Hiển thị link "View" với noteIds của thẻ trùng
  - Nút "Add to Anki" đổi thành "Added" và disable
  - Hiển thị nút "Update card" để cập nhật thẻ hiện có

## 3. Functional Requirements

### 3.1 FR-01: Kiểm tra kết nối Anki khi mở popup
**Mô tả:** Popup phải kiểm tra kết nối Anki ngay khi mở

**Chi tiết:**
- Gửi ping request đến Anki Connect (port 8765)
- Timeout: 2s
- Nếu thành công: Tiếp tục kiểm tra allowDuplicate
- Nếu thất bại: Ẩn nút "Add to Anki"

### 3.2 FR-02: Kiểm tra cấu hình allowDuplicate
**Mô tả:** Kiểm tra cấu hình từ options để quyết định hiển thị nút Add

**Chi tiết:**
- Load config từ `chrome.storage.sync` (key: `ankiConfig`)
- Kiểm tra field `allowDuplicate` (default: true)
- Nếu `allowDuplicate = false`:
  - Gọi auto-check để kiểm tra duplicate
  - Nếu duplicate: Disable/ẩn nút "Add to Anki"
  - Nếu không duplicate: Enable nút "Add to Anki"
- Nếu `allowDuplicate = true`:
  - Luôn enable nút "Add to Anki"

### 3.3 FR-03: Xử lý response từ Anki
### 3.3 FR-03: Xử lý response từ Anki
**Mô tả:** Hệ thống phải xử lý đúng các trường hợp response từ Anki

**Chi tiết:**
- Response thành công: `{ success: true, noteIds: [id] }`
- Response duplicate: `{ duplicate: true, noteIds: [id] }`
- Response lỗi: `{ success: false, error: "message" }`
- Response null/undefined: Xử lý như lỗi kết nối

### 3.4 FR-04: Quản lý trạng thái UI
**Mô tả:** UI phải phản ánh đúng trạng thái của thao tác Anki

**Chi tiết:**
- Feedback bar: Hiển thị/ẩn theo kết quả
- Add button: Đổi text và disable sau khi thành công
- View link: Chỉ hiển thị khi có noteIds
- Update button: CHỈ hiển thị sau khi nút "Add to Anki" thực hiện thành công (không hiển thị khi chỉ auto-check duplicate)

### 3.5 FR-05: Lưu trữ noteId
**Mô tả:** Lưu noteId vào popup instance để sử dụng cho View và Update

**Chi tiết:**
- Lưu vào `popup._ankiNoteIds` (array)
- Sử dụng noteId đầu tiên cho Update
- Sử dụng tất cả noteIds cho View query

### 3.6 FR-06: Build payload cho Update
**Mô tả:** Sử dụng hàm `buildAnkiPayload()` để lấy dữ liệu hiện tại từ popup

**Chi tiết:**
- Lấy definitions đã chọn (hoặc tất cả nếu không chọn)
- Lấy images đã chọn (hoặc focused image)
- Lấy audio đã chọn (hoặc focused audio)
- Giữ nguyên các field khác (term, sentence, v.v.)

## 4. Non-Functional Requirements

### 4.1 NFR-01: Performance
- Response time từ Anki < 2s
- UI update ngay lập tức sau khi nhận response

### 4.2 NFR-02: Usability
- Thông báo rõ ràng, dễ hiểu
- Nút View và Update dễ nhận biết
- Feedback bar tự động ẩn sau 5s (chỉ với error)

### 4.3 NFR-03: Reliability
- Xử lý timeout khi Anki không phản hồi
- Xử lý lỗi kết nối gracefully
- Không crash khi response không đúng format

## 5. Technical Constraints

### 5.1 Existing Code Structure
- Sử dụng `chrome.runtime.sendMessage` để giao tiếp với background
- Background xử lý logic Anki qua `handleAddToAnki()`
- Popup xử lý UI và feedback

### 5.2 Dependencies
- Anki Connect API (port 8765)
- Chrome Extension Messaging API
- Existing functions: `buildAnkiPayload()`, `showFeedback()`, `showViewLink()`

## 6. Current Implementation Analysis

### 6.1 Hiện trạng
**File:** `scripts/popupDictionary.js`

**Hàm `addNoteToAnki()`:**
```javascript
async function addNoteToAnki(dataOfCard, popup) {
  chrome.runtime.sendMessage(
    { action: "addNoteToAnki", data: dataOfCard },
    async (response) => {
      // Xử lý response
      if (!response) {
        showFeedback(popup, "Error: Could not connect to Anki", "error");
        return;
      }
      
      if (response.duplicate) {
        showFeedback(popup, "Note already in Anki", "info");
        showViewLink(popup, response.noteIds);
        // Đổi nút Add thành Added
        // Hiển thị nút Update
      }
      
      if (response.success) {
        showFeedback(popup, `Added ${dataOfCard.term} to Anki`, "success");
        showViewLink(popup, response.noteIds);
        // Đổi nút Add thành Added
      } else {
        showFeedback(popup, `Error: ${response.error}`, "error");
      }
    }
  );
}
```

**Hàm `showViewLink()`:** Đã có sẵn, tạo link View trong feedback bar

**Hàm `updateExistingAnkiCard()`:** Đã có sẵn, gửi request update

### 6.2 Vấn đề cần fix
1. ✅ Feedback bar đã có
2. ✅ View link đã có
3. ⚠️ Cần thêm kiểm tra kết nối Anki khi mở popup
4. ⚠️ Cần kiểm tra cấu hình allowDuplicate
5. ⚠️ Cần ẩn nút "Add to Anki" khi Anki không kết nối
6. ⚠️ Cần disable nút "Add to Anki" khi allowDuplicate=false và thẻ đã tồn tại
7. ⚠️ Cần đảm bảo nút "Add to Anki" đổi text và disable sau success
8. ⚠️ Cần đảm bảo nút "Update card" CHỈ xuất hiện sau khi Add thành công (không phải auto-check)
9. ⚠️ Cần lưu noteIds vào popup instance
10. ⚠️ Cần đảm bảo `ensureUpdateButton()` được gọi đúng

## 7. Proposed Solution

### 7.1 Thêm kiểm tra kết nối Anki khi mở popup
- Tạo hàm `checkAnkiConnection()` để ping Anki Connect
- Gọi khi popup mở (trong `showPopup()`)
- Nếu không kết nối được: Ẩn nút "Add to Anki"
- Nếu kết nối thành công: Tiếp tục kiểm tra allowDuplicate

### 7.2 Kiểm tra cấu hình allowDuplicate
- Load config từ `chrome.storage.sync`
- Nếu `allowDuplicate = false`:
  - Gọi `autoCheckAnkiOnOpen()` để kiểm tra duplicate
  - Nếu duplicate: Disable nút "Add to Anki", hiển thị feedback + View link
  - Nếu không duplicate: Enable nút "Add to Anki"
- Nếu `allowDuplicate = true`:
  - Luôn enable nút "Add to Anki"

### 7.3 Cập nhật hàm `addNoteToAnki()`
- Thêm logic lưu noteIds vào `popup._ankiNoteIds`
- Đảm bảo gọi `ensureUpdateButton()` với handler đúng CHỈ khi Add thành công
- Đảm bảo nút Add được update đúng trạng thái
- Phân biệt rõ giữa auto-check duplicate và Add action duplicate

### 7.4 Cập nhật hàm `updateExistingAnkiCard()`
- Sử dụng `buildAnkiPayload()` để lấy dữ liệu mới nhất
- Hiển thị feedback sau khi update
- Update trạng thái nút

### 7.5 Cập nhật hàm `autoCheckAnkiOnOpen()`
- Không hiển thị nút Update khi chỉ auto-check
- Chỉ hiển thị feedback + View link

### 7.3 Kiểm tra hàm `ensureUpdateButton()`
- Đảm bảo nút được tạo và gắn vào header
- Đảm bảo handler được bind đúng

### 7.4 Thêm action mới trong background.js
- `checkAnkiConnection`: Ping Anki Connect để kiểm tra kết nối
- `checkNoteExists`: Kiểm tra thẻ đã tồn tại (đã có sẵn, cần verify)

## 8. Testing Scenarios

### 8.1 Test Case 1: Thêm thẻ mới thành công
**Steps:**
1. Search từ "apple"
2. Popup hiện lên
3. Nhấn "Add to Anki"

**Expected:**
- Feedback bar: "Added apple to Anki"
- Link "View" xuất hiện
- Nút "Add to Anki" → "Added" (disabled)
- Nút "Update card" xuất hiện

### 8.2 Test Case 2: Thẻ đã tồn tại (duplicate)
**Steps:**
1. Search từ đã có trong Anki
2. Nhấn "Add to Anki"

**Expected:**
- Feedback bar: "Note already in Anki"
- Link "View" xuất hiện
- Nút "Add to Anki" → "Added" (disabled)
- Nút "Update card" xuất hiện

### 8.3 Test Case 3: Lỗi kết nối Anki
**Steps:**
1. Tắt Anki
2. Search từ

**Expected:**
- Nút "Add to Anki" KHÔNG hiển thị (vì không kết nối được Anki)
- Không có View/Update button
- Không có feedback bar

### 8.4 Test Case 4: Update thẻ
**Steps:**
1. Thêm thẻ thành công
2. Chọn definition/image/audio khác
3. Nhấn "Update card"

**Expected:**
- Gửi request update với dữ liệu mới
- Feedback bar: "Updated" hoặc lỗi
- Nút "Update card" disable sau success

### 8.6 Test Case 6: allowDuplicate = false và thẻ đã tồn tại
**Steps:**
1. Vào options.html, bỏ check "Allow duplicate"
2. Thêm thẻ "apple" vào Anki
3. Search từ "apple"

**Expected:**
- Auto-check phát hiện duplicate
- Nút "Add to Anki" bị disable hoặc ẩn
- Feedback bar: "Note already in Anki"
- Link "View" xuất hiện
- KHÔNG có nút "Update card" (vì chưa thực hiện Add action)

### 8.7 Test Case 7: allowDuplicate = false và thẻ chưa tồn tại
**Steps:**
1. Vào options.html, bỏ check "Allow duplicate"
2. Search từ "banana" (chưa có trong Anki)

**Expected:**
- Auto-check không phát hiện duplicate
- Nút "Add to Anki" enabled
- Không có feedback bar
- Khi nhấn Add và thành công:
  - Feedback bar: "Added banana to Anki"
  - Link "View" xuất hiện
  - Nút "Update card" xuất hiện

### 8.8 Test Case 8: allowDuplicate = true
**Steps:**
1. Vào options.html, check "Allow duplicate"
2. Search bất kỳ từ nào

**Expected:**
- Nút "Add to Anki" luôn enabled
- Không auto-check duplicate
- Có thể thêm thẻ trùng nhiều lần

### 8.9 Test Case 9: Anki không chạy khi mở popup
**Steps:**
1. Tắt Anki
2. Search từ "apple"

**Expected:**
- Popup mở nhưng KHÔNG có nút "Add to Anki"
- Không có View/Update button
- Có thể có icon/tooltip nhỏ: "Anki not connected"
**Steps:**
1. Thêm thẻ thành công
2. Nhấn link "View"

**Expected:**
- Anki Browser mở với query `nid:{noteId}`
- Thẻ vừa thêm được highlight

## 9. Dependencies & References

### 9.1 Related Files
- `scripts/popupDictionary.js` - UI logic
- `scripts/background.js` - Anki communication
- `scripts/ankiManager.js` - Anki note building
- `scripts/ankiSettings.js` - Anki config

### 9.2 External APIs
- Anki Connect API: `http://127.0.0.1:8765`
- Actions: `addNote`, `updateNoteFields`, `findNotes`, `guiBrowse`

## 10. Glossary

- **noteId**: ID duy nhất của thẻ Anki, trả về sau khi thêm thành công
- **Feedback bar**: Vùng hiển thị thông báo trong popup (`.yomi-feedback-bar`)
- **Duplicate**: Thẻ đã tồn tại trong Anki với cùng Target word
- **Payload**: Dữ liệu gửi đến Anki (term, definition, images, audio, v.v.)
