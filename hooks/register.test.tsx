import { expect, test } from 'claude-code/testing'

// The band above the prompt. Only the terminal and desktop surfaces raise it.
const BAND = {
  plugin: 'prompt-router',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
  },
} as const

// Stand-ins for the engine beneath the mod.
function engine(on: any, haikuAnswer: () => unknown) {
  on('command.register', () => ({ value: { command: 'recommend' } }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('model.classify', haikuAnswer)
  on('prompt.submit', () => ({}))
  // What the engine draws when the mod passes the band on (nothing to show).
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

test('a clear prompt is decided by rules and shown in the band', async ($, on) => {
  let haikuCalls = 0
  engine(on, () => {
    haikuCalls += 1
    return { value: 'simple-quick-task' }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const out = await $.command.run({
    command: 'recommend',
    args: 'compare the approaches for multi-tenant data isolation',
  })
  expect(out.text).toContain('Opus 5.5 at high effort')
  expect(haikuCalls).toBe(0) // rules were confident: no tokens spent

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
    await ui.unmount()
  }
})

test('an ambiguous prompt asks Haiku and uses its pick', async ($, on) => {
  engine(on, () => ({ value: 'complex-reasoning-or-design-task' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const out = await $.command.run({ command: 'recommend', args: 'make it better' })
  expect(out.text).toContain('Opus 5.5')
  expect(out.text).toContain('decided by haiku')
})

test('if Haiku fails, the rule answer stands', async ($, on) => {
  engine(on, () => {
    throw new Error('offline')
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const out = await $.command.run({ command: 'recommend', args: 'make it better' })
  expect(out.text).toContain('Haiku 5.5')
  expect(out.text).toContain('Haiku unavailable')
})

test('an empty /recommend prints usage and shows no band', async ($, on) => {
  engine(on, () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const out = await $.command.run({ command: 'recommend', args: '  ' })
  expect(out.text).toContain('Usage')

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'dismiss' })).toBeUndefined()
  await ui.unmount()
})

test('Dismiss hides the band', async ($, on) => {
  engine(on, () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'recommend', args: 'rename foo to bar' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'dismiss' })
  expect(await ui.find({ type: 'Text', text: /Haiku 5\.5/ })).toBeUndefined()
  await ui.unmount()
})
