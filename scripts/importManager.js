import { MigakuImporter } from "./importers/migakuImporter.js";
import { YomitanImporter } from "./importers/yomitanImporter.js";
import { MigakuZipImporter } from "./importers/migakuZipImporter.js";

function detectKindByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".json")) return "json";
  return null;
}

export async function importFile(file) {
  const kind = detectKindByName(file.name);
  if (!kind) throw new Error("Unsupported file type");

  if (kind === "zip") {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip is required for ZIP import (scripts/vendor.jszip.min.js)");
    }
    const zip = await JSZip.loadAsync(file);
    const hasIndex = Boolean(zip.file("index.json"));

    if (hasIndex) {
      const importer = new YomitanImporter(file);
      return importer.import();
    }

    const importer = new MigakuZipImporter(file);
    return importer.import();
  }

  if (kind === "json") {
    const importer = new MigakuImporter(file);
    return importer.import();
  }

  throw new Error("Unsupported file type");
}

// Helper function to import dictionary from URL (for auto-import)
export async function importDictionary(data, sourceName) {
  // Create a fake File object from JSON data
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const file = new File([blob], sourceName, { type: "application/json" });
  
  const importer = new MigakuImporter(file);
  return importer.import();
}

// Helper function to import frequency list from URL (for auto-import)
export async function importFrequencyList(data) {
  // Frequency list import logic
  // This should match the logic in options.js for frequency import
  const { openDB } = await import("./database.js");
  const db = await openDB();
  
  const tx = db.transaction("frequency", "readwrite");
  const store = tx.objectStore("frequency");
  
  // Clear existing frequency data
  await store.clear();
  
  // Import new frequency data
  for (const [word, freq] of Object.entries(data)) {
    await store.put({ word, frequency: freq });
  }
  
  await tx.done;
  console.log(`Imported ${Object.keys(data).length} frequency entries`);
}
