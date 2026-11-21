# FinPulse Pro · Google Drive 雲端硬碟直接讀寫設定指南

為了讓你的 GitHub Pages 靜態網站能夠在**完全免後端伺服器、完全免費**的前提下，直接在手機與電腦之間讀寫 Google 雲端硬碟中的帳目檔案（`FinPulse_Pro_Cloud_Sync.json`），只需在 Google Cloud Console 免費建立一組 **OAuth 2.0 Client ID**（約 2 分鐘完成）：

## 步驟 1：建立 Google Cloud 專案並啟用 Drive API
1. 前往 [Google Cloud Console](https://console.cloud.google.com/) 並登入你的 Google 帳號。
2. 點擊上方專案選單 → **「新增專案 (New Project)」**，輸入名稱（例如 `FinPulse-Sync`）並建立。
3. 在左側選單點選 **「API 和服務 (APIs & Services)」→「已啟用的 API 和服務」**，點擊上方的 **「+ 啟用 API 和服務」**。
4. 搜尋 **`Google Drive API`**，點進去後按 **「啟用 (Enable)」**。

## 步驟 2：設定 OAuth 同意畫面（測試版自己用無需審核）
1. 左側選單點選 **「OAuth 同意畫面 (OAuth consent screen)」**。
2. 選擇 **「外部 (External)」** → 點擊建立。
3. 填寫「應用程式名稱」（如 `FinPulse Pro`）與你的 Email，一路按「儲存並繼續」。
4. 到 **「測試使用者 (Test users)」** 頁面時，點擊 **「+ ADD USERS」**，把**你自己的 Gmail 地址**加進去並儲存（這樣無需提交 Google 公開審核即可永久自己使用）。

## 步驟 3：取得 OAuth 用戶端 ID (Client ID)
1. 左側選單點選 **「憑證 (Credentials)」** → 點擊上方 **「+ 建立憑證」→「OAuth 用戶端 ID」**。
2. 應用程式類型選擇 **「網頁應用程式 (Web application)」**。
3. 在 **「已授權的 JavaScript 來源 (Authorized JavaScript origins)」** 點擊新增 URI，填入你的 GitHub Pages 網域（**注意：只填網域，不要加後面的 `/倉庫名/`**）：
   * 例如：`https://你的帳號.github.io`
   * （若你也會在電腦本機測試，可順便加 `http://localhost` 或 `http://127.0.0.1`）
4. 點擊「建立」，複製產生的 **`用戶端編號`（結尾為 `.apps.googleusercontent.com`）**。

## 步驟 4：貼入 FinPulse Pro 開始同步
1. 打開你的 FinPulse Pro 網站 → 點擊頂部的 **「☁️ 設定雲端」**（或進入「平台設定」頁面）。
2. 貼上剛剛複製的 `Client ID` 並按「儲存設定」。
3. 點擊 **「☁️⬆ 上傳並覆寫至雲端」**，登入你的 Google 帳號並允許權限，系統即會在你的雲端硬碟根目錄建立 **`FinPulse_Pro_Cloud_Sync.json`**。
4. 之後在手機或另一台電腦開啟網站時，同樣貼入這組 `Client ID`，按 **「☁️⬇ 從雲端讀取並還原」** 即可完成跨裝置同步！