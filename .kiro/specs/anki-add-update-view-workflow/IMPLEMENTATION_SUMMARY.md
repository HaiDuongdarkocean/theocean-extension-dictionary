# Anki Add/Update/View Workflow - Implementation Summary

## Thay đổi đã thực hiện

### 1. File: `scripts/popupDictionary.js`

#### 1.1 Thêm hàm `checkAnkiConnection()`
```javascript
async function checkAnkiConnection() {
  try {
    const response = await runtimeMessageWithTimeout({
      action: "checkAnkiConnection"
    }, 2000);
    return response?.connected === true;
  } catch (err) {
    console.error("Anki connection check failed:", err);
    return false;
  }
}
```
**Mục đích:** Kiểm tra kết nối Anki khi mở popup

#### 1.2 Cập nhật hàm `autoCheckAnkiOnOpen()`
**Thay đổi:**
- Thêm parameter `ankiConfig` để nhận cấu hình allowDuplicate
- Return object `{ shouldShowAddButton, shouldEnableAddButton }` thay vì void
- Logic mới:
  - Nếu `allowDuplicate = true`: Luôn enable Add button
  - Nếu `allowDuplicate = false`: Kiểm tra duplicate
    - Nếu duplicate: Disable Add button, hiển thị feedback + View link
    - Nếu không duplicate: Enable Add button
- KHÔNG hiển thị Update button (chỉ hiển thị sau Add action)

#### 1.3 Cập nhật hàm `showPopup()`
**Thay đổi:**
- Thêm logic kiểm tra kết nối Anki
- Nếu không kết nối: Ẩn nút "Add to Anki"
- Nếu kết nối OK: Gọi `autoCheckAnkiOnOpen()` và cấu hình nút theo kết quả
- Ẩn nút "Update card" ban đầu (chỉ hiển thị sau Add thành công)

```javascript
// Check Anki connection and configure Add button
const ankiConnected = await checkAnkiConnection();
const addBtn = newPopup.querySelector(".yomi-add-anki-btn");
const updateBtn = newPopup.querySelector(".yomi-update-anki-btn");

// Hide Update button initially
if (updateBtn) {
  updateBtn.style.display = "none";
}

if (!ankiConnected) {
  // Anki not connected - hide Add button
  if (addBtn) {
    addBtn.style.display = "none";
  }
} else {
  // Anki connected - check allowDuplicate and existing notes
  const ankiConfig = await loadAnkiUIConfig();
  const checkResult = await autoCheckAnkiOnOpen(newPopup, data, ankiConfig);
  
  if (addBtn) {
    if (!checkResult.shouldShowAddButton) {
      addBtn.style.display = "none";
    } else {
      addBtn.disabled = !checkResult.shouldEnableAddButton;
      if (!checkResult.shouldEnableAddButton) {
        addBtn.title = "Note already exists in Anki";
      }
    }
  }
}
```

#### 1.4 Cập nhật hàm `addNoteToAnki()`
**Thay đổi:**
- Lưu noteIds vào `popup._ankiNoteIds`
- Gọi `ensureUpdateButton()` CHỈ sau khi Add thành công (cả success và duplicate)
- Sử dụng `buildAnkiPayload()` để lấy dữ liệu mới nhất khi Update
- Phân biệt rõ giữa auto-check duplicate và Add action duplicate

```javascript
// Handle duplicate case
if (response.duplicate) {
  showFeedback(popup, `Note already in Anki`, "info");
  showViewLink(popup, response.noteIds);
  popup._ankiNoteIds = response.noteIds;
  
  if (addBtn) {
    addBtn.textContent = "Added";
    addBtn.disabled = true;
  }
  
  // Show Update button after Add action (even if duplicate)
  ensureUpdateButton(popup, () => {
    const payload = buildAnkiPayload(dataOfCard, popup);
    updateExistingAnkiCard(payload, response.noteIds?.[0], popup);
  });
  return;
}

// Handle success case
if (response.success) {
  showFeedback(popup, `Added ${dataOfCard.term || "word"} to Anki`, "success");
  showViewLink(popup, response.noteIds);
  popup._ankiNoteIds = response.noteIds;
  
  if (addBtn) {
    addBtn.textContent = "Added";
    addBtn.disabled = true;
  }
  
  // Show Update button after successful Add
  ensureUpdateButton(popup, () => {
    const payload = buildAnkiPayload(dataOfCard, popup);
    updateExistingAnkiCard(payload, response.noteIds?.[0], popup);
  });
}
```

#### 1.5 Cập nhật hàm `ensureUpdateButton()`
**Thay đổi:**
- Thêm `btn.style.display = "inline-block"` để hiển thị nút
- Sửa selector từ `.yomi-header-main` thành `.yomi-header-actions`

#### 1.6 Cập nhật hàm `updateExistingAnkiCard()`
**Thay đổi:**
- Sử dụng `showFeedback()` thay vì `alert()`
- Hiển thị feedback "Card updated successfully" hoặc "Failed to update card"
- Update trạng thái nút Update thành "Updated" và disable

### 2. File: `scripts/background.js`

#### 2.1 Thêm action `checkAnkiConnection`
```javascript
if (request.action === "checkAnkiConnection") {
  ankiInvoke("version")
    .then((res) => {
      if (res && !res.error) {
        sendResponse({ connected: true, version: res.result });
      } else {
        sendResponse({ connected: false });
      }
    })
    .catch(() => sendResponse({ connected: false }));
  return true;
}
```
**Mục đích:** Ping Anki Connect để kiểm tra kết nối

#### 2.2 Thêm action `checkNoteExists`
```javascript
if (request.action === "checkNoteExists") {
  const word = request.word;
  if (!word) {
    sendResponse({ exists: false });
    return;
  }
  
  loadAnkiConfig()
    .then(async (cfg) => {
      const targetField = cfg.fieldMapping?.["Target word"];
      if (!targetField) {
        sendResponse({ exists: false });
        return;
      }
      
      const query = `"${targetField}:${word}"`;
      const found = await ankiInvoke("findNotes", { query });
      
      if (Array.isArray(found.result) && found.result.length > 0) {
        sendResponse({ exists: true, noteIds: found.result });
      } else {
        sendResponse({ exists: false });
      }
    })
    .catch(() => sendResponse({ exists: false }));
  return true;
}
```
**Mục đích:** Kiểm tra xem thẻ đã tồn tại trong Anki chưa

## Workflow mới

```
B1: User search word
B2: Popup mở
    ↓
    Kiểm tra kết nối Anki (checkAnkiConnection)
    ↓
    ├─ Không kết nối → Ẩn nút "Add to Anki", END
    │
    └─ Kết nối OK
       ↓
       Load config allowDuplicate
       ↓
       ├─ allowDuplicate = true
       │  → Enable nút "Add to Anki"
       │
       └─ allowDuplicate = false
          ↓
          Auto-check duplicate (checkNoteExists)
          ↓
          ├─ Duplicate
          │  → Disable nút "Add to Anki"
          │  → Hiển thị feedback "Note already in Anki"
          │  → Hiển thị View link
          │  → KHÔNG hiển thị Update button
          │
          └─ Không duplicate
             → Enable nút "Add to Anki"

B3: User nhấn "Add to Anki" (nếu enabled)
    ↓
    Gửi request addNoteToAnki
    ↓
    ├─ Success
    │  → Feedback "Added {term} to Anki"
    │  → View link
    │  → Nút Add → "Added" (disabled)
    │  → Hiển thị nút "Update card"
    │
    ├─ Duplicate
    │  → Feedback "Note already in Anki"
    │  → View link
    │  → Nút Add → "Added" (disabled)
    │  → Hiển thị nút "Update card"
    │
    └─ Error
       → Feedback "Error: {message}"

B4: User nhấn "View" → Mở Anki Browser
B5: User nhấn "Update card" → Cập nhật thẻ với dữ liệu mới
```

## Điểm khác biệt chính

### 1. Nút "Add to Anki"
- **Trước:** Luôn hiển thị
- **Sau:** 
  - Ẩn nếu Anki không kết nối
  - Disable nếu allowDuplicate=false và thẻ đã tồn tại

### 2. Nút "Update card"
- **Trước:** Có thể hiển thị khi auto-check phát hiện duplicate
- **Sau:** CHỈ hiển thị sau khi user nhấn "Add to Anki" và thành công

### 3. Auto-check duplicate
- **Trước:** Chỉ hiển thị feedback
- **Sau:** 
  - Hiển thị feedback + View link
  - Disable nút Add nếu allowDuplicate=false
  - KHÔNG hiển thị Update button

### 4. Feedback
- **Trước:** Sử dụng alert() cho Update
- **Sau:** Sử dụng showFeedback() thống nhất

## Test Cases cần verify

1. ✅ Anki không chạy → Nút Add ẩn
2. ✅ allowDuplicate=true → Nút Add luôn enabled
3. ✅ allowDuplicate=false + thẻ tồn tại → Nút Add disabled
4. ✅ allowDuplicate=false + thẻ chưa tồn tại → Nút Add enabled
5. ✅ Add thành công → Hiển thị Update button
6. ✅ Add duplicate → Hiển thị Update button
7. ✅ Auto-check duplicate → KHÔNG hiển thị Update button
8. ✅ Update thành công → Feedback "Card updated successfully"

## Files đã thay đổi

1. `scripts/popupDictionary.js` - Logic UI và workflow
2. `scripts/background.js` - Actions mới cho Anki
