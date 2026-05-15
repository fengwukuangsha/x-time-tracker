const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const successScreen = document.getElementById("successScreen");
const signInError = document.getElementById("signInError");
const signUpError = document.getElementById("signUpError");
const authSubtitle = document.getElementById("authSubtitle");

// Send API call through background service worker to bypass origin check
function clerkAPI(action, params) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "CLERK_API", action, params },
      (response) => {
        if (chrome.runtime.lastError) {
          reject({ errors: [{ message: chrome.runtime.lastError.message }] });
          return;
        }
        if (!response || !response.ok) {
          reject(response?.error || { errors: [{ message: "请求失败" }] });
          return;
        }
        resolve(response.data);
      }
    );
  });
}

// Toggle between sign in / sign up
document.getElementById("showSignUp").addEventListener("click", (e) => {
  e.preventDefault();
  signInForm.classList.add("hidden");
  signUpForm.classList.remove("hidden");
  authSubtitle.textContent = "创建账号开始追踪";
});

document.getElementById("showSignIn").addEventListener("click", (e) => {
  e.preventDefault();
  signUpForm.classList.add("hidden");
  signInForm.classList.remove("hidden");
  authSubtitle.textContent = "登录以同步你的数据";
});

// Sign In
signInForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signInError.textContent = "";
  const btn = document.getElementById("signInBtn");
  btn.disabled = true;
  btn.textContent = "登录中...";

  try {
    const email = document.getElementById("signInEmail").value;
    const password = document.getElementById("signInPassword").value;

    const data = await clerkAPI("signIn", { email, password });

    if (data.status === "complete") {
      await onAuthSuccess(data.user);
    } else {
      signInError.textContent = "登录需要额外验证，请稍后重试";
    }
  } catch (err) {
    const msg = err.errors?.[0]?.message || "登录失败，请检查邮箱和密码";
    signInError.textContent = msg;
  } finally {
    btn.disabled = false;
    btn.textContent = "登录";
  }
});

// Sign Up
signUpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signUpError.textContent = "";
  const btn = document.getElementById("signUpBtn");
  btn.disabled = true;
  btn.textContent = "注册中...";

  try {
    const name = document.getElementById("signUpName").value;
    const email = document.getElementById("signUpEmail").value;
    const password = document.getElementById("signUpPassword").value;

    const data = await clerkAPI("signUp", { name, email, password });

    if (data.status === "complete") {
      await onAuthSuccess(data.user);
    } else if (data.status === "needs_verification") {
      const code = prompt("请输入邮箱收到的验证码：");
      if (code) {
        const verifyData = await clerkAPI("verifyEmail", {
          signUpId: data.signUpId,
          code,
        });
        if (verifyData.status === "complete") {
          await onAuthSuccess(verifyData.user);
        } else {
          signUpError.textContent = "验证失败，请重试";
        }
      } else {
        signUpError.textContent = "需要邮箱验证才能完成注册";
      }
    } else {
      signUpError.textContent = "注册状态异常，请重试";
    }
  } catch (err) {
    const msg = err.errors?.[0]?.message || "注册失败，请重试";
    signUpError.textContent = msg;
  } finally {
    btn.disabled = false;
    btn.textContent = "注册";
  }
});

async function onAuthSuccess(userData) {
  await chrome.storage.local.set({ authUser: userData });
  chrome.runtime.sendMessage({ type: "AUTH_SUCCESS", user: userData });

  signInForm.classList.add("hidden");
  signUpForm.classList.add("hidden");
  successScreen.classList.remove("hidden");

  setTimeout(() => {
    window.close();
  }, 1500);
}
