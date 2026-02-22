// OCEAN ENGINE - Runtime Matcher
// Matches phrasal verbs and idioms in context sentences

import { getPhrasalPatternsByAnchor } from "./oceanStorage.js";
import { normalizeTermKey } from "./normalizer.js";

/**
 * Lemmatize a word using existing irregular/regular rules
 * Reuses the logic from popupDictionary.js
 */
async function lemmatizeWord(word) {
  const cleaned = normalizeTermKey(word);
  
  // Check irregular map first
  if (window.irregularMap && window.irregularMap.has(cleaned)) {
    const irregularInfo = window.irregularMap.get(cleaned);
    return irregularInfo.root;
  }
  
  // Try regular lemmatization
  if (typeof getRegularRoot === 'function') {
    const regularInfo = await getRegularRoot(cleaned);
    if (regularInfo) {
      return regularInfo.root;
    }
  }
  
  // Return as-is if no lemmatization found
  return cleaned;
}

/**
 * Extract the sentence containing the target index
 * Uses simple sentence boundary detection
 */
export function extractSentence(text, targetIndex) {
  if (!text || targetIndex < 0) return "";
  
  // Find sentence boundaries (., !, ?, or start/end of text)
  let start = targetIndex;
  let end = targetIndex;
  
  // Search backwards for sentence start
  while (start > 0) {
    const char = text[start - 1];
    if (char === '.' || char === '!' || char === '?' || char === '\n') {
      break;
    }
    start--;
  }
  
  // Search forwards for sentence end
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

/**
 * Extract the word at a specific index
 */
export function extractWordAtIndex(text, index) {
  if (!text || index < 0 || index >= text.length) return "";
  
  // Find word boundaries
  let start = index;
  let end = index;
  
  // Move start backwards to word boundary
  while (start > 0 && /[\w'-]/.test(text[start - 1])) {
    start--;
  }
  
  // Move end forwards to word boundary
  while (end < text.length && /[\w'-]/.test(text[end])) {
    end++;
  }
  
  return text.substring(start, end);
}

/**
 * Find phrasal verb/idiom match in context
 * Returns match data or null if no match found
 */
export async function findPhrasalMatch(targetWord, contextSentence) {
  if (!targetWord || !contextSentence) {
    console.log("🌊 OCEAN: Missing targetWord or contextSentence");
    return null;
  }
  
  try {
    // Step 1: Lemmatize target word to get anchor
    const anchorWord = await lemmatizeWord(targetWord);
    console.log(`🌊 OCEAN: Lemmatized "${targetWord}" → "${anchorWord}"`);
    
    // Step 2: Get candidate patterns from IndexedDB
    const candidates = await getPhrasalPatternsByAnchor(anchorWord);
    
    if (!candidates || candidates.length === 0) {
      console.log(`🌊 OCEAN: No phrasal patterns found for anchor "${anchorWord}"`);
      console.log(`🌊 OCEAN: This means either:`);
      console.log(`  1. Dictionary not imported yet`);
      console.log(`  2. No phrasal verbs with anchor "${anchorWord}" in dictionary`);
      console.log(`  3. Migration didn't run during import`);
      return null;
    }
    
    console.log(`🌊 OCEAN: Testing ${candidates.length} patterns for "${anchorWord}"`);
    
    // Step 3: Test patterns against context sentence
    const sentenceLower = contextSentence.toLowerCase();
    
    for (const candidate of candidates) {
      try {
        console.log(`🌊 OCEAN: Testing pattern "${candidate.originalTerm}" (regex: ${candidate.compiledRegex.substring(0, 50)}...)`);
        const regex = new RegExp(candidate.compiledRegex, 'i');
        const match = sentenceLower.match(regex);
        
        if (match) {
          console.log(`✓ OCEAN: Matched pattern "${candidate.originalTerm}"`);
          console.log(`  Detected: "${match[0]}"`);
          
          return {
            status: "success",
            matchType: "phrasal_verb",
            data: {
              term: candidate.originalTerm,
              displayTerm: candidate.displayTerm,
              detectedInSentence: match[0],
              definition: candidate.definition,
              pronunciation: candidate.pronunciation,
              pos: candidate.pos,
              meaningAtoms: candidate.meaningAtoms,
              fullContext: contextSentence,
              anchorWord: anchorWord,
              priority: candidate.priority
            }
          };
        } else {
          console.log(`  ✗ No match for "${candidate.originalTerm}"`);
        }
      } catch (regexError) {
        console.error(`⚠️ OCEAN: Invalid regex for "${candidate.originalTerm}":`, regexError);
        continue;
      }
    }
    
    console.log(`🌊 OCEAN: No pattern matched in context`);
    return null;
    
  } catch (error) {
    console.error("⚠️ OCEAN: Error in findPhrasalMatch:", error);
    return null;
  }
}

/**
 * Format phrasal match result for display
 * Converts OCEAN match data to the format expected by popup
 */
export function formatPhrasalResult(phrasalMatch) {
  if (!phrasalMatch || phrasalMatch.status !== "success") return null;
  
  const data = phrasalMatch.data;
  
  // Format definition HTML
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
  
  // Add phrasal verb indicator
  const phrasalIndicator = `<div class="ocean-phrasal-indicator">📘 Phrasal Verb/Idiom: <b>${data.term}</b></div>`;
  definitionHtml = phrasalIndicator + definitionHtml;
  
  // Add detected context
  const contextInfo = `<div class="ocean-context-info">💡 Detected in context: "<i>${data.detectedInSentence}</i>"</div>`;
  definitionHtml += contextInfo;
  
  return {
    term: data.displayTerm || data.term,
    pronunciation: data.pronunciation || "",
    definition: definitionHtml,
    isPhrasal: true,
    originalTerm: data.term,
    detectedPhrase: data.detectedInSentence
  };
}
