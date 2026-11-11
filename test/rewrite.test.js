import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesAny, rewriteIdentity } from '../rewrite.js'

const r = (t, o) => rewriteIdentity(t, o)

test('rewrites attribution identity openers, keeping templates and the rest intact', () => {
  const src = 'You are an AI agent powered by Example Harness.\n\nYou are a coding agent powered by the {{model}} model.\n\nUse tools.'
  const out = r(src)
  assert.equal(out.count, 2)
  assert.equal(out.text, 'This agent is an AI agent powered by Example Harness.\n\nThis agent is a coding agent powered by the {{model}} model.\n\nUse tools.')
})

test('handles contractions, first person, act-as and list markers', () => {
  assert.equal(r("You're a coding assistant running inside tool-x.").text, 'This agent is a coding assistant running inside tool-x.')
  assert.equal(r("I'm an assistant created by Acme.").text, 'This agent is an assistant created by Acme.')
  assert.equal(r('Act as an agent built by Acme.').text, 'This agent acts as an agent built by Acme.')
  assert.equal(r('- You are a helper bot.').text, '- This agent is a helper bot.')
})

test('does not touch ordinary instructions or mid-sentence phrases', () => {
  const src = 'You are expected to run the tests.\nIf you are unsure, ask. Tell the user you are done.'
  assert.deepEqual(r(src), { text: src, count: 0 })
})

test('leaves fenced and inline code untouched', () => {
  const src = 'Example:\n```\nYou are an agent built by Acme.\n```\nSay `You are an agent built by Acme.` verbatim.'
  assert.deepEqual(r(src), { text: src, count: 0 })
})

test('decimals in model ids do not end the sentence', () => {
  assert.equal(r('You are a coding agent powered by the gemini-3.8-flash model.').text, 'This agent is a coding agent powered by the gemini-3.8-flash model.')
})

test('is idempotent', () => {
  const once = r('You are an AI agent powered by Example Harness.').text
  assert.deepEqual(r(once), { text: once, count: 0 })
})

test('budget limits the scanned prefix and custom subject applies', () => {
  const src = 'You are an AI agent powered by A.\n' + 'x'.repeat(50) + '\nYou are an AI agent powered by B.'
  const out = r(src, { budget: 40, subject: 'The assistant is' })
  assert.equal(out.count, 1)
  assert.ok(out.text.startsWith('The assistant is an AI agent powered by A.'))
  assert.ok(out.text.endsWith('You are an AI agent powered by B.'))
})

test('matchesAny', () => {
  assert.equal(matchesAny('x', []), true)
  assert.equal(matchesAny('gemini-3.8-flash', ['gemini-*']), true)
  assert.equal(matchesAny('claude', ['gemini-*']), false)
  assert.equal(matchesAny(undefined, ['a']), false)
  assert.equal(matchesAny('a.b', ['a.b']), true)
  assert.equal(matchesAny('axb', ['a.b']), false)
})
