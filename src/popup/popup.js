// === Auth State ===
const mainScreen = document.getElementById("mainScreen");
const btnGoSignIn = document.getElementById("btnGoSignIn");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userDropdown = document.getElementById("userDropdown");
const userInfoBlock = document.getElementById("userInfoBlock");
const btnLogout = document.getElementById("btnLogout");

function updateUserDisplay(user) {
  if (user) {
    const initials = (user.name || "U").charAt(0).toUpperCase();
    userAvatar.textContent = initials;
    userAvatar.style.background = "linear-gradient(135deg, #1d9bf0, #8b5cf6)";
    userName.textContent = user.name;
    userEmail.textContent = user.email;
    userInfoBlock.style.display = "";
    btnGoSignIn.style.display = "none";
    btnLogout.style.display = "";
  } else {
    userAvatar.textContent = "?";
    userAvatar.style.background = "#404040";
    userInfoBlock.style.display = "none";
    btnGoSignIn.style.display = "";
    btnLogout.style.display = "none";
  }
}

// Always show main screen, init UI immediately
chrome.storage.local.get(["authUser"], (result) => {
  updateUserDisplay(result.authUser || null);
  initMainUI();
});

// Listen for auth state changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.authUser) {
    updateUserDisplay(changes.authUser.newValue || null);
  }
});

// Open auth page
btnGoSignIn.addEventListener("click", () => {
  userDropdown.classList.add("hidden");
  chrome.runtime.openOptionsPage();
});

// User menu toggle
userAvatar.addEventListener("click", (e) => {
  e.stopPropagation();
  userDropdown.classList.toggle("hidden");
});

document.addEventListener("click", () => {
  userDropdown.classList.add("hidden");
});

// Logout
btnLogout.addEventListener("click", () => {
  chrome.storage.local.remove("authUser", () => {
    userDropdown.classList.add("hidden");
    updateUserDisplay(null);
    chrome.runtime.sendMessage({ type: "AUTH_LOGOUT" });
  });
});

// === Main UI (only initialized when logged in) ===
let mainUIInitialized = false;

function initMainUI() {
  if (mainUIInitialized) return;
  mainUIInitialized = true;

  const timerEl = document.getElementById("timer");
  const statusLabel = document.getElementById("statusLabel");
  const progressFill = document.getElementById("progressFill");
  const todayTotalEl = document.getElementById("todayTotal");
  const limitDisplayEl = document.getElementById("limitDisplay");
  const limitInput = document.getElementById("limitInput");
  const resetThresholdInput = document.getElementById("resetThresholdInput");
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

  // Reward popup elements
  const rewardOverlay = document.getElementById("rewardOverlay");
  const rewardChar = document.getElementById("rewardChar");
  const rewardTitle = document.getElementById("rewardTitle");
  const rewardStreak = document.getElementById("rewardStreak");
  const rewardBonus = document.getElementById("rewardBonus");

  // === PopMart-Style SVG Characters ===
  const SVG_NOVICE = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="58" r="32" fill="#d4d4d4"/>
    <circle cx="50" cy="42" r="26" fill="#e5e5e5"/>
    <circle cx="42" cy="40" r="5" fill="#404040"/>
    <circle cx="58" cy="40" r="5" fill="#404040"/>
    <circle cx="43.5" cy="38.5" r="2" fill="#fff"/>
    <circle cx="59.5" cy="38.5" r="2" fill="#fff"/>
    <ellipse cx="50" cy="48" rx="4" ry="2.5" fill="#a3a3a3"/>
    <circle cx="33" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <circle cx="67" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <path d="M30 68 Q50 78 70 68" stroke="#a3a3a3" fill="none" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  const SVG_DISCIPLINED = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="58" r="32" fill="#86efac"/>
    <circle cx="50" cy="42" r="26" fill="#bbf7d0"/>
    <circle cx="42" cy="40" r="5" fill="#166534"/>
    <circle cx="58" cy="40" r="5" fill="#166534"/>
    <circle cx="43.5" cy="38.5" r="2" fill="#fff"/>
    <circle cx="59.5" cy="38.5" r="2" fill="#fff"/>
    <path d="M44 48 Q50 53 56 48" stroke="#166534" fill="none" stroke-width="2" stroke-linecap="round"/>
    <circle cx="33" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <circle cx="67" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <rect x="30" y="28" width="40" height="5" rx="2.5" fill="#ef4444"/>
    <rect x="44" y="22" width="12" height="8" rx="3" fill="#ef4444"/>
    <circle cx="50" cy="24" r="3" fill="#fbbf24"/>
  </svg>`;

  const SVG_PERSISTENT = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="58" r="32" fill="#93c5fd"/>
    <circle cx="50" cy="42" r="26" fill="#bfdbfe"/>
    <circle cx="42" cy="40" r="5" fill="#1e3a5f"/>
    <circle cx="58" cy="40" r="5" fill="#1e3a5f"/>
    <circle cx="43.5" cy="38.5" r="2" fill="#fff"/>
    <circle cx="59.5" cy="38.5" r="2" fill="#fff"/>
    <path d="M44 49 L48 46 L52 50 L56 47" stroke="#1e3a5f" fill="none" stroke-width="2" stroke-linecap="round"/>
    <circle cx="33" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <circle cx="67" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <polygon points="50,18 53,26 47,26" fill="#fbbf24"/>
    <polygon points="50,18 53,26 47,26" fill="#fbbf24" transform="translate(6,-2) scale(0.6)"/>
    <circle cx="30" cy="62" r="6" fill="#60a5fa" opacity="0.5"/>
    <circle cx="70" cy="62" r="6" fill="#60a5fa" opacity="0.5"/>
  </svg>`;

  const SVG_GUARDIAN = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="58" r="32" fill="#c4b5fd"/>
    <circle cx="50" cy="42" r="26" fill="#ddd6fe"/>
    <circle cx="42" cy="40" r="5" fill="#3b0764"/>
    <circle cx="58" cy="40" r="5" fill="#3b0764"/>
    <circle cx="43.5" cy="38.5" r="2" fill="#fff"/>
    <circle cx="59.5" cy="38.5" r="2" fill="#fff"/>
    <ellipse cx="50" cy="48" rx="3" ry="2" fill="#3b0764"/>
    <circle cx="33" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <circle cx="67" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <ellipse cx="50" cy="22" rx="14" ry="10" fill="#7c3aed"/>
    <ellipse cx="50" cy="20" rx="10" ry="5" fill="#a78bfa"/>
    <circle cx="50" cy="18" r="3" fill="#fbbf24"/>
    <path d="M25 55 Q22 70 28 82 L50 78 L72 82 Q78 70 75 55" fill="#7c3aed" opacity="0.5"/>
    <rect x="46" y="66" width="8" height="10" rx="2" fill="#a78bfa"/>
  </svg>`;

  const SVG_TIMEMASTER = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="58" r="32" fill="#fde68a"/>
    <circle cx="50" cy="42" r="26" fill="#fef3c7"/>
    <circle cx="42" cy="38" r="3" fill="#78350f"/>
    <circle cx="42" cy="38" r="5.5" fill="none" stroke="#78350f" stroke-width="2"/>
    <line x1="42" y1="34" x2="42" y2="38" stroke="#78350f" stroke-width="1.5"/>
    <line x1="42" y1="38" x2="45" y2="36" stroke="#78350f" stroke-width="1.5"/>
    <circle cx="58" cy="38" r="3" fill="#78350f"/>
    <circle cx="58" cy="38" r="5.5" fill="none" stroke="#78350f" stroke-width="2"/>
    <line x1="58" y1="34" x2="58" y2="38" stroke="#78350f" stroke-width="1.5"/>
    <line x1="58" y1="38" x2="61" y2="36" stroke="#78350f" stroke-width="1.5"/>
    <path d="M44 48 Q50 53 56 48" stroke="#78350f" fill="none" stroke-width="2" stroke-linecap="round"/>
    <circle cx="33" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <circle cx="67" cy="44" r="4" fill="#f5a0b0" opacity="0.4"/>
    <path d="M36 24 Q50 8 64 24 L60 28 Q50 16 40 28 Z" fill="#f59e0b"/>
    <polygon points="50,10 52,16 48,16" fill="#fbbf24"/>
    <path d="M38 54 Q30 65 35 76" stroke="#fef3c7" fill="none" stroke-width="3" stroke-linecap="round"/>
    <path d="M62 54 Q70 65 65 76" stroke="#fef3c7" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`;

  const SVG_LEGEND = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="58" r="32" fill="#fca5a5"/>
    <circle cx="50" cy="42" r="26" fill="#fecaca"/>
    <circle cx="42" cy="40" r="5" fill="#7f1d1d"/>
    <circle cx="58" cy="40" r="5" fill="#7f1d1d"/>
    <circle cx="43.5" cy="38.5" r="2.5" fill="#fff"/>
    <circle cx="59.5" cy="38.5" r="2.5" fill="#fff"/>
    <path d="M44 48 Q50 55 56 48" stroke="#7f1d1d" fill="#fca5a5" stroke-width="2" stroke-linecap="round"/>
    <circle cx="33" cy="44" r="4" fill="#f5a0b0" opacity="0.6"/>
    <circle cx="67" cy="44" r="4" fill="#f5a0b0" opacity="0.6"/>
    <polygon points="38,22 42,12 46,20 50,8 54,20 58,12 62,22" fill="#fbbf24"/>
    <rect x="38" y="20" width="24" height="4" rx="2" fill="#f59e0b"/>
    <circle cx="44" cy="20" r="1.5" fill="#ef4444"/>
    <circle cx="50" cy="18" r="1.5" fill="#3b82f6"/>
    <circle cx="56" cy="20" r="1.5" fill="#22c55e"/>
    <circle cx="30" cy="62" r="5" fill="#fbbf24" opacity="0.4"/>
    <circle cx="70" cy="62" r="5" fill="#fbbf24" opacity="0.4"/>
    <circle cx="50" cy="72" r="2" fill="#fbbf24" opacity="0.5"/>
  </svg>`;

  // === Level System ===
  const LEVELS = [
    { name: "新手",    minPoints: 0,    color: "#737373", svg: SVG_NOVICE },
    { name: "自律者",  minPoints: 50,   color: "#22c55e", svg: SVG_DISCIPLINED },
    { name: "坚持者",  minPoints: 150,  color: "#3b82f6", svg: SVG_PERSISTENT },
    { name: "守护者",  minPoints: 350,  color: "#a855f7", svg: SVG_GUARDIAN },
    { name: "时光大师", minPoints: 700,  color: "#f59e0b", svg: SVG_TIMEMASTER },
    { name: "传奇",    minPoints: 1500, color: "#ef4444", svg: SVG_LEGEND },
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

  // === Leaderboard Simulated Users ===
  const SIMULATED_USERS = [
    { name: "传奇大佬",   points: 1680 },
    { name: "时光旅行者", points: 1100 },
    { name: "自律达人",   points: 820 },
    { name: "效率小王子", points: 640 },
    { name: "专注猫咪",   points: 460 },
    { name: "拖延克星",   points: 310 },
    { name: "时间管理师", points: 180 },
    { name: "勤奋小兔",   points: 95 },
    { name: "慢慢来同学", points: 35 },
    { name: "小萌新",     points: 8 },
  ];

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

    honorIcon.innerHTML = level.svg;
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

  // --- Reward Popup ---

  function showRewardPopup(streak, bonusTotal, points) {
    const level = getLevel(points);
    rewardChar.innerHTML = level.svg;
    rewardStreak.innerHTML = `🔥 ${streak} <span>天连续登录</span>`;

    if (bonusTotal > 0) {
      rewardBonus.textContent = `+${bonusTotal} 积分`;
      rewardBonus.classList.remove("hidden");
      rewardTitle.textContent = "连续登录奖励!";
    } else {
      rewardBonus.textContent = `+${POINTS_LOGIN} 积分`;
      rewardBonus.classList.remove("hidden");
      rewardTitle.textContent = "每日签到";
    }

    rewardOverlay.classList.add("show");

    const timer = setTimeout(() => {
      rewardOverlay.classList.remove("show");
    }, 3500);

    rewardOverlay.onclick = () => {
      clearTimeout(timer);
      rewardOverlay.classList.remove("show");
      rewardOverlay.onclick = null;
    };
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
          renderLeaderboard(points);
          return;
        }

        points += POINTS_LOGIN;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let newStreak;
        if (lastLogin === yesterday.toDateString()) {
          newStreak = (result.streak || 0) + 1;
        } else {
          newStreak = 1;
        }

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
        }

        chrome.storage.local.set({
          points,
          streak: newStreak,
          lastLoginDate: today,
          claimedMilestones: milestones,
        });

        updateHonorDisplay(points, newStreak);
        renderLeaderboard(points);

        showRewardPopup(newStreak, bonusTotal, points);
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
      renderLeaderboard(points);
    });
  }

  // --- Leaderboard ---

  const leaderboardToggle = document.getElementById("leaderboardToggle");
  const leaderboardPanel = document.getElementById("leaderboardPanel");
  const leaderboardList = document.getElementById("leaderboardList");
  const leaderboardArrow = document.getElementById("leaderboardArrow");

  leaderboardToggle.addEventListener("click", () => {
    const open = leaderboardPanel.style.display !== "none";
    leaderboardPanel.style.display = open ? "none" : "block";
    leaderboardArrow.innerHTML = open ? "&#9662;" : "&#9652;";
    if (!open) {
      chrome.storage.local.get(["points"], (result) => {
        renderLeaderboard(result.points || 0);
      });
    }
  });

  function renderLeaderboard(myPoints) {
    const users = SIMULATED_USERS.map((u) => ({ ...u, isMe: false }));
    users.push({ name: "我", points: myPoints, isMe: true });

    users.sort((a, b) => b.points - a.points);

    let html = "";
    users.forEach((u, i) => {
      const rank = i + 1;
      const level = getLevel(u.points);
      const rankClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
      const meClass = u.isMe ? " me" : "";

      html += `<div class="lb-row${meClass}">
        <span class="lb-rank ${rankClass}">${rank}</span>
        <span class="lb-avatar">${level.svg}</span>
        <span class="lb-name">${u.name}</span>
        <span class="lb-pts">${u.points}</span>
      </div>`;
    });
    leaderboardList.innerHTML = html;
  }

  // --- History ---

  const historyToggle = document.getElementById("historyToggle");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const historyArrow = document.getElementById("historyArrow");

  historyToggle.addEventListener("click", () => {
    const open = historyPanel.style.display !== "none";
    historyPanel.style.display = open ? "none" : "block";
    historyArrow.innerHTML = open ? "&#9662;" : "&#9652;";
    if (!open) loadHistory();
  });

  function formatDuration(seconds) {
    if (seconds < 60) return seconds + "秒";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return m + "分" + (s > 0 ? s + "秒" : "");
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return h + "时" + rm + "分";
  }

  function loadHistory() {
    chrome.storage.local.get(["sessionHistory"], (result) => {
      const history = result.sessionHistory || [];
      if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">暂无访问记录</div>';
        return;
      }

      const grouped = {};
      const dateOrder = [];
      for (let i = history.length - 1; i >= 0; i--) {
        const s = history[i];
        const date = new Date(s.start).toLocaleDateString("zh-CN", {
          month: "numeric", day: "numeric", weekday: "short"
        });
        if (!grouped[date]) {
          grouped[date] = [];
          dateOrder.push(date);
        }
        grouped[date].push(s);
      }

      let html = "";
      for (const date of dateOrder) {
        const sessions = grouped[date];
        const dayTotal = sessions.reduce((sum, s) => sum + s.duration, 0);
        html += `<div class="history-date"><span>${date}</span><span class="history-day-total">${formatDuration(dayTotal)}</span></div>`;
        for (const s of sessions.slice().reverse()) {
          const st = new Date(s.start);
          const ed = new Date(s.end);
          const stStr = String(st.getHours()).padStart(2, "0") + ":" + String(st.getMinutes()).padStart(2, "0");
          const edStr = String(ed.getHours()).padStart(2, "0") + ":" + String(ed.getMinutes()).padStart(2, "0");
          html += `<div class="history-item">
            <span class="history-time">${stStr} - ${edStr}</span>
            <span class="history-dur">${formatDuration(s.duration)}</span>
          </div>`;
        }
      }
      historyList.innerHTML = html;
    });
  }

  // --- Timer & Settings ---

  chrome.storage.local.get(["limitMinutes", "resetThresholdMinutes"], (result) => {
    if (result.limitMinutes) limitInput.value = result.limitMinutes;
    if (result.resetThresholdMinutes) resetThresholdInput.value = result.resetThresholdMinutes;
  });

  limitInput.addEventListener("change", () => {
    const val = Math.max(1, Math.min(120, parseInt(limitInput.value) || 10));
    limitInput.value = val;
    limitDisplayEl.textContent = val + "m";
    chrome.storage.local.set({ limitMinutes: val });
  });

  resetThresholdInput.addEventListener("change", () => {
    const val = Math.max(1, Math.min(30, parseInt(resetThresholdInput.value) || 3));
    resetThresholdInput.value = val;
    chrome.storage.local.set({ resetThresholdMinutes: val });
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
          statusLabel.textContent = "当前没有在计时";
          statusLabel.className = "status-label";
          progressFill.style.width = "0%";
        }
      }
    );
  }

  // Init main UI
  awardLoginPoints();
  updateDisplay();
  updateInterval = setInterval(updateDisplay, 1000);

  window.addEventListener("unload", () => clearInterval(updateInterval));
}
