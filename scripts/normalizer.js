import { splitDefinitionToAtoms } from "./atomicSplitter.js";

export function normalizeTermKey(term) {
  if (!term) return "";
  return term
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, " ")
    .replace(/[.,!?;:'")\]]+$/g, "");
}

export function normalizeMigakuDictEntry(raw, resourceId) {
  const termKey = normalizeTermKey(raw.term || raw.altterm);
  const atoms = splitDefinitionToAtoms(raw.definition || "");

  return {
    resourceId,
    termKey,
    displayTerm: raw.term || "",
    reading: raw.altterm || "",
    pronunciation: raw.pronunciation || "",
    pos: raw.pos || "",
    meaningAtoms: atoms.map((atom, idx) => ({
      atomId: `${resourceId}:${termKey}:${idx}`,
      head: atom.head,
      glossHtml: atom.glossHtml,
      examples: raw.examples ? [raw.examples] : [],
      tags: raw.pos ? [raw.pos] : [],
    })),
    raw,
  };
}

export function normalizeMigakuFreq(term, index, resourceId) {
  const termKey = normalizeTermKey(term);
  return {
    resourceId,
    termKey,
    value: index + 1,
    valueType: "rank",
  };
}

export function normalizeYomitanDictEntry(rawArray, resourceId) {
  // Yomitan term_bank array sample: [term, reading, ?, ?, ?, definitionsArray, ...]
  const term = rawArray[0] || "";
  const reading = rawArray[1] || "";
  const definitionsRaw = rawArray[5] || [];
  const termKey = normalizeTermKey(term);

  let atoms = [];
  if (Array.isArray(definitionsRaw)) {
    atoms = definitionsRaw.map((def, idx) => ({
      atomId: `${resourceId}:${termKey}:${idx}`,
      head: null,
      glossHtml: def || "",
      examples: [],
      tags: [],
    }));
  } else if (typeof definitionsRaw === "string") {
    atoms = splitDefinitionToAtoms(definitionsRaw).map((atom, idx) => ({
      atomId: `${resourceId}:${termKey}:${idx}`,
      head: atom.head,
      glossHtml: atom.glossHtml,
      examples: [],
      tags: [],
    }));
  }

  return {
    resourceId,
    termKey,
    displayTerm: term,
    reading,
    pronunciation: "",
    pos: "",
    meaningAtoms: atoms,
    raw: { source: rawArray },
  };
}

export function normalizeYomitanFreq(row, resourceId) {
  // ["term", "freq", number]
  const termKey = normalizeTermKey(row[0]);
  const value = Number(row[2]) || 0;
  return {
    resourceId,
    termKey,
    value,
    valueType: "freq",
  };
}
