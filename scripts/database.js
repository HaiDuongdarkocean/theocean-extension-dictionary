// scripts/database.js

const DB_NAME = "YomitanSimulateDB";
const DB_VERSION = 1;
const STORE_NAME = "dictionary";

let dbInstance = null;

// Thêm export vào đây
export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "term" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Không thể mở Database");
    });
}

// Thêm export vào đây
export async function getDB() {
    if (dbInstance) return dbInstance;
    dbInstance = await openDB();
    return dbInstance;
}

// Thêm export vào đây
export async function getDefinition(word) {
    const db = await getDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        // Nhớ trim để sạch sẽ
        const request = store.get(word.toLowerCase().trim());
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// Thêm export vào đây (dùng cho trang options)
export async function importDictionary(jsonData) {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    jsonData.forEach(item => {
        if (item.term) {
            item.term = item.term.toLowerCase().trim();
            store.put(item);
        }
    });
               
    return new Promise((resolve) => {
        transaction.oncomplete = () => {
            console.log("Đã nạp xong!");
            resolve();
        };
    });
}