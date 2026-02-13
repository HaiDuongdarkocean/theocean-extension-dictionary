import { BaseImporter } from "./baseImporter.js";
import {
  normalizeYomitanDictEntry,
  normalizeYomitanFreq,
} from "../normalizer.js";

export class YomitanImporter extends BaseImporter {
  async import() {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip is required for Yomitan ZIP import (scripts/vendor.jszip.min.js)");
    }
    const zip = await JSZip.loadAsync(this.file);

    // Read index.json
    const indexFile = zip.file("index.json");
    if (!indexFile) {
      throw new Error("index.json not found, not a Yomitan zip");
    }
    const index = JSON.parse(await indexFile.async("string"));

    // Determine if dictionary or frequency by presence of term_bank vs term_meta_bank
    const termBanks = Object.keys(zip.files).filter((name) =>
      /term_bank_.*\.json$/i.test(name),
    );
    const metaBanks = Object.keys(zip.files).filter((name) =>
      /term_meta_bank_.*\.json$/i.test(name),
    );

    if (termBanks.length > 0) {
      return this.importDictionary(zip, index, termBanks);
    }
    if (metaBanks.length > 0) {
      return this.importFrequency(zip, index, metaBanks);
    }

    throw new Error("No term_bank or term_meta_bank found in zip");
  }

  async importDictionary(zip, index, termBanks) {
    const meta = {
      kind: "dictionary",
      sourceFormat: "yomitan",
      title: index.title || this.file.name,
      revision: index.revision || null,
    };
    await this.saveResourceMeta({ ...meta, stats: { entryCount: 0 } });

    let total = 0;
    for (const name of termBanks) {
      const raw = JSON.parse(await zip.file(name).async("string"));
      const normalized = raw.map((row) =>
        normalizeYomitanDictEntry(row, this.resourceId),
      );
      await this.saveDictEntries(normalized);
      total += normalized.length;
    }

    await this.saveResourceMeta({ ...meta, stats: { entryCount: total } });
    return { resourceId: this.resourceId, kind: "dictionary", count: total };
  }

  async importFrequency(zip, index, metaBanks) {
    const meta = {
      kind: "frequency",
      sourceFormat: "yomitan",
      title: index.title || this.file.name,
      revision: index.revision || null,
    };
    await this.saveResourceMeta({ ...meta, stats: { entryCount: 0 } });

    let total = 0;
    for (const name of metaBanks) {
      const raw = JSON.parse(await zip.file(name).async("string"));
      const normalized = raw.map((row) =>
        normalizeYomitanFreq(row, this.resourceId),
      );
      await this.saveFreqEntries(normalized);
      total += normalized.length;
    }

    await this.saveResourceMeta({ ...meta, stats: { entryCount: total } });
    return { resourceId: this.resourceId, kind: "frequency", count: total };
  }
}
