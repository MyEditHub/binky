export interface WordGroup {
  label: string;
  words: string[];
}

/** Parse innuendo_words setting — handles both old string[] and new WordGroup[] format */
export function parseWordGroups(raw: string | null): WordGroup[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // New format: [{label, words}]
    if (parsed.length > 0 && typeof parsed[0] === 'object' && 'words' in parsed[0]) {
      return parsed as WordGroup[];
    }
    // Old format: string[] — migrate each word into its own group
    return (parsed as string[]).map(w => ({ label: w, words: [w] }));
  } catch {
    return [];
  }
}
