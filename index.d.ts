import type { Context } from '@deepseek-ai/cordis'

export const name: string
export interface Config {
  providers: string[]
  models: string[]
  subject: string
  scanChars: number
}
export const Config: unknown
export function apply(ctx: Context, config: Config): void
