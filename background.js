// x.com 时间追踪器 - 后台服务

const LIMIT_MINUTES = 10;
const CHECK_INTERVAL_SECONDS = 5;
const ALARM_NAME = "x-time-check";
const DEFAULT_RESET_THRESHOLD_MINUTES = 3;

// 状态
let activeTabId = null;
let startTime = null;
let isNotified = false;
let accumulatedSeconds = 0; // 离开前已累计的秒数
let lastStopTime = null;

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    totalMinutesToday: 0,
    todayDate: new Date().toDateString(),
    resetThresholdMinutes: DEFAULT_RESET_THRESHOLD_MINUTES
  });
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_SECONDS / 60 });
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

        // 检查离开时间是否超过重置阈值
        chrome.storage.local.get(["resetThresholdMinutes"], (result) => {
          const thresholdMs = (result.resetThresholdMinutes || DEFAULT_RESET_THRESHOLD_MINUTES) * 60 * 1000;
          if (lastStopTime && (Date.now() - lastStopTime) > thresholdMs) {
            accumulatedSeconds = 0; // 超过阈值，重置累计
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

    // 累计今日时间
    const startTs = startTime;
    const endTs = Date.now();
    const totalElapsed = endTs - startTs;
    chrome.storage.local.get(["totalMinutesToday", "todayDate", "sessionHistory"], (result) => {
      const today = new Date().toDateString();
      if (result.todayDate !== today) {
        chrome.storage.local.set({ totalMinutesToday: 0, todayDate: today });
      }
      const total = (result.totalMinutesToday || 0) + totalElapsed / 60000;

      // 保存访问记录
      const history = result.sessionHistory || [];
      history.push({
        start: startTs,
        end: endTs,
        duration: Math.round(totalElapsed / 1000)
      });
      if (history.length > 200) history.splice(0, history.length - 200);

      chrome.storage.local.set({ totalMinutesToday: total, sessionHistory: history });
    });
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

  // 更新 badge
  let color = "#22c55e"; // 绿色
  if (minutes >= 10) color = "#ef4444"; // 红色
  else if (minutes >= 7) color = "#f59e0b"; // 黄色
  updateBadge(timeStr, color);

  // 更新存储
  chrome.storage.local.set({ currentSeconds: Math.floor(totalSeconds), isTracking: true });

  // 超时提醒
  if (minutes >= LIMIT_MINUTES && !isNotified) {
    isNotified = true;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "⏰ X.com 时间提醒",
      message: `你已经在 x.com 上浏览了 ${minutes} 分钟，该休息一下了！`,
      priority: 2
    });
  }

  // 累计今日总时间
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
