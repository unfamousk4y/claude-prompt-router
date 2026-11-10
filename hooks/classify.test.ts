import { expect, test } from 'claude-code/testing'

import { classify } from './classify'

// Real-looking prompts, one per tier, plus the edge cases the rules must not
// mishandle. These test behaviour (which tier a prompt lands in), not weights.

test('a quick mechanical prompt goes to Haiku at low effort', async () => {
  const r = classify('rename the variable foo to bar in utils.ts')
  expect(r.tier).toBe('haiku')
  expect(r.effort).toBe('low')
  expect(r.isAmbiguous).toBe(false)
})

test('a concept lookup goes to Haiku', async () => {
  expect(classify('what is a closure in JavaScript?').tier).toBe('haiku')
})

test('a feature of known size goes to Sonnet at medium effort', async () => {
  const r = classify(
    'Add a dark mode toggle to the settings page and save the choice in localStorage so it persists',
  )
  expect(r.tier).toBe('sonnet')
  expect(r.effort).toBe('medium')
})

test('debugging a pasted error goes to Sonnet', async () => {
  const r = classify(
    'I get this error when I submit the form:\n```\nTypeError: Cannot read properties of undefined\n```',
  )
  expect(r.tier).toBe('sonnet')
})

test('a short design question still reaches Opus', async () => {
  const r = classify('compare the approaches for multi-tenant data isolation')
  expect(r.tier).toBe('opus')
  expect(r.effort).toBe('high')
})

test('design plus whole-project scope goes to Fable', async () => {
  const r = classify(
    'Refactor the architecture of the entire codebase from a monolith to services and plan the migration end-to-end',
  )
  expect(r.tier).toBe('fable')
})

test('repeating a keyword does not inflate the score', async () => {
  const once = classify('fix the bug please now')
  const many = classify('fix the bug bug bug bug bug')
  expect(many.score).toBe(once.score)
})

test('a vague prompt with no signals is flagged ambiguous', async () => {
  const r = classify('make it better')
  expect(r.isAmbiguous).toBe(true)
})

test('easy and hard signals together are flagged ambiguous', async () => {
  const r = classify('rename the folders and refactor the architecture')
  expect(r.isAmbiguous).toBe(true)
})

test('an empty prompt does not throw and is ambiguous', async () => {
  const r = classify('   ')
  expect(r.tier).toBe('haiku')
  expect(r.isAmbiguous).toBe(true)
})
