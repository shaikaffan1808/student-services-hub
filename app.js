const appRoot = document.querySelector("#app");
const authOverlay = document.querySelector("#auth-overlay");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const loginMessage = document.querySelector("#login-message");
const signupMessage = document.querySelector("#signup-message");
const accountsKey = "student-hub.accounts";
const activeAccountKey = "student-hub.active-account";
let currentUser = null;

function getAccounts() {
  const rawAccounts = window.localStorage.getItem(accountsKey);
  if (!rawAccounts) return [];
  const accounts = JSON.parse(rawAccounts);
  if (!Array.isArray(accounts)) {
    throw new Error("Saved accounts could not be read. Clear this site's saved data and try again.");
  }
  return accounts;
}

function showAuthMessage(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function setAuthMode(mode) {
  const signingUp = mode === "signup";
  loginForm.hidden = signingUp;
  signupForm.hidden = !signingUp;
  loginMessage.hidden = true;
  signupMessage.hidden = true;
  document.querySelector("#auth-title").textContent = signingUp ? "Create your account" : "Welcome back";
  document.querySelector("#auth-description").textContent = signingUp
    ? "Create a local account to save your place on this device."
    : "Sign in to continue where you left off.";
  (signingUp ? document.querySelector("#signup-name") : document.querySelector("#login-email")).focus();
}

function activateAccount(account) {
  window.localStorage.setItem(activeAccountKey, account.id);
  currentUser = account;
  const firstName = account.name.trim().split(/\s+/)[0] || "Student";
  document.querySelector("#user-name").textContent = account.name;
  document.querySelector("#user-avatar").textContent = firstName[0].toUpperCase();
  document.querySelector("#welcome-name").textContent = firstName;
  authOverlay.hidden = true;
  appRoot.hidden = false;
  renderFeedback();
  renderPlanner();
}

function showSignedOut() {
  currentUser = null;
  window.localStorage.removeItem(activeAccountKey);
  appRoot.hidden = true;
  authOverlay.hidden = false;
  loginForm.reset();
  signupForm.reset();
  setAuthMode("login");
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password, salt) {
  if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
    throw new Error("Password sign-in needs a modern browser. Open this page in a current version of Chrome, Edge, Firefox, or Safari.");
  }
  const key = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(hash);
}

function randomSalt() {
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  return bytes;
}

for (const button of document.querySelectorAll("[data-auth-mode]")) {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.hidden = true;
  const submitButton = loginForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const email = document.querySelector("#login-email").value.trim().toLowerCase();
    const password = document.querySelector("#login-password").value;
    const account = getAccounts().find((saved) => saved.email === email);
    if (!account) {
      showAuthMessage(loginMessage, "We couldn't find that account on this device. Check the email or create a new account.");
      return;
    }
    const enteredHash = await hashPassword(password, Uint8Array.from(atob(account.salt), (char) => char.charCodeAt(0)));
    if (enteredHash !== account.passwordHash) {
      showAuthMessage(loginMessage, "That email and password don't match. Please try again.");
      return;
    }
    activateAccount(account);
  } catch (error) {
    showAuthMessage(loginMessage, `Could not sign in. ${error.message}`);
  } finally {
    submitButton.disabled = false;
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signupMessage.hidden = true;
  const submitButton = signupForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const name = document.querySelector("#signup-name").value.trim();
    const email = document.querySelector("#signup-email").value.trim().toLowerCase();
    const password = document.querySelector("#signup-password").value;
    const confirmation = document.querySelector("#signup-confirm").value;
    if (name.length < 2) {
      showAuthMessage(signupMessage, "Enter a name with at least 2 characters.");
      return;
    }
    if (password.length < 8) {
      showAuthMessage(signupMessage, "Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      showAuthMessage(signupMessage, "The passwords don't match.");
      return;
    }

    const accounts = getAccounts();
    if (accounts.some((account) => account.email === email)) {
      showAuthMessage(signupMessage, "An account with this email already exists on this device. Sign in instead.");
      return;
    }
    const salt = randomSalt();
    const account = {
      id: window.crypto.randomUUID(),
      name,
      email,
      salt: btoa(String.fromCharCode(...salt)),
      passwordHash: await hashPassword(password, salt),
    };
    accounts.push(account);
    window.localStorage.setItem(accountsKey, JSON.stringify(accounts));
    activateAccount(account);
  } catch (error) {
    showAuthMessage(signupMessage, `Could not create the account. ${error.message}`);
  } finally {
    submitButton.disabled = false;
  }
});

for (const button of document.querySelectorAll("[data-signout]")) {
  button.addEventListener("click", () => {
    try {
      showSignedOut();
    } catch (error) {
      showAuthMessage(loginMessage, `Could not sign out. ${error.message}`);
    }
  });
}

const pages = [...document.querySelectorAll("[data-page]")];
const navigationLinks = [...document.querySelectorAll("[data-nav]")];

function showPage() {
  const pageName = window.location.hash.slice(1) || "dashboard";
  const pageExists = pages.some((page) => page.dataset.page === pageName);
  const activePage = pageExists ? pageName : "dashboard";

  for (const page of pages) {
    page.hidden = page.dataset.page !== activePage;
  }

  for (const link of navigationLinks) {
    const active = link.dataset.nav === activePage;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  if (!pageExists && window.location.hash) {
    window.history.replaceState(null, "", "#dashboard");
  }
}

window.addEventListener("hashchange", showPage);
showPage();

const display = document.querySelector("#calc-display");
const expression = document.querySelector("#calc-expression");
const keypad = document.querySelector("#keypad");

let currentValue = "0";
let storedValue = null;
let pendingOperator = null;
let shouldReplace = false;

function formatNumber(value) {
  if (!Number.isFinite(value)) return "Not possible";
  if (Math.abs(value) >= 1e12 || (Math.abs(value) > 0 && Math.abs(value) < 1e-8)) {
    return value.toExponential(6).replace(/\.?0+e/, "e");
  }
  return String(Number(value.toPrecision(12)));
}

function updateDisplay() {
  display.textContent = currentValue;
  display.setAttribute("aria-label", `Calculator display: ${currentValue}`);
}

function clearCalculator() {
  currentValue = "0";
  storedValue = null;
  pendingOperator = null;
  shouldReplace = false;
  expression.textContent = "";
  updateDisplay();
}

function enterDigit(digit) {
  if (shouldReplace) {
    currentValue = digit === "." ? "0." : digit;
    shouldReplace = false;
  } else if (digit === ".") {
    if (!currentValue.includes(".")) currentValue += ".";
  } else {
    currentValue = currentValue === "0" ? digit : currentValue + digit;
  }
  updateDisplay();
}

function calculate(left, right, operator) {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  if (operator === "÷") return right === 0 ? Number.NaN : left / right;
  return right;
}

function chooseOperator(nextOperator) {
  const value = Number(currentValue);
  if (storedValue !== null && pendingOperator && !shouldReplace) {
    const result = calculate(storedValue, value, pendingOperator);
    currentValue = formatNumber(result);
    storedValue = Number(currentValue);
    expression.textContent = `${currentValue} ${nextOperator}`;
  } else {
    storedValue = value;
    expression.textContent = `${currentValue} ${nextOperator}`;
  }
  pendingOperator = nextOperator;
  shouldReplace = true;
  updateDisplay();
}

function activateKey(key) {
  if (/^\d$/.test(key) || key === ".") {
    enterDigit(key);
    return;
  }
  if (["+", "−", "×", "÷"].includes(key)) {
    chooseOperator(key);
    return;
  }
  if (key === "clear") {
    clearCalculator();
    return;
  }
  if (key === "sign") {
    currentValue = formatNumber(-Number(currentValue));
    updateDisplay();
    return;
  }
  if (key === "percent") {
    currentValue = formatNumber(Number(currentValue) / 100);
    shouldReplace = true;
    updateDisplay();
    return;
  }
  if (key === "backspace") {
    currentValue = currentValue.length > 1 ? currentValue.slice(0, -1) : "0";
    updateDisplay();
    return;
  }
  if (key === "equals" && storedValue !== null && pendingOperator) {
    const left = storedValue;
    const right = Number(currentValue);
    expression.textContent = `${formatNumber(left)} ${pendingOperator} ${currentValue} =`;
    currentValue = formatNumber(calculate(left, right, pendingOperator));
    storedValue = null;
    pendingOperator = null;
    shouldReplace = true;
    updateDisplay();
  }
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("[data-key]");
  if (button) activateKey(button.dataset.key);
});

document.querySelector(".clear-link").addEventListener("click", clearCalculator);

const scoreValue = document.querySelector("#score-value");
const scoreTotal = document.querySelector("#score-total");
const scoreResult = document.querySelector("#score-result");
const scoreError = document.querySelector("#score-error");
const marksForm = document.querySelector("#marks-form");

function updateScore() {
  scoreError.hidden = true;
  scoreResult.hidden = true;

  if (!scoreValue.value || !scoreTotal.value) return;
  const score = Number(scoreValue.value);
  const total = Number(scoreTotal.value);

  if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0) {
    scoreError.textContent = "Enter a score of zero or more and a total greater than zero.";
    scoreError.hidden = false;
    return;
  }
  if (score > total) {
    scoreError.textContent = "Your score cannot be greater than the total possible.";
    scoreError.hidden = false;
    return;
  }

  scoreResult.replaceChildren();
  scoreResult.append(`${((score / total) * 100).toFixed(2)}%`);
  const detail = document.createElement("small");
  detail.textContent = `${score} of ${total} marks`;
  scoreResult.append(detail);
  scoreResult.hidden = false;
}

scoreValue.addEventListener("input", updateScore);
scoreTotal.addEventListener("input", updateScore);
marksForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateScore();
});

const feedbackKey = "student-hub.feedback";
const feedbackForm = document.querySelector("#feedback-form");
const feedbackMessage = document.querySelector("#feedback-message");
const feedbackList = document.querySelector("#feedback-list");
const feedbackStatus = document.querySelector("#feedback-status");
const clearFeedbackButton = document.querySelector("#clear-feedback");
const ratingLabel = document.querySelector("#rating-label");
let selectedRating = 0;

const feedbackCategories = {
  learning: "Learning experience",
  platform: "Student Services Hub",
  support: "Student support",
  other: "Something else",
};

const plannerKey = "student-hub.planner";
const plannerForm = document.querySelector("#planner-form");
const taskTitle = document.querySelector("#task-title");
const taskDueDate = document.querySelector("#task-due-date");
const plannerList = document.querySelector("#planner-list");
const plannerProgress = document.querySelector("#planner-progress");
const plannerStatus = document.querySelector("#planner-status");

function readPlannerTasks() {
  if (!currentUser) return [];
  const saved = window.localStorage.getItem(`${plannerKey}.${currentUser.id}`);
  if (!saved) return [];
  const tasks = JSON.parse(saved);
  if (!Array.isArray(tasks)) throw new Error("Saved study tasks have an unexpected format.");
  return tasks;
}

function showPlannerStatus(message, type = "error") {
  plannerStatus.textContent = message;
  plannerStatus.className = `form-message is-${type}`;
  plannerStatus.hidden = false;
}

function renderPlanner() {
  try {
    const tasks = readPlannerTasks();
    const completedCount = tasks.filter((task) => task.completed).length;
    plannerProgress.textContent = tasks.length
      ? `${completedCount} of ${tasks.length} tasks completed`
      : "No tasks yet";
    plannerList.replaceChildren();
    plannerStatus.hidden = true;

    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "planner-empty";
      empty.textContent = "Add a study task to start your plan.";
      plannerList.append(empty);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tasks.sort((first, second) => {
      if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
      if (!first.dueDate) return second.dueDate ? 1 : 0;
      if (!second.dueDate) return -1;
      return first.dueDate.localeCompare(second.dueDate);
    });

    for (const task of tasks) {
      const item = document.createElement("article");
      item.className = "planner-task";
      if (task.completed) item.classList.add("is-complete");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(task.completed);
      checkbox.dataset.taskToggle = task.id;
      checkbox.setAttribute("aria-label", `Mark ${task.title} as ${task.completed ? "not done" : "done"}`);

      const details = document.createElement("div");
      details.className = "planner-task-copy";
      const title = document.createElement("strong");
      title.textContent = task.title;
      details.append(title);

      if (task.dueDate) {
        const due = document.createElement("span");
        due.className = "task-due";
        const dueDate = new Date(`${task.dueDate}T00:00:00`);
        due.textContent = `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(dueDate)}`;
        if (!task.completed && dueDate < today) due.classList.add("is-overdue");
        details.append(due);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "task-delete";
      remove.dataset.taskDelete = task.id;
      remove.setAttribute("aria-label", `Delete ${task.title}`);
      remove.textContent = "Remove";

      item.append(checkbox, details, remove);
      plannerList.append(item);
    }
  } catch (error) {
    plannerList.replaceChildren();
    plannerProgress.textContent = "Tasks are unavailable";
    showPlannerStatus(`Could not read saved study tasks. ${error.message}`);
  }
}

plannerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) {
    showPlannerStatus("Enter a study task before adding it.");
    taskTitle.focus();
    return;
  }

  try {
    const tasks = readPlannerTasks();
    tasks.push({
      id: window.crypto.randomUUID(),
      title,
      dueDate: taskDueDate.value,
      completed: false,
    });
    window.localStorage.setItem(`${plannerKey}.${currentUser.id}`, JSON.stringify(tasks));
    plannerForm.reset();
    renderPlanner();
    taskTitle.focus();
  } catch (error) {
    showPlannerStatus(`Could not save the study task. ${error.message}`);
  }
});

plannerList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-task-toggle]");
  if (!checkbox) return;

  try {
    const tasks = readPlannerTasks();
    const task = tasks.find((item) => item.id === checkbox.dataset.taskToggle);
    if (!task) throw new Error("The selected study task could not be found.");
    task.completed = checkbox.checked;
    window.localStorage.setItem(`${plannerKey}.${currentUser.id}`, JSON.stringify(tasks));
    renderPlanner();
  } catch (error) {
    showPlannerStatus(`Could not update the study task. ${error.message}`);
  }
});

plannerList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-task-delete]");
  if (!button) return;

  try {
    const tasks = readPlannerTasks();
    const remainingTasks = tasks.filter((task) => task.id !== button.dataset.taskDelete);
    if (remainingTasks.length === tasks.length) throw new Error("The selected study task could not be found.");
    window.localStorage.setItem(`${plannerKey}.${currentUser.id}`, JSON.stringify(remainingTasks));
    renderPlanner();
  } catch (error) {
    showPlannerStatus(`Could not remove the study task. ${error.message}`);
  }
});

function readFeedback() {
  if (!currentUser) return [];
  const saved = window.localStorage.getItem(`${feedbackKey}.${currentUser.id}`);
  if (!saved) return [];
  const items = JSON.parse(saved);
  if (!Array.isArray(items)) throw new Error("Saved feedback has an unexpected format.");
  return items;
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved feedback";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function makeEmptyState() {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✉";
  const title = document.createElement("h3");
  title.textContent = "Nothing shared just yet";
  const description = document.createElement("p");
  description.textContent = "When you save a note, you’ll find it here on this device.";
  empty.append(icon, title, description);
  return empty;
}

function renderFeedback() {
  try {
    const entries = readFeedback().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    feedbackList.replaceChildren();
    clearFeedbackButton.hidden = entries.length === 0;
    if (entries.length === 0) {
      feedbackList.append(makeEmptyState());
      return;
    }

    for (const item of entries) {
      const card = document.createElement("article");
      card.className = "feedback-entry";
      const top = document.createElement("div");
      top.className = "entry-top";
      const category = document.createElement("span");
      category.className = "entry-category";
      category.textContent = feedbackCategories[item.category] || "Feedback";
      const date = document.createElement("time");
      date.className = "entry-date";
      date.dateTime = item.createdAt;
      date.textContent = dateLabel(item.createdAt);
      top.append(category, date);

      const stars = document.createElement("div");
      stars.className = "entry-stars";
      stars.setAttribute("aria-label", `${item.rating} out of 5 stars`);
      stars.textContent = "★".repeat(item.rating) + "☆".repeat(5 - item.rating);
      const message = document.createElement("p");
      message.className = "entry-message";
      message.textContent = item.message;
      card.append(top, stars, message);
      feedbackList.append(card);
    }
  } catch (error) {
    feedbackList.replaceChildren();
    clearFeedbackButton.hidden = true;
    showFeedbackStatus(
      `Could not read saved feedback from this browser. ${error.message}`,
      "error",
    );
  }
}

function showFeedbackStatus(message, type) {
  feedbackStatus.textContent = message;
  feedbackStatus.className = `form-message is-${type}`;
  feedbackStatus.hidden = false;
}

feedbackMessage.addEventListener("input", () => {
  document.querySelector("#message-count").textContent = String(feedbackMessage.value.length);
  feedbackStatus.hidden = true;
});

document.querySelectorAll("[data-rating]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedRating = Number(button.dataset.rating);
    ratingLabel.textContent = `${selectedRating} of 5`;
    for (const star of document.querySelectorAll("[data-rating]")) {
      const isSelected = Number(star.dataset.rating) <= selectedRating;
      star.classList.toggle("is-selected", isSelected);
      star.setAttribute("aria-checked", String(Number(star.dataset.rating) === selectedRating));
    }
    feedbackStatus.hidden = true;
  });
});

feedbackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = feedbackMessage.value.trim();
  if (message.length < 10) {
    showFeedbackStatus("A little more detail would help. Add at least 10 characters.", "error");
    feedbackMessage.focus();
    return;
  }
  if (selectedRating < 1) {
    showFeedbackStatus("Choose a rating before saving.", "error");
    return;
  }

  try {
    const entries = readFeedback();
    entries.push({
      category: document.querySelector("#feedback-category").value,
      message,
      rating: selectedRating,
      createdAt: new Date().toISOString(),
    });
    window.localStorage.setItem(`${feedbackKey}.${currentUser.id}`, JSON.stringify(entries));
    feedbackForm.reset();
    selectedRating = 0;
    ratingLabel.textContent = "Choose a rating";
    document.querySelector("#message-count").textContent = "0";
    document.querySelectorAll("[data-rating]").forEach((star) => {
      star.classList.remove("is-selected");
      star.setAttribute("aria-checked", "false");
    });
    renderFeedback();
    showFeedbackStatus("Your note has been saved in this browser.", "success");
  } catch (error) {
    showFeedbackStatus(`Could not save your note in this browser. ${error.message}`, "error");
  }
});

clearFeedbackButton.addEventListener("click", () => {
  try {
    window.localStorage.removeItem(`${feedbackKey}.${currentUser.id}`);
    showFeedbackStatus("Saved feedback was cleared from this browser.", "success");
  } catch (error) {
    showFeedbackStatus(`Could not clear saved feedback. ${error.message}`, "error");
  }
});

try {
  const activeId = window.localStorage.getItem(activeAccountKey);
  if (activeId) {
    const savedAccount = getAccounts().find((account) => account.id === activeId);
    if (savedAccount) {
      activateAccount(savedAccount);
    } else {
      window.localStorage.removeItem(activeAccountKey);
    }
  }
} catch (error) {
  showAuthMessage(loginMessage, `Could not restore your account from this browser. ${error.message}`);
}

renderFeedback();
