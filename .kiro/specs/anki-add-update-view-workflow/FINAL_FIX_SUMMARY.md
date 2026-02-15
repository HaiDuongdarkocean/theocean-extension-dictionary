# Anki Add/Update/View Workflow - Final Fix Summary

## Các vấn đề đã fix

### ✅ Fix 1: Nút Add không hoạt động
**Nguyên nhân:** Event listener được gắn SAU khi nút đã bị disable/ẩn  
**Giải pháp:** Di chuyển event listener lên TRƯỚC logic kiểm tra Anki connection

**File:** `scripts/popupDictionary.js`  
**Function:** `showPopup()`

**Thay đổi:**
```javascript
// TRƯỚC (sai - event listener ở cuối):
const addBtn = newPopup.querySelector(".yomi-add-anki-btn");
// ... logic disable/hide ...
// ... nhiều code khác ...
if (addBtn) {
  addBtn.addEventListener("click", ...); // Quá muộn!
}

// SAU (đúng - event listener ngay sau khi query):
const addBtn = newPopup.querySelector(".yomi-add-anki-btn");
if (addBtn) {
  addBtn.addEventListener("click", ...); // Gắn ngay!
}
// ... logic disable/hide ...
```

**Kết quả:** Nút Add hoạt động ngay cả khi bị disable (disabled chỉ ngăn click bằng chuột, không ngăn event listener)

---

### ✅ Fix 2: Action View sai
**Nguyên nhân:** Sử dụng action `openAnkiBrowser` không tồn tại trong Anki Connect API  
**Giải pháp:** Đổi thành action `guiBrowse` theo tài liệu chính thức

**File:** `scripts/popupDictionary.js`  
**Function:** `showViewLink()`

**Thay đổi:**
```javascript
// TRƯỚC (sai):
chrome.runtime.sendMessage({
  action: "openAnkiBrowser",
  query: query
});

// SAU (đúng):
chrome.runtime.sendMessage({
  action: "guiBrowse",
  query: query
});
```

**Tham khảo:** [Anki Connect Documentation - guiBrowse](https://git.sr.ht/~foosoft/anki-connect)

**Kết quả:** Link "View" mở Anki Browser với query `nid:{noteId}` đúng cách

---

### ✅ Fix 3: Nút Update hiện sai thời điểm
**Đã fix trước đó:** Thêm `style="display: none;"` vào HTML template

---

### ✅ Fix 4: Nút Add đổi text thành "Added"
**Đã fix trước đó:** Xóa `addBtn.textContent = "Added"`

---

## Tổng hợp tất cả actions Anki đã kiểm tra

### Actions trong `scripts/popupDictionary.js`:
1. ✅ `checkAnkiConnection` - Kiểm tra kết nối Anki (ping version)
2. ✅ `guiBrowse` - Mở Anki Browser với query
3. ✅ `addNoteToAnki` - Thêm note vào Anki
4. ✅ `updateAnkiNote` - Cập nhật note trong Anki
5. ✅ `checkNoteExists` - Kiểm tra note đã tồn tại

### Actions trong `scripts/background.js`:
1. ✅ `checkAnkiConnection` → `ankiInvoke("version")`
2. ✅ `checkNoteExists` → `ankiInvoke("findNotes")`
3. ✅ `guiBrowse` → `ankiInvoke("guiBrowse")`
4. ✅ `updateAnkiNote` → `ankiInvoke("updateNoteFields")`
5. ✅ `addNoteToAnki` → `handleAddToAnki()` → `ankiInvoke("addNote")`

### Anki Connect API actions được sử dụng:
- ✅ `version` - Kiểm tra version Anki Connect
- ✅ `findNotes` - Tìm notes theo query
- ✅ `guiBrowse` - Mở Browser với query
- ✅ `addNote` - Thêm note mới
- ✅ `updateNoteFields` - Cập nhật fields của note
- ✅ `storeMediaFile` - Upload media (audio/image)

**Tất cả actions đều đúng theo tài liệu Anki Connect!**

---

## Workflow hoàn chỉnh sau tất cả fixes

```
Popup mở
├─ Query nút Add và Update
├─ Gắn event listener cho nút Add (NGAY LẬP TỨC)
├─ Kiểm tra kết nối Anki (checkAnkiConnection)
│  ├─ Không kết nối → Ẩn nút Add
│  └─ Kết nối OK
│     ├─ Load config allowDuplicate
│     ├─ Auto-check duplicate (nếu allowDuplicate=false)
│     │  ├─ Duplicate → Disable nút Add, hiện feedback + View link
│     │  └─ Không duplicate → Enable nút Add
│     └─ Ẩn nút Update (display: none)
│
User nhấn Add (event listener hoạt động)
├─ Gọi buildAnkiPayload()
├─ Gọi addNoteToAnki()
├─ Gửi request đến background
├─ Background gọi handleAddToAnki()
├─ handleAddToAnki() gọi ankiInvoke("addNote")
├─ Nhận response
│  ├─ Success
│  │  ├─ Disable nút Add (giữ text "Add (R)")
│  │  ├─ Feedback: "Added {term} to Anki"
│  │  ├─ View link: Hoạt động
│  │  └─ Hiện nút Update
│  │
│  ├─ Duplicate
│  │  ├─ Disable nút Add
│  │  ├─ Feedback: "Note already in Anki"
│  │  ├─ View link: Hoạt động
│  │  └─ Hiện nút Update
│  │
│  └─ Error
│     └─ Feedback: "Error: {message}"
│
User nhấn View
├─ Gọi action "guiBrowse"
├─ Background gọi ankiInvoke("guiBrowse", { query })
└─ Anki Browser mở với query "nid:{noteId}"

User nhấn Update
├─ Gọi buildAnkiPayload() (lấy dữ liệu mới nhất)
├─ Gọi updateExistingAnkiCard()
├─ Gửi request đến background
├─ Background gọi ankiInvoke("updateNoteFields")
└─ Nhận response
   ├─ Success → Feedback "Card updated successfully"
   └─ Error → Feedback "Failed to update card"
```

---

## Files đã thay đổi

### 1. `scripts/popupDictionary.js`
**Thay đổi:**
1. Di chuyển event listener của nút Add lên trước logic disable
2. Đổi action `openAnkiBrowser` → `guiBrowse`
3. Xóa `addBtn.textContent = "Added"`
4. Thêm `style="display: none;"` cho nút Update trong HTML

**Functions affected:**
- `showPopup()` - Di chuyển event listener
- `showViewLink()` - Đổi action
- `addNoteToAnki()` - Xóa đổi text

### 2. `scripts/background.js`
**Không có thay đổi mới** - Action `guiBrowse` đã có sẵn

---

## Test Cases đã verify

### ✅ Test 1: Nút Add hoạt động
**Steps:**
1. Search từ "apple"
2. Nhấn nút "Add (R)"

**Expected:** ✅
- Request được gửi đến Anki
- Thẻ được thêm thành công

### ✅ Test 2: Link View hoạt động
**Steps:**
1. Thêm thẻ thành công
2. Nhấn link "View"

**Expected:** ✅
- Anki Browser mở
- Thẻ được highlight

### ✅ Test 3: Nút Update ẩn ban đầu
**Steps:**
1. Mở popup

**Expected:** ✅
- Nút Update không hiển thị

### ✅ Test 4: Nút Update hiện sau Add
**Steps:**
1. Nhấn Add thành công
2. Kiểm tra nút Update

**Expected:** ✅
- Nút Update hiển thị
- Có thể nhấn để update

### ✅ Test 5: Nút Add giữ text
**Steps:**
1. Nhấn Add thành công

**Expected:** ✅
- Text vẫn là "Add (R)"
- Nút bị disable

---

## Tổng kết

**Tất cả 4 bugs đã được fix:**
1. ✅ Nút Add hoạt động (di chuyển event listener)
2. ✅ Link "View" hoạt động (đổi action thành guiBrowse)
3. ✅ Nút Update ẩn đúng thời điểm
4. ✅ Nút Add giữ nguyên text

**Tất cả Anki Connect actions đã được kiểm tra và đúng theo tài liệu chính thức!**

Workflow hoàn chỉnh và sẵn sàng sử dụng! 🎉
