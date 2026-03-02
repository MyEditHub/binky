// ─── Speaker Auto-Detection ───────────────────────────────────────────────────
//
// Heuristic: when a speaker addresses the other host by name, they are *not*
// that person. Counts cross-name mentions to determine whether SPEAKER_0 and
// SPEAKER_1 are mapped correctly or need to be swapped.
//
// Score formula:
//   swapEvidence   = (SPEAKER_0 says host0Name) + (SPEAKER_1 says host1Name)
//   noSwapEvidence = (SPEAKER_0 says host1Name) + (SPEAKER_1 says host0Name)
//   score = swapEvidence - noSwapEvidence
//   score > 0 → swap  |  score < 0 → no_swap  |  score === 0 → uncertain

export type DetectionResult = 'swap' | 'no_swap' | 'uncertain';

export interface DetectionOutcome {
  result: DetectionResult;
  score: number;
}

interface Segment {
  speaker_label: string;
  corrected_speaker: string | null;
  text: string | null;
}

function countMatches(text: string, name: string): number {
  try {
    const re = new RegExp(`\\b${name}\\b`, 'gi');
    return (text.match(re) ?? []).length;
  } catch {
    return 0;
  }
}

export function detectSpeakerSwap(
  segments: Segment[],
  host0Name: string,
  host1Name: string,
): DetectionOutcome {
  if (!host0Name.trim() || !host1Name.trim()) {
    return { result: 'uncertain', score: 0 };
  }

  let swapEvidence = 0;
  let noSwapEvidence = 0;

  for (const seg of segments) {
    const text = seg.text;
    if (!text || !text.trim()) continue;

    const effective = seg.corrected_speaker ?? seg.speaker_label;

    const mentionsHost0 = countMatches(text, host0Name);
    const mentionsHost1 = countMatches(text, host1Name);

    if (effective === 'SPEAKER_0') {
      swapEvidence += mentionsHost0;
      noSwapEvidence += mentionsHost1;
    } else if (effective === 'SPEAKER_1') {
      swapEvidence += mentionsHost1;
      noSwapEvidence += mentionsHost0;
    }
  }

  const score = swapEvidence - noSwapEvidence;

  if (score > 0) return { result: 'swap', score };
  if (score < 0) return { result: 'no_swap', score };
  return { result: 'uncertain', score: 0 };
}
