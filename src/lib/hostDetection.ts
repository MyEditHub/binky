const STOPWORDS = new Set([
  'Also',
  'Aber',
  'Dann',
  'Oder',
  'Wenn',
  'Weil',
  'Dass',
  'Denn',
  'Noch',
  'Schon',
  'Halt',
  'Genau',
  'Richtig',
  'Stimmt',
  'Okay',
  'Nein',
  'Klar',
  'Gut',
  'Sehr',
  'Viel',
  'Schon',
  'Jetzt',
  'Hier',
  'Gibt',
  'Wird',
  'Kann',
  'Muss',
  'Sind',
  'Haben',
  'Wurde',
  'Hatte',
  'Wäre',
]);

export function extractHostNameCandidates(
  fullText: string
): Array<{ name: string; count: number; confidence: number }> {
  const patterns = [
    /,\s+([A-ZÄÖÜ][a-zäöüß]{2,})[,!?.]/g,
    /^([A-ZÄÖÜ][a-zäöüß]{2,}),/gm,
    /[Hh]allo\s+([A-ZÄÖÜ][a-zäöüß]{2,})/g,
    /[Hh]ey\s+([A-ZÄÖÜ][a-zäöüß]{2,})/g,
    /[Ss]ag\s+mal[\s,]+([A-ZÄÖÜ][a-zäöüß]{2,})/g,
    /[Dd]anke[\s,]+([A-ZÄÖÜ][a-zäöüß]{2,})/g,
  ];

  const counts = new Map<string, number>();
  let totalMatches = 0;

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      const name = match[1];
      if (!STOPWORDS.has(name) && name.length >= 3) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
        totalMatches++;
      }
    }
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, count]) => ({
      name,
      count,
      confidence: totalMatches > 0 ? count / totalMatches : 0,
    }));

  return sorted;
}

export function isHighConfidence(
  candidates: Array<{ name: string; count: number; confidence: number }>
): boolean {
  return (
    candidates.length >= 2 &&
    candidates[0].count >= 5 &&
    candidates[0].confidence >= 0.5 &&
    candidates[1].count >= 3
  );
}
