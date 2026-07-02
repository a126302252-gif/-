const SHEET_ID = "1w9dfmvi32CufWhXjcYfXH8RWNM05gkJYXnKavk87XBk";
const SPREADSHEET_NAME = "陳龍龍工作室訂單後台";
const SHEET_NAME = "訂單";
const MEMBER_SHEET_NAME = "會員";
const PRODUCT_SHEET_NAME = "商品";
const GUIDE_SHEET_NAME = "使用說明";
const PAYMENT_REPLY_SHEET_NAME = "付款回覆";
const DEFAULT_ADMIN_BIND_TEXT = "綁定通知";

const SOURCE_ACCOUNTS = {
  dc: {
    sourceName: "小號 DC手遊代儲",
    loginChannelIdKey: "LINE_LOGIN_CHANNEL_ID_DC",
    channelAccessTokenKey: "LINE_CHANNEL_ACCESS_TOKEN_DC",
    legacyLoginChannelIdKey: "LINE_LOGIN_CHANNEL_ID",
    legacyChannelAccessTokenKey: "LINE_CHANNEL_ACCESS_TOKEN"
  },
  main: {
    sourceName: "DC手遊代儲官方 LINE",
    loginChannelIdKey: "LINE_LOGIN_CHANNEL_ID_MAIN",
    channelAccessTokenKey: "LINE_CHANNEL_ACCESS_TOKEN_MAIN"
  }
};

const HEADERS = [
  "下單時間",
  "訂單編號",
  "來源帳號",
  "客人LINE名稱",
  "遊戲",
  "代儲內容/點數",
  "數量",
  "單價",
  "總金額",
  "付款方式",
  "遊戲UID",
  "伺服器/區服",
  "訂單狀態",
  "LINE驗證",
  "LINE User ID",
  "備註"
];

const LEGACY_ORDER_HEADERS = [
  "時間",
  "訂單編號",
  "商品",
  "數量",
  "金額",
  "付款方式",
  "遊戲",
  "伺服器",
  "角色UID",
  "驗證狀態",
  "會員來源",
  "LINE名稱",
  "LINE User ID",
  "LINE驗證",
  "備註"
];

const ORDER_STATUS_DEFAULT = "待處理";
const ORDER_COLUMN_WIDTHS = [150, 145, 125, 160, 120, 160, 70, 85, 95, 125, 150, 120, 95, 105, 210, 220];

const MEMBER_HEADERS = [
  "LINE User ID",
  "LINE名稱",
  "頭像",
  "首次綁定",
  "最後下單",
  "最近訂單"
];

const PRODUCT_HEADERS = [
  "啟用",
  "遊戲分類",
  "遊戲ID",
  "遊戲名稱",
  "遊戲圖片網址",
  "方案ID",
  "方案名稱/點數",
  "價格NT$",
  "處理時間",
  "備註"
];

const GUIDE_ROWS = [
  ["你想做的事", "去哪裡改", "怎麼改"],
  ["改商品價格", "商品 分頁", "直接修改「價格NT$」欄位，網站會讀這裡的價格。"],
  ["上架新遊戲", "商品 分頁", "複製一列商品，改遊戲ID、遊戲名稱、方案ID、方案名稱、價格，啟用保持 TRUE。"],
  ["新增同遊戲方案", "商品 分頁", "複製同一個遊戲的一列，只改方案ID、方案名稱、價格、處理時間。"],
  ["更換遊戲圖片", "商品 分頁", "把圖片連結貼到「遊戲圖片網址」欄位；同一款遊戲每列貼同一張即可。"],
  ["暫時下架商品", "商品 分頁", "把該列「啟用」改成 FALSE，網站就不會顯示。"],
  ["看客人訂單", "訂單 分頁", "新訂單會自動出現在最下面，包含訂單編號、LINE名稱、商品、金額、付款方式。"],
  ["看會員資料", "會員 分頁", "這裡會記錄登入過的 LINE 會員與最近訂單。"],
  ["不要改的欄位", "商品 分頁", "遊戲ID、方案ID 可以看成系統代號；如果不熟，新增時用英文小寫與數字，例如 pubgm-60。"]
];

const PRODUCT_HEADER_NOTES = [
  "TRUE 表示上架，FALSE 表示下架。",
  "例如 PUBGM、米哈遊、國際遊戲。",
  "同一款遊戲請用同一個英文代號，例如 pubgm。",
  "網站遊戲選單顯示的名稱，例如 PUBGM。",
  "貼公開圖片網址；不填也可以。",
  "每個方案要不一樣，例如 pubgm-60。",
  "客人看到的方案名稱，例如 60 UC。",
  "這格就是網站價格，只填數字。",
  "例如 10-30 分鐘、確認後處理。",
  "給自己看的備註或顯示在方案上的小備註。"
];

const PAYMENT_REPLY_HEADERS = [
  "付款方式",
  "啟用",
  "客人收到的自動回覆文字"
];

const PAYMENT_REPLY_ROWS = [
  ["網銀", true, "請依客服提供的銀行帳號完成匯款，付款後回傳帳號末五碼與訂單編號給客服核對。"],
  ["無卡", true, "請向客服索取無卡存款資料，完成後將收據照片與訂單編號傳給客服核對。"],
  ["LINE Pay", true, "請向客服索取 LINE Pay 付款資訊，完成後將付款截圖與訂單編號傳給客服核對。"],
  ["街口", true, "請向客服索取街口支付資訊，完成後將付款截圖與訂單編號傳給客服核對。"]
];

const PRODUCT_SEED_ROWS = [
  [true, "國際遊戲", "pubgm", "PUBGM", "國際服", "熱門", "P", "pink", "PUBGM UC 代儲，送單後依訂單資料核對處理。", "", "pubgm-60", "60 UC", 45, "10-30 分鐘", "入門方案"],
  [true, "國際遊戲", "pubgm", "PUBGM", "國際服", "熱門", "P", "pink", "PUBGM UC 代儲，送單後依訂單資料核對處理。", "", "pubgm-325", "325 UC", 230, "10-30 分鐘", "常用方案"],
  [true, "國際遊戲", "pubgm", "PUBGM", "國際服", "熱門", "P", "pink", "PUBGM UC 代儲，送單後依訂單資料核對處理。", "", "pubgm-660", "660 UC", 450, "10-30 分鐘", "熱門方案"],
  [true, "國際遊戲", "pubgm", "PUBGM", "國際服", "熱門", "P", "pink", "PUBGM UC 代儲，送單後依訂單資料核對處理。", "", "pubgm-1800", "1800 UC", 1180, "10-30 分鐘", "高額方案"],
  [true, "國際遊戲", "pubgm", "PUBGM", "國際服", "熱門", "P", "pink", "PUBGM UC 代儲，送單後依訂單資料核對處理。", "", "pubgm-3850", "3850 UC", 2480, "確認後處理", "大額方案"],
  [true, "國際遊戲", "pubgm", "PUBGM", "國際服", "熱門", "P", "pink", "PUBGM UC 代儲，送單後依訂單資料核對處理。", "", "pubgm-8100", "8100 UC", 4980, "確認後處理", "大額方案"],
  [true, "米哈遊", "genshin", "原神", "台港澳 / 國際", "米哈遊", "原", "mint", "原神創世結晶與月卡代儲，請確認 UID 與伺服器。", "", "genshin-60", "60 創世結晶", 55, "10-30 分鐘", "入門方案"],
  [true, "米哈遊", "genshin", "原神", "台港澳 / 國際", "米哈遊", "原", "mint", "原神創世結晶與月卡代儲，請確認 UID 與伺服器。", "", "genshin-300", "300+30 創世結晶", 260, "10-30 分鐘", "常用方案"],
  [true, "米哈遊", "genshin", "原神", "台港澳 / 國際", "米哈遊", "原", "mint", "原神創世結晶與月卡代儲，請確認 UID 與伺服器。", "", "genshin-980", "980+110 創世結晶", 790, "10-30 分鐘", "熱門方案"],
  [true, "米哈遊", "genshin", "原神", "台港澳 / 國際", "米哈遊", "原", "mint", "原神創世結晶與月卡代儲，請確認 UID 與伺服器。", "", "genshin-card", "小月卡", 150, "10-30 分鐘", "月卡"],
  [true, "米哈遊", "hsr", "崩壞：星穹鐵道", "國際服", "原石", "鐵", "blue", "星穹鐵道古老夢華代儲，請確認 UID 與伺服器。", "", "hsr-60", "60 古老夢華", 55, "10-30 分鐘", "入門方案"],
  [true, "米哈遊", "hsr", "崩壞：星穹鐵道", "國際服", "原石", "鐵", "blue", "星穹鐵道古老夢華代儲，請確認 UID 與伺服器。", "", "hsr-300", "300+30 古老夢華", 260, "10-30 分鐘", "常用方案"],
  [true, "米哈遊", "hsr", "崩壞：星穹鐵道", "國際服", "原石", "鐵", "blue", "星穹鐵道古老夢華代儲，請確認 UID 與伺服器。", "", "hsr-980", "980+110 古老夢華", 790, "10-30 分鐘", "熱門方案"],
  [true, "米哈遊", "hsr", "崩壞：星穹鐵道", "國際服", "原石", "鐵", "blue", "星穹鐵道古老夢華代儲，請確認 UID 與伺服器。", "", "hsr-pass", "列車補給憑證", 150, "10-30 分鐘", "月卡"],
  [true, "米哈遊", "zzz", "絕區零", "國際服", "新作", "零", "yellow", "絕區零菲林代儲，請確認帳號資料。", "", "zzz-60", "60 菲林", 55, "10-30 分鐘", "入門方案"],
  [true, "米哈遊", "zzz", "絕區零", "國際服", "新作", "零", "yellow", "絕區零菲林代儲，請確認帳號資料。", "", "zzz-300", "300+30 菲林", 260, "10-30 分鐘", "熱門方案"],
  [true, "米哈遊", "zzz", "絕區零", "國際服", "新作", "零", "yellow", "絕區零菲林代儲，請確認帳號資料。", "", "zzz-980", "980+110 菲林", 790, "10-30 分鐘", "高額方案"],
  [true, "米哈遊", "zzz", "絕區零", "國際服", "新作", "零", "yellow", "絕區零菲林代儲，請確認帳號資料。", "", "zzz-card", "月卡", 150, "10-30 分鐘", "月卡"],
  [true, "國際遊戲", "mlbb", "Mobile Legends", "國際服", "鑽石", "M", "purple", "Mobile Legends 鑽石代儲，請確認遊戲 ID。", "", "mlbb-86", "86 鑽石", 70, "10-30 分鐘", "入門方案"],
  [true, "國際遊戲", "mlbb", "Mobile Legends", "國際服", "鑽石", "M", "purple", "Mobile Legends 鑽石代儲，請確認遊戲 ID。", "", "mlbb-172", "172 鑽石", 135, "10-30 分鐘", "常用方案"],
  [true, "國際遊戲", "mlbb", "Mobile Legends", "國際服", "鑽石", "M", "purple", "Mobile Legends 鑽石代儲，請確認遊戲 ID。", "", "mlbb-257", "257 鑽石", 200, "10-30 分鐘", "熱門方案"],
  [true, "國際遊戲", "mlbb", "Mobile Legends", "國際服", "鑽石", "M", "purple", "Mobile Legends 鑽石代儲，請確認遊戲 ID。", "", "mlbb-706", "706 鑽石", 530, "10-30 分鐘", "高額方案"],
  [true, "國服", "hok", "王者榮耀", "國服", "點券", "王", "orange", "王者榮耀點券代儲，國服訂單請先確認資料。", "", "hok-60", "60 點券", 35, "確認後處理", "入門方案"],
  [true, "國服", "hok", "王者榮耀", "國服", "點券", "王", "orange", "王者榮耀點券代儲，國服訂單請先確認資料。", "", "hok-300", "300 點券", 170, "確認後處理", "常用方案"],
  [true, "國服", "hok", "王者榮耀", "國服", "點券", "王", "orange", "王者榮耀點券代儲，國服訂單請先確認資料。", "", "hok-680", "680 點券", 380, "確認後處理", "熱門方案"],
  [true, "國服", "hok", "王者榮耀", "國服", "點券", "王", "orange", "王者榮耀點券代儲，國服訂單請先確認資料。", "", "hok-1980", "1980 點券", 1090, "確認後處理", "高額方案"]
];

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.action === "products") {
    return jsonpResponse_(params.callback, {
      ok: true,
      data: getProductData_()
    });
  }

  if (params.action === "order") {
    try {
      const data = JSON.parse(params.payload || "{}");
      return jsonpResponse_(params.callback, saveOrderPayload_(data));
    } catch (error) {
      return jsonpResponse_(params.callback, { ok: false, error: String(error) });
    }
  }

  return jsonpResponse_(params.callback, {
    ok: true,
    backendVersion: "20260625-multi-oa",
    name: "陳龍龍工作室訂單後台",
    verifyMode: "line",
    lineMode: isLineMessagingConfigured_() ? "configured" : "not_configured",
    loginMode: isLineLoginConfigured_() ? "configured" : "not_configured",
    accounts: {
      dc: {
        lineMode: getLineAccessToken_("dc") ? "configured" : "not_configured",
        loginMode: getLineLoginChannelId_("dc") ? "configured" : "not_configured"
      },
      main: {
        lineMode: getLineAccessToken_("main") ? "configured" : "not_configured",
        loginMode: getLineLoginChannelId_("main") ? "configured" : "not_configured"
      }
    }
  });
}

function doPost(e) {
  const raw = (e && e.postData && e.postData.contents) || "{}";

  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.events)) {
      return handleLineWebhook_(data);
    }
    return saveOrder_(data);
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  }
}

function setupSheet() {
  getOrderSheet_();
  getMemberSheet_();
  getProductSheet_();
  getPaymentReplySheet_();
  getGuideSheet_();
}

function setupOrderSheet() {
  getOrderSheet_();
}

function setupProductSheet() {
  getProductSheet_();
}

function authorizeExternalRequest() {
  return authorizeExternalRequest_();
}

function authorizeExternalRequest_() {
  const response = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "post",
    payload: {
      id_token: "authorization-test",
      client_id: "authorization-test"
    },
    muteHttpExceptions: true
  });

  return `外部連線權限已可使用，測試狀態碼：${response.getResponseCode()}`;
}

function saveOrder_(data) {
  return jsonResponse_(saveOrderPayload_(data));
}

function saveOrderPayload_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sourceAccount = getSourceAccount_(data.sourceAccount || data.memberSource);
    const sourceName = getOrderSourceName_(sourceAccount);
    const member = getVerifiedLineMember_(data, sourceAccount);
    if (!member.verified || !member.userId) {
      return {
        ok: false,
        error: "LINE_MEMBER_REQUIRED",
        message: "請先使用 LINE 會員登入後再下單。"
      };
    }

    const product = findProductPlan_(data.gameId, data.planId, data.gameName, data.productName);
    if (!product) {
      return {
        ok: false,
        error: "PRODUCT_NOT_FOUND",
        message: "商品或方案不存在，請重新整理網站後再下單。"
      };
    }

    const quantity = normalizeQuantity_(data.quantity);
    const pricing = calculateProductOrderPricing_(product, quantity);
    const safeOrder = Object.assign({}, data, {
      orderId: cleanOrderId_(data.orderId) || createOrderId_(),
      sourceAccount,
      sourceName,
      memberSource: sourceAccount,
      gameName: product.gameName,
      productName: product.planName,
      quantity,
      unitPrice: pricing.unitPrice,
      total: pricing.total
    });

    const sheet = getOrderSheet_();
    const verification = "LINE會員";

    sheet.appendRow([
      new Date(),
      safeOrder.orderId,
      sourceName,
      member.displayName || "",
      safeOrder.gameName || "",
      safeOrder.productName || "",
      safeOrder.quantity || "",
      safeOrder.unitPrice || "",
      safeOrder.total || "",
      safeOrder.payment || "",
      safeOrder.playerId || "",
      safeOrder.serverName || "",
      ORDER_STATUS_DEFAULT,
      "已驗證",
      member.userId || "",
      safeOrder.notes || ""
    ]);

    upsertMember_(member, safeOrder.orderId);
    const notification = safelySendLineOrderNotifications_(safeOrder, member, verification);

    return {
      ok: true,
      orderId: safeOrder.orderId,
      lineVerified: true,
      notificationOk: notification.ok,
      notificationError: notification.error || "",
      total: safeOrder.total,
      payment: safeOrder.payment,
      productName: safeOrder.productName,
      gameName: safeOrder.gameName,
      quantity: safeOrder.quantity,
      source: sourceName
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error),
      message: `後端寫入失敗：${getSafeErrorMessage_(error)}`
    };
  } finally {
    lock.releaseLock();
  }
}

function handleLineWebhook_(payload) {
  const bindText = getAdminBindText_();
  const events = payload.events || [];

  events.forEach((event) => {
    if (event.type !== "message" || !event.message || event.message.type !== "text") return;

    const text = String(event.message.text || "").trim();
    if (text === bindText && event.source && event.source.userId) {
      replyLineText_(
        event.replyToken,
        "管理員訂單通知已改用內部 Discord，不再使用官方 LINE 推播。"
      );
      return;
    }

    if (text === "測試通知") {
      replyLineText_(event.replyToken, "LINE 訂單通知功能正常。");
    }
  });

  return jsonResponse_({ ok: true });
}

function getVerifiedLineMember_(data, sourceAccount) {
  const member = {
    userId: cleanLineValue_(data.lineUserId),
    displayName: cleanLineValue_(data.lineDisplayName),
    pictureUrl: cleanLineValue_(data.linePictureUrl),
    verified: false
  };

  const accessToken = cleanTokenValue_(data.lineAccessToken);
  if (accessToken) {
    const verifiedByAccessToken = verifyLineAccessToken_(accessToken);
    if (verifiedByAccessToken.ok) {
      if (member.userId && member.userId !== verifiedByAccessToken.userId) return member;
      member.userId = verifiedByAccessToken.userId;
      member.displayName = verifiedByAccessToken.displayName || member.displayName;
      member.pictureUrl = verifiedByAccessToken.pictureUrl || member.pictureUrl;
      member.verified = true;
      return member;
    }
  }

  const idToken = cleanTokenValue_(data.lineIdToken);
  if (!idToken) return member;

  const verified = verifyLineIdToken_(idToken, sourceAccount);
  if (!verified.ok) return member;

  if (member.userId && member.userId !== verified.userId) return member;

  member.userId = verified.userId;
  member.displayName = verified.displayName || member.displayName;
  member.pictureUrl = verified.pictureUrl || member.pictureUrl;
  member.verified = true;
  return member;
}

function verifyLineAccessToken_(accessToken) {
  const response = UrlFetchApp.fetch("https://api.line.me/v2/profile", {
    method: "get",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || "{}");
  if (statusCode >= 200 && statusCode < 300 && body.userId) {
    return {
      ok: true,
      userId: body.userId,
      displayName: body.displayName || "",
      pictureUrl: body.pictureUrl || ""
    };
  }

  return { ok: false, statusCode, message: body.message || "LINE access token verify failed" };
}

function verifyLineIdToken_(idToken, sourceAccount) {
  const channelId = getLineLoginChannelId_(sourceAccount);
  if (!channelId) return { ok: false, message: "LINE_LOGIN_CHANNEL_ID not configured" };

  const response = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "post",
    payload: {
      id_token: idToken,
      client_id: channelId
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || "{}");
  if (statusCode >= 200 && statusCode < 300 && body.sub) {
    return {
      ok: true,
      userId: body.sub,
      displayName: body.name || "",
      pictureUrl: body.picture || ""
    };
  }

  return { ok: false, statusCode, message: body.error_description || body.error || "LINE ID token verify failed" };
}

function sendLineOrderNotifications_(order, member, verification) {
  const sourceAccount = getSourceAccount_(order.sourceAccount || order.memberSource);
  const sourceName = getOrderSourceName_(sourceAccount);
  const paymentReply = getPaymentReplyText_(order.payment, order);
  const fallbackCustomerText = [
    "✅ 訂單已成立",
    "",
    `訂單編號：${order.orderId || ""}`,
    `商品：${order.gameName || ""}｜${order.productName || ""} ×${order.quantity || 1}`,
    `UID：${order.playerId || ""}`,
    `區服：${order.serverName || ""}`,
    "",
    `付款方式：${order.payment || ""}`,
    `金額：NT$ ${order.total || ""}`,
    "",
    paymentReply || "請依付款方式完成付款。",
    "",
    "付款完成請直接回傳官方 LINE，人工審核後會盡快處理。"
  ].join("\n");
  const customerText = typeof buildOrderPaymentMessage_ === "function"
    ? buildOrderPaymentMessage_(
      SpreadsheetApp.openById(SHEET_ID),
      order,
      verification || {}
    )
    : fallbackCustomerText;

  pushLineText_(member.userId, customerText, sourceAccount);

  if (typeof safelySendDiscordStandalone_ === "function") {
    safelySendDiscordStandalone_("new_order", Object.assign({}, order, {
      sourceName: sourceName,
      paymentStatus: "未付款"
    }), member, {
      detail: "網站訂單已建立"
    });
  }
}

function safelySendLineOrderNotifications_(order, member, verification) {
  try {
    sendLineOrderNotifications_(order, member, verification);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: getSafeErrorMessage_(error)
    };
  }
}

function pushLineText_(to, text, sourceAccount) {
  return pushLineTexts_(to, [text], sourceAccount);
}

function pushLineTexts_(to, texts, sourceAccount) {
  const messages = (texts || [])
    .map(function (text) {
      return String(text || "").trim();
    })
    .filter(Boolean)
    .slice(0, 5)
    .map(function (text) {
      return { type: "text", text: truncateLineText_(text) };
    });
  if (!messages.length) return { ok: true, statusCode: 200, body: "" };
  return sendLineRequest_("https://api.line.me/v2/bot/message/push", {
    to,
    messages
  }, sourceAccount);
}

function replyLineText_(replyToken, text, sourceAccount) {
  if (!replyToken) return;
  return sendLineRequest_("https://api.line.me/v2/bot/message/reply", {
    replyToken,
    messages: [{ type: "text", text: truncateLineText_(text) }]
  }, sourceAccount || "dc");
}

function sendLineRequest_(url, payload, sourceAccount) {
  const token = getLineAccessToken_(sourceAccount);
  if (!token) return { ok: false, message: "LINE_CHANNEL_ACCESS_TOKEN not configured" };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  return {
    ok: statusCode >= 200 && statusCode < 300,
    statusCode,
    body: response.getContentText()
  };
}

function getSafeErrorMessage_(error) {
  return String((error && error.message) || error || "unknown error").slice(0, 300);
}

function upsertMember_(member, orderId) {
  const sheet = getMemberSheet_();
  const lastRow = sheet.getLastRow();
  let row = 0;

  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let index = 0; index < ids.length; index += 1) {
      if (ids[index][0] === member.userId) {
        row = index + 2;
        break;
      }
    }
  }

  if (!row) {
    sheet.appendRow([
      member.userId,
      member.displayName,
      member.pictureUrl,
      new Date(),
      new Date(),
      orderId
    ]);
    return;
  }

  sheet.getRange(row, 2, 1, 5).setValues([[
    member.displayName,
    member.pictureUrl,
    sheet.getRange(row, 4).getValue() || new Date(),
    new Date(),
    orderId
  ]]);
}

function isLineMessagingConfigured_() {
  return Boolean(getLineAccessToken_("dc"));
}

function isLineLoginConfigured_() {
  return Boolean(getLineLoginChannelId_("dc"));
}

function getSourceAccount_(value) {
  if (isMainSourceValue_(value)) return "main";
  return "dc";
}

function isMainSourceValue_(value) {
  const source = String(value || "").trim().toLowerCase();
  const compact = source.replace(/\s+/g, "");
  return [
    "main",
    "cll",
    "official",
    "陳龍龍工作室",
    "本號陳龍龍工作室",
    "dc手遊代儲官方line",
    "dc手遊代儲官方賴"
  ].indexOf(compact) >= 0;
}

function getLineAccessToken_(sourceAccount) {
  const config = SOURCE_ACCOUNTS[getSourceAccount_(sourceAccount)] || SOURCE_ACCOUNTS.dc;
  return getScriptProperty_(config.channelAccessTokenKey)
    || (config.legacyChannelAccessTokenKey ? getScriptProperty_(config.legacyChannelAccessTokenKey) : "");
}

function getLineLoginChannelId_(sourceAccount) {
  const config = SOURCE_ACCOUNTS[getSourceAccount_(sourceAccount)] || SOURCE_ACCOUNTS.dc;
  return getScriptProperty_(config.loginChannelIdKey)
    || (config.legacyLoginChannelIdKey ? getScriptProperty_(config.legacyLoginChannelIdKey) : "");
}

function getAdminBindText_() {
  return getScriptProperty_("LINE_ADMIN_BIND_TEXT") || DEFAULT_ADMIN_BIND_TEXT;
}

function getOwnerNotifySource_() {
  return getSourceAccount_(getScriptProperty_("LINE_OWNER_NOTIFY_SOURCE") || "dc");
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || "";
}

function cleanLineValue_(value) {
  return String(value || "").trim().slice(0, 500);
}

function cleanTokenValue_(value) {
  return String(value || "").trim().slice(0, 5000);
}

function truncateLineText_(text) {
  const value = String(text || "");
  return value.length > 4500 ? `${value.slice(0, 4500)}...` : value;
}

function normalizeQuantity_(value) {
  const quantity = Number(value || 1);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(20, Math.max(1, Math.floor(quantity)));
}

function parseQuantityTierRules_(note) {
  const text = String(note || "");
  if (!/(階梯價|數量優惠|tier|bulk)\s*[:：]/i.test(text)) return [];
  const rules = [];
  const regex = /(\d+)\s*(?:單|件|個|組|起)?\s*(?:=|:|：)\s*(?:NT\$?\s*)?([\d,]+)/gi;
  let match = null;
  while ((match = regex.exec(text))) {
    const minQty = Number(match[1]);
    const unitPrice = Number(String(match[2] || "").replace(/,/g, ""));
    if (Number.isFinite(minQty) && minQty > 1 && Number.isFinite(unitPrice) && unitPrice > 0) {
      rules.push({ minQty, unitPrice });
    }
  }
  return rules;
}

function getDefaultQuantityTierRules_(product) {
  const gameText = String((product && (product.gameId + " " + product.gameName)) || "").toLowerCase();
  const planName = String((product && product.planName) || "");
  const isLoginTopupPlan = gameText.indexOf("uid") < 0
    && (gameText.indexOf("login") >= 0 || gameText.indexOf("上號") >= 0);
  const is8100Plan = /8100/.test(planName) && !/(?:\*|x|X|×)\s*\d+/.test(planName);
  if (!isLoginTopupPlan || !is8100Plan) return [];
  if (Number(product && product.price || 0) === 2600) return [{ minQty: 3, unitPrice: 2570 }, { minQty: 5, unitPrice: 2550 }];
  if (
    Number(product && product.price || 0) === 2550
    && /日韓/.test(planName)
    && !/國際/.test(planName)
  ) {
    return [{ minQty: 5, unitPrice: 2500 }];
  }
  return [];
}

function getQuantityTierRules_(product) {
  const basePrice = Number(product && product.price || 0);
  const configuredRules = parseQuantityTierRules_(product && product.note);
  const rules = configuredRules.length
    ? configuredRules
    : getDefaultQuantityTierRules_(product);
  return rules
    .filter((rule) => Number(rule.unitPrice) > 0 && Number(rule.unitPrice) < basePrice)
    .sort((a, b) => Number(a.minQty) - Number(b.minQty));
}

function calculateProductOrderPricing_(product, quantity) {
  const count = Math.max(1, Number(quantity || 1));
  const baseUnitPrice = Math.max(0, Number(product && product.price || 0));
  const tier = getQuantityTierRules_(product)
    .filter((rule) => count >= Number(rule.minQty))
    .sort((a, b) => Number(b.minQty) - Number(a.minQty))[0] || null;
  const unitPrice = tier ? Number(tier.unitPrice) : baseUnitPrice;
  return {
    unitPrice,
    total: Math.max(0, Math.round(unitPrice * count))
  };
}

function cleanOrderId_(value) {
  return String(value || "").trim().slice(0, 80);
}

function createOrderId_() {
  const timestamp = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMddHHmmss");
  const random = Math.floor(Math.random() * 900) + 100;
  return `CLL-${timestamp}-${random}`;
}

function getOrderSourceName_(source) {
  const value = String(source || "").trim();
  const normalized = value.toLowerCase();
  if (!value) return "網站自助下單";
  if (isMainSourceValue_(value)) return SOURCE_ACCOUNTS.main.sourceName;
  if (normalized === "dc" || value === "LINE_LIFF") return SOURCE_ACCOUNTS.dc.sourceName;
  if (value === "LINE") return "LINE自助下單";
  return value;
}

function findProductPlan_(gameId, planId, gameName, productName) {
  const data = getProductData_();
  const requestedGameId = String(gameId || "").trim();
  const requestedPlanId = String(planId || "").trim();
  const requestedBasePlanId = requestedPlanId.replace(/__\d+$/, "");
  const requestedGameName = String(gameName || "").trim();
  const requestedProductName = String(productName || "").trim();

  const game = data.games.find((item) => item.id === requestedGameId)
    || data.games.find((item) => item.plans.some((plan) => plan.id === requestedPlanId || plan.sourcePlanId === requestedBasePlanId))
    || data.games.find((item) => item.name === requestedGameName);
  if (!game) return null;

  const plan = game.plans.find((item) => item.name === requestedProductName)
    || game.plans.find((item) => item.id === requestedPlanId)
    || game.plans.find((item) => item.sourcePlanId === requestedBasePlanId);
  if (!plan) return null;

  return {
    gameId: game.id,
    gameName: game.name,
    planId: plan.sourcePlanId || plan.id,
    planName: plan.name,
    price: Number(plan.price || 0),
    note: String(plan.note || "")
  };
}

function getProductData_() {
  const sheet = getProductSheet_();
  const lastRow = sheet.getLastRow();
  const categories = ["所有遊戲"];
  const gameMap = {};

  if (lastRow <= 1) {
    return { categories, games: [] };
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, PRODUCT_HEADERS.length).getValues();

  rows.forEach((row) => {
    const active = row[0] === true || String(row[0]).toUpperCase() === "TRUE" || String(row[0]).trim() === "1" || String(row[0]).trim() === "啟用";
    if (!active) return;

    const category = String(row[1] || "其他").trim();
    const gameId = String(row[2] || "").trim();
    const gameName = String(row[3] || "").trim();
    const imageUrl = String(row[4] || "").trim();
    const planId = String(row[5] || "").trim();
    const planName = String(row[6] || "").trim();
    const price = Number(row[7] || 0);
    const eta = String(row[8] || "確認後處理").trim();
    const note = String(row[9] || "").trim();
    const region = "";
    const badge = "";
    const icon = String(gameName || "G").slice(0, 1);
    const color = "pink";
    const description = `${gameName} ${planName} 代儲`;

    if (!gameId || !gameName || !planId || !planName || !Number.isFinite(price) || price <= 0) return;

    if (!categories.includes(category)) categories.push(category);

    if (!gameMap[gameId]) {
      gameMap[gameId] = {
        id: gameId,
        name: gameName,
        category,
        region,
        badge,
        icon,
        color,
        imageUrl,
        description,
        active: true,
        plans: []
      };
    }

    const duplicateCount = gameMap[gameId].plans.filter((plan) => plan.sourcePlanId === planId || plan.id === planId).length;
    gameMap[gameId].plans.push({
      id: duplicateCount ? `${planId}__${duplicateCount + 1}` : planId,
      sourcePlanId: planId,
      name: planName,
      price,
      eta,
      note,
      active: true
    });
  });

  return {
    categories,
    games: Object.keys(gameMap).map((key) => gameMap[key])
  };
}

function getProductSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(PRODUCT_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PRODUCT_SHEET_NAME);
  }

  migrateProductSheetToSimple_(sheet);
  ensureHeaders_(sheet, PRODUCT_HEADERS, PRODUCT_HEADER_NOTES);

  if (sheet.getLastRow() <= 1) {
    const seedRows = getSimpleProductSeedRows_();
    sheet.getRange(2, 1, seedRows.length, PRODUCT_HEADERS.length).setValues(seedRows);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, PRODUCT_HEADERS.length);
  }

  formatSheetHeader_(sheet, PRODUCT_HEADERS.length, "#111827");
  formatProductSheet_(sheet);

  return sheet;
}

function getPaymentReplyText_(payment, order) {
  const requestedPayment = String(payment || "").trim();
  if (!requestedPayment) return "";

  const sheet = getPaymentReplySheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return "";

  const rows = sheet.getRange(2, 1, lastRow - 1, PAYMENT_REPLY_HEADERS.length).getValues();
  const matched = rows.find((row) => {
    const enabled = row[1] === true
      || String(row[1]).toUpperCase() === "TRUE"
      || String(row[1]).trim() === "1"
      || String(row[1]).trim() === "啟用";
    return enabled && String(row[0] || "").trim() === requestedPayment;
  });

  if (!matched) return "";

  const replacements = {
    "{訂單編號}": order.orderId || "",
    "{遊戲}": order.gameName || "",
    "{方案}": order.productName || "",
    "{金額}": `NT$ ${order.total || ""}`,
    "{付款方式}": order.payment || "",
    "{UID}": order.playerId || ""
  };

  let text = String(matched[2] || "").trim();
  Object.keys(replacements).forEach((key) => {
    text = text.split(key).join(replacements[key]);
  });
  return text;
}

function getPaymentReplySheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(PAYMENT_REPLY_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(PAYMENT_REPLY_SHEET_NAME);
  }

  ensureHeaders_(sheet, PAYMENT_REPLY_HEADERS);
  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, PAYMENT_REPLY_ROWS.length, PAYMENT_REPLY_HEADERS.length).setValues(PAYMENT_REPLY_ROWS);
  }

  formatSheetHeader_(sheet, PAYMENT_REPLY_HEADERS.length, "#075985");
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 620);
  sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), PAYMENT_REPLY_HEADERS.length)
    .setWrap(true)
    .setVerticalAlignment("middle");
  return sheet;
}

function migrateProductSheetToSimple_(sheet) {
  const lastRow = sheet.getLastRow();
  const currentWidth = Math.max(sheet.getLastColumn(), PRODUCT_HEADERS.length);
  const headers = lastRow >= 1
    ? sheet.getRange(1, 1, 1, currentWidth).getValues()[0].map((value) => String(value || "").trim())
    : [];

  const isSimpleSheet = headers[0] === "啟用"
    && headers[3] === "遊戲名稱"
    && headers[6] === "方案名稱/點數"
    && headers[7] === "價格NT$";
  if (isSimpleSheet) return;

  if (lastRow <= 1) {
    sheet.clear();
    return;
  }

  const spreadsheet = sheet.getParent();
  const backupName = `商品_舊版備份_${Utilities.formatDate(new Date(), "Asia/Taipei", "MMddHHmm")}`;
  if (!spreadsheet.getSheetByName(backupName)) {
    sheet.copyTo(spreadsheet).setName(backupName);
  }

  const oldWidth = Math.max(sheet.getLastColumn(), 15);
  const oldRows = sheet.getRange(2, 1, lastRow - 1, oldWidth).getValues();
  const simpleRows = oldRows
    .map((row) => toSimpleProductRow_(row))
    .filter((row) => row.some((value) => value !== "" && value !== false));

  sheet.clear();
  sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length).setValues([PRODUCT_HEADERS]);
  if (simpleRows.length > 0) {
    sheet.getRange(2, 1, simpleRows.length, PRODUCT_HEADERS.length).setValues(simpleRows);
  }
}

function toSimpleProductRow_(row) {
  if (row.length === PRODUCT_HEADERS.length) return row;

  return [
    normalizeProductActive_(row[0]),
    row[1] || "其他",
    row[2] || "",
    row[3] || "",
    row[9] || "",
    row[10] || "",
    row[11] || "",
    row[12] || "",
    row[13] || "確認後處理",
    row[14] || ""
  ];
}

function getSimpleProductSeedRows_() {
  return PRODUCT_SEED_ROWS.map((row) => toSimpleProductRow_(row));
}

function normalizeProductActive_(value) {
  return value === true
    || String(value).toUpperCase() === "TRUE"
    || String(value).trim() === "1"
    || String(value).trim() === "啟用";
}

function formatProductSheet_(sheet) {
  const lastRow = Math.max(1, sheet.getLastRow());
  const widths = [70, 100, 105, 130, 260, 130, 160, 90, 120, 220];
  widths.forEach((width, index) => sheet.setColumnWidth(index + 1, width));
  sheet.getRange(1, 1, lastRow, PRODUCT_HEADERS.length)
    .setWrap(true)
    .setVerticalAlignment("middle");
  try {
    if (!sheet.getFilter()) {
      sheet.getRange(1, 1, lastRow, PRODUCT_HEADERS.length).createFilter();
    }
  } catch (error) {
    // Existing filters are fine.
  }
}

function migrateProductImageColumn_(sheet) {
  const headerWidth = Math.max(sheet.getLastColumn(), PRODUCT_HEADERS.length);
  const headers = sheet.getRange(1, 1, 1, headerWidth).getValues()[0].map((value) => String(value || "").trim());
  if (headers.includes("遊戲圖片網址")) {
    repairProductImageColumnRows_(sheet);
    return;
  }

  const descriptionColumn = (headers.indexOf("網站顯示說明") + 1) || (headers.indexOf("遊戲說明") + 1);
  const oldPlanIdColumn = headers.indexOf("方案ID（英文勿重複）") + 1 || headers.indexOf("方案ID") + 1;
  if (descriptionColumn > 0 && oldPlanIdColumn === descriptionColumn + 1) {
    sheet.insertColumnAfter(descriptionColumn);
  }
}

function repairProductImageColumnRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const range = sheet.getRange(2, 1, lastRow - 1, PRODUCT_HEADERS.length);
  const rows = range.getValues();
  let changed = false;

  const repairedRows = rows.map((row) => {
    const imageValue = String(row[9] || "").trim();
    const planIdValue = String(row[10] || "").trim();
    const expectedPrice = Number(row[12] || 0);
    const shiftedPrice = Number(row[11] || 0);

    if (imageValue && planIdValue && (!Number.isFinite(expectedPrice) || expectedPrice <= 0) && Number.isFinite(shiftedPrice) && shiftedPrice > 0) {
      changed = true;
      return [
        row[0],
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        row[6],
        row[7],
        row[8],
        "",
        row[9],
        row[10],
        row[11],
        row[12],
        row[13]
      ];
    }

    return row;
  });

  if (changed) {
    range.setValues(repairedRows);
  }
}

function getGuideSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(GUIDE_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(GUIDE_SHEET_NAME, 0);
  }

  sheet.clear();
  const guideRows = GUIDE_ROWS.concat([
    ["改付款自動回覆", "付款回覆 分頁", "修改對應付款方式的「客人收到的自動回覆文字」。可使用 {訂單編號}、{遊戲}、{方案}、{金額}、{付款方式}、{UID}。"]
  ]);
  sheet.getRange(1, 1, guideRows.length, guideRows[0].length).setValues(guideRows);
  sheet.setFrozenRows(1);
  formatSheetHeader_(sheet, guideRows[0].length, "#7c2d12");
  sheet.getRange(1, 1, guideRows.length, guideRows[0].length).setWrap(true).setVerticalAlignment("middle");
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 520);
  return sheet;
}

function getOrderSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  if (spreadsheet.getName() !== SPREADSHEET_NAME) {
    spreadsheet.rename(SPREADSHEET_NAME);
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  migrateOrderSheet_(sheet);
  ensureHeaders_(sheet, HEADERS);
  formatSheetHeader_(sheet, HEADERS.length, "#0f172a");
  formatOrderSheet_(sheet);
  return sheet;
}

function migrateOrderSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), LEGACY_ORDER_HEADERS.length);
  if (lastRow < 1) return;

  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map((value) => String(value || "").trim());

  if (currentHeaders.includes("代儲內容/點數")) return;

  const hasLegacyOrder = ["時間", "訂單編號", "商品", "遊戲", "角色UID"].every((header) => currentHeaders.includes(header));
  if (!hasLegacyOrder || lastRow <= 1) return;

  const rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const indexOf = (header) => currentHeaders.indexOf(header);
  const read = (row, header) => {
    const index = indexOf(header);
    return index >= 0 ? row[index] : "";
  };

  const migratedRows = rows.map((row) => [
    read(row, "時間"),
    read(row, "訂單編號"),
    getOrderSourceName_(read(row, "會員來源")),
    read(row, "LINE名稱"),
    read(row, "遊戲"),
    read(row, "商品"),
    read(row, "數量"),
    "",
    read(row, "金額"),
    read(row, "付款方式"),
    read(row, "角色UID"),
    read(row, "伺服器"),
    ORDER_STATUS_DEFAULT,
    read(row, "LINE驗證") || read(row, "驗證狀態"),
    read(row, "LINE User ID"),
    read(row, "備註")
  ]);

  sheet.getRange(2, 1, migratedRows.length, HEADERS.length).setValues(migratedRows);
}

function formatOrderSheet_(sheet) {
  const lastRow = Math.max(1, sheet.getLastRow());
  const width = HEADERS.length;

  ORDER_COLUMN_WIDTHS.forEach((columnWidth, index) => {
    sheet.setColumnWidth(index + 1, columnWidth);
  });

  sheet.getRange(1, 1, lastRow, width)
    .setWrap(true)
    .setVerticalAlignment("middle");

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, width).setBorder(false, false, true, false, false, false, "#e5e7eb", SpreadsheetApp.BorderStyle.SOLID);
  }

  try {
    if (!sheet.getFilter()) {
      sheet.getRange(1, 1, lastRow, width).createFilter();
    }
  } catch (error) {
    // Ignore filter conflicts when the sheet already has a protected or incompatible range.
  }
}

function getMemberSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(MEMBER_SHEET_NAME);
  }

  ensureHeaders_(sheet, MEMBER_HEADERS);
  formatSheetHeader_(sheet, MEMBER_HEADERS.length, "#064e3b");
  return sheet;
}

function ensureHeaders_(sheet, headers, notes) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const isEmpty = firstRow.every((value) => value === "");
  const headerChanged = firstRow.some((value, index) => value !== headers[index]);

  if (isEmpty || headerChanged) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  if (notes && notes.length === headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setNotes([notes]);
  }
}

function formatSheetHeader_(sheet, width, background) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, width)
    .setFontWeight("bold")
    .setBackground(background)
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse_(callback, payload) {
  if (!callback) return jsonResponse_(payload);

  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)
    ? callback
    : "callback";

  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
