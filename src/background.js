// x.com 时间追踪器 - 后台服务

const LIMIT_MINUTES = 10;
const CHECK_INTERVAL_SECONDS = 5;
const ALARM_NAME = "x-time-check";
const DEFAULT_RESET_THRESHOLD_MINUTES = 3;

const CLERK_PUBLISHABLE_KEY = "pk_test_Z3JhbnQtcmFtLTYwLmNsZXJrLmFjY291bnRzLmRldiQ";
const FAPI_BASE = "https://grant-ram-60.clerk.accounts.dev";

// 状态
let activeTabId = null;
let startTime = null;
let isNotified = false;
let accumulatedSeconds = 0;
let lastStopTime = null;
let lastOverlayTime = 0;

// === Clerk FAPI ===
async function clerkFetch(endpoint, body = {}) {
  const response = await fetch(`${FAPI_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: CLERK_PUBLISHABLE_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    const errors = data.errors || [{ message: "请求失败" }];
    throw { errors };
  }

  return data;
}

function extractUser(client, response) {
  const session = client?.active_sessions?.[0];
  const user = session?.user || {};
  return {
    id: user.id || response?.id || "",
    name: user.first_name || user.username || "用户",
    email:
      user.email_addresses?.[0]?.email_address ||
      (response?.email_address ? response.email_address : ""),
    imageUrl: user.image_url || "",
    loggedInAt: Date.now(),
  };
}

async function handleClerkAPI(action, params) {
  switch (action) {
    case "signIn": {
      const data = await clerkFetch("/v1/client/sign_ins", {
        identifier: params.email,
        password: params.password,
      });
      if (data.response?.status === "complete") {
        return {
          ok: true,
          data: { status: "complete", user: extractUser(data.client, data.response) },
        };
      }
      return { ok: true, data: { status: data.response?.status || "unknown" } };
    }

    case "signUp": {
      const data = await clerkFetch("/v1/client/sign_ups", {
        email_address: params.email,
        password: params.password,
        first_name: params.name,
      });
      if (data.response?.status === "complete") {
        return {
          ok: true,
          data: { status: "complete", user: extractUser(data.client, data.response) },
        };
      }
      if (data.response?.status === "missing_requirements") {
        // Prepare email verification
        await clerkFetch(
          `/v1/client/sign_ups/${data.response.id}/prepare_verification`,
          { strategy: "email_code" }
        );
        return {
          ok: true,
          data: {
            status: "needs_verification",
            signUpId: data.response.id,
          },
        };
      }
      return { ok: true, data: { status: data.response?.status || "unknown" } };
    }

    case "verifyEmail": {
      const data = await clerkFetch(
        `/v1/client/sign_ups/${params.signUpId}/attempt_verification`,
        { strategy: "email_code", code: params.code }
      );
      if (data.response?.status === "complete") {
        return {
          ok: true,
          data: { status: "complete", user: extractUser(data.client, data.response) },
        };
      }
      return { ok: true, data: { status: data.response?.status || "unknown" } };
    }

    default:
      return { ok: false, error: { errors: [{ message: "未知操作" }] } };
  }
}

// === 初始化 ===
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    totalMinutesToday: 0,
    todayDate: new Date().toDateString(),
    resetThresholdMinutes: DEFAULT_RESET_THRESHOLD_MINUTES,
  });
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_SECONDS / 60,
  });
});

// 定时检查
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkAndNotify();
  }
});

// 监听标签页切换和更新
chrome.tabs.onActivated.addListener(handleTabChange);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    handleTabChange({ tabId });
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    stopTimer();
  }
});

// 窗口失去焦点时暂停计时
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopTimer();
  } else {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]) handleTabChange({ tabId: tabs[0].id });
    });
  }
});

function isXDomain(url) {
  return url && (url.includes("x.com") || url.includes("twitter.com"));
}

function handleTabChange(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && isXDomain(tab.url)) {
      if (activeTabId !== activeInfo.tabId) {
        stopTimer();
        activeTabId = activeInfo.tabId;

        chrome.storage.local.get(["resetThresholdMinutes"], (result) => {
          const thresholdMs =
            (result.resetThresholdMinutes || DEFAULT_RESET_THRESHOLD_MINUTES) *
            60 *
            1000;
          if (lastStopTime && Date.now() - lastStopTime > thresholdMs) {
            accumulatedSeconds = 0;
          }
          startTime = Date.now();
          isNotified = false;
          const totalSec = accumulatedSeconds;
          const m = Math.floor(totalSec / 60);
          const s = totalSec % 60;
          updateBadge(`${m}:${String(s).padStart(2, "0")}`, "#22c55e");
        });
      }
    } else {
      if (activeTabId) {
        stopTimer();
      }
    }
  });
}

function stopTimer() {
  if (activeTabId && startTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    accumulatedSeconds += elapsed;
    lastStopTime = Date.now();

    const startTs = startTime;
    const endTs = Date.now();
    const totalElapsed = endTs - startTs;
    chrome.storage.local.get(
      ["totalMinutesToday", "todayDate", "sessionHistory"],
      (result) => {
        const today = new Date().toDateString();
        if (result.todayDate !== today) {
          chrome.storage.local.set({ totalMinutesToday: 0, todayDate: today });
        }
        const total = (result.totalMinutesToday || 0) + totalElapsed / 60000;

        const history = result.sessionHistory || [];
        history.push({
          start: startTs,
          end: endTs,
          duration: Math.round(totalElapsed / 1000),
        });
        if (history.length > 200) history.splice(0, history.length - 200);

        chrome.storage.local.set({
          totalMinutesToday: total,
          sessionHistory: history,
        });
      }
    );
  }
  activeTabId = null;
  startTime = null;
}

function checkAndNotify() {
  if (!startTime) return;

  const currentElapsed = (Date.now() - startTime) / 1000;
  const totalSeconds = accumulatedSeconds + currentElapsed;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  let color = "#22c55e";
  if (minutes >= 10) color = "#ef4444";
  else if (minutes >= 7) color = "#f59e0b";
  updateBadge(timeStr, color);

  chrome.storage.local.set({
    currentSeconds: Math.floor(totalSeconds),
    isTracking: true,
  });

  if (minutes >= LIMIT_MINUTES) {
    // 桌面通知只发一次
    if (!isNotified) {
      isNotified = true;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "⏰ X.com 时间提醒",
        message: `你已经在 x.com 上浏览了 ${minutes} 分钟，该休息一下了！`,
        priority: 2,
      });
    }

    // 每10秒弹一次页面遮罩（检查是否在解除期内）
    const now = Date.now();
    if (now - lastOverlayTime >= 10000 && activeTabId) {
      chrome.storage.local.get(["suppressUntil"], (result) => {
        if (!result.suppressUntil || now >= result.suppressUntil) {
          lastOverlayTime = now;
          chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            func: showAlertOverlay,
            args: [minutes],
          }).catch(() => {});
        }
      });
    }
  }

  chrome.storage.local.get(["totalMinutesToday", "todayDate"], (result) => {
    const today = new Date().toDateString();
    let total = result.totalMinutesToday || 0;
    if (result.todayDate !== today) {
      total = 0;
      chrome.storage.local.set({ todayDate: today });
    }
    const currentTotal = total + currentElapsed / 60;
    chrome.storage.local.set({ displayTotalMinutes: currentTotal });
  });
}

function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// 注入到 x.com 页面的弹窗函数（由 chrome.scripting.executeScript 调用）
function showAlertOverlay(minutes) {
  // 移除旧的弹窗，强制刷新
  const old = document.getElementById("x-time-overlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "x-time-overlay";
  overlay.innerHTML = `
    <div style="
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: center; justify-content: center;
      animation: x-overlay-in 0.3s ease-out;
    ">
      <div style="
        background: linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);
        border-radius: 24px; padding: 44px 52px; max-width: 460px; width: 90%;
        text-align: center;
        box-shadow: 0 25px 60px rgba(0,0,0,0.5),0 0 120px rgba(239,68,68,0.15);
        border: 1px solid rgba(255,255,255,0.08);
        font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        position: relative; overflow: hidden;
      ">
        <div style="
          position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle,rgba(239,68,68,0.08) 0%,transparent 50%);
          animation: x-pulse-bg 2s ease-in-out infinite; pointer-events: none;
        "></div>
        <div style="position:relative;z-index:1">
          <div style="
            width:72px;height:72px;margin:0 auto 20px;
            background:linear-gradient(135deg,#ef4444,#dc2626);
            border-radius:50%;display:flex;align-items:center;justify-content:center;
            font-size:36px;animation:x-pulse 1.5s ease-in-out infinite;
            box-shadow:0 0 40px rgba(239,68,68,0.3);
          ">🚨</div>
          <h2 style="color:#f1f5f9;font-size:26px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px">你已经沉迷了 ${minutes} 分钟！</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px">关闭后 10 秒会再次提醒，输入超级密码可解除 6 小时</p>

          <div style="margin-bottom:20px">
            <input id="x-super-pwd" type="password" maxlength="10" placeholder="输入超级密码" style="
              width:200px;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);
              background:rgba(255,255,255,0.06);color:#f1f5f9;font-size:15px;text-align:center;
              outline:none;letter-spacing:3px;
            ">
            <div id="x-pwd-error" style="color:#ef4444;font-size:12px;margin-top:6px;min-height:18px"></div>
          </div>

          <button id="x-overlay-unlock" style="
            background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;
            padding:12px 40px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;
            box-shadow:0 4px 15px rgba(34,197,94,0.3);margin-bottom:16px;display:block;width:100%;
          ">🔓 解除限制 6 小时</button>

          <button id="x-overlay-dismiss" style="
            background:transparent;color:#64748b;border:1px solid rgba(255,255,255,0.1);
            padding:8px 24px;border-radius:8px;font-size:13px;cursor:pointer;
          ">暂时关闭（10秒后回来）</button>
        </div>
      </div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes x-overlay-in { from{opacity:0} to{opacity:1} }
    @keyframes x-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
    @keyframes x-pulse-bg { 0%,100%{opacity:0.5} 50%{opacity:1} }
    #x-super-pwd:focus { border-color: rgba(34,197,94,0.5); box-shadow: 0 0 15px rgba(34,197,94,0.15); }
    @keyframes x-shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  `;
  overlay.appendChild(style);
  document.documentElement.appendChild(overlay);

  const pwdInput = document.getElementById("x-super-pwd");
  const pwdError = document.getElementById("x-pwd-error");
  const dismissBtn = document.getElementById("x-overlay-dismiss");
  const unlockBtn = document.getElementById("x-overlay-unlock");

  function closeOverlay() {
    overlay.remove();
    document.body.style.overflow = "";
  }

  // 暂时关闭
  dismissBtn.addEventListener("click", closeOverlay);

  // 解除限制
  unlockBtn.addEventListener("click", () => {
    if (pwdInput.value === "8888") {
      // 通过扩展存储设置解除时间
      chrome.storage.local.set({ suppressUntil: Date.now() + 6 * 60 * 60 * 1000 });
      closeOverlay();
    } else {
      pwdError.textContent = "❌ 密码错误";
      pwdInput.value = "";
      pwdInput.focus();
      // 抖动效果
      unlockBtn.style.animation = "none";
      unlockBtn.offsetHeight;
      unlockBtn.style.animation = "x-shake 0.4s ease";
      setTimeout(() => { pwdError.textContent = ""; }, 2000);
    }
  });

  // 回车提交
  pwdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlockBtn.click();
  });

  pwdInput.focus();

  document.body.style.overflow = "hidden";
  const observer = new MutationObserver(() => {
    if (!document.getElementById("x-time-overlay")) {
      document.body.style.overflow = "";
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true });
}

// === Message Handling ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CLERK_API") {
    handleClerkAPI(message.action, message.params)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: { errors: err.errors || [{ message: "请求失败" }] },
        })
      );
    return true; // keep channel open for async response
  }

  if (message.type === "AUTH_SUCCESS" || message.type === "AUTH_LOGOUT") {
    sendResponse({ ok: true });
  }
});
