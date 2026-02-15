# Header Layout Restructure - Design Document

## Architecture Overview

### Component Structure
```
yomi-header (sticky, z-index: 10)
├── yomi-header-row-1 (Meta & Action)
│   ├── yomi-pronunciation (left)
│   └── yomi-header-actions (right)
│       ├── yomi-update-anki-btn
│       └── yomi-add-anki-btn
├── yomi-header-row-2 (Target Word)
│   └── popup-term-title
├── yomi-header-row-3 (Information)
│   └── yomi-frequency
└── yomi-feedback-bar (Dynamic)
    └── yomi-feedback-content
        ├── yomi-feedback-message
        └── yomi-feedback-link (optional)
```

## Visual Design

### Layout Specifications

#### Row 1: Meta & Action
- **Height**: 24px
- **Padding**: 0 16px
- **Display**: flex, space-between
- **Left**: IPA pronunciation
  - Font size: 12px
  - Color: --text-sub
  - Font style: italic
- **Right**: Action buttons
  - Gap: 8px
  - Button size: compact

#### Row 2: Target Word
- **Height**: auto (min 32px)
- **Padding**: 8px 16px
- **Font size**: 24px
- **Font weight**: 700
- **Color**: --primary
- **Line height**: 1.2
- **Word break**: break-word

#### Row 3: Information
- **Height**: auto (min 20px)
- **Padding**: 4px 16px 8px
- **Font size**: 13px
- **Color**: --text-sub
- **Font style**: normal

#### Row 4: Feedback Bar
- **Height**: auto (min 24px)
- **Padding**: 8px 16px
- **Background**: --surface (subtle)
- **Border top**: 1px solid --border
- **Display**: flex, align-items: center
- **Gap**: 4px

### Feedback Bar States

#### State 1: Auto-check Found
```
Message: "Note already in Anki. [View] here"
Styling: neutral (--text-main)
Link: underlined, --primary color
```

#### State 2: Add Success
```
Message: "Added {word} to Anki. [View] here!"
Styling: success (--text-main or green tint)
Link: underlined, --primary color
```

#### State 3: Error
```
Message: "Error: {error message}"
Styling: error (red/warning color)
Link: none
Auto-dismiss: 5 seconds
```

#### State 4: Empty
```
Display: none or minimal height
```

## Data Flow

### Auto-check Flow
```
1. showPopup() called
2. Create popup element
3. Call autoCheckAnkiOnOpen(popup, data)
4. Send message to background: { action: "checkNoteExists", word }
5. Receive response: { exists: boolean, noteIds: [] }
6. If exists: showFeedback(popup, "Note already in Anki", "info")
7. showViewLink(popup, noteIds)
```

### Add Success Flow
```
1. User clicks [Add] button
2. addNoteToAnki() called
3. Send message to background: { action: "addNote", ... }
4. Receive response: { success: true, noteIds: [] }
5. showFeedback(popup, "Added {word} to Anki", "success")
6. showViewLink(popup, noteIds)
```

### Error Flow
```
1. Operation fails
2. showFeedback(popup, error.message, "error")
3. Auto-dismiss after 5 seconds
4. Or dismiss on user action
```

## CSS Design

### Color Scheme
- Success: --text-main (neutral) or green tint
- Error: #d32f2f (red) or --error color
- Link: --primary (blue), underlined
- Background: --surface (subtle)

### Typography
- Row 1: 12px, italic, --text-sub
- Row 2: 24px, bold (700), --primary
- Row 3: 13px, normal, --text-sub
- Feedback: 13px, normal, --text-main

### Spacing
- Header padding: 16px horizontal
- Row gaps: 4-8px
- Feedback padding: 8px 16px
- Button gap: 8px

## Implementation Details

### Function: autoCheckAnkiOnOpen()
```javascript
async function autoCheckAnkiOnOpen(popup, data) {
  try {
    const response = await runtimeMessageWithTimeout({
      action: "checkNoteExists",
      word: data.term
    }, 2000);
    
    if (response?.exists) {
      showFeedback(popup, "Note already in Anki", "info");
      showViewLink(popup, response.noteIds);
    }
  } catch (err) {
    console.error("Auto-check failed:", err);
    // Silently fail, don't show error
  }
}
```

### Function: showFeedback()
```javascript
function showFeedback(popup, message, type = "info") {
  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;
  
  feedbackBar.innerHTML = `
    <div class="yomi-feedback-content yomi-feedback-${type}">
      <span class="yomi-feedback-message">${escapeHtml(message)}</span>
    </div>
  `;
  
  feedbackBar.style.display = "flex";
  
  if (type === "error") {
    setTimeout(() => dismissFeedback(popup), 5000);
  }
}
```

### Function: showViewLink()
```javascript
function showViewLink(popup, noteIds) {
  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;
  
  const content = feedbackBar.querySelector(".yomi-feedback-content");
  if (!content) return;
  
  const link = document.createElement("a");
  link.href = "#";
  link.className = "yomi-feedback-link";
  link.textContent = "View";
  link.onclick = (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({
      action: "openBrowser",
      noteIds: noteIds
    });
  };
  
  content.appendChild(link);
}
```

### Function: dismissFeedback()
```javascript
function dismissFeedback(popup) {
  const feedbackBar = popup.querySelector(".yomi-feedback-bar");
  if (!feedbackBar) return;
  
  feedbackBar.innerHTML = "";
  feedbackBar.style.display = "none";
}
```

## State Management

### Popup Properties
- `popup._feedbackBar`: Reference to feedback bar element
- `popup._feedbackTimeout`: Timeout ID for auto-dismiss
- `popup._lastNoteIds`: Last viewed note IDs

## Integration Points

### With showPopup()
- Call `autoCheckAnkiOnOpen()` after popup is created
- Pass `data` and `popup` to the function

### With addNoteToAnki()
- After successful add, call `showFeedback()` and `showViewLink()`
- Pass note IDs from response

### With updateExistingAnkiCard()
- After successful update, show feedback
- Pass note IDs from response

## Styling Considerations

### Responsive Design
- Header width: 320px (popup width)
- Text wrapping: enabled for long words
- Button sizing: compact, no text truncation

### Dark Mode
- Use CSS variables (--text-main, --text-sub, --primary, --surface)
- Automatic adaptation via prefers-color-scheme

### Accessibility
- Sufficient color contrast
- Links are underlined (not color-only)
- Feedback messages are clear and descriptive

## Testing Strategy

### Unit Tests
- Test feedback message display
- Test View link functionality
- Test auto-dismiss timeout
- Test error handling

### Integration Tests
- Test auto-check on popup open
- Test add success flow
- Test error flow
- Test View link opens browser

### Manual Tests
- Verify layout on 320px width
- Verify dark mode appearance
- Verify keyboard accessibility
- Verify link functionality

## Performance Considerations

### Auto-check Timeout
- 2 second timeout to prevent hanging
- Silently fail if timeout exceeded
- Don't block popup display

### Feedback Updates
- Instant display (no animation delay)
- Smooth transitions (optional)
- No layout shift

## Future Enhancements

### Phase 2
- Add animation for feedback appearance
- Add sound notification for success
- Add undo functionality for add/update
- Add batch operations feedback

### Phase 3
- Add progress indicator for long operations
- Add detailed error messages with suggestions
- Add feedback history
- Add customizable feedback messages
