import { BaseImporter } from "./baseImporter.js";
import {
  normalizeMigakuDictEntry,
  normalizeMigakuFreq,
} from "../normalizer.js";
import { migratePhrasalPatterns } from "../oceanMigration.js";

export class MigakuImporter extends BaseImporter {
  async import() {
    const text = await this.file.text();
    const json = JSON.parse(text);
    if (!Array.isArray(json)) {
      throw new Error("Migaku file must be a JSON array");
    }

    // Detect dictionary vs frequency
    if (json.length === 0) {
      throw new Error("Empty Migaku file");
    }

    if (typeof json[0] === "string") {
      return this.importFrequency(json);
    }
    if (typeof json[0] === "object") {
      return this.importDictionary(json);
    }

    throw new Error("Unrecognized Migaku structure");
  }

  async importDictionary(rows) {
    const meta = {
      kind: "dictionary",
      sourceFormat: "migaku",
      title: this.file.name.replace(/\.(json|zip)$/i, ""),
    };
    await this.saveResourceMeta({ ...meta, stats: { entryCount: rows.length } });

    const normalized = rows.map((row) =>
      normalizeMigakuDictEntry(row, this.resourceId),
    );
    await this.saveDictEntries(normalized);

    // 🌊 OCEAN ENGINE: Migrate phrasal patterns
    console.log("🌊 [IMPORTER] Starting OCEAN phrasal pattern migration...");
    console.log("🌊 [IMPORTER] Total entries to process:", rows.length);
    try {
      const migrationResult = await migratePhrasalPatterns(
        rows, 
        this.resourceId,
        (progress) => {
          if (progress.phase === 'inserting') {
            console.log(`🌊 [IMPORTER] Inserting: ${progress.inserted}/${progress.total}`);
          } else {
            console.log(`🌊 [IMPORTER] Processing: ${progress.processed}/${progress.total} (found: ${progress.found})`);
          }
        }
      );
      console.log(`✓ [IMPORTER] OCEAN migration complete:`, migrationResult);
    } catch (err) {
      console.error("⚠️ [IMPORTER] OCEAN migration failed (non-critical):", err);
    }

    return { resourceId: this.resourceId, kind: "dictionary", count: normalized.length };
  }

  async importFrequency(rows) {
    const meta = {
      kind: "frequency",
      sourceFormat: "migaku",
      title: this.file.name.replace(/\.(json|zip)$/i, ""),
    };
    await this.saveResourceMeta({ ...meta, stats: { entryCount: rows.length } });

    const normalized = rows.map((term, idx) =>
      normalizeMigakuFreq(term, idx, this.resourceId),
    );
    await this.saveFreqEntries(normalized);

    return { resourceId: this.resourceId, kind: "frequency", count: normalized.length };
  }
}
