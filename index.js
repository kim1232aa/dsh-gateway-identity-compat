import Schema from '@deepseek-ai/schemastery'
import { matchesAny, rewriteIdentity } from './rewrite.js'

export const name = 'dsh-gateway-identity-compat'

export const Config = Schema.object({
  providers: Schema.array(Schema.string()).default([]).description('Provider-id globs this applies to; empty applies to every provider.'),
  models: Schema.array(Schema.string()).default([]).description('Model-id globs this applies to; empty applies to every model.'),
  subject: Schema.string().default('This agent is').description('Replacement for the second-person identity opener ("You are").'),
  scanChars: Schema.number().default(1500).description('Only the first N characters of the assembled prompt are rewritten; gateways normally scan a bounded window.'),
})

export function apply(ctx, config) {
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembly = await next()
    const selection = context.modelSelection
    if (!matchesAny(selection?.provider, config.providers) || !matchesAny(selection?.model, config.models)) return assembly
    let budget = config.scanChars
    const sections = assembly.sections.map((section) => {
      if (budget <= 0) return section
      const { text, count } = rewriteIdentity(section.text, { subject: config.subject, budget })
      budget -= section.text.length
      return count === 0 ? section : { ...section, text }
    })
    return { ...assembly, sections }
  })
}
