// x.com 页面内强制弹窗提醒

let overlayDismissed = false;

function createOverlay(minutes) {
  // 防止重复创建
  if (document.getElementById("x-time-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "x-time-overlay";
  overlay.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: x-overlay-in 0.3s ease-out;
    ">
      <div style="
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        border-radius: 24px;
        padding: 48px 56px;
        max-width: 480px;
        width: 90%;
        text-align: center;
        box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 120px rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(255,255,255,0.08);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position: relative;
        overflow: hidden;
      ">
        <!-- 脉冲背景光效 -->
        <div style="
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 50%);
          animation: x-pulse-bg 2s ease-in-out infinite;
          pointer-events: none;
        "></div>

        <div style="position: relative; z-index: 1;">
          <!-- 图标 -->
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            animation: x-pulse 1.5s ease-in-out infinite;
            box-shadow: 0 0 40px rgba(239,68,68,0.3);
          ">⏰</div>

          <!-- 标题 -->
          <h2 style="
            color: #f1f5f9;
            font-size: 28px;
            font-weight: 700;
            margin: 0 0 12px;
            letter-spacing: -0.5px;
          ">时间到了！</h2>

          <!-- 描述 -->
          <p style="
            color: #94a3b8;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 8px;
          ">你已经在 X.com 上浏览了</p>

          <!-- 时间数字 -->
          <div style="
            color: #ef4444;
            font-size: 48px;
            font-weight: 800;
            margin: 16px 0;
            text-shadow: 0 0 30px rgba(239,68,68,0.4);
            letter-spacing: -1px;
          ">${minutes} 分钟</div>

          <p style="
            color: #94a3b8;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 36px;
          ">该休息一下了！放下手机，活动活动身体 🧘</p>

          <!-- 关闭按钮 -->
          <button id="x-overlay-dismiss" style="
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            border: none;
            padding: 14px 48px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 15px rgba(239,68,68,0.3);
          " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(239,68,68,0.4)'"
             onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(239,68,68,0.3)'"
          >我知道了</button>
        </div>
      </div>
    </div>
  `;

  // 添加动画样式
  const style = document.createElement("style");
  style.textContent = `
    @keyframes x-overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes x-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
    @keyframes x-pulse-bg {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  `;
  overlay.appendChild(style);

  document.documentElement.appendChild(overlay);

  // 绑定关闭按钮
  const dismissBtn = document.getElementById("x-overlay-dismiss");
  dismissBtn.addEventListener("click", () => {
    overlay.remove();
    overlayDismissed = true;
    // 3分钟后允许再次提醒
    setTimeout(() => {
      overlayDismissed = false;
    }, 3 * 60 * 1000);
  });

  // 阻止页面滚动
  document.body.style.overflow = "hidden";
  const observer = new MutationObserver(() => {
    if (!document.getElementById("x-time-overlay")) {
      document.body.style.overflow = "";
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true });
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SHOW_TIME_ALERT") {
    if (!overlayDismissed) {
      createOverlay(message.minutes);
      sendResponse({ shown: true });
    } else {
      sendResponse({ shown: false });
    }
  }
  return true;
});
