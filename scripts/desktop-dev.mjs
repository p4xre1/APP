import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

let stopped = false
function stop(code = 0) {
  if (stopped) return
  stopped = true
  if (!vite.killed) vite.kill()
  process.exitCode = code
}
process.on('SIGINT', () => stop(130))
process.on('SIGTERM', () => stop(143))
vite.on('exit', code => { if (!stopped && code) stop(code) })

async function waitForVite() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:5173')
      if (response.ok) return
    } catch { /* The dev server is still starting. */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250))
  }
  throw new Error('Vite did not start in time')
}

try {
  await waitForVite()
  const electron = spawn(process.execPath, [resolve(root, 'node_modules/electron/cli.js'), '.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, FATORATI_DEV_URL: 'http://127.0.0.1:5173' },
  })
  const [code] = await once(electron, 'exit')
  stop(typeof code === 'number' ? code : 1)
} catch (error) {
  console.error(error)
  stop(1)
}
