// Pure prompt-rewrite helpers. No dsh imports, so they are unit-testable alone.

const OPENER = /\b(?:you\s+are|you're|i\s+am|i'm|act\s+as)\b/gi
const IDENTITY_NOUN = /\b(?:agent|assistant|ai|tool|cli|programmer|companion|engineer|bot)\b/i
const ATTRIBUTION =
  /\b(?:(?:created|built|made|developed|designed|trained|powered|maintained|published|released|provided|authored|written)\s+(?:by|on|upon|at|for)|by\s+[a-z0-9_-]+|based\s+on|running\s+(?:inside|in|within|on)|integrated\s+(?:into|in))\b/i

/** Split text into fenced-code / inline-code / prose pieces; only prose is rewritten. */
function splitProtected(text) {
  const pieces = []
  const re = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) pieces.push({ code: false, text: text.slice(last, m.index) })
    pieces.push({ code: true, text: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) pieces.push({ code: false, text: text.slice(last) })
  return pieces
}

/** End of the sentence that starts at `from`: newline, or .!? followed by whitespace/end (decimals like 3.8 stay inside). */
function sentenceEnd(text, from) {
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (c === '\n') return i
    if ((c === '.' || c === '!' || c === '?') && (i + 1 >= text.length || /\s/.test(text[i + 1]))) return i
  }
  return text.length
}

function atSentenceStart(text, i) {
  let j = i - 1
  while (j >= 0 && (text[j] === ' ' || text[j] === '\t')) j--
  if (j < 0) return true
  if (text[j] === '\n') return true
  if (/[.!?]/.test(text[j])) return true
  return /^[-*•>#\d.)\s]+$/.test(text.slice(text.lastIndexOf('\n', j) + 1, i))
}

/**
 * Rewrite identity-declaring sentences ("You are X, an agent built by Y") so
 * their opener becomes a third-person phrase. Returns the text and the count.
 * `budget` limits how many leading characters are scanned.
 */
export function rewriteIdentity(text, { subject = 'This agent is', budget = Infinity, extraPatterns = [] } = {}) {
  let count = 0
  let consumed = 0
  const out = splitProtected(text).map((piece) => {
    const start = consumed
    consumed += piece.text.length
    if (piece.code || start >= budget) return piece.text
    const src = piece.text
    let result = ''
    let cursor = 0
    OPENER.lastIndex = 0
    for (const m of src.matchAll(OPENER)) {
      if (m.index < cursor || start + m.index >= budget) continue
      if (!atSentenceStart(src, m.index)) continue
      const end = sentenceEnd(src, m.index + m[0].length)
      const sentence = src.slice(m.index, end)
      const rest = sentence.slice(m[0].length)
      const identity = IDENTITY_NOUN.test(rest) || ATTRIBUTION.test(rest) || extraPatterns.some(p => p.test(rest))
      if (!identity) continue
      const lower = m[0].toLowerCase().replace(/\s+/g, ' ')
      const replacement = lower === 'act as' ? 'This agent acts as' : subject
      result += src.slice(cursor, m.index) + replacement
      cursor = m.index + m[0].length
      count++
    }
    return result + src.slice(cursor)
  })
  return { text: out.join(''), count }
}

/** Glob with `*` only, case-insensitive; an empty list matches everything. */
export function matchesAny(value, globs) {
  if (!globs || globs.length === 0) return true
  if (typeof value !== 'string') return false
  return globs.some((g) => {
    const re = new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i')
    return re.test(value)
  })
}
