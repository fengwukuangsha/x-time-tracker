const timerEl = document.getElementById("timer");
const statusLabel = document.getElementById("statusLabel");
const progressFill = document.getElementById("progressFill");
const todayTotalEl = document.getElementById("todayTotal");
const limitDisplayEl = document.getElementById("limitDisplay");
const limitInput = document.getElementById("limitInput");
const resetBtn = document.getElementById("resetBtn");

// Honor elements
const honorIcon = document.getElementById("honorIcon");
const honorName = document.getElementById("honorName");
const honorPoints = document.getElementById("honorPoints");
const streakDays = document.getElementById("streakDays");
const streakTag = document.getElementById("streakTag");
const levelFill = document.getElementById("levelFill");
const levelHint = document.getElementById("levelHint");
const bonusToast = document.getElementById("bonusToast");

// === Level System ===
const LEVELS = [
  { name: "新手",   minPoints: 0,    icon: "🌱", color: "#737373" },
  { name: "自律者", minPoints: 50,   icon: "🎯", color: "#22c55e" },
  { name: "坚持者", minPoints: 150,  icon: "⚡", color: "#3b82f6" },
  { name: "守护者", minPoints: 350,  icon: "🛡️", color: "#a855f7" },
  { name: "时光大师", minPoints: 700,  icon: "⏳", color: "#f59e0b" },
  { name: "传奇",   minPoints: 1500, icon: "👑", color: "#ef4444" },
];

// === Streak Milestone Bonuses ===
const STREAK_MILESTONES = [
  { days: 3,  bonus: 20 },
  { days: 7,  bonus: 50 },
  { days: 14, bonus: 100 },
  { days: 30, bonus: 200 },
  { days: 60, bonus: 500 },
];

const POINTS_LOGIN = 2;
const POINTS_RESET = 5;

let updateInterval = null;

// --- Honor Helpers ---

function getLevel(points) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) return LEVELS[i];
  }
  return LEVELS[0];
}

function getNextLevel(points) {
  for (const lvl of LEVELS) {
    if (points < lvl.minPoints) return lvl;
  }
  return null;
}

function showToast(msg) {
  bonusToast.textContent = msg;
  bonusToast.classList.add("show");
  setTimeout(() => bonusToast.classList.remove("show"), 2000);
}

function updateHonorDisplay(points, streak) {
  const level = getLevel(points);
  const nextLevel = getNextLevel(points);

  honorIcon.textContent = level.icon;
  honorIcon.style.borderColor = level.color;
  honorName.textContent = level.name;
  honorName.style.color = level.color;
  honorPoints.textContent = points + " 积分";

  streakDays.textContent = streak;
  if (streak >= 7) {
    streakTag.style.color = "#f59e0b";
    streakTag.style.borderColor = "#f59e0b33";
  } else if (streak >= 3) {
    streakTag.style.color = "#22c55e";
    streakTag.style.borderColor = "#22c55e33";
  } else {
    streakTag.style.color = "#737373";
    streakTag.style.borderColor = "#262626";
  }

  if (nextLevel) {
    const range = nextLevel.minPoints - level.minPoints;
    const current = points - level.minPoints;
    const pct = Math.min((current / range) * 100, 100);
    levelFill.style.width = pct + "%";
    levelFill.style.background = level.color;
    const need = nextLevel.minPoints - points;
    levelHint.textContent = `距离 ${nextLevel.name} 还需 ${need} 积分`;
  } else {
    levelFill.style.width = "100%";
    levelFill.style.background = "linear-gradient(90deg, #f59e0b, #ef4444)";
    levelHint.textContent = "已达最高等级!";
  }
}

function awardLoginPoints() {
  chrome.storage.local.get(
    ["points", "lastLoginDate", "streak", "claimedMilestones"],
    (result) => {
      const today = new Date().toDateString();
      let points = result.points || 0;
      const lastLogin = result.lastLoginDate;

      if (lastLogin === today) {
        updateHonorDisplay(points, result.streak || 1);
        return;
      }

      // Award login points
      points += POINTS_LOGIN;

      // Calculate streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      let newStreak;
      if (lastLogin === yesterday.toDateString()) {
        newStreak = (result.streak || 0) + 1;
      } else {
        newStreak = 1;
      }

      // Check streak milestone bonuses
      const milestones = result.claimedMilestones || [];
      let bonusTotal = 0;
      for (const m of STREAK_MILESTONES) {
        if (newStreak >= m.days && !milestones.includes(m.days)) {
          bonusTotal += m.bonus;
          milestones.push(m.days);
        }
      }

      if (bonusTotal > 0) {
        points += bonusTotal;
        showToast(`+${bonusTotal} 连续登录奖励! (${newStreak}天)`);
      }

      chrome.storage.local.set({
        points,
        streak: newStreak,
        lastLoginDate: today,
        claimedMilestones: milestones,
      });

      updateHonorDisplay(points, newStreak);
    }
  );
}

function awardResetPoints() {
  chrome.storage.local.get(["points", "streak"], (result) => {
    const points = (result.points || 0) + POINTS_RESET;
    const streak = result.streak || 1;
    chrome.storage.local.set({ points });
    showToast(`+${POINTS_RESET} 重置奖励`);
    updateHonorDisplay(points, streak);
  });
}

// --- Timer & Settings ---

chrome.storage.local.get(["limitMinutes"], (result) => {
  if (result.limitMinutes) limitInput.value = result.limitMinutes;
});

limitInput.addEventListener("change", () => {
  const val = Math.max(1, Math.min(120, parseInt(limitInput.value) || 10));
  limitInput.value = val;
  limitDisplayEl.textContent = val + "m";
  chrome.storage.local.set({ limitMinutes: val });
});

resetBtn.addEventListener("click", () => {
  chrome.storage.local.set({
    totalMinutesToday: 0,
    todayDate: new Date().toDateString(),
  });
  todayTotalEl.textContent = "0m";
  awardResetPoints();
});

function updateDisplay() {
  chrome.storage.local.get(
    ["currentSeconds", "isTracking", "displayTotalMinutes", "limitMinutes", "todayDate"],
    (result) => {
      const limit = result.limitMinutes || 10;
      limitDisplayEl.textContent = limit + "m";

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

// Init
awardLoginPoints();
updateDisplay();
updateInterval = setInterval(updateDisplay, 1000);

window.addEventListener("unload", () => clearInterval(updateInterval));
