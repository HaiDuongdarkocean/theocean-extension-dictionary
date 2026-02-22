import { normalizeTermKey } from "./normalizer.js";

const DB_NAME = "OceanDictionaryDB";
const DB_VERSION = 2; // Incremented for phrasal_patterns store

let dbPromise = null;

export function initDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // resources store
      if (!db.objectStoreNames.contains("resources")) {
        const store = db.createObjectStore("resources", { keyPath: "id" });
        store.createIndex("kind", "kind", { unique: false });
        store.createIndex("enabled", "enabled", { unique: false });
        store.createIndex("priority", "priority", { unique: false });
      }

      // dictionary entries
      if (!db.objectStoreNames.contains("dict_entries")) {
        const store = db.createObjectStore("dict_entries", { keyPath: "id", autoIncrement: true });
        store.createIndex("termKey", "termKey", { unique: false });
        store.createIndex("resourceTerm", ["resourceId", "termKey"], { unique: false });
      }

      // frequency entries
      if (!db.objectStoreNames.contains("freq_entries")) {
        const store = db.createObjectStore("freq_entries", { keyPath: "id", autoIncrement: true });
        store.createIndex("termKey", "termKey", { unique: false });
        store.createIndex("resourceTerm", ["resourceId", "termKey"], { unique: false });
      }

      // phrasal patterns store (OCEAN ENGINE)
      if (!db.objectStoreNames.contains("phrasal_patterns")) {
        const store = db.createObjectStore("phrasal_patterns", { keyPath: "id", autoIncrement: true });
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

async function withStore(storeName, mode, fn) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    fn(store, tx);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putResource(resource) {
  await withStore("resources", "readwrite", (store) => {
    store.put(resource);
  });
}

export async function listResources() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("resources", "readonly");
    const store = tx.objectStore("resources");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteResource(resourceId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("resources", "readwrite");
    const store = tx.objectStore("resources");
    store.delete(resourceId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function bulkInsertDict(entries) {
  if (!entries?.length) return;
  await withStore("dict_entries", "readwrite", (store) => {
    entries.forEach((e) => store.put(e));
  });
}

export async function bulkInsertFreq(entries) {
  if (!entries?.length) return;
  await withStore("freq_entries", "readwrite", (store) => {
    entries.forEach((e) => store.put(e));
  });
}

export async function clearResourceData(resourceId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    // Include phrasal_patterns store for OCEAN data
    const storeNames = ["dict_entries", "freq_entries"];
    
    // Check if phrasal_patterns store exists (for OCEAN)
    if (db.objectStoreNames.contains("phrasal_patterns")) {
      storeNames.push("phrasal_patterns");
    }
    
    const tx = db.transaction(storeNames, "readwrite");
    
    let completedStores = 0;
    const totalStores = storeNames.length;
    
    // Delete dict_entries
    const dictStore = tx.objectStore("dict_entries");
    const idxD = dictStore.index("resourceTerm");
    const keyRange = IDBKeyRange.bound([resourceId, ""], [resourceId, "\uffff"]);
    
    const reqD = idxD.openCursor(keyRange);
    reqD.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        completedStores++;
        console.log(`✓ Deleted dict_entries for resource ${resourceId}`);
        if (completedStores === totalStores) {
          console.log(`✓ All stores cleared for resource ${resourceId}`);
        }
      }
    };

    // Delete freq_entries
    const freqStore = tx.objectStore("freq_entries");
    const idxF = freqStore.index("resourceTerm");
    
    const reqF = idxF.openCursor(keyRange);
    reqF.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        completedStores++;
        console.log(`✓ Deleted freq_entries for resource ${resourceId}`);
        if (completedStores === totalStores) {
          console.log(`✓ All stores cleared for resource ${resourceId}`);
        }
      }
    };

    // Delete phrasal_patterns (OCEAN data)
    if (storeNames.includes("phrasal_patterns")) {
      const phrasalStore = tx.objectStore("phrasal_patterns");
      const idxP = phrasalStore.index("resourceId");
      
      const reqP = idxP.openCursor(IDBKeyRange.only(resourceId));
      reqP.onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          completedStores++;
          console.log(`✓ Deleted phrasal_patterns for resource ${resourceId}`);
          if (completedStores === totalStores) {
            console.log(`✓ All stores cleared for resource ${resourceId}`);
          }
        }
      };
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getEnabledResources(kind) {
  const resources = await listResources();
  return resources
    .filter((r) => r.enabled && r.kind === kind)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

async function getDictEntries(resourceId, termKey) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("dict_entries", "readonly");
    const store = tx.objectStore("dict_entries");
    const idx = store.index("resourceTerm");
    const req = idx.getAll([resourceId, termKey]);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getFreqEntries(resourceId, termKey) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("freq_entries", "readonly");
    const store = tx.objectStore("freq_entries");
    const idx = store.index("resourceTerm");
    const req = idx.getAll([resourceId, termKey]);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function lookupTermWithFreq(termRaw, options = {}) {
  const termKey = normalizeTermKey(termRaw);
  const dictResources = await getEnabledResources("dictionary");
  const freqResources = await getEnabledResources("frequency");

  const mode = options.mode || "first_match"; // "first_match" | "stacked"
  const maxDictionaries = Number.isFinite(options.maxDictionaries)
    ? options.maxDictionaries
    : 10;

  let entry = null;
  let resource = null;
  const results = [];

  for (const r of dictResources) {
    const list = await getDictEntries(r.id, termKey);
    if (list.length > 0) {
      if (mode === "stacked") {
        results.push({ resource: r, entries: list });
        if (results.length >= maxDictionaries) break;
      } else {
        entry = list[0];
        resource = r;
        break;
      }
    }
  }

  const freqs = [];
  for (const r of freqResources) {
    const list = await getFreqEntries(r.id, termKey);
    if (list.length > 0) {
      freqs.push({ resource: r, entries: list });
    }
  }

  if (mode === "stacked") {
    return { results, freqs };
  }
  return { entry, resource, freqs };
}
