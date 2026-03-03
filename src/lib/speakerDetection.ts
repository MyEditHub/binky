// ─── Speaker Auto-Detection ───────────────────────────────────────────────────
//
// Detection strategy (in priority order):
//
// 1. INTRO PATTERN (primary, high-confidence)
//    Philipp always opens episodes with "Neue Woche, neue Folge, nett geflüstert"
//    (or close variants). The first segment containing any intro phrase identifies
//    the speaking host. This is 100% reliable when the intro is present.
//    Whisper may mis-transcribe slightly, so we check multiple pattern variants
//    case-insensitively.
//
// 2. NAME COUNTING (fallback, noisy)
//    When a speaker addresses the other host by name, they are *not* that person.
//    Counts cross-name mentions to determine whether SPEAKER_0 and SPEAKER_1 are
//    mapped correctly or need to be swapped.
//
//    Score formula:
//      swapEvidence   = (SPEAKER_0 says host0Name) + (SPEAKER_1 says host1Name)
//      noSwapEvidence = (SPEAKER_0 says host1Name) + (SPEAKER_1 says host0Name)
//      score = swapEvidence - noSwapEvidence
//      score > 0 → swap  |  score < 0 → no_swap  |  score === 0 → uncertain

export type DetectionResult = 'swap' | 'no_swap' | 'uncertain';

export interface DetectionOutcome {
  result: DetectionResult;
  score: number;
  method: 'intro_pattern' | 'name_counting' | 'uncertain';
}

interface Segment {
  speaker_label: string;
  corrected_speaker: string | null;
  text: string | null;
}

// ─── Intro-pattern detection ──────────────────────────────────────────────────
//
// Whisper may produce slight mis-transcriptions, so we test multiple variants
// (all lowercase for case-insensitive comparison). A single match is enough.

const INTRO_PATTERNS: RegExp[] = [
  /neue\s+woche/i,
  /neue\s+folge/i,
  /nett\s+gefl.{0,5}stert/i,   // covers "nett geflüstert" and OCR variants
  /nettgefl.{0,5}ster/i,       // single-word variant
];

/**
 * Returns the effective speaker label of the first segment whose text matches
 * one of the INTRO_PATTERNS, or null if no intro segment is found.
 *
 * Only scans the first MAX_INTRO_SCAN_SEGMENTS segments to avoid false positives
 * from mid-episode recap phrases.
 */
const MAX_INTRO_SCAN_SEGMENTS = 30;

function detectIntroSpeaker(segments: Segment[]): string | null {
  const scan = segments.slice(0, MAX_INTRO_SCAN_SEGMENTS);
  for (const seg of scan) {
    const text = seg.text;
    if (!text || !text.trim()) continue;
    for (const pattern of INTRO_PATTERNS) {
      if (pattern.test(text)) {
        return seg.corrected_speaker ?? seg.speaker_label;
      }
    }
  }
  return null;
}

// ─── Name-counting helpers ────────────────────────────────────────────────────

function countMatches(text: string, name: string): number {
  try {
    const re = new RegExp(`\\b${name}\\b`, 'gi');
    return (text.match(re) ?? []).length;
  } catch {
    return 0;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectSpeakerSwap(
  segments: Segment[],
  host0Name: string,
  host1Name: string,
): DetectionOutcome {
  if (!host0Name.trim() || !host1Name.trim()) {
    return { result: 'uncertain', score: 0, method: 'uncertain' };
  }

  // ── Phase 1: Intro-pattern (primary, high-confidence) ────────────────────
  //
  // The intro speaker is Philipp regardless of how host_0_name / host_1_name
  // are configured. We determine whether the intro speaker is SPEAKER_0 or
  // SPEAKER_1, then compare against which host name is expected on SPEAKER_0.
  //
  // If intro speaker label === 'SPEAKER_0':
  //   → SPEAKER_0 is Philipp.
  //   → If host_0_name === 'Philipp' → no swap needed.
  //   → If host_0_name !== 'Philipp' (i.e. host_0_name === 'Nadine') → swap.
  //
  // If intro speaker label === 'SPEAKER_1':
  //   → SPEAKER_0 is Nadine.
  //   → If host_0_name === 'Nadine' → no swap needed.
  //   → If host_0_name !== 'Nadine' (i.e. host_0_name === 'Philipp') → swap.

  const introSpeaker = detectIntroSpeaker(segments);
  if (introSpeaker !== null) {
    // "Philipp" is whoever speaks the intro. We identify Philipp by host1Name
    // (the non-host_0 host) only if host_0_name is not 'Philipp'. But we
    // cannot hard-code the name 'Philipp' here — the detection must be
    // name-agnostic.
    //
    // Instead we use: the intro speaker is NOT host_0_name. If SPEAKER_0 says
    // the intro and SPEAKER_0 maps to host_0_name, that would mean host_0_name
    // is the intro speaker. But we know the intro speaker is host_1_name
    // (Philipp). Therefore:
    //
    //   introSpeaker === 'SPEAKER_0' AND host_0_name === host_1_name's person
    //     → this contradicts what we know, so we need to swap
    //
    // Simpler re-statement: the intro speaker should be host_1_name (Philipp).
    // If introSpeaker === 'SPEAKER_0', then SPEAKER_0 is host_1_name → swap.
    // If introSpeaker === 'SPEAKER_1', then SPEAKER_1 is host_1_name → no swap.
    //
    // NOTE: This assumes the intro is always spoken by host_1 (Philipp, index 1).
    // That is consistent with the configured settings (host_0=Nadine, host_1=Philipp).
    //
    // For robustness: detect which configured name is present NEAR the intro.
    // The intro ends "...nett geflüstert, <Nadine>" — Nadine is addressed AT
    // the end of the intro by the intro speaker (Philipp). So the intro segment
    // itself likely contains host_0_name (Nadine) as an address.
    //
    // Use that signal: intro speaker mentions host_0_name → intro speaker ≠ host_0 → swap if SPEAKER_0.

    const introSeg = segments.slice(0, MAX_INTRO_SCAN_SEGMENTS).find((seg) => {
      const text = seg.text;
      if (!text || !text.trim()) return false;
      return INTRO_PATTERNS.some((p) => p.test(text));
    });

    if (introSeg) {
      const introText = introSeg.text ?? '';
      const introMentionsHost0 = countMatches(introText, host0Name) > 0;
      const introMentionsHost1 = countMatches(introText, host1Name) > 0;

      // If the intro segment mentions host_0_name, the intro speaker is
      // addressing host_0 → intro speaker IS NOT host_0 → intro speaker = host_1.
      // If SPEAKER_0 = intro speaker → SPEAKER_0 = host_1 → swap needed.
      // If SPEAKER_1 = intro speaker → SPEAKER_1 = host_1 → no swap needed.
      if (introMentionsHost0 && !introMentionsHost1) {
        if (introSpeaker === 'SPEAKER_0') {
          return { result: 'swap', score: 100, method: 'intro_pattern' };
        } else if (introSpeaker === 'SPEAKER_1') {
          return { result: 'no_swap', score: -100, method: 'intro_pattern' };
        }
      }

      // If the intro segment mentions host_1_name (speaker is addressing Philipp),
      // that would mean Nadine says the intro — unusual but possible.
      if (introMentionsHost1 && !introMentionsHost0) {
        if (introSpeaker === 'SPEAKER_0') {
          return { result: 'no_swap', score: -100, method: 'intro_pattern' };
        } else if (introSpeaker === 'SPEAKER_1') {
          return { result: 'swap', score: 100, method: 'intro_pattern' };
        }
      }

      // Intro found but name context ambiguous — still use speaker position
      // heuristic: SPEAKER_0 is sherpa-rs's "dominant" speaker (more total ms).
      // Philipp typically has fewer but longer segments; Nadine shorter interjections.
      // Without a name-based anchor, fall through to name counting for safety.
    }
  }

  // ── Phase 2: Name counting (fallback) ────────────────────────────────────

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

  if (score > 0) return { result: 'swap', score, method: 'name_counting' };
  if (score < 0) return { result: 'no_swap', score, method: 'name_counting' };
  return { result: 'uncertain', score: 0, method: 'uncertain' };
}
