// OCEAN ENGINE - Migration Script
// Scans dictionary entries and extracts phrasal patterns

import { 
  extractAnchorWord, 
  compilePhrasalPattern, 
  calculatePriority,
  isPhrasalPattern 
} from "./oceanCompiler.js";
import { bulkInsertPhrasalPatterns, clearPhrasalPatterns } from "./oceanStorage.js";
import { normalizeTermKey } from "./normalizer.js";

/**
 * Process a single dictionary entry and extract phrasal pattern if applicable
 */
function processEntry(entry, resourceId) {
  const term = entry.term || entry.displayTerm;
  
  // DEBUG: Log entries with "under nose"
  if (term && term.includes("under") && term.includes("nose")) {
    console.log("🌊 [MIGRATION] Processing entry:", term);
  }
  
  if (!term || !isPhrasalPattern(term)) {
    return null;
  }
  
  const anchorWord = extractAnchorWord(term);
  if (!anchorWord) {
    return null;
  }
  
  if (term && term.includes("under") && term.includes("nose")) {
    console.log("🌊 [MIGRATION] Anchor word:", anchorWord);
    console.log("🌊 [MIGRATION] Calling compilePhrasalPattern...");
  }
  
  const compiledRegex = compilePhrasalPattern(term);
  
  if (term && term.includes("under") && term.includes("nose")) {
    console.log("🌊 [MIGRATION] Compiled regex:", compiledRegex);
  }
  
  if (!compiledRegex) {
    return null;
  }
  
  const priority = calculatePriority(term);
  
  if (term && term.includes("under") && term.includes("nose")) {
    console.log("🌊 [MIGRATION] Priority:", priority);
    console.log("🌊 [MIGRATION] Pattern object created successfully");
  }
  
  return {
    anchorWord: normalizeTermKey(anchorWord),
    originalTerm: term,
    compiledRegex: compiledRegex,
    priority: priority,
    resourceId: resourceId,
    displayTerm: entry.displayTerm || term,
    reading: entry.reading || entry.altterm || "",
    pronunciation: entry.pronunciation || "",
    pos: entry.pos || "",
    definition: entry.definition || "",
    meaningAtoms: entry.meaningAtoms || [],
    raw: entry.raw || entry
  };
}

/**
 * Migrate phrasal patterns from dictionary entries
 * @param {Array} entries - Array of dictionary entries
 * @param {string} resourceId - Resource identifier
 * @param {Function} progressCallback - Optional callback for progress updates
 */
export async function migratePhrasalPatterns(entries, resourceId, progressCallback = null) {
  console.log(`🌊 OCEAN Migration: Processing ${entries.length} entries for resource: ${resourceId}`);
  
  const patterns = [];
  let processed = 0;
  let skipped = 0;
  
  for (const entry of entries) {
    const pattern = processEntry(entry, resourceId);
    
    if (pattern) {
      patterns.push(pattern);
    } else {
      skipped++;
    }
    
    processed++;
    
    // Report progress every 1000 entries
    if (progressCallback && processed % 1000 === 0) {
      progressCallback({
        processed,
        total: entries.length,
        found: patterns.length,
        skipped
      });
    }
  }
  
  console.log(`✓ Found ${patterns.length} phrasal patterns (skipped ${skipped} single words)`);
  
  // Insert in batches to avoid memory issues
  const BATCH_SIZE = 500;
  let inserted = 0;
  
  for (let i = 0; i < patterns.length; i += BATCH_SIZE) {
    const batch = patterns.slice(i, i + BATCH_SIZE);
    await bulkInsertPhrasalPatterns(batch);
    inserted += batch.length;
    
    if (progressCallback) {
      progressCallback({
        phase: 'inserting',
        inserted,
        total: patterns.length
      });
    }
  }
  
  console.log(`✓ Migration complete: ${inserted} phrasal patterns inserted`);
  
  return {
    processed: entries.length,
    found: patterns.length,
    inserted: inserted,
    skipped: skipped
  };
}

/**
 * Re-migrate a resource (clear old data and import new)
 */
export async function reMigrateResource(entries, resourceId, progressCallback = null) {
  console.log(`🔄 Re-migrating resource: ${resourceId}`);
  
  // Clear old patterns
  await clearPhrasalPatterns(resourceId);
  
  // Import new patterns
  return await migratePhrasalPatterns(entries, resourceId, progressCallback);
}

/**
 * Migrate from Migaku format (used in current system)
 */
export async function migrateMigakuFormat(jsonData, resourceId, progressCallback = null) {
  // Migaku format is array of objects with term, definition, etc.
  return await migratePhrasalPatterns(jsonData, resourceId, progressCallback);
}

/**
 * Migrate from Yomitan format
 */
export async function migrateYomitanFormat(termBanks, resourceId, progressCallback = null) {
  // Yomitan format: array of arrays [term, reading, ?, ?, ?, definitions, ...]
  const entries = termBanks.map(row => ({
    term: row[0],
    reading: row[1],
    definition: Array.isArray(row[5]) ? row[5].join('; ') : row[5]
  }));
  
  return await migratePhrasalPatterns(entries, resourceId, progressCallback);
}
