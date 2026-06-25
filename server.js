const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");
const { createReadStream, existsSync } = require("node:fs");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const { createServer } = require("node:http");
const { extname, join, normalize } = require("node:path");

const root = __dirname;
const dataDir = join(root, "data");
const dbPath = join(dataDir, "db.json");
const port = Number(process.env.PORT || 4173);
const tokenSecret = process.env.PRISM_PATCH_SECRET || "replace-this-secret-before-production";
const allowedOrigins = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://api.prismpatch.app",
  ...(process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);

if (process.env.NODE_ENV === "production" && tokenSecret === "replace-this-secret-before-production") {
  throw new Error("Set PRISM_PATCH_SECRET before running in production.");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const server = createServer(async (request, response) => {
  try {
    setSecurityHeaders(response, request);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.url.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: "Server error", detail: error.message });
  }
});

server.listen(port, () => {
  console.log(`Prism Patch running at http://127.0.0.1:${port}`);
});

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, app: "Prism Patch" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.displayName || "New maker").trim();
    if (!email || password.length < 8) {
      sendJson(response, 400, { error: "Email and an 8-character password are required." });
      return;
    }
    const db = await readDb();
    if (db.users.some((user) => user.email === email)) {
      sendJson(response, 409, { error: "That email is already registered." });
      return;
    }
    const salt = randomBytes(16).toString("hex");
    const user = {
      id: createId("u"),
      email,
      passwordHash: hashPassword(password, salt),
      salt,
      displayName,
      dateOfBirth: cleanString(body.dateOfBirth, 20),
      gender: cleanString(body.gender, 40),
      location: "",
      shareLocation: false,
      connectionRange: "local",
      publicProfile: true,
      reminders: true,
      allowMessages: true,
    };
    db.users.push(user);
    await writeDb(db);
    sendJson(response, 201, { token: signToken(user.id), user: publicUser(user) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(request);
    const db = await readDb();
    const user = db.users.find((candidate) => candidate.email === String(body.email || "").trim().toLowerCase());
    if (!user || !verifyPassword(String(body.password || ""), user)) {
      sendJson(response, 401, { error: "Email or password is incorrect." });
      return;
    }
    sendJson(response, 200, { token: signToken(user.id), user: publicUser(user) });
    return;
  }

  const userId = authenticate(request);
  if (!userId) {
    sendJson(response, 401, { error: "Sign in required." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/app") {
    const db = await readDb();
    const user = db.users.find((candidate) => candidate.id === userId);
    const blockedIds = new Set((db.blocks || []).filter((item) => item.userId === userId).map((item) => item.blockedUserId));
    sendJson(response, 200, {
      user: publicUser(user),
      projects: db.projects.filter((item) => item.userId === userId),
      ideas: db.ideas.filter((item) => item.userId === userId),
      inventory: db.inventory.filter((item) => item.userId === userId),
      gallery: db.gallery.filter((item) => !blockedIds.has(item.userId)),
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/settings") {
    const body = await readBody(request);
    const db = await readDb();
    const user = db.users.find((candidate) => candidate.id === userId);
    Object.assign(user, {
      displayName: cleanString(body.displayName, 80),
      dateOfBirth: cleanString(body.dateOfBirth, 20),
      gender: cleanString(body.gender, 40),
      location: Boolean(body.shareLocation) ? cleanString(body.location, 80) : "",
      shareLocation: Boolean(body.shareLocation),
      connectionRange: ["local", "states", "world"].includes(body.connectionRange) ? body.connectionRange : "local",
      publicProfile: Boolean(body.publicProfile),
      reminders: Boolean(body.reminders),
      allowMessages: Boolean(body.allowMessages),
    });
    await writeDb(db);
    sendJson(response, 200, publicUser(user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/projects") {
    const body = await readBody(request);
    const db = await readDb();
    const completedSections = nullableNumber(body.completedSections);
    const totalSections = nullableNumber(body.totalSections);
    const project = {
      id: createId("p"),
      userId,
      title: cleanString(body.title, 90),
      notes: cleanString(body.notes, 160),
      source: cleanString(body.source, 120),
      startedAt: cleanString(body.startedAt, 20),
      details: cleanString(body.details, 500),
      progress: calculateProgress(body.progress, completedSections, totalSections),
      completedSections,
      totalSections,
      image: cleanString(body.image || "assets/rainbow-florals.svg", 120),
    };
    if (hasBlockedTerms(project.title) || hasBlockedTerms(project.notes)) {
      sendJson(response, 400, { error: "Please revise this project text before saving." });
      return;
    }
    db.projects.unshift(project);
    await writeDb(db);
    sendJson(response, 201, withoutUserId(project));
    return;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/projects/")) {
    const body = await readBody(request);
    const id = url.pathname.split("/").pop();
    const completedSections = nullableNumber(body.completedSections);
    const totalSections = nullableNumber(body.totalSections);
    const updated = await updateOwnedItem("projects", userId, id, {
      title: cleanString(body.title, 90),
      notes: cleanString(body.notes, 160),
      source: cleanString(body.source, 120),
      startedAt: cleanString(body.startedAt, 20),
      details: cleanString(body.details, 500),
      progress: calculateProgress(body.progress, completedSections, totalSections),
      completedSections,
      totalSections,
      image: cleanString(body.image || "assets/rainbow-florals.svg", 120),
    });
    sendJson(response, updated ? 200 : 404, updated ? withoutUserId(updated) : { error: "Project not found." });
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/projects/")) {
    const id = url.pathname.split("/").pop();
    const deleted = await deleteOwnedItem("projects", userId, id);
    sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Project not found." });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ideas") {
    const body = await readBody(request);
    const db = await readDb();
    const idea = {
      id: createId("i"),
      userId,
      title: cleanString(body.title, 90),
      tag: cleanString(body.tag, 40),
      details: cleanString(body.details, 500),
    };
    if (hasBlockedTerms(idea.title) || hasBlockedTerms(idea.tag)) {
      sendJson(response, 400, { error: "Please revise this idea before saving." });
      return;
    }
    db.ideas.unshift(idea);
    await writeDb(db);
    sendJson(response, 201, withoutUserId(idea));
    return;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/ideas/")) {
    const body = await readBody(request);
    const id = url.pathname.split("/").pop();
    const updated = await updateOwnedItem("ideas", userId, id, {
      title: cleanString(body.title, 90),
      tag: cleanString(body.tag, 40),
      details: cleanString(body.details, 500),
    });
    sendJson(response, updated ? 200 : 404, updated ? withoutUserId(updated) : { error: "Idea not found." });
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/ideas/")) {
    const id = url.pathname.split("/").pop();
    const deleted = await deleteOwnedItem("ideas", userId, id);
    sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Idea not found." });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/inventory") {
    const body = await readBody(request);
    const db = await readDb();
    const inventoryItem = {
      id: createId("d"),
      userId,
      type: cleanString(body.type || "note", 40),
      code: cleanString(body.code, 40),
      label: cleanString(body.label || body.code, 90),
      quantity: Math.max(Number(body.quantity) || 0, 0),
      note: cleanString(body.note, 500),
      color: cleanString(body.color || "#ff4fa3", 24),
    };
    db.inventory.unshift(inventoryItem);
    await writeDb(db);
    sendJson(response, 201, withoutUserId(inventoryItem));
    return;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/inventory/")) {
    const body = await readBody(request);
    const id = url.pathname.split("/").pop();
    const updated = await updateOwnedItem("inventory", userId, id, {
      code: cleanString(body.code, 40),
      type: cleanString(body.type || "note", 40),
      label: cleanString(body.label || body.code, 90),
      quantity: Math.max(Number(body.quantity) || 0, 0),
      note: cleanString(body.note, 500),
      color: cleanString(body.color || "#ff4fa3", 24),
    });
    sendJson(response, updated ? 200 : 404, updated ? withoutUserId(updated) : { error: "Inventory item not found." });
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/inventory/")) {
    const id = url.pathname.split("/").pop();
    const deleted = await deleteOwnedItem("inventory", userId, id);
    sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Inventory item not found." });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports") {
    const body = await readBody(request);
    const db = await readDb();
    db.reports = db.reports || [];
    db.reports.unshift({
      id: createId("r"),
      userId,
      postId: cleanString(body.postId, 80),
      reason: cleanString(body.reason, 240),
      status: "open",
      createdAt: new Date().toISOString(),
    });
    await writeDb(db);
    sendJson(response, 201, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/blocks") {
    const body = await readBody(request);
    const db = await readDb();
    db.blocks = db.blocks || [];
    const blockedUserId = cleanString(body.blockedUserId, 80);
    if (!db.blocks.some((item) => item.userId === userId && item.blockedUserId === blockedUserId)) {
      db.blocks.unshift({ id: createId("b"), userId, blockedUserId, createdAt: new Date().toISOString() });
      await writeDb(db);
    }
    sendJson(response, 201, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/messages") {
    const body = await readBody(request);
    const db = await readDb();
    db.messages = db.messages || [];
    const toUserId = cleanString(body.toUserId, 80);
    const recipient = db.users.find((user) => user.id === toUserId);
    if (recipient && recipient.allowMessages === false) {
      sendJson(response, 403, { error: "This maker is not accepting chat requests." });
      return;
    }
    db.messages.unshift({
      id: createId("m"),
      fromUserId: userId,
      toUserId,
      body: cleanString(body.body || "I would like to chat about your diamond painting.", 500),
      status: "requested",
      createdAt: new Date().toISOString(),
    });
    await writeDb(db);
    sendJson(response, 201, { ok: true });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/account") {
    const db = await readDb();
    db.users = db.users.filter((item) => item.id !== userId);
    for (const collection of ["projects", "ideas", "inventory", "blocks", "reports"]) {
      db[collection] = (db[collection] || []).filter((item) => item.userId !== userId);
    }
    db.messages = (db.messages || []).filter((item) => item.fromUserId !== userId && item.toUserId !== userId);
    await writeDb(db);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    sendJson(response, 404, { error: "File not found." });
    return;
  }

  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body too large");
  }
  return body ? JSON.parse(body) : {};
}

async function readDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(dbPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const db = createInitialDb();
    await writeDb(db);
    return db;
  }
}

async function writeDb(db) {
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

async function updateOwnedItem(collection, userId, id, changes) {
  const db = await readDb();
  const item = db[collection].find((candidate) => candidate.id === id && candidate.userId === userId);
  if (!item) return null;
  Object.assign(item, changes);
  await writeDb(db);
  return item;
}

async function deleteOwnedItem(collection, userId, id) {
  const db = await readDb();
  const before = db[collection].length;
  db[collection] = db[collection].filter((item) => item.id !== id || item.userId !== userId);
  if (db[collection].length === before) return false;
  await writeDb(db);
  return true;
}

function hashPassword(password, salt) {
  return createHmac("sha256", salt).update(password).digest("hex");
}

function verifyPassword(password, user) {
  const actual = Buffer.from(hashPassword(password, user.salt), "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function signToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })).toString("base64url");
  const signature = createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function authenticate(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  if (signature !== expected) return null;
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decoded.exp > Date.now() ? decoded.userId : null;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    dateOfBirth: user.dateOfBirth || "",
    gender: user.gender || "",
    location: user.location,
    shareLocation: Boolean(user.shareLocation),
    connectionRange: user.connectionRange,
    publicProfile: user.publicProfile,
    reminders: user.reminders,
    allowMessages: user.allowMessages !== false,
  };
}

function withoutUserId(item) {
  const { userId, ...rest } = item;
  return rest;
}

function createId(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function cleanString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function hasBlockedTerms(value) {
  const normalized = String(value || "").toLowerCase();
  return ["kill yourself", "nazi", "terrorist threat"].some((term) => normalized.includes(term));
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateProgress(progress, completedSections, totalSections) {
  if (completedSections !== null && totalSections > 0) {
    return clamp(Math.round((completedSections / totalSections) * 100), 0, 100);
  }
  return clamp(Number(progress) || 0, 0, 100);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setSecurityHeaders(response, request) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Max-Age", "86400");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://api.prismpatch.app");
}

function createInitialDb() {
  return {
    users: [
      {
        id: "u_demo",
        email: "demo@prismpatch.app",
        passwordHash: "e300839dc0ec5cc28d8dbe867487b6aebce683da83a4688d2ff4c9022628d8df",
        salt: "prism-demo-salt",
        displayName: "Maya Spark",
        dateOfBirth: "1990-01-01",
        gender: "prefer-not-to-say",
        location: "",
        shareLocation: false,
        connectionRange: "local",
        publicProfile: true,
        reminders: true,
        allowMessages: true,
      },
    ],
    projects: [
      { id: "p1", userId: "u_demo", title: "Ocean turtle glow", notes: "Square drills · 45 colors · AB highlights", source: "Prism Crafts Studio", startedAt: "2026-05-04", details: "Working the turtle shell first, then saving the blue water for evening sessions.", progress: 68, completedSections: 8, totalSections: 12, image: "assets/ocean-turtle.svg" },
      { id: "p2", userId: "u_demo", title: "Sunset cottage gift", notes: "Round drills · due Aug 12 · framed", source: "Etsy kit shop", startedAt: "2026-06-01", details: "Gift for the hallway. Check frame depth before sealing.", progress: 34, completedSections: 4, totalSections: 12, image: "assets/sunset-cottage.svg" },
      { id: "p3", userId: "u_demo", title: "Rainbow florals", notes: "Custom canvas · color cleanup needed", source: "Custom photo kit", startedAt: "", details: "Use leftover AB drills in the flower centers.", progress: 12, completedSections: 1, totalSections: 10, image: "assets/rainbow-florals.svg" },
    ],
    ideas: [
      { id: "i1", userId: "u_demo", title: "Pet portrait with crystal collar", tag: "Custom gift", details: "Use a close-up photo and add AB drills around the collar so it catches light." },
      { id: "i2", userId: "u_demo", title: "Holiday ornament leftover set", tag: "Use leftovers", details: "Small wooden shapes, sealed leftovers, ribbon backs, and gift tags." },
      { id: "i3", userId: "u_demo", title: "Quiet lake for weekend sessions", tag: "Calm project", details: "Look for a square-drill kit with soft blues and a low confetti sky." },
    ],
    inventory: [
      { id: "inv1", userId: "u_demo", type: "notStarted", label: "Unopened kits", quantity: 3, note: "Floral, cottage, and custom portrait are still boxed.", color: "#ff4fa3" },
      { id: "inv2", userId: "u_demo", type: "wax", label: "Pink wax squares", quantity: 6, note: "Two in the travel case, four in the drawer.", color: "#ff735d" },
      { id: "inv3", userId: "u_demo", type: "tray", label: "Sorting trays", quantity: 5, note: "Large white tray is best for AB drills.", color: "#24b6d9" },
      { id: "inv4", userId: "u_demo", type: "drillCode", code: "DMC 310", label: "DMC 310", quantity: 1, note: "Extra black drills from the turtle kit.", color: "#15121d" },
    ],
    gallery: [
      { id: "g1", userId: "maker_florida", owner: "Lena", title: "Ocean Turtle Glow", meta: "Florida · local", notes: "Finished with blue AB drills and a glossy sealer.", image: "assets/ocean-turtle.svg", progress: 100, source: "Diamond Art Club", timeSpent: "38 hours across 5 weeks", startedAt: "2026-04-18", details: "Used square drills, sealed lightly, and framed with a white mat.", chatEnabled: true },
      { id: "g2", userId: "maker_colorado", owner: "Priya", title: "Sunset Cottage", meta: "Colorado · between states", notes: "Gift plan with frame notes and warm color substitutions.", image: "assets/sunset-cottage.svg", progress: 76, source: "Etsy custom kit", timeSpent: "21 hours so far", startedAt: "2026-05-22", details: "Swapped three oranges for softer peach tones to match the recipient's room.", chatEnabled: true },
      { id: "g3", userId: "maker_texas", owner: "Nora", title: "Rainbow Florals", meta: "Texas · local", notes: "Shared as a spring challenge with leftover drills.", image: "assets/rainbow-florals.svg", progress: 54, source: "Craft store kit", timeSpent: "14 hours", startedAt: "2026-06-05", details: "Working color by color and saving white background sections for last.", chatEnabled: false },
      { id: "g4", userId: "maker_canada", owner: "Maya", title: "Cosmic Owl", meta: "Canada · international", notes: "International inspiration from a maker group.", image: "assets/cosmic-owl.svg", progress: 92, source: "AliExpress kit", timeSpent: "33 hours", startedAt: "2026-03-29", details: "Added extra AB stars and used release paper to split the canvas into 16 sections.", chatEnabled: true },
    ],
    reports: [],
    blocks: [],
    messages: [],
  };
}
