# Instant Lookup on Keypress - Implementation Summary

## Trạng thái: ✅ HOÀN THÀNH

## Vấn đề ban đầu

**Behavior hiện tại:**
- User nhấn phím tắt (Ctrl/Alt/Shift) → giữ phím → di chuyển chuột → popup mới xuất hiện
- Tra từ chỉ được trigger bởi `mousemove` event
- Nếu nhấn phím mà không di chuyển chuột → không có lookup

**Yêu cầu:**
- Khi nhấn phím tắt → hệ thống nhận biết ngay vị trí con trỏ chuột và tra cứu
- Không cần đợi hành động `mousemove`

## Giải pháp: Option B - Refactor thành Lookup Function

### Kiến trúc mới

#### 1. Track Last Mouse Position
```javascript
let lastMousePosition = { x: 0, y: 0 };

document.addEventListener("mousemove", (event) => {
  // Update last mouse position
  lastMousePosition.x = event.clientX;
  lastMousePosition.y = event.clientY;
  // ... rest of mousemove logic
});
```

#### 2. Extract Lookup Logic → `performLookup()`
```javascript
async function performLookup(clientX, clientY, closestPopup = null) {
  // 1. Get range at coordinates
  let range = document.caretRangeFromPoint(clientX, clientY);
  
  // 2. Validate range
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return;
  
  // 3. Check if over text (padding check)
  const rect = range.getBoundingClientRect();
  const padding = 8;
  const isOverText = /* check if within padding */;
  if (!isOverText) return;
  
  // 4. Use Ocean Context Engine
  const oceanContext = getOceanContext(range);
  
  // 5. Create context window (3 words before, 6 words after)
  const contextWindow = /* ... */;
  
  // 6. Lemmatization via findLongestWord()
  const infoOfSentenceAndWord = await findLongestWord(contextWindow, targetIndex);
  
  // 7. Translate sentence (if enabled)
  if (config.translateEnabled) { /* ... */ }
  
  // 8. Check duplicate
  const isAlreadyShown = popupStack.some(/* ... */);
  if (isAlreadyShown) return;
  
  // 9. Show popup
  let level = closestPopup ? parseInt(closestPopup.dataset.level) + 1 : 1;
  showPopup(clientX, clientY, infoOfSentenceAndWord, level);
}
```

#### 3. Refactor Mousemove Handler
```javascript
document.addEventListener("mousemove", (event) => {
  // Update last mouse position
  lastMousePosition.x = event.clientX;
  lastMousePosition.y = event.clientY;
  
  const closestPopup = event.target.closest(".yomitan-popup-stack");
  
  // 1. Popup close management
  // ...
  
  // 2. Lookup management
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(async () => {
    if (!isLookupTriggered(event)) return;
    await performLookup(event.clientX, event.clientY, closestPopup);
  }, 150);
});
```

#### 4. Add Keydown Listener for Instant Lookup
```javascript
document.addEventListener("keydown", async (event) => {
  // Only trigger if we're in a modifier key lookup mode (not hover)
  if (lookupMode === "hover") return;
  
  // Check if the pressed key matches the lookup mode
  const shouldTrigger = 
    (lookupMode === "ctrl" && event.ctrlKey && (event.code === "ControlLeft" || event.code === "ControlRight")) ||
    (lookupMode === "alt" && event.altKey && (event.code === "AltLeft" || event.code === "AltRight")) ||
    (lookupMode === "shift" && event.shiftKey && (event.code === "ShiftLeft" || event.code === "ShiftRight"));
  
  if (!shouldTrigger) return;
  
  event.preventDefault();
  
  // Find closest popup at last mouse position
  const elementAtPoint = document.elementFromPoint(lastMousePosition.x, lastMousePosition.y);
  const closestPopup = elementAtPoint?.closest(".yomitan-popup-stack");
  
  console.log("Keydown instant lookup triggered at:", lastMousePosition);
  
  // Perform lookup at last mouse position
  await performLookup(lastMousePosition.x, lastMousePosition.y, closestPopup);
});
```

## Workflow mới

### Case 1: Mousemove Lookup (existing behavior)
```
User di chuyển chuột
→ mousemove event
→ Update lastMousePosition
→ Check isLookupTriggered() (hover/ctrl/alt/shift)
→ Debounce 150ms
→ performLookup(event.clientX, event.clientY)
→ Show popup
```

### Case 2: Keydown Instant Lookup (NEW)
```
User nhấn phím tắt (Ctrl/Alt/Shift)
→ keydown event
→ Check lookupMode matches pressed key
→ Get lastMousePosition
→ Find closestPopup at that position
→ performLookup(lastMousePosition.x, lastMousePosition.y)
→ Show popup NGAY LẬP TỨC (no debounce)
```

## Ưu điểm của giải pháp

1. **Clean Architecture**: Logic tra từ được tách riêng thành function
2. **Reusable**: `performLookup()` có thể gọi từ nhiều nguồn (mousemove, keydown, API)
3. **No Breaking Changes**: Behavior cũ vẫn hoạt động bình thường
4. **Instant Response**: Keydown trigger không có debounce → phản hồi tức thì
5. **Easy to Test**: Function độc lập dễ test và debug
6. **Maintainable**: Dễ thêm trigger mới trong tương lai (ví dụ: context menu, button click)

## Test Cases

### Test 1: Mousemove Lookup (Existing)
1. Hover chuột lên từ "hello"
2. Popup xuất hiện sau 150ms
3. ✅ Behavior không thay đổi

### Test 2: Keydown Instant Lookup (NEW)
1. Đặt chuột lên từ "hello" (không di chuyển)
2. Nhấn phím Ctrl (nếu lookupMode = "ctrl")
3. ✅ Popup xuất hiện NGAY LẬP TỨC
4. Console log: "Keydown instant lookup triggered at: {x, y}"

### Test 3: Keydown + Mousemove Combo
1. Nhấn giữ Ctrl
2. Di chuyển chuột qua nhiều từ
3. ✅ Popup xuất hiện cho mỗi từ (mousemove behavior)

### Test 4: Hover Mode (No Keydown Trigger)
1. Set lookupMode = "hover"
2. Nhấn Ctrl/Alt/Shift
3. ✅ Không trigger lookup (chỉ mousemove trigger)

### Test 5: Multiple Popups (Level System)
1. Keydown lookup từ "hello" → popup level 1
2. Hover vào từ trong popup → popup level 2
3. ✅ Level system hoạt động đúng

## Files đã sửa

1. ✅ `scripts/popupDictionary.js`
   - Thêm biến `lastMousePosition`
   - Tạo hàm `performLookup(clientX, clientY, closestPopup)`
   - Refactor mousemove handler để gọi `performLookup()`
   - Thêm keydown listener cho instant lookup

## Edge Cases đã xử lý

1. **lastMousePosition chưa được set**: Mặc định `{x: 0, y: 0}` → lookup tại góc trên trái (thường không có text)
2. **lookupMode = "hover"**: Keydown listener không trigger
3. **Pressed key không match lookupMode**: Không trigger
4. **No text at position**: `performLookup()` return early (range validation)
5. **Duplicate word**: Check `isAlreadyShown` trước khi show popup

## Performance

- **Mousemove**: Debounce 150ms (không thay đổi)
- **Keydown**: No debounce → instant response
- **Memory**: Chỉ thêm 1 object `lastMousePosition` → negligible

## Kết luận

Giải pháp Option B đã được implement thành công:
- ✅ Refactor logic tra từ thành function độc lập
- ✅ Thêm keydown trigger cho instant lookup
- ✅ Không break existing behavior
- ✅ Clean architecture, dễ maintain
- ✅ Đáp ứng đầy đủ requirement

User giờ có thể:
1. Hover chuột → tra từ (existing)
2. Nhấn phím tắt → tra từ ngay tại vị trí chuột (NEW)
3. Nhấn giữ phím + di chuyển chuột → tra từ liên tục (existing)
