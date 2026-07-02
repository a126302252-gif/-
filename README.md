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

## 新增優惠包方案

- 方案名稱可填像 `台服 8100*3 UC`、`台服 8100*5 UC`。
- 網站會自動顯示成 `台服 8100 UC ×3單優惠`、`台服 8100 UC ×5單優惠`。
- 建議方案ID仍要唯一，例如 `pubgm-login-tw-8100-3`、`pubgm-login-tw-8100-5`。
- 如果不小心複製到相同方案ID，網站會自動分開選項，後端也會優先用方案名稱核對正確價格。
