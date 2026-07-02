const ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwDT3asNWUlAHI3D5Yv7sjSkHPToDpj0Yk5wU7Pb-eiXAkWIUqJQ-nxdWCgcr4gpYZB/exec";
const STUDIO_BRAND_NAME = window.STUDIO_BRAND_NAME || "陳龍龍工作室";
const LINE_CHANNEL = resolveLineChannel();
const LINE_LIFF_ID = String(LINE_CHANNEL.liffId || window.LINE_LIFF_ID || "").trim();
const LINE_SOURCE_ACCOUNT = LINE_CHANNEL.sourceAccount || LINE_CHANNEL.key || "dc";
const LINE_SOURCE_NAME = LINE_CHANNEL.sourceName || "小號 DC手遊代儲";
const ORDER_PREFIX = LINE_CHANNEL.orderPrefix || window.ORDER_PREFIX || "CLL";
const ORDER_SUBMIT_TIMEOUT_MS = 25000;
const CATALOG_SYNC_TIMEOUT_MS = 4500;
const LINE_MEMBER_CACHE_KEY = `cll_line_member_${LINE_SOURCE_ACCOUNT}`;
const LINE_MEMBER_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MEMBER_PROFILE_CACHE_KEY = `cll_member_profile_${LINE_SOURCE_ACCOUNT}`;
const MEMBER_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
const CATALOG_CACHE_KEY = `cll_catalog_${LINE_SOURCE_ACCOUNT}`;
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const CURRENT_PAGE = document.documentElement.dataset.page || "prices";
const PAGE_PARAMS = new URLSearchParams(window.location.search);
const REQUESTED_GAME_ID = String(PAGE_PARAMS.get("game") || "").trim();
const REQUESTED_PLAN_ID = String(PAGE_PARAMS.get("plan") || "").trim();
const REQUESTED_PUBGM_REGION = String(PAGE_PARAMS.get("region") || "").trim();
const REQUESTED_PUBGM_METHOD = String(PAGE_PARAMS.get("method") || "").trim();
const TERMS_VERSION = "2026-06-29";
const PAYMENT_SETTINGS_GAME_ID = "payment-settings";
const DEFAULT_PAYMENT_INSTRUCTIONS = {
  "網銀": "請聯絡官方 LINE 客服取得銀行帳號，完成轉帳後回傳帳號末五碼。",
  "無卡": "請聯絡官方 LINE 客服取得無卡存款資料，完成後回傳存款資訊。",
  "LINE Pay": "請聯絡官方 LINE 客服取得 LINE Pay 付款方式，付款後回傳完成畫面。",
  "街口": "請聯絡官方 LINE 客服取得街口支付方式，付款後回傳完成畫面。",
  ...(window.PAYMENT_INSTRUCTIONS || {})
};

let data = normalizeCatalog(window.STUDIO_DATA);
let games = [];
let paymentInstructions = { ...DEFAULT_PAYMENT_INSTRUCTIONS };
let selectedCategory = "所有遊戲";
let selectedGameId = "";
let selectedPlanId = "";
let selectedPaymentMethod = "網銀";
let selectedPubgmRegion = "tw";
let selectedPubgmMethod = "uid";
let lineReady = false;
let lineMember = null;
let memberProfile = null;
let isSubmittingOrder = false;
let catalogSignature = "";
let gameSearchTimer = 0;
let jsonpSequence = 0;

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

const categoryTabs = document.querySelector("#categoryTabs");
const gameGrid = document.querySelector("#gameGrid");
const gameSearch = document.querySelector("#gameSearch");
const gameSelect = document.querySelector("#gameSelect");
const planSelect = document.querySelector("#planSelect");
const planField = document.querySelector("#planField");
const planPicker = document.querySelector("#planPicker");
const planPickerButton = document.querySelector("#planPickerButton");
const planPickerMenu = document.querySelector("#planPickerMenu");
const quantity = document.querySelector("#quantity");
const serverName = document.querySelector("#serverName");
const playerId = document.querySelector("#playerId");
const playerName = document.querySelector("#playerName");
const paymentAccountField = document.querySelector("#paymentAccountField");
const paymentAccountKey = document.querySelector("#paymentAccountKey");
const paymentAccountHint = document.querySelector("#paymentAccountHint");
const gameLoginMethodField = document.querySelector("#gameLoginMethodField");
const gameLoginAccountField = document.querySelector("#gameLoginAccountField");
const gameLoginPasswordField = document.querySelector("#gameLoginPasswordField");
const loginInfoHint = document.querySelector("#loginInfoHint");
const gameLoginMethod = document.querySelector("#gameLoginMethod");
const gameLoginAccount = document.querySelector("#gameLoginAccount");
const gameLoginPassword = document.querySelector("#gameLoginPassword");
const verifyStatus = document.querySelector("#verifyStatus");
const summaryGame = document.querySelector("#summaryGame");
const summaryPlan = document.querySelector("#summaryPlan");
const summaryEta = document.querySelector("#summaryEta");
const summaryTotal = document.querySelector("#summaryTotal");
const summaryOriginalTotal = document.querySelector("#summaryOriginalTotal");
const summaryMemberLevel = document.querySelector("#summaryMemberLevel");
const summaryDiscount = document.querySelector("#summaryDiscount");
const priceList = document.querySelector("#priceList");
const catalogFilters = document.querySelector("#catalogFilters");
const orderForm = document.querySelector("#orderForm");
const confirmation = document.querySelector("#confirmation");
const notes = document.querySelector("#notes");
const lineMemberPanel = document.querySelector("#lineMemberPanel");
const lineMemberName = document.querySelector("#lineMemberName");
const lineMemberHint = document.querySelector("#lineMemberHint");
const lineLoginButton = document.querySelector("#lineLoginButton");
const lineMemberSummary = document.querySelector("#lineMemberSummary");
const memberTotalSpent = document.querySelector("#memberTotalSpent");
const memberCompletedOrders = document.querySelector("#memberCompletedOrders");
const memberLevelName = document.querySelector("#memberLevelName");
const memberDiscountLabel = document.querySelector("#memberDiscountLabel");
const paymentPreview = document.querySelector("#paymentPreview");
const memberAreaLoginButton = document.querySelector("#memberAreaLoginButton");
const areaMemberLevel = document.querySelector("#areaMemberLevel");
const areaMemberHint = document.querySelector("#areaMemberHint");
const areaTotalSpent = document.querySelector("#areaTotalSpent");
const areaProgressFill = document.querySelector("#areaProgressFill");
const areaNextLevelText = document.querySelector("#areaNextLevelText");
const areaDiscountLabel = document.querySelector("#areaDiscountLabel");
const areaPriorityStatus = document.querySelector("#areaPriorityStatus");
const areaCompletedOrders = document.querySelector("#areaCompletedOrders");
const areaDiscountPercent = document.querySelector("#areaDiscountPercent");
const areaOrderCount = document.querySelector("#areaOrderCount");
const areaRecentOrders = document.querySelector("#areaRecentOrders");
const levelRuleGrid = document.querySelector("#levelRuleGrid");
const termsModal = document.querySelector("#termsModal");
const openTermsButton = document.querySelector("#openTermsButton");
const acceptTermsButton = document.querySelector("#acceptTermsButton");
const termsContent = document.querySelector("#termsContent");
const termsScrollHint = document.querySelector("#termsScrollHint");
const termsAccepted = document.querySelector("#termsAccepted");
const ageConfirmed = document.querySelector("#ageConfirmed");
const orderSuccessModal = document.querySelector("#orderSuccessModal");
const successOrderId = document.querySelector("#successOrderId");
const successOrderTotal = document.querySelector("#successOrderTotal");
const successPaymentMethod = document.querySelector("#successPaymentMethod");
const successPaymentInstruction = document.querySelector("#successPaymentInstruction");
const successLineStatus = document.querySelector("#successLineStatus");
const copySuccessOrderButton = document.querySelector("#copySuccessOrderButton");
const closeSuccessButton = document.querySelector("#closeSuccessButton");
const submitOrderButton = orderForm?.querySelector('button[type="submit"]');
const paymentButtons = [...document.querySelectorAll(".pay")];
let termsReadToEnd = false;
let termsLastFocusedElement = null;
let latestSuccessOrderText = "";

const DEFAULT_MEMBER_PROFILE = {
  memberLevel: "普通會員",
  discountLabel: "無折扣",
  discountPercent: 0,
  priorityQueue: false,
  totalSpent: 0,
  effectiveSpent: 0,
  completedOrders: 0,
  nextLevel: "青銅會員",
  nextLevelAmount: 30000,
  progressPercent: 0,
  isMaxLevel: false,
  orders: [],
  levels: [
    { name: "普通會員", minSpent: 0, discountLabel: "無折扣", priorityQueue: false },
    { name: "青銅會員", minSpent: 30000, discountLabel: "無折扣", priorityQueue: true },
    { name: "白銀會員", minSpent: 50000, discountLabel: "無折扣", priorityQueue: true },
    { name: "黃金會員", minSpent: 100000, discountLabel: "無折扣", priorityQueue: true }
  ]
};

function resolveLineChannel() {
  const channels = window.LINE_CHANNELS || {};
  const params = new URLSearchParams(window.location.search);
  const requested = String(params.get("oa") || params.get("source") || window.LINE_SOURCE_ACCOUNT || "").trim().toLowerCase();
  const fallbackKey = String(window.DEFAULT_LINE_CHANNEL || "dc").trim().toLowerCase();
  const key = channels[requested] ? requested : (channels[fallbackKey] ? fallbackKey : Object.keys(channels)[0]);

  if (key) {
    return { key, ...channels[key] };
  }

  return {
    key: "dc",
    liffId: window.LINE_LIFF_ID || "",
    sourceAccount: "dc",
    sourceName: "小號 DC手遊代儲",
    orderPrefix: window.ORDER_PREFIX || "DC"
  };
}

function normalizeCatalog(source) {
  const safeSource = source && Array.isArray(source.games) ? source : { categories: ["所有遊戲"], games: [] };
  const normalizedGames = safeSource.games
    .filter((game) => game && game.active !== false && game.id !== PAYMENT_SETTINGS_GAME_ID)
    .map((game) => ({
      ...game,
      plans: normalizePlanEntries(Array.isArray(game.plans) ? game.plans.filter((plan) => plan && plan.active !== false) : [])
    }))
    .filter((game) => game.plans.length);

  return {
    categories: Array.isArray(safeSource.categories) && safeSource.categories.length
      ? safeSource.categories.filter((category) => category !== "系統設定")
      : ["所有遊戲"],
    games: organizeStoreGames(normalizedGames)
  };
}

function normalizePlanEntries(plans) {
  const seen = {};
  return plans.map((plan, index) => {
    const sourcePlanId = String(plan?.sourcePlanId || plan?.id || `plan-${index + 1}`).trim();
    const baseId = sourcePlanId || `plan-${index + 1}`;
    const key = baseId.toLowerCase();
    seen[key] = (seen[key] || 0) + 1;
    return {
      ...plan,
      id: seen[key] === 1 ? baseId : `${baseId}__${seen[key]}`,
      sourcePlanId: baseId
    };
  });
}

function getPlanBundleInfo(plan) {
  const rawName = String(plan?.name || "").replace(/\s+/g, " ").trim();
  const match = rawName.match(/^(.*?)(\d[\d,]*)\s*(?:\*|x|X|×)\s*(\d+)\s*([^\d]*)$/);
  if (!match) return null;
  const count = Number(match[3]);
  if (!Number.isFinite(count) || count <= 1) return null;
  const prefix = String(match[1] || "").trim();
  const amount = String(match[2] || "").trim();
  const unit = String(match[4] || "").trim();
  const baseName = [prefix, amount, unit].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return { count, baseName };
}

function formatPlanDisplayName(plan) {
  const rawName = String(plan?.name || "").trim();
  const bundle = getPlanBundleInfo(plan);
  if (!bundle) return rawName;
  return `${bundle.baseName} ×${bundle.count}單優惠`;
}

function getPublicPlanNote(plan) {
  return String(plan?.note || "")
    .split(/[｜|;；\n]+/)
    .map((part) => part.trim())
    .filter((part) => part && !/^(階梯價|數量優惠|tier|bulk)\s*[:：]/i.test(part))
    .join("｜");
}

function parseQuantityTierRules(plan) {
  const note = String(plan?.note || "");
  if (!/(階梯價|數量優惠|tier|bulk)\s*[:：]/i.test(note)) return [];
  const rules = [];
  const regex = /(\d+)\s*(?:單|件|個|組|起)?\s*(?:=|:|：)\s*(?:NT\$?\s*)?([\d,]+)/gi;
  let match = null;
  while ((match = regex.exec(note))) {
    const minQty = Number(match[1]);
    const unitPrice = Number(String(match[2] || "").replace(/,/g, ""));
    if (Number.isFinite(minQty) && minQty > 1 && Number.isFinite(unitPrice) && unitPrice > 0) {
      rules.push({ minQty, unitPrice });
    }
  }
  return rules;
}

function getDefaultQuantityTierRules(game, plan) {
  const gameText = `${game?.id || ""} ${game?.name || ""}`.toLowerCase();
  const planName = String(plan?.name || "");
  const isLoginTopupPlan = !gameText.includes("uid")
    && (gameText.includes("login") || gameText.includes("上號"));
  const is8100Plan = /8100/.test(planName) && !getPlanBundleInfo(plan);
  if (!isLoginTopupPlan || !is8100Plan) return [];
  if (Number(plan?.price || 0) === 2600) return [{ minQty: 3, unitPrice: 2570 }, { minQty: 5, unitPrice: 2550 }];
  if (
    Number(plan?.price || 0) === 2550
    && /日韓/.test(planName)
    && !/國際/.test(planName)
  ) {
    return [{ minQty: 5, unitPrice: 2500 }];
  }
  return [];
}

function getQuantityTierRules(game, plan) {
  const basePrice = Number(plan?.price || 0);
  const configuredRules = parseQuantityTierRules(plan);
  const rules = configuredRules.length
    ? configuredRules
    : getDefaultQuantityTierRules(game, plan);
  return rules
    .filter((rule) => Number(rule.unitPrice) > 0 && Number(rule.unitPrice) < basePrice)
    .sort((a, b) => Number(a.minQty) - Number(b.minQty));
}

function getApplicableQuantityTier(game, plan, qty) {
  const count = Math.max(1, Number(qty || 1));
  return getQuantityTierRules(game, plan)
    .filter((rule) => count >= Number(rule.minQty))
    .sort((a, b) => Number(b.minQty) - Number(a.minQty))[0] || null;
}

function getQuantityTierHint(game, plan) {
  const rules = getQuantityTierRules(game, plan);
  return rules.map((rule) => `${rule.minQty}單起 ${currency.format(rule.unitPrice)}/單`).join("｜");
}

function getPlanSupportText(plan, game, fallback = "確認訂單後處理") {
  const bundle = getPlanBundleInfo(plan);
  const pieces = [];
  const publicNote = getPublicPlanNote(plan);
  const tierHint = getQuantityTierHint(game, plan);
  if (publicNote) pieces.push(publicNote);
  if (plan?.eta) pieces.push(plan.eta);
  if (tierHint) pieces.push(tierHint);
  if (bundle) pieces.push(`1單 = ${bundle.baseName}`);
  return pieces.join("｜") || fallback;
}

function organizeStoreGames(sourceGames) {
  const gamesToRender = [];
  sourceGames.forEach((game) => {
    const gameId = String(game?.id || "").toLowerCase();
    if (gameId === "delta") {
      const uidPlans = game.plans.filter((plan) => String(plan?.id || "").toLowerCase().includes("-uid-"));
      const loginPlans = game.plans.filter((plan) => !String(plan?.id || "").toLowerCase().includes("-uid-"));
      if (uidPlans.length) gamesToRender.push(createDeltaGame(game, "delta-uid", "三角洲 UID儲值", "UID 儲值", uidPlans));
      if (loginPlans.length) gamesToRender.push(createDeltaGame(game, "delta-login", "三角洲 上號儲值", "上號儲值", loginPlans));
      return;
    }
    if (gameId === "delta-uid") {
      gamesToRender.push(createDeltaGame(game, "delta-uid", "三角洲 UID儲值", "UID 儲值", game.plans));
      return;
    }
    if (gameId === "delta-login") {
      gamesToRender.push(createDeltaGame(game, "delta-login", "三角洲 上號儲值", "上號儲值", game.plans));
      return;
    }
    gamesToRender.push(game);
  });
  return gamesToRender;
}

function createDeltaGame(baseGame, id, name, description, plans) {
  return {
    ...baseGame,
    id,
    name,
    description,
    plans
  };
}

function extractPaymentInstructions(source) {
  const settingsGame = source?.games?.find((game) => game?.id === PAYMENT_SETTINGS_GAME_ID);
  const nextInstructions = { ...DEFAULT_PAYMENT_INSTRUCTIONS };

  (settingsGame?.plans || []).forEach((plan) => {
    const method = String(plan?.name || "").trim();
    const instruction = limitText(plan?.note, 300);
    if (method && instruction && Object.prototype.hasOwnProperty.call(nextInstructions, method)) {
      nextInstructions[method] = instruction;
    }
  });

  return nextInstructions;
}

function createJsonpCallbackName(prefix) {
  jsonpSequence += 1;
  return `__cll${prefix}${Date.now()}_${jsonpSequence}`;
}

function applyCatalog(nextData) {
  const nextPaymentInstructions = extractPaymentInstructions(nextData);
  const nextCatalog = normalizeCatalog(nextData);
  const nextSignature = JSON.stringify({
    categories: nextCatalog.categories,
    games: nextCatalog.games,
    paymentInstructions: nextPaymentInstructions
  });
  const changed = catalogSignature !== nextSignature;
  catalogSignature = nextSignature;
  paymentInstructions = nextPaymentInstructions;
  data = nextCatalog;
  games = data.games;
  selectedCategory = data.categories?.[0] || "所有遊戲";
  selectedGameId = games[0]?.id || "";
  selectedPlanId = games[0]?.plans[0]?.id || "";
  applyRequestedOrderSelection();
  return changed;
}

function applyRequestedOrderSelection() {
  if (CURRENT_PAGE !== "order" || !REQUESTED_GAME_ID) return false;
  const requestedGame = games.find((game) => game.id === REQUESTED_GAME_ID)
    || games.find((game) => game.plans.some((plan) => plan.id === REQUESTED_PLAN_ID))
    || (REQUESTED_GAME_ID === "delta" ? games.find((game) => game.id === "delta-uid" || game.id === "delta-login") : null);
  if (!requestedGame) return false;
  selectedGameId = requestedGame.id;
  selectedPlanId = requestedGame.plans.some((plan) => plan.id === REQUESTED_PLAN_ID)
    ? REQUESTED_PLAN_ID
    : requestedGame.plans[0]?.id || "";
  if (["tw", "intl", "jp"].includes(REQUESTED_PUBGM_REGION)) {
    selectedPubgmRegion = REQUESTED_PUBGM_REGION;
  }
  if (["uid", "login"].includes(REQUESTED_PUBGM_METHOD)) {
    selectedPubgmMethod = REQUESTED_PUBGM_METHOD;
  }
  return true;
}

function getCacheStores() {
  const stores = [];
  try {
    if (window.sessionStorage) stores.push(window.sessionStorage);
  } catch (error) {
    // Some in-app browsers can block storage access.
  }
  try {
    if (window.localStorage) stores.push(window.localStorage);
  } catch (error) {
    // Some in-app browsers can block storage access.
  }
  return stores;
}

function readCachedPayload(key, ttlMs, validator = () => true) {
  let best = null;
  getCacheStores().forEach((store) => {
    try {
      const cached = JSON.parse(store.getItem(key) || "null");
      if (!cached || Date.now() - Number(cached.cachedAt || 0) > ttlMs) return;
      if (!validator(cached)) return;
      if (!best || Number(cached.cachedAt || 0) > Number(best.cachedAt || 0)) best = cached;
    } catch (error) {
      // Ignore corrupt cache entries.
    }
  });
  return best;
}

function writeCachedPayload(key, payload) {
  getCacheStores().forEach((store) => {
    try {
      store.setItem(key, JSON.stringify(payload));
    } catch (error) {
      // Storage may be full or blocked in embedded browsers.
    }
  });
}

function removeCachedPayload(key) {
  getCacheStores().forEach((store) => {
    try {
      store.removeItem(key);
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  });
}

function readCachedCatalog() {
  return readCachedPayload(
    CATALOG_CACHE_KEY,
    CATALOG_CACHE_TTL_MS,
    (cached) => Boolean(cached?.data)
  )?.data || null;
}

function cacheCatalog(nextData) {
  writeCachedPayload(CATALOG_CACHE_KEY, {
    data: nextData,
    cachedAt: Date.now()
  });
}

function loadRemoteCatalog() {
  return new Promise((resolve) => {
    const callbackName = createJsonpCallbackName("Products");
    const script = document.createElement("script");
    const cleanup = () => {
      window[callbackName] = () => {};
      script.remove();
      window.setTimeout(() => delete window[callbackName], 30000);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, CATALOG_SYNC_TIMEOUT_MS);

    window[callbackName] = (payload) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(payload?.ok && payload.data ? payload.data : null);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };

    script.src = `${ORDER_ENDPOINT}?action=products&callback=${encodeURIComponent(callbackName)}&v=${Date.now()}`;
    document.head.appendChild(script);
  });
}

function getGame(id = selectedGameId) {
  return games.find((game) => game.id === id) || games[0];
}

function getPlan(game = getGame(), id = selectedPlanId) {
  return game?.plans.find((plan) => plan.id === id) || game?.plans[0];
}

function getPayment() {
  return selectedPaymentMethod;
}

function getPaymentInstruction(method = getPayment()) {
  return paymentInstructions[method] || DEFAULT_PAYMENT_INSTRUCTIONS[method] || "請聯絡官方 LINE 客服確認付款方式。";
}

function updatePaymentPreview() {
  const method = getPayment();
  if (paymentPreview) paymentPreview.textContent = `付款方式：${method}`;
  updatePaymentAccountField(method);
}

function updatePaymentAccountField(method = getPayment()) {
  if (!paymentAccountField || !paymentAccountKey || !paymentAccountHint) return;
  const requiresAccountKey = method === "網銀" || method === "街口";
  paymentAccountField.hidden = !requiresAccountKey;
  paymentAccountKey.required = requiresAccountKey;

  if (method === "網銀") {
    paymentAccountKey.placeholder = "例如：國泰 12345";
    paymentAccountHint.textContent = "只填銀行名稱與帳號末五碼，不要填完整帳號。";
  } else if (method === "街口") {
    paymentAccountKey.placeholder = "例如：街口手機末三碼 123";
    paymentAccountHint.textContent = "只填可辨識本人的末三碼，不要填完整手機號碼。";
  } else {
    paymentAccountKey.value = "";
  }
}

function hasLineMember() {
  return Boolean(lineMember?.userId);
}

function readCachedLineMember() {
  return readCachedPayload(
    LINE_MEMBER_CACHE_KEY,
    LINE_MEMBER_CACHE_TTL_MS,
    (cached) => Boolean(cached?.userId)
  );
}

function cacheLineMember(member) {
  writeCachedPayload(LINE_MEMBER_CACHE_KEY, {
    userId: member.userId || "",
    displayName: member.displayName || "LINE 會員",
    pictureUrl: member.pictureUrl || "",
    cachedAt: Date.now()
  });
}

function readCachedMemberProfile(userId) {
  return readCachedPayload(
    MEMBER_PROFILE_CACHE_KEY,
    MEMBER_PROFILE_CACHE_TTL_MS,
    (cached) => Boolean(cached?.profile) && cached.userId === userId
  )?.profile || null;
}

function cacheMemberProfile(userId, profile) {
  if (!userId || !profile) return;
  writeCachedPayload(MEMBER_PROFILE_CACHE_KEY, {
    userId,
    profile,
    cachedAt: Date.now()
  });
}

function clearCachedLineState() {
  removeCachedPayload(LINE_MEMBER_CACHE_KEY);
  removeCachedPayload(MEMBER_PROFILE_CACHE_KEY);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderLineMemberStatus(title, hint, active = false) {
  if (!lineMemberPanel) return;
  lineMemberPanel.classList.toggle("active", active);
  lineMemberName.textContent = title;
  lineMemberHint.textContent = hint;
  lineLoginButton.hidden = active;
}

function renderMemberSummary(summary) {
  if (!lineMemberSummary || !memberTotalSpent || !memberCompletedOrders) return;
  if (!summary) {
    lineMemberSummary.hidden = true;
    renderMemberArea(null);
    updateSummary();
    return;
  }

  memberTotalSpent.textContent = currency.format(Number(summary.totalSpent || 0));
  memberCompletedOrders.textContent = `${Number(summary.completedOrders || 0)} 筆`;
  if (memberLevelName) memberLevelName.textContent = summary.memberLevel || "普通會員";
  if (memberDiscountLabel) memberDiscountLabel.textContent = summary.discountLabel || "無折扣";
  lineMemberSummary.hidden = false;
  renderMemberArea(summary);
  updateSummary();
}

function getActiveMemberProfile() {
  return memberProfile || DEFAULT_MEMBER_PROFILE;
}

function getOrderPricing(plan, qty, game = getGame()) {
  const profile = getActiveMemberProfile();
  const count = Math.max(1, Number(qty || 1));
  const baseUnitPrice = Math.max(0, Number(plan?.price || 0));
  const quantityTier = getApplicableQuantityTier(game, plan, count);
  const unitPrice = quantityTier ? Number(quantityTier.unitPrice) : baseUnitPrice;
  const originalTotal = Math.max(0, baseUnitPrice * count);
  const quantitySubtotal = Math.max(0, unitPrice * count);
  const quantityDiscountAmount = Math.max(0, Math.round(originalTotal - quantitySubtotal));
  const discountPercent = Math.max(0, Number(profile.discountPercent || 0));
  const memberDiscountAmount = Math.round(quantitySubtotal * discountPercent / 100);
  const discountAmount = quantityDiscountAmount + memberDiscountAmount;
  const payableTotal = Math.max(0, Math.round(quantitySubtotal - memberDiscountAmount));
  const quantityDiscountLabel = quantityTier
    ? `數量優惠：${quantityTier.minQty}單起 ${currency.format(quantityTier.unitPrice)}/單`
    : "";
  const memberDiscountLabel = profile.discountLabel || "無折扣";
  return {
    originalTotal,
    unitPrice,
    discountPercent,
    discountAmount,
    quantityDiscountAmount,
    memberDiscountAmount,
    payableTotal,
    memberLevel: profile.memberLevel || "普通會員",
    discountLabel: quantityDiscountLabel || memberDiscountLabel,
    memberDiscountLabel,
    quantityDiscountLabel,
    priorityQueue: Boolean(profile.priorityQueue)
  };
}

function formatPlainDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
}

function renderMemberArea(profile) {
  const loggedIn = Boolean(profile);
  const data = profile || DEFAULT_MEMBER_PROFILE;
  if (memberAreaLoginButton) memberAreaLoginButton.hidden = loggedIn;
  if (areaMemberLevel) areaMemberLevel.textContent = loggedIn ? data.memberLevel : "尚未登入";
  if (areaMemberHint) {
    areaMemberHint.textContent = loggedIn
      ? (data.isMaxLevel ? "您已達最高會員等級，感謝您的支持。" : `距離 ${data.nextLevel || "下一級"} 還差 ${currency.format(Number(data.nextLevelAmount || 0))}`)
      : "登入 LINE 後即可查看會員等級、累積消費與最近訂單。";
  }
  if (areaTotalSpent) areaTotalSpent.textContent = currency.format(Number(data.effectiveSpent || data.totalSpent || 0));
  if (areaProgressFill) areaProgressFill.style.width = `${Math.max(0, Math.min(100, Number(data.progressPercent || 0)))}%`;
  if (areaNextLevelText) {
    areaNextLevelText.textContent = loggedIn
      ? (data.isMaxLevel ? "您已達最高會員等級，感謝您的支持。" : `升級進度 ${Number(data.progressPercent || 0)}%，再消費 ${currency.format(Number(data.nextLevelAmount || 0))} 可升級 ${data.nextLevel || "下一級"}。`)
      : "登入後顯示升級進度。";
  }
  if (areaDiscountLabel) areaDiscountLabel.textContent = data.discountLabel || "無折扣";
  if (areaPriorityStatus) areaPriorityStatus.textContent = loggedIn ? (data.priorityQueue ? "享有優先排單" : "一般排單") : "尚未登入";
  if (areaCompletedOrders) areaCompletedOrders.textContent = `${Number(data.completedOrders || 0)} 筆`;
  if (areaDiscountPercent) areaDiscountPercent.textContent = Number(data.discountPercent || 0) > 0 ? `${100 - Number(data.discountPercent)} 折` : "原價";
  renderMembershipRules(data.levels || DEFAULT_MEMBER_PROFILE.levels);

  const orders = Array.isArray(data.orders) ? data.orders.slice(0, 8) : [];
  if (areaOrderCount) areaOrderCount.textContent = `${orders.length} 筆`;
  if (!areaRecentOrders) return;
  if (!loggedIn) {
    areaRecentOrders.innerHTML = "<p>登入後顯示最近訂單。</p>";
    return;
  }
  if (!orders.length) {
    areaRecentOrders.innerHTML = "<p>目前沒有訂單紀錄。</p>";
    return;
  }
  areaRecentOrders.innerHTML = orders
    .map((order) => `
      <div class="member-order-row">
        <div>
          <b>${escapeHtml(order.gameName || "訂單")}</b>
          <span>${escapeHtml(order.productName || "")}</span>
          <small>${escapeHtml(formatPlainDate(order.completedAt || order.orderedAt))}｜${escapeHtml(order.status || "")}</small>
        </div>
        <strong>${escapeHtml(currency.format(Number(order.total || 0)))}</strong>
      </div>
    `)
    .join("");
}

function renderMembershipRules(levels) {
  if (!levelRuleGrid || !Array.isArray(levels) || !levels.length) return;
  levelRuleGrid.innerHTML = levels.map((level, index) => {
    const threshold = Number(level.minSpent || 0);
    const queueText = level.priorityQueue ? "優先排單" : "一般排單";
    const discountText = level.discountLabel || "無折扣";
    const thresholdText = index === 0 || threshold <= 0
      ? "預設等級"
      : `累積 ${currency.format(threshold)}`;
    return `<div><b>${escapeHtml(level.name || "會員")}</b><span>${escapeHtml(`${thresholdText}・${queueText}・${discountText}`)}</span></div>`;
  }).join("");
}

function loadMemberSummary() {
  if (!hasLineMember()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const callbackName = createJsonpCallbackName("Member");
    const script = document.createElement("script");
    const cleanup = () => {
      window[callbackName] = () => {};
      script.remove();
      window.setTimeout(() => delete window[callbackName], 30000);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    window[callbackName] = (payload) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(payload?.ok && payload.data ? payload.data : null);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };

    const params = new URLSearchParams({
      action: "member",
      callback: callbackName,
      lineUserId: lineMember.userId || "",
      lineDisplayName: lineMember.displayName || "",
      lineAccessToken: lineMember.accessToken || "",
      lineIdToken: lineMember.idToken || "",
      sourceAccount: LINE_SOURCE_ACCOUNT,
      memberSource: LINE_SOURCE_ACCOUNT,
      v: String(Date.now())
    });
    script.src = `${ORDER_ENDPOINT}?${params.toString()}`;
    document.head.appendChild(script);
  });
}

function refreshMemberSummaryInBackground(expectedUserId = "") {
  if (!hasLineMember()) return;
  loadMemberSummary()
    .then((memberSummary) => {
      if (!memberSummary || (expectedUserId && lineMember?.userId !== expectedUserId)) return;
      cacheMemberProfile(lineMember.userId, memberSummary);
      memberProfile = memberSummary;
      renderMemberSummary(memberProfile);
    })
    .catch((error) => {
      console.warn("Member summary refresh failed.", error);
    });
}

function scheduleMemberSummaryRefresh(expectedUserId = "") {
  const run = () => refreshMemberSummaryInBackground(expectedUserId);
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: CURRENT_PAGE === "member" ? 600 : 1200 });
  } else {
    window.setTimeout(run, CURRENT_PAGE === "member" ? 80 : 500);
  }
}

function showStatus(message, state = "pending") {
  verifyStatus.textContent = message;
  verifyStatus.className = `verify-status ${state}`;
}

function hasReachedTermsEnd() {
  if (!termsContent) return false;
  return termsContent.scrollTop + termsContent.clientHeight >= termsContent.scrollHeight - 12;
}

function updateTermsReadState() {
  if (termsReadToEnd || !hasReachedTermsEnd()) return;
  termsReadToEnd = true;
  acceptTermsButton.disabled = false;
  termsScrollHint.textContent = "已閱讀至最下方";
}

function openTerms() {
  if (!termsModal) return;
  termsLastFocusedElement = document.activeElement;
  termsModal.hidden = false;
  document.body.classList.add("modal-open");
  window.requestAnimationFrame(() => {
    termsContent.focus();
    updateTermsReadState();
  });
}

function closeTerms() {
  if (!termsModal) return;
  termsModal.hidden = true;
  document.body.classList.remove("modal-open");
  termsLastFocusedElement?.focus?.();
}

function acceptTerms() {
  if (!termsReadToEnd) return;
  termsAccepted.disabled = false;
  termsAccepted.checked = true;
  closeTerms();
  showStatus("購買須知已閱讀，請完成年齡與訂單資料確認。", "success");
}

function waitForLineSdk(timeoutMs = 6500) {
  if (window.liff) return Promise.resolve(true);

  const sdkScript = document.querySelector("#lineLiffSdk");
  if (!sdkScript) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(Boolean(window.liff));
    };
    const timer = window.setTimeout(finish, timeoutMs);
    sdkScript.addEventListener("load", finish, { once: true });
    sdkScript.addEventListener("error", finish, { once: true });
  });
}

function getLineLoginRedirectUri() {
  const redirectUrl = new URL(window.location.href);
  if (redirectUrl.hostname.endsWith("netlify.app")) {
    redirectUrl.protocol = "https:";
    redirectUrl.host = "327xzwyu.com";
  }

  [
    "code",
    "state",
    "error",
    "error_description",
    "friendship_status_changed",
    "liff.state",
    "liffClientId",
    "liffRedirectUri"
  ].forEach((key) => redirectUrl.searchParams.delete(key));

  Array.from(redirectUrl.searchParams.keys()).forEach((key) => {
    if (key.startsWith("liff.")) redirectUrl.searchParams.delete(key);
  });

  redirectUrl.hash = "";
  return redirectUrl.toString();
}

function cleanLineLoginCallbackUrl() {
  const currentUrl = new URL(window.location.href);
  const hasLineParams = Array.from(currentUrl.searchParams.keys()).some((key) => (
    key === "code"
    || key === "state"
    || key === "error"
    || key === "error_description"
    || key === "friendship_status_changed"
    || key.startsWith("liff.")
  ));
  if (!hasLineParams || !window.history?.replaceState) return;

  const cleanUrl = getLineLoginRedirectUri();
  if (cleanUrl !== window.location.href) {
    window.history.replaceState(window.history.state, document.title, cleanUrl);
  }
}

async function initLineMember() {
  renderMemberArea(null);
  const cachedMember = readCachedLineMember();
  const hadCachedMember = Boolean(cachedMember);
  if (cachedMember) {
    lineMember = { ...cachedMember, idToken: "", accessToken: "" };
    const cachedProfile = readCachedMemberProfile(cachedMember.userId);
    if (cachedProfile) {
      memberProfile = cachedProfile;
      renderMemberSummary(memberProfile);
    }
    renderLineMemberStatus(lineMember.displayName, "已使用最近登入狀態，可以先填寫訂單。", true);
    showStatus("LINE 會員已登入，可以先填寫訂單。", "success");
  } else {
    renderLineMemberStatus("檢查 LINE 會員中", "畫面可先填寫，送出前會確認登入狀態。");
    showStatus("正在檢查 LINE 登入狀態，可以先填寫訂單資料。", "pending");
  }

  if (!LINE_LIFF_ID) {
    renderLineMemberStatus("LINE 會員尚未啟用", "建立 LIFF 後把 LIFF ID 放進 line-config.js。");
    showStatus("此網站目前還沒填 LIFF ID，正式下單前需要先完成 LINE 設定。", "error");
    return;
  }

  const sdkReady = await waitForLineSdk();
  if (!sdkReady) {
    if (hadCachedMember) {
      renderLineMemberStatus(lineMember.displayName, "已使用最近登入狀態；LINE 即時檢查稍後再試。", true);
      showStatus("LINE 即時檢查較慢，已先使用最近登入狀態。", "success");
      return;
    }
    renderLineMemberStatus("LINE 載入失敗", "請從 LINE 官方帳號內重新開啟網站。");
    showStatus("LINE SDK 載入失敗，請重新整理或從官方 LINE 進入。", "error");
    return;
  }

  try {
    if (!hadCachedMember) showStatus("LINE 登入中，請稍候...", "pending");
    await window.liff.init({ liffId: LINE_LIFF_ID });
    lineReady = true;
    cleanLineLoginCallbackUrl();

    if (!window.liff.isLoggedIn()) {
      lineMember = null;
      memberProfile = null;
      clearCachedLineState();
      renderMemberSummary(null);
      renderLineMemberStatus("尚未登入 LINE 會員", "請先登入 LINE，登入後才能送出訂單。");
      showStatus("請先登入 LINE 會員後再下單。", "pending");
      return;
    }

    const profile = await window.liff.getProfile();
    lineMember = {
      userId: profile.userId || "",
      displayName: profile.displayName || "LINE 會員",
      pictureUrl: profile.pictureUrl || "",
      idToken: typeof window.liff.getIDToken === "function" ? window.liff.getIDToken() || "" : "",
      accessToken: typeof window.liff.getAccessToken === "function" ? window.liff.getAccessToken() || "" : ""
    };
    cacheLineMember(lineMember);

    if (!hasLineMember()) {
      renderLineMemberStatus(lineMember.displayName, "LINE 已登入，但沒有拿到驗證資料，請從 LINE 圖文選單重新開啟網站。");
      showStatus("LINE 驗證資料取得失敗，請從 LINE 圖文選單重新開啟網站後再下單。", "error");
      return;
    }

    renderLineMemberStatus(lineMember.displayName, "LINE 會員已登入，可以送出訂單。", true);
    showStatus("LINE 會員已登入，可以送出訂單。", "success");
    const cachedProfile = readCachedMemberProfile(lineMember.userId);
    if (cachedProfile) {
      memberProfile = cachedProfile;
      renderMemberSummary(memberProfile);
    }
    scheduleMemberSummaryRefresh(lineMember.userId);
  } catch (error) {
    console.warn("LINE LIFF init failed.", error);
    if (hadCachedMember) {
      renderLineMemberStatus(lineMember.displayName, "已使用最近登入狀態；LINE 即時檢查稍後再試。", true);
      showStatus("LINE 即時檢查較慢，已先使用最近登入狀態。", "success");
      return;
    }
    renderLineMemberStatus("LINE 登入暫不可用", "請重新開啟網站或確認 LIFF 設定。");
    showStatus("LINE 登入暫不可用，暫時不能送出訂單。", "error");
  }
}

async function loginWithLine() {
  if (!LINE_LIFF_ID || !window.liff) {
    showStatus("LINE 會員尚未設定完成，暫時不能送出訂單。", "error");
    return;
  }

  try {
    showStatus("LINE 登入中，請稍候...", "pending");
    if (lineLoginButton) {
      lineLoginButton.disabled = true;
      lineLoginButton.textContent = "登入中...";
    }
    if (memberAreaLoginButton) {
      memberAreaLoginButton.disabled = true;
      memberAreaLoginButton.textContent = "登入中...";
    }
    if (!lineReady) {
      await window.liff.init({ liffId: LINE_LIFF_ID });
      lineReady = true;
    }
    if (window.liff.isLoggedIn()) {
      await initLineMember();
      return;
    }
    window.liff.login({ redirectUri: getLineLoginRedirectUri() });
  } catch (error) {
    showStatus("LINE 登入啟動失敗，請重新整理後再試。", "error");
    if (lineLoginButton) {
      lineLoginButton.disabled = false;
      lineLoginButton.textContent = "LINE 登入";
    }
    if (memberAreaLoginButton) {
      memberAreaLoginButton.disabled = false;
      memberAreaLoginButton.textContent = "LINE 會員登入";
    }
  }
}

function renderCategories() {
  const categories = ["所有遊戲", "PUBGM", "其他遊戲"];
  const labels = {
    "所有遊戲": "全部商品",
    "PUBGM": "PUBGM",
    "其他遊戲": "其他遊戲"
  };
  if (!categories.includes(selectedCategory)) selectedCategory = "所有遊戲";
  categoryTabs.innerHTML = categories
    .map((category) => `<button class="category-tab ${category === selectedCategory ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(labels[category])}</button>`)
    .join("");
}

function isPubgmGame(game) {
  return String(game?.id || "").indexOf("pubgm-") === 0;
}

function getCatalogGameCards() {
  const pubgmGames = games.filter(isPubgmGame);
  const otherGames = games.filter((game) => !isPubgmGame(game));
  const cards = [];
  if (pubgmGames.length) {
    const firstPubgm = pubgmGames[0];
    cards.push({
      ...firstPubgm,
      id: "pubgm-group",
      targetGameId: pubgmGames.find((game) => game.id === "pubgm-uid")?.id || firstPubgm.id,
      name: "PUBGM",
      description: "台服、國際服、日韓服｜UID 與上號儲值",
      planCount: pubgmGames.reduce((total, game) => total + game.plans.length, 0),
      catalogGroup: "PUBGM"
    });
  }
  otherGames.forEach((game) => {
    cards.push({
      ...game,
      targetGameId: game.id,
      planCount: game.plans.length,
      catalogGroup: "其他遊戲"
    });
  });
  return cards;
}

function renderGames() {
  const keyword = gameSearch.value.trim().toLowerCase();
  const visibleGames = getCatalogGameCards().filter((game) => {
    const categoryMatch = selectedCategory === "所有遊戲" || game.catalogGroup === selectedCategory;
    const keywordMatch = !keyword || `${game.name} ${game.description || ""} ${game.catalogGroup}`.toLowerCase().includes(keyword);
    return categoryMatch && keywordMatch;
  });

  gameGrid.innerHTML = visibleGames
    .map((game) => {
      const imageUrl = String(game.imageUrl || "").trim();
      const cover = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(game.name)}" loading="lazy" decoding="async" fetchpriority="low" />`
        : `<span>${escapeHtml(game.icon || game.name.slice(0, 1))}</span>`;

      return `
      <article class="game-card accent-${escapeHtml(game.color || "pink")}" data-game-id="${escapeHtml(game.targetGameId)}">
        <div class="game-cover">
          ${cover}
        </div>
        <div class="game-card-body">
          <h3>${escapeHtml(game.name)}</h3>
          <small>${Number(game.planCount || 0)} 種方案</small>
        </div>
      </article>
    `;
    })
    .join("");
}

function renderSelects() {
  gameSelect.innerHTML = games
    .map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name)}</option>`)
    .join("");
  gameSelect.value = selectedGameId;
  renderPlanSelect();
}

function renderPlanSelect() {
  const game = getGame();
  planSelect.innerHTML = (game?.plans || [])
    .map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(formatPlanDisplayName(plan))} - ${currency.format(plan.price)}</option>`)
    .join("");
  if (!game?.plans.some((plan) => plan.id === selectedPlanId)) {
    selectedPlanId = game?.plans[0]?.id || "";
  }
  planSelect.value = selectedPlanId;
  renderPlanPicker(game);
}

function updatePlanPickerSelection() {
  if (!planPickerButton || !planPickerMenu) return;
  const selectedPlan = getPlan();
  planPickerButton.innerHTML = `
    <span>${escapeHtml(selectedPlan ? formatPlanDisplayName(selectedPlan) : "請選擇方案")}</span>
    <strong>${escapeHtml(selectedPlan ? currency.format(selectedPlan.price) : "")}</strong>
  `;
  planPickerMenu.querySelectorAll(".plan-picker-option").forEach((button) => {
    const active = button.dataset.planId === selectedPlanId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function closePlanPicker() {
  if (!planPicker || !planPickerButton || !planPickerMenu) return;
  planPicker.classList.remove("open");
  planPickerButton.setAttribute("aria-expanded", "false");
  planPickerMenu.hidden = true;
}

function renderPlanPicker(game = getGame()) {
  if (!planField || !planPicker || !planPickerButton || !planPickerMenu) return;
  const plans = game?.plans || [];
  planField.classList.toggle("enhanced", plans.length > 0);
  planPicker.hidden = plans.length === 0;
  planPickerMenu.hidden = true;
  planPickerButton.setAttribute("aria-expanded", "false");
  planPickerMenu.innerHTML = plans.map((plan) => `
    <button class="plan-picker-option" type="button" role="option" data-plan-id="${escapeHtml(plan.id)}">
      <span>${escapeHtml(formatPlanDisplayName(plan))}</span>
      <strong>${escapeHtml(currency.format(plan.price))}</strong>
      <small>${escapeHtml(getPlanSupportText(plan, game))}</small>
    </button>
  `).join("");
  updatePlanPickerSelection();
}

function renderDetail() {
  const game = getGame();
  if (!game) return;

  if (isPubgmGame(game)) {
    renderPubgmDetail();
    return;
  }

  catalogFilters.hidden = true;
  catalogFilters.innerHTML = "";
  document.querySelector("#detailCategory").textContent = "商品價目";
  document.querySelector("#detailName").textContent = game.name;
  const detailDesc = document.querySelector("#detailDesc");
  detailDesc.textContent = "";
  detailDesc.hidden = true;
  priceList.innerHTML = game.plans
    .map((plan) => renderPriceCard(game, plan, "代儲方案"))
    .join("");
}

function getPubgmPlanRegions(plan) {
  const id = String(plan?.id || "").toLowerCase();
  if (id.includes("intljp")) return ["intl", "jp"];
  if (id.includes("-tw-") || id.includes("login-tw")) return ["tw"];
  if (id.includes("intl")) return ["intl"];
  if (id.includes("-jp-") || id.includes("jp-")) return ["jp"];
  const name = String(plan?.name || "");
  if (name.includes("台服")) return ["tw"];
  if (name.includes("日韓")) return ["jp"];
  return ["intl"];
}

function getPubgmMethod(game) {
  return String(game?.id || "").includes("login") ? "login" : "uid";
}

function isLoginTopup(game, plan = getPlan(game)) {
  const gameId = String(game?.id || "").toLowerCase();
  const planId = String(plan?.id || "").toLowerCase();
  const text = [
    game?.name,
    game?.description,
    plan?.name,
    plan?.note
  ].join(" ").toLowerCase();
  const hasLoginMarker = gameId.endsWith("-login")
    || planId.includes("-login-")
    || text.includes("上號")
    || text.includes("login");
  if (hasLoginMarker) return true;

  const hasUidMarker = gameId === "pubgm-uid"
    || gameId.endsWith("-uid")
    || planId.includes("-uid-")
    || planId.includes("-id-")
    || text.includes("uid儲值")
    || text.includes("uid代儲")
    || text.includes("id儲值")
    || text.includes("id代儲")
    || text.includes("月卡")
    || text.includes("戰令");
  return !hasUidMarker;
}

function getSelectedPubgmOrderRegion(game, plan) {
  if (!isPubgmGame(game)) return "";
  const regions = getPubgmPlanRegions(plan);
  if (regions.includes(selectedPubgmRegion)) return selectedPubgmRegion;
  return regions[0] || selectedPubgmRegion || "";
}

function getLoginRequirement(game, plan = getPlan(game)) {
  const required = isLoginTopup(game, plan);
  if (!required) {
    return {
      required: false,
      title: "UID 儲值不需帳密",
      hint: "此方案只需要 UID 與玩家名稱，不需要填遊戲登入帳號與密碼。",
      allowScanPlaceholder: false,
      region: "",
      badge: "免填"
    };
  }

  const region = getSelectedPubgmOrderRegion(game, plan);
  const pubgmScanAllowed = isPubgmGame(game) && getPubgmMethod(game) === "login" && (region === "tw" || region === "intl");
  const regionLabel = { tw: "台服", intl: "國際服", jp: "日韓服" }[region] || "";

  if (pubgmScanAllowed) {
    return {
      required: true,
      title: `PUBGM ${regionLabel}上號儲值`,
      hint: "若使用掃碼登入，登入方式選「掃碼登入」，帳號與密碼請填 1；若使用帳密登入，請填完整資料。",
      allowScanPlaceholder: true,
      region,
      badge: "掃碼可填 1"
    };
  }

  return {
    required: true,
    title: isPubgmGame(game) && regionLabel ? `PUBGM ${regionLabel}上號儲值` : "上號儲值資料",
    hint: "此方案需要登入方式、帳號與密碼，請填完整資料，方便客服核單處理。",
    allowScanPlaceholder: false,
    region,
    badge: "必填"
  };
}

function updateLoginInfoFields() {
  if (!gameLoginMethodField || !gameLoginAccountField || !gameLoginPasswordField || !gameLoginMethod || !gameLoginAccount || !gameLoginPassword) return;
  const game = getGame();
  const plan = getPlan(game);
  const rule = getLoginRequirement(game, plan);
  [gameLoginMethodField, gameLoginAccountField, gameLoginPasswordField].forEach((field) => {
    field.hidden = !rule.required;
  });
  gameLoginMethod.required = rule.required;
  gameLoginAccount.required = rule.required;
  gameLoginPassword.required = rule.required;
  if (loginInfoHint) loginInfoHint.textContent = rule.hint;
  gameLoginAccount.placeholder = rule.allowScanPlaceholder ? "掃碼登入可填 1" : "請填遊戲登入帳號";
  gameLoginPassword.placeholder = rule.allowScanPlaceholder ? "掃碼登入可填 1" : "請填遊戲登入密碼";
  if (!rule.required) {
    gameLoginMethod.value = "";
    gameLoginAccount.value = "";
    gameLoginPassword.value = "";
  }
}

function collectGameLoginInfo(game, plan) {
  const rule = getLoginRequirement(game, plan);
  if (!rule.required) return { required: false, text: "" };
  const method = gameLoginMethod?.value.trim() || "";
  const account = gameLoginAccount?.value.trim() || "";
  const password = gameLoginPassword?.value.trim() || "";
  return {
    ...rule,
    method,
    account,
    password,
    text: [
      "[上號資料]",
      `登入方式：${method || "未填"}`,
      `帳號：${account || "未填"}`,
      `密碼：${password || "未填"}`
    ].join("\n")
  };
}

function renderPubgmDetail() {
  const pubgmGames = games.filter(isPubgmGame);
  const entries = pubgmGames.flatMap((pubgmGame) => pubgmGame.plans.map((plan) => ({
    game: pubgmGame,
    plan,
    method: getPubgmMethod(pubgmGame),
    regions: getPubgmPlanRegions(plan)
  })));
  const visibleEntries = entries.filter((entry) => (
    entry.method === selectedPubgmMethod
    && entry.regions.includes(selectedPubgmRegion)
  ));
  const regionLabels = { tw: "台服", intl: "國際服", jp: "日韓服" };
  const methodLabels = { uid: "UID 儲值", login: "上號儲值" };

  document.querySelector("#detailCategory").textContent = "PUBGM 專區";
  document.querySelector("#detailName").textContent = "PUBGM";
  const detailDesc = document.querySelector("#detailDesc");
  detailDesc.textContent = "";
  detailDesc.hidden = true;
  catalogFilters.hidden = false;
  catalogFilters.innerHTML = `
    <div class="catalog-filter-group">
      <span>1. 選擇伺服器</span>
      <div class="catalog-filter-options">
        ${Object.entries(regionLabels).map(([value, label]) => `
          <button class="catalog-filter ${selectedPubgmRegion === value ? "active" : ""}" type="button" data-filter-group="region" data-filter-value="${value}">${label}</button>
        `).join("")}
      </div>
    </div>
    <div class="catalog-filter-group">
      <span>2. 選擇儲值方式</span>
      <div class="catalog-filter-options">
        ${Object.entries(methodLabels).map(([value, label]) => `
          <button class="catalog-filter ${selectedPubgmMethod === value ? "active" : ""}" type="button" data-filter-group="method" data-filter-value="${value}">${label}</button>
        `).join("")}
      </div>
    </div>
    <p class="catalog-filter-result">${regionLabels[selectedPubgmRegion]}・${methodLabels[selectedPubgmMethod]}｜共 ${visibleEntries.length} 種方案</p>
  `;

  priceList.innerHTML = visibleEntries.length
    ? visibleEntries.map((entry) => renderPriceCard(
      entry.game,
      entry.plan,
      `${regionLabels[selectedPubgmRegion]}・${methodLabels[entry.method]}`
    )).join("")
    : `<div class="catalog-empty">這個分類目前沒有可購買方案，請切換其他伺服器或儲值方式。</div>`;
}

function renderPriceCard(game, plan, label) {
  return `
      <article class="price-card ${plan.id === selectedPlanId ? "selected" : ""}" data-game-id="${escapeHtml(game.id)}" data-plan-id="${escapeHtml(plan.id)}">
        <div>
          <span>${escapeHtml(label)}</span>
          <h3>${escapeHtml(formatPlanDisplayName(plan))}</h3>
          <small>${escapeHtml(getPlanSupportText(plan, game))}</small>
        </div>
        <strong>${currency.format(plan.price)}</strong>
        <button type="button" class="select-plan" data-game-id="${escapeHtml(game.id)}" data-plan-id="${escapeHtml(plan.id)}">選擇並下單</button>
      </article>
    `;
}

function updateSummary() {
  const game = getGame();
  const plan = getPlan(game);
  if (!game || !plan) return;

  const qty = Math.max(1, Number(quantity.value || 1));
  const pricing = getOrderPricing(plan, qty, game);
  summaryGame.textContent = game.name;
  summaryPlan.textContent = formatPlanDisplayName(plan);
  summaryEta.textContent = plan.eta;
  summaryTotal.textContent = currency.format(pricing.payableTotal);
  if (summaryOriginalTotal) summaryOriginalTotal.textContent = currency.format(pricing.originalTotal);
  if (summaryMemberLevel) summaryMemberLevel.textContent = pricing.memberLevel;
  if (summaryDiscount) {
    summaryDiscount.textContent = pricing.discountAmount > 0
      ? `${pricing.discountLabel}，省 ${currency.format(pricing.discountAmount)}`
      : pricing.discountLabel;
  }
  updateLoginInfoFields();
}

function selectGame(gameId, scroll = true) {
  selectedGameId = gameId;
  const game = getGame();
  selectedPlanId = game?.plans[0]?.id || "";
  if (CURRENT_PAGE === "prices" && isPubgmGame(game)) {
    selectedPubgmRegion = "tw";
    selectedPubgmMethod = "uid";
  }
  gameSelect.value = selectedGameId;
  renderPlanSelect();
  renderDetail();
  updateSummary();
  if (scroll) document.querySelector("#detail").scrollIntoView({ behavior: getPreferredScrollBehavior(), block: "start" });
}

function selectPlan(planId, scroll = true) {
  selectedPlanId = planId;
  planSelect.value = selectedPlanId;
  priceList.querySelectorAll(".price-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.planId === selectedPlanId);
  });
  updatePlanPickerSelection();
  updateSummary();
  if (scroll) document.querySelector("#order").scrollIntoView({ behavior: getPreferredScrollBehavior(), block: "start" });
}

function getPreferredScrollBehavior() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  return reduceMotion || window.innerWidth <= 700 ? "auto" : "smooth";
}

function orderText(order) {
  return [
    `訂單編號：${order.orderId}`,
    `來源：${order.sourceName}`,
    `LINE會員：${order.lineDisplayName}`,
    `會員等級：${order.memberLevel || "普通會員"}`,
    `遊戲：${order.gameName}`,
    `商品：${order.productName}`,
    `數量：${order.quantity}`,
    `原價：${currency.format(order.originalTotal || order.total)}`,
    `會員折扣：${order.memberDiscount || "無折扣"}`,
    `折扣後金額：${currency.format(order.total)}`,
    `付款方式：${order.paymentMethod}`,
    `付款帳戶識別：${order.paymentAccountKey || "不適用"}`,
    `伺服器：${order.serverName}`,
    `UID：${order.playerId}`,
    `玩家名稱：${order.playerName}`,
    `備註：${order.notes || "無"}`
  ].join("\n");
}

function closeOrderSuccess() {
  if (!orderSuccessModal) return;
  orderSuccessModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function showOrderSuccess(order, notificationOk, paymentNotificationOk) {
  if (!orderSuccessModal) return;

  latestSuccessOrderText = orderText(order);
  successOrderId.textContent = order.orderId;
  successOrderTotal.textContent = currency.format(order.total);
  successPaymentMethod.textContent = order.paymentMethod;
  successPaymentInstruction.textContent = paymentNotificationOk === null
    ? "付款資料會由系統背景傳送到官方 LINE，請稍候到聊天室查看。"
    : paymentNotificationOk === false
    ? "付款資料尚未成功送出，請把訂單編號傳給官方 LINE 客服確認。"
    : "訂單與付款資料已傳送到官方 LINE，請到聊天室查看。";

  if (notificationOk === null && paymentNotificationOk === null) {
    successLineStatus.textContent = "訂單已成立；官方 LINE 通知正在背景傳送，不會影響訂單成立。";
  } else if (notificationOk === false && paymentNotificationOk === false) {
    successLineStatus.textContent = "訂單已成立；LINE 訂單付款資料尚未成功送出，請把訂單編號傳給客服。";
  } else if (paymentNotificationOk === false) {
    successLineStatus.textContent = "訂單已成立；但 LINE 訂單付款資料尚未成功送出，請把訂單編號傳給客服。";
  } else if (notificationOk === false) {
    successLineStatus.textContent = "訂單已成立；若沒有收到官方 LINE 訂單通知，請把訂單編號傳給客服。";
  } else {
    successLineStatus.textContent = "官方 LINE 已傳送訂單與付款資料，請到聊天室確認訊息。";
  }

  orderSuccessModal.hidden = false;
  document.body.classList.add("modal-open");
  closeSuccessButton?.focus();
}

function limitText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function buildOrderPayload(order) {
  const consentRecord = `[同意紀錄] 購買須知 v${TERMS_VERSION}=同意；已滿18歲或已取得法定代理人同意=是。`;
  const orderNotes = [consentRecord, order.notes].filter(Boolean).join("\n");

  return {
    orderId: order.orderId,
    studioName: order.studioName,
    gameId: order.gameId,
    planId: order.planId,
    gameName: order.gameName,
    productName: order.productName,
    quantity: order.quantity,
    payment: order.payment,
    paymentMethod: order.payment,
    paymentAccountKey: limitText(order.paymentAccountKey, 80),
    serverName: limitText(order.serverName, 80),
    playerId: limitText(order.playerId, 80),
    playerName: limitText(order.playerName, 80),
    lineUserId: order.lineUserId,
    lineDisplayName: limitText(order.lineDisplayName, 80),
    lineAccessToken: "",
    lineIdToken: "",
    sourceAccount: order.sourceAccount,
    sourceName: order.sourceName,
    memberSource: order.memberSource,
    termsAccepted: true,
    ageConfirmed: true,
    termsVersion: TERMS_VERSION,
    notes: limitText(orderNotes, 500)
  };
}

function submitOrderToBackend(order) {
  return new Promise((resolve) => {
    const callbackName = createJsonpCallbackName("Order");
    const script = document.createElement("script");
    const cleanup = () => {
      window[callbackName] = () => {};
      script.remove();
      window.setTimeout(() => delete window[callbackName], 30000);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve({
        ok: false,
        orderSaved: false,
        error: "ORDER_CONFIRM_TIMEOUT",
        message: "後台未在時間內確認訂單，畫面不會假裝成功。請先不要重複送單，將目前資料保留並聯絡官方 LINE 查詢。"
      });
    }, ORDER_SUBMIT_TIMEOUT_MS);

    window[callbackName] = (payload) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(payload || { ok: false, message: "後台沒有回傳結果。" });
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve({ ok: false, message: "後台連線失敗，請稍後再試或聯絡客服。" });
    };

    const payload = buildOrderPayload(order);
    const url = `${ORDER_ENDPOINT}?action=order&callback=${encodeURIComponent(callbackName)}&payload=${encodeURIComponent(JSON.stringify(payload))}`;
    if (url.length > 7500) {
      window.clearTimeout(timer);
      cleanup();
      resolve({ ok: false, message: "LINE 驗證資料太長，請從 LINE 圖文選單重新開啟網站後再下單。" });
      return;
    }

    script.src = url;
    document.head.appendChild(script);
  });
}

function triggerOrderNotification(orderId) {
  const safeOrderId = String(orderId || "").trim();
  if (!safeOrderId) return;

  const callbackName = createJsonpCallbackName("Notify");
  const script = document.createElement("script");
  const cleanup = () => {
    window[callbackName] = () => {};
    script.remove();
    window.setTimeout(() => delete window[callbackName], 30000);
  };

  const timer = window.setTimeout(cleanup, 45000);
  window[callbackName] = (payload) => {
    window.clearTimeout(timer);
    cleanup();
    if (!successLineStatus || !payload?.ok) return;
    if (payload.notificationOk && payload.paymentNotificationOk) {
      successLineStatus.textContent = "官方 LINE 已傳送訂單與付款資料，請到聊天室確認訊息。";
    } else if (payload.queued) {
      successLineStatus.textContent = "訂單已成立；LINE 通知已保留背景重試，若稍後沒收到請把訂單編號傳給客服。";
    }
  };

  script.onerror = () => {
    window.clearTimeout(timer);
    cleanup();
  };
  script.src = `${ORDER_ENDPOINT}?action=notify-order&callback=${encodeURIComponent(callbackName)}&orderId=${encodeURIComponent(safeOrderId)}`;
  document.head.appendChild(script);
}

function renderCatalogView() {
  renderCategories();
  renderGames();
  renderSelects();
  renderDetail();
  updateSummary();
  updateLoginInfoFields();
  updatePaymentPreview();
}

async function initApp() {
  const pageTitles = {
    prices: "商品價目｜陳龍龍工作室",
    order: "下單與付款｜陳龍龍工作室",
    member: "會員專區｜陳龍龍工作室"
  };
  document.title = pageTitles[CURRENT_PAGE] || pageTitles.prices;

  // 先用隨網站一起發布的商品資料呈現畫面，避免後端較慢時整頁空白。
  // 實際下單金額仍由後端商品表重新核對，遠端資料回來後再無縫更新。
  applyCatalog(readCachedCatalog() || window.STUDIO_DATA);
  renderCatalogView();
  if (CURRENT_PAGE !== "prices") {
    const startLineMember = () => initLineMember();
    if (CURRENT_PAGE === "member") {
      window.setTimeout(startLineMember, 40);
    } else if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(startLineMember, { timeout: 500 });
    } else {
      window.setTimeout(startLineMember, 160);
    }
  }
  if (CURRENT_PAGE === "member") return;

  await new Promise((resolve) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(resolve, { timeout: 800 });
    } else {
      window.setTimeout(resolve, 180);
    }
  });

  const previousSelection = {
    category: selectedCategory,
    gameId: selectedGameId,
    planId: selectedPlanId
  };
  const remoteCatalog = await loadRemoteCatalog();
  if (!remoteCatalog) return;

  cacheCatalog(remoteCatalog);
  const changed = applyCatalog(remoteCatalog);
  if (!changed) return;
  if (!applyRequestedOrderSelection()) {
    if (["所有遊戲", "PUBGM", "其他遊戲"].includes(previousSelection.category)) {
      selectedCategory = previousSelection.category;
    }
    if (games.some((game) => game.id === previousSelection.gameId)) {
      selectedGameId = previousSelection.gameId;
    }
    const selectedGame = getGame(selectedGameId);
    if (selectedGame?.plans.some((plan) => plan.id === previousSelection.planId)) {
      selectedPlanId = previousSelection.planId;
    } else {
      selectedPlanId = selectedGame?.plans[0]?.id || "";
    }
  }
  renderCatalogView();
}

categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".category-tab");
  if (!button) return;
  selectedCategory = button.dataset.category;
  categoryTabs.querySelectorAll(".category-tab").forEach((tab) => {
    tab.classList.toggle("active", tab === button);
  });
  renderGames();
});

gameSearch.addEventListener("input", () => {
  window.clearTimeout(gameSearchTimer);
  gameSearchTimer = window.setTimeout(renderGames, 120);
});

gameGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".game-card");
  if (!card) return;
  selectGame(card.dataset.gameId);
});

priceList.addEventListener("click", (event) => {
  const button = event.target.closest(".select-plan");
  const card = event.target.closest(".price-card");
  const planId = button?.dataset.planId || card?.dataset.planId;
  const gameId = button?.dataset.gameId || card?.dataset.gameId || selectedGameId;
  if (!planId) return;
  if (CURRENT_PAGE === "prices") {
    const target = new URL("/order", window.location.origin);
    if (LINE_SOURCE_ACCOUNT && LINE_SOURCE_ACCOUNT !== String(window.DEFAULT_LINE_CHANNEL || "main")) {
      target.searchParams.set("oa", LINE_SOURCE_ACCOUNT);
    }
    target.searchParams.set("game", gameId);
    target.searchParams.set("plan", planId);
    if (gameId.includes("pubgm")) {
      target.searchParams.set("region", selectedPubgmRegion);
      target.searchParams.set("method", selectedPubgmMethod);
    }
    window.location.href = `${target.pathname}${target.search}`;
    return;
  }
  if (gameId !== selectedGameId) selectGame(gameId, false);
  selectPlan(planId);
});

catalogFilters?.addEventListener("click", (event) => {
  const button = event.target.closest(".catalog-filter");
  if (!button) return;
  if (button.dataset.filterGroup === "region") {
    selectedPubgmRegion = button.dataset.filterValue || "tw";
  } else if (button.dataset.filterGroup === "method") {
    selectedPubgmMethod = button.dataset.filterValue || "uid";
  }
  renderDetail();
});

gameSelect.addEventListener("change", () => selectGame(gameSelect.value, false));
planSelect.addEventListener("change", () => selectPlan(planSelect.value, false));
planPickerButton?.addEventListener("click", () => {
  if (!planPicker || !planPickerMenu) return;
  const nextOpen = planPickerMenu.hidden;
  planPicker.classList.toggle("open", nextOpen);
  planPickerButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  planPickerMenu.hidden = !nextOpen;
});
planPickerMenu?.addEventListener("click", (event) => {
  const button = event.target.closest(".plan-picker-option");
  if (!button) return;
  selectPlan(button.dataset.planId, false);
  closePlanPicker();
});
document.addEventListener("click", (event) => {
  if (!planPicker || planPicker.contains(event.target)) return;
  closePlanPicker();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePlanPicker();
});
quantity.addEventListener("input", updateSummary);
lineLoginButton?.addEventListener("click", loginWithLine);
memberAreaLoginButton?.addEventListener("click", loginWithLine);
openTermsButton?.addEventListener("click", openTerms);
acceptTermsButton?.addEventListener("click", acceptTerms);
termsContent?.addEventListener("scroll", updateTermsReadState);
termsModal?.querySelectorAll("[data-close-terms]").forEach((button) => {
  button.addEventListener("click", closeTerms);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && termsModal && !termsModal.hidden) closeTerms();
  if (event.key === "Escape" && orderSuccessModal && !orderSuccessModal.hidden) closeOrderSuccess();
});
closeSuccessButton?.addEventListener("click", closeOrderSuccess);
copySuccessOrderButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(latestSuccessOrderText);
    copySuccessOrderButton.textContent = "已複製";
  } catch (error) {
    copySuccessOrderButton.textContent = "請長按付款資料複製";
  }
});

paymentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedPaymentMethod = button.dataset.payment || "網銀";
    paymentButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    updatePaymentPreview();
  });
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!termsAccepted?.checked) {
    showStatus("請先打開購買須知，完整閱讀並同意後再下單。", "error");
    openTerms();
    return;
  }

  if (!ageConfirmed?.checked) {
    showStatus("請確認已滿 18 歲；未滿 18 歲者須先取得法定代理人同意。", "error");
    ageConfirmed?.focus();
    return;
  }

  if (!hasLineMember()) {
    showStatus("請先登入 LINE 會員後再送出訂單。", "error");
    return;
  }

  const game = getGame(gameSelect.value);
  const plan = getPlan(game, planSelect.value);
  const qty = Math.max(1, Number(quantity.value || 1));
  const paymentMethod = getPayment();
  const pricing = getOrderPricing(plan, qty, game);
  const accountKey = paymentAccountKey?.value.trim() || "";
  const loginInfo = collectGameLoginInfo(game, plan);
  if ((paymentMethod === "網銀" || paymentMethod === "街口") && !accountKey) {
    showStatus("請填寫付款帳戶識別，讓後台判斷這個帳戶是否已驗證過。", "error");
    paymentAccountKey?.focus();
    return;
  }
  if (loginInfo.required && (!loginInfo.method || !loginInfo.account || !loginInfo.password)) {
    showStatus(loginInfo.allowScanPlaceholder
      ? "請填寫上號資料；若使用掃碼登入，帳號與密碼請填 1。"
      : "請完整填寫登入方式、帳號與密碼。", "error");
    if (!loginInfo.method) gameLoginMethod?.focus();
    else if (!loginInfo.account) gameLoginAccount?.focus();
    else gameLoginPassword?.focus();
    return;
  }
  if (isSubmittingOrder) return;

  const paymentInstruction = limitText(getPaymentInstruction(paymentMethod), 300);
  const playerNameText = `[玩家資料]\n玩家名稱：${playerName?.value.trim() || "未填"}`;
  const mergedNotes = [playerNameText, loginInfo.text, notes.value.trim()].filter(Boolean).join("\n\n");
  const order = {
    orderId: `${ORDER_PREFIX}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    studioName: STUDIO_BRAND_NAME,
    gameId: game.id,
    planId: plan.sourcePlanId || plan.id,
    gameName: game.name,
    productName: plan.name,
    quantity: qty,
    unitPrice: pricing.unitPrice,
    originalTotal: pricing.originalTotal,
    total: pricing.payableTotal,
    memberLevel: pricing.memberLevel,
    memberDiscount: pricing.discountLabel,
    discountAmount: pricing.discountAmount,
    priorityQueue: pricing.priorityQueue,
    paymentMethod,
    paymentInstruction,
    payment: paymentMethod,
    paymentAccountKey: accountKey,
    serverName: serverName.value.trim(),
    playerId: playerId.value.trim(),
    playerName: playerName?.value.trim() || "",
    lineUserId: lineMember.userId,
    lineDisplayName: lineMember.displayName,
    lineIdToken: lineMember.idToken,
    lineAccessToken: lineMember.accessToken,
    sourceAccount: LINE_SOURCE_ACCOUNT,
    sourceName: LINE_SOURCE_NAME,
    memberSource: LINE_SOURCE_ACCOUNT,
    notes: mergedNotes
  };

  isSubmittingOrder = true;
  if (submitOrderButton) {
    submitOrderButton.disabled = true;
    submitOrderButton.textContent = "訂單建立中...";
  }
  showStatus("訂單送出中，請稍候...", "pending");

  const result = await submitOrderToBackend(order);
  if (!result.ok || result.orderSaved !== true) {
    const message = result.error === "LINE_MEMBER_REQUIRED"
      ? "LINE 驗證失敗，請從 LINE 圖文選單的「自助下單」重新開啟並登入後再送出。"
      : result.message || "訂單送出失敗，請重新整理後再試。";
    showStatus(message, "error");
    isSubmittingOrder = false;
    if (submitOrderButton) {
      submitOrderButton.disabled = false;
      submitOrderButton.textContent = "送出訂單";
    }
    return;
  }

  order.orderId = result.orderId || order.orderId;
  order.originalTotal = Number(result.originalTotal || order.originalTotal || order.total);
  order.total = Number(result.total || order.total);
  order.memberLevel = result.memberLevel || order.memberLevel || "普通會員";
  order.memberDiscount = result.memberDiscount || order.memberDiscount || "無折扣";
  order.discountAmount = Number(result.discountAmount || order.discountAmount || 0);
  order.priorityQueue = Boolean(result.priorityQueue ?? order.priorityQueue);
  order.productName = result.productName || order.productName;
  order.gameName = result.gameName || order.gameName;
  order.quantity = Number(result.quantity || order.quantity);
  const text = orderText(order);

  confirmation.hidden = false;
  const lineNoticeText = result.notificationQueued
    ? "訂單已成立；官方 LINE 通知與付款資料正在傳送，不會影響訂單成立。"
    : result.notificationOk === false
    ? "訂單已成立；若沒有收到官方 LINE 通知，請把訂單編號傳給客服。"
    : result.paymentNotificationOk === false
      ? "訂單已成立；LINE 訂單付款資料尚未成功送出，請把訂單編號傳給客服。"
      : "系統已送出 LINE 通知，工作室收到後會核單處理。";

  confirmation.innerHTML = `
    <strong>訂單已送出</strong>
    <p>訂單編號：${escapeHtml(order.orderId)}</p>
    <p>會員：${escapeHtml(order.memberLevel)}｜${escapeHtml(order.memberDiscount)}</p>
    <p>付款方式：${escapeHtml(order.paymentMethod)}｜金額：${escapeHtml(currency.format(order.total))}</p>
    <p>${escapeHtml(lineNoticeText)}</p>
    <button class="secondary-button copy-order" type="button">複製訂單內容</button>
  `;

  confirmation.querySelector(".copy-order")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(text);
    confirmation.querySelector(".copy-order").textContent = "已複製";
  });

  showOrderSuccess(order, result.notificationOk, result.paymentNotificationOk);
  if (result.notificationQueued) {
    triggerOrderNotification(order.orderId);
  }
  orderForm.reset();
  quantity.value = 1;
  termsAccepted.checked = false;
  termsAccepted.disabled = true;
  termsReadToEnd = false;
  acceptTermsButton.disabled = true;
  termsScrollHint.textContent = "請繼續向下閱讀";
  termsContent.scrollTop = 0;
  showStatus("訂單已送出，請等待客服人員處理。", "success");
  isSubmittingOrder = false;
  if (submitOrderButton) {
    submitOrderButton.disabled = false;
    submitOrderButton.textContent = "送出訂單";
  }
  updateSummary();
  updatePaymentPreview();
});

initApp();
