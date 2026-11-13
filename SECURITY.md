# 安全性政策

## 支援版本

僅最新發行版本接受安全性修正。預覽版、自行修改的版本與舊版不保證支援。

## 回報漏洞

請使用 GitHub 儲存庫的 **Security Advisories → Report a vulnerability** 私下回報，不要先公開建立 Issue。

回報時請盡量提供：

- 受影響版本與 Windows 版本。
- 重現步驟或概念驗證。
- 影響範圍（資料外洩、任意程式執行、路徑逃逸、權限提升等）。
- 是否涉及第三方網站、Cookies 或惡意媒體檔。

我們會確認問題、評估影響並在合理時間內修正。請給我們修補與發行前的合理時間，再公開細節。

## 安全設計

Vela 將 renderer 視為不受信任的介面層，將主程序視為唯一可執行特權操作的地方。

### Electron

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `webviewTag: false`
- 正式版停用 DevTools
- 所有 session 權限請求與權限檢查一律拒絕
- 拒絕 `window.open`、外部導航、`will-attach-webview`
- 主視窗載入本機檔案；開發模式僅允許 dev server 同源導航
- 嚴格 CSP（`default-src 'none'`、`object-src 'none'`、`base-uri 'none'`、`form-action 'none'`、`frame-ancestors 'none'`）

### IPC

- 只註冊白名單 channel。
- 所有 payload 使用 zod 驗證；拒絕額外欄位。
- 檢查 sender 必須是目前主視窗的 main frame。
- 錯誤以固定錯誤碼回傳，細節會清理控制字元並截斷。
- Renderer 只能取得 `window.vela` 暴露的最小 API。

### 程序啟動

- 使用 `spawn` / `execFile` 的參數陣列，不拼接 shell 字串。
- `shell: false`。
- 使用者提供的 URL 一律放在 `--` 之後，避免被解讀為 yt-dlp 選項。
- 不接受使用者自訂額外命令列參數。
- 逾時與取消會終止整個程序樹（Windows `taskkill /T`）。

### URL 與網路

- 只允許 `http:` 與 `https:`。
- 拒絕含帳密、控制字元、空白或過長網址。
- 封鎖 localhost、`.local`、`.internal`、`.home.arpa`、雲端 metadata 主機、私人 IPv4/IPv6 與保留位址。
- 縮圖只接受通過驗證的 http/https 公開網址；renderer 以 CSP 限制圖片來源。
- yt-dlp 更新主機有 allowlist，並拒絕非預期重新導向目的地。

### 檔案系統

- 輸出資料夾由使用者選擇，經絕對路徑與控制字元驗證。
- 下載前檢查 yt-dlp 回報的最終路徑必須位於下載資料夾內，否則拒絕。
- 檔名經過 NFKC、控制/雙向字元移除、Windows 保留名稱與非法字元處理。
- 設定檔以原子寫入方式儲存。
- 更新檔先寫入暫存檔、驗證 SHA256，再原子替換；失敗時保留舊版。

### Cookies

- 只接受 Netscape 格式與大小上限內的檔案。
- 內容以 Electron `safeStorage` 加密後存放；Windows 使用 DPAPI。
- 若作業系統不提供加密，Vela 拒絕儲存 Cookies。
- 使用時才解密到暫存檔，下載結束後清除。
- 不蒐集、不儲存、不上傳帳號密碼。

### 更新與供應鏈

- yt-dlp 與 ffmpeg 在建置時從官方 GitHub Release 下載。
- 下載檔以官方 SHA256 checksum 驗證後才使用。
- 內建版本資訊記錄於 `resources/bin/VERSIONS.json`。
- 執行期更新同樣驗證官方 `SHA2-256SUMS`，並限制下載大小與主機。
- GitHub Actions 使用 commit SHA 固定版本。
- Release 產生 CycloneDX SBOM 與 build provenance attestation。

## 不在防護範圍內

- 已遭入侵的作業系統、帳號或瀏覽器設定。
- 使用者自行匯入的惡意 Cookies 檔內容；格式與大小會被驗證，但內容仍來自使用者。
- 惡意網站透過 yt-dlp 觸發的行為；請保持 yt-dlp 更新，並只處理可信連結。
- 未簽章程式在 Windows SmartScreen / Smart App Control / Device Guard 下的封鎖或警告。
- 使用者自行修改、重新打包或關閉系統保護後的行為。
- DRM 內容；Vela 不繞過 DRM。

## 安全設定建議

- 只從官方 Release 下載，並比對 `SHA256SUMS.txt`。
- 保持 Windows 與 yt-dlp 更新。
- 不要關閉 SmartScreen、Smart App Control 或防毒來「讓程式跑起來」。
- 不要使用來源不明的 Cookies 檔。
- 只下載你有權取得的內容。
