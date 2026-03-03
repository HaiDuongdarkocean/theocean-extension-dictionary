// OCEAN ENGINE - Runtime Matcher
// Matches phrasal verbs and idioms in context sentences

import { getPhrasalPatternsByAnchor } from "./oceanStorage.js";
import { normalizeTermKey } from "./normalizer.js";
import { irregularMap } from "./irregularData.js";
import { getRegularRoot } from "./regularRules.js";

/**
 * Lemmatize a word using existing irregular/regular rules
 * Reuses the logic from popupDictionary.js
 */
export async function lemmatizeWord(word) {
  console.log(`oceanMatcher::lematizeWord ${word}`)
  const cleaned = normalizeTermKey(word);
  
  // Check irregular map first
  if (irregularMap && irregularMap.has(cleaned)) {
    const irregularInfo = irregularMap.get(cleaned);
    return irregularInfo.root;
  } else {
    console.log(`Can't check irregularMap`)
  }
  
  // Try regular lemmatization
  if (typeof getRegularRoot === 'function') {
    const regularInfo = await getRegularRoot(cleaned);
    if (regularInfo) {
      return regularInfo.root;
    }
  } else {
    console.log(`Can't check regularMap`)
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
 * Calculate score for a phrasal match
 * Score = (FixedWords × 10) + MatchLength
 * FixedWords: số từ cố định (không phải wildcard) trong displayTerm
 * MatchLength: độ dài (ký tự) của đoạn văn bản khớp
 */
export function calculateMatchScore(displayTerm, matchedText) {
  if (!displayTerm || !matchedText) return 0;
  
  // Count fixed words (không phải placeholders như sth, sb, poss, something, someone, your, yourself)
  const placeholders = /\b(sth|sb|poss|something|someone|your|yourself|right|really)\b/gi;
  const cleanTerm = displayTerm.replace(/[()]/g, '').trim();
  const words = cleanTerm.split(/\s+/).filter(w => w.length > 0);
  
  let fixedWords = 0;
  for (const word of words) {
    if (!placeholders.test(word)) {
      fixedWords++;
    }
  }
  
  // Reset regex lastIndex
  placeholders.lastIndex = 0;
  
  const matchLength = matchedText.length;
  const score = (fixedWords * 10) + matchLength;
  
  console.log(`  📊 Score calculation: displayTerm="${displayTerm}", fixedWords=${fixedWords}, matchLength=${matchLength}, score=${score}`);
  
  return score;
}

/**
 * Validate semantic match - check if pattern arguments align with sentence structure
 * Returns a semantic score (0-100) indicating how well the pattern fits the context
 */
export function validateSemanticMatch(displayTerm, matchedText, normalizedSentence) {
  let semanticScore = 50; // Base score
  
  // Extract what comes after the matched text in the sentence
  const matchIndex = normalizedSentence.indexOf(matchedText.toLowerCase());
  if (matchIndex === -1) return semanticScore;
  
  const afterMatch = normalizedSentence.substring(matchIndex + matchedText.length).trim();
  const beforeMatch = normalizedSentence.substring(0, matchIndex).trim();
  
  // Check if pattern expects "sb" (someone/subject) or "sth" (something/object)
  const hasSb = /\bsb\b/i.test(displayTerm);
  const hasSth = /\bsth\b/i.test(displayTerm);
  
  // Analyze what's around the matched text
  const hasObjectAfter = afterMatch.length > 0 && !afterMatch.match(/^(and|but|or|because|if|when|while|although)/i);
  const hasSubjectBefore = beforeMatch.length > 0 && !beforeMatch.match(/^(and|but|or|because|if|when|while|although)$/i);
  
  // Validate argument structure
  if (hasSb && hasSubjectBefore) {
    semanticScore += 20; // Pattern expects subject, and there's a subject before
  }
  
  if (hasSth && hasObjectAfter) {
    semanticScore += 20; // Pattern expects object, and there's an object after
  }
  
  // Penalize if pattern structure doesn't match sentence structure
  if (hasSb && !hasSubjectBefore) {
    semanticScore -= 15;
  }
  
  if (hasSth && !hasObjectAfter) {
    semanticScore -= 15;
  }
  
  console.log(`  🧠 Semantic validation: "${displayTerm}" → score=${semanticScore} (hasSb=${hasSb}, hasSth=${hasSth}, hasSubjectBefore=${hasSubjectBefore}, hasObjectAfter=${hasObjectAfter})`);
  
  return Math.max(0, semanticScore);
}

/**
 * Normalize sentence for matching
 * 1. Lemmatize target word in sentence
 * Returns normalized sentence for regex matching
 */
export async function normalizeSentenceForMatching(sentence, targetWord) {
  const sentenceLower = sentence.toLowerCase();
  
  // Step 1: Lemmatize target word and replace in sentence
  const targetWordLower = targetWord.toLowerCase();
  const lemma = await lemmatizeWord(targetWord);
  
  let normalized = sentenceLower.replace(
    new RegExp(`\\b${targetWordLower}\\b`, 'g'),
    lemma
  );
  
  console.log(`🌊 OCEAN: Original sentence: "${sentenceLower}"`);
  console.log(`🌊 OCEAN: Normalized sentence: "${normalized}"`);
  
  return normalized;
}

/**
 * Find phrasal verb/idiom match in context
 * Returns match data with highest score or null if no match found
 * 
 * Algorithm:
 * 1. Lemmatize target word → anchor word
 * 2. Normalize sentence (lemmatize target word, normalize possessives)
 * 3. Get all candidates from IndexedDB (sorted by priority)
 * 4. Test each candidate regex against normalized sentence
 * 5. Calculate score for each match: (FixedWords × 10) + MatchLength
 * 6. Return candidate with highest score
 */
export async function findPhrasalMatch(targetWord, contextSentence) {
  console.log("🩵 findPhrasalMatch: started")
  if (!targetWord || !contextSentence) {
    console.log("🌊 OCEAN: Missing targetWord or contextSentence");
    return null;
  }
  
  try {
    console.log("❤️❤️❤️❤️ bắt đầu");
    // Step 1: Lemmatize target word to get anchor
    const anchorWord = await lemmatizeWord(targetWord);
    console.log(`Step 1: chuẩn hóa từ vựng "${targetWord}" → "${anchorWord}"`);
    
    // Step 2: Lemmatize sentence for matching
    const normalizedSentence = await normalizeSentenceForMatching(contextSentence, targetWord);
    console.log(`Step 2: Chuẩn hóa sentence ${normalizedSentence}`)

    // Step 3: Get candidate patterns from IndexedDB
    const candidates = await getPhrasalPatternsByAnchor(anchorWord);
    console.log(`Step 3: những thành viên sáng giá ${candidates}`)
    
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
        const match = normalizedSentence.match(regex);
        
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
    
    // Step 5: Validate matches semantically
    if (matches.length === 0) {
      console.log(`🌊 OCEAN: No pattern matched in context`);
      return null;
    }
    
    // Add semantic validation score
    for (const match of matches) {
      match.semanticScore = validateSemanticMatch(
        match.candidate.displayTerm,
        match.matchedText,
        normalizedSentence
      );
    }
    
    // Step 6: Sort by semantic score first, then by score, then by priority
    matches.sort((a, b) => {
      if (b.semanticScore !== a.semanticScore) {
        return b.semanticScore - a.semanticScore; // Higher semantic score first
      }
      if (b.score !== a.score) {
        return b.score - a.score; // Higher score first
      }
      return b.priority - a.priority; // If score equal, higher priority first
    });
    
    // Step 7: Return top result
    const bestMatch = matches[0];
    const candidate = bestMatch.candidate;
    
    console.log(`🌊 OCEAN: Best match selected: "${candidate.originalTerm}" (score: ${bestMatch.score}, semantic: ${bestMatch.semanticScore})`);
    console.log(`  All matches: ${matches.map(m => `"${m.candidate.originalTerm}"(${m.score}/semantic:${m.semanticScore})`).join(', ')}`);
    
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
  
  // Add score info for debugging
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
