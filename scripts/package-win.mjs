import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { ZipArchive } from 'archiver'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(import.meta.dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')
const UNPACKED_DIR = path.join(RELEASE_DIR, 'win-unpacked')
const BUILD_ICON = path.join(ROOT, 'build', 'icon.ico')
const LAUNCHER = path.join(ROOT, 'resources', '啟動.bat')
const BIN_DIR = path.join(ROOT, 'resources', 'bin')
const PORTABLE_ONLY = process.argv.includes('--portable-only')

function fail(message) {
  console.error(`\n[package] ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    ...options
  })
  if (result.error) fail(result.error.message)
  if (result.status !== 0) fail(`${path.basename(command)} exited with code ${result.status}`)
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

async function createPortableZip(version) {
  const outputPath = path.join(RELEASE_DIR, `Vela-${version}-win-x64-portable.zip`)
  await fsp.rm(outputPath, { force: true })

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })
    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(UNPACKED_DIR, 'Vela')
    void archive.finalize()
  })

  console.log(`[package] portable zip: ${path.basename(outputPath)}`)
  return outputPath
}

function generateSbom() {
  const cli = path.join(ROOT, 'node_modules', '@cyclonedx', 'cyclonedx-npm', 'bin', 'cyclonedx-npm-cli.js')
  if (!fs.existsSync(cli)) {
    console.warn('[package] cyclonedx-npm is not installed; skipping SBOM')
    return null
  }
  const outputPath = path.join(RELEASE_DIR, 'bom.json')
  run(process.execPath, [cli, '--omit', 'dev', '--output-file', outputPath, '--output-format', 'json'])
  console.log('[package] SBOM: release/bom.json')
  return outputPath
}

function writeChecksums(files) {
  const lines = files
    .filter((file) => fs.existsSync(file))
    .map((file) => `${sha256(file)}  ${path.basename(file)}`)
    .sort()
  const target = path.join(RELEASE_DIR, 'SHA256SUMS.txt')
  fs.writeFileSync(target, `${lines.join('\n')}\n`, 'utf8')
  console.log(`[package] checksums: release/SHA256SUMS.txt (${lines.length} files)`)
}

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const version = packageJson.version

for (const required of ['yt-dlp.exe', 'ffmpeg.exe', 'ffprobe.exe']) {
  if (!fs.existsSync(path.join(BIN_DIR, required))) {
    fail(`missing resources/bin/${required}; run "npm run binaries" first`)
  }
}
if (!fs.existsSync(BUILD_ICON)) fail('missing build/icon.ico; run "npm run icon" first')
if (!fs.existsSync(LAUNCHER)) fail('missing resources/啟動.bat')

await fsp.rm(RELEASE_DIR, { recursive: true, force: true })
fs.mkdirSync(RELEASE_DIR, { recursive: true })

const env = { ...process.env }
if (!env.CSC_LINK && !env.WIN_CSC_LINK) {
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
}

const builderCli = require.resolve('electron-builder/cli.js')
console.log(`[package] building Vela ${version} for Windows x64...`)
run(
  process.execPath,
  [builderCli, '--win', PORTABLE_ONLY ? 'dir' : 'nsis', '--x64', '--publish', 'never'],
  { env }
)

if (!fs.existsSync(path.join(UNPACKED_DIR, 'Vela.exe'))) {
  fail('electron-builder did not produce release/win-unpacked/Vela.exe')
}
if (!fs.existsSync(path.join(UNPACKED_DIR, '啟動.bat'))) {
  fs.copyFileSync(LAUNCHER, path.join(UNPACKED_DIR, '啟動.bat'))
  console.log('[package] copied launcher into win-unpacked')
}

for (const entry of fs.readdirSync(RELEASE_DIR)) {
  if (entry.endsWith('.nsis.7z')) fs.rmSync(path.join(RELEASE_DIR, entry), { force: true })
}

const sbom = generateSbom()
const portable = await createPortableZip(version)
const setup = path.join(RELEASE_DIR, `Vela-${version}-Setup.exe`)
if (!PORTABLE_ONLY && !fs.existsSync(setup)) {
  fail('electron-builder did not produce the NSIS installer')
}

writeChecksums([PORTABLE_ONLY ? null : setup, portable, sbom].filter(Boolean))
console.log('\n[package] done')
if (!PORTABLE_ONLY) console.log(`  installer: release/${path.basename(setup)}`)
console.log(`  portable:  release/${path.basename(portable)}`)
