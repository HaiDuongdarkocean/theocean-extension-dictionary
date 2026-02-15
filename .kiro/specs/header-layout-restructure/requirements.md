# Header Layout Restructure - Requirements

## Feature Overview
Restructure the popup dictionary header to improve visual hierarchy and user feedback. The header will be reorganized into 4 distinct rows with a dynamic feedback bar at the bottom for Anki operations.

## User Stories

### US1: Display Header Meta Information
**As a** language learner  
**I want to** see pronunciation and action buttons in the header  
**So that** I can quickly access pronunciation and Anki controls

**Acceptance Criteria:**
1. Header Row 1 displays IPA pronunciation on the left (e.g., /sæd/)
2. Header Row 1 displays [Update (U)] and [Add (R)] buttons on the right
3. Pronunciation text uses --text-sub color and smaller font size
4. Buttons are properly aligned and clickable

### US2: Display Target Word Prominently
**As a** language learner  
**I want to** see the target word displayed large and bold  
**So that** it's the focal point of the popup

**Acceptance Criteria:**
1. Header Row 2 displays the target word (e.g., "sad")
2. Word is displayed in large font (24px+), bold weight (700+)
3. Word uses --primary color (blue)
4. Word is centered or left-aligned consistently

### US3: Display Word Information
**As a** language learner  
**I want to** see word frequency and other metadata  
**So that** I understand the word's importance

**Acceptance Criteria:**
1. Header Row 3 displays frequency information (e.g., "frequency: 300")
2. Information text uses --text-sub color and smaller font
3. Information is displayed elegantly without clutter

### US4: Auto-check Anki on Popup Open
**As a** language learner  
**I want to** automatically know if a word is already in Anki  
**So that** I don't add duplicates

**Acceptance Criteria:**
1. When popup opens, system automatically searches for the word in Anki
2. If word found: Display feedback "Note already in Anki. [View] here"
3. [View] link is underlined and clickable
4. Clicking [View] opens the note in Anki Browser
5. Feedback appears in Header Row 4 (Feedback Bar)

### US5: Show Success Feedback After Add
**As a** language learner  
**I want to** see confirmation when I add a word to Anki  
**So that** I know the operation succeeded

**Acceptance Criteria:**
1. After clicking [Add], display feedback "Added {word} to Anki. [View] here!"
2. [View] link is underlined and clickable
3. Clicking [View] opens the newly added note in Anki Browser
4. Feedback appears in Header Row 4 (Feedback Bar)
5. Success message uses positive styling (green or neutral)

### US6: Show Error Feedback
**As a** language learner  
**I want to** see error messages when operations fail  
**So that** I understand what went wrong

**Acceptance Criteria:**
1. When an error occurs, display error message in Header Row 4
2. Error message uses error styling (red/warning color)
3. Error message is clear and actionable
4. Error message disappears after 5 seconds or when user takes action

### US7: Feedback Bar Layout
**As a** developer  
**I want to** have a dedicated feedback bar in the header  
**So that** all Anki operation feedback is centralized

**Acceptance Criteria:**
1. Feedback bar is positioned at the bottom of the header
2. Feedback bar is above the feature-shell (toolbar)
3. Feedback bar has appropriate padding and styling
4. Feedback bar supports dynamic content updates

## Functional Requirements

### FR1: Header Structure
- Header consists of 4 rows + 1 feedback bar
- Row 1: Meta & Action (IPA + buttons)
- Row 2: Target Word (large, bold, primary color)
- Row 3: Information (frequency, metadata)
- Row 4: Feedback Bar (dynamic messages)

### FR2: Auto-check on Open
- When popup is created, automatically check if word exists in Anki
- Use `chrome.runtime.sendMessage` to query Anki
- Display result in feedback bar

### FR3: View Link Functionality
- [View] link opens Anki Browser with the note
- Link is styled as underlined text
- Link is clickable and functional

### FR4: Feedback Messages
- Success: "Added {word} to Anki. [View] here!"
- Already exists: "Note already in Anki. [View] here"
- Error: Display error message with red styling
- Auto-dismiss errors after 5 seconds

### FR5: Styling
- Feedback bar uses CSS classes for styling
- Success messages: neutral/positive styling
- Error messages: red/warning styling
- Links are underlined and use primary color

## Non-Functional Requirements

### NFR1: Performance
- Auto-check should complete within 2 seconds
- Feedback updates should be instant
- No layout shift when feedback appears/disappears

### NFR2: Accessibility
- Feedback messages are readable and clear
- Links are keyboard accessible
- Color is not the only indicator of status

### NFR3: Responsiveness
- Header layout works on popup width (320px)
- Text wraps appropriately
- Buttons remain clickable

## Technical Specifications

### TS1: HTML Structure
```html
<div class="yomi-header">
  <!-- Row 1: Meta & Action -->
  <div class="yomi-header-row-1">
    <span class="yomi-pronunciation">/sæd/</span>
    <div class="yomi-header-actions">
      <button class="yomi-update-anki-btn">Update (U)</button>
      <button class="yomi-add-anki-btn">Add (R)</button>
    </div>
  </div>
  
  <!-- Row 2: Target Word -->
  <div class="yomi-header-row-2">
    <span class="popup-term-title">sad</span>
  </div>
  
  <!-- Row 3: Information -->
  <div class="yomi-header-row-3">
    <span class="yomi-frequency">frequency: 300</span>
  </div>
  
  <!-- Row 4: Feedback Bar -->
  <div class="yomi-feedback-bar">
    <!-- Dynamic content -->
  </div>
</div>
```

### TS2: CSS Classes
- `.yomi-header-row-1`: Meta & Action row
- `.yomi-header-row-2`: Target Word row
- `.yomi-header-row-3`: Information row
- `.yomi-feedback-bar`: Feedback bar container
- `.yomi-feedback-success`: Success message styling
- `.yomi-feedback-error`: Error message styling
- `.yomi-feedback-link`: Link styling (underlined)

### TS3: JavaScript Functions
- `autoCheckAnkiOnOpen(popup, data)`: Auto-check on popup open
- `showFeedback(popup, message, type)`: Display feedback message
- `showViewLink(popup, noteIds)`: Display View link in feedback
- `dismissFeedback(popup)`: Clear feedback message

## Dependencies
- Anki integration (background.js)
- Chrome runtime messaging
- Existing popup structure

## Out of Scope
- Changing other popup sections
- Modifying Anki integration logic
- Changing shortcut keys
