import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Recommendation, Tier } from '../types'
import { classify, TIEBREAK_LABELS, TIERS } from './classify'

const COMMAND = 'recommend'

// The latest recommendation; null hides the band. The shape tag lets a future
// version decline a value this version stored (state survives reloads).
const rec = atom({ plugin: 'prompt-router', key: 'rec' } as const, null, {
  shape: 'rec-1',
})

function previewOf(text: string): string {
  const flat = text.trim().replace(/\s+/g, ' ')
  return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Recommend a model and effort level for a prompt: /recommend <prompt>',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const text = e.args.trim()
    if (text === '') {
      return { text: 'Usage: /recommend <the prompt you are about to send>' }
    }

    const rules = classify(text)
    let tier: Tier = rules.tier
    let decidedBy: Recommendation['decidedBy'] = 'rules'

    // Only spend tokens when the rules are unsure. classify() sends the prompt
    // as data with a fixed classifier prompt, at the engine's small model.
    if (rules.isAmbiguous) {
      try {
        const label = await $.model.classify(text, Object.keys(TIEBREAK_LABELS), {
          model: 'haiku',
        })
        const picked = label === undefined ? undefined : TIEBREAK_LABELS[label]
        if (picked) {
          tier = picked
          decidedBy = 'haiku'
        } else {
          decidedBy = 'rules (Haiku unavailable)'
        }
      } catch {
        // Network error, no credentials, etc.: fall back to the rule answer.
        decidedBy = 'rules (Haiku unavailable)'
      }
    }

    const result: Recommendation = {
      ...rules,
      tier,
      effort: TIERS[tier].effort,
      modelLabel: TIERS[tier].label,
      decidedBy,
      preview: previewOf(text),
    }
    await update($, rec, () => result)

    const why = result.reasons.length ? result.reasons.join('; ') : 'no clear signals'
    return {
      text: [
        `Recommended: ${result.modelLabel} at ${result.effort} effort (decided by ${decidedBy}).`,
        `Signals: ${why}. Rule score: ${result.score}.`,
        'Tip: switching models mid-conversation restarts the prompt cache, so apply this when starting the task.',
      ].join('\n'),
    }
  })

  // A normal prompt (not a slash command) means you've acted on the advice:
  // clear the band so stale advice doesn't linger.
  on('prompt.submit', async ($, e, next) => {
    if (!e.command && (await read($, rec)) !== null) {
      await update($, rec, () => null)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, rec)
    if (current === null || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const reason = current.reasons[0] ?? 'no clear signals'

    return (
      <Box flexDirection="row" gap={1}>
        <Text>
          <Text bold>
            ▸ {current.modelLabel} · {current.effort} effort
          </Text>
          <Text dimColor>
            {' '}— {reason} ({current.decidedBy}) for "{current.preview}"
          </Text>
        </Text>
        <Button key="dismiss" label="Dismiss" onPress={() => update($, rec, () => null)} />
      </Box>
    )
  })
}
