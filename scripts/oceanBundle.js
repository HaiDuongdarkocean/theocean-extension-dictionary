// OCEAN ENGINE - Bundled Version (No ES6 Modules)
// All OCEAN functionality in one file for content script compatibility

console.log("🌊 OCEAN Bundle: File loaded, starting execution...");

(function() {
  'use strict';

  console.log("🌊 OCEAN Bundle: IIFE started...");

  // ============================================================================
  // PART 1: OCEAN COMPILER
  // ============================================================================

  function extractAnchorWord(term) {
    if (!term) return null;
    
    const cleaned = term.toLowerCase().trim();
    const withoutArticle = cleaned.replace(/^(a|an|the)\s+/i, '');
    const words = withoutArticle.split(/\s+/);
    
    for (const word of words) {
      if (word === 'sth' || word === 'sb' || 
          word === 'something' || word === 'someone' ||
          word === 'your' || word === 'yourself') {
        continue;
      }
      
      if (/^[a-z]+$/.test(word)) {
        return word;
      }
    }
    
    return words[0] || null;
  }

  function compilePhrasalPattern(term) {
    if (!term) return null;
    
    let pattern = term.toLowerCase().trim();
    
    // Rule 1: Handle "/" (alternatives) - mark with placeholder to protect from Rule 2
    pattern = pattern.replace(/(\w+)\/(\w+)/g, '___ALT_START___$1|$2___ALT_END___');
    
    // Rule 2: Handle "()" (optional parts) - only process actual parentheses
    // Match spaces before AND after () to include leading space in optional group
    pattern = pattern.replace(/\s*\(([^)]+)\)\s*/g, (match, content) => {
      let escaped = content.trim();
      // Handle placeholders in optional parts
      escaped = escaped.replace(/\b(sth|something)\b/g, '(?:[\\w\\s]{1,30})');
      escaped = escaped.replace(/\b(sb|someone)\b/g, '(?:[\\w\\s]{1,20})');
      escaped = escaped.replace(/\b(poss|possessive)\b/g, '(my|your|his|her|its|our|their|one\'s)');
      // Convert spaces to \s+ INSIDE the optional part
      escaped = escaped.replace(/\s+/g, '\\s+');
      // Put leading space INSIDE optional group, trailing space OUTSIDE
      // This gives us: be(?:\s+right)?\s+under (space before "right" is optional, space after is required)
      return `(?:\\s+${escaped})?\\s+`;
    });
    
    // Restore alternatives
    pattern = pattern.replace(/___ALT_START___/g, '(');
    pattern = pattern.replace(/___ALT_END___/g, ')');
    
    // Rule 3 & 4: Handle placeholders
    pattern = pattern.replace(/\b(sth|something)\b/g, '___OBJECT___');
    pattern = pattern.replace(/\b(sb|someone)\b/g, '___PERSON___');
    pattern = pattern.replace(/\b(poss|possessive)\b/g, '___POSSESSIVE___');
    
    // Rule 5: Normalize spaces
    pattern = pattern.replace(/\s+/g, '\\s+');
    
    // Rule 6: Replace placeholders with flexible patterns
    pattern = pattern.replace(/___OBJECT___/g, '(?:[\\w\'\\-]+(?:\\s+[\\w\'\\-]+){0,4})');
    pattern = pattern.replace(/___PERSON___/g, '(?:[\\w\'\\-]+(?:\\s+[\\w\'\\-]+){0,3})');
    pattern = pattern.replace(/___POSSESSIVE___/g, '(my|your|his|her|its|our|their|one\'s)');
    
    // Rule 7: Replace specific possessives (my, your, his, her, its, our, their) with possessive group
    // This allows matching any possessive in the sentence
    pattern = pattern.replace(/\b(my|your|his|her|its|our|their)\b/g, '(?:my|your|his|her|its|our|their)');
    
    // Rule 8: Add word boundaries
    const startsWithWord = /^[a-z(]/.test(pattern);
    const endsWithWord = /[a-z)]$/.test(pattern);
    
    if (startsWithWord) pattern = '\\b' + pattern;
    if (endsWithWord) pattern = pattern + '\\b';
    
    return pattern;
  }

  function calculatePriority(term) {
    if (!term) return 0;
    
    const cleaned = term.toLowerCase()
      .replace(/\b(a|an|the|sth|sb|something|someone)\b/g, '')
      .replace(/[^\w\s]/g, ' ')
      .trim();
    
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }

  function isPhrasalPattern(term) {
    if (!term) return false;
    
    const lower = term.toLowerCase();
    
    if (/\b(sth|sb|something|someone)\b/.test(lower)) return true;
    
    const withoutArticle = lower.replace(/^(a|an|the)\s+/i, '');
    const words = withoutArticle.split(/\s+/).filter(w => w.length > 0);
    
    return words.length >= 2;
  }

  // ============================================================================
  // PART 2: OCEAN STORAGE
  // ============================================================================

  const DB_NAME = "OceanDictionaryDB";
  const DB_VERSION = 2;
  const PHRASAL_STORE = "phrasal_patterns";

  let dbPromise = null;

  function initDB() {
    if (dbPromise) return dbPromise;
    
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains(PHRASAL_STORE)) {
          const store = db.createObjectStore(PHRASAL_STORE, { 
            keyPath: "id", 
            autoIncrement: true 
          });
          
          store.createIndex("anchorWord", "anchorWord", { unique: false });
          store.createIndex("anchorPriority", ["anchorWord", "priority"], { unique: false });
          store.createIndex("resourceId", "resourceId", { unique: false });
          
          console.log("✓ Created phrasal_patterns store");
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return dbPromise;
  }

  // Ensure phrasal_patterns store exists in IndexedDB
  async function ensurePhrasalStore() {
    console.log("🔍 DEBUG: ensurePhrasalStore() called");
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains(PHRASAL_STORE)) {
          const store = db.createObjectStore(PHRASAL_STORE, { 
            keyPath: "id", 
            autoIncrement: true 
          });
          
          store.createIndex("anchorWord", "anchorWord", { unique: false });
          store.createIndex("anchorPriority", ["anchorWord", "priority"], { unique: false });
          store.createIndex("resourceId", "resourceId", { unique: false });
          
          console.log("✓ ensurePhrasalStore: Created phrasal_patterns store with indexes");
        }
      };
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async function getPhrasalPatternsByAnchor(anchorWord) {
    await ensurePhrasalStore();
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHRASAL_STORE, "readonly");
      const store = tx.objectStore(PHRASAL_STORE);
      const index = store.index("anchorWord");
      
      const results = [];
      const request = index.openCursor(IDBKeyRange.only(anchorWord));
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          results.sort((a, b) => b.priority - a.priority);
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async function countPhrasalPatterns() {
    await ensurePhrasalStore();
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHRASAL_STORE, "readonly");
      const store = tx.objectStore(PHRASAL_STORE);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllAnchorWords() {
    await ensurePhrasalStore();
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHRASAL_STORE, "readonly");
      const store = tx.objectStore(PHRASAL_STORE);
      const index = store.index("anchorWord");
      
      const anchors = new Set();
      const request = index.openKeyCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          anchors.add(cursor.key);
          cursor.continue();
        } else {
          resolve(Array.from(anchors));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================================
  // PART 3: OCEAN MATCHER
  // ============================================================================

  function normalizeTermKey(term) {
    if (!term) return "";
    return term
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\s]+/g, " ")
      .replace(/[.,!?;:'")\]]+$/g, "");
  }

  async function lemmatizeWord(word) {
    const cleaned = normalizeTermKey(word);
    
    // Check irregular map first (exposed by irregularData.js)
    if (window.irregularMap && window.irregularMap.has(cleaned)) {
      const irregularInfo = window.irregularMap.get(cleaned);
      console.log(`🌊 OCEAN: Irregular lemmatization: "${cleaned}" → "${irregularInfo.root}"`);
      return irregularInfo.root;
    }
    
    // Try regular lemmatization (global function from regularRules.js)
    if (typeof window.getRegularRoot === 'function') {
      try {
        const regularInfo = await window.getRegularRoot(cleaned);
        if (regularInfo && regularInfo.root) {
          console.log(`🌊 OCEAN: Regular lemmatization: "${cleaned}" → "${regularInfo.root}"`);
          return regularInfo.root;
        }
      } catch (error) {
        console.warn(`🌊 OCEAN: getRegularRoot error for "${cleaned}":`, error);
      }
    }
    
    // Fallback: Simple suffix removal (should rarely reach here)
    console.log(`🌊 OCEAN: No lemmatization found, trying simple fallback for "${cleaned}"`);
    
    // Remove -ed (handed → hand)
    if (cleaned.endsWith('ed') && cleaned.length > 3) {
      const stem = cleaned.slice(0, -2);
      console.log(`  Trying -ed removal: "${stem}"`);
      return stem;
    }
    
    // Remove -ing (handing → hand)
    if (cleaned.endsWith('ing') && cleaned.length > 4) {
      const stem = cleaned.slice(0, -3);
      console.log(`  Trying -ing removal: "${stem}"`);
      return stem;
    }
    
    // Remove -s (hands → hand)
    if (cleaned.endsWith('s') && cleaned.length > 2) {
      const stem = cleaned.slice(0, -1);
      console.log(`  Trying -s removal: "${stem}"`);
      return stem;
    }
    
    console.log(`🌊 OCEAN: Using original word: "${cleaned}"`);
    return cleaned;
  }

  function extractSentence(text, targetIndex) {
    if (!text || targetIndex < 0) return "";
    
    let start = targetIndex;
    let end = targetIndex;
    
    while (start > 0) {
      const char = text[start - 1];
      if (char === '.' || char === '!' || char === '?' || char === '\n') {
        break;
      }
      start--;
    }
    
    while (end < text.length) {
      const char = text[end];
      if (char === '.' || char === '!' || char === '?') {
        end++;
        break;
      }
      end++;
    }
    
    return text.substring(start, end).trim();
  }

  function extractWordAtIndex(text, index) {
    if (!text || index < 0 || index >= text.length) return "";
    
    let start = index;
    let end = index;
    
    while (start > 0 && /[\w'-]/.test(text[start - 1])) {
      start--;
    }
    
    while (end < text.length && /[\w'-]/.test(text[end])) {
      end++;
    }
    
    return text.substring(start, end);
  }

  async function normalizeSentenceForMatching(sentence, targetWord) {
    const sentenceLower = sentence.toLowerCase();
    const targetWordLower = targetWord.toLowerCase();

    const lemma = await lemmatizeWord(targetWord);
    
    let LemmatizeSentence = sentenceLower.replace(
      new RegExp(`\\b${targetWordLower}\\b`, 'g'),
      lemma
    );
    
    // console.log(`normalizeSentenceForMatching: Original sentence: "${sentenceLower}"`);
    // console.log(`normalizeSentenceForMatching: Normalized sentence: "${normalized}"`);
    
    return LemmatizeSentence;
  }

  function calculateMatchScore(displayTerm, matchedText) {
    if (!displayTerm || !matchedText) return 0;
    
    const placeholders = /\b(sth|sb|poss|something|someone|your|yourself|right|really)\b/gi;
    const cleanTerm = displayTerm.replace(/[()]/g, '').trim();
    const words = cleanTerm.split(/\s+/).filter(w => w.length > 0);
    
    let fixedWords = 0;
    for (const word of words) {
      if (!placeholders.test(word)) {
        fixedWords++;
      }
    }
    
    placeholders.lastIndex = 0;
    
    const matchLength = matchedText.length;
    const score = (fixedWords * 10) + matchLength;
    
    console.log(`  📊 Score calculation: displayTerm="${displayTerm}", fixedWords=${fixedWords}, matchLength=${matchLength}, score=${score}`);
    
    return score;
  }

  async function findPhrasalMatch(targetWord, contextSentence) {
    console.log("🩵 findPhrasalMatch: started")
    if (!targetWord || !contextSentence) {
      console.log("🌊 OCEAN: Missing targetWord or contextSentence");
      return null;
    }
    
    try {
    console.log("❤️bắt đầu try findPhrasalMatch❤️");
    // Step 1: Lemmatize target word to get anchor
    const anchorWord = await lemmatizeWord(targetWord);
    console.log(`Step 1: chuẩn hóa từ vựng "${targetWord}" → "${anchorWord}"`);
    
    // Step 2: Lemmatize sentence for matching
    const LemmatizeSentence = await normalizeSentenceForMatching(contextSentence, targetWord);
    console.log(`Step 2: Chuẩn hóa sentence từ "${contextSentence}" -> "${LemmatizeSentence}"`)

    // Step 3: Get candidate patterns from IndexedDB
    const candidates = await getPhrasalPatternsByAnchor(anchorWord);
    console.log(`Step 3: những thành viên sáng giá ${candidates.length}`)

    if(candidates) {
      candidates.forEach(e => {
        console.log("thành viên: ", e);
      });
    }
    
    if (!candidates || candidates.length === 0) {
      console.log(`💚 OCEAN: No phrasal patterns found for anchor "${anchorWord}"`);
      console.log(`💚 OCEAN: This means either:`);
      console.log(`  1. Dictionary not imported yet`);
      console.log(`  2. No phrasal verbs with anchor "${anchorWord}" in dictionary`);
      console.log(`  3. Migration didn't run during import`);
      return null;
    }
      
      console.log(`🌊 OCEAN: Testing ${candidates.length} patterns for "${anchorWord}"`);
      
      // Step 4: Test patterns and collect all matches with scores
      const matches = [];
      
      for (const candidate of candidates) {
        try {
          console.log(`🌊 OCEAN: Testing pattern "${candidate.originalTerm}" (regex: ${candidate.compiledRegex.substring(0, 50)}...)`);
          const regex = new RegExp(candidate.compiledRegex, 'i');
          const match = LemmatizeSentence.match(regex);
          
          if (match) {
            const matchedText = match[0];
            const score = calculateMatchScore(candidate.displayTerm, matchedText);
            
            matches.push({
              score: score,
              priority: candidate.priority,
              candidate: candidate,
              matchedText: matchedText
            });
            
            console.log(`✓ OCEAN: Matched pattern "${candidate.originalTerm}" with score ${score}`);
          } else {
            console.log(`  ✗ No match for "${candidate.originalTerm}"`);
          }
        } catch (regexError) {
          console.error(`⚠️ OCEAN: Invalid regex for "${candidate.originalTerm}":`, regexError);
          continue;
        }
      }
      
      // Step 5: Sort by score (descending), then by priority (descending)
      if (matches.length === 0) {
        console.log(`🌊 OCEAN: No pattern matched in context`);
        return null;
      }
      
      matches.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score; // Higher score first
        }
        return b.priority - a.priority; // If score equal, higher priority first
      });
      
      // Step 6: Return top result
      const bestMatch = matches[0];
      const candidate = bestMatch.candidate;
      
      console.log(`🌊 OCEAN: Best match selected: "${candidate.originalTerm}" (score: ${bestMatch.score})`);
      console.log(`  All matches: ${matches.map(m => `"${m.candidate.originalTerm}"(${m.score})`).join(', ')}`);
      
      return {
        status: "success",
        matchType: "phrasal_verb",
        data: {
          term: candidate.originalTerm,
          displayTerm: candidate.displayTerm,
          detectedInSentence: bestMatch.matchedText,
          definition: candidate.definition,
          pronunciation: candidate.pronunciation,
          pos: candidate.pos,
          meaningAtoms: candidate.meaningAtoms,
          fullContext: contextSentence,
          anchorWord: anchorWord,
          priority: candidate.priority,
          score: bestMatch.score
        }
      };
      
    } catch (error) {
      console.error("⚠️ OCEAN: Error in findPhrasalMatch:", error);
      return null;
    }
  }

  function formatPhrasalResult(phrasalMatch) {
    if (!phrasalMatch || phrasalMatch.status !== "success") return null;
    
    const data = phrasalMatch.data;
    
    let definitionHtml = "";
    
    if (data.meaningAtoms && data.meaningAtoms.length > 0) {
      definitionHtml = data.meaningAtoms
        .map((atom, idx) => 
          `<div class="ocean-atom"><b>${atom.head || `#${idx + 1}`}</b> ${atom.glossHtml || ""}</div>`
        )
        .join("");
    } else if (data.definition) {
      definitionHtml = `<div class="ocean-atom">${data.definition}</div>`;
    }
    
    const phrasalIndicator = `<div class="ocean-phrasal-indicator">📘 Phrasal Verb/Idiom: <b>${data.term}</b></div>`;
    definitionHtml = phrasalIndicator + definitionHtml;
    
    const contextInfo = `<div class="ocean-context-info">💡 Detected in context: "<i>${data.detectedInSentence}</i>"</div>`;
    definitionHtml += contextInfo;
    
    if (data.score !== undefined) {
      const scoreInfo = `<div class="ocean-score-info" style="font-size: 0.85em; color: #666; margin-top: 8px;">🎯 Match Score: ${data.score}</div>`;
      definitionHtml += scoreInfo;
    }
    
    return {
      term: data.displayTerm || data.term,
      pronunciation: data.pronunciation || "",
      definition: definitionHtml,
      isPhrasal: true,
      originalTerm: data.term,
      detectedPhrase: data.detectedInSentence
    };
  }

  // ============================================================================
  // EXPOSE TO GLOBAL SCOPE
  // ============================================================================

  console.log("🌊 OCEAN Bundle: Exposing to global scope...");

  try {
    window.oceanMatcher = {
      findPhrasalMatch,
      formatPhrasalResult,
      extractSentence,
      extractWordAtIndex
    };
    console.log("✓ oceanMatcher exposed:", typeof window.oceanMatcher);

    window.oceanCompiler = {
      extractAnchorWord,
      compilePhrasalPattern,
      calculatePriority,
      isPhrasalPattern
    };
    console.log("✓ oceanCompiler exposed:", typeof window.oceanCompiler);

    window.oceanStorage = {
      getPhrasalPatternsByAnchor,
      countPhrasalPatterns,
      getAllAnchorWords
    };
    console.log("✓ oceanStorage exposed:", typeof window.oceanStorage);

    // Mark as ready
    window.oceanReady = Promise.resolve({
      oceanMatcher: window.oceanMatcher,
      oceanCompiler: window.oceanCompiler,
      oceanStorage: window.oceanStorage
    });
    console.log("✓ oceanReady promise created");

    window.dispatchEvent(new CustomEvent('oceanReady', { 
      detail: { 
        matcher: window.oceanMatcher, 
        compiler: window.oceanCompiler, 
        storage: window.oceanStorage 
      } 
    }));
    console.log("✓ oceanReady event dispatched");

    console.log("✅ OCEAN ENGINE loaded successfully (bundled version)");
  } catch (error) {
    console.error("❌ OCEAN Bundle: Error during initialization:", error);
    throw error;
  }

})();
