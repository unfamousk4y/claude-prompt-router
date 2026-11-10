# prompt-router

A Claude Code mod that recommends a model and effort level for a prompt before you send it.

```
/recommend design the auth architecture for a multi-tenant app
```

shows, in a band above the prompt box:

```
▸ Opus 5.5 · high effort — design, tradeoffs or hard reasoning (rules) for "design the auth architecture for a mul…"
```

It only recommends; it never switches your model.

## How it decides

1. **Rules (free, instant).** Keyword signals add or subtract points: small mechanical tasks (−2), building code (+2), debugging (+2), design and hard reasoning (+6), long-horizon or whole-project work (+6), plus small adjustments for code blocks, several file paths, and prompt length.

   | Score | Recommendation |
   |---|---|
   | 0 or less | Haiku 5.5 · low |
   | 1 – 4 | Sonnet 5.5 · medium |
   | 5 – 9 | Opus 5.5 · high |
   | 10 or more | Fable 5.2 · high |

2. **Haiku tie-breaker (a few hundred tokens).** Only when the rules match no keywords, or match easy and hard signals at once, the mod asks Haiku to pick a tier. If that call fails, the rule answer stands.

The band clears when you press Dismiss or send a normal prompt. Switching models mid-conversation restarts the prompt cache, so the recommendation is best applied when starting a task.

The band shows in the terminal and the desktop app; other surfaces show the command's text reply only.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install prompt-router --marketplace unfamousk4y/claude-prompt-router
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install prompt-router --marketplace unfamousk4y/claude-prompt-router
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `unfamousk4y/claude-prompt-router`, then Add plugin.

## How this was made

I built this with help from Claude (Anthropic's AI model, Claude Opus 5.5) in Claude Code. I decided what the mod should do and made the design choices: recommend-only, a `/recommend` command, rules with a Haiku tie-breaker, and a band above the prompt. Claude wrote the code and tests from those decisions, and I reviewed and tested the result.

## Development

```
claude plugin validate .
claude plugin test .
```
