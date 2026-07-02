# 陳龍龍工作室網站專案

這個資料夾放正式網站前台、Apps Script 後端程式與 LINE 圖文選單素材。

## 專案內容

- `01_正式網站檔案/網站原始檔/`：正式網站前台檔案，可直接部署到 Netlify。
- `03_後端程式/`：Google Apps Script 後端程式。
- `04_LINE圖文選單/`：LINE 圖文選單圖片素材。

## 手機訂單後台 PWA

- 後台入口：`/admin.html`
- 前台檔案：`admin.html`、`admin.css`、`admin.js`、`manifest.webmanifest`、`sw.js`
- 訂單狀態：`訂單成立`、`已付款`、`已完成`、`已取消`、`全部`
- `已付款` 是內部後台狀態，不會發客人 LINE，也不會計入會員累積消費；只有 `已完成` 才會計入會員累積並發完成通知。
- 後台密碼不放在前端，請在 Apps Script Script Properties 設定 `ADMIN_PASSWORD_SHA256`。
- Discord Webhook 不放在前端，沿用 Apps Script Script Properties 的 Discord webhook 設定。

## 不放進 Git 的資料

以下內容不要提交到 GitHub：

- `.env`、API Key、Token、Service Account 金鑰
- Discord Webhook
- 銀行帳戶、LINE Pay、街口、無卡等正式收款資料
- 客人個資、訂單匯出、會員匯出
- 本機 Netlify / clasp 登入設定
- 舊備份、交接包、截圖與壓縮檔

正式付款資料請放在 Google 試算表或 Apps Script Script Properties，不要寫死在程式碼中。

## 檢查方式

前台是靜態網站，沒有額外 build 指令。修改後可檢查 JavaScript 語法：

```powershell
node --check "01_正式網站檔案\網站原始檔\app.js"
node --check "01_正式網站檔案\網站原始檔\products.js"
node --check "01_正式網站檔案\網站原始檔\line-config.js"
node --check "01_正式網站檔案\網站原始檔\payment-config.js"
```

後端 Apps Script 可先複製成暫存 `.js` 再檢查語法。

## 多單優惠做法

- 不建議再新增 `8100*3`、`8100*5` 這種優惠包商品。
- 客人選一般 `8100 UC` 或 `8100 三角幣` 後，直接在數量欄輸入 3、5、6，網站會自動依數量計算單價優惠。
- 舊的 `8100*3`、`8100*5` 方案即使還在商品表，網站商品清單也會隱藏，避免客人看到重複選項。
- 優惠價請直接改商品表尾端欄位：`3單起單價`、`5單起單價`、`其他階梯價`。

## 數量階梯價

- PUBGM / 三角洲「上號儲值」的 8100 最大面額可直接用數量折扣。
- 台服與國際上號 8100，原單價 NT$ 2,600；數量 3 起單價 NT$ 2,570，數量 5 起單價 NT$ 2,550。
- 日韓上號 8100 若獨立成一列，原單價 NT$ 2,550；數量 5 起單價 NT$ 2,500。
- UID 儲值不會套用這個預設階梯價。
- 一般只要改 `3單起單價`、`5單起單價`。如果有 6 單、10 單這種特殊級距，可在 `其他階梯價` 填 `6=2530,10=2500`。
- PUBGM 上號舊的 `國際/日韓` 混合方案會在網站拆成 `國際` 與 `日韓`；若商品表已有獨立列，會優先使用獨立列。
