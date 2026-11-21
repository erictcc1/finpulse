# FinPulse Pro — AI 協作省 Token 上下文說明書

> **使用方式**：未來你要修改某一個單獨頁面（例如只改 `calculator.html` 或 `holdings.html`）時，**不需要把所有程式碼貼給 AI**。只需複製本檔案內容，並附上你要修改的**那一個檔案**即可大幅節省 Token。

---

## 1. 專案定位與核心規則（請 AI 嚴格遵守）
- **架構**：純前端多頁面模組化靜態網站（可免費託管於 GitHub Pages），共 5 個獨立 HTML 頁面 + 1 個共用核心引擎 `app.js`。
- **樣式與套件**：Tailwind CSS (CDN)、Chart.js（僅 `index.html` 載入）、深色券商終端風格（`#0b0e14` 背景、`#131722` 卡片、`#089981` 漲/入帳綠、`#f23645` 跌/支帳紅）。
- **省雲端流量原則**：所有試算草稿（`simDrafts`）、動態幣別表（`currency_registry_v1`）與匯率表（`fx_rates_v1`）均讀寫於瀏覽器 `localStorage`，不消耗 Google Cloud Firestore 免費讀寫額度。
- **多幣別原則**：
  - 每筆交易與持倉皆保留**原幣別與原幣金額**。
  - 動態幣別表內建 `HKD, USD, AUD, JPY, EUR, CNY, GBP, SGD`，並允許使用者自訂任意新幣別。
  - 若某幣別匯率為 `0` 或未設定，折合基準幣時必須安全顯示 `未設匯率 / 匯率待填`，絕不可出現 `NaN`。
- **換匯與手續費原則**：
  - `type === 'transfer'`（換匯/內部轉帳）精準加減轉出與轉入戶口的原幣餘額，但**不計入**日常收入/支出圖表。
  - 換匯手續費與券商交易手續費獨立記錄（支援自訂扣款戶口與幣別），並累計至獨立的「摩擦成本 KPI」。

---

## 2. 各檔案職責地圖（現在每個頁面在做什麼）

| 檔案名稱 | 頁面代號 (`PAGE_ID`) | 主要職責與包含元件 |
| :--- | :--- | :--- |
| **`app.js`** | 共用核心 | 1. 讀寫 `localStorage` (`finpulse_pro_multicurrency_v2`, `fx_rates_v1`, `currency_registry_v1`)<br>2. 動態渲染頂部導航列、手機底部導航、全域幣別切換（原幣分組 / 折合基準幣）、匯率管理 Modal、頂部 4 大 KPI 卡片<br>3. 提供共用函式：`convertCurrency()`, `formatMoney()`, `getAccountDynamicBalance()`, `calculateAccountDefaultFee()`, `saveDatabase()`, `showToast()` |
| **`index.html`** | `overview` | **資金定位與看盤總覽**：<br>1. 三層資金定位樹（`銀行/平台 App → 細項戶口 → 各幣別可用現金與在途持倉`）<br>2. Chart.js 股市級現金流折線圖/柱狀圖（支援單一原幣過濾與 `7D/30D/ALL`） |
| **`cashflow.html`** | `cashflow` | **現金流記帳與換匯**：<br>1. 表單 A：一般入帳/支帳（自動帶入戶口幣別 + 附加手續費）<br>2. 表單 B：跨幣別換匯轉帳（自動推算成交匯率 + 獨立手續費幣別與扣款戶口）<br>3. 收支與換匯明細流水帳表格 |
| **`holdings.html`** | `holdings` | **已購入持倉管理（國債/定存/期貨/IPO）**：<br>1. 登記開始日、到期日、派息日、息率、孳息率、購入報價、平台手續費與實際購入成本<br>2. 按平台 App（如富達、IB）篩選持倉、到期倒數天數、一鍵「到期結算入帳」 |
| **`calculator.html`** | `calculator` | **事前三情境收益試算機**：<br>1. 選擇擬下單平台自動帶入預設手續費規則，支援 `365天制 / 360美債制`<br>2. 輸入最低/中價值/最高三組利率計算實收淨息與淨年化<br>3. 帶日期暫存至本機草稿清單，支援「一鍵轉為正式持倉」（透過 `localStorage` 傳遞草稿至 `holdings.html`） |
| **`accounts.html`** | `accounts` | **基礎平台與手續費設定**：<br>1. 新增銀行（儲蓄/往來）與投資平台 App（如富達、IB）<br>2. 設定各平台預設固定/最低手續費與費率%，以及 JSON 備份/還原/重置 |

---

## 3. 共用資料結構（`window.db`）

```json
{
  "accounts": [
    {
      "id": "acc_fidelity_usd",
      "category": "broker",
      "institutionName": "富達 Fidelity",
      "subAccountName": "美債與固定收益戶口",
      "currency": "USD",
      "initialBalance": 5400,
      "feeRule": { "flat": 15, "pct": 0.05 }
    }
  ],
  "cashflows": [
    { "id": "cf_01", "accountId": "acc_hsbc_hkd", "type": "income", "category": "薪金收入", "amount": 38000, "fee": 0, "feeCurrency": "HKD", "date": "2026-11-07", "note": "..." },
    { "id": "cf_fx_01", "type": "transfer", "fromAccountId": "acc_hsbc_hkd", "fromAmount": 15560, "fromCurrency": "HKD", "toAccountId": "acc_fidelity_usd", "toAmount": 2000, "toCurrency": "USD", "fxRate": 7.78, "fee": 50, "feeCurrency": "HKD", "feeAccountId": "acc_hsbc_hkd", "date": "2026-11-12", "note": "..." }
  ],
  "holdings": [
    { "id": "hd_01", "accountId": "acc_fidelity_usd", "assetType": "treasury", "name": "US Treasury Note 4.25%", "principal": 20000, "purchasePrice": 98.85, "brokerFee": 15, "actualCost": 19785, "couponRate": 4.25, "yieldRate": 4.68, "startDate": "2026-09-22", "maturityDate": "2027-03-26", "payoutNote": "..." }
  ],
  "simDrafts": [
    { "draftId": "sim_demo_01", "savedDate": "2026-11-19", "accountId": "acc_fidelity_usd", "currency": "USD", "title": "...", "assetType": "treasury", "principal": 50000, "fees": 25, "startDate": "2026-11-21", "targetDate": "2027-05-22", "days": 182, "basis": 360, "rates": { "low": 4.1, "mid": 4.45, "high": 4.8 }, "results": { "netLow": 1011.39, "netMid": 1099.86, "netHigh": 1188.33 } }
  ]
}
```

---

## 4. 省 Token 提問範本（直接複製使用）
> 「請根據 `AI_PROMPT_CONTEXT.md` 的架構與資料欄位，幫我修改 **`[填入檔名，例如 calculator.html]`**，需求如下：`[描述你要改的功能]`。只需輸出修改後的該檔案完整程式碼即可。」