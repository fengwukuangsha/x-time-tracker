const timerEl = document.getElementById("timer");
const statusLabel = document.getElementById("statusLabel");
const progressFill = document.getElementById("progressFill");
const todayTotalEl = document.getElementById("todayTotal");
const limitDisplayEl = document.getElementById("limitDisplay");
const limitInput = document.getElementById("limitInput");
const resetBtn = document.getElementById("resetBtn");

let updateInterval = null;

// 加载设置
chrome.storage.local.get(["limitMinutes"], (result) => {
  if (result.limitMinutes) limitInput.value = result.limitMinutes;
});

// 保存设置
limitInput.addEventListener("change", () => {
  const val = Math.max(1, Math.min(120, parseInt(limitInput.value) || 10));
  limitInput.value = val;
  limitDisplayEl.textContent = val + "m";
  chrome.storage.local.set({ limitMinutes: val });
});

// 重置
resetBtn.addEventListener("click", () => {
  chrome.storage.local.set({ totalMinutesToday: 0, todayDate: new Date().toDateString() });
  todayTotalEl.textContent = "0m";
});

function updateDisplay() {
  chrome.storage.local.get(
    ["currentSeconds", "isTracking", "displayTotalMinutes", "limitMinutes", "todayDate"],
    (result) => {
      const limit = result.limitMinutes || 10;
      limitDisplayEl.textContent = limit + "m";

      // 今日累计
      const today = new Date().toDateString();
      let total = 0;
      if (result.todayDate === today) {
        total = result.displayTotalMinutes || 0;
      }
      if (total >= 60) {
        todayTotalEl.textContent = (total / 60).toFixed(1) + "h";
      } else {
        todayTotalEl.textContent = Math.round(total) + "m";
      }

      // 当前计时
      if (result.isTracking && result.currentSeconds != null) {
        const minutes = Math.floor(result.currentSeconds / 60);
        const seconds = result.currentSeconds % 60;
        const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

        timerEl.textContent = timeStr;
        timerEl.className = "timer";

        const percent = Math.min((minutes / limit) * 100, 100);
        progressFill.style.width = percent + "%";

        if (minutes >= limit) {
          timerEl.classList.add("red");
          statusLabel.textContent = `已超过 ${limit} 分钟限制!`;
          statusLabel.className = "status-label danger";
          progressFill.style.background = "#ef4444";
        } else if (minutes >= limit * 0.7) {
          timerEl.classList.add("yellow");
          statusLabel.textContent = "正在计时 - 即将到达上限";
          statusLabel.className = "status-label warning";
          progressFill.style.background = "#f59e0b";
        } else {
          timerEl.classList.add("green");
          statusLabel.textContent = "正在计时...";
          statusLabel.className = "status-label active";
          progressFill.style.background = "#22c55e";
        }
      } else {
        timerEl.textContent = "--:--";
        timerEl.className = "timer idle";
        statusLabel.textContent = "等待访问 x.com";
        statusLabel.className = "status-label";
        progressFill.style.width = "0%";
      }
    }
  );
}

// 打开时立即刷新，之后每秒更新
updateDisplay();
updateInterval = setInterval(updateDisplay, 1000);

// 关闭弹窗时清除
window.addEventListener("unload", () => clearInterval(updateInterval));
