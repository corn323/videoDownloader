import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const RELEASE_DIR = path.join(ROOT, 'release')
const NOTES_FILE = path.join(RELEASE_DIR, 'RELEASE_NOTES.md')

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const version = packageJson.version
const tag = process.env.GITHUB_REF_NAME || `v${version}`

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return ''
  }
}

const previousTag = git(['describe', '--tags', '--abbrev=0', 'HEAD^'])
const range = previousTag ? `${previousTag}..HEAD` : 'HEAD'
const rawLog = git(['log', range, '--pretty=format:%s|%h'])

const groups = new Map([
  ['feat', { title: '新功能', items: [] }],
  ['fix', { title: '修正', items: [] }],
  ['perf', { title: '效能', items: [] }],
  ['security', { title: '安全性', items: [] }],
  ['docs', { title: '文件', items: [] }],
  ['refactor', { title: '重構', items: [] }],
  ['build', { title: '建置與發行', items: [] }],
  ['other', { title: '其他', items: [] }]
])

for (const line of rawLog.split(/\r?\n/)) {
  if (!line.trim()) continue
  const [subject = '', hash = ''] = line.split('|')
  if (/^chore\(release\)/i.test(subject) || /^Merge /i.test(subject)) continue
  const match = /^([a-zA-Z]+)(?:\([^)]*\))?(!)?:\s+(.+)$/.exec(subject)
  if (!match) {
    groups.get('other').items.push(`${subject} (${hash})`)
    continue
  }
  const type = match[1].toLowerCase()
  const breaking = match[2] ? ' **BREAKING**' : ''
  const item = `${match[3]}${breaking} (${hash})`
  groups.get(groups.has(type) ? type : 'other').items.push(item)
}

function readBinaryVersions() {
  try {
    const versions = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources', 'bin', 'VERSIONS.json'), 'utf8'))
    return [
      versions.ytDlp?.version ? `- yt-dlp: ${versions.ytDlp.version}` : null,
      versions.ffmpeg?.version ? `- ffmpeg: ${versions.ffmpeg.version} (LGPL)` : null
    ]
      .filter(Boolean)
      .join('\n')
  } catch {
    return '- 未找到 binaries metadata'
  }
}

function readChecksums() {
  try {
    return fs.readFileSync(path.join(RELEASE_DIR, 'SHA256SUMS.txt'), 'utf8').trim()
  } catch {
    return '（未產生）'
  }
}

const binaryVersions = readBinaryVersions()
const checksums = readChecksums()

const sections = []
for (const group of groups.values()) {
  if (group.items.length === 0) continue
  sections.push(`### ${group.title}\n${group.items.map((item) => `- ${item}`).join('\n')}`)
}
if (sections.length === 0) sections.push('### 變更\n- 首個版本。')

const notes = `# Vela ${version}

Windows x64 桌面影音下載工具。此版本由 \`${tag}\` 建置。

## 變更

${sections.join('\n\n')}

## 內建引擎

${binaryVersions}

## 安裝

- **安裝檔**：\`Vela-${version}-Setup.exe\`，支援選擇安裝資料夾與建立捷徑。
- **可攜版**：\`Vela-${version}-win-x64-portable.zip\`，解壓後執行 \`Vela/啟動.bat\` 或 \`Vela/Vela.exe\`。
- 需要 Windows 10/11 x64。未簽章版本可能被 SmartScreen 或 Smart App Control 阻擋；請勿關閉系統保護，請自行評估來源與雜湊後再執行。

## 驗證

每個發行檔案都應符合 \`SHA256SUMS.txt\`；此版本也提供 CycloneDX SBOM（\`bom.json\`）與 GitHub Artifact Attestation。

\`\`\`text
${checksums}
\`\`\`

## 授權與限制

- Vela 本體以 MIT 授權釋出；第三方元件授權見 \`THIRD_PARTY_LICENSES.md\`。
- 僅限下載你擁有權利、已獲授權、屬公眾領域或平台允許下載的內容。
- 不支援 DRM、付費牆繞過或帳號共享。
- 本專案與任何影音平台無關聯；所有商標屬各自所有人。
`

fs.mkdirSync(RELEASE_DIR, { recursive: true })
fs.writeFileSync(NOTES_FILE, notes, 'utf8')
console.log(`[release-notes] wrote ${path.relative(ROOT, NOTES_FILE)}`)
