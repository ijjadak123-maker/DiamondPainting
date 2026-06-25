const configuredApi = document.querySelector('meta[name="prism-patch-api"]')?.content || "";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const isLocalWebPreview = isLocalHost && ["http:", "https:"].includes(window.location.protocol) && !window.Capacitor;
const apiBase = isLocalWebPreview ? "/api" : configuredApi;
const localTokenPrefix = "local:";
const localAccountsKey = "prismPatchLocalAccounts";

const fallbackState = {
  user: {
    displayName: "Maya Spark",
    dateOfBirth: "",
    gender: "",
    location: "",
    shareLocation: false,
    connectionRange: "local",
    publicProfile: true,
    reminders: true,
    allowMessages: true,
  },
  projects: [
    { id: "p1", title: "Ocean turtle glow", notes: "Square drills · 45 colors · AB highlights", source: "Prism Crafts Studio", startedAt: "2026-05-04", details: "Working the turtle shell first, then saving the blue water for evening sessions.", progress: 68, completedSections: 8, totalSections: 12, image: "assets/ocean-turtle.svg" },
    { id: "p2", title: "Sunset cottage gift", notes: "Round drills · due Aug 12 · framed", source: "Etsy kit shop", startedAt: "2026-06-01", details: "Gift for the hallway. Check frame depth before sealing.", progress: 34, completedSections: 4, totalSections: 12, image: "assets/sunset-cottage.svg" },
    { id: "p3", title: "Rainbow florals", notes: "Custom canvas · color cleanup needed", source: "Custom photo kit", startedAt: "", details: "Use leftover AB drills in the flower centers.", progress: 12, completedSections: 1, totalSections: 10, image: "assets/rainbow-florals.svg" },
  ],
  ideas: [
    { id: "i1", title: "Pet portrait with crystal collar", tag: "Custom gift", details: "Use a close-up photo and add AB drills around the collar so it catches light." },
    { id: "i2", title: "Holiday ornament leftover set", tag: "Use leftovers", details: "Small wooden shapes, sealed leftovers, ribbon backs, and gift tags." },
    { id: "i3", title: "Quiet lake for weekend sessions", tag: "Calm project", details: "Look for a square-drill kit with soft blues and a low confetti sky." },
  ],
  inventory: [
    { id: "inv1", type: "notStarted", label: "Unopened kits", quantity: 3, note: "Floral, cottage, and custom portrait are still boxed." },
    { id: "inv2", type: "wax", label: "Pink wax squares", quantity: 6, note: "Two in the travel case, four in the drawer." },
    { id: "inv3", type: "tray", label: "Sorting trays", quantity: 5, note: "Large white tray is best for AB drills." },
    { id: "inv4", type: "drillCode", label: "DMC 310", quantity: 1, note: "Extra black drills from the turtle kit." },
  ],
  gallery: [
    { id: "g1", userId: "maker_florida", owner: "Lena", title: "Ocean Turtle Glow", meta: "Florida · local", notes: "Finished with blue AB drills and a glossy sealer.", image: "assets/ocean-turtle.svg", progress: 100, source: "Diamond Art Club", timeSpent: "38 hours across 5 weeks", startedAt: "2026-04-18", details: "Used square drills, sealed lightly, and framed with a white mat.", chatEnabled: true },
    { id: "g2", userId: "maker_colorado", owner: "Priya", title: "Sunset Cottage", meta: "Colorado · between states", notes: "Gift plan with frame notes and warm color substitutions.", image: "assets/sunset-cottage.svg", progress: 76, source: "Etsy custom kit", timeSpent: "21 hours so far", startedAt: "2026-05-22", details: "Swapped three oranges for softer peach tones to match the recipient's room.", chatEnabled: true },
    { id: "g3", userId: "maker_texas", owner: "Nora", title: "Rainbow Florals", meta: "Texas · local", notes: "Shared as a spring challenge with leftover drills.", image: "assets/rainbow-florals.svg", progress: 54, source: "Craft store kit", timeSpent: "14 hours", startedAt: "2026-06-05", details: "Working color by color and saving white background sections for last.", chatEnabled: false },
    { id: "g4", userId: "maker_canada", owner: "Maya", title: "Cosmic Owl", meta: "Canada · international", notes: "International inspiration from a maker group.", image: "assets/cosmic-owl.svg", progress: 92, source: "AliExpress kit", timeSpent: "33 hours", startedAt: "2026-03-29", details: "Added extra AB stars and used release paper to split the canvas into 16 sections.", chatEnabled: true },
  ],
};

const rangeCopy = {
  local: {
    title: "Local circles",
    copy: "Find nearby members for craft nights, framing help, supply swaps, and progress reveals.",
  },
  states: {
    title: "Between-state swaps",
    copy: "Connect across states for kit trades, drill matching, group challenges, and regional inspiration.",
  },
  world: {
    title: "International inspiration",
    copy: "Meet makers around the world while keeping your privacy, gallery, and swap settings under control.",
  },
};

const state = {
  token: localStorage.getItem("prismPatchToken"),
  data: structuredClone(fallbackState),
};

const loginScreen = document.querySelector('[data-screen="login"]');
const onboardingScreen = document.querySelector('[data-screen="onboarding"]');
const appScreen = document.querySelector('[data-screen="app"]');
const toast = document.querySelector(".toast");
const authForm = document.querySelector("[data-auth-form]");
const authSubmit = document.querySelector("[data-auth-submit]");
const authEyebrow = document.querySelector("[data-auth-eyebrow]");
const authCopy = document.querySelector("[data-auth-copy]");
const onboardingForm = document.querySelector("[data-onboarding-form]");
const settingsForm = document.querySelector("[data-settings-form]");
const projectForm = document.querySelector("[data-project-form]");
const ideaForm = document.querySelector("[data-idea-form]");
const inventoryForm = document.querySelector("[data-inventory-form]");
const projectSubmit = document.querySelector("[data-project-submit]");
const ideaSubmit = document.querySelector("[data-idea-submit]");

let toastTimer;
let authMode = "login";

function createEmptyData(user) {
  return {
    user,
    projects: [],
    ideas: [],
    inventory: [],
    gallery: structuredClone(fallbackState.gallery),
  };
}

function normalizeData(data) {
  const normalized = structuredClone(data || fallbackState);
  normalized.user = {
    ...fallbackState.user,
    ...(normalized.user || {}),
  };
  normalized.projects = (normalized.projects || []).map((project) => ({
    source: "",
    startedAt: "",
    details: "",
    ...project,
  }));
  normalized.ideas = (normalized.ideas || []).map((idea) => ({
    details: "",
    ...idea,
  }));
  normalized.inventory = (normalized.inventory || []).map((item) => ({
    type: item.type || (item.code ? "drillCode" : "note"),
    label: item.label || item.code || "Inventory note",
    quantity: Number(item.quantity) || 0,
    note: item.note || "",
    ...item,
  }));
  normalized.gallery = (normalized.gallery || fallbackState.gallery).map((post) => ({
    owner: "Community maker",
    progress: 0,
    source: "Not shared",
    timeSpent: "Not shared",
    startedAt: "",
    details: "",
    chatEnabled: false,
    ...post,
  }));
  return normalized;
}

function localAccountId(email) {
  return `local_${String(email || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function getLocalAccounts() {
  try {
    return JSON.parse(localStorage.getItem(localAccountsKey) || "{}");
  } catch (error) {
    return {};
  }
}

function saveLocalAccounts(accounts) {
  localStorage.setItem(localAccountsKey, JSON.stringify(accounts));
}

function getCurrentLocalId() {
  return state.token?.startsWith(localTokenPrefix) ? state.token.slice(localTokenPrefix.length) : "";
}

function isLocalSession() {
  return Boolean(getCurrentLocalId());
}

function localDataKey(id = getCurrentLocalId()) {
  return `prismPatchLocalData:${id}`;
}

function loadLocalData(id = getCurrentLocalId()) {
  try {
    const saved = JSON.parse(localStorage.getItem(localDataKey(id)) || "null");
    return saved ? normalizeData(saved) : null;
  } catch (error) {
    return null;
  }
}

function saveLocalData() {
  if (!isLocalSession()) return;
  localStorage.setItem(localDataKey(), JSON.stringify(state.data));
}

async function hashLocalPassword(password) {
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(String(password));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(String(password))));
}

function isNetworkAuthError(error) {
  const message = String(error?.message || "");
  return message.includes("Failed to fetch") || message.includes("Backend unavailable");
}

async function createLocalAccount(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const accounts = getLocalAccounts();
  const id = localAccountId(email);

  if (!email) {
    showToast("Enter an email address.");
    return false;
  }

  if (accounts[id]) {
    showToast("That email is already saved on this device.");
    return false;
  }

  const user = {
    id,
    email,
    displayName: String(formData.get("displayName") || "New maker").trim() || "New maker",
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    location: "",
    shareLocation: false,
    connectionRange: "local",
    publicProfile: true,
    reminders: true,
  };

  accounts[id] = {
    id,
    email,
    passwordHash: await hashLocalPassword(password),
    createdAt: new Date().toISOString(),
  };
  saveLocalAccounts(accounts);

  state.token = `${localTokenPrefix}${id}`;
  state.data = normalizeData(createEmptyData(user));
  localStorage.setItem("prismPatchToken", state.token);
  saveLocalData();
  renderAll();
  showApp();
  showToast("Account created on this device.");
  return true;
}

async function signInLocal(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const accounts = getLocalAccounts();
  const account = Object.values(accounts).find((candidate) => candidate.email === normalizedEmail);
  if (!account || account.passwordHash !== (await hashLocalPassword(password))) {
    return false;
  }

  state.token = `${localTokenPrefix}${account.id}`;
  localStorage.setItem("prismPatchToken", state.token);
  const saved = loadLocalData(account.id);
  if (!saved) {
    return false;
  }
  state.data = normalizeData(saved);
  renderAll();
  routeAfterProfileCheck();
  return true;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

async function request(path, options = {}) {
  if (!apiBase) {
    throw new Error("Backend unavailable from file preview");
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

async function signIn(email, password) {
  if (await signInLocal(email, password)) {
    return;
  }

  try {
    const payload = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.token = payload.token;
    localStorage.setItem("prismPatchToken", payload.token);
    await loadAppData();
    routeAfterProfileCheck();
  } catch (error) {
    if (apiBase && email !== "demo@prismpatch.app" && !isNetworkAuthError(error)) {
      showToast(getAuthErrorMessage(error));
      return;
    }
    if (apiBase && email === "demo@prismpatch.app") {
      showToast("Demo server unavailable. Opening local demo mode.");
    }
    state.data = normalizeData(fallbackState);
    state.data.user.dateOfBirth = "1990-01-01";
    state.data.user.gender = "prefer-not-to-say";
    state.token = `${localTokenPrefix}demo`;
    localStorage.setItem("prismPatchToken", state.token);
    saveLocalData();
    routeAfterProfileCheck();
  }
}

function startBuiltInDemo() {
  state.token = `${localTokenPrefix}demo`;
  state.data = normalizeData(fallbackState);
  state.data.user.dateOfBirth = "1990-01-01";
  state.data.user.gender = "prefer-not-to-say";
  localStorage.setItem("prismPatchToken", state.token);
  saveLocalData();
  renderAll();
  showApp();
  setView("home");
  showToast("Built-in demo loaded.");
}

async function createAccount(formData) {
  const password = String(formData.get("password") || "");
  const dateOfBirth = formData.get("dateOfBirth");
  const gender = formData.get("gender");

  if (password.length < 8) {
    showToast("Use at least 8 characters for your password.");
    return;
  }

  if (!dateOfBirth || !gender) {
    showToast("Date of birth and gender are required for first-time setup.");
    return;
  }

  try {
    const payload = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: formData.get("displayName"),
        email: formData.get("email"),
        password,
        dateOfBirth,
        gender,
      }),
    });
    state.token = payload.token;
    localStorage.setItem("prismPatchToken", payload.token);
    await loadAppData();
    showApp();
    showToast("Account created. Your studio is ready.");
  } catch (error) {
    if (isNetworkAuthError(error) && (await createLocalAccount(formData))) {
      return;
    }
    showToast(getAuthErrorMessage(error));
  }
}

function getAuthErrorMessage(error) {
  if (String(error.message || "").includes("Failed to fetch")) {
    return "Cannot reach the Prism Patch server. Check the backend URL or internet connection.";
  }
  return error.message || "Sign-in failed.";
}

async function loadAppData() {
  if (isLocalSession()) {
    state.data = loadLocalData() || normalizeData(fallbackState);
    renderAll();
    return;
  }

  try {
    state.data = normalizeData(await request("/app"));
  } catch (error) {
    state.data = normalizeData(fallbackState);
  }
  renderAll();
}

function routeAfterProfileCheck() {
  if (needsOnboarding()) {
    showOnboarding();
    showToast("Finish your first-time setup.");
    return;
  }
  showApp();
  showToast("Signed in. Your studio is ready.");
}

function needsOnboarding() {
  return !state.data.user.dateOfBirth || !state.data.user.gender;
}

function showApp() {
  loginScreen.classList.add("hidden");
  onboardingScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

function showOnboarding() {
  loginScreen.classList.add("hidden");
  appScreen.classList.add("hidden");
  onboardingScreen.classList.remove("hidden");
  onboardingForm.dateOfBirth.value = state.data.user.dateOfBirth || "";
  onboardingForm.gender.value = state.data.user.gender || "";
  onboardingForm.shareLocation.checked = Boolean(state.data.user.shareLocation);
  onboardingForm.location.value = state.data.user.location || "";
  syncLocationFields();
}

function showLogin() {
  appScreen.classList.add("hidden");
  onboardingScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegistering = mode === "register";
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const active = button.dataset.authMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-register-only]").forEach((field) => {
    field.classList.toggle("hidden", !isRegistering);
    field.querySelectorAll("input, select").forEach((input) => {
      input.required = isRegistering;
    });
  });
  authSubmit.textContent = isRegistering ? "Create account" : "Sign in";
  authEyebrow.textContent = isRegistering ? "First-time setup" : "Welcome back";
  authCopy.textContent = isRegistering
    ? "Create your studio profile with date of birth and gender. Location sharing stays optional in settings."
    : "Sign in to track projects, save supplies, manage privacy, and connect with diamond painting friends.";
  authForm.password.autocomplete = isRegistering ? "new-password" : "current-password";
}

function setView(view) {
  document.querySelectorAll(".app-view").forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.view === view);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.nav === view);
  });
  document.querySelector('[data-nav="home"]')?.classList.toggle("active", view === "home");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setRange(range) {
  state.data.user.connectionRange = range;
  document.querySelectorAll(".segment").forEach((segment) => {
    const active = segment.dataset.range === range;
    segment.classList.toggle("active", active);
    segment.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".range-summary").forEach((summary) => {
    summary.dataset.activeRange = range;
  });
  document.querySelectorAll("[data-range-heading]").forEach((heading) => {
    heading.textContent = rangeCopy[range].title;
  });
  document.querySelectorAll("[data-range-copy]").forEach((copy) => {
    copy.textContent = rangeCopy[range].copy;
  });
  if (settingsForm) settingsForm.connectionRange.value = range;
}

function renderAll() {
  renderProfile();
  renderHomeProjects();
  renderHomeIdeas();
  renderStats();
  renderProjects();
  renderIdeas();
  renderInventory();
  renderGallery();
  setRange(state.data.user.connectionRange || "local");
}

function renderProfile() {
  const locationText = state.data.user.shareLocation && state.data.user.location ? state.data.user.location : "Location sharing off";
  const userLocation = document.querySelector("[data-user-location]");
  if (userLocation) userLocation.textContent = locationText;
  settingsForm.displayName.value = state.data.user.displayName || "";
  settingsForm.dateOfBirth.value = state.data.user.dateOfBirth || "";
  settingsForm.gender.value = state.data.user.gender || "";
  settingsForm.location.value = state.data.user.location || "";
  settingsForm.shareLocation.checked = Boolean(state.data.user.shareLocation);
  settingsForm.connectionRange.value = state.data.user.connectionRange || "local";
  settingsForm.publicProfile.checked = Boolean(state.data.user.publicProfile);
  settingsForm.reminders.checked = Boolean(state.data.user.reminders);
  settingsForm.allowMessages.checked = Boolean(state.data.user.allowMessages);
  syncLocationFields();
}

function renderHomeProjects() {
  const projects = [...state.data.projects].sort((a, b) => getProgress(b) - getProgress(a));
  const current = projects.find((project) => getProgress(project) < 100) || projects[0];
  const nextProjects = projects.filter((project) => project.id !== current?.id).slice(0, 3);
  const currentContainer = document.querySelector("[data-current-project]");
  const nextContainer = document.querySelector("[data-next-projects]");

  if (!current) {
    currentContainer.innerHTML = '<p class="empty-state">No current project yet. Add a canvas from Projects.</p>';
    nextContainer.innerHTML = '<p class="empty-state">Your future projects will appear here.</p>';
    return;
  }

  currentContainer.innerHTML = projectCardMarkup(current, "featured");
  nextContainer.innerHTML = nextProjects.length
    ? nextProjects.map((project) => projectCardMarkup(project, "compact")).join("")
    : '<p class="empty-state">No queued projects yet. Save ideas or add another canvas.</p>';
}

function renderHomeIdeas() {
  const list = document.querySelector("[data-home-ideas]");
  const ideas = state.data.ideas.slice(0, 3);
  list.innerHTML = ideas.length
    ? ideas.map((idea) => ideaCardMarkup(idea, "compact")).join("")
    : '<p class="empty-state">Saved ideas will appear here.</p>';
}

function renderStats() {
  document.querySelectorAll('[data-stat="projects"]').forEach((item) => (item.textContent = state.data.projects.length));
  document.querySelectorAll('[data-stat="ideas"]').forEach((item) => (item.textContent = state.data.ideas.length));
  document.querySelectorAll('[data-stat="inventory"]').forEach((item) => (item.textContent = state.data.inventory.length));
}

function renderProjects() {
  const list = document.querySelector("[data-project-list]");
  if (!state.data.projects.length) {
    list.innerHTML = '<p class="empty-state">No projects yet. Add your first kit or custom canvas.</p>';
    return;
  }
  list.innerHTML = state.data.projects.map((project) => projectCardMarkup(project, "list")).join("");
}

function projectCardMarkup(project, variant) {
  const progress = getProgress(project);
  const sectionText = getSectionText(project);
  const source = project.source ? `Bought from ${escapeHtml(project.source)}` : "Source not saved";
  return `
    <article class="list-card ${variant === "featured" ? "featured-project" : ""} ${variant === "compact" ? "compact-project" : ""}">
      <img src="${project.image || "assets/rainbow-florals.svg"}" alt="${escapeHtml(project.title)} preview" />
      <div>
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.notes)}</p>
        <small class="progress-note">${source}</small>
        <div class="progress-line">
          <progress value="${progress}" max="100"></progress>
          <span>${progress}%</span>
        </div>
        <small class="progress-note">${sectionText}</small>
        ${variant === "list" ? `<div class="card-actions"><button type="button" data-edit-project="${escapeHtml(project.id)}">Edit</button><button type="button" data-delete-project="${escapeHtml(project.id)}">Delete</button></div>` : ""}
      </div>
    </article>
  `;
}

function getProgress(project) {
  const completed = Number(project.completedSections);
  const total = Number(project.totalSections);
  if (completed >= 0 && total > 0) {
    return Math.min(Math.round((completed / total) * 100), 100);
  }
  return clamp(Number(project.progress) || 0, 0, 100);
}

function getSectionText(project) {
  const completed = Number(project.completedSections);
  const total = Number(project.totalSections);
  if (completed >= 0 && total > 0) {
    return `${completed} of ${total} sections completed`;
  }
  return "Tracked by progress percent";
}

function renderIdeas() {
  const list = document.querySelector("[data-idea-list]");
  list.innerHTML = state.data.ideas.map((idea) => ideaCardMarkup(idea, "list")).join("");
}

function ideaCardMarkup(idea, variant) {
  return `
    <article class="idea-card ${variant === "compact" ? "compact-idea" : ""}">
      <h3>${escapeHtml(idea.title)}</h3>
      <p class="card-copy">${escapeHtml(idea.details || "Saved for a future canvas, challenge, gift, or leftover-drill craft.")}</p>
      <span class="tag">${escapeHtml(idea.tag)}</span>
      <div class="card-actions">
        <button type="button" data-view-idea="${escapeHtml(idea.id)}">Details</button>
        ${variant === "list" ? `<button type="button" data-edit-idea="${escapeHtml(idea.id)}">Edit</button><button type="button" data-delete-idea="${escapeHtml(idea.id)}">Delete</button>` : ""}
      </div>
    </article>
  `;
}

function renderInventory() {
  const list = document.querySelector("[data-inventory-list]");
  const typeLabels = {
    notStarted: "Not started",
    wax: "Waxes",
    magnet: "Magnets",
    tray: "Trays",
    pen: "Pens",
    sealer: "Sealer",
    drillCode: "Drill code",
    note: "Remember",
  };
  list.innerHTML = state.data.inventory
    .map((item) => `
      <article class="inventory-card">
        <span class="inventory-type">${typeLabels[item.type] || "Inventory"}</span>
        <h3>${escapeHtml(item.label)}</h3>
        <p>${Number(item.quantity) || 0} saved</p>
        ${item.note ? `<small class="progress-note">${escapeHtml(item.note)}</small>` : ""}
        <div class="card-actions"><button type="button" data-delete-inventory="${escapeHtml(item.id)}">Remove</button></div>
      </article>
    `)
    .join("");
}

function renderGallery() {
  const list = document.querySelector("[data-gallery-list]");
  list.innerHTML = state.data.gallery
    .map(
      (post) => `
        <article class="gallery-post">
          <img src="${post.image}" alt="${escapeHtml(post.title)} diamond painting" />
          <div>
            <span class="gallery-meta">${escapeHtml(post.meta)}</span>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.notes)}</p>
            <div class="progress-line">
              <progress value="${Number(post.progress) || 0}" max="100"></progress>
              <span>${Number(post.progress) || 0}%</span>
            </div>
            <div class="post-actions">
              <button type="button" data-view-post="${escapeHtml(post.id)}">Details</button>
              ${post.chatEnabled ? `<button type="button" data-chat-user="${escapeHtml(post.userId || "community")}">Chat</button>` : ""}
              <button type="button" data-report-post="${escapeHtml(post.id)}">Report</button>
              <button type="button" data-block-user="${escapeHtml(post.userId || "community")}">Block</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function syncLocationFields() {
  const onboardingShare = onboardingForm.shareLocation?.checked;
  onboardingForm.location.disabled = !onboardingShare;
  onboardingForm.querySelector("[data-location-field]").classList.toggle("muted-field", !onboardingShare);

  const settingsShare = settingsForm.shareLocation?.checked;
  settingsForm.location.disabled = !settingsShare;
  settingsForm.querySelector("[data-settings-location-field]").classList.toggle("muted-field", !settingsShare);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[character];
  });
}

async function saveSettings(formData) {
  const shareLocation = formData.get("shareLocation") === "on";
  const settings = {
    displayName: formData.get("displayName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    location: shareLocation ? formData.get("location") : "",
    shareLocation,
    connectionRange: formData.get("connectionRange"),
    publicProfile: formData.get("publicProfile") === "on",
    reminders: formData.get("reminders") === "on",
    allowMessages: formData.get("allowMessages") === "on",
  };
  state.data.user = { ...state.data.user, ...settings };
  renderAll();
  saveLocalData();
  try {
    await request("/settings", { method: "PUT", body: JSON.stringify(settings) });
  } catch (error) {
    localStorage.setItem("prismPatchSettings", JSON.stringify(settings));
  }
  showToast("Settings saved.");
}

async function saveOnboarding(formData) {
  const shareLocation = formData.get("shareLocation") === "on";
  const settings = {
    displayName: state.data.user.displayName || "New maker",
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    location: shareLocation ? formData.get("location") : "",
    shareLocation,
    connectionRange: state.data.user.connectionRange || "local",
    publicProfile: Boolean(state.data.user.publicProfile),
    reminders: Boolean(state.data.user.reminders),
    allowMessages: Boolean(state.data.user.allowMessages),
  };
  state.data.user = { ...state.data.user, ...settings };
  renderAll();
  saveLocalData();
  try {
    await request("/settings", { method: "PUT", body: JSON.stringify(settings) });
  } catch (error) {
    localStorage.setItem("prismPatchSettings", JSON.stringify(settings));
  }
  showApp();
  showToast("Profile setup saved.");
}

async function saveProject(formData) {
  const id = formData.get("id");
  const completedSections = Number(formData.get("completedSections"));
  const totalSections = Number(formData.get("totalSections"));
  const hasSectionProgress = completedSections >= 0 && totalSections > 0;
  const project = {
    title: formData.get("title"),
    notes: formData.get("notes"),
    source: formData.get("source"),
    startedAt: formData.get("startedAt"),
    details: formData.get("details"),
    progress: hasSectionProgress ? Math.min(Math.round((completedSections / totalSections) * 100), 100) : Number(formData.get("progress")) || 0,
    completedSections: hasSectionProgress ? completedSections : null,
    totalSections: hasSectionProgress ? totalSections : null,
    image: "assets/rainbow-florals.svg",
  };
  if (id) {
    try {
      const saved = await request(`/projects/${id}`, { method: "PUT", body: JSON.stringify(project) });
      state.data.projects = state.data.projects.map((item) => (item.id === id ? saved : item));
    } catch (error) {
      state.data.projects = state.data.projects.map((item) => (item.id === id ? { ...item, ...project } : item));
    }
    showToast("Project updated.");
  } else {
  try {
    const saved = await request("/projects", { method: "POST", body: JSON.stringify(project) });
    state.data.projects.unshift(saved);
  } catch (error) {
    state.data.projects.unshift({ ...project, id: crypto.randomUUID() });
  }
    showToast("Project saved.");
  }
  saveLocalData();
  resetProjectForm();
  renderAll();
}

async function saveIdea(formData) {
  const id = formData.get("id");
  const idea = {
    title: formData.get("title"),
    tag: formData.get("tag"),
    details: formData.get("details"),
  };
  if (id) {
    try {
      const saved = await request(`/ideas/${id}`, { method: "PUT", body: JSON.stringify(idea) });
      state.data.ideas = state.data.ideas.map((item) => (item.id === id ? saved : item));
    } catch (error) {
      state.data.ideas = state.data.ideas.map((item) => (item.id === id ? { ...item, ...idea } : item));
    }
    showToast("Idea updated.");
  } else {
  try {
    const saved = await request("/ideas", { method: "POST", body: JSON.stringify(idea) });
    state.data.ideas.unshift(saved);
  } catch (error) {
    state.data.ideas.unshift({ ...idea, id: crypto.randomUUID() });
  }
    showToast("Idea saved.");
  }
  saveLocalData();
  resetIdeaForm();
  renderAll();
}

async function saveInventory(formData) {
  const item = {
    type: formData.get("type"),
    label: formData.get("label"),
    quantity: Math.max(Number(formData.get("quantity")) || 0, 0),
    note: formData.get("note"),
  };
  try {
    const saved = await request("/inventory", { method: "POST", body: JSON.stringify(item) });
    state.data.inventory.unshift(saved);
  } catch (error) {
    state.data.inventory.unshift({ ...item, id: crypto.randomUUID() });
  }
  saveLocalData();
  inventoryForm.reset();
  inventoryForm.quantity.value = "1";
  renderAll();
  showToast("Inventory saved.");
}

function resetProjectForm() {
  projectForm.reset();
  projectForm.id.value = "";
  projectForm.progress.value = "10";
  projectSubmit.textContent = "Save project";
  document.querySelector("[data-cancel-project-edit]").classList.add("hidden");
  projectForm.classList.add("hidden");
}

function resetIdeaForm() {
  ideaForm.reset();
  ideaForm.id.value = "";
  ideaSubmit.textContent = "Save idea";
  document.querySelector("[data-cancel-idea-edit]").classList.add("hidden");
  ideaForm.classList.add("hidden");
}

function editProject(id) {
  const project = state.data.projects.find((item) => item.id === id);
  if (!project) return;
  projectForm.classList.remove("hidden");
  projectForm.id.value = project.id;
  projectForm.title.value = project.title || "";
  projectForm.notes.value = project.notes || "";
  projectForm.source.value = project.source || "";
  projectForm.startedAt.value = project.startedAt || "";
  projectForm.progress.value = getProgress(project);
  projectForm.completedSections.value = project.completedSections ?? "";
  projectForm.totalSections.value = project.totalSections ?? "";
  projectForm.details.value = project.details || "";
  projectSubmit.textContent = "Update project";
  document.querySelector("[data-cancel-project-edit]").classList.remove("hidden");
  projectForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editIdea(id) {
  const idea = state.data.ideas.find((item) => item.id === id);
  if (!idea) return;
  ideaForm.classList.remove("hidden");
  ideaForm.id.value = idea.id;
  ideaForm.title.value = idea.title || "";
  ideaForm.tag.value = idea.tag || "";
  ideaForm.details.value = idea.details || "";
  ideaSubmit.textContent = "Update idea";
  document.querySelector("[data-cancel-idea-edit]").classList.remove("hidden");
  ideaForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showIdeaDetail(id) {
  const idea = state.data.ideas.find((item) => item.id === id);
  const panel = document.querySelector("[data-idea-detail]");
  if (!idea) return;
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="row-title">
      <div>
        <p class="eyebrow">Idea detail</p>
        <h3>${escapeHtml(idea.title)}</h3>
      </div>
      <button type="button" data-close-detail>Close</button>
    </div>
    <p>${escapeHtml(idea.details || "No extra details saved yet.")}</p>
    <span class="tag">${escapeHtml(idea.tag)}</span>
  `;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showCommunityDetail(id) {
  const post = state.data.gallery.find((item) => item.id === id);
  const panel = document.querySelector("[data-community-detail]");
  if (!post) return;
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <img src="${post.image}" alt="${escapeHtml(post.title)} diamond painting" />
    <div class="row-title">
      <div>
        <p class="eyebrow">${escapeHtml(post.owner)}'s project</p>
        <h3>${escapeHtml(post.title)}</h3>
      </div>
      <button type="button" data-close-detail>Close</button>
    </div>
    <p>${escapeHtml(post.details || post.notes)}</p>
    <div class="detail-grid">
      <span><strong>${Number(post.progress) || 0}%</strong> progress</span>
      <span><strong>${escapeHtml(post.source || "Not shared")}</strong> bought from</span>
      <span><strong>${escapeHtml(post.timeSpent || "Not shared")}</strong> worked on it</span>
      <span><strong>${escapeHtml(post.startedAt || "Not shared")}</strong> started</span>
    </div>
    <div class="post-actions">
      ${post.chatEnabled ? `<button type="button" data-chat-user="${escapeHtml(post.userId || "community")}">Chat with ${escapeHtml(post.owner)}</button>` : "<span class=\"chat-off\">Chat is off for this maker</span>"}
    </div>
  `;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  if (authMode === "register") {
    createAccount(formData);
    return;
  }
  signIn(formData.get("email"), formData.get("password"));
});

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

onboardingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveOnboarding(new FormData(onboardingForm));
});

document.querySelector("[data-demo-login]").addEventListener("click", startBuiltInDemo);

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.nav));
});

document.querySelectorAll(".segment").forEach((segment) => {
  segment.addEventListener("click", () => setRange(segment.dataset.range));
});

document.querySelectorAll("[data-location-toggle], [data-settings-location-toggle]").forEach((toggle) => {
  toggle.addEventListener("change", syncLocationFields);
});

document.querySelector("[data-create-project]").addEventListener("click", () => projectForm.classList.toggle("hidden"));
document.querySelector("[data-create-idea]").addEventListener("click", () => ideaForm.classList.toggle("hidden"));
document.querySelector("[data-cancel-project-edit]").addEventListener("click", resetProjectForm);
document.querySelector("[data-cancel-idea-edit]").addEventListener("click", resetIdeaForm);

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings(new FormData(settingsForm));
});

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveProject(new FormData(projectForm));
});

ideaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveIdea(new FormData(ideaForm));
});

inventoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveInventory(new FormData(inventoryForm));
});

document.querySelector("[data-logout]").addEventListener("click", () => {
  state.token = "";
  localStorage.removeItem("prismPatchToken");
  showLogin();
  showToast("Signed out.");
});

document.querySelector("[data-delete-account]").addEventListener("click", async () => {
  const localId = getCurrentLocalId();
  try {
    await request("/account", { method: "DELETE" });
  } catch (error) {
    state.token = "";
  }
  localStorage.removeItem("prismPatchToken");
  if (localId) {
    localStorage.removeItem(localDataKey(localId));
    const accounts = getLocalAccounts();
    delete accounts[localId];
    saveLocalAccounts(accounts);
  }
  state.token = "";
  showLogin();
  showToast("Account deletion requested.");
});

document.addEventListener("click", async (event) => {
  const editProjectButton = event.target.closest("[data-edit-project]");
  const deleteProjectButton = event.target.closest("[data-delete-project]");
  const viewIdeaButton = event.target.closest("[data-view-idea]");
  const editIdeaButton = event.target.closest("[data-edit-idea]");
  const deleteIdeaButton = event.target.closest("[data-delete-idea]");
  const deleteInventoryButton = event.target.closest("[data-delete-inventory]");
  const viewPostButton = event.target.closest("[data-view-post]");
  const chatButton = event.target.closest("[data-chat-user]");
  const closeDetailButton = event.target.closest("[data-close-detail]");
  const reportButton = event.target.closest("[data-report-post]");
  const blockButton = event.target.closest("[data-block-user]");

  if (editProjectButton) {
    editProject(editProjectButton.dataset.editProject);
  }

  if (deleteProjectButton) {
    const id = deleteProjectButton.dataset.deleteProject;
    await request(`/projects/${id}`, { method: "DELETE" }).catch(() => null);
    state.data.projects = state.data.projects.filter((project) => project.id !== id);
    saveLocalData();
    renderAll();
    showToast("Project deleted.");
  }

  if (viewIdeaButton) {
    showIdeaDetail(viewIdeaButton.dataset.viewIdea);
  }

  if (editIdeaButton) {
    editIdea(editIdeaButton.dataset.editIdea);
  }

  if (deleteIdeaButton) {
    const id = deleteIdeaButton.dataset.deleteIdea;
    await request(`/ideas/${id}`, { method: "DELETE" }).catch(() => null);
    state.data.ideas = state.data.ideas.filter((idea) => idea.id !== id);
    saveLocalData();
    renderAll();
    showToast("Idea deleted.");
  }

  if (deleteInventoryButton) {
    const id = deleteInventoryButton.dataset.deleteInventory;
    await request(`/inventory/${id}`, { method: "DELETE" }).catch(() => null);
    state.data.inventory = state.data.inventory.filter((item) => item.id !== id);
    saveLocalData();
    renderAll();
    showToast("Inventory item removed.");
  }

  if (viewPostButton) {
    showCommunityDetail(viewPostButton.dataset.viewPost);
  }

  if (chatButton) {
    if (!state.data.user.allowMessages) {
      showToast("Turn on community chat requests in Settings first.");
    } else {
      await request("/messages", {
        method: "POST",
        body: JSON.stringify({ toUserId: chatButton.dataset.chatUser, body: "I would like to chat about your diamond painting." }),
      }).catch(() => null);
      showToast("Chat request prepared. Messaging is optional for both members.");
    }
  }

  if (closeDetailButton) {
    closeDetailButton.closest(".detail-panel")?.classList.add("hidden");
  }

  if (reportButton) {
    await request("/reports", {
      method: "POST",
      body: JSON.stringify({ postId: reportButton.dataset.reportPost, reason: "User reported from community feed" }),
    }).catch(() => null);
    showToast("Report sent for review.");
  }

  if (blockButton) {
    await request("/blocks", {
      method: "POST",
      body: JSON.stringify({ blockedUserId: blockButton.dataset.blockUser }),
    }).catch(() => null);
    state.data.gallery = state.data.gallery.filter((post) => (post.userId || "community") !== blockButton.dataset.blockUser);
    saveLocalData();
    renderGallery();
    showToast("Member blocked from your feed.");
  }
});

if (state.token) {
  loadAppData().then(routeAfterProfileCheck);
} else {
  renderAll();
}
