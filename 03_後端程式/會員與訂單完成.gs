/**
 * 陳龍龍工作室：正式收單、付款驗證、會員累積與完成通知
 *
 * 這支檔案與「程式碼.gs」放在同一個 Apps Script 專案。
 * 網站 JSONP 收單統一由這裡的 doGet 處理：
 * 1. 驗證 LINE 與商品
 * 2. 先將訂單寫進 Google 試算表
 * 3. 訂單寫入後先嘗試即時傳送 LINE，失敗再排背景重試
 * 4. LINE 失敗只記錄，不會刪除已建立的訂單
 */

const WORKFLOW_VERSION = "2026-07-01-order-established-workflow-v8-speed";
const WORKFLOW_ORDER_STATUS_DEFAULT = "訂單成立";
const WORKFLOW_SETTINGS_SHEET_NAME = "系統設定";
const WORKFLOW_PAYMENT_SETTINGS_GAME_ID = "payment-settings";
const WORKFLOW_DEFAULT_COMPLETION_MESSAGE =
  "您的訂單已完成，感謝支持陳龍龍工作室。如有任何問題請聯繫官方 LINE。";

const MEMBER_FEATURE_COLUMNS = {
  totalSpent: 7,
  completedOrders: 8,
  lastCompletedAt: 9,
  verifiedBankAccounts: 10,
  verifiedJkoAccounts: 11,
  requiresReverification: 12,
  verificationNote: 13,
  lastVerifiedAt: 14,
  memberLevel: 15,
  priorityQueue: 16,
  manualLevel: 17,
  manualTotalSpent: 18,
  discountLabel: 19,
  nextLevelAmount: 20,
  membershipUpdatedAt: 21
};

const ORDER_FEATURE_COLUMNS = {
  completedCheckbox: 17,
  completedAt: 18,
  notifiedAt: 19,
  settlementState: 20,
  paymentStatus: 21,
  paymentVerificationStatus: 22,
  paymentAccountKey: 23,
  accountVerifiedCheckbox: 24,
  requiresReverificationCheckbox: 25,
  verificationNote: 26,
  lineMessageStatus: 27,
  lineErrorLog: 28,
  paymentNotifiedAt: 29,
  workflowVersion: 30,
  originalTotal: 31,
  memberLevel: 32,
  memberDiscount: 33,
  discountAmount: 34,
  payableTotal: 35,
  priorityQueue: 36,
  notificationJobStatus: 37,
  discordNotificationStatus: 38,
  discordErrorLog: 39
};
const ORDER_FEATURE_LAST_COLUMN = ORDER_FEATURE_COLUMNS.discordErrorLog;

const ORDER_FEATURE_STATUS_COLUMN = 13;
const ORDER_FEATURE_TOTAL_COLUMN = 9;
const ORDER_FEATURE_PAYMENT_METHOD_COLUMN = 10;
const ORDER_FEATURE_LINE_USER_ID_COLUMN = 15;

const WORKFLOW_ORDER_HEADERS = [
  "完成（勾選）",
  "完成時間",
  "完成通知時間",
  "會員結算",
  "付款狀態",
  "付款驗證狀態",
  "付款帳戶識別",
  "帳戶已驗證",
  "需要重新驗證",
  "驗證備註",
  "LINE訊息狀態",
  "LINE錯誤紀錄",
  "付款通知時間",
  "流程版本",
  "原價",
  "會員等級",
  "會員折扣",
  "折扣金額",
  "折扣後金額",
  "優先排單",
  "通知背景狀態",
  "Discord通知狀態",
  "Discord錯誤紀錄"
];

const ORDER_BASE_HEADERS = [
  "下單時間",
  "訂單編號",
  "來源",
  "客人 LINE",
  "遊戲",
  "商品 / 方案",
  "數量",
  "單價",
  "金額",
  "付款方式",
  "UID",
  "伺服器 / 區服",
  "訂單狀態",
  "LINE 驗證",
  "LINE User ID",
  "備註 / 玩家名稱 / 上號資料"
];

const ORDER_STAFF_VIEW_HIDDEN_GROUPS = [
  [3, 1],
  [8, 1],
  [14, 2],
  [18, 3],
  [25, 1],
  [27, 5],
  [33, 3],
  [37, 3]
];

const ORDER_STAFF_VIEW_WIDTHS = {
  1: 135,
  2: 160,
  4: 135,
  5: 135,
  6: 220,
  7: 58,
  9: 92,
  10: 92,
  11: 170,
  12: 125,
  13: 100,
  16: 280,
  17: 88,
  21: 95,
  22: 150,
  23: 165,
  24: 95,
  26: 180,
  32: 95,
  36: 88
};

const WORKFLOW_MEMBER_HEADERS = [
  "累積消費",
  "完成訂單數",
  "最後完成時間",
  "網銀已驗證帳戶",
  "街口已驗證帳戶",
  "需要重新驗證",
  "驗證備註",
  "最後驗證時間",
  "會員等級",
  "是否優先排單",
  "手動會員等級",
  "手動累積消費",
  "目前折扣",
  "距離下一級",
  "會員等級更新時間"
];

const MEMBERSHIP_LEVELS = [
  { key: "normal", name: "普通會員", minSpent: 0, discountPercent: 0, discountLabel: "無折扣", priority: false },
  { key: "bronze", name: "青銅會員", minSpent: 30000, discountPercent: 0, discountLabel: "無折扣", priority: true },
  { key: "silver", name: "白銀會員", minSpent: 50000, discountPercent: 1, discountLabel: "99 折", priority: true },
  { key: "gold", name: "黃金會員", minSpent: 100000, discountPercent: 2, discountLabel: "98 折", priority: true }
];

const MEMBERSHIP_LEVEL_SETTING_KEYS = [
  ["普通會員", 0, 0, false],
  ["青銅會員", 30000, 0, true],
  ["白銀會員", 50000, 1, true],
  ["黃金會員", 100000, 2, true]
];

const PENDING_NOTIFICATION_PREFIX = "PENDING_ORDER_NOTIFICATION_";
const PRODUCT_CATALOG_CACHE_KEY = "CLL_PRODUCT_CATALOG_V2";
const LINE_MEMBER_CACHE_PREFIX = "CLL_LINE_MEMBER_";
const DISCORD_WEBHOOK_PROPERTY_KEYS = {
  new_order: "DISCORD_WEBHOOK_NEW_ORDER",
  payment_review: "DISCORD_WEBHOOK_PAYMENT_REVIEW",
  anomaly: "DISCORD_WEBHOOK_ANOMALY",
  completed: "DISCORD_WEBHOOK_COMPLETED"
};

function configureDiscordWebhookProperties(payload) {
  const input = payload || {};
  const values = {
    new_order: input.new_order || input.DISCORD_WEBHOOK_NEW_ORDER,
    payment_review: input.payment_review || input.DISCORD_WEBHOOK_PAYMENT_REVIEW,
    anomaly: input.anomaly || input.DISCORD_WEBHOOK_ANOMALY,
    completed: input.completed || input.DISCORD_WEBHOOK_COMPLETED
  };
  const saved = [];
  const properties = PropertiesService.getScriptProperties();

  Object.keys(DISCORD_WEBHOOK_PROPERTY_KEYS).forEach(function (channelType) {
    const value = String(values[channelType] || "").trim();
    if (!/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//i.test(value)) {
      throw new Error(DISCORD_WEBHOOK_PROPERTY_KEYS[channelType] + " is missing or invalid.");
    }
    properties.setProperty(DISCORD_WEBHOOK_PROPERTY_KEYS[channelType], value);
    saved.push(DISCORD_WEBHOOK_PROPERTY_KEYS[channelType]);
  });

  return {
    ok: true,
    saved: saved
  };
}

const WORKFLOW_ORDER_STATUSES = [
  "訂單成立",
  "已驗證",
  "已完成",
  "已取消"
];

const WORKFLOW_PAYMENT_STATUSES = [
  "未付款",
  "已付款",
  "退款中",
  "已退款",
  "付款異常"
];

const WORKFLOW_VERIFICATION_STATUSES = [
  "待驗證",
  "驗證通過（可傳截圖）",
  "需要重新驗證",
  "人工審核",
  "驗證異常"
];

const WORKFLOW_PAYMENT_DETAILS = {
  "網銀": "付款帳號尚未設定，請從 Google 試算表或 Apps Script 設定正式付款資料。",
  "無卡": "付款帳號尚未設定，請從 Google 試算表或 Apps Script 設定正式付款資料。",
  "LINE Pay": "付款帳號尚未設定，請從 Google 試算表或 Apps Script 設定正式付款資料。",
  "街口": "付款帳號尚未設定，請從 Google 試算表或 Apps Script 設定正式付款資料。"
};

const WORKFLOW_PAYMENT_GUIDANCE = {
  "網銀": [
    "⚠️ 本站僅接受本人帳戶付款，禁止第三方付款、代付、代轉。",
    "",
    "首次購買或首次使用該銀行帳戶付款，請提供螢幕錄影驗證。",
    "",
    "螢幕錄影內容需包含以下項目：",
    "",
    "1. 官方 LINE 對話畫面與訂單編號",
    "2. 本則付款資訊",
    "3. 切換至網銀 App 的轉帳成功明細",
    "4. 不得使用相簿截圖代替錄影",
    "",
    "驗證通過後，同一銀行帳戶下次購買只需提供轉帳截圖。"
  ].join("\n"),
  "街口": [
    "⚠️ 本站僅接受本人街口帳號付款，禁止第三方付款、代付、代轉。",
    "",
    "首次購買或首次使用該街口帳號付款，請提供螢幕錄影驗證。",
    "",
    "螢幕錄影內容需包含以下項目：",
    "",
    "1. 官方 LINE 對話畫面與訂單編號",
    "2. 本則街口付款資訊",
    "3. 切換至街口 App 付款成功明細",
    "4. 畫面需顯示金額、時間與交易資訊",
    "5. 不得使用相簿截圖代替錄影",
    "",
    "驗證通過後，同一街口帳號下次購買只需提供付款截圖。"
  ].join("\n"),
  "無卡": [
    "⚠️ 本站僅接受本人付款，禁止第三方付款、代付、代轉、代存。",
    "",
    "無卡存款完成後，請務必保留紙本收據並拍攝清楚。",
    "",
    "需回傳內容：",
    "",
    "1. 官方 LINE 對話畫面與訂單編號",
    "2. 本則付款資訊",
    "3. 無卡存款紙本收據",
    "4. 收據內容需顯示金額、時間與帳戶資訊",
    "",
    "禁止第三方代存；無收據或收據不清楚，訂單皆無法直接處理。"
  ].join("\n"),
  "LINE Pay": [
    "⚠️ 本站僅接受本人 LINE Pay 付款，禁止第三方付款、代付、代轉。",
    "",
    "付款完成後，請回傳付款成功截圖，需包含：",
    "",
    "1. 付款金額",
    "2. 付款時間",
    "3. 付款對象或交易資訊",
    "4. 訂單編號",
    "",
    "LINE Pay 不需螢幕錄影，回傳截圖即可。"
  ].join("\n")
};

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.action === "member") {
    return memberProfileResponse_(params);
  }

  if (params.action === "products") {
    const catalog = getCachedProductData_();
    return jsonpResponse_(params.callback, {
      ok: true,
      data: {
        categories: (catalog.categories || []).filter(function (category) {
          return category !== "系統設定";
        }),
        games: (catalog.games || []).filter(function (game) {
          return game && game.id !== WORKFLOW_PAYMENT_SETTINGS_GAME_ID;
        })
      }
    });
  }

  if (params.action === "notify-order") {
    try {
      return jsonpResponse_(params.callback, notifyQueuedOrderNow_(params.orderId));
    } catch (error) {
      return jsonpResponse_(params.callback, {
        ok: false,
        message: "LINE 通知觸發失敗：" + getSafeErrorMessage_(error)
      });
    }
  }

  if (params.action === "order") {
    try {
      const data = JSON.parse(params.payload || "{}");
      return jsonpResponse_(params.callback, createOrderWithNotifications_(data));
    } catch (error) {
      return jsonpResponse_(params.callback, {
        ok: false,
        orderSaved: false,
        error: "ORDER_REQUEST_INVALID",
        message: "訂單資料格式錯誤：" + getSafeErrorMessage_(error)
      });
    }
  }

  return jsonpResponse_(params.callback, {
    ok: true,
    backendVersion: WORKFLOW_VERSION,
    name: "陳龍龍工作室訂單後台",
    verifyMode: "line",
    membershipMode: "enabled",
    orderMode: "persist-before-notify",
    lineMode: isLineMessagingConfigured_() ? "configured" : "not_configured",
    loginMode: isLineLoginConfigured_() ? "configured" : "not_configured"
  });
}

function createOrderWithNotifications_(data) {
  const sourceAccount = getSourceAccount_(data.sourceAccount || data.memberSource);
  let member = null;
  let lineVerificationError = "";
  try {
    member = getVerifiedLineMemberCached_(data, sourceAccount);
  } catch (error) {
    lineVerificationError = "LINE會員驗證服務異常：" + getSafeErrorMessage_(error);
  }

  if (!member || !member.userId) {
    member = {
      userId: cleanLineValue_(data.lineUserId),
      displayName: cleanLineValue_(data.lineDisplayName) || "LINE會員（待驗證）",
      pictureUrl: cleanLineValue_(data.linePictureUrl),
      verified: false
    };
  }

  if (!member.userId) {
    return {
      ok: false,
      orderSaved: false,
      error: "LINE_MEMBER_REQUIRED",
      message: "沒有取得 LINE User ID，請從官方 LINE 圖文選單重新開啟後再送出。"
    };
  }
  if (!member.verified && !lineVerificationError) {
    lineVerificationError = "LINE會員Token驗證未通過，訂單已保留並等待客服確認。";
  }

  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const product = findProductPlanFast_(
    spreadsheet,
    data.gameId,
    data.planId,
    data.gameName,
    data.productName
  );
  if (!product) {
    return {
      ok: false,
      orderSaved: false,
      error: "PRODUCT_NOT_FOUND",
      message: "商品或方案不存在，請重新整理網站後再下單。"
    };
  }

  const paymentMethod = normalizePaymentMethod_(data.paymentMethod || data.payment);
  const quantity = normalizeQuantity_(data.quantity);
  const paymentAccountKey = normalizePaymentAccountKey_(data.paymentAccountKey);
  const playerName = cleanLineValue_(data.playerName);
  const originalTotal = product.price * quantity;
  const membership = getMemberPricingProfile_(spreadsheet, member.userId, originalTotal);
  const accountVerification = getMemberPaymentVerification_(
    spreadsheet,
    member.userId,
    paymentMethod,
    paymentAccountKey
  );
  const order = Object.assign({}, data, {
    orderId: cleanOrderId_(data.orderId) || createOrderId_(),
    sourceAccount: sourceAccount,
    sourceName: getOrderSourceName_(sourceAccount),
    memberSource: sourceAccount,
    gameId: product.gameId,
    planId: product.planId,
    gameName: product.gameName,
    productName: product.planName,
    quantity: quantity,
    unitPrice: product.price,
    originalTotal: originalTotal,
    total: membership.payableTotal,
    memberLevel: membership.level.name,
    memberLevelKey: membership.level.key,
    memberDiscount: membership.level.discountLabel,
    memberDiscountPercent: membership.level.discountPercent,
    discountAmount: membership.discountAmount,
    priorityQueue: membership.level.priority,
    payment: paymentMethod,
    paymentMethod: paymentMethod,
    paymentAccountKey: paymentAccountKey,
    playerName: playerName,
    notes: mergePlayerNameIntoNotes_(data.notes, playerName),
    accountPreviouslyVerified: accountVerification.verified,
    requiresReverification: accountVerification.requiresReverification,
    lineMemberVerified: Boolean(member.verified),
    lineVerificationError: lineVerificationError
  });

  const saved = persistOrderFirst_(spreadsheet, order, member, accountVerification);
  if (!saved.ok || !saved.orderSaved) {
    return saved;
  }

  const queued = queueOrderNotificationAfterSave_(
    spreadsheet,
    saved.sheet,
    saved.row,
    order,
    member,
    accountVerification,
    saved.duplicate
  );

  return {
    ok: true,
    orderSaved: true,
    duplicate: Boolean(saved.duplicate),
    orderId: order.orderId,
    lineVerified: Boolean(member.verified),
    lineVerificationError: lineVerificationError,
    notificationQueued: Boolean(queued.queued),
    notificationOk: null,
    paymentNotificationOk: null,
    ownerNotificationOk: null,
    notificationError: queued.ok ? "" : queued.message,
    originalTotal: order.originalTotal,
    total: order.total,
    memberLevel: order.memberLevel,
    memberDiscount: order.memberDiscount,
    discountAmount: order.discountAmount,
    priorityQueue: Boolean(order.priorityQueue),
    payment: order.payment,
    productName: order.productName,
    gameName: order.gameName,
    quantity: order.quantity,
    source: order.sourceName,
    paymentVerificationStatus: saved.paymentVerificationStatus,
    accountPreviouslyVerified: accountVerification.verified
  };
}

function persistOrderFirst_(spreadsheet, order, member, accountVerification) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = getOrderSheet_();
    ensureOrderWorkflowColumns_(sheet);

    const existingRow = findOrderRowById_(sheet, order.orderId);
    if (existingRow > 1) {
      const existingLineUserId = String(
        sheet.getRange(existingRow, ORDER_FEATURE_LINE_USER_ID_COLUMN).getValue() || ""
      ).trim();
      if (existingLineUserId && existingLineUserId !== member.userId) {
        return {
          ok: false,
          orderSaved: false,
          error: "ORDER_ID_CONFLICT",
          message: "訂單編號衝突，請重新整理後再送出。"
        };
      }
      return {
        ok: true,
        orderSaved: true,
        duplicate: true,
        sheet: sheet,
        row: existingRow,
        notificationAlreadySent: isCustomerOrderMessageSent_(
          sheet.getRange(existingRow, ORDER_FEATURE_COLUMNS.lineMessageStatus).getValue()
        ),
        paymentVerificationStatus: String(
          sheet.getRange(existingRow, ORDER_FEATURE_COLUMNS.paymentVerificationStatus).getValue() || "待驗證"
        )
      };
    }

    const verificationStatus = getInitialPaymentVerificationStatus_(
      order.payment,
      accountVerification
    );
    const rowValues = [
      new Date(),
      order.orderId,
      order.sourceName,
      member.displayName || "",
      order.gameName || "",
      order.productName || "",
      order.quantity || 1,
      order.unitPrice || 0,
      order.total || 0,
      order.payment || "",
      cleanLineValue_(order.playerId),
      cleanLineValue_(order.serverName),
      WORKFLOW_ORDER_STATUS_DEFAULT,
      member.verified ? "LINE會員已驗證" : "LINE會員驗證待客服確認",
      member.userId,
      String(order.notes || "").trim().slice(0, 500),
      false,
      "",
      "",
      "",
      "未付款",
      verificationStatus,
      order.paymentAccountKey || "",
      Boolean(accountVerification.verified),
      Boolean(accountVerification.requiresReverification),
      accountVerification.note || "",
      member.verified ? "訂單已建立，LINE待發送" : "訂單已建立，LINE驗證待客服確認",
      order.lineVerificationError || "",
      "",
      WORKFLOW_VERSION,
      order.originalTotal || order.total || 0,
      order.memberLevel || "普通會員",
      order.memberDiscount || "無折扣",
      order.discountAmount || 0,
      order.total || 0,
      Boolean(order.priorityQueue),
      "等待背景發送",
      "",
      ""
    ];

    sheet.insertRowBefore(2);
    const row = 2;
    sheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
    applyCheckboxesToOrderRows_(sheet, row, 1);
    SpreadsheetApp.flush();
    try {
      upsertMember_(member, order.orderId);
    } catch (memberError) {
      sheet.getRange(row, ORDER_FEATURE_COLUMNS.settlementState)
        .setValue("會員資料待補同步");
      sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineErrorLog)
        .setValue("會員資料更新失敗：" + getSafeErrorMessage_(memberError));
    }

    return {
      ok: true,
      orderSaved: true,
      duplicate: false,
      sheet: sheet,
      row: row,
      paymentVerificationStatus: verificationStatus
    };
  } catch (error) {
    safelySendDiscordStandalone_("anomaly", order, member, {
      detail: "後台建立訂單失敗：" + getSafeErrorMessage_(error),
      paymentStatus: "建立失敗"
    });
    return {
      ok: false,
      orderSaved: false,
      error: "ORDER_WRITE_FAILED",
      message: "後台建立訂單失敗：" + getSafeErrorMessage_(error)
    };
  } finally {
    lock.releaseLock();
  }
}

function queueOrderNotificationAfterSave_(
  spreadsheet,
  sheet,
  row,
  order,
  member,
  accountVerification,
  duplicate
) {
  if (duplicate) {
    const previousStatus = String(
      sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineMessageStatus).getValue() || ""
    );
    if (
      isCustomerOrderMessageSent_(previousStatus)
      && hasDiscordNotificationBeenSent_(sheet, row, "new_order")
    ) {
      sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
        .setValue("已發送，不重複排程");
      return { ok: true, queued: false, message: "duplicate_already_notified" };
    }
  }

  try {
    const payload = {
      order: createNotificationOrderPayload_(order),
      member: {
        userId: member.userId,
        displayName: member.displayName,
        verified: Boolean(member.verified)
      },
      accountVerification: accountVerification,
      duplicate: Boolean(duplicate)
    };
    PropertiesService.getScriptProperties()
      .setProperty(PENDING_NOTIFICATION_PREFIX + order.orderId, JSON.stringify(payload));
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineMessageStatus)
      .setValue("訂單已建立，通知背景排程中");
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
      .setValue("等待背景發送");
    ensurePendingOrderNotificationTrigger_();
    return { ok: true, queued: true, message: "" };
  } catch (error) {
    const message = "通知背景排程失敗：" + getSafeErrorMessage_(error);
    appendLineError_(sheet, row, message);
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus).setValue(message);
    return { ok: false, queued: false, message: message };
  }
}

function notifyQueuedOrderNow_(orderId) {
  const safeOrderId = cleanOrderId_(orderId);
  if (!safeOrderId) {
    return { ok: false, message: "缺少訂單編號。" };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return {
      ok: true,
      queued: true,
      message: "LINE 通知正在處理中。"
    };
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const key = PENDING_NOTIFICATION_PREFIX + safeOrderId;
    const raw = properties.getProperty(key);
    if (!raw) {
      return {
        ok: true,
        queued: false,
        message: "沒有待發送 LINE 通知。"
      };
    }

    const payload = JSON.parse(raw || "{}");
    const order = payload.order || {};
    if (!order.orderId) order.orderId = safeOrderId;

    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || getOrderSheet_();
    ensureOrderWorkflowColumns_(sheet);
    const row = findOrderRowById_(sheet, safeOrderId);
    if (row <= 1) throw new Error("找不到訂單列：" + safeOrderId);

    sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
      .setValue("前台觸發發送中");
    const result = notifyOrderAfterSave_(
      spreadsheet,
      sheet,
      row,
      order,
      payload.member || {},
      payload.accountVerification || {},
      Boolean(payload.duplicate)
    );
    const complete = Boolean(
      result.orderNotificationOk
      && result.paymentNotificationOk
      && result.ownerNotificationOk
    );
    if (complete) {
      properties.deleteProperty(key);
      sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
        .setValue("已快速發送");
    } else {
      ensurePendingOrderNotificationTrigger_();
      sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
        .setValue("快速發送完成但有失敗，待背景重試");
    }
    SpreadsheetApp.flush();
    return {
      ok: true,
      queued: !complete,
      notificationOk: Boolean(result.orderNotificationOk),
      paymentNotificationOk: Boolean(result.paymentNotificationOk),
      ownerNotificationOk: Boolean(result.ownerNotificationOk),
      message: complete
        ? "客人 LINE 與內部 Discord 通知已快速發送。"
        : "通知部分失敗，已保留背景重試。"
    };
  } finally {
    lock.releaseLock();
  }
}

function createNotificationOrderPayload_(order) {
  return {
    orderId: order.orderId || "",
    sourceAccount: order.sourceAccount || "dc",
    sourceName: order.sourceName || "",
    gameName: order.gameName || "",
    productName: order.productName || "",
    quantity: Number(order.quantity || 1),
    originalTotal: Number(order.originalTotal || order.total || 0),
    total: Number(order.total || 0),
    memberLevel: order.memberLevel || "普通會員",
    memberDiscount: order.memberDiscount || "無折扣",
    discountAmount: Number(order.discountAmount || 0),
    priorityQueue: Boolean(order.priorityQueue),
    payment: order.payment || "",
    playerId: cleanLineValue_(order.playerId),
    playerName: cleanLineValue_(order.playerName) || extractPlayerNameText_(order.notes),
    serverName: cleanLineValue_(order.serverName),
    notes: String(order.notes || "").trim().slice(0, 500),
    gameLoginInfo: extractGameLoginInfoText_(order.notes)
  };
}

function notifyOrderAfterSave_(
  spreadsheet,
  sheet,
  row,
  order,
  member,
  accountVerification,
  duplicate
) {
  row = findOrderRowById_(sheet, order.orderId) || row;
  const previousStatus = String(
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineMessageStatus).getValue() || ""
  );
  if (duplicate && isCustomerOrderMessageSent_(previousStatus)) {
    const newOrderDiscord = notifyDiscordOrderEvent_(
      sheet,
      row,
      "new_order",
      "new_order",
      order,
      member,
      {
        paymentStatus: "尚未人工確認",
        detail: order.priorityQueue ? "網站下單｜優先排單" : "網站下單"
      }
    );
    return {
      orderNotificationOk: true,
      paymentNotificationOk: true,
      ownerNotificationOk: Boolean(newOrderDiscord.ok),
      errors: []
    };
  }

  const existingError = String(
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineErrorLog).getValue() || ""
  ).trim();
  const errors = [];
  let customerNotificationOk = isCustomerOrderMessageSent_(previousStatus);
  let ownerNotificationOk = false;

  const customerMessage = buildOrderPaymentMessage_(
    spreadsheet,
    order,
    accountVerification
  );

  if (!customerNotificationOk) {
    try {
      assertLinePushSucceeded_(
        pushLineText_(member.userId, customerMessage, order.sourceAccount),
        "訂單成立與付款資訊單則訊息"
      );
      customerNotificationOk = true;
    } catch (error) {
      if (existingError) errors.push(existingError);
      errors.push(getSafeErrorMessage_(error));
    }
  }

  const newOrderDiscord = notifyDiscordOrderEvent_(
    sheet,
    row,
    "new_order",
    "new_order",
    order,
    member,
    {
      paymentStatus: "尚未人工確認",
      detail: order.priorityQueue ? "網站下單｜優先排單" : "網站下單"
    }
  );
  ownerNotificationOk = Boolean(newOrderDiscord.ok);

  if (errors.length) {
    notifyDiscordOrderEvent_(
      sheet,
      row,
      "anomaly",
      "customer_line_delivery_failure",
      order,
      member,
      {
        paymentStatus: "待客服確認",
        detail: errors.join("｜").slice(0, 500)
      }
    );
  }

  const lineStatus = customerNotificationOk
    ? "單則訂單付款訊息已送出"
    : "單則訂單付款訊息失敗";

  row = findOrderRowById_(sheet, order.orderId) || row;
  sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineMessageStatus).setValue(lineStatus);
  sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineErrorLog)
    .setValue(errors.join("\n").slice(0, 2000));
  if (customerNotificationOk) {
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.paymentNotifiedAt).setValue(new Date());
  }
  SpreadsheetApp.flush();

  return {
    orderNotificationOk: customerNotificationOk,
    paymentNotificationOk: customerNotificationOk,
    ownerNotificationOk: ownerNotificationOk,
    errors: errors
  };
}

function isCustomerOrderMessageSent_(status) {
  const value = String(status || "").trim();
  return value === "單則訂單付款訊息已送出"
    || value === "兩則訊息已送出";
}

function processPendingOrderNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return "已有背景通知正在處理。";

  try {
    // 單次觸發器正在執行時先移除，若發生可重試錯誤，結尾才能可靠建立下一次觸發器。
    clearPendingOrderNotificationTriggers_();
    const properties = PropertiesService.getScriptProperties();
    const all = properties.getProperties();
    const keys = Object.keys(all)
      .filter(function (key) {
        return key.indexOf(PENDING_NOTIFICATION_PREFIX) === 0;
      })
      .slice(0, 20);

    if (!keys.length) {
      clearPendingOrderNotificationTriggers_();
      return "沒有待發送通知。";
    }

    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || getOrderSheet_();
    ensureOrderWorkflowColumns_(sheet);

    keys.forEach(function (key) {
      let payload = null;
      let row = 0;
      try {
        payload = JSON.parse(all[key] || "{}");
        const order = payload.order || {};
        row = findOrderRowById_(sheet, order.orderId);
        if (row <= 1) throw new Error("找不到訂單列：" + (order.orderId || ""));

        sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
          .setValue("背景發送中");
        const result = notifyOrderAfterSave_(
          spreadsheet,
          sheet,
          row,
          order,
          payload.member || {},
          payload.accountVerification || {},
          Boolean(payload.duplicate)
        );
        const complete = Boolean(
          result.orderNotificationOk
          && result.paymentNotificationOk
          && result.ownerNotificationOk
        );
        sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
          .setValue(
            complete
              ? "已背景發送"
              : "背景發送完成但有失敗，待重試"
          );
        if (complete) properties.deleteProperty(key);
      } catch (error) {
        if (row > 1) {
          appendLineError_(sheet, row, "背景通知失敗：" + getSafeErrorMessage_(error));
          sheet.getRange(row, ORDER_FEATURE_COLUMNS.notificationJobStatus)
            .setValue("背景通知失敗，待下次重試");
        }
      }
    });

    const hasMore = Object.keys(properties.getProperties()).some(function (key) {
      return key.indexOf(PENDING_NOTIFICATION_PREFIX) === 0;
    });
    if (hasMore) ensurePendingOrderNotificationTrigger_();
    else clearPendingOrderNotificationTriggers_();

    SpreadsheetApp.flush();
    return "背景通知處理完成：" + keys.length + " 筆。";
  } finally {
    lock.releaseLock();
  }
}

function ensurePendingOrderNotificationTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === "processPendingOrderNotifications";
  });
  if (!exists) {
    ScriptApp.newTrigger("processPendingOrderNotifications")
      .timeBased()
      .after(10 * 1000)
      .create();
  }
}

function getCachedProductData_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PRODUCT_CATALOG_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(PRODUCT_CATALOG_CACHE_KEY);
    }
  }

  const catalog = getProductData_();
  try {
    const serialized = JSON.stringify(catalog);
    if (serialized.length < 95000) cache.put(PRODUCT_CATALOG_CACHE_KEY, serialized, 300);
  } catch (error) {
    // 快取失敗不影響正式商品資料回傳。
  }
  return catalog;
}

function getVerifiedLineMemberCached_(data, sourceAccount) {
  const safeData = data || {};
  const accountKey = String(sourceAccount || "dc").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16);
  const suppliedUserId = cleanLineValue_(safeData.lineUserId);
  const cache = CacheService.getScriptCache();
  const userCacheKey = suppliedUserId
    ? LINE_MEMBER_CACHE_PREFIX + accountKey + "_USER_" + suppliedUserId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
    : "";
  if (userCacheKey) {
    const cachedByUser = cache.get(userCacheKey);
    if (cachedByUser) {
      try {
        const member = JSON.parse(cachedByUser);
        if (member && member.userId === suppliedUserId) {
          member.displayName = cleanLineValue_(safeData.lineDisplayName) || member.displayName || "";
          member.pictureUrl = cleanLineValue_(safeData.linePictureUrl) || member.pictureUrl || "";
          member.verified = true;
          return member;
        }
      } catch (error) {
        cache.remove(userCacheKey);
      }
    }
  }

  const token = String(safeData.lineIdToken || safeData.lineAccessToken || "").trim();
  if (!token) return getVerifiedLineMember_(safeData, sourceAccount);

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    token,
    Utilities.Charset.UTF_8
  );
  const digestText = digest.map(function (value) {
    return ("0" + ((value + 256) % 256).toString(16)).slice(-2);
  }).join("");
  const key = LINE_MEMBER_CACHE_PREFIX
    + accountKey
    + "_"
    + digestText.slice(0, 40);
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(key);
    }
  }

  const member = getVerifiedLineMember_(safeData, sourceAccount);
  if (member && member.verified && member.userId) {
    const cachePayload = JSON.stringify({
      userId: member.userId,
      displayName: member.displayName || "",
      pictureUrl: member.pictureUrl || "",
      verified: true
    });
    cache.put(key, cachePayload, 1800);
    if (userCacheKey) cache.put(userCacheKey, cachePayload, 1800);
  }
  return member;
}

function clearPendingOrderNotificationTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() === "processPendingOrderNotifications";
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
}

function buildOrderPaymentMessage_(spreadsheet, order, accountVerification) {
  const method = normalizePaymentMethod_(order.payment);
  const configuredText = getConfiguredPaymentText_(spreadsheet, method, order);
  const defaultDetails = WORKFLOW_PAYMENT_DETAILS[method] || "";
  const paymentDetails = isPlaceholderPaymentText_(configuredText)
    ? defaultDetails
    : (configuredText || defaultDetails);
  const verifiedReminder = [
    "✅ 此付款帳戶先前已驗證通過",
    "本次提供付款明細截圖即可。",
    "如更換付款帳戶，需重新錄影驗證。",
    "",
    "⚠️ 仍僅接受本人付款，禁止第三方代付、代轉、代存。"
  ].join("\n");
  const verification = accountVerification || {};
  const verificationText = verification.verified
    && !verification.requiresReverification
    && (method === "網銀" || method === "街口")
    ? verifiedReminder
    : WORKFLOW_PAYMENT_GUIDANCE[method];

  const lines = buildOrderSummaryLines_(order);
  lines.push(
    "",
    getPaymentTitle_(method),
    ""
  );
  buildPaymentDetailLines_(method, paymentDetails, order.total).forEach(function (line) {
    lines.push(line);
  });
  lines.push(
    "",
    verificationText,
    "",
    "付款完成後，請直接將付款證明回傳官方 LINE，人工審核後會盡快處理。"
  );
  return lines.join("\n");
}

function buildOrderSummaryLines_(order) {
  const identity = getOrderPlayerIdentity_(order);
  const login = getGameLoginInfoObject_(order);
  const lines = [
    "✅ 訂單已成立",
    "",
    "【訂單編號】：" + (order.orderId || ""),
    "【付款方式】：" + getPaymentDisplayName_(order.payment || order.paymentMethod),
    "【購買遊戲】：" + (order.gameName || "未填寫")
  ];

  if (login.method || login.account || login.password) {
    lines.push(
      "【登入方式】：" + (login.method || "未填寫"),
      "【帳號】：" + (login.account || "未填寫"),
      "【密碼】：" + (login.password || "未填寫")
    );
  }

  lines.push(
    "【伺服器】：" + (order.serverName || "未填寫"),
    "【UID】：" + (identity.uid || "未填寫"),
    "【玩家名稱】：" + (identity.playerName || "未填寫"),
    "【購買商品】：" + ((order.productName || "未填寫") + " ×" + (order.quantity || 1))
  );

  return lines;
}

function getPaymentDisplayName_(paymentMethod) {
  const method = normalizePaymentMethod_(paymentMethod);
  return {
    "網銀": "網銀轉帳",
    "無卡": "無卡存款",
    "LINE Pay": "LINE Pay",
    "街口": "街口支付"
  }[method] || method;
}

function getPaymentTitle_(paymentMethod) {
  const method = normalizePaymentMethod_(paymentMethod);
  return {
    "網銀": "💳 網銀轉帳資訊",
    "無卡": "🏧 無卡存款資訊",
    "LINE Pay": "💚 LINE Pay 付款資訊",
    "街口": "🟠 街口支付資訊"
  }[method] || "付款資訊";
}

function buildPaymentDetailLines_(paymentMethod, paymentDetails, total) {
  const lines = String(paymentDetails || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(function (line) {
      return String(line || "").trim();
    });
  const formatted = [];

  lines.forEach(function (line) {
    if (!line) {
      if (formatted.length && formatted[formatted.length - 1] !== "") formatted.push("");
      return;
    }
    formatted.push(formatPaymentDetailLine_(line));
  });

  if (!formatted.filter(Boolean).length) {
    formatted.push("付款資訊尚未設定，請聯繫官方 LINE 客服。");
  }

  while (formatted.length && formatted[formatted.length - 1] === "") {
    formatted.pop();
  }
  formatted.push("【付款金額】：NT$ " + formatMoney_(total));
  return formatted;
}

function formatPaymentDetailLine_(line) {
  if (/^【.+】[:：]/.test(line)) return line;
  const match = line.match(/^([^:：]{2,12})[:：]\s*(.+)$/);
  if (match) return "【" + match[1].trim() + "】：" + match[2].trim();
  return line;
}

function isPlaceholderPaymentText_(text) {
  const value = String(text || "").trim();
  if (!value) return true;
  return [
    "請聯絡官方 LINE 客服取得",
    "請在這裡填",
    "付款帳號尚未設定"
  ].some(function (marker) {
    return value.indexOf(marker) >= 0;
  });
}

function buildOwnerOrderMessage_(order, member) {
  const lines = ["🔔 新訂單"];
  if (order.priorityQueue) lines.push("⚡ 優先排單");
  lines.push(
    "",
    "客人：" + (member.displayName || "LINE會員"),
    "訂單：" + (order.orderId || ""),
    "",
    "遊戲：" + (order.gameName || ""),
    "方案：" + (order.productName || ""),
    "數量：" + (order.quantity || 1),
    "金額：NT$ " + formatMoney_(order.total),
    "付款：" + (order.payment || ""),
    "會員：" + (order.memberLevel || "普通會員")
  );
  if (order.playerId) lines.push("遊戲 UID：" + order.playerId);
  if (order.serverName) lines.push("區服：" + order.serverName);
  const gameLoginLines = getGameLoginMessageLines_(order);
  if (gameLoginLines.length) {
    lines.push("");
    gameLoginLines.forEach(function (line) {
      lines.push(line);
    });
  }
  return lines.join("\n");
}

function safelySendDiscordStandalone_(channelType, order, member, options) {
  try {
    return sendDiscordOrderNotification_(channelType, order || {}, member || {}, options || {});
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      message: getSafeErrorMessage_(error)
    };
  }
}

function sendDiscordOrderNotification_(channelType, order, member, options) {
  const propertyKey = DISCORD_WEBHOOK_PROPERTY_KEYS[channelType];
  if (!propertyKey) throw new Error("未知的 Discord 通知類型：" + channelType);

  const webhookUrl = String(getScriptProperty_(propertyKey) || "").trim();
  if (!webhookUrl) throw new Error(propertyKey + " 尚未設定");
  if (!/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//i.test(webhookUrl)) {
    throw new Error(propertyKey + " 不是有效的 Discord Webhook 網址");
  }

  const settings = {
    new_order: {
      title: "🛒 新訂單",
      color: 5793266
    },
    payment_review: {
      title: "💳 付款待審核",
      color: 16763904
    },
    anomaly: {
      title: "⚠️ 異常訂單",
      color: 15158332
    },
    completed: {
      title: "✅ 已完成訂單",
      color: 5763719
    }
  };
  const config = settings[channelType];
  const safeOrderId = sanitizeDiscordText_(order.orderId || "未建立", 120);
  const customerName = sanitizeDiscordText_(member.displayName || order.lineDisplayName || "LINE會員", 120);
  const lineUserId = sanitizeDiscordText_(member.userId || order.lineUserId || "未取得", 180);
  const orderSummary = sanitizeDiscordText_(buildOrderSummaryLines_(order).join("\n"), 1800);
  const paymentStatus = sanitizeDiscordText_(
    options.paymentStatus || order.paymentStatus || "未付款",
    120
  );
  const detail = sanitizeDiscordText_(options.detail || "", 500);
  const orderLink = String(options.orderLink || "").trim();
  const fields = [
    {
      name: "訂單編號",
      value: safeOrderId,
      inline: true
    },
    {
      name: "商品名稱",
      value: sanitizeDiscordText_(order.productName || "未填寫", 500),
      inline: true
    },
    {
      name: "金額",
      value: "NT$ " + formatMoney_(order.total || 0),
      inline: true
    },
    {
      name: "付款方式",
      value: sanitizeDiscordText_(order.payment || order.paymentMethod || "未選擇", 120),
      inline: true
    },
    {
      name: "付款狀態",
      value: paymentStatus,
      inline: true
    },
    {
      name: "客人 LINE",
      value: customerName + "\n`" + lineUserId + "`",
      inline: false
    }
  ];
  if (detail) {
    fields.push({
      name: "狀況",
      value: detail,
      inline: false
    });
  }
  if (orderLink) {
    fields.push({
      name: "後台訂單",
      value: "[直接開啟這筆訂單](" + orderLink + ")",
      inline: false
    });
  }

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      username: "陳龍龍網站後台",
      allowed_mentions: {
        parse: []
      },
      embeds: [{
        title: config.title,
        color: config.color,
        description: orderSummary,
        fields: fields,
        footer: {
          text: "客人：" + customerName + "｜陳龍龍工作室內部通知"
        },
        timestamp: new Date().toISOString()
      }]
    }),
    muteHttpExceptions: true
  });
  const statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      "Discord Webhook 回傳 " + statusCode + "：" + sanitizeDiscordText_(
        response.getContentText() || "",
        300
      )
    );
  }
  return {
    ok: true,
    statusCode: statusCode,
    message: ""
  };
}

function notifyDiscordOrderEvent_(
  sheet,
  row,
  channelType,
  eventKey,
  order,
  member,
  options
) {
  if (hasDiscordNotificationBeenSent_(sheet, row, eventKey)) {
    return {
      ok: true,
      duplicate: true,
      message: ""
    };
  }

  const finalOptions = Object.assign({}, options || {}, {
    orderLink: buildDiscordOrderLink_(sheet, row)
  });
  const result = safelySendDiscordStandalone_(
    channelType,
    order || {},
    member || {},
    finalOptions
  );
  if (result.ok) {
    markDiscordNotificationSent_(sheet, row, eventKey);
  } else {
    appendDiscordError_(sheet, row, eventKey + "：" + (result.message || "發送失敗"));
  }
  return result;
}

function hasDiscordNotificationBeenSent_(sheet, row, eventKey) {
  const value = String(
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.discordNotificationStatus).getValue() || ""
  );
  return value.indexOf("[" + eventKey + "]") >= 0;
}

function markDiscordNotificationSent_(sheet, row, eventKey) {
  const cell = sheet.getRange(row, ORDER_FEATURE_COLUMNS.discordNotificationStatus);
  const previous = String(cell.getValue() || "").trim();
  const timestamp = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  cell.setValue(
    [previous, "[" + eventKey + "] " + timestamp]
      .filter(Boolean)
      .join("\n")
      .slice(-2000)
  );
}

function appendDiscordError_(sheet, row, message) {
  const cell = sheet.getRange(row, ORDER_FEATURE_COLUMNS.discordErrorLog);
  const previous = String(cell.getValue() || "").trim();
  const timestamp = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  cell.setValue(
    [previous, timestamp + " " + String(message || "")]
      .filter(Boolean)
      .join("\n")
      .slice(-2000)
  );
}

function buildDiscordOrderLink_(sheet, row) {
  if (!sheet || row <= 1) return "";
  return "https://docs.google.com/spreadsheets/d/"
    + SHEET_ID
    + "/edit#gid="
    + sheet.getSheetId()
    + "&range=A"
    + row;
}

function getDiscordOrderContextFromRow_(sheet, row) {
  const values = sheet.getRange(row, 1, 1, ORDER_FEATURE_LAST_COLUMN).getValues()[0];
  return {
    order: {
      orderId: String(values[1] || "").trim(),
      sourceName: String(values[2] || "").trim(),
      lineDisplayName: String(values[3] || "").trim(),
      gameName: String(values[4] || "").trim(),
      productName: String(values[5] || "").trim(),
      quantity: Number(values[6] || 1),
      unitPrice: Number(values[7] || 0),
      total: Number(values[ORDER_FEATURE_TOTAL_COLUMN - 1] || 0),
      payment: String(values[ORDER_FEATURE_PAYMENT_METHOD_COLUMN - 1] || "").trim(),
      playerId: String(values[10] || "").trim(),
      playerName: extractPlayerNameText_(String(values[15] || "").trim()),
      serverName: String(values[11] || "").trim(),
      notes: String(values[15] || "").trim(),
      orderStatus: String(values[ORDER_FEATURE_STATUS_COLUMN - 1] || "").trim(),
      lineUserId: String(values[ORDER_FEATURE_LINE_USER_ID_COLUMN - 1] || "").trim(),
      paymentStatus: String(values[ORDER_FEATURE_COLUMNS.paymentStatus - 1] || "").trim(),
      paymentVerificationStatus: String(
        values[ORDER_FEATURE_COLUMNS.paymentVerificationStatus - 1] || ""
      ).trim()
    },
    member: {
      displayName: String(values[3] || "").trim(),
      userId: String(values[ORDER_FEATURE_LINE_USER_ID_COLUMN - 1] || "").trim()
    }
  };
}

function sanitizeDiscordText_(value, maxLength) {
  return String(value == null ? "" : value)
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, Math.max(1, Number(maxLength || 500)));
}

function extractGameLoginInfoText_(notes) {
  const text = String(notes || "").replace(/\r/g, "").trim();
  if (!text) return "";
  const marker = "[上號資料]";
  const start = text.indexOf(marker);
  if (start < 0) return "";
  let section = text.slice(start);
  const nextSection = section.indexOf("\n\n", marker.length);
  if (nextSection >= 0) section = section.slice(0, nextSection);
  return section
    .split("\n")
    .map(function (line) {
      return String(line || "").trim();
    })
    .filter(Boolean)
    .slice(0, 4)
    .join("\n")
    .slice(0, 350);
}

function extractPlayerNameText_(notes) {
  const text = String(notes || "").replace(/\r/g, "").trim();
  if (!text) return "";
  const marker = "[玩家資料]";
  const start = text.indexOf(marker);
  if (start < 0) return "";
  let section = text.slice(start);
  const nextSection = section.indexOf("\n\n", marker.length);
  if (nextSection >= 0) section = section.slice(0, nextSection);
  const lines = section.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = String(lines[index] || "").trim().match(/^玩家名稱[:：]\s*(.+)$/);
    if (match) return cleanLineValue_(match[1]);
  }
  return "";
}

function mergePlayerNameIntoNotes_(notes, playerName) {
  const base = String(notes || "").trim();
  const name = cleanLineValue_(playerName);
  if (!name || base.indexOf("[玩家資料]") >= 0) return base;
  return ["[玩家資料]\n玩家名稱：" + name, base].filter(Boolean).join("\n\n").slice(0, 500);
}

function getGameLoginInfoObject_(order) {
  const result = {
    method: "",
    account: "",
    password: ""
  };
  const info = String(order.gameLoginInfo || extractGameLoginInfoText_(order.notes) || "")
    .replace(/\r/g, "")
    .trim();
  if (!info) return result;

  info.split("\n").forEach(function (line) {
    const value = String(line || "").trim();
    const match = value.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (!match) return;
    const key = match[1].trim();
    const content = match[2].trim();
    if (key === "登入方式") result.method = content;
    if (key === "帳號") result.account = content;
    if (key === "密碼") result.password = content;
  });
  return result;
}

function getOrderPlayerIdentity_(order) {
  const rawUid = cleanLineValue_(order.playerId);
  let playerName = cleanLineValue_(order.playerName) || extractPlayerNameText_(order.notes);
  let uid = rawUid;

  if (!playerName && rawUid.indexOf("/") > 0) {
    const parts = rawUid.split("/").map(function (part) {
      return cleanLineValue_(part);
    }).filter(Boolean);
    if (parts.length >= 2) {
      const firstLooksUid = /^[0-9]{5,}$/.test(parts[0]);
      const secondLooksUid = /^[0-9]{5,}$/.test(parts[1]);
      if (secondLooksUid && !firstLooksUid) {
        playerName = parts[0];
        uid = parts[1];
      } else if (firstLooksUid && !secondLooksUid) {
        uid = parts[0];
        playerName = parts[1];
      }
    }
  }

  return {
    uid: uid,
    playerName: playerName
  };
}

function getGameLoginMessageLines_(order) {
  const info = String(order.gameLoginInfo || extractGameLoginInfoText_(order.notes) || "")
    .replace(/\r/g, "")
    .trim();
  if (!info) return [];
  const lines = info
    .split("\n")
    .map(function (line) {
      return String(line || "").trim();
    })
    .filter(function (line) {
      return Boolean(line) && line !== "[上號資料]";
    })
    .slice(0, 3);
  return lines.length ? ["上號資料："].concat(lines) : [];
}

function assertLinePushSucceeded_(response, label) {
  const result = response || {};
  if (result.ok === true && Number(result.statusCode || 200) < 400) return;

  let detail = result.message || result.body || ("HTTP " + (result.statusCode || "未知"));
  detail = String(detail || "未知錯誤").replace(/\s+/g, " ").slice(0, 300);
  throw new Error(label + "失敗：" + detail);
}

function normalizePaymentMethod_(value) {
  const method = String(value || "").split(/\r?\n/)[0].trim();
  return ["網銀", "無卡", "LINE Pay", "街口"].indexOf(method) >= 0 ? method : "網銀";
}

function normalizePaymentAccountKey_(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function getInitialPaymentVerificationStatus_(paymentMethod, accountVerification) {
  if (accountVerification.requiresReverification) return "需要重新驗證";
  if (accountVerification.verified) return "驗證通過（可傳截圖）";
  if (paymentMethod === "LINE Pay") return "人工審核";
  return "待驗證";
}

function findProductPlanFast_(spreadsheet, gameId, planId, gameName, productName) {
  const sheet = spreadsheet.getSheetByName(PRODUCT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return null;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  const requestedGameId = String(gameId || "").trim();
  const requestedPlanId = String(planId || "").trim();
  const requestedGameName = String(gameName || "").trim();
  const requestedProductName = String(productName || "").trim();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const active = row[0] === true
      || String(row[0]).toUpperCase() === "TRUE"
      || String(row[0]).trim() === "1"
      || String(row[0]).trim() === "啟用";
    if (!active) continue;

    const rowGameId = String(row[2] || "").trim();
    const rowGameName = String(row[3] || "").trim();
    const rowPlanId = String(row[5] || "").trim();
    const rowPlanName = String(row[6] || "").trim();
    const gameMatches = rowGameId === requestedGameId
      || (!requestedGameId && rowGameName === requestedGameName);
    const planMatches = rowPlanId === requestedPlanId
      || (!requestedPlanId && rowPlanName === requestedProductName);
    const price = Number(row[7] || 0);

    if (gameMatches && planMatches && Number.isFinite(price) && price > 0) {
      return {
        gameId: rowGameId,
        gameName: rowGameName,
        planId: rowPlanId,
        planName: rowPlanName,
        price: price
      };
    }
  }
  return null;
}

function findOrderRowById_(sheet, orderId) {
  const value = String(orderId || "").trim();
  if (!value || sheet.getLastRow() <= 1) return 0;
  const match = sheet
    .getRange(2, 2, sheet.getLastRow() - 1, 1)
    .createTextFinder(value)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function getConfiguredPaymentText_(spreadsheet, paymentMethod, order) {
  const productText = getPaymentInstructionFromProductSheet_(spreadsheet, paymentMethod);
  if (productText) return productText;

  const replySheet = spreadsheet.getSheetByName(
    typeof PAYMENT_REPLY_SHEET_NAME === "string"
      ? PAYMENT_REPLY_SHEET_NAME
      : "付款回覆"
  );
  if (!replySheet || replySheet.getLastRow() <= 1) return "";

  const rows = replySheet.getRange(2, 1, replySheet.getLastRow() - 1, 3).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const enabled = row[1] === true
      || String(row[1]).toUpperCase() === "TRUE"
      || String(row[1]).trim() === "1"
      || String(row[1]).trim() === "啟用";
    if (!enabled || String(row[0] || "").trim() !== paymentMethod) continue;

    const replacements = {
      "{訂單編號}": order.orderId || "",
      "{遊戲}": order.gameName || "",
      "{方案}": order.productName || "",
      "{金額}": "NT$ " + formatMoney_(order.total),
      "{付款方式}": order.payment || "",
      "{UID}": order.playerId || ""
    };
    let text = String(row[2] || "").trim();
    Object.keys(replacements).forEach(function (key) {
      text = text.split(key).join(replacements[key]);
    });
    return text.slice(0, 2500);
  }
  return "";
}

function getPaymentInstructionFromProductSheet_(spreadsheet, paymentMethod) {
  const sheet = spreadsheet.getSheetByName(PRODUCT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return "";

  const method = normalizePaymentMethod_(paymentMethod);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  const aliases = getPaymentMethodAliases_(method);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const active = row[0] === true
      || String(row[0]).toUpperCase() === "TRUE"
      || String(row[0]).trim() === "1"
      || String(row[0]).trim() === "啟用";
    if (!active || String(row[2] || "").trim() !== WORKFLOW_PAYMENT_SETTINGS_GAME_ID) continue;

    const targetText = (String(row[5] || "") + "\n" + String(row[6] || "")).toLowerCase();
    const matched = aliases.some(function (alias) {
      return targetText.indexOf(alias.toLowerCase()) >= 0;
    });
    if (matched) return String(row[9] || "").trim().slice(0, 2500);
  }
  return "";
}

function getPaymentMethodAliases_(method) {
  if (method === "網銀") return ["網銀", "銀行", "轉帳", "bank", "wire"];
  if (method === "無卡") return ["無卡", "無卡存款", "cardless"];
  if (method === "LINE Pay") return ["LINE Pay", "LINEPay", "line_pay"];
  if (method === "街口") return ["街口", "街口支付", "jko"];
  return [method];
}

function getMemberPaymentVerification_(spreadsheet, lineUserId, paymentMethod, accountKey) {
  const result = {
    verified: false,
    requiresReverification: false,
    note: ""
  };
  const memberSheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME);
  if (!memberSheet || !lineUserId) return result;

  ensureMemberWorkflowColumns_(memberSheet);
  const memberRow = findMemberRow_(memberSheet, lineUserId);
  if (memberRow <= 1) return result;

  const values = memberSheet
    .getRange(memberRow, MEMBER_FEATURE_COLUMNS.verifiedBankAccounts, 1, 5)
    .getValues()[0];
  const verifiedBankAccounts = parseAccountList_(values[0]);
  const verifiedJkoAccounts = parseAccountList_(values[1]);
  result.requiresReverification = values[2] === true
    || String(values[2]).toUpperCase() === "TRUE";
  result.note = String(values[3] || "").trim().slice(0, 500);

  if (!accountKey || result.requiresReverification) return result;
  if (paymentMethod === "網銀") {
    result.verified = verifiedBankAccounts.indexOf(accountKey) >= 0;
  } else if (paymentMethod === "街口") {
    result.verified = verifiedJkoAccounts.indexOf(accountKey) >= 0;
  }
  return result;
}

function parseAccountList_(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map(function (item) {
      return normalizePaymentAccountKey_(item);
    })
    .filter(Boolean);
}

function getMemberPricingProfile_(spreadsheet, lineUserId, originalTotal) {
  const profile = getMemberStatusForUser_(spreadsheet, lineUserId);
  const discountAmount = Math.round(
    Math.max(0, Number(originalTotal || 0)) * Number(profile.level.discountPercent || 0) / 100
  );
  const payableTotal = Math.max(0, Math.round(Number(originalTotal || 0) - discountAmount));
  return Object.assign({}, profile, {
    originalTotal: Math.max(0, Number(originalTotal || 0)),
    discountAmount: discountAmount,
    payableTotal: payableTotal
  });
}

function getMemberStatusForUser_(spreadsheet, lineUserId) {
  const levels = getMembershipLevels_(spreadsheet);
  const profile = {
    totalSpent: 0,
    completedOrders: 0,
    lastCompletedAt: "",
    manualLevel: "",
    manualTotalSpent: "",
    effectiveSpent: 0
  };
  const memberSheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME);
  if (memberSheet && lineUserId) {
    ensureMemberWorkflowColumns_(memberSheet);
    const row = findMemberRow_(memberSheet, lineUserId);
    if (row > 1) {
      const values = memberSheet
        .getRange(row, MEMBER_FEATURE_COLUMNS.totalSpent, 1, MEMBER_FEATURE_COLUMNS.membershipUpdatedAt - MEMBER_FEATURE_COLUMNS.totalSpent + 1)
        .getValues()[0];
      profile.totalSpent = Number(values[0] || 0);
      profile.completedOrders = Number(values[1] || 0);
      profile.lastCompletedAt = values[2] || "";
      profile.manualLevel = String(values[MEMBER_FEATURE_COLUMNS.manualLevel - MEMBER_FEATURE_COLUMNS.totalSpent] || "").trim();
      const manualTotal = values[MEMBER_FEATURE_COLUMNS.manualTotalSpent - MEMBER_FEATURE_COLUMNS.totalSpent];
      profile.manualTotalSpent = manualTotal === "" || manualTotal === null ? "" : Number(manualTotal || 0);
    }
  }

  profile.effectiveSpent = Number.isFinite(Number(profile.manualTotalSpent))
    && profile.manualTotalSpent !== ""
    ? Math.max(0, Number(profile.manualTotalSpent))
    : Math.max(0, Number(profile.totalSpent || 0));
  const levelInfo = resolveMembershipLevel_(profile.effectiveSpent, profile.manualLevel, levels);
  return Object.assign(profile, levelInfo);
}

function getMembershipLevels_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(WORKFLOW_SETTINGS_SHEET_NAME);
  const levels = MEMBERSHIP_LEVELS.map(function (level) {
    return Object.assign({}, level);
  });
  const byName = {};
  levels.forEach(function (level) {
    byName[level.name] = level;
  });

  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    rows.forEach(function (row) {
      const key = String(row[0] || "").trim();
      if (key.indexOf("會員等級：") !== 0) return;
      const name = key.replace("會員等級：", "").trim();
      if (!byName[name]) return;
      const parsed = parseMembershipSettingText_(row[1], byName[name]);
      byName[name].minSpent = parsed.minSpent;
      byName[name].discountPercent = parsed.discountPercent;
      byName[name].discountLabel = parsed.discountPercent > 0
        ? (100 - parsed.discountPercent) + " 折"
        : "無折扣";
      byName[name].priority = parsed.priority;
    });
  }

  return levels.sort(function (a, b) {
    return a.minSpent - b.minSpent;
  });
}

function parseMembershipSettingText_(value, fallback) {
  const text = String(value || "");
  const thresholdMatch = text.match(/門檻\s*=\s*([0-9]+)/);
  const discountMatch = text.match(/折扣\s*=\s*([0-9]+)/);
  const priorityMatch = text.match(/優先\s*=\s*(是|否|true|false|TRUE|FALSE)/);
  return {
    minSpent: thresholdMatch ? Number(thresholdMatch[1]) : Number(fallback.minSpent || 0),
    discountPercent: discountMatch ? Number(discountMatch[1]) : Number(fallback.discountPercent || 0),
    priority: priorityMatch
      ? ["是", "true", "TRUE"].indexOf(priorityMatch[1]) >= 0
      : Boolean(fallback.priority)
  };
}

function resolveMembershipLevel_(spent, manualLevel, levels) {
  const manual = normalizeMembershipLevelName_(manualLevel);
  const manualMatch = manual
    ? levels.find(function (level) {
      return level.name === manual || level.key === manual;
    })
    : null;
  const level = manualMatch || levels.reduce(function (current, candidate) {
    return spent >= candidate.minSpent ? candidate : current;
  }, levels[0]);
  const levelIndex = Math.max(0, levels.indexOf(level));
  const nextLevel = levels[levelIndex + 1] || null;
  const nextLevelAmount = nextLevel ? Math.max(0, nextLevel.minSpent - spent) : 0;
  const previousFloor = level ? Number(level.minSpent || 0) : 0;
  const nextCeiling = nextLevel ? Number(nextLevel.minSpent || 0) : previousFloor;
  const progress = nextLevel
    ? Math.max(0, Math.min(100, Math.round(((spent - previousFloor) / Math.max(1, nextCeiling - previousFloor)) * 100)))
    : 100;

  return {
    level: level || levels[0],
    nextLevel: nextLevel,
    nextLevelAmount: nextLevelAmount,
    progressPercent: progress,
    isMaxLevel: !nextLevel
  };
}

function normalizeMembershipLevelName_(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const aliases = {
    normal: "普通會員",
    bronze: "青銅會員",
    silver: "白銀會員",
    gold: "黃金會員"
  };
  return aliases[text] || text;
}

function updateMemberMembershipColumns_(lineUserId, summary, existingSpreadsheet) {
  const spreadsheet = existingSpreadsheet || SpreadsheetApp.openById(SHEET_ID);
  const memberSheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME);
  if (!memberSheet || !lineUserId) return summary || null;
  ensureMemberWorkflowColumns_(memberSheet);
  const row = findMemberRow_(memberSheet, lineUserId);
  if (row <= 1) return summary || null;

  const nextSummary = summary || calculateMemberSummary_(lineUserId, spreadsheet);
  const profile = getMemberStatusForUser_(spreadsheet, lineUserId);
  const effectiveSpent = Number.isFinite(Number(profile.manualTotalSpent))
    && profile.manualTotalSpent !== ""
    ? Number(profile.manualTotalSpent)
    : Number(nextSummary.totalSpent || 0);
  const levelInfo = resolveMembershipLevel_(
    effectiveSpent,
    profile.manualLevel,
    getMembershipLevels_(spreadsheet)
  );

  memberSheet
    .getRange(row, MEMBER_FEATURE_COLUMNS.totalSpent, 1, 3)
    .setValues([[
      nextSummary.totalSpent,
      nextSummary.completedOrders,
      nextSummary.lastCompletedAt || ""
    ]]);
  memberSheet
    .getRange(row, MEMBER_FEATURE_COLUMNS.memberLevel, 1, 7)
    .setValues([[
      levelInfo.level.name,
      Boolean(levelInfo.level.priority),
      profile.manualLevel || "",
      profile.manualTotalSpent === "" ? "" : Number(profile.manualTotalSpent || 0),
      levelInfo.level.discountLabel,
      levelInfo.nextLevelAmount,
      new Date()
    ]]);
  memberSheet.getRange(row, MEMBER_FEATURE_COLUMNS.priorityQueue).insertCheckboxes();
  memberSheet.getRange(row, MEMBER_FEATURE_COLUMNS.priorityQueue)
    .setValue(Boolean(levelInfo.level.priority));
  return Object.assign({}, nextSummary, levelInfo, {
    effectiveSpent: effectiveSpent
  });
}

function addVerifiedAccountForOrder_(sheet, row) {
  const values = sheet.getRange(row, 1, 1, ORDER_FEATURE_LAST_COLUMN).getValues()[0];
  const paymentMethod = normalizePaymentMethod_(values[ORDER_FEATURE_PAYMENT_METHOD_COLUMN - 1]);
  const accountKey = normalizePaymentAccountKey_(
    values[ORDER_FEATURE_COLUMNS.paymentAccountKey - 1]
  );
  const lineUserId = String(values[ORDER_FEATURE_LINE_USER_ID_COLUMN - 1] || "").trim();
  const note = String(values[ORDER_FEATURE_COLUMNS.verificationNote - 1] || "").trim();
  if (!lineUserId || !accountKey || ["網銀", "街口"].indexOf(paymentMethod) < 0) return;

  const spreadsheet = sheet.getParent();
  const memberSheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME);
  if (!memberSheet) return;
  ensureMemberWorkflowColumns_(memberSheet);
  const memberRow = findMemberRow_(memberSheet, lineUserId);
  if (memberRow <= 1) return;

  const targetColumn = paymentMethod === "網銀"
    ? MEMBER_FEATURE_COLUMNS.verifiedBankAccounts
    : MEMBER_FEATURE_COLUMNS.verifiedJkoAccounts;
  const accounts = parseAccountList_(memberSheet.getRange(memberRow, targetColumn).getValue());
  if (accounts.indexOf(accountKey) < 0) accounts.push(accountKey);

  memberSheet.getRange(memberRow, targetColumn).setValue(accounts.join("\n"));
  memberSheet.getRange(memberRow, MEMBER_FEATURE_COLUMNS.requiresReverification).setValue(false);
  memberSheet.getRange(memberRow, MEMBER_FEATURE_COLUMNS.verificationNote).setValue(note);
  memberSheet.getRange(memberRow, MEMBER_FEATURE_COLUMNS.lastVerifiedAt).setValue(new Date());

  sheet.getRange(row, ORDER_FEATURE_COLUMNS.paymentVerificationStatus)
    .setValue("驗證通過（可傳截圖）");
  sheet.getRange(row, ORDER_FEATURE_COLUMNS.requiresReverificationCheckbox).setValue(false);
}

function markMemberRequiresReverification_(sheet, row) {
  const lineUserId = String(
    sheet.getRange(row, ORDER_FEATURE_LINE_USER_ID_COLUMN).getValue() || ""
  ).trim();
  if (!lineUserId) return;

  const memberSheet = sheet.getParent().getSheetByName(MEMBER_SHEET_NAME);
  if (!memberSheet) return;
  ensureMemberWorkflowColumns_(memberSheet);
  const memberRow = findMemberRow_(memberSheet, lineUserId);
  if (memberRow <= 1) return;

  const note = String(
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.verificationNote).getValue() || ""
  ).trim();
  memberSheet.getRange(memberRow, MEMBER_FEATURE_COLUMNS.requiresReverification).setValue(true);
  memberSheet.getRange(memberRow, MEMBER_FEATURE_COLUMNS.verificationNote).setValue(note);
  sheet.getRange(row, ORDER_FEATURE_COLUMNS.paymentVerificationStatus)
    .setValue("需要重新驗證");
}

function setupProductionWorkflow() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const orderSheet = spreadsheet.getSheetByName(SHEET_NAME) || getOrderSheet_();
  const memberSheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME) || getMemberSheet_();

  ensureOrderWorkflowColumns_(orderSheet);
  ensureMemberWorkflowColumns_(memberSheet);
  ensureWorkflowSettingsSheet_(spreadsheet);
  if (typeof getPaymentReplySheet_ === "function") getPaymentReplySheet_();

  const legacyStatusRowCount = Math.max(0, orderSheet.getLastRow() - 1);
  if (legacyStatusRowCount > 0) {
    const legacyStatusRange = orderSheet.getRange(
      2,
      ORDER_FEATURE_STATUS_COLUMN,
      legacyStatusRowCount,
      1
    );
    legacyStatusRange.clearDataValidations();
    const migratedStatuses = legacyStatusRange.getValues().map(function (row) {
      const status = String(row[0] || "").trim();
      return [status === "待付款" ? "訂單成立" : (status || WORKFLOW_ORDER_STATUS_DEFAULT)];
    });
    legacyStatusRange.setValues(migratedStatuses);
  }

  const compaction = compactOrderRows_(orderSheet);
  const existingDataRowCount = Math.max(0, orderSheet.getLastRow() - 1);
  const availableDataRowCount = Math.max(1, orderSheet.getMaxRows() - 1);
  if (existingDataRowCount > 0) {
    applyCheckboxesToOrderRows_(orderSheet, 2, existingDataRowCount);
  }

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(WORKFLOW_ORDER_STATUSES, true)
    .setAllowInvalid(false)
    .build();
  const paymentStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(WORKFLOW_PAYMENT_STATUSES, true)
    .setAllowInvalid(false)
    .build();
  const verificationStatusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(WORKFLOW_VERIFICATION_STATUSES, true)
    .setAllowInvalid(false)
    .build();

  orderSheet
    .getRange(2, ORDER_FEATURE_STATUS_COLUMN, availableDataRowCount, 1)
    .setDataValidation(statusRule);
  orderSheet
    .getRange(2, ORDER_FEATURE_COLUMNS.paymentStatus, availableDataRowCount, 1)
    .setDataValidation(paymentStatusRule);
  orderSheet
    .getRange(2, ORDER_FEATURE_COLUMNS.paymentVerificationStatus, availableDataRowCount, 1)
    .setDataValidation(verificationStatusRule);
  applyOrderSheetStaffView_(orderSheet);
  const memberLevelRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(MEMBERSHIP_LEVELS.map(function (level) {
      return level.name;
    }), true)
    .setAllowInvalid(true)
    .build();
  memberSheet
    .getRange(2, MEMBER_FEATURE_COLUMNS.manualLevel, Math.max(1, memberSheet.getMaxRows() - 1), 1)
    .setDataValidation(memberLevelRule);
  if (memberSheet.getLastRow() > 1) {
    memberSheet
      .getRange(2, MEMBER_FEATURE_COLUMNS.priorityQueue, memberSheet.getLastRow() - 1, 1)
      .insertCheckboxes();
  }

  rebuildAllMemberSummaries_();

  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return [
        "handleOrderCompletionEdit",
        "handleOrderWorkflowEdit",
        "sortProductionOrdersDaily",
        "processPendingOrderNotifications"
      ]
        .indexOf(trigger.getHandlerFunction()) >= 0;
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger("handleOrderWorkflowEdit")
    .forSpreadsheet(SHEET_ID)
    .onEdit()
    .create();
  ScriptApp.newTrigger("sortProductionOrdersDaily")
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .inTimezone("Asia/Taipei")
    .create();
  if (Object.keys(PropertiesService.getScriptProperties().getProperties()).some(function (key) {
    return key.indexOf(PENDING_NOTIFICATION_PREFIX) === 0;
  })) {
    ensurePendingOrderNotificationTrigger_();
  }

  console.log(
    "訂單列整理完成：原本最後一列 " + compaction.beforeLastRow
      + "，目前最後一列 " + compaction.afterLastRow
      + "，保留 " + compaction.orderCount + " 筆資料列。"
  );
  SpreadsheetApp.flush();
  return "正式收單、會員等級折扣、優先排單、背景LINE通知、每日排序、付款驗證、會員累積與自訂完成訊息已啟用。";
}

function organizeOrderSheetForStaff() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || getOrderSheet_();
  ensureOrderWorkflowColumns_(sheet);
  applyOrderSheetStaffView_(sheet);
  SpreadsheetApp.flush();
  return "訂單表已整理：已保留日常看單欄位，隱藏系統欄位與技術欄位。";
}

function applyOrderSheetStaffView_(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(1, sheet.getLastRow());
  const lastColumn = Math.max(ORDER_FEATURE_LAST_COLUMN, sheet.getLastColumn());

  sheet.getRange(1, 1, 1, ORDER_BASE_HEADERS.length).setValues([ORDER_BASE_HEADERS]);
  sheet.getRange(1, 1, 1, lastColumn)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.getRange(1, 1, 1, ORDER_BASE_HEADERS.length)
    .setBackground("#0f172a")
    .setFontColor("#ffffff");
  sheet.getRange(1, ORDER_FEATURE_COLUMNS.completedCheckbox, 1, WORKFLOW_ORDER_HEADERS.length)
    .setBackground("#312e81")
    .setFontColor("#ffffff");

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setTabColor("#2563eb");

  try {
    sheet.showColumns(1, lastColumn);
  } catch (error) {
    // Some legacy sheets may have fewer columns visible; width/hidden cleanup below still proceeds.
  }
  ORDER_STAFF_VIEW_HIDDEN_GROUPS.forEach(function (group) {
    const start = group[0];
    const count = group[1];
    if (start <= lastColumn) {
      sheet.hideColumns(start, Math.min(count, lastColumn - start + 1));
    }
  });

  Object.keys(ORDER_STAFF_VIEW_WIDTHS).forEach(function (column) {
    const index = Number(column);
    if (index <= lastColumn) sheet.setColumnWidth(index, ORDER_STAFF_VIEW_WIDTHS[column]);
  });
  sheet.setRowHeight(1, 42);
  sheet.getRange(1, 1, lastRow, lastColumn)
    .setWrap(true)
    .setVerticalAlignment("middle");

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn)
      .setBorder(false, false, true, false, false, false, "#e5e7eb", SpreadsheetApp.BorderStyle.SOLID);
  }

  try {
    const filter = sheet.getFilter();
    if (filter) filter.remove();
    sheet.getRange(1, 1, lastRow, ORDER_FEATURE_LAST_COLUMN).createFilter();
  } catch (error) {
    // If a user is actively filtering/protecting the sheet, do not block the cleanup.
  }
}

function compactOrderRows_(sheet) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const width = ORDER_FEATURE_LAST_COLUMN;
    const beforeLastRow = sheet.getLastRow();
    if (beforeLastRow <= 1) {
      return {
        beforeLastRow: beforeLastRow,
        afterLastRow: beforeLastRow,
        orderCount: 0
      };
    }

    const sourceRange = sheet.getRange(2, 1, beforeLastRow - 1, width);
    sourceRange.sort({ column: 1, ascending: false });
    SpreadsheetApp.flush();
    const source = sourceRange.getValues();
    const checkboxIndexes = [
      ORDER_FEATURE_COLUMNS.completedCheckbox - 1,
      ORDER_FEATURE_COLUMNS.accountVerifiedCheckbox - 1,
      ORDER_FEATURE_COLUMNS.requiresReverificationCheckbox - 1
    ];
    const meaningfulRows = source.filter(function (row) {
      return row.some(function (value, index) {
        if (checkboxIndexes.indexOf(index) >= 0) return value === true;
        return value !== "" && value !== null;
      });
    });

    if (meaningfulRows.length > 0) {
      const normalizedStatuses = meaningfulRows.map(function (row) {
        return [normalizeOrderStatusForSort_(row)];
      });
      sheet
        .getRange(2, ORDER_FEATURE_STATUS_COLUMN, meaningfulRows.length, 1)
        .setValues(normalizedStatuses);
    }
    const trailingRowCount = beforeLastRow - meaningfulRows.length - 1;
    if (trailingRowCount > 0) {
      const trailingStartRow = meaningfulRows.length + 2;
      sheet
        .getRange(
          trailingStartRow,
          ORDER_FEATURE_COLUMNS.completedCheckbox,
          trailingRowCount,
          1
        )
        .clearContent();
      sheet
        .getRange(
          trailingStartRow,
          ORDER_FEATURE_COLUMNS.accountVerifiedCheckbox,
          trailingRowCount,
          2
        )
        .clearContent();
    }
    SpreadsheetApp.flush();

    return {
      beforeLastRow: beforeLastRow,
      afterLastRow: meaningfulRows.length + 1,
      orderCount: meaningfulRows.length
    };
  } finally {
    lock.releaseLock();
  }
}

function normalizeOrderStatusForSort_(row) {
  const current = String(row[ORDER_FEATURE_STATUS_COLUMN - 1] || "").trim();
  if (WORKFLOW_ORDER_STATUSES.indexOf(current) >= 0) return current;
  if (
    Boolean(row[ORDER_FEATURE_COLUMNS.completedCheckbox - 1])
    || current === "已完成"
  ) {
    return "已完成";
  }
  if (current === "已取消") return "已取消";
  if (
    Boolean(row[ORDER_FEATURE_COLUMNS.accountVerifiedCheckbox - 1])
    || String(
      row[ORDER_FEATURE_COLUMNS.paymentVerificationStatus - 1] || ""
    ).trim() === "驗證通過（可傳截圖）"
    || current === "驗證通過"
    || current === "處理中"
  ) {
    return "已驗證";
  }
  return WORKFLOW_ORDER_STATUS_DEFAULT;
}

function sortProductionOrdersDaily() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || getOrderSheet_();
  ensureOrderWorkflowColumns_(sheet);
  const result = compactOrderRows_(sheet);
  if (result.orderCount > 0) {
    applyCheckboxesToOrderRows_(sheet, 2, result.orderCount);
  }
  SpreadsheetApp.flush();
  console.log(
    "每日訂單排序完成：最新訂單在上，昨天與更早訂單在下，共 "
      + result.orderCount + " 筆。"
  );
  return result;
}

function applyCheckboxesToOrderRows_(sheet, startRow, rowCount) {
  if (!sheet || rowCount <= 0) return;

  const completedRange = sheet.getRange(
    startRow,
    ORDER_FEATURE_COLUMNS.completedCheckbox,
    rowCount,
    1
  );
  const completedValues = completedRange.getValues().map(function (row) {
    return [Boolean(row[0])];
  });
  completedRange.insertCheckboxes();
  completedRange.setValues(completedValues);

  const verificationRange = sheet.getRange(
    startRow,
    ORDER_FEATURE_COLUMNS.accountVerifiedCheckbox,
    rowCount,
    2
  );
  const verificationValues = verificationRange.getValues().map(function (row) {
    return [Boolean(row[0]), Boolean(row[1])];
  });
  verificationRange.insertCheckboxes();
  verificationRange.setValues(verificationValues);

  const priorityRange = sheet.getRange(
    startRow,
    ORDER_FEATURE_COLUMNS.priorityQueue,
    rowCount,
    1
  );
  const priorityValues = priorityRange.getValues().map(function (row) {
    return [Boolean(row[0])];
  });
  priorityRange.insertCheckboxes();
  priorityRange.setValues(priorityValues);
}

function setupMembershipFeatures() {
  return setupProductionWorkflow();
}

function applyLatestMembershipThresholds() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ensureWorkflowSettingsSheet_(spreadsheet);
  MEMBERSHIP_LEVEL_SETTING_KEYS.forEach(function (setting) {
    const key = "會員等級：" + setting[0];
    const value = "門檻=" + setting[1]
      + ";折扣=" + setting[2]
      + ";優先=" + (setting[3] ? "是" : "否");
    const row = ensureWorkflowSettingRow_(
      sheet,
      key,
      value,
      "會員等級設定。門檻為累積消費金額；折扣是折抵百分比，例如 1 代表 99 折、2 代表 98 折。"
    );
    sheet.getRange(row, 2).setValue(value);
  });
  rebuildAllMemberSummaries_();
  SpreadsheetApp.flush();
  return "會員門檻已更新：青銅 30,000、白銀 50,000、黃金 100,000。";
}

function ensureOrderWorkflowColumns_(sheet) {
  const startColumn = ORDER_FEATURE_COLUMNS.completedCheckbox;
  const current = sheet
    .getRange(1, startColumn, 1, WORKFLOW_ORDER_HEADERS.length)
    .getValues()[0];
  const changed = current.some(function (value, index) {
    return String(value || "") !== WORKFLOW_ORDER_HEADERS[index];
  });
  if (changed) {
    sheet
      .getRange(1, startColumn, 1, WORKFLOW_ORDER_HEADERS.length)
      .setValues([WORKFLOW_ORDER_HEADERS]);
  }
  sheet.getRange(1, startColumn, 1, WORKFLOW_ORDER_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#312e81")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
}

function ensureMemberWorkflowColumns_(sheet) {
  const startColumn = MEMBER_FEATURE_COLUMNS.totalSpent;
  const current = sheet
    .getRange(1, startColumn, 1, WORKFLOW_MEMBER_HEADERS.length)
    .getValues()[0];
  const changed = current.some(function (value, index) {
    return String(value || "") !== WORKFLOW_MEMBER_HEADERS[index];
  });
  if (changed) {
    sheet
      .getRange(1, startColumn, 1, WORKFLOW_MEMBER_HEADERS.length)
      .setValues([WORKFLOW_MEMBER_HEADERS]);
  }
  sheet.getRange(1, startColumn, 1, WORKFLOW_MEMBER_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#065f46")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
}

function ensureWorkflowSettingsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(WORKFLOW_SETTINGS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(WORKFLOW_SETTINGS_SHEET_NAME);

  const headers = ["設定項目", "內容", "說明"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  ensureWorkflowSettingRow_(
    sheet,
    "訂單完成訊息",
    WORKFLOW_DEFAULT_COMPLETION_MESSAGE,
    "訂單改成「已完成」時自動傳給客人。可使用：{LINE名稱}、{訂單編號}、{遊戲}、{方案}、{金額}、{累積消費}、{完成訂單數}、{會員等級}"
  );
  MEMBERSHIP_LEVEL_SETTING_KEYS.forEach(function (row) {
    ensureWorkflowSettingRow_(
      sheet,
      "會員等級：" + row[0],
      "門檻=" + row[1] + ";折扣=" + row[2] + ";優先=" + (row[3] ? "是" : "否"),
      "會員等級設定。門檻為累積消費金額；折扣是折抵百分比，例如 1 代表 99 折、2 代表 98 折。"
    );
  });

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 3)
    .setFontWeight("bold")
    .setBackground("#7c2d12")
    .setFontColor("#ffffff");
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 620);
  sheet.setColumnWidth(3, 520);
  sheet.getRange(1, 1, Math.max(2, sheet.getLastRow()), 3)
    .setWrap(true)
    .setVerticalAlignment("middle");
  return sheet;
}

function ensureWorkflowSettingRow_(sheet, key, value, note) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let index = 0; index < keys.length; index += 1) {
      if (String(keys[index][0] || "").trim() === key) return index + 2;
    }
  }
  sheet.appendRow([key, value, note]);
  return sheet.getLastRow();
}

function getWorkflowSetting_(key, fallback) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ensureWorkflowSettingsSheet_(spreadsheet);
  if (sheet.getLastRow() <= 1) return fallback;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index][0] || "").trim() === key) {
      return String(rows[index][1] || "").trim() || fallback;
    }
  }
  return fallback;
}

function handleOrderCompletionEdit(event) {
  handleOrderWorkflowEdit(event);
}

function handleDiscordWorkflowEdit_(sheet, row, column, value) {
  const context = getDiscordOrderContextFromRow_(sheet, row);
  const order = context.order;
  const member = context.member;
  const normalizedValue = String(value || "").trim();

  if (column === ORDER_FEATURE_PAYMENT_METHOD_COLUMN) {
    notifyDiscordOrderEvent_(
      sheet,
      row,
      "payment_review",
      "payment_method_" + normalizedValue,
      order,
      member,
      {
        paymentStatus: order.paymentStatus || "未付款",
        detail: "付款方式已改為「" + (normalizedValue || "未選擇") + "」"
      }
    );
    return;
  }

  if (column === ORDER_FEATURE_COLUMNS.paymentStatus) {
    if (["付款異常", "退款中", "已退款"].indexOf(normalizedValue) >= 0) {
      notifyDiscordOrderEvent_(
        sheet,
        row,
        "anomaly",
        "payment_status_" + normalizedValue,
        order,
        member,
        {
          paymentStatus: normalizedValue,
          detail: "付款狀態更新為「" + normalizedValue + "」"
        }
      );
    } else if (normalizedValue && normalizedValue !== "未付款") {
      notifyDiscordOrderEvent_(
        sheet,
        row,
        "payment_review",
        "payment_status_" + normalizedValue,
        order,
        member,
        {
          paymentStatus: normalizedValue,
          detail: "客人付款狀態已更新，請進行人工核對"
        }
      );
    }
    return;
  }

  if (column === ORDER_FEATURE_COLUMNS.paymentVerificationStatus) {
    if (["驗證異常", "需要重新驗證"].indexOf(normalizedValue) >= 0) {
      notifyDiscordOrderEvent_(
        sheet,
        row,
        "anomaly",
        "verification_" + normalizedValue,
        order,
        member,
        {
          paymentStatus: order.paymentStatus || "待客服確認",
          detail: "付款驗證狀態：「" + normalizedValue + "」"
        }
      );
    } else if (normalizedValue && normalizedValue !== "待驗證") {
      notifyDiscordOrderEvent_(
        sheet,
        row,
        "payment_review",
        "verification_" + normalizedValue,
        order,
        member,
        {
          paymentStatus: order.paymentStatus || "待審核",
          detail: "付款驗證狀態：「" + normalizedValue + "」"
        }
      );
    }
    return;
  }

  if (
    column === ORDER_FEATURE_COLUMNS.accountVerifiedCheckbox
    && normalizedValue.toUpperCase() === "TRUE"
  ) {
    notifyDiscordOrderEvent_(
      sheet,
      row,
      "payment_review",
      "account_verified",
      order,
      member,
      {
        paymentStatus: "已驗證",
        detail: "付款帳戶已由後台人工驗證"
      }
    );
    return;
  }

  if (
    column === ORDER_FEATURE_COLUMNS.requiresReverificationCheckbox
    && normalizedValue.toUpperCase() === "TRUE"
  ) {
    notifyDiscordOrderEvent_(
      sheet,
      row,
      "anomaly",
      "requires_reverification",
      order,
      member,
      {
        paymentStatus: "待客服確認",
        detail: "此訂單需要重新驗證付款帳戶"
      }
    );
    return;
  }

  if (column === ORDER_FEATURE_STATUS_COLUMN && normalizedValue === "已驗證") {
    notifyDiscordOrderEvent_(
      sheet,
      row,
      "payment_review",
      "order_verified",
      order,
      member,
      {
        paymentStatus: "已驗證",
        detail: "訂單已確認為本人付款"
      }
    );
  } else if (column === ORDER_FEATURE_STATUS_COLUMN && normalizedValue === "已取消") {
    notifyDiscordOrderEvent_(
      sheet,
      row,
      "anomaly",
      "order_cancelled",
      order,
      member,
      {
        paymentStatus: order.paymentStatus || "已取消",
        detail: "訂單已取消，請確認是否需要後續處理"
      }
    );
  }
}

function handleOrderWorkflowEdit(event) {
  if (!event || !event.range) return;

  const sheet = event.range.getSheet();
  const row = event.range.getRow();
  const column = event.range.getColumn();
  const value = String(event.value || "");
  if (row <= 1) return;

  if (sheet.getName() === PRODUCT_SHEET_NAME) {
    CacheService.getScriptCache().remove(PRODUCT_CATALOG_CACHE_KEY);
    return;
  }

  if (sheet.getName() === MEMBER_SHEET_NAME) {
    if (
      column === MEMBER_FEATURE_COLUMNS.manualLevel
      || column === MEMBER_FEATURE_COLUMNS.manualTotalSpent
    ) {
      const lineUserId = String(sheet.getRange(row, 1).getValue() || "").trim();
      if (lineUserId) updateMemberMembershipColumns_(lineUserId, null, sheet.getParent());
    }
    return;
  }

  if (sheet.getName() === WORKFLOW_SETTINGS_SHEET_NAME) {
    const key = String(sheet.getRange(row, 1).getValue() || "").trim();
    if (column === 2 && key.indexOf("會員等級：") === 0) {
      rebuildAllMemberSummaries_();
    }
    return;
  }

  if (sheet.getName() !== SHEET_NAME) return;

  if (
    column === ORDER_FEATURE_COLUMNS.accountVerifiedCheckbox
    && value.toUpperCase() === "TRUE"
  ) {
    addVerifiedAccountForOrder_(sheet, row);
    sheet.getRange(row, ORDER_FEATURE_STATUS_COLUMN).setValue("已驗證");
  }

  if (
    column === ORDER_FEATURE_COLUMNS.paymentVerificationStatus
    && value === "驗證通過（可傳截圖）"
  ) {
    sheet.getRange(row, ORDER_FEATURE_STATUS_COLUMN).setValue("已驗證");
  }

  if (
    column === ORDER_FEATURE_COLUMNS.paymentStatus
    || column === ORDER_FEATURE_COLUMNS.paymentVerificationStatus
  ) {
    const lineUserId = String(
      sheet.getRange(row, ORDER_FEATURE_LINE_USER_ID_COLUMN).getValue() || ""
    ).trim();
    if (lineUserId) refreshMemberSummaryForUser_(lineUserId, sheet.getParent());
  }

  if (
    column === ORDER_FEATURE_COLUMNS.requiresReverificationCheckbox
    && value.toUpperCase() === "TRUE"
  ) {
    markMemberRequiresReverification_(sheet, row);
  }

  handleDiscordWorkflowEdit_(sheet, row, column, value);

  const checkedComplete = column === ORDER_FEATURE_COLUMNS.completedCheckbox
    && value.toUpperCase() === "TRUE";
  const statusComplete = column === ORDER_FEATURE_STATUS_COLUMN && value === "已完成";

  if (column === ORDER_FEATURE_STATUS_COLUMN && value !== "已完成") {
    const lineUserId = String(
      sheet.getRange(row, ORDER_FEATURE_LINE_USER_ID_COLUMN).getValue() || ""
    ).trim();
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.completedCheckbox).setValue(false);
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.settlementState).clearContent();
    if (lineUserId) refreshMemberSummaryForUser_(lineUserId, sheet.getParent());
    return;
  }

  if (!checkedComplete && !statusComplete) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    finalizeOrderRow_(sheet, row);
  } finally {
    lock.releaseLock();
  }
}

function finalizeOrderRow_(sheet, row) {
  const values = sheet.getRange(row, 1, 1, ORDER_FEATURE_LAST_COLUMN).getValues()[0];
  const orderId = String(values[1] || "").trim();
  const lineDisplayName = String(values[3] || "LINE 會員").trim();
  const gameName = String(values[4] || "").trim();
  const productName = String(values[5] || "").trim();
  const total = Number(values[ORDER_FEATURE_TOTAL_COLUMN - 1] || 0);
  const sourceAccount = getSourceAccount_(values[2] || "dc");
  const lineUserId = String(values[ORDER_FEATURE_LINE_USER_ID_COLUMN - 1] || "").trim();
  const completedAt = values[ORDER_FEATURE_COLUMNS.completedAt - 1];
  const notifiedAt = values[ORDER_FEATURE_COLUMNS.notifiedAt - 1];

  if (!orderId) throw new Error("這一列沒有訂單編號，不能標記完成。");

  const now = new Date();
  sheet.getRange(row, ORDER_FEATURE_STATUS_COLUMN).setValue("已完成");
  sheet.getRange(row, ORDER_FEATURE_COLUMNS.completedCheckbox).setValue(true);
  const paymentStatus = String(values[ORDER_FEATURE_COLUMNS.paymentStatus - 1] || "").trim();
  if (!paymentStatus || paymentStatus === "未付款") {
    sheet.getRange(row, ORDER_FEATURE_COLUMNS.paymentStatus).setValue("已付款");
  }
  if (!completedAt) sheet.getRange(row, ORDER_FEATURE_COLUMNS.completedAt).setValue(now);

  const summary = lineUserId
    ? refreshMemberSummaryForUser_(lineUserId, sheet.getParent())
    : { totalSpent: 0, completedOrders: 0 };
  sheet.getRange(row, ORDER_FEATURE_COLUMNS.settlementState)
    .setValue(lineUserId ? "已計入會員" : "缺少 LINE ID");

  let completionLineError = "";
  if (!notifiedAt && lineUserId) {
    const template = getWorkflowSetting_(
      "訂單完成訊息",
      WORKFLOW_DEFAULT_COMPLETION_MESSAGE
    );
    const replacements = {
      "{LINE名稱}": lineDisplayName,
      "{訂單編號}": orderId,
      "{遊戲}": gameName,
      "{方案}": productName,
      "{金額}": "NT$ " + formatMoney_(total),
      "{累積消費}": "NT$ " + formatMoney_(summary.totalSpent),
      "{完成訂單數}": String(summary.completedOrders),
      "{會員等級}": summary.level ? summary.level.name : "普通會員"
    };
    let message = template;
    Object.keys(replacements).forEach(function (key) {
      message = message.split(key).join(replacements[key]);
    });

    try {
      assertLinePushSucceeded_(
        pushLineText_(lineUserId, message, sourceAccount),
        "訂單完成訊息"
      );
      sheet.getRange(row, ORDER_FEATURE_COLUMNS.notifiedAt).setValue(now);
    } catch (error) {
      completionLineError = getSafeErrorMessage_(error);
      appendLineError_(sheet, row, completionLineError);
    }
  }

  const discordContext = getDiscordOrderContextFromRow_(sheet, row);
  if (completionLineError) {
    notifyDiscordOrderEvent_(
      sheet,
      row,
      "anomaly",
      "completion_line_delivery_failure",
      discordContext.order,
      discordContext.member,
      {
        paymentStatus: "已完成／客人通知失敗",
        detail: completionLineError
      }
    );
  }
  notifyDiscordOrderEvent_(
    sheet,
    row,
    "completed",
    "order_completed",
    discordContext.order,
    discordContext.member,
    {
      paymentStatus: "已付款",
      detail: "訂單已完成，會員累積消費已更新"
    }
  );
}

function appendLineError_(sheet, row, message) {
  const cell = sheet.getRange(row, ORDER_FEATURE_COLUMNS.lineErrorLog);
  const previous = String(cell.getValue() || "").trim();
  const timestamp = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  cell.setValue(
    [previous, timestamp + " " + String(message || "")].filter(Boolean).join("\n").slice(-2000)
  );
}

function refreshMemberSummaryForUser_(lineUserId, existingSpreadsheet) {
  const spreadsheet = existingSpreadsheet || SpreadsheetApp.openById(SHEET_ID);
  const summary = calculateMemberSummary_(lineUserId, spreadsheet);
  const memberSheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME);
  if (!memberSheet) return summary;
  ensureMemberWorkflowColumns_(memberSheet);
  const memberRow = findMemberRow_(memberSheet, lineUserId);

  if (memberRow > 0) {
    return updateMemberMembershipColumns_(lineUserId, summary, spreadsheet) || summary;
  }
  return summary;
}

function rebuildAllMemberSummaries_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const memberSheet = spreadsheet.getSheetByName(MEMBER_SHEET_NAME);
  if (!memberSheet || memberSheet.getLastRow() <= 1) return;
  ensureMemberWorkflowColumns_(memberSheet);

  const userIds = memberSheet.getRange(2, 1, memberSheet.getLastRow() - 1, 1).getValues();
  userIds.forEach(function (row) {
    const lineUserId = String(row[0] || "").trim();
    if (lineUserId) refreshMemberSummaryForUser_(lineUserId, spreadsheet);
  });
}

function calculateMemberSummary_(lineUserId, existingSpreadsheet) {
  const spreadsheet = existingSpreadsheet || SpreadsheetApp.openById(SHEET_ID);
  const orderSheet = spreadsheet.getSheetByName(SHEET_NAME);
  const summary = {
    totalSpent: 0,
    completedOrders: 0,
    lastCompletedAt: "",
    orders: []
  };
  if (!orderSheet || !lineUserId || orderSheet.getLastRow() <= 1) return summary;

  const width = Math.max(ORDER_FEATURE_LAST_COLUMN, orderSheet.getLastColumn());
  const rows = orderSheet.getRange(2, 1, orderSheet.getLastRow() - 1, width).getValues();
  rows.forEach(function (row) {
    const rowUserId = String(row[ORDER_FEATURE_LINE_USER_ID_COLUMN - 1] || "").trim();
    if (rowUserId !== lineUserId) return;

    const total = Number(row[ORDER_FEATURE_TOTAL_COLUMN - 1] || 0);
    const completedAt = row[ORDER_FEATURE_COLUMNS.completedAt - 1] || row[0] || "";
    if (isOrderCountableForMembership_(row)) {
      summary.totalSpent += Number.isFinite(total) ? total : 0;
      summary.completedOrders += 1;
      if (!summary.lastCompletedAt || new Date(completedAt) > new Date(summary.lastCompletedAt)) {
        summary.lastCompletedAt = completedAt;
      }
    }
    summary.orders.push({
      orderId: String(row[1] || ""),
      orderedAt: row[0] || "",
      completedAt: completedAt,
      gameName: String(row[4] || ""),
      productName: String(row[5] || ""),
      total: Number.isFinite(total) ? total : 0,
      status: String(row[ORDER_FEATURE_STATUS_COLUMN - 1] || "").trim()
    });
  });

  summary.orders.sort(function (a, b) {
    return new Date(b.orderedAt || b.completedAt) - new Date(a.orderedAt || a.completedAt);
  });
  summary.orders = summary.orders.slice(0, 20);
  return summary;
}

function isOrderCountableForMembership_(row) {
  const orderStatus = String(row[ORDER_FEATURE_STATUS_COLUMN - 1] || "").trim();
  const paymentStatus = String(row[ORDER_FEATURE_COLUMNS.paymentStatus - 1] || "").trim();
  const verificationStatus = String(row[ORDER_FEATURE_COLUMNS.paymentVerificationStatus - 1] || "").trim();
  if (orderStatus !== "已完成") return false;
  if (["已取消", "取消", "退款", "退款中", "已退款"].indexOf(orderStatus) >= 0) return false;
  if (["未付款", "付款待審核", "退款", "退款中", "已退款", "付款異常", "審核失敗"].indexOf(paymentStatus) >= 0) return false;
  if (["審核失敗", "驗證異常"].indexOf(verificationStatus) >= 0) return false;
  return true;
}

function memberProfileResponse_(params) {
  const safeParams = params || {};
  try {
    const sourceAccount = getSourceAccount_(safeParams.sourceAccount || safeParams.memberSource);
    const member = getVerifiedLineMemberCached_(safeParams, sourceAccount);
    if (!member.verified || !member.userId) {
      return jsonpResponse_(safeParams.callback, {
        ok: false,
        error: "LINE_MEMBER_REQUIRED",
        message: "請先登入 LINE 會員。"
      });
    }

    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const summary = calculateMemberSummary_(member.userId, spreadsheet);
    const storedStatus = getMemberStatusForUser_(spreadsheet, member.userId);
    const effectiveSpent = storedStatus.manualTotalSpent !== ""
      ? Math.max(0, Number(storedStatus.manualTotalSpent || 0))
      : Math.max(0, Number(summary.totalSpent || 0));
    const status = Object.assign(
      {},
      storedStatus,
      resolveMembershipLevel_(
        effectiveSpent,
        storedStatus.manualLevel,
        getMembershipLevels_(spreadsheet)
      ),
      { effectiveSpent: effectiveSpent }
    );
    const levels = getMembershipLevels_(spreadsheet).map(function (level) {
      return {
        name: level.name,
        minSpent: level.minSpent,
        discountLabel: level.discountLabel,
        discountPercent: level.discountPercent,
        priorityQueue: Boolean(level.priority)
      };
    });
    return jsonpResponse_(safeParams.callback, {
      ok: true,
      data: {
        displayName: member.displayName || "",
        totalSpent: summary.totalSpent,
        effectiveSpent: status.effectiveSpent,
        completedOrders: summary.completedOrders,
        lastCompletedAt: summary.lastCompletedAt || "",
        memberLevel: status.level.name,
        memberLevelKey: status.level.key,
        discountLabel: status.level.discountLabel,
        discountPercent: status.level.discountPercent,
        priorityQueue: Boolean(status.level.priority),
        nextLevel: status.nextLevel ? status.nextLevel.name : "",
        nextLevelAmount: status.nextLevelAmount,
        progressPercent: status.progressPercent,
        isMaxLevel: status.isMaxLevel,
        levels: levels,
        orders: summary.orders
      }
    });
  } catch (error) {
    return jsonpResponse_(safeParams.callback, {
      ok: false,
      error: "MEMBER_PROFILE_FAILED",
      message: getSafeErrorMessage_(error)
    });
  }
}

function findMemberRow_(sheet, lineUserId) {
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  const userIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < userIds.length; index += 1) {
    if (String(userIds[index][0] || "").trim() === lineUserId) return index + 2;
  }
  return 0;
}

function formatMoney_(value) {
  return Math.max(0, Number(value || 0)).toLocaleString("zh-TW");
}

/**
 * 安全自我檢查：建立一筆測試訂單後立刻刪除，不會傳送 LINE。
 * 用來確認試算表可寫入、39 個欄位、單則付款教學、設定與觸發器都已就緒。
 */
function runProductionSelfTest() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || getOrderSheet_();
  ensureOrderWorkflowColumns_(sheet);
  ensureWorkflowSettingsSheet_(spreadsheet);

  Object.keys(WORKFLOW_PAYMENT_GUIDANCE).forEach(function (method) {
    const text = WORKFLOW_PAYMENT_GUIDANCE[method];
    if (!text || text.indexOf("禁止第三方") < 0) {
      throw new Error(method + " 缺少禁止第三方付款提醒。");
    }
    const message = buildOrderPaymentMessage_(
      spreadsheet,
      {
        orderId: "SELFTEST-MESSAGE",
        gameName: "測試遊戲",
        productName: "測試方案",
        quantity: 1,
        total: 1,
        payment: method,
        playerId: "TEST-UID",
        serverName: "TEST"
      },
      {}
    );
    if (
      message.indexOf("✅ 訂單已成立") < 0
      || message.indexOf("請依下一則") >= 0
      || message.length > 5000
    ) {
      throw new Error(method + " 單則 LINE 訊息格式異常。");
    }
  });

  const testId = "SELFTEST-" + Utilities.formatDate(
    new Date(),
    "Asia/Taipei",
    "yyyyMMddHHmmss"
  );
  const rowValues = [
    new Date(),
    testId,
    "系統自我檢查",
    "測試會員",
    "測試遊戲",
    "測試方案",
    1,
    1,
    1,
    "網銀",
    "TEST-UID",
    "TEST",
    "訂單成立",
    "LINE會員已驗證",
    "SELFTEST-LINE-USER",
    "完成後自動刪除",
    false,
    "",
    "",
    "",
    "未付款",
    "待驗證",
    "測試銀行 00000",
    false,
    false,
    "",
    "自我檢查，不傳送LINE",
    "",
    "",
    WORKFLOW_VERSION,
    1,
    "普通會員",
    "無折扣",
    0,
    1,
    false,
    "自我檢查，不排程",
    "",
    ""
  ];

  let testRow = 0;
  try {
    sheet.appendRow(rowValues);
    SpreadsheetApp.flush();
    testRow = findOrderRowById_(sheet, testId);
    if (testRow <= 1) throw new Error("測試訂單寫入後找不到。");

    const stored = sheet
      .getRange(testRow, 1, 1, ORDER_FEATURE_LAST_COLUMN)
      .getValues()[0];
    if (
      String(stored[1] || "") !== testId
      || Number(stored[ORDER_FEATURE_TOTAL_COLUMN - 1] || 0) !== 1
      || String(stored[ORDER_FEATURE_COLUMNS.workflowVersion - 1] || "") !== WORKFLOW_VERSION
    ) {
      throw new Error("測試訂單欄位內容不一致。");
    }
  } finally {
    if (testRow > 1) {
      sheet.deleteRow(testRow);
      SpreadsheetApp.flush();
    }
  }

  const triggerReady = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === "handleOrderWorkflowEdit";
  });
  if (!triggerReady) throw new Error("訂單編輯觸發器尚未建立。");
  if (!getLineAccessToken_("dc")) throw new Error("DC 官方 LINE Token 尚未設定。");
  Object.keys(DISCORD_WEBHOOK_PROPERTY_KEYS).forEach(function (channelType) {
    const propertyKey = DISCORD_WEBHOOK_PROPERTY_KEYS[channelType];
    if (!getScriptProperty_(propertyKey)) {
      throw new Error(propertyKey + " 尚未設定。");
    }
  });

  return "PASS：訂單可寫入並讀回、39欄完整、四種單則 LINE 付款訊息、會員等級欄位、完成訊息設定、Discord 四頻道與觸發器正常。";
}
