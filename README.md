# Vela

Vela 是一個 Windows 優先的桌面影音下載工具：貼上連結、解析影片資訊、選擇畫質或僅音訊，然後加入下載佇列。介面以繁體中文為預設，也提供 English。

Vela 是獨立開發的通用工具，**與任何影音平台及其母公司無關聯**。所有平台名稱與商標屬各自所有人。

## 功能

- 貼上網址後自動解析，支援單一影片與播放清單。
- 可選影片畫質、容器（MP4 / WebM / MKV）、字幕語言。
- 僅音訊模式（MP3 / M4A / Opus）。
- 多下載佇列：暫停、繼續、取消、重試、開啟輸出資料夾。
- 批次貼上多個連結（每次最多 50 個）。
- 檔名範本、下載資料夾、同時下載數、介面語言與主題設定。
- 使用 yt-dlp 解析與下載；更新 yt-dlp 前驗證官方 SHA256。
- 可匯入自己的 Netscape `cookies.txt`，以作業系統加密儲存。
- 無遙測、無帳號、資料留在本機。

## 系統需求

- Windows 10 或 Windows 11，x64。
- 安裝檔或可攜版已包含 yt-dlp 與 LGPL 版 ffmpeg/ffprobe，不需要另外安裝。
- 需要可連線至網際網路才能解析與下載。

## 下載與啟動

從 GitHub Releases 取得：

- **安裝檔**：`Vela-<version>-Setup.exe`
- **可攜版**：`Vela-<version>-win-x64-portable.zip`
- `SHA256SUMS.txt`、`bom.json`（CycloneDX SBOM）與 Artifact Attestation

可攜版解壓後，資料夾結構如下：

```text
Vela/
  Vela.exe
  啟動.bat
  resources/
    bin/
      yt-dlp.exe
      ffmpeg.exe
      ffprobe.exe
```

`啟動.bat` 只會：

1. 對 `Vela/` 內的檔案執行 PowerShell `Unblock-File`（解除從網路下載的封鎖）。
2. 啟動同資料夾的 `Vela.exe`。

它不會修改登錄檔、不會關閉防毒或系統安全功能，也不會要求系統管理員權限。

### 關於 SmartScreen / Smart App Control

目前發行版本預設**沒有程式碼簽章**。Windows SmartScreen、Smart App Control 或 Device Guard 可能顯示警告，甚至完全封鎖 `Vela.exe` 或 Electron 的輔助程式。這是系統保護機制，不建議關閉。若你無法確認發行檔案的來源與 SHA256，請不要執行。

若有簽章需求，請在具備憑證的環境自行簽章，或使用專案提供的簽章建置流程。

## 使用方式

1. 貼上影片、播放清單或貼文連結；也可按「貼上」讀取剪貼簿。
2. 等待解析完成，選擇下載模式、畫質、容器、字幕。
3. 播放清單可勾選要下載的項目。
4. 按「下載」加入佇列。
5. 在佇列中暫停、繼續、取消、重試，或完成後開啟資料夾。

僅限下載你擁有版權、已取得授權、屬於公眾領域，或平台服務條款允許下載的內容。Vela **不支援 DRM**，也不會嘗試繞過付費牆、登入限制或帳號共享機制。

## 隱私與安全

- 所有解析、下載與檔案寫入都在本機進行；沒有遙測、分析或遠端帳號。
- Renderer 啟用 `contextIsolation`、`sandbox`，停用 `nodeIntegration`，並套用嚴格 CSP。
- 所有 IPC 皆有 zod 驗證與 sender 檢查；不允許外部導航、開新視窗或 webview。
- 程序以參數陣列啟動，`shell: false`；不接受使用者提供的額外命令列參數。
- 只接受 http/https 網址，封鎖本機、私人網段與保留位址。
- 輸出路徑會檢查是否逃逸下載資料夾。
- Cookies 只在使用者主動匯入時儲存，並以 Electron `safeStorage`（Windows DPAPI）加密。
- yt-dlp 更新僅從官方 GitHub Release 下載，比對 `SHA2-256SUMS` 的 SHA256 後才原子替換。

更多細節與漏洞回報方式見 [SECURITY.md](SECURITY.md)。

## 開發

需要 Node.js 22 以上（建議 24）、npm，以及 Windows x64 環境。

```powershell
npm ci
npm run icon
npm run binaries
npm run dev
```

常用指令：

```powershell
npm run lint
npm run typecheck
npm test
npm run build:app
npm run package:portable
npm run build
```

- `npm run binaries`：從官方 GitHub Release 下載 yt-dlp 與 BtbN LGPL ffmpeg，並以官方 checksum 驗證 SHA256。
- `npm run dev`：啟動 Electron 開發模式。
- `npm run build`：型別檢查、打包 renderer/main/preload，並產生 NSIS 安裝檔、可攜 zip、SBOM 與 `SHA256SUMS.txt`。
- `npm run package:portable`：只產生 `release/win-unpacked` 與可攜 zip，適合本機驗證或無法執行 NSIS 輔助程序的環境。

完整發行流程會執行 NSIS 建置，過程中 electron-builder 會執行暫存的 uninstaller 輔助程式。若你的環境（例如 Device Guard / Smart App Control）禁止執行未簽章輔助程式，NSIS 階段可能失敗；請在 CI 或受控的簽章環境建置。

### 目錄結構

```text
src/
  main/        Electron 主程序、IPC、佇列、更新器與安全防護
  preload/     最小化的 contextBridge API
  renderer/    React 介面、i18n、GSAP 動效
  shared/      型別、zod schema、URL/路徑/檔名/進度與授權核心
resources/
  bin/         建置時下載的 yt-dlp、ffmpeg、ffprobe（不進 git）
  啟動.bat     可攜版啟動工具
scripts/       圖示、binary 下載、打包、SBOM、授權與 release notes
test/          Vitest 單元測試
```

## 發行與驗證

Release 由 GitHub Actions 在 Windows runner 建置，流程包含：

1. `npm ci`、lint、typecheck、Vitest。
2. 下載並驗證 yt-dlp 與 LGPL ffmpeg。
3. 建置 NSIS 安裝檔與可攜 zip。
4. 產生 CycloneDX SBOM、`SHA256SUMS.txt`、Conventional Commits 更新日誌。
5. 產生 GitHub Artifact Attestation 並建立 Release。

驗證下載檔案：

```powershell
Get-FileHash .\Vela-<version>-Setup.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

也可使用 GitHub CLI 驗證 attestation：

```powershell
gh attestation verify .\Vela-<version>-Setup.exe --repo <owner>/<repo>
```

程式碼簽章由 Secrets 注入，預設關閉；未設定憑證時建置會跳過簽章。

## 授權

Vela 本體以 [MIT](LICENSE) 授權釋出。第三方元件與內建引擎的授權見 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。

使用前請閱讀 [DISCLAIMER.md](DISCLAIMER.md)。本專案不提供法律意見。
