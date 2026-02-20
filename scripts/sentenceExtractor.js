/**
 * Ocean Context Engine
 * Semantic Bubble Up + Intl.Segmenter for accurate sentence extraction
 * 
 * Flow:
 * 1. Bubble up to semantic container (P, DIV, ARTICLE, etc.)
 * 2. Segment text into sentences using Intl.Segmenter
 * 3. Calculate caret offset in container
 * 4. Extract target word at caret position
 * 5. Find sentence containing target word (PRIORITY 1) or by offset (PRIORITY 2)
 */

/**
 * Find semantic container by bubbling up DOM tree
 * @param {Range} range - Caret range from mouse position
 * @returns {Element|null} - Semantic container element
 */
function findSemanticContainer(range) {
  if (!range || !range.startContainer) return null;
  
  let container = range.startContainer;
  
  // If text node, get parent element
  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentElement;
  }
  
  const semanticTags = ['P', 'DIV', 'LI', 'ARTICLE', 'SECTION', 'TD', 'BLOCKQUOTE', 'SPAN'];
  const minTextLength = 50; // Minimum text length to consider as valid container
  
  // Bubble up until we find a semantic container with enough text
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loop
  
  while (container && attempts < maxAttempts) {
    attempts++;
    
    // Check if current element is a semantic container
    if (semanticTags.includes(container.tagName)) {
      const text = container.innerText || container.textContent || '';
      
      // Skip if it's our own extension elements
      if (container.classList.contains('ocean-popup') || 
          container.classList.contains('anki-btn') ||
          container.id === 'yomi-popup') {
        container = container.parentElement;
        continue;
      }
      
      // If text is long enough, use this container
      if (text.trim().length >= minTextLength) {
        return container;
      }
    }
    
    // Move up to parent
    container = container.parentElement;
    
    // Stop at body
    if (container && container.tagName === 'BODY') {
      break;
    }
  }
  
  // Fallback: return the last valid container or body
  return container || document.body;
}

/**
 * Segment text into sentences using Intl.Segmenter
 * @param {string} text - Text to segment
 * @param {string} language - Language code (e.g., 'en', 'ja', 'vi')
 * @returns {Array<{segment: string, index: number}>} - Array of sentence segments
 */
function segmentIntoSentences(text, language = 'en') {
  if (!text || text.trim() === '') return [];
  
  try {
    // Use Intl.Segmenter if available (modern browsers)
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' });
      const segments = Array.from(segmenter.segment(text));
      return segments.map(seg => ({
        segment: seg.segment,
        index: seg.index
      }));
    }
  } catch (e) {
    console.warn('Intl.Segmenter not available, using fallback');
  }
  
  // Fallback: regex-based sentence splitting
  const sentenceRegex = /[^.!?]+[.!?]+[\s]*/g;
  const sentences = [];
  let match;
  let lastIndex = 0;
  
  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push({
      segment: match[0],
      index: match.index
    });
    lastIndex = sentenceRegex.lastIndex;
  }
  
  // Add remaining text if any
  if (lastIndex < text.length) {
    sentences.push({
      segment: text.substring(lastIndex),
      index: lastIndex
    });
  }
  
  return sentences;
}

/**
 * Calculate caret offset in container text
 * @param {Range} range - Caret range
 * @param {Element} container - Container element
 * @returns {number} - Offset position in container text
 */
function calculateCaretOffset(range, container) {
  if (!range || !container) return 0;
  
  try {
    // Create a range from start of container to caret position
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    
    // Get text length before caret
    const offset = preRange.toString().length;
    preRange.detach();
    
    return offset;
  } catch (e) {
    console.error('Error calculating caret offset:', e);
    return 0;
  }
}

/**
 * Extract target word at caret position
 * @param {Range} range - Caret range
 * @returns {string} - Target word
 */
function extractTargetWord(range) {
  if (!range) return '';
  
  try {
    // Try to expand range to word boundary
    const wordRange = range.cloneRange();
    
    if (wordRange.expand) {
      wordRange.expand('word');
      return wordRange.toString().trim();
    }
    
    // Fallback: manual word extraction
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return '';
    
    const text = textNode.textContent || '';
    const offset = range.startOffset;
    
    // Find word boundaries
    const before = text.substring(0, offset).match(/\S+$/);
    const after = text.substring(offset).match(/^\S+/);
    
    const word = (before ? before[0] : '') + (after ? after[0] : '');
    return word.trim();
  } catch (e) {
    console.error('Error extracting target word:', e);
    return '';
  }
}

/**
 * Find sentence at offset position
 * PRIORITY 1: Find by target word (exact match with word boundaries)
 * PRIORITY 2: Find by offset position
 * PRIORITY 3: Return first sentence (fallback)
 * 
 * @param {Array} segments - Array of sentence segments
 * @param {number} offset - Caret offset in text
 * @param {string} targetWord - Target word to find
 * @returns {string} - Sentence containing the caret or target word
 */
function findSentenceAtOffset(segments, offset, targetWord) {
  if (!segments || segments.length === 0) return '';
  
  // PRIORITY 1: Find sentence containing target word (with word boundary)
  if (targetWord && targetWord.trim() !== '') {
    // Create regex with word boundaries to match exact word
    const wordRegex = new RegExp(`\\b${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    
    for (const seg of segments) {
      if (wordRegex.test(seg.segment)) {
        console.log(`✓ Found sentence by target word "${targetWord}":`, seg.segment.trim());
        return seg.segment.trim();
      }
    }
    
    console.log(`✗ Target word "${targetWord}" not found in any sentence, falling back to offset`);
  }
  
  // PRIORITY 2: Find by offset position
  for (const seg of segments) {
    const segmentEnd = seg.index + seg.segment.length;
    if (offset >= seg.index && offset <= segmentEnd) {
      console.log(`✓ Found sentence by offset ${offset}:`, seg.segment.trim());
      return seg.segment.trim();
    }
  }
  
  // PRIORITY 3: Return first sentence as last resort
  console.log('✗ No sentence found by offset, returning first sentence');
  return segments[0].segment.trim();
}

/**
 * Main function: Get Ocean Context
 * @param {Range} range - Caret range from mouse position
 * @returns {Object|null} - Context object with word, sentence, paragraph, etc.
 */
function getOceanContext(range) {
  if (!range) {
    console.error('Ocean Context: No range provided');
    return null;
  }
  
  try {
    // Step 1: Find semantic container
    const container = findSemanticContainer(range);
    if (!container) {
      console.error('Ocean Context: No semantic container found');
      return null;
    }
    
    // Step 2: Get full text from container
    const fullText = container.innerText || container.textContent || '';
    if (!fullText || fullText.trim() === '') {
      console.error('Ocean Context: Container has no text');
      return null;
    }
    
    console.log('Block text:', fullText);
    
    // Step 3: Detect language (from html lang attribute or default to 'en')
    const language = document.documentElement.lang || 'en';
    
    // Step 4: Segment into sentences
    const segments = segmentIntoSentences(fullText, language);
    if (segments.length === 0) {
      console.error('Ocean Context: No sentences found');
      return null;
    }
    
    // Step 5: Calculate caret offset
    const caretOffset = calculateCaretOffset(range, container);
    
    // Step 6: Extract target word
    const targetWord = extractTargetWord(range);
    
    console.log('Debug - Target word:', targetWord, 'Caret offset:', caretOffset);
    
    // Step 7: Find sentence (PRIORITY: target word first, then offset)
    const sentence = findSentenceAtOffset(segments, caretOffset, targetWord);
    
    console.log('Extracted sentence:', sentence);
    
    // Return context object
    return {
      word: targetWord,
      sentence: sentence,
      paragraph: fullText,
      containerTag: container.tagName,
      language: language,
      debug: {
        caretOffset: caretOffset,
        segmentCount: segments.length,
        containerText: fullText.substring(0, 100) + '...'
      }
    };
  } catch (e) {
    console.error('Ocean Context Engine error:', e);
    return null;
  }
}

// Export for use in popupDictionary.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getOceanContext };
}
