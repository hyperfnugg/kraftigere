// e2e runs on several workers, each against its own stack: Auth, Firestore and functions
// emulators, a fake Oda (fake-oda.mjs) and the app's production build on `vite preview`, which
// costs a test's browser far less to load than the dev server's unbundled modules. Stack i takes
// the ports of firebase.test.json, 5273 and 8866, each plus i, so stack 0 is where e2e always ran
// and `npm run dev` keeps its own ports.
//
// Run as a script (playwright.config.ts does), it starts them all at once and opens READY_URL
// once every one answers. Ctrl-C (SIGINT) stops them.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const STACKS = Number(process.env.E2E_STACKS ?? 2)
export const READY_URL = 'http://127.0.0.1:4299/'

const root = fileURLToPath(new URL('../..', import.meta.url))
const testConfig = JSON.parse(readFileSync(`${root}/firebase.test.json`, 'utf8'))

export function stack(i) {
  const port = (name) => testConfig.emulators[name].port + i
  return {
    baseURL: `http://localhost:${5273 + i}/`,
    vitePort: 5273 + i,
    fakeOdaPort: 8866 + i,
    authHost: `127.0.0.1:${port('auth')}`,
    firestoreHost: `127.0.0.1:${port('firestore')}`,
    functionsHost: `127.0.0.1:${port('functions')}`,
  }
}

// The firebase.test.json of stack i. Firebase takes the project from the config's folder,
// so it sits beside firebase.test.json (gitignored).
function firebaseConfig(i) {
  if (i === 0) return 'firebase.test.json'
  const emulators = Object.fromEntries(
    Object.entries(testConfig.emulators).map(([name, value]) => [
      name,
      typeof value === 'object' && 'port' in value
        ? { ...value, port: value.port + i, ...('websocketPort' in value && { websocketPort: value.websocketPort + i }) }
        : value,
    ]),
  )
  const file = `firebase.test.${i}.json`
  writeFileSync(`${root}/${file}`, JSON.stringify({ ...testConfig, emulators }, null, 2))
  return file
}

// The app finds its emulators through these.
const viteEnv = (s) => ({
  VITE_AUTH_EMULATOR_HOST: s.authHost,
  VITE_FIRESTORE_EMULATOR_HOST: s.firestoreHost,
  VITE_FUNCTIONS_EMULATOR_HOST: s.functionsHost,
})

function start() {
  const build = spawnSync('tsc -b functions', { shell: true, stdio: 'inherit', cwd: root })
  if (build.status !== 0) process.exit(build.status ?? 1)

  // Each command runs in its own process group, which gets one SIGINT on stopping: a shell
  // doesn't pass it on to what it runs, and a second one makes the Firebase CLI quit before it
  // stops its emulators. Exits once every command has stopped.
  const children = []
  let stopping = false
  const stop = (code) => {
    if (stopping) return
    stopping = true
    for (const child of children) {
      try {
        process.kill(-child.pid, 'SIGINT')
      } catch {
        // Already stopped.
      }
    }
    Promise.all(children.map((c) => c.exitCode !== null || new Promise((r) => c.on('exit', r)))).then(() =>
      process.exit(code),
    )
  }
  const run = (command, env) => {
    const child = spawn(command, {
      shell: true,
      detached: true,
      stdio: 'inherit',
      cwd: root,
      env: { ...process.env, ...env },
    })
    child.on('exit', (code) => {
      if (stopping) return
      console.error(`e2e stack stopped early (${code}): ${command}`)
      stop(1)
    })
    children.push(child)
  }
  process.on('SIGINT', () => stop(0))
  process.on('SIGTERM', () => stop(0))

  for (let i = 0; i < STACKS; i++) {
    const s = stack(i)
    run('node tests/e2e/fake-oda.mjs', { FAKE_ODA_PORT: String(s.fakeOdaPort) })
    run(
      `firebase emulators:exec --config ${firebaseConfig(i)} --project demo-kraftigere --only auth,firestore,functions ` +
        `"node scripts/seed.mjs && vite build --mode e2e --outDir dist-e2e/${i} --logLevel warn && ` +
        `vite preview --mode e2e --outDir dist-e2e/${i} --port ${s.vitePort} --strictPort"`,
      {
        ...viteEnv(s),
        // e2e drives the AI stubs, even when functions/.env.local turns real Gemini on for
        // `npm run dev`. The function talks to the fake Oda, never oda.com.
        AI_STUBS: '1',
        ODA_BASE_URL: `http://127.0.0.1:${s.fakeOdaPort}`,
      },
    )
  }

  const urls = Array.from({ length: STACKS }, (_, i) => stack(i).baseURL)
  const answers = (url) => fetch(url).then((res) => res.ok, () => false)
  ;(async () => {
    while (!(await Promise.all(urls.map(answers))).every(Boolean)) await new Promise((r) => setTimeout(r, 250))
    createServer((_, res) => res.end('ready')).listen(new URL(READY_URL).port, '127.0.0.1')
    console.log(`e2e: ${STACKS} stacks ready`)
  })()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) start()
