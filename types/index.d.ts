// The prompt-router mod's data contract: every value it keeps in $.state.

/** The four recommendation tiers, cheapest first. */
export type Tier = 'haiku' | 'sonnet' | 'opus' | 'fable'

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** What the pure rules in classify.ts conclude about one prompt. */
export type RuleResult = {
  tier: Tier
  effort: Effort
  /** Sum of the matched signal weights; higher means harder work. */
  score: number
  /** Human-readable reasons, one per matched signal. */
  reasons: string[]
  /** True when the rules found nothing to go on, or found conflicting signals. */
  isAmbiguous: boolean
}

/** What the band shows: the rule result plus who made the final call. */
export type Recommendation = RuleResult & {
  modelLabel: string
  decidedBy: 'rules' | 'haiku' | 'rules (Haiku unavailable)'
  /** The first words of the analysed prompt, so the band says what it is about. */
  preview: string
}

declare module 'claude-code' {
  interface PluginState {
    'prompt-router': { rec: Shaped<Recommendation | null> }
  }
}
