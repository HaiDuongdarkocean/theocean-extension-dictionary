# Header Layout Restructure - Implementation Tasks

## Phase 1: HTML & CSS Structure

### 1.1 Update HTML Structure
- [ ] Modify popup HTML to add 4 header rows
- [ ] Add feedback bar element below Row 3
- [ ] Ensure proper nesting and semantic structure
- [ ] Add CSS classes for each row

### 1.2 Style Header Rows
- [ ] Style Row 1 (Meta & Action): flex layout, space-between
- [ ] Style Row 2 (Target Word): large, bold, primary color
- [ ] Style Row 3 (Information): small, subtle
- [ ] Add responsive padding and margins

### 1.3 Style Feedback Bar
- [ ] Create feedback bar container styling
- [ ] Add success message styling (neutral/green)
- [ ] Add error message styling (red)
- [ ] Add link styling (underlined, primary color)
- [ ] Add smooth transitions

## Phase 2: JavaScript Functions

### 2.1 Create autoCheckAnkiOnOpen()
- [ ] Implement function to check if word exists in Anki
- [ ] Use runtimeMessageWithTimeout() with 2 second timeout
- [ ] Handle success response (word found)
- [ ] Handle error response (word not found)
- [ ] Silently fail on timeout

### 2.2 Create showFeedback()
- [ ] Implement function to display feedback message
- [ ] Support "info", "success", "error" types
- [ ] Apply appropriate styling based on type
- [ ] Handle message escaping for security
- [ ] Auto-dismiss errors after 5 seconds

### 2.3 Create showViewLink()
- [ ] Implement function to add View link to feedback
- [ ] Create clickable link element
- [ ] Add click handler to open Anki Browser
- [ ] Pass note IDs to background script
- [ ] Style link as underlined text

### 2.4 Create dismissFeedback()
- [ ] Implement function to clear feedback message
- [ ] Clear feedback bar content
- [ ] Hide feedback bar
- [ ] Cancel any pending timeouts

## Phase 3: Integration

### 3.1 Integrate with showPopup()
- [ ] Call autoCheckAnkiOnOpen() after popup creation
- [ ] Pass data and popup to function
- [ ] Handle any errors gracefully
- [ ] Ensure popup displays even if auto-check fails

### 3.2 Integrate with addNoteToAnki()
- [ ] Call showFeedback() on success
- [ ] Call showViewLink() with returned note IDs
- [ ] Display error feedback on failure
- [ ] Update existing feedback if already shown

### 3.3 Integrate with updateExistingAnkiCard()
- [ ] Call showFeedback() on success
- [ ] Call showViewLink() with note IDs
- [ ] Display error feedback on failure

### 3.4 Update Background Script
- [ ] Add "checkNoteExists" action handler
- [ ] Add "openBrowser" action handler
- [ ] Return proper response format
- [ ] Handle errors appropriately

## Phase 4: Testing

### 4.1 Unit Tests
- [ ] Test feedback message display
- [ ] Test View link creation
- [ ] Test auto-dismiss timeout
- [ ] Test error handling
- [ ] Test message escaping

### 4.2 Integration Tests
- [ ] Test auto-check on popup open
- [ ] Test add success flow
- [ ] Test add error flow
- [ ] Test View link functionality
- [ ] Test multiple popups

### 4.3 Manual Tests
- [ ] Verify layout on 320px width
- [ ] Verify dark mode appearance
- [ ] Verify keyboard accessibility
- [ ] Verify link functionality
- [ ] Test with various word lengths
- [ ] Test error scenarios

## Phase 5: Polish & Optimization

### 5.1 Performance
- [ ] Verify auto-check completes within 2 seconds
- [ ] Verify no layout shift on feedback
- [ ] Optimize CSS for rendering
- [ ] Test with slow network

### 5.2 Accessibility
- [ ] Verify color contrast ratios
- [ ] Verify keyboard navigation
- [ ] Verify screen reader compatibility
- [ ] Test with various font sizes

### 5.3 Documentation
- [ ] Update code comments
- [ ] Document new functions
- [ ] Update README if needed
- [ ] Add inline documentation

## Detailed Task Descriptions

### Task 1.1: Update HTML Structure
**Description**: Modify the popup HTML template to include 4 header rows and feedback bar.

**Steps**:
1. Locate the header HTML in popupDictionary.js (around line 1350)
2. Restructure to add:
   - Row 1: IPA pronunciation + buttons
   - Row 2: Target word
   - Row 3: Frequency/info
   - Row 4: Feedback bar
3. Add appropriate CSS classes
4. Ensure backward compatibility

**Acceptance Criteria**:
- HTML structure matches design document
- All 4 rows are present
- Feedback bar is positioned correctly
- No visual regression

### Task 2.1: Create autoCheckAnkiOnOpen()
**Description**: Implement auto-check functionality when popup opens.

**Steps**:
1. Create new function `autoCheckAnkiOnOpen(popup, data)`
2. Use `runtimeMessageWithTimeout()` to query Anki
3. Handle success: word found in Anki
4. Handle error: word not found
5. Call `showFeedback()` and `showViewLink()` if found
6. Silently fail on timeout

**Acceptance Criteria**:
- Function completes within 2 seconds
- Correctly identifies existing notes
- Displays feedback when note found
- Doesn't block popup display

### Task 2.2: Create showFeedback()
**Description**: Implement feedback message display function.

**Steps**:
1. Create function `showFeedback(popup, message, type)`
2. Support types: "info", "success", "error"
3. Escape HTML in message
4. Apply appropriate styling
5. Auto-dismiss errors after 5 seconds
6. Update feedback bar content

**Acceptance Criteria**:
- Messages display correctly
- Styling matches design
- Auto-dismiss works for errors
- HTML is properly escaped

### Task 2.3: Create showViewLink()
**Description**: Implement View link functionality.

**Steps**:
1. Create function `showViewLink(popup, noteIds)`
2. Create clickable link element
3. Add underline styling
4. Implement click handler
5. Send message to background to open browser
6. Append link to feedback message

**Acceptance Criteria**:
- Link displays correctly
- Link is underlined
- Click opens Anki Browser
- Note IDs are passed correctly

### Task 3.1: Integrate with showPopup()
**Description**: Call auto-check when popup is created.

**Steps**:
1. Locate `showPopup()` function
2. After popup element is created
3. Call `autoCheckAnkiOnOpen(newPopup, data)`
4. Handle any errors gracefully
5. Ensure popup displays even if auto-check fails

**Acceptance Criteria**:
- Auto-check runs on popup open
- Feedback displays if note found
- Popup displays even if auto-check fails
- No performance impact

### Task 3.2: Integrate with addNoteToAnki()
**Description**: Show feedback after adding note.

**Steps**:
1. Locate `addNoteToAnki()` function
2. After successful add
3. Call `showFeedback()` with success message
4. Call `showViewLink()` with returned note IDs
5. Handle errors with error feedback

**Acceptance Criteria**:
- Success feedback displays
- View link appears
- Error feedback displays on failure
- Note IDs are correct

## Dependencies
- Phase 1 must complete before Phase 2
- Phase 2 must complete before Phase 3
- Phase 3 must complete before Phase 4
- Phase 4 and 5 can run in parallel

## Estimated Timeline
- Phase 1: 2 hours
- Phase 2: 3 hours
- Phase 3: 2 hours
- Phase 4: 2 hours
- Phase 5: 1 hour
- **Total**: ~10 hours

## Risk Assessment
- **Risk**: Auto-check timeout blocks popup - **Mitigation**: Use 2 second timeout, silently fail
- **Risk**: Layout shift on feedback - **Mitigation**: Pre-allocate space for feedback bar
- **Risk**: Anki integration issues - **Mitigation**: Graceful error handling
- **Risk**: Performance impact - **Mitigation**: Optimize CSS, use efficient selectors
