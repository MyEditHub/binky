// ─── Speaker Auto-Detection ───────────────────────────────────────────────────
//
// Detection strategy (in priority order):
//
// 1. INTRO PATTERN  (Wave 1 — high confidence, fast)
//    Philipp always opens with "Neue Woche, neue Folge, nett geflüstert".
//    Identifies the intro speaker, then checks which host name is addressed
//    in the same segment (Philipp says "...nett geflüstert, Nadine").
//    Only scans first 30 segments to avoid mid-episode recap phrases.
//
// 2. FIRST-PERSON ANCHORS  (Wave 2 — high confidence when found)
//    Full-episode scan for self-identification phrases:
//      "Ich bin Philipp", "Ich heiße Nadine", "ich, Philipp,", "Hier ist X"
//    The speaker of such a segment IS that person, regardless of position.
//
// 3. DIRECT ADDRESS + NAME COUNTING  (Wave 3 — moderate confidence)
//    "Hey Nadine" / "Danke Philipp" → the speaker is NOT the named person.
//    Combined with raw name-mention counts across the whole episode.
//    Uses raw speaker_label only — never corrected_speaker — for idempotency.
//
// 4. POSITIONAL HEURISTIC  (Wave 4 — last resort)
//    sherpa-rs assigns SPEAKER_0 to the dominant speaker (most total ms).
//    Philipp consistently drives the episode format → SPEAKER_0 = Philipp = host_1.
//    Therefore: SPEAKER_0 should always be labeled SPEAKER_1 → swap.
//
// IDEMPOTENCY GUARANTEE
//    All waves read only speaker_label, never corrected_speaker. Running
//    detection multiple times on the same episode always produces the same result.

export type DetectionResult = 'swap' | 'no_swap' | 'uncertain';

export interface DetectionOutcome {
  result: DetectionResult;
  score: number;
  method: 'intro_pattern' | 'first_person' | 'direct_address' | 'name_counting' | 'positional' | 'uncertain';
}

interface Segment {
  speaker_label: string;
  corrected_speaker: string | null;
  text: string | null;
}

// ─── Wave 1: Intro-pattern ────────────────────────────────────────────────────

const INTRO_PATTERNS: RegExp[] = [
  /neue\s+woche/i,
  /neue\s+folge/i,
  /nett\s+gefl.{0,5}stert/i,              // covers "nett geflüstert" and OCR variants
  /nettgefl.{0,5}ster/i,                  // single-word variant
  /wie\s+immer\s+gegen.{0,5}ber/i,        // Philipp's alt intro: "Wie immer gegenüber..."
  /wundersch.{0,5}ne.{0,20}einzigartige/i, // "wunderschöne, einzigartige" intro praise
];

const MAX_INTRO_SCAN_SEGMENTS = 30;

function countMatches(text: string, name: string): number {
  try {
    const re = new RegExp(`\\b${name}\\b`, 'gi');
    return (text.match(re) ?? []).length;
  } catch {
    return 0;
  }
}

// ─── Wave 2: First-person self-identification ─────────────────────────────────

const FIRST_PERSON_PATTERNS: Array<(name: string) => RegExp> = [
  (name) => new RegExp(`\\bich\\s+bin\\s+${name}\\b`, 'i'),
  (name) => new RegExp(`\\bich\\s+hei(?:ß|ss)e\\s+${name}\\b`, 'i'),
  (name) => new RegExp(`\\bich[,\\s]+${name}[,\\s]`, 'i'),         // "Ich, Philipp, denke..."
  (name) => new RegExp(`\\bhier\\s+(?:ist|spricht)\\s+${name}\\b`, 'i'),
  (name) => new RegExp(`\\bmein\\s+name\\s+ist\\s+${name}\\b`, 'i'),
];

/**
 * Scan ALL segments for first-person self-identification phrases.
 * Returns the raw speaker_label that identified themselves, and which host name they used.
 */
function detectFirstPersonSpeaker(
  segments: Segment[],
  host0Name: string,
  host1Name: string,
): { speaker: string; identifiedAs: string } | null {
  for (const seg of segments) {
    const text = seg.text;
    if (!text || !text.trim()) continue;
    const label = seg.speaker_label;
    for (const patternFn of FIRST_PERSON_PATTERNS) {
      if (patternFn(host0Name).test(text)) return { speaker: label, identifiedAs: host0Name };
      if (patternFn(host1Name).test(text)) return { speaker: label, identifiedAs: host1Name };
    }
  }
  return null;
}

// ─── Wave 3: Direct address ───────────────────────────────────────────────────
//
// "Hey Nadine", "Danke Philipp", "Genau, Nadine" → speaker is NOT that person.
// Builds evidence by counting how often each speaker directly addresses each name.

const ADDRESS_PREFIXES = 'hey|hallo|hi|hej|na|danke|liebe[rs]?|genau|stimmt|ja|gut|super|okay|ok|richtig';

function buildAddressPattern(name: string): RegExp {
  return new RegExp(
    `(?:${ADDRESS_PREFIXES})[,\\s]+${name}\\b|\\b${name}[,\\s]*[!?]`,
    'gi',
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Determine whether SPEAKER_0 and SPEAKER_1 need to be swapped.
 *
 * @param earlyOnly  If true, only Wave 1 is attempted (fast path for 30-segment batches).
 *                   Returns 'uncertain' if intro not conclusive.
 *                   Set to false (default) for full-episode scans.
 */
export function detectSpeakerSwap(
  segments: Segment[],
  host0Name: string,
  host1Name: string,
  options?: { earlyOnly?: boolean },
): DetectionOutcome {
  if (!host0Name.trim() || !host1Name.trim()) {
    return { result: 'uncertain', score: 0, method: 'uncertain' };
  }

  const earlyOnly = options?.earlyOnly ?? false;

  // ── Wave 1: Intro pattern ─────────────────────────────────────────────────

  const introSeg = segments.slice(0, MAX_INTRO_SCAN_SEGMENTS).find((seg) => {
    const text = seg.text;
    if (!text || !text.trim()) return false;
    return INTRO_PATTERNS.some((p) => p.test(text));
  });

  if (introSeg) {
    const introSpeaker = introSeg.speaker_label; // always raw
    const scanWindow = segments.slice(0, MAX_INTRO_SCAN_SEGMENTS);
    const introIdx = scanWindow.indexOf(introSeg);

    // Check the intro segment itself AND the next 3 segments for a host name.
    // Sometimes Whisper splits "nett geflüstert" into one segment and "Nadine" into the next.
    const nearbyText = scanWindow
      .slice(introIdx, introIdx + 4)
      .map((s) => s.text ?? '')
      .join(' ');

    const introMentionsHost0 = countMatches(nearbyText, host0Name) > 0;
    const introMentionsHost1 = countMatches(nearbyText, host1Name) > 0;

    // Intro speaker addresses host0 → intro speaker = host1 (Philipp)
    if (introMentionsHost0 && !introMentionsHost1) {
      return introSpeaker === 'SPEAKER_0'
        ? { result: 'swap', score: 100, method: 'intro_pattern' }
        : { result: 'no_swap', score: -100, method: 'intro_pattern' };
    }
    // Intro speaker addresses host1 → intro speaker = host0 (unusual but handle it)
    if (introMentionsHost1 && !introMentionsHost0) {
      return introSpeaker === 'SPEAKER_0'
        ? { result: 'no_swap', score: -100, method: 'intro_pattern' }
        : { result: 'swap', score: 100, method: 'intro_pattern' };
    }
    // Intro found but no name nearby — fall through to further waves
  }

  if (earlyOnly) {
    // Caller will re-invoke with full segments + earlyOnly=false
    return { result: 'uncertain', score: 0, method: 'uncertain' };
  }

  // ── Wave 2: First-person self-identification ──────────────────────────────
  //
  // "Ich bin Philipp" in a segment → that segment's speaker IS Philipp.

  const firstPerson = detectFirstPersonSpeaker(segments, host0Name, host1Name);
  if (firstPerson !== null) {
    const { speaker, identifiedAs } = firstPerson;
    if (identifiedAs === host0Name) {
      // speaker IS host0 → SPEAKER_0 should stay SPEAKER_0 if speaker===SPEAKER_0
      return speaker === 'SPEAKER_0'
        ? { result: 'no_swap', score: -80, method: 'first_person' }
        : { result: 'swap', score: 80, method: 'first_person' };
    } else {
      // speaker IS host1 → SPEAKER_1 should be host1 if speaker===SPEAKER_1
      return speaker === 'SPEAKER_1'
        ? { result: 'no_swap', score: -80, method: 'first_person' }
        : { result: 'swap', score: 80, method: 'first_person' };
    }
  }

  // ── Wave 3: Direct address + name counting ────────────────────────────────
  //
  // Two complementary signals combined:
  //   a) Direct address ("Hey Nadine" → speaker ≠ Nadine) — weighted x2
  //   b) Raw name mentions per speaker (cross-reference counting)
  //
  // ALWAYS uses speaker_label (never corrected_speaker) — idempotent.

  const h0AddressPattern = buildAddressPattern(host0Name);
  const h1AddressPattern = buildAddressPattern(host1Name);

  let swapEvidence = 0;
  let noSwapEvidence = 0;
  let addressTotal = 0;

  for (const seg of segments) {
    const text = seg.text;
    if (!text || !text.trim()) continue;
    const label = seg.speaker_label; // raw — never corrected

    const h0Direct = (text.match(h0AddressPattern) ?? []).length;
    const h1Direct = (text.match(h1AddressPattern) ?? []).length;
    const h0Mentions = countMatches(text, host0Name);
    const h1Mentions = countMatches(text, host1Name);

    if (label === 'SPEAKER_0') {
      // SPEAKER_0 addresses host0 → SPEAKER_0 ≠ host0 → swap evidence
      swapEvidence   += h0Direct * 2 + h0Mentions;
      noSwapEvidence += h1Direct * 2 + h1Mentions;
    } else if (label === 'SPEAKER_1') {
      // SPEAKER_1 addresses host1 → SPEAKER_1 ≠ host1 → swap evidence
      swapEvidence   += h1Direct * 2 + h1Mentions;
      noSwapEvidence += h0Direct * 2 + h0Mentions;
    }

    addressTotal += h0Direct + h1Direct;
  }

  const nameScore = swapEvidence - noSwapEvidence;
  if (Math.abs(nameScore) >= 2) {
    const method = addressTotal > 0 ? 'direct_address' : 'name_counting';
    if (nameScore > 0) return { result: 'swap', score: nameScore, method };
    if (nameScore < 0) return { result: 'no_swap', score: nameScore, method };
  }

  // ── Wave 4: Positional heuristic ──────────────────────────────────────────
  //
  // sherpa-rs SPEAKER_0 = dominant speaker (most total speaking ms) = Philipp.
  // Philipp = host_1_name → SPEAKER_0 should be labeled SPEAKER_1 → swap.
  return { result: 'swap', score: 1, method: 'positional' };
}
