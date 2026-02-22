// OCEAN ENGINE - Storage Layer for Phrasal Patterns
// Manages IndexedDB operations for phrasal verbs and idioms

import { initDB } from "./storage.js";

const PHRASAL_STORE = "phrasal_patterns";

/**
 * Ensure phrasal_patterns store exists in IndexedDB
 * This should be called during database upgrade
 */
export async function ensurePhrasalStore() {
  const DB_NAME = "OceanDictionaryDB";
  const CURRENT_VERSION = 2; // Increment version to trigger upgrade
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, CURRENT_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create phrasal_patterns store if it doesn't exist
      if (!db.objectStoreNames.contains(PHRASAL_STORE)) {
        const store = db.createObjectStore(PHRASAL_STORE, { 
          keyPath: "id", 
          autoIncrement: true 
        });
        
        // Index by anchor word for fast lookup
        store.createIndex("anchorWord", "anchorWord", { unique: false });
        
        // Compound index for sorting by priority
        store.createIndex("anchorPriority", ["anchorWord", "priority"], { unique: false });
        
        // Index by resource for cleanup
        store.createIndex("resourceId", "resourceId", { unique: false });
        
        console.log("✓ Created phrasal_patterns store with indexes");
      }
    };
    
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Insert phrasal patterns in bulk
 */
export async function bulkInsertPhrasalPatterns(patterns) {
  if (!patterns || patterns.length === 0) return;
  
  await ensurePhrasalStore();
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHRASAL_STORE, "readwrite");
    const store = tx.objectStore(PHRASAL_STORE);
    
    let inserted = 0;
    patterns.forEach((pattern) => {
      const request = store.put(pattern);
      request.onsuccess = () => inserted++;
    });
    
    tx.oncomplete = () => {
      console.log(`✓ Inserted ${inserted} phrasal patterns`);
      resolve(inserted);
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get phrasal patterns by anchor word, sorted by priority (descending)
 * Returns all patterns (no limit)
 */
export async function getPhrasalPatternsByAnchor(anchorWord) {
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
        // Sort by priority descending (test longest/most specific first)
        results.sort((a, b) => b.priority - a.priority);
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all phrasal patterns for a specific resource
 */
export async function clearPhrasalPatterns(resourceId) {
  await ensurePhrasalStore();
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHRASAL_STORE, "readwrite");
    const store = tx.objectStore(PHRASAL_STORE);
    const index = store.index("resourceId");
    
    const request = index.openCursor(IDBKeyRange.only(resourceId));
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    tx.oncomplete = () => {
      console.log(`✓ Cleared phrasal patterns for resource: ${resourceId}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Count total phrasal patterns in database
 */
export async function countPhrasalPatterns() {
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

/**
 * Get all anchor words (for debugging/stats)
 */
export async function getAllAnchorWords() {
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
