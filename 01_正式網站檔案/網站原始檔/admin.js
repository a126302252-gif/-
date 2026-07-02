const ADMIN_ENDPOINT = "https://script.google.com/macros/s/AKfycbwDT3asNWUlAHI3D5Yv7sjSkHPToDpj0Yk5wU7Pb-eiXAkWIUqJQ-nxdWCgcr4gpYZB/exec";
const ADMIN_TOKEN_KEY = "cll_admin_session_v1";
const ADMIN_STATUS_TABS = ["訂單成立", "已完成", "已取消", "全部"];

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
const cancelOrderButton = document.querySelector("#cancelOrderButton");
const togglePasswordButton = document.querySelector("#togglePasswordButton");

const countElements = {
  "訂單成立": document.querySelector("#countCreated"),
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
  [loginButton, refreshButton, completeOrderButton, cancelOrderButton].forEach((button) => {
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

function adminApi(action, payload = {}, timeoutMs = 20000) {
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

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeStatus(value) {
  if (value === "已完成" || value === "已取消") return value;
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

function orderSearchText(order) {
  return [
    order.orderId,
    order.uid,
    order.playerName,
    order.gameName,
    order.productName,
    order.serverName,
    order.loginInfo
  ].join(" ").toLowerCase();
}

function getFilteredOrders() {
  const keyword = String(orderSearch.value || "").trim().toLowerCase();
  return allOrders.filter((order) => {
    const statusOk = currentStatus === "全部" || normalizeStatus(order.status) === currentStatus;
    const keywordOk = !keyword || orderSearchText(order).includes(keyword);
    return statusOk && keywordOk;
  });
}

function renderCounts(counts = {}) {
  ADMIN_STATUS_TABS.forEach((status) => {
    if (countElements[status]) countElements[status].textContent = Number(counts[status] || 0);
  });
}

function statusClass(status) {
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

  orderList.innerHTML = orders.map((order) => `
    <button class="order-card" type="button" data-order-id="${escapeHtml(order.orderId)}">
      <div class="order-top">
        <span class="order-id">${escapeHtml(order.orderId)}</span>
        <span class="status-pill ${statusClass(normalizeStatus(order.status))}">${escapeHtml(normalizeStatus(order.status))}</span>
      </div>
      <div class="order-title">${escapeHtml(order.gameName || "未填遊戲")}｜${escapeHtml(order.productName || "未填商品")}</div>
      <div class="order-meta">
        <span>數量：${escapeHtml(order.quantity || 1)}｜付款：${escapeHtml(order.paymentMethod || "未填")}</span>
        <span>UID：${escapeHtml(order.uid || "未填")}｜玩家：${escapeHtml(order.playerName || "未填")}</span>
        <span>區服：${escapeHtml(order.serverName || "未填")}</span>
      </div>
      <div class="order-bottom">
        <span>${escapeHtml(order.orderedAtText || "")}</span>
        <strong class="money">${escapeHtml(currency(order.total))}</strong>
      </div>
    </button>
  `).join("");
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
  detailTitle.textContent = order.orderId || "訂單詳情";
  detailGrid.innerHTML = [
    detailItem("訂單編號", order.orderId),
    detailItem("目前狀態", normalizeStatus(order.status)),
    detailItem("下單時間", order.orderedAtText),
    detailItem("客人 LINE", order.customerLine),
    detailItem("遊戲", order.gameName),
    detailItem("商品 / 方案", order.productName),
    detailItem("數量", order.quantity),
    detailItem("金額", currency(order.total)),
    detailItem("付款方式", order.paymentMethod),
    detailItem("UID", order.uid),
    detailItem("玩家名稱", order.playerName),
    detailItem("區服", order.serverName),
    detailItem("上號資料", order.loginInfo),
    detailItem("備註", order.notes)
  ].join("");

  const normalized = normalizeStatus(order.status);
  completeOrderButton.disabled = loading || normalized === "已完成";
  cancelOrderButton.disabled = loading || normalized === "已取消";

  if (typeof orderDialog.showModal === "function") {
    orderDialog.showModal();
  } else {
    orderDialog.setAttribute("open", "");
  }
}

function closeOrderDetail() {
  selectedOrder = null;
  if (orderDialog.open) orderDialog.close();
}

async function loadOrders(showToast = false) {
  if (!adminToken) return;
  setLoading(true);
  if (showToast) setMessage(dashboardMessage, "讀取訂單中...");
  const response = await adminApi("listOrders", {
    token: adminToken,
    status: "全部"
  });
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
  const label = status === "已完成" ? "標記已完成" : "標記已取消";
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
    renderOrders();
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
cancelOrderButton.addEventListener("click", () => updateSelectedOrder("已取消"));

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
