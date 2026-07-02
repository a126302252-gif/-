const ADMIN_ENDPOINT = "https://script.google.com/macros/s/AKfycbwDT3asNWUlAHI3D5Yv7sjSkHPToDpj0Yk5wU7Pb-eiXAkWIUqJQ-nxdWCgcr4gpYZB/exec";
const ALLOWED_ACTIONS = new Set(["adminLogin", "listOrders", "updateOrderStatus", "sendDiscordStatusNotify"]);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function parseAppsScriptResponse(text) {
  const safeText = String(text || "").trim();
  if (!safeText) return { ok: false, message: "後台沒有回傳資料。" };
  try {
    return JSON.parse(safeText);
  } catch (error) {
    const match = safeText.match(/^[^(]+\(([\s\S]*)\);?$/);
    if (match) return JSON.parse(match[1]);
    throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "後台 API 只接受 POST。" });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { ok: false, message: "後台資料格式錯誤。" });
  }

  const action = String(body.action || "").trim();
  if (!ALLOWED_ACTIONS.has(action)) {
    return json(400, { ok: false, message: "未知的後台操作。" });
  }

  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const params = new URLSearchParams({
    action,
    callback: "__cllAdminProxy",
    payload: JSON.stringify(payload)
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(`${ADMIN_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      signal: controller.signal
    });
    const text = await response.text();
    const data = parseAppsScriptResponse(text);
    return json(response.ok ? 200 : 502, data);
  } catch (error) {
    return json(504, {
      ok: false,
      error: error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      message: error.name === "AbortError" ? "後台連線逾時，請稍後再試。" : "後台連線失敗，請確認網路。"
    });
  } finally {
    clearTimeout(timer);
  }
};
