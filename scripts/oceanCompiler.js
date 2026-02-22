// OCEAN ENGINE - Phrasal Verbs & Idioms Compiler
// VERSION: 2.0 - Added POSS placeholder support

export function extractAnchorWord(term) {
  if (!term) return null;
  const cleaned = term.toLowerCase().trim();
  const withoutArticle = cleaned.replace(/^(a|an|the)\s+/i, '');
  const words = withoutArticle.split(/\s+/);
  
  for (const word of words) {
    if (word === 'sth' || word === 'sb' || word === 'poss' ||
        word === 'something' || word === 'someone' ||
        word === 'your' || word === 'yourself') {
      continue;
    }
    if (/^[a-z]+$/.test(word)) {
      return word;
    }
  }
  return words[0] || null;
}

export function compilePhrasalPattern(term) {
  if (!term) return null;
  let pattern = term.toLowerCase().trim();
  pattern = pattern.replace(/(\w+)\/(\w+)/g, '($1|$2)');
  pattern = pattern.replace(/\s*\(([^)]+)\)\s*/g, (match, content) => {
    let escaped = content.trim();
    escaped = escaped.replace(/\b(sth|something)\b/g, '(?:[\\w\\s]{1,30})');
    escaped = escaped.replace(/\b(sb|someone)\b/g, '(?:[\\w\\s]{1,20})');
    escaped = escaped.replace(/\b(poss|possessive)\b/g, "(my|your|his|her|its|our|their|one's)");
    escaped = escaped.replace(/\s+/g, '\\s+');
    return `(?:\\s+${escaped})?\\s+`;
  });
  pattern = pattern.replace(/\b(sth|something)\b/g, '___OBJECT___');
  pattern = pattern.replace(/\b(sb|someone)\b/g, '___PERSON___');
  pattern = pattern.replace(/\b(poss|possessive)\b/g, '___POSSESSIVE___');
  pattern = pattern.replace(/\s+/g, '\\s+');
  pattern = pattern.replace(/___OBJECT___/g, "(?:[\\w'\\-]+(?:\\s+[\\w'\\-]+){0,4})");
  pattern = pattern.replace(/___PERSON___/g, "(?:[\\w'\\-]+(?:\\s+[\\w'\\-]+){0,3})");
  pattern = pattern.replace(/___POSSESSIVE___/g, "(my|your|his|her|its|our|their|one's)");
  const startsWithWord = /^[a-z(]/.test(pattern);
  const endsWithWord = /[a-z)]$/.test(pattern);
  if (startsWithWord) pattern = '\\b' + pattern;
  if (endsWithWord) pattern = pattern + '\\b';
  return pattern;
}

export function calculatePriority(term) {
  if (!term) return 0;
  const cleaned = term.toLowerCase()
    .replace(/\b(a|an|the|sth|sb|poss|something|someone|possessive)\b/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

export function isPhrasalPattern(term) {
  if (!term) return false;
  const lower = term.toLowerCase();
  if (/\b(sth|sb|poss|something|someone|possessive)\b/.test(lower)) return true;
  const withoutArticle = lower.replace(/^(a|an|the)\s+/i, '');
  const words = withoutArticle.split(/\s+/).filter(w => w.length > 0);
  return words.length >= 2;
}

export function testPattern(compiledRegex, sentence) {
  if (!compiledRegex || !sentence) return null;
  try {
    const regex = new RegExp(compiledRegex, 'i');
    const match = sentence.toLowerCase().match(regex);
    return match ? match[0] : null;
  } catch (e) {
    console.error('Invalid regex pattern:', compiledRegex, e);
    return null;
  }
}
