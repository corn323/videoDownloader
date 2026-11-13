# 第三方元件授權

Vela 本體以 MIT 授權釋出。以下列出隨應用程式散布或於建置時使用的主要第三方元件。
本文件不構成法律意見；如要再散布，請自行確認各元件的完整授權條款。

## 隨應用程式散布的元件

### react 19.3.1

授權：MIT

<details>
<summary>授權全文</summary>

````text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
````

</details>

### react-dom 19.3.1

授權：MIT

<details>
<summary>授權全文</summary>

````text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
````

</details>

### zod 4.6.7

授權：MIT

<details>
<summary>授權全文</summary>

````text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
````

</details>

### GSAP 3.15.1

授權：GreenSock Standard "no charge" License
<https://gsap.com/standard-license>

GSAP 依其標準授權免費提供使用；此授權與 Vela 的 MIT 授權不同，GSAP 的著作權與授權條款仍屬 GreenSock, Inc.。

### electron 45.3.1

授權：MIT

<details>
<summary>授權全文</summary>

````text
Copyright (c) Electron contributors
Copyright (c) 2013-2020 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
````

</details>

### Electron / Chromium 內含元件

Electron 以 MIT 授權釋出，Chromium 與其相依元件包含多種開源授權。安裝檔與可攜版內附：

- `LICENSE.electron.txt`
- `LICENSES.chromium.html`

請以散布檔案中的完整授權文字為準。

### yt-dlp

- 專案：<https://github.com/yt-dlp/yt-dlp>
- 授權：Unlicense
- 散布形式：`resources/bin/yt-dlp.exe`（官方 release，下載時以官方 `SHA2-256SUMS` 驗證 SHA256）

Unlicense 將作品釋出至公眾領域；在不受法律允許的司法管轄區，則授予任意用途的授權。

### FFmpeg（LGPL build）

- 專案：<https://ffmpeg.org/>
- 建置來源：<https://github.com/BtbN/FFmpeg-Builds>（`ffmpeg-master-latest-win64-lgpl.zip`）
- 授權：LGPL-2.1-or-later
- 散布形式：`resources/bin/ffmpeg.exe`、`resources/bin/ffprobe.exe`
- 授權全文：散布檔案中的 `FFMPEG_LICENSE.txt`

此為獨立執行程式（separate process），Vela 透過命令列參數呼叫，不靜態連結 FFmpeg 程式庫。
若需對應的 FFmpeg 原始碼，請參考上述官方專案與 BtbN 建置儲存庫。

## 僅於建置時使用的工具

- electron-builder 26.18.0 — MIT
- electron-vite 6.0.0 — MIT
- vite 8.3.8 — MIT
- typescript 5.9.3 — Apache-2.0
- eslint 10.14.0 — MIT
- vitest 5.1.0 — MIT
- archiver 8.0.0 — MIT
- @cyclonedx/cyclonedx-npm 7.0.0 — Apache-2.0

這些工具不會以原始形式隨應用程式散布；其授權條款仍適用於對應的建置產物與原始碼。

## 商標

Vela 的名稱、圖示與介面不包含任何影音平台的商標或標誌。文中提及的平台名稱僅用於描述相容性，所有商標屬各自所有人。

