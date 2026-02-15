# Anki Add/Update/View Workflow - Bug Fixes

## Các bug đã fix

### ✅ Fix 1: Giữ nguyên text nút Add
**Bug:** Khi nhấn Add, nút text đổi thành "Added"  
**Fix:** Xóa dòng `addBtn.textContent = "Added"`, chỉ giữ `addBtn.disabled = true`

**File:** `scripts/popupDictionary.js`  
**Function:** `addNoteToAnki()`

**Thay đổi:**
```javascript
// TRƯỚC (sai):
if (addBtn) {
  addBtn.textContent = "Added";
  addBtn.disabled = true;
}

// SAU (đúng):
if (addBtn) {
  addBtn.disabled = true;
}
```

**Kết quả:** Nút Add giữ nguyên text "Add (R)" sau khi nhấn, chỉ bị disable

---

### ✅ Fix 2: Link "View" hoạt động đúng
**Bug:** Nhấn vào link "View" không có sự kiện gì xảy ra  
**Fix:** Đổi action từ `openBrowser` thành `guiBrowse` và format query đúng

**File:** `scripts/popupDictionary.js`  
**Function:** `showViewLink()`

**Thay đổi:**
```javascript
// TRƯỚC (sai):
link.onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  chrome.runtime.sendMessage({
    action: "openBrowser",
    noteIds: noteIds
  });
};

// SAU (đúng):
link.onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const query = Array.isArray(noteIds) && noteIds.length > 0
    ? noteIds.map((id) => `nid:${id}`).join(" OR ")
    : "";
  chrome.runtime.sendMessage({
    action: "guiBrowse",
    query: query
  });
};
```

**Kết quả:** Link "View" mở Anki Browser với query `nid:{noteId}`, hiển thị thẻ vừa thêm

---

### ✅ Fix 3: Ẩn nút Update đúng thời điểm
**Bug:** Nút Update hiện ngay khi popup mở (do HTML template)  
**Fix:** Thêm `style="display: none;"` vào HTML template

**File:** `scripts/popupDictionary.js`  
**Function:** `showPopup()` - HTML template

**Thay đổi:**
```javascript
// TRƯỚC (sai):
<button class="yomi-update-anki-btn" title="Update card" type="button">Update (U)</button>

// SAU (đúng):
<button class="yomi-update-anki-btn" style="display: none;" title="Update card" type="button">Update (U)</button>
```

**Logic:**
1. HTML template: Nút Update ẩn (`display: none`)
2. Auto-check duplicate: KHÔNG hiện nút Update
3. User nhấn Add → Success/Duplicate: `ensureUpdateButton()` hiện nút (`display: inline-block`)

**Kết quả:** Nút Update chỉ hiện sau khi user nhấn Add và thành công

---

## Workflow sau khi fix

```
Popup mở
├─ Nút Add: Hiển thị (nếu Anki connected)
├─ Nút Update: ẨN (display: none trong HTML)
└─ Auto-check duplicate (nếu allowDuplicate=false)
   ├─ Có duplicate
   │  ├─ Feedback: "Note already in Anki"
   │  ├─ View link: Hoạt động, mở Anki Browser
   │  ├─ Nút Add: Disable
   │  └─ Nút Update: VẪN ẨN
   │
   └─ Không duplicate
      └─ Nút Add: Enable

User nhấn Add
├─ Success
│  ├─ Nút Add: Disable (giữ text "Add (R)")
│  ├─ Feedback: "Added {term} to Anki"
│  ├─ View link: Hoạt động → Mở Anki Browser
│  └─ Nút Update: HIỆN (display: inline-block)
│
├─ Duplicate
│  ├─ Nút Add: Disable (giữ text "Add (R)")
│  ├─ Feedback: "Note already in Anki"
│  ├─ View link: Hoạt động → Mở Anki Browser
│  └─ Nút Update: HIỆN (display: inline-block)
│
└─ Error
   └─ Feedback: "Error: {message}"

User nhấn View
└─ Gọi action "guiBrowse" với query "nid:{noteId}"
   └─ Anki Browser mở và highlight thẻ

User nhấn Update
└─ Gọi updateExistingAnkiCard() với noteId
   ├─ Success → Feedback "Card updated successfully"
   └─ Error → Feedback "Failed to update card"
```

## Test Cases đã verify

### ✅ Test 1: Nút Add giữ nguyên text
**Steps:**
1. Search từ "apple"
2. Nhấn "Add to Anki"
3. Thành công

**Expected:** ✅
- Nút Add vẫn hiển thị text "Add (R)"
- Nút Add bị disable (không thể nhấn lại)

### ✅ Test 2: Link View hoạt động
**Steps:**
1. Search từ "apple"
2. Nhấn "Add to Anki"
3. Thành công → Hiện link "View"
4. Nhấn link "View"

**Expected:** ✅
- Anki Browser mở
- Thẻ "apple" được highlight

### ✅ Test 3: Nút Update ẩn ban đầu
**Steps:**
1. Search từ "apple" (đã có trong Anki)
2. Popup mở
3. Auto-check phát hiện duplicate

**Expected:** ✅
- Feedback: "Note already in Anki"
- Link "View" hiện
- Nút Add disable
- Nút Update KHÔNG hiện

### ✅ Test 4: Nút Update hiện sau Add
**Steps:**
1. Search từ "banana"
2. Nhấn "Add to Anki"
3. Thành công

**Expected:** ✅
- Nút Update hiện
- Có thể nhấn Update để sửa thẻ

## Files đã thay đổi

1. `scripts/popupDictionary.js`
   - Function `addNoteToAnki()`: Xóa đổi text nút Add
   - Function `showViewLink()`: Fix action và query
   - HTML template trong `showPopup()`: Ẩn nút Update ban đầu

## Tổng kết

Tất cả 3 bugs đã được fix:
1. ✅ Nút Add giữ nguyên text "Add (R)"
2. ✅ Link "View" hoạt động, mở Anki Browser
3. ✅ Nút Update chỉ hiện sau Add thành công

Workflow hoạt động đúng theo requirements!
