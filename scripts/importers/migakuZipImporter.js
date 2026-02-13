import { BaseImporter } from "./baseImporter.js";
import {
  normalizeMigakuDictEntry,
  normalizeMigakuFreq,
} from "../normalizer.js";

export class MigakuZipImporter extends BaseImporter {
  async import() {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip is required for Migaku ZIP import (scripts/vendor.jszip.min.js)");
    }

    const zip = await JSZip.loadAsync(this.file);
    const jsonFiles = Object.keys(zip.files).filter((name) =>
      name.toLowerCase().endsWith(".json"),
    );
    if (jsonFiles.length === 0) {
      throw new Error("No JSON found in Migaku zip");
    }

    // Merge all JSON arrays into one dataset.
    const arrays = [];
    for (const name of jsonFiles) {
      const text = await zip.file(name).async("string");
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) arrays.push(parsed);
    }
    if (arrays.length === 0) {
      throw new Error("No JSON arrays found in Migaku zip");
    }

    const first = arrays[0][0];
    if (typeof first === "string") {
      // frequency rank list: concatenate lists (keep order by file then within file)
      const merged = arrays.flat().filter((x) => typeof x === "string");
      return this.importFrequency(merged);
    }
    if (typeof first === "object") {
      const merged = arrays.flat().filter((x) => x && typeof x === "object");
      return this.importDictionary(merged);
    }

    throw new Error("Unrecognized Migaku zip structure");
  }

  async importDictionary(rows) {
    const meta = {
      kind: "dictionary",
      sourceFormat: "migaku",
      title: this.file.name.replace(/\.(zip)$/i, ""),
      stats: { entryCount: rows.length },
    };
    await this.saveResourceMeta(meta);

    const normalized = rows.map((row) =>
      normalizeMigakuDictEntry(row, this.resourceId),
    );
    await this.saveDictEntries(normalized);
    return { resourceId: this.resourceId, kind: "dictionary", count: normalized.length };
  }

  async importFrequency(rows) {
    const meta = {
      kind: "frequency",
      sourceFormat: "migaku",
      title: this.file.name.replace(/\.(zip)$/i, ""),
      stats: { entryCount: rows.length },
    };
    await this.saveResourceMeta(meta);

    const normalized = rows.map((term, idx) =>
      normalizeMigakuFreq(term, idx, this.resourceId),
    );
    await this.saveFreqEntries(normalized);
    return { resourceId: this.resourceId, kind: "frequency", count: normalized.length };
  }
}

