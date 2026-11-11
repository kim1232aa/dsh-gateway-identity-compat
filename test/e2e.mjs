// End-to-end check against a real dsh install and a local mock Messages endpoint.
// Usage: DSH_BIN=/path/to/dsh node test/e2e.mjs
// Installs a copy of this package into a throwaway DSH_HOME profile, runs one headless
// task, and asserts the system prompt the model route received.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..')
const dsh = process.env.DSH_BIN
if (!dsh) throw new Error('set DSH_BIN to the dsh executable')

const home = mkdtempSync(join(tmpdir(), 'dsh-compat-e2e-'))
const systems = []
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', d => { body += d })
  req.on('end', () => {
    try {
      const j = JSON.parse(body)
      const s = typeof j.system === 'string' ? j.system : (j.system ?? []).map(b => b.text ?? '').join('')
      if (s.includes('Harness')) systems.push(s)
    } catch {}
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end('{"error":{"type":"invalid_request_error","message":"mock"}}')
  })
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

async function run(config) {
  const patch = join(home, 'patch.yml')
  writeFileSync(patch, `- insert:\n    - id: gateway-identity-compat\n      name: dsh-gateway-identity-compat\n${config ? `      config:\n${config}\n` : ''}`)
  systems.length = 0
  // Async spawn: the mock server shares this event loop, so a blocking spawn would deadlock.
  const child = spawn(dsh, ['--profile', 'headless', '--patch', patch, 'say hi'], {
    env: { ...process.env, DSH_HOME: home, DEEPSEEK_API_KEY: 'test', DEEPSEEK_BASE_URL: base },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  const r = { stderr: '' }
  child.stderr.on('data', d => { r.stderr += d })
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000)
  await new Promise(done => child.on('close', done))
  clearTimeout(timer)
  assert.ok(systems.length > 0, `mock received no main-agent request\n${r.stderr}`)
  return systems[0]
}

try {
  // First run creates the profile; then place this package in its node_modules.
  spawnSync(dsh, ['--profile', 'headless', '--help'], { env: { ...process.env, DSH_HOME: home }, encoding: 'utf8' })
  const profile = join(home, 'profiles', 'headless')
  const target = join(profile, 'node_modules', 'dsh-gateway-identity-compat')
  mkdirSync(target, { recursive: true })
  for (const f of ['index.js', 'rewrite.js', 'package.json', 'cordis.patch.yml', 'locale']) cpSync(join(pkg, f), join(target, f), { recursive: true })

  const rewritten = await run('')
  assert.match(rewritten, /^This agent is an AI agent powered by /)
  assert.match(rewritten, /\n\nThis agent is a coding agent powered by the [\w.-]+ model\./)
  assert.doesNotMatch(rewritten, /\bYou are (?:an AI|a coding) agent powered by/)
  assert.match(rewritten, /You are notified in-session/, 'non-identity "You are" must stay')

  const filtered = await run('        providers:\n          - no-such-provider')
  assert.match(filtered, /^You are an AI agent powered by /, 'filtered-out provider must keep the original prompt')
  console.log('e2e ok')
} finally {
  server.close()
  rmSync(home, { recursive: true, force: true })
}
