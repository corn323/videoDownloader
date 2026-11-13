import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUTPUT = path.join(ROOT, 'THIRD_PARTY_LICENSES.md')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function findLicenseFile(directory) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'COPYING.md']) {
    const candidate = path.join(directory, name)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function installed(name) {
  const directory = path.join(ROOT, 'node_modules', name)
  const manifestPath = path.join(directory, 'package.json')
  if (!fs.existsSync(manifestPath)) return null
  const manifest = readJson(manifestPath)
  const licenseFile = findLicenseFile(directory)
  return {
    name,
    version: manifest.version,
    license: manifest.license ?? manifest.licenses ?? 'See package',
    text: licenseFile ? fs.readFileSync(licenseFile, 'utf8').trim() : null
  }
}

function codeBlock(text) {
  return `\`\`\`\`text\n${text.replace(/\r\n/g, '\n')}\n\`\`\`\``
}

const runtime = ['react', 'react-dom', 'zod', 'gsap', 'electron']
const buildTools = [
  'electron-builder',
  'electron-vite',
  'vite',
  'typescript',
  'eslint',
  'vitest',
  'archiver',
  '@cyclonedx/cyclonedx-npm'
]

const sections = []

sections.push(`# 第三方元件授權

Vela 本體以 MIT 授權釋出。以下列出隨應用程式散布或於建置時使用的主要第三方元件。
本文件不構成法律意見；如要再散布，請自行確認各元件的完整授權條款。

## 隨應用程式散布的元件
`)

for (const name of runtime) {
  const pkg = installed(name)
  if (!pkg) continue
  if (name === 'gsap') {
    sections.push(`### GSAP ${pkg.version}

授權：GreenSock Standard "no charge" License
<https://gsap.com/standard-license>

GSAP 依其標準授權免費提供使用；此授權與 Vela 的 MIT 授權不同，GSAP 的著作權與授權條款仍屬 GreenSock, Inc.。
`)

    continue
  }
  const text = pkg.text ? `\n\n<details>\n<summary>授權全文</summary>\n\n${codeBlock(pkg.text)}\n\n</details>` : ''
  sections.push(`### ${pkg.name} ${pkg.version}

授權：${pkg.license}${text}
`)
}

sections.push(`### Electron / Chromium 內含元件

Electron 以 MIT 授權釋出，Chromium 與其相依元件包含多種開源授權。安裝檔與可攜版內附：

- \`LICENSE.electron.txt\`
- \`LICENSES.chromium.html\`

請以散布檔案中的完整授權文字為準。
`)

sections.push(`### yt-dlp

- 專案：<https://github.com/yt-dlp/yt-dlp>
- 授權：Unlicense
- 散布形式：\`resources/bin/yt-dlp.exe\`（官方 release，下載時以官方 \`SHA2-256SUMS\` 驗證 SHA256）

Unlicense 將作品釋出至公眾領域；在不受法律允許的司法管轄區，則授予任意用途的授權。
`)

sections.push(`### FFmpeg（LGPL build）

- 專案：<https://ffmpeg.org/>
- 建置來源：<https://github.com/BtbN/FFmpeg-Builds>（\`ffmpeg-master-latest-win64-lgpl.zip\`）
- 授權：LGPL-2.1-or-later
- 散布形式：\`resources/bin/ffmpeg.exe\`、\`resources/bin/ffprobe.exe\`
- 授權全文：散布檔案中的 \`FFMPEG_LICENSE.txt\`

此為獨立執行程式（separate process），Vela 透過命令列參數呼叫，不靜態連結 FFmpeg 程式庫。
若需對應的 FFmpeg 原始碼，請參考上述官方專案與 BtbN 建置儲存庫。
`)

sections.push(`## 僅於建置時使用的工具
`)

const buildLines = []
for (const name of buildTools) {
  const pkg = installed(name)
  if (pkg) buildLines.push(`- ${pkg.name} ${pkg.version} — ${pkg.license}`)
}
sections.push(`${buildLines.join('\n')}

這些工具不會以原始形式隨應用程式散布；其授權條款仍適用於對應的建置產物與原始碼。
`)

sections.push(`## 商標

Vela 的名稱、圖示與介面不包含任何影音平台的商標或標誌。文中提及的平台名稱僅用於描述相容性，所有商標屬各自所有人。
`)

fs.writeFileSync(OUTPUT, `${sections.join('\n')}\n`, 'utf8')
console.log(`[licenses] wrote ${path.relative(ROOT, OUTPUT)}`)
