const ADMIN_ENDPOINT = "https://script.google.com/macros/s/AKfycbwDT3asNWUlAHI3D5Yv7sjSkHPToDpj0Yk5wU7Pb-eiXAkWIUqJQ-nxdWCgcr4gpYZB/exec";
const ADMIN_PROXY_ENDPOINT = "/.netlify/functions/admin-api";
const ADMIN_TOKEN_KEY = "cll_admin_session_v1";
const ADMIN_STATUS_TABS = ["訂單成立", "已付款", "已完成", "已取消", "全部"];
const ADMIN_PROXY_FALLBACK_ERRORS = new Set(["PROXY_FAILED", "TIMEOUT", "BAD_RESPONSE", "NETWORK_ERROR"]);
const ADMIN_MUTATION_ACTIONS = new Set(["updateOrderStatus", "sendDiscordStatusNotify"]);

let adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
let currentStatus = "訂單成立";
let allOrders = [];
let selectedOrder = null;
let loading = false;

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const adminPassword = document.querySelector("#adminPassword");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");
const dashboardMessage = document.querySelector("#dashboardMessage");
const logoutButton = document.querySelector("#logoutButton");
const refreshButton = document.querySelector("#refreshButton");
const orderSearch = document.querySelector("#orderSearch");
const orderList = document.querySelector("#orderList");
const statusTabs = document.querySelectorAll(".status-tab");
const orderDialog = document.querySelector("#orderDialog");
const closeDialogButton = document.querySelector("#closeDialogButton");
const detailTitle = document.querySelector("#detailTitle");
const detailGrid = document.querySelector("#detailGrid");
const completeOrderButton = document.querySelector("#completeOrderButton");
const paidOrderButton = document.querySelector("#paidOrderButton");
const cancelOrderButton = document.querySelector("#cancelOrderButton");
const copyLoginButton = document.querySelector("#copyLoginButton");
const togglePasswordButton = document.querySelector("#togglePasswordButton");

const countElements = {
  "訂單成立": document.querySelector("#countCreated"),
  "已付款": document.querySelector("#countPaid"),
  "已完成": document.querySelector("#countCompleted"),
  "已取消": document.querySelector("#countCancelled"),
  "全部": document.querySelector("#countAll")
};

function setMessage(target, message, type = "") {
  if (!target) return;
  target.textContent = message || "";
  target.className = `status-message ${type}`.trim();
}

function setLoading(value) {
  loading = Boolean(value);
  [loginButton, refreshButton, completeOrderButton, paidOrderButton, cancelOrderButton, copyLoginButton].forEach((button) => {
    if (button) button.disabled = loading;
  });
}

function showDashboard(active) {
  loginView.hidden = Boolean(active);
  dashboardView.hidden = !active;
}

function createJsonpCallbackName(action) {
  return `__cllAdmin_${action}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function adminJsonpApi(action, payload = {}, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const callbackName = createJsonpCallbackName(action);
    const script = document.createElement("script");
    const cleanup = () => {
      window[callbackName] = () => {};
      script.remove();
      window.setTimeout(() => delete window[callbackName], 30000);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve({ ok: false, error: "TIMEOUT", message: "後台連線逾時，請稍後再試。" });
    }, timeoutMs);

    window[callbackName] = (response) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(response || { ok: false, message: "後台沒有回傳資料。" });
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve({ ok: false, error: "NETWORK_ERROR", message: "後台連線失敗，請確認網路。" });
    };

    const params = new URLSearchParams({
      action,
      callback: callbackName,
      payload: JSON.stringify(payload)
    });
    script.src = `${ADMIN_ENDPOINT}?${params.toString()}`;
    document.head.appendChild(script);
  });
}

async function adminProxyApi(action, payload = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(ADMIN_PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
      cache: "no-store",
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!data) {
      return { ok: false, error: "BAD_RESPONSE", message: "後台回傳格式錯誤。" };
    }
    if (!response.ok && !data.message) {
      data.message = "後台連線失敗，請稍後再試。";
    }
    return data;
  } catch (error) {
    return {
      ok: false,
      error: error.name === "AbortError" ? "TIMEOUT" : "PROXY_FAILED",
      message: error.name === "AbortError" ? "後台連線逾時，請稍後再試。" : "後台連線失敗，正在改用備用通道。"
    };
  } finally {
    window.clearTimeout(timer);
  }
}

async function adminApi(action, payload = {}, timeoutMs = 20000) {
  const directResponse = await adminJsonpApi(action, payload, timeoutMs);
  if (directResponse.ok || ADMIN_MUTATION_ACTIONS.has(action) || !ADMIN_PROXY_FALLBACK_ERRORS.has(directResponse.error)) {
    return directResponse;
  }
  return adminProxyApi(action, payload, timeoutMs);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeStatus(value) {
  if (value === "已付款" || value === "已完成" || value === "已取消") return value;
  return "訂單成立";
}

function currency(value) {
  return `NT$ ${Number(value || 0).toLocaleString("zh-TW")}`;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paymentDisplayName(value) {
  return {
    "網銀": "網銀轉帳",
    "無卡": "無卡存款",
    "LINE Pay": "LINE Pay",
    "街口": "街口支付"
  }[value] || value || "";
}

function extractPlayerNameFromNotes(notes) {
  const text = String(notes || "").replace(/\r/g, "").trim();
  const match = text.match(/玩家名稱[:：]\s*([^\n]+)/);
  return match ? match[1].trim() : "";
}

function parseLoginInfoFromNotes(notes) {
  const result = { method: "", account: "", password: "" };
  const text = String(notes || "").replace(/\r/g, "").trim();
  if (!text) return result;
  const start = text.indexOf("[上號資料]");
  if (start < 0) return result;
  let section = text.slice(start);
  const end = section.indexOf("\n\n");
  if (end >= 0) section = section.slice(0, end);
  section.split("\n").forEach((line) => {
    const match = String(line || "").trim().match(/^([^:：]+)[:：]\s*(.*)$/);
    if (!match) return;
    const key = match[1].trim();
    const value = match[2].trim();
    if (key === "登入方式") result.method = value;
    if (key === "帳號") result.account = value;
    if (key === "密碼") result.password = value;
  });
  return result;
}

function buildOrderDisplayFields(order) {
  const display = order.display || {};
  const notes = String(display.systemNotes || order.systemNotes || order.notes || "").trim();
  const login = parseLoginInfoFromNotes(order.loginInfo || notes);
  const quantity = Number(display.quantity || order.quantity || 1);
  const productName = display.productName || order.productName || "";
  const productWithQuantity = display.productWithQuantity || (productName ? `${productName} ×${quantity}` : "");
  const amountText = display.amountText || currency(order.total);

  return {
    orderId: display.orderId || order.orderId || "",
    paymentMethod: display.paymentMethod || paymentDisplayName(order.paymentMethod) || "",
    gameName: display.gameName || order.gameName || "",
    serverName: display.serverName || order.serverName || "",
    uid: display.uid || order.uid || "",
    playerName: display.playerName || order.playerName || extractPlayerNameFromNotes(notes),
    productName,
    productWithQuantity,
    quantity,
    amountText,
    status: normalizeStatus(display.status || order.status),
    createdAt: display.createdAt || order.orderedAtText || "",
    loginMethod: display.loginMethod || login.method,
    loginAccount: display.loginAccount || login.account,
    loginPassword: display.loginPassword || login.password,
    hasLoginInfo: Boolean(display.hasLoginInfo || login.method || login.account || login.password),
    systemNotes: notes
  };
}

function normalizeOrderText(value) {
  return String(value || "").trim().toLowerCase();
}

function safeCopyValue(value) {
  return value == null ? "" : String(value).trim();
}

function isUidTopupOrder(display) {
  const text = normalizeOrderText([
    display.gameName,
    display.productName,
    display.productWithQuantity
  ].join(" "));
  return text.includes("uid");
}

function isCopyableLoginTopup(display) {
  if (!display.hasLoginInfo || isUidTopupOrder(display)) return false;

  const game = normalizeOrderText(display.gameName);
  const product = normalizeOrderText(display.productName || display.productWithQuantity);
  const isLoginTopup = game.includes("上號") || product.includes("上號");
  const isPubgmLogin = game.includes("pubgm") && isLoginTopup;
  const isDeltaLogin = game.includes("三角洲") && isLoginTopup;

  return isPubgmLogin || isDeltaLogin;
}

function copyGameName(display) {
  const game = String(display.gameName || "");
  if (game.toLowerCase().includes("pubgm")) return "PUBGM";
  if (game.includes("三角洲")) return "三角洲";
  return game;
}

function buildLoginCopyText(display) {
  return [
    "【上號儲值資料】",
    "",
    `【遊戲】：${safeCopyValue(copyGameName(display))}`,
    `【商品】：${safeCopyValue(display.productName)}`,
    `【伺服器】：${safeCopyValue(display.serverName)}`,
    `【登入方式】：${safeCopyValue(display.loginMethod)}`,
    `【帳號】：${safeCopyValue(display.loginAccount)}`,
    `【密碼】：${safeCopyValue(display.loginPassword)}`,
    `【UID】：${safeCopyValue(display.uid)}`,
    `【玩家名稱】：${safeCopyValue(display.playerName)}`,
    `【數量】：${safeCopyValue(display.quantity)}`,
    "",
    "請照以上資料登入處理，完成後回覆：完成"
  ].join("\n");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("COPY_FAILED");
}

function infoRow(label, value) {
  const text = value == null || value === "" ? "未填" : value;
  return `
    <div class="info-row">
      <span class="info-label">【${escapeHtml(label)}】</span>
      <span class="info-value">${escapeHtml(text)}</span>
    </div>
  `;
}

function systemNotesSection(notes) {
  if (!String(notes || "").trim()) return "";
  return `
    <details class="system-notes">
      <summary>系統紀錄</summary>
      <pre>${escapeHtml(notes)}</pre>
    </details>
  `;
}

function orderSearchText(order) {
  const display = buildOrderDisplayFields(order);
  return [
    display.orderId,
    display.uid,
    display.playerName,
    display.gameName,
    display.productName,
    display.serverName,
    display.loginMethod,
    display.loginAccount
  ].join(" ").toLowerCase();
}

function getFilteredOrders() {
  const keyword = String(orderSearch.value || "").trim().toLowerCase();
  return allOrders
    .filter((order) => {
      const statusOk = currentStatus === "全部" || normalizeStatus(order.status) === currentStatus;
      const keywordOk = !keyword || orderSearchText(order).includes(keyword);
      return statusOk && keywordOk;
    })
    .sort((a, b) => (
      Number(b.orderedAtMillis || 0) - Number(a.orderedAtMillis || 0)
      || Number(b.rowNumber || 0) - Number(a.rowNumber || 0)
    ));
}

function renderCounts(counts = {}) {
  ADMIN_STATUS_TABS.forEach((status) => {
    if (countElements[status]) countElements[status].textContent = Number(counts[status] || 0);
  });
}

function statusClass(status) {
  if (status === "已付款") return "paid";
  if (status === "已完成") return "done";
  if (status === "已取消") return "cancelled";
  return "";
}

function renderOrders() {
  const orders = getFilteredOrders();
  if (!orders.length) {
    orderList.innerHTML = `<p class="empty-state">目前沒有符合條件的訂單。</p>`;
    return;
  }

  orderList.innerHTML = orders.map((order) => {
    const display = buildOrderDisplayFields(order);
    return `
      <button class="order-card" type="button" data-order-id="${escapeHtml(order.orderId)}">
        <div class="order-card-head">
          <span class="order-id">${escapeHtml(display.orderId || "未填訂單")}</span>
          <span class="status-pill ${statusClass(display.status)}">${escapeHtml(display.status)}</span>
        </div>
        <div class="order-info-list">
          ${infoRow("訂單編號", display.orderId)}
          ${infoRow("付款方式", display.paymentMethod)}
          ${infoRow("購買遊戲", display.gameName)}
          ${infoRow("伺服器", display.serverName)}
          ${infoRow("UID", display.uid)}
          ${infoRow("玩家名稱", display.playerName)}
          ${infoRow("購買商品", display.productWithQuantity)}
          ${infoRow("金額", display.amountText)}
          ${infoRow("狀態", display.status)}
        </div>
      </button>
    `;
  }).join("");
}

function detailItem(label, value) {
  const text = value == null || value === "" ? "未填" : value;
  return `
    <div class="detail-item">
      <span class="detail-label">${escapeHtml(label)}</span>
      <span class="detail-value">${escapeHtml(text)}</span>
    </div>
  `;
}

function openOrderDetail(order) {
  selectedOrder = order;
  const display = buildOrderDisplayFields(order);
  detailTitle.textContent = display.orderId || "訂單詳情";
  const detailRows = [
    detailItem("訂單編號", display.orderId),
    detailItem("付款方式", display.paymentMethod),
    detailItem("購買遊戲", display.gameName),
    detailItem("伺服器", display.serverName),
    detailItem("UID", display.uid),
    detailItem("玩家名稱", display.playerName),
    detailItem("購買商品", display.productName),
    detailItem("數量", display.quantity),
    detailItem("金額", display.amountText),
    detailItem("下單時間", display.createdAt),
    detailItem("訂單狀態", display.status)
  ];
  if (display.hasLoginInfo) {
    detailRows.push(
      detailItem("登入方式", display.loginMethod),
      detailItem("帳號", display.loginAccount),
      detailItem("密碼", display.loginPassword)
    );
  }
  detailGrid.innerHTML = detailRows.join("") + systemNotesSection(display.systemNotes);

  const normalized = display.status;
  completeOrderButton.disabled = loading || normalized === "已完成";
  paidOrderButton.disabled = loading || normalized === "已付款";
  cancelOrderButton.disabled = loading || normalized === "已取消";
  if (copyLoginButton) {
    copyLoginButton.hidden = !isCopyableLoginTopup(display);
    copyLoginButton.disabled = loading || copyLoginButton.hidden;
  }

  if (typeof orderDialog.showModal === "function") {
    orderDialog.showModal();
  } else {
    orderDialog.setAttribute("open", "");
  }
}

function closeOrderDetail() {
  selectedOrder = null;
  if (copyLoginButton) copyLoginButton.hidden = true;
  if (orderDialog.open) orderDialog.close();
}

async function copySelectedLoginInfo() {
  if (!selectedOrder) return;
  const display = buildOrderDisplayFields(selectedOrder);
  if (!isCopyableLoginTopup(display)) return;

  try {
    await copyTextToClipboard(buildLoginCopyText(display));
    window.alert("上號資料已複製，可以貼到群組");
  } catch (error) {
    window.alert("複製失敗，請再試一次。");
  }
}

async function loadOrders(showToast = false) {
  if (!adminToken) return;
  setLoading(true);
  setMessage(
    dashboardMessage,
    showToast ? "讀取訂單中，第一次開啟可能需要 10-30 秒..." : "正在同步訂單資料..."
  );
  const response = await adminApi("listOrders", {
    token: adminToken,
    status: currentStatus
  }, 60000);
  setLoading(false);

  if (!response.ok) {
    if (response.error === "ADMIN_UNAUTHORIZED") {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      adminToken = "";
      showDashboard(false);
      setMessage(loginMessage, "登入已過期，請重新登入。", "error");
      return;
    }
    setMessage(dashboardMessage, response.message || "讀取訂單失敗。", "error");
    return;
  }

  allOrders = Array.isArray(response.orders) ? response.orders : [];
  renderCounts(response.counts || {});
  renderOrders();
  setMessage(dashboardMessage, showToast ? `已更新 ${allOrders.length} 筆訂單。` : "", "success");
}

async function updateSelectedOrder(status) {
  if (!selectedOrder || !adminToken || loading) return;
  const actionLabels = {
    "已付款": "標記已付款",
    "已完成": "標記已完成",
    "已取消": "標記已取消"
  };
  const label = actionLabels[status] || `改為${status}`;
  if (!window.confirm(`確定要將 ${selectedOrder.orderId} ${label}？`)) return;

  setLoading(true);
  setMessage(dashboardMessage, "更新訂單狀態中...");
  const response = await adminApi("updateOrderStatus", {
    token: adminToken,
    orderId: selectedOrder.orderId,
    status
  }, 30000);
  setLoading(false);

  if (!response.ok) {
    setMessage(dashboardMessage, response.message || "更新失敗。", "error");
    return;
  }

  const updatedOrderId = selectedOrder.orderId;
  closeOrderDetail();
  setMessage(dashboardMessage, `已更新 ${updatedOrderId}。`, "success");
  await loadOrders(false);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loading) return;
  const password = adminPassword.value;
  if (!password) {
    setMessage(loginMessage, "請輸入後台密碼。", "error");
    return;
  }

  setLoading(true);
  setMessage(loginMessage, "登入中...");
  const passwordHash = await sha256Hex(password);
  const response = await adminApi("adminLogin", { passwordHash }, 20000);
  setLoading(false);

  if (!response.ok || !response.token) {
    setMessage(loginMessage, response.message || "登入失敗。", "error");
    return;
  }

  adminToken = response.token;
  localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
  adminPassword.value = "";
  setMessage(loginMessage, "");
  showDashboard(true);
  setMessage(dashboardMessage, "登入成功，正在讀取訂單...");
  await loadOrders(true);
});

togglePasswordButton.addEventListener("click", () => {
  const visible = adminPassword.type === "text";
  adminPassword.type = visible ? "password" : "text";
  togglePasswordButton.textContent = visible ? "看" : "藏";
});

logoutButton.addEventListener("click", () => {
  adminToken = "";
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  allOrders = [];
  showDashboard(false);
  setMessage(loginMessage, "已登出。", "success");
});

refreshButton.addEventListener("click", () => loadOrders(true));

orderSearch.addEventListener("input", renderOrders);

statusTabs.forEach((button) => {
  button.addEventListener("click", () => {
    currentStatus = button.dataset.status || "訂單成立";
    statusTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    loadOrders(true);
  });
});

orderList.addEventListener("click", (event) => {
  const card = event.target.closest(".order-card");
  if (!card) return;
  const order = allOrders.find((item) => item.orderId === card.dataset.orderId);
  if (order) openOrderDetail(order);
});

closeDialogButton.addEventListener("click", closeOrderDetail);
orderDialog.addEventListener("click", (event) => {
  if (event.target === orderDialog) closeOrderDetail();
});
completeOrderButton.addEventListener("click", () => updateSelectedOrder("已完成"));
paidOrderButton.addEventListener("click", () => updateSelectedOrder("已付款"));
cancelOrderButton.addEventListener("click", () => updateSelectedOrder("已取消"));
copyLoginButton.addEventListener("click", copySelectedLoginInfo);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

if (adminToken) {
  showDashboard(true);
  loadOrders(false);
} else {
  showDashboard(false);
}
