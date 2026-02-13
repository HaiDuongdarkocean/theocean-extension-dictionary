const NUMBERED_RE = /(^|<br\s*\/?>|\n)\s*(\d+)[\.\)]\s*/i;

function normalizeBreaks(html) {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "<br>")
    .replace(/<\s*\/p\s*>/gi, "<br>")
    .replace(/<p[^>]*>/gi, "")
    .trim();
}

export function splitDefinitionToAtoms(defHtml) {
  if (!defHtml) return [];
  let html = normalizeBreaks(defHtml);

  // If contains numbered headings, split on them (keep the marker)
  let parts = [];
  let cursor = 0;
  let match;
  while ((match = NUMBERED_RE.exec(html.substring(cursor)))) {
    const idx = cursor + match.index;
    if (idx > cursor) {
      parts.push(html.substring(cursor, idx));
    }
    const marker = match[0];
    cursor = idx + marker.length;
    // find next occurrence for slice end
    const nextMatch = NUMBERED_RE.exec(html.substring(cursor));
    if (nextMatch) {
      const slice = html.substring(idx, idx + marker.length + nextMatch.index);
      parts.push(slice);
      cursor = idx + marker.length + nextMatch.index;
    } else {
      parts.push(html.substring(idx));
      cursor = html.length;
    }
  }
  if (parts.length === 0) {
    parts = html.split(/<br><br>|\n\n/);
  }

  const atoms = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const headingMatch = NUMBERED_RE.exec(p);
      let head = "";
      let body = p;
      if (headingMatch) {
        head = headingMatch[0].replace(/<br>/g, "").trim();
        body = p.slice(headingMatch.index + headingMatch[0].length).trim();
      }
      return {
        head: head || null,
        glossHtml: body || "",
      };
    })
    .filter((atom) => atom.glossHtml);

  return atoms;
}
