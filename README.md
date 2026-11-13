# Vela

Vela 是一款 Windows x64 的桌面影音下載工具。貼上網址後可解析影片資訊、選擇畫質或音訊、加入下載佇列，介面以繁體中文為主，設定也可切換 English。

Vela 是獨立的本機應用工具，**不隸屬於任何影音平台或公司**；各平台名稱與標誌屬於各自所有人。

## 下載與發行

正式版本請從 GitHub Releases 下載：
**https://github.com/corn323/videoDownloader/releases/latest**

每個正式版本提供：
- **Windows x64 安裝版**：`Vela-<version>-Setup.exe`（NSIS）
- **Windows x64 Portable 可攜版**：`Vela-<version>-win-x64-portable.zip`
- **校驗檔**：`SHA256SUMS.txt`
- **Release Notes**：`RELEASE_NOTES.md`（含於 Release 頁面/附件流程）
- **SBOM**：`bom.json`（CycloneDX）
- **Build Provenance**：GitHub Artifact Attestation

解壓可攜版後，資料夾結構如下：

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

`啟動.bat` 會：
1. 在 `Vela/` 資料夾內對檔案執行 PowerShell `Unblock-File`（解除網路下載封鎖標記）。
2. 啟動同資料夾的 `Vela.exe`。

它不修改登錄檔、不關閉防毒或系統安全功能，也不需要系統管理員權限。

### 關於 SmartScreen / Smart App Control

本專案未提供簽章憑證時，Windows SmartScreen 或 Smart App Control / Device Guard 可能顯示警告並阻擋執行。請確認下載來源與 SHA256 後再自行評估是否執行。

## 功能

- 貼上網址後自動解析支援的影音或播放清單
- 可選影片畫質、容器（MP4 / WebM / MKV）、字幕語言
- 音訊模式（MP3 / M4A / Opus）
- 多下載佇列：暫停、繼續、取消、重試、開啟輸出資料夾
- 一次貼上多個網址（每次最多 50 個）
- 檔名範本、下載資料夾、並行下載數、介面語言與主題設定
- 使用 yt-dlp 下載並可更新 yt-dlp（含 SHA256 驗證）
- 可匯入 Netscape `cookies.txt`（以作業系統安全儲存保護）
- 本機執行、無帳號、無遙測、不含雲端帳號

## 系統需求
- Windows 10 或 Windows 11，x64
- 安裝檔/可攜版已內含 yt-dlp 與 LGPL ffmpeg/ffprobe
- 需要可用的網路連線以解析與下載

## 使用方式

1. 貼上影片或播放清單網址（可用「貼上」讀取剪貼簿）。
2. 等待解析完成，選擇下載模式、畫質、容器、字幕。
3. 在清單中勾選要下載的項目。
4. 按「下載」加入佇列。
5. 於佇列中暫停、繼續、取消、重試或開啟檔案所在資料夾。

請僅下載你有權、已授權或屬於公眾領域/平台條款允許的內容。Vela **不支援 DRM**，且不嘗試繞過付費牆、登入限制或帳號共享機制。

## 安全設計
- 解析、下載與檔案寫入皆在本機；無遙測、無雲端帳號。
- Renderer 使用 `contextIsolation` 與 `sandbox`，無 `nodeIntegration`，並套用 CSP。
- IPC 以 zod 驗證與 sender 檢查；不允許外部導航與新視窗/webview。
- 程式以參數陣列執行外部程序（`shell: false`）；不使用使用者提供的額外命令參數。
- 僅接受 http/https 網址，拒絕本機、私人網段與保留位址。
- 輸出路徑檢查避免路徑逸出下載資料夾。
- Cookies 僅在使用時解密並以 Electron `safeStorage`（Windows DPAPI）保護。
- yt-dlp 更新從官方 GitHub Release 下載並驗證 `SHA2-256SUMS`。

詳細弱點回報方式見 [SECURITY.md](SECURITY.md)。

## 開發

需要 Node.js 22+（建議 24）、npm，Windows x64。

```powershell
npm ci
npm run icon
npm run binaries
npm run dev
```

常用命令：
```powershell
npm run lint
npm run typecheck
npm test
npm run build:app
npm run package:portable
npm run build
```

- `npm run binaries`：下載並驗證 yt-dlp 與 BtbN LGPL ffmpeg。
- `npm run dev`：啟動 Electron 開發模式。
- `npm run build`：型別檢查、建置 app、產生 NSIS/portable、SBOM 與 `SHA256SUMS.txt`（含 runtime 完整性檢查）。
- `npm run package:portable`：僅產生 portable unpacked/zip。

### 專案結構

```text
src/
  main/        Electron 主程序、IPC、下載/更新/安全
  preload/     contextBridge API
  renderer/    React 介面、i18n、GSAP
  shared/      schema、URL/路徑/檔名/參數/型別
resources/
  bin/         建置時下載的 yt-dlp/ffmpeg/ffprobe
  啟動.bat     可攜版啟動工具
scripts/       binary 下載、打包、SBOM、release notes
test/          Vitest 測試
```

## CI 與正式發行

- **CI（`.github/workflows/ci.yml`）**：`main` push、Pull Request 及手動觸發時執行 `npm ci`、lint、typecheck、test、`build:app`。CI 通過 **不代表** 已發布 Release。
- **CodeQL**：依 repo 設定執行。
- **Release（`.github/workflows/release.yml`）**：僅在推送版本 Tag `v*` 或手動 `workflow_dispatch`（指定已存在的 `tag_name`）時執行，且會 checkout 該 Tag 並驗證 Tag 與 `package.json` 版本一致後才建置發布。

### 開發者發布流程（Tag 驅動）
1. 更新 `package.json` 的 `version`。
2. 確認 `main` CI 通過。
3. 建立與版本一致的標註 Tag（例：`0.1.0` → `v0.1.0`）。
4. 推送 Tag。
5. GitHub Actions 自動建置並建立/更新該版本 Release 與附件。
6. 確認 Releases 頁面附件完整（安裝檔、portable zip、`bom.json`、`SHA256SUMS.txt`、`RELEASE_NOTES.md`）。

範例（版本 0.1.0）：
```powershell
git tag -a v0.1.0 -m "Vela v0.1.0"
git push origin v0.1.0
```

> 本次修復僅準備流程與程式，不會自動建立/推送遠端 Tag 或發布正式 Release；請在確認修改與測試後由維護者執行。

驗證下載檔案：
```powershell
Get-FileHash .\Vela-<version>-Setup.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

也可使用 GitHub CLI 驗證 attestation：
```powershell
gh attestation verify .\Vela-<version>-Setup.exe --repo corn323/videoDownloader
```

程式碼簽章由 Secrets 注入；未設定憑證時建置仍可完成（不強制簽章才能發布）。

## 授權

Vela 以 [MIT](LICENSE) 授權釋出；第三方元件與內建二進位授權見 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
使用前請閱讀 [DISCLAIMER.md](DISCLAIMER.md)。本專案不提供法律意見。
