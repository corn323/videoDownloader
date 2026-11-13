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
const ELECTRON_VERSION = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'node_modules', 'electron', 'package.json'), 'utf8')
).version

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

function readOfficialElectronManifest() {
  const electronChecksumsPath = path.join(ROOT, 'node_modules', 'electron', 'checksums.json')
  if (!fs.existsSync(electronChecksumsPath)) {
    fail(`missing electron checksums manifest: ${electronChecksumsPath}`)
  }
  const manifest = JSON.parse(fs.readFileSync(electronChecksumsPath, 'utf8'))
  const zipName = `electron-v${ELECTRON_VERSION}-win32-x64.zip`
  const expectedHash = manifest[zipName]
  if (typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedHash)) {
    fail(`official checksum for ${zipName} not found in ${electronChecksumsPath}`)
  }
  return { zipName, expectedHash: expectedHash.toLowerCase() }
}

function getElectronZipCandidates(zipName) {
  const candidates = [
    path.join(process.env.LOCALAPPDATA ?? '', 'electron', 'Cache', zipName),
    path.join(process.env.USERPROFILE ?? '', '.cache', 'electron', zipName)
  ]

  const electronCacheRoot = path.join(process.env.LOCALAPPDATA ?? '', 'electron', 'Cache')
  if (fs.existsSync(electronCacheRoot)) {
    for (const entry of fs.readdirSync(electronCacheRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      candidates.push(path.join(electronCacheRoot, entry.name, zipName))
    }
  }

  return [...new Set(candidates.filter(Boolean))]
}

function findVerifiedElectronZip() {
  const { zipName, expectedHash } = readOfficialElectronManifest()
  const checked = []
  for (const candidate of getElectronZipCandidates(zipName)) {
    if (!fs.existsSync(candidate)) continue
    try {
      const hash = sha256(candidate)
      checked.push(`${candidate} (sha256=${hash})`)
      if (hash === expectedHash) return { zipPath: candidate, zipName, expectedHash }
    } catch (error) {
      checked.push(`${candidate} (unreadable: ${error instanceof Error ? error.message : String(error)})`)
    }
  }

  const details = checked.length ? `\nChecked:\n- ${checked.join('\n- ')}` : ''
  fail(
    `could not find a verified ${zipName} in Electron cache.\nExpected SHA256: ${expectedHash}${details}\n` +
      'Restore the official Electron 45.3.1 Windows x64 zip in the local Electron cache, then rerun packaging.'
  )
}

function listZipEntries(zipPath) {
  // Use buffer decoding; tar.exe on Windows may emit non-UTF8 (e.g. CP950/Big5) for non-ASCII names.
  const result = spawnSync('tar.exe', ['-tf', zipPath], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  if (result.error) fail(`failed to inspect ${zipPath}: ${result.error.message}`)
  if (result.status !== 0) {
    const stderr = (result.stderr || Buffer.alloc(0)).toString('utf8')
    const stdout = (result.stdout || Buffer.alloc(0)).toString('utf8')
    fail(`tar.exe could not list ${zipPath}: ${(stderr || stdout).trim()}`)
  }
  const buf = result.stdout || Buffer.alloc(0)
  let text = buf.toString('utf8')
  if (text.includes('\uFFFD')) {
    for (const enc of ['big5', 'cp950', 'utf16le']) {
      try {
        const decoded = new TextDecoder(enc).decode(buf)
        if (!decoded.includes('\uFFFD')) {
          text = decoded
          break
        }
      } catch {
        // ignore unsupported encoding
      }
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter(Boolean)
}

function getRequiredRuntimeEntries(zipEntries) {
  // Files that must exist in the official Electron runtime zip AND in the packaged app output.
  // electron.exe is renamed to Vela.exe and resources/default_app.asar is replaced by resources/app.asar.
  const required = [
    'icudtl.dat',
    'resources.pak',
    'v8_context_snapshot.bin',
    'snapshot_blob.bin',
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
    'd3dcompiler_47.dll',
    'dxcompiler.dll',
    'ffmpeg.dll',
    'vk_swiftshader.dll',
    'vk_swiftshader_icd.json',
    'vulkan-1.dll'
  ]
  const missing = required.filter((entry) => !zipEntries.includes(entry))
  const hasLocales = zipEntries.some((entry) => entry.startsWith('locales/') && entry.endsWith('.pak'))
  if (!hasLocales) missing.push('locales/*.pak')
  if (missing.length > 0) {
    fail(`official Electron runtime zip is missing required entries: ${missing.join(', ')}`)
  }
  return { required, hasLocales: true }
}

function assertRuntimeFile(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`missing required runtime file: ${label} (${filePath})`)
  const stat = fs.statSync(filePath)
  if (!stat.isFile() || stat.size <= 0) {
    fail(`required runtime file is empty or not a file: ${label} (${filePath})`)
  }
}

function verifyUnpackedRuntime(runtimeSpec) {
  console.log(`[package] verifying unpacked Electron runtime in ${UNPACKED_DIR}`)
  for (const relativePath of runtimeSpec.required) {
    assertRuntimeFile(path.join(UNPACKED_DIR, relativePath), relativePath)
  }
  assertRuntimeFile(path.join(UNPACKED_DIR, 'Vela.exe'), 'Vela.exe')
  assertRuntimeFile(path.join(UNPACKED_DIR, 'resources', 'app.asar'), 'resources/app.asar')

  const localesDir = path.join(UNPACKED_DIR, 'locales')
  if (!fs.existsSync(localesDir) || !fs.statSync(localesDir).isDirectory()) {
    fail(`missing required runtime directory: locales (${localesDir})`)
  }
  const localeFiles = fs.readdirSync(localesDir).filter((name) => name.endsWith('.pak'))
  if (localeFiles.length === 0) fail(`missing locale pak files in ${localesDir}`)

  const launcherPath = path.join(UNPACKED_DIR, '啟動.bat')
  assertRuntimeFile(launcherPath, '啟動.bat')

  console.log(`[package] unpacked runtime OK (${runtimeSpec.required.length} files + locales + app.asar + Vela.exe + launcher)`)
}

async function createPortableZip(version, runtimeSpec) {
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
  verifyPortableZip(outputPath, runtimeSpec)
  return outputPath
}

function verifyPortableZip(zipPath, runtimeSpec) {
  const entries = listZipEntries(zipPath)
  const launcherName = path.basename(LAUNCHER).normalize('NFC')
  const expected = [
    'Vela/Vela.exe',
    `Vela/${launcherName}`,
    'Vela/resources/app.asar',
    ...runtimeSpec.required.map((entry) => `Vela/${entry}`)
  ]
  const normalizedEntries = new Set(entries.map((entry) => entry.normalize('NFC')))
  const missing = expected.filter((entry) => !normalizedEntries.has(entry.normalize('NFC')))
  const hasLocales = entries.some((entry) => entry.startsWith('Vela/locales/') && entry.endsWith('.pak'))
  if (!hasLocales) missing.push('Vela/locales/*.pak')
  if (missing.length > 0) {
    fail(`portable zip is missing required runtime entries: ${missing.join(', ')}`)
  }
  console.log(`[package] portable zip verified (${expected.length} required entries + locales)`)
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

const electronZip = findVerifiedElectronZip()
console.log(`[package] verified Electron runtime zip: ${electronZip.zipPath}`)
console.log(`[package] Electron zip SHA256: ${electronZip.expectedHash}`)
const electronZipEntries = listZipEntries(electronZip.zipPath)
const runtimeSpec = getRequiredRuntimeEntries(electronZipEntries)

await fsp.rm(RELEASE_DIR, { recursive: true, force: true })
fs.mkdirSync(RELEASE_DIR, { recursive: true })

const env = { ...process.env }
if (!env.CSC_LINK && !env.WIN_CSC_LINK) {
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
}

const builderCli = require.resolve('electron-builder/cli.js')
console.log(`[package] building Vela ${version} for Windows x64 (Electron ${ELECTRON_VERSION})...`)
run(
  process.execPath,
  [builderCli, '--win', PORTABLE_ONLY ? 'dir' : 'nsis', '--x64', '--publish', 'never'],
  { env }
)

verifyUnpackedRuntime(runtimeSpec)

if (!fs.existsSync(path.join(UNPACKED_DIR, '啟動.bat'))) {
  fs.copyFileSync(LAUNCHER, path.join(UNPACKED_DIR, '啟動.bat'))
  console.log('[package] copied launcher into win-unpacked')
  verifyUnpackedRuntime(runtimeSpec)
}

for (const entry of fs.readdirSync(RELEASE_DIR)) {
  if (entry.endsWith('.nsis.7z')) fs.rmSync(path.join(RELEASE_DIR, entry), { force: true })
}

const sbom = generateSbom()
const portable = await createPortableZip(version, runtimeSpec)
const setup = path.join(RELEASE_DIR, `Vela-${version}-Setup.exe`)
if (!PORTABLE_ONLY && !fs.existsSync(setup)) {
  fail('electron-builder did not produce the NSIS installer')
}

writeChecksums([PORTABLE_ONLY ? null : setup, portable, sbom].filter(Boolean))
console.log('\n[package] done')
if (!PORTABLE_ONLY) console.log(`  installer: release/${path.basename(setup)}`)
console.log(`  portable:  release/${path.basename(portable)}`)