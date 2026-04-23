import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

function run(label, cwd, command, args) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', shell: true })
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] salió con código ${code}`)
      process.exit(code)
    }
  })
  return child
}

run('backend', path.join(repoRoot, 'backend'), 'npm', ['run', 'dev'])
run('frontend', path.join(repoRoot, 'frontend'), 'npm', ['run', 'dev'])

