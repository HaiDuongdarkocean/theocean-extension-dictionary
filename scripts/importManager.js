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
