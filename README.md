# 陳龍龍工作室網站專案

這個資料夾放正式網站前台、Apps Script 後端程式與 LINE 圖文選單素材。

## 專案內容

- `01_正式網站檔案/網站原始檔/`：正式網站前台檔案，可直接部署到 Netlify。
- `03_後端程式/`：Google Apps Script 後端程式。
- `04_LINE圖文選單/`：LINE 圖文選單圖片素材。

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
