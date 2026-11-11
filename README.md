# dsh-gateway-identity-compat

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) plugin that rewrites second-person identity sentences in the system prompt, for example `You are an AI agent powered by DeepSeek Harness.`, into a third-person form (`This agent is an AI agent powered by DeepSeek Harness.`).

## Why

Some OpenAI/Anthropic-compatible gateways normalize "identity declarations" in the system prompt (`You are X, an assistant built by Y`) and substitute their own identity. dsh's default prompt contains two such sentences, and the second one embeds a model id with a dot (`gemini-3.8-flash-high`), which can leave a mangled, duplicated identity in the upstream request. One affected upstream answered every request that carried the dsh tool set with `429 RESOURCE_EXHAUSTED` while quota was available. The same request with the identity openers rewritten completed normally.

The plugin changes only the opener of sentences that look like identity declarations. Tools, rules, runtime context and the rest of the prompt are untouched.

## What it rewrites

Within the first `scanChars` characters of the assembled prompt, a sentence is rewritten when it starts with `You are`, `You're`, `I am`, `I'm` or `Act as` at a sentence or line start, and the rest of the sentence either names an agent/assistant/tool/bot or carries an attribution phrase (`built by`, `powered by`, `based on`, `running inside`, `integrated into`, ...).

- `You are expected to run the tests.` stays as is.
- Fenced and inline code is never touched.
- Decimals inside model ids do not end a sentence.
- It is idempotent.

## Install

```sh
dsh plugin --profile <name> add github:kim1232aa/dsh-gateway-identity-compat#<commit>
```

The package is plain ESM with no build step. Pin a commit: installing from git runs package code on your machine. With pnpm >= 10 you may need to allow the package in the profile's `pnpm-workspace.yaml` if it asks.

The package declares `dsh.bundle`, so the install also adds this row to the profile:

```yaml
- id: gateway-identity-compat
  name: dsh-gateway-identity-compat
```

## Configuration

Override the row in the profile's `cordis.patch.yml`; a patch replaces a row's whole `config`.

| Field | Default | Meaning |
|---|---|---|
| `providers` | `[]` | Provider-id globs (`*` wildcard, case-insensitive). Empty applies to every provider. |
| `models` | `[]` | Model-id globs. Empty applies to every model. |
| `subject` | `This agent is` | Replacement for the opener. |
| `scanChars` | `1500` | Leading characters of the assembled prompt that are scanned. |

Restrict it to one route, for example:

```yaml
- id: gateway-identity-compat
  name: dsh-gateway-identity-compat
  config:
    models: ['gemini-*']
```

## Tests

```sh
npm test                                   # unit tests, no dependencies
DSH_BIN=/path/to/dsh node test/e2e.mjs     # real dsh + local mock endpoint
```

`test/e2e.mjs` installs a copy of the package into a throwaway `DSH_HOME` profile, runs a headless task against a local mock Messages endpoint, and checks the system prompt that reached it, including that a non-matching `providers` filter leaves the prompt unchanged. Verified with dsh `0.2.2-rc.1`.

## Limits

- It cannot guarantee any gateway's behavior; it only removes the sentence shapes known to be rewritten.
- It rewrites prompt sections only, not runtime context blocks.
- Only the dsh hook `system-prompt/assemble` is used; if a future dsh changes its default prompt wording, the heuristics still apply to the new wording.

## License

MIT
