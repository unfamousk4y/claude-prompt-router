// Pure scoring rules: text in, recommendation out. No engine calls here, so the
// same prompt always gets the same answer and the rules are easy to test.

import type { Effort, RuleResult, Tier } from '../types'

/** Display name and default effort for each tier. */
export const TIERS: Record<Tier, { label: string; effort: Effort }> = {
  haiku: { label: 'Haiku 5.5', effort: 'low' },
  sonnet: { label: 'Sonnet 5.5', effort: 'medium' },
  opus: { label: 'Opus 5.5', effort: 'high' },
  // Fable is the most capable and most expensive model (2x Opus per token), so
  // it is reserved for very hard, long-horizon work. "high" is its suggested
  // starting effort; higher levels have uneven gains.
  fable: { label: 'Fable 5.2', effort: 'high' },
}

type Signal = {
  /** Groups signals: "trivial" and "deep" matching together means a conflict. */
  kind: 'trivial' | 'build' | 'debug' | 'deep' | 'long'
  weight: number
  reason: string
  pattern: RegExp
}

// Each signal counts once per prompt, however many times its words appear, so
// repeating a keyword cannot inflate the score.
const SIGNALS: Signal[] = [
  {
    kind: 'trivial',
    weight: -2,
    reason: 'small mechanical task (rename, format, lookup, short summary)',
    pattern:
      /\b(rename|typo|spelling|reformat|format this|what is|what's|define|definition of|list the|convert|translate|summari[sz]e|lint|one[- ]liner)\b/i,
  },
  {
    kind: 'build',
    weight: 2,
    reason: 'build or change code of a known size',
    pattern:
      /\b(implement|add (a|an|the)|create|build|write (a|the|some)? ?(test|tests|function|component|script|docs?)|update|endpoint|feature|hook up)\b/i,
  },
  {
    kind: 'debug',
    weight: 2,
    reason: 'debugging a concrete error',
    pattern:
      /\b(error|exception|stack ?trace|traceback|failing|fails|bug|broken|doesn'?t work|not working|crash(es|ing)?)\b/i,
  },
  {
    kind: 'deep',
    weight: 6,
    reason: 'design, tradeoffs or hard reasoning (architecture, security, performance, root cause)',
    pattern:
      /\b(architect\w*|design (a|the)|trade-?offs?|compare (the )?(approaches|options)|refactor\w*|migrat\w*|security|vulnerab\w*|performance|optimi[sz]\w*|scal(e|ing|ability)|concurren\w*|race condition|root cause|why does|research)\b/i,
  },
  {
    kind: 'long',
    weight: 6,
    reason: 'long-horizon, multi-step or whole-project work',
    pattern:
      /\b(entire (codebase|app|application|project|repo)|whole (codebase|app|project|repo)|across the codebase|from scratch|end[- ]to[- ]end|multi-?step|autonomous\w*|full (stack|application))\b/i,
  },
]

const CODE_OR_TRACE = /```|\n\s+at \S+\(|Traceback \(most recent call last\)/
// Looks like a file path: has a slash or backslash, or a name with a code extension.
const FILE_PATH = /[\w.-]+[\\/][\w./\\-]+|\b[\w-]+\.(ts|tsx|js|jsx|py|java|go|rs|rb|cs|cpp|c|h|sql|json|md|css|html)\b/g

// Score cut-offs between tiers. A score of 0 or below is Haiku, 1-4 Sonnet,
// 5-9 Opus, 10 and above Fable. A deep-reasoning signal alone (6) reaches Opus
// even on a short prompt; Fable needs deep AND long-horizon signals together.
function tierFor(score: number): Tier {
  if (score <= 0) return 'haiku'
  if (score <= 4) return 'sonnet'
  if (score <= 9) return 'opus'
  return 'fable'
}

export function classify(text: string): RuleResult {
  const trimmed = text.trim()
  let score = 0
  const reasons: string[] = []
  const kinds = new Set<Signal['kind']>()

  for (const signal of SIGNALS) {
    if (signal.pattern.test(trimmed)) {
      score += signal.weight
      reasons.push(signal.reason)
      kinds.add(signal.kind)
    }
  }

  if (CODE_OR_TRACE.test(trimmed)) {
    score += 1
    reasons.push('includes code or a stack trace')
  }

  // Distinct paths only; each one past the first adds 1, capped at +3.
  const paths = new Set(trimmed.match(FILE_PATH) ?? [])
  if (paths.size > 1) {
    const extra = Math.min(paths.size - 1, 3)
    score += extra
    reasons.push(`names ${paths.size} files`)
  }

  const words = trimmed.split(/\s+/).filter(Boolean).length
  if (words < 15) {
    score -= 1
    reasons.push('short prompt')
  } else if (words > 200) {
    score += 2
    reasons.push('long, detailed prompt')
  } else if (words >= 60) {
    score += 1
    reasons.push('medium-length prompt')
  }

  // Ambiguous: no keyword signal at all (the rules are guessing from length
  // alone), or easy and hard signals at once (they disagree).
  const isAmbiguous =
    kinds.size === 0 ||
    (kinds.has('trivial') && (kinds.has('deep') || kinds.has('long')))

  const tier = tierFor(score)

  return { tier, effort: TIERS[tier].effort, score, reasons, isAmbiguous }
}

/**
 * Labels for the Haiku tie-breaker. The classifier sees only these words and
 * the prompt, so each label describes its tier in plain terms.
 */
export const TIEBREAK_LABELS: Record<string, Tier> = {
  'simple-quick-task': 'haiku',
  'standard-coding-or-writing-task': 'sonnet',
  'complex-reasoning-or-design-task': 'opus',
  'very-hard-long-multi-step-project': 'fable',
}
