// oceanEngine.js - OCEAN Engine Logic Module
// Chứa tất cả business logic, không phụ thuộc vào context (background hay content script)

import { getPhrasalPatternsByAnchor } from "./oceanStorage.js";
import { irregularMap } from "./irregularData.js";
import { getRegularRoot } from "./regularRules.js";

/**
 * Lemmatize word - Simple suffix removal
 * backed → back, backing → back, backs → back
 */
export function normalizeTermKey(term) {
    if (!term) return null;
    return term
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s]+/g, " ")
        .replace(/[.,!?;:'")\]]+$/g, "");
}

export async function lemmatizeWord(word) {
    if (!word) return null

    try {
        const cleaned = normalizeTermKey(word);
        
        // console.log(`🔄 Lemmatizing: "${cleaned}"`);
        
        // Step 1: Check irregular map first
        if (irregularMap && irregularMap.has(cleaned)) {
            const irregularInfo = irregularMap.get(cleaned);
            console.log(`  Irregular: "${cleaned}" → "${irregularInfo.root}"`);
            return irregularInfo.root;
        }
        
        // Step 2: Try regular lemmatization
        if (typeof getRegularRoot === 'function') {
            try {
                console.log(`  Trying regular lemmatization for: "${cleaned}"`);
                const regularInfo = await getRegularRoot(cleaned);
                console.log(`  Regular result:`, regularInfo);
                if (regularInfo && regularInfo.root) {
                    console.log(`  ✓ Regular: "${cleaned}" → "${regularInfo.root}"`);
                    return regularInfo.root;
                } else {
                    console.log(`  Regular lemmatization returned null for: "${cleaned}"`);
                }
            } catch (error) {
                console.warn(`  getRegularRoot error for "${cleaned}":`, error);
            }
        }
        
        // Step 3: Fallback - Simple suffix removal
        console.log(`  Fallback suffix removal for: "${cleaned}"`);
        
        // Remove -ed (backed → back)
        if (cleaned.endsWith('ed') && cleaned.length > 3) {
            const stem = cleaned.slice(0, -2);
            console.log(`    -ed removal: "${cleaned}" → "${stem}"`);
            return stem;
        }
        
        // Remove -ing (backing → back)
        if (cleaned.endsWith('ing') && cleaned.length > 4) {
            const stem = cleaned.slice(0, -3);
            console.log(`    -ing removal: "${cleaned}" → "${stem}"`);
            return stem;
        }
        
        // Remove -s (backs → back)
        if (cleaned.endsWith('s') && cleaned.length > 2 && !cleaned.endsWith('ss')) {
            const stem = cleaned.slice(0, -1);
            console.log(`    -s removal: "${cleaned}" → "${stem}"`);
            return stem;
        }
        
        console.log(`  No match, using original: "${cleaned}"`);
        return cleaned;
    } catch (error) {
        console.error("Error in lemmatizeWord:", error);
        return word.toLowerCase();
    }
}

/**
 * Normalize sentence for matching
 * Replace verb forms with base form
 */
export async function normalizeSentence(targetWord, lemmaWord, sentence) {
    const sentenceLower = sentence.toLowerCase();
    const targetWordLower = targetWord.toLowerCase();
    
    // Replace target word with its lemma in the sentence
    const lemmatizedSentence = sentenceLower.replace(
      new RegExp(`\\b${targetWordLower}\\b`, 'g'),
      lemmaWord
    );
    
    console.log(`🌊 normalizeSentence: Original target word: "${targetWordLower}"`);
    console.log(`🌊 normalizeSentence: Lemmatized target word: "${lemmaWord}"`);
    console.log(`🌊 normalizeSentence: Original sentence: "${sentenceLower}"`);
    console.log(`🌊 normalizeSentence: Normalized sentence: "${lemmatizedSentence}"`);
    
    return lemmatizedSentence;
}

/**
 * Calculate match score
 * Score = (FixedWords × 10) + MatchLength
 */
export function calculateMatchScore(displayTerm, matchedText) {
    const fixedWords = (displayTerm.match(/\b\w+\b/g) || []).length - 1; // -1 for "sb"
    const score = (fixedWords * 10) + matchedText.length;
    return score;
}

/**
 * Match phrasal verb in background
 * Main logic for phrasal verb matching
 * 
 * @param {string} targetWord - The word to match (may be inflected form)
 * @param {string} lemmaWord - The lemmatized form of the word
 * @param {string} contextSentence - The full sentence context
 * @returns {Array<Object>|null} Array of top 5 matches sorted by score (descending),
 *                               or null if no matches found. Each match has:
 *                               - status: "success"
 *                               - matchType: "phrasal_verb"
 *                               - data: { term, displayTerm, definition, score, ... }
 */
export async function matchPhrasalVerb(targetWord, lemmaWord, contextSentence) {
    try {
        // console.log(`🌊 OCEAN: Starting phrasal verb matching for "${targetWord}"`);

        // Step 1: Get phrasal patterns from database
        const candidates = await getPhrasalPatternsByAnchor(lemmaWord);

        if (!candidates || candidates.length === 0) {
            console.log(`💚 OCEAN: No phrasal patterns found for anchor "${lemmaWord}"`);
            return null;
        }

        console.log(`🌊 OCEAN: Testing ${candidates.length} patterns for "${lemmaWord}"`);

        // Step 2: Normalize sentence for matching
        const normalizedSentence = await normalizeSentence(targetWord, lemmaWord, contextSentence);
        console.log(`🌊 OCEAN: Normalized sentence: "${normalizedSentence}"`);
        
        // Step 3: Test patterns and collect all matches with scores
        const matches = [];

        for (const candidate of candidates) {
            try {
                console.log(candidate);
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
                }
            } catch (regexError) {
                console.error(`⚠️ OCEAN: Invalid regex for "${candidate.originalTerm}":`, regexError);
                continue;
            }
        }

        // Step 4: Sort by score (descending), then by priority (descending)
        if (matches.length === 0) {
            console.log(`🌊 OCEAN: No pattern matched in context`);
            return null;
        }

        matches.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return b.priority - a.priority;
        });

        // Step 5: Return top 5 matches (or all if < 5)
        const topMatches = matches.slice(0, 5);
        
        console.log(`🌊 OCEAN: Returning top ${topMatches.length} matches`);

        return topMatches.map((match) => {
            const candidate = match.candidate;
            console.log(`  - "${candidate.originalTerm}" (score: ${match.score})`);
            
            return {
                status: "success",
                matchType: "phrasal_verb",
                data: {
                    term: candidate.originalTerm,
                    displayTerm: candidate.displayTerm,
                    detectedInSentence: match.matchedText,
                    definition: candidate.definition,
                    pronunciation: candidate.pronunciation,
                    pos: candidate.pos,
                    meaningAtoms: candidate.meaningAtoms,
                    fullContext: contextSentence,
                    anchorWord: lemmaWord,
                    priority: candidate.priority,
                    score: match.score
                }
            };
        });

    } catch (error) {
        console.error("⚠️ OCEAN: Error in matchPhrasalVerb:", error);
        return null;
    }
}

/**
 * Get all phrasal patterns for an anchor word
 */
export async function getPatterns(anchorWord) {
    try {
        const patterns = await getPhrasalPatternsByAnchor(anchorWord);
        return patterns || [];
    } catch (error) {
        console.error("Error in getPatterns:", error);
        return [];
    }
}

/**
 * Count total phrasal patterns
 */
export async function countPatterns() {
    try {
        // This would need to be implemented in oceanStorage.js
        // For now, return 0
        return 0;
    } catch (error) {
        console.error("Error in countPatterns:", error);
        return 0;
    }
}
