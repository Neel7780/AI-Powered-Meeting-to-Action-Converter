function formatMsToVtt(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0") +
    "." +
    String(millis).padStart(3, "0")
  );
}

function buildVttTranscript(cues, sessionStartTime) {
  let vtt = "WEBVTT - ActionPulse Captions Ingestion\n\n";
  const startTs = sessionStartTime ? new Date(sessionStartTime).getTime() : Date.now();

  cues.forEach((cue, index) => {
    const cueTs = cue.timestamp ? new Date(cue.timestamp).getTime() : startTs + index * 5000;
    const startMs = Math.max(0, cueTs - startTs);
    const endMs = startMs + 4000;

    const startVtt = formatMsToVtt(startMs);
    const endVtt = formatMsToVtt(endMs);
    const speaker = cue.speaker || "Speaker";

    vtt += `${index + 1}\n${startVtt} --> ${endVtt}\n<v ${speaker}>${cue.text}\n\n`;
  });

  return vtt;
}

function buildCanonicalText(cues) {
  return cues.map((c) => `${c.speaker || "Speaker"}: ${c.text}`).join("\n");
}

const CAPTION_TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const UI_NOISE_SPEAKERS = new Set([
  "language",
  "format_size",
  "settings",
  "circle",
  "more_vert",
  "arrow_drop_down",
  "expand_more",
  "expand_less",
  "close",
  "closed_caption",
  "subtitles",
  "font size",
  "font color",
]);
const UI_NOISE_TEXT_PATTERNS = [
  /\bformat_size\b/i,
  /open caption settings/i,
  /caption settings/i,
  /\bfont size\b/i,
  /\bfont color\b/i,
  /^(language|settings|circle|arrow_drop_down|expand_more|expand_less|closed_caption)$/i,
];

function isCaptionToolbarNoise(speaker, text) {
  const cleanSpeaker = String(speaker || "").replace(/\s+/g, " ").trim().toLowerCase();
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleanText || cleanText.length < 2) return true;
  if (cleanSpeaker && UI_NOISE_SPEAKERS.has(cleanSpeaker)) return true;
  return UI_NOISE_TEXT_PATTERNS.some((p) => p.test(cleanText));
}

function tokenizeWords(text) {
  const matches = String(text || "").toLowerCase().match(CAPTION_TOKEN_RE);
  return matches || [];
}

function commonPrefixLength(a, b) {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

function commonSuffixLength(a, b, minStart = 0) {
  let i = a.length - 1;
  let j = b.length - 1;
  let count = 0;
  while (i >= minStart && j >= minStart && a[i] === b[j]) {
    count++;
    i--;
    j--;
  }
  return count;
}

function stripLeadingWords(text, wordCount) {
  if (wordCount <= 0) return text;
  const matches = Array.from(String(text || "").matchAll(CAPTION_TOKEN_RE));
  if (wordCount >= matches.length) return "";
  const cutEnd = matches[wordCount - 1].index + matches[wordCount - 1][0].length;
  return String(text || "")
    .slice(cutEnd)
    .replace(/^[\s.,!?;:…—-]+/, "")
    .trim();
}

function mergeOrAppendCue(cues, incomingCue) {
  const speaker = String(incomingCue?.speaker || "Speaker").replace(/\s+/g, " ").trim() || "Speaker";
  const text = String(incomingCue?.text || "").replace(/\s+/g, " ").trim();
  if (isCaptionToolbarNoise(speaker, text)) return "noise_ignored";

  const incomingTs = incomingCue?.timestamp || new Date().toISOString();
  const incomingMs = Date.parse(incomingTs);

  // Check only the most recent 2 cues to fix progressive STT edits without ever touching earlier distinct topics
  let targetCue = null;
  const searchFloor = Math.max(0, cues.length - 2);
  for (let i = cues.length - 1; i >= searchFloor; i--) {
    const candidate = cues[i];
    if (candidate.speaker !== speaker) continue;
    const candidateMs = Date.parse(candidate.timestamp || "");
    if (!Number.isFinite(incomingMs) || !Number.isFinite(candidateMs) || Math.abs(incomingMs - candidateMs) <= 30000) {
      targetCue = candidate;
      break;
    }
  }

  if (targetCue) {
    const prevText = targetCue.text || "";
    const prevWords = tokenizeWords(prevText);
    const newWords = tokenizeWords(text);
    if (newWords.length === 0) return "empty";

    const lcp = commonPrefixLength(prevWords, newWords);

    // 1. Identical words (punctuation/casing revision only)
    if (lcp === prevWords.length && prevWords.length === newWords.length) {
      if (text.length >= prevText.length) {
        targetCue.text = text;
        targetCue.timestamp = incomingTs;
        return "updated_revision";
      }
      return "duplicate_ignored";
    }

    // 2. Truncated stale prefix of what we already captured
    if (lcp === newWords.length && newWords.length < prevWords.length) {
      return "duplicate_ignored";
    }

    // 3. Progressive expansion or minor STT edit on the same ongoing utterance
    const lcs = commonSuffixLength(prevWords, newWords, lcp);
    const isSameUtteranceRevision =
      lcp === prevWords.length ||
      (prevWords.length >= 5 && lcp >= Math.ceil(prevWords.length * 0.7) && newWords.length >= prevWords.length - 2) ||
      (prevWords.length >= 6 && newWords.length >= prevWords.length - 2 && lcp + lcs >= prevWords.length - 2);

    if (isSameUtteranceRevision) {
      targetCue.text = text;
      targetCue.timestamp = incomingTs;
      return "updated_revision";
    }

    // 4. Rolling caption window: trim suffix-of-prev overlapping with prefix-of-new
    const maxOverlap = Math.min(prevWords.length, newWords.length);
    for (let k = maxOverlap; k >= 2; k--) {
      const overlapSlice = prevWords.slice(-k).join(" ");
      if (k === 2 && overlapSlice.length < 10) continue;
      if (overlapSlice === newWords.slice(0, k).join(" ")) {
        const remainder = stripLeadingWords(text, k);
        if (!remainder || remainder.length < 2) return "duplicate_ignored";
        cues.push({ speaker, text: remainder, timestamp: incomingTs });
        return "stored_trimmed";
      }
    }
  }

  // 5. Distinct utterance / new topic by the same or another speaker: keep intact
  cues.push({ speaker, text, timestamp: incomingTs });
  return "stored";
}
