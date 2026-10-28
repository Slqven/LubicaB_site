import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(root, "public");
const port = Number(process.env.PORT || 3000);
const maxBodyBytesContact = 16_000;
const maxBodyBytesChat = 2_000;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 5);

// Simple in-memory rate limiter (fixed window)
const rateLimitStore = new Map();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
};

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(response) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(key, value);
  }
}

function getClientIp(request) {
  // Use first IP from common proxy headers if present, but prefer direct connection
  // For same-origin site behind typical setups, use socket remote address
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return request.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip, endpoint) {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Start new window
    rateLimitStore.set(key, {
      windowStart: now,
      count: 1,
    });
    return { allowed: true };
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count += 1;
  rateLimitStore.set(key, entry);
  return { allowed: true };
}

function sendJson(response, status, payload) {
  applySecurityHeaders(response);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request, maxBytes = maxBodyBytesContact) {
  // Proactively check Content-Length if present
  const contentLength = request.headers["content-length"];
  if (contentLength) {
    const length = Number(contentLength);
    if (!Number.isNaN(length) && length > maxBytes) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
  }

  const chunks = [];
  let bytes = 0;

  try {
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        const error = new Error("Request body is too large.");
        error.status = 413;
        throw error;
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error.status) throw error;
    const err = new Error("Failed to read request body.");
    err.status = 400;
    throw err;
  }

  if (chunks.length === 0) {
    const error = new Error("Request body is required.");
    error.status = 400;
    throw error;
  }

  try {
    const body = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(body);
  } catch {
    const error = new Error("Please send valid JSON.");
    error.status = 400;
    throw error;
  }
}

function escapeHtml(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function sanitizeString(value, maxLength) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function validateContact(data) {
  const fields = ["name", "email", "service", "date", "message"];
  for (const field of fields) {
    if (typeof data[field] !== "string" || data[field].trim().length === 0) {
      return `Please provide your ${field}.`;
    }
  }

  const name = data.name.trim();
  const message = data.message.trim();
  const email = data.email.trim();
  const service = data.service;
  const date = data.date;

  if (name.length > 120 || message.length > 5_000) {
    return "Your name or message is too long.";
  }
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please provide a valid email address.";
  }
  if (email.length > 254) {
    return "Please provide a valid email address.";
  }
  if (!["Company lessons", "Language audit", "Translation", "Tutoring & interpreting", "Other"].includes(service)) {
    return "Please choose a valid service.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "Please provide a valid preferred date.";
  }

  return null;
}

async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  
  if (!apiKey || !from) {
    throw new Error("Email configuration missing");
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      // Don't log full response details that might contain sensitive info
      console.error("Email provider returned an error with status:", response.status);
      throw new Error("The email service could not send the message.");
    }
  } catch (error) {
    if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
      console.error("Email request timed out");
      throw new Error("The email service timed out.");
    }
    if (error.message === "The email service could not send the message." || error.message === "The email service timed out.") {
      throw error;
    }
    console.error("Email request failed");
    throw new Error("The email service could not send the message.");
  }
}

async function handleContact(request, response) {
  const data = await readJson(request, maxBodyBytesContact);
  const validationError = validateContact(data);
  if (validationError) {
    sendJson(response, 400, { error: validationError });
    return;
  }

  const requiredSettings = ["RESEND_API_KEY", "EMAIL_FROM", "INTERPRETER_EMAIL"];
  const missingSettings = requiredSettings.filter((setting) => !process.env[setting]);
  if (missingSettings.length > 0) {
    console.error("Contact form is missing configuration");
    sendJson(response, 503, { error: "The booking form is not configured yet. Please try again later." });
    return;
  }

  const nameRaw = data.name.trim();
  const emailRaw = data.email.trim();
  const serviceRaw = data.service;
  const dateRaw = data.date;
  const messageRaw = data.message.trim();

  const name = escapeHtml(nameRaw);
  const email = escapeHtml(emailRaw);
  const service = escapeHtml(serviceRaw);
  const date = escapeHtml(dateRaw);
  const message = escapeHtml(messageRaw).replace(/\r?\n/g, "<br>");
  const siteName = escapeHtml(process.env.SITE_NAME || "English Interpreter Bratislava");
  const interpreterName = escapeHtml(process.env.INTERPRETER_NAME || "Your interpreter");

  try {
    await sendEmail({
      to: process.env.INTERPRETER_EMAIL,
      replyTo: emailRaw,
      subject: `New enquiry from ${nameRaw.slice(0, 50)}`,
      html: `<h2>New interpreting enquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Preferred date:</strong> ${date}</p>
        <p><strong>Details:</strong><br>${message}</p>`,
    });
  } catch {
    // Don't reveal specifics - same generic error
    sendJson(response, 502, { error: "Your enquiry could not be sent. Please try again or email the interpreter directly." });
    return;
  }

  try {
    await sendEmail({
      to: emailRaw,
      subject: `We received your enquiry | ${siteName}`,
      html: `<p>Hello ${name},</p>
        <p>${interpreterName} has received your enquiry and will be in touch.</p>
        <p><strong>Service:</strong> ${service}<br><strong>Preferred date:</strong> ${date}</p>
        <p>This is an acknowledgement, not a confirmed booking.</p>`,
    });
    sendJson(response, 200, { message: "Your enquiry has been sent. A confirmation email is on its way." });
  } catch {
    // Still return success to avoid user enumeration/timing issues
    sendJson(response, 200, {
      message: "Your enquiry reached the interpreter, but we could not send the confirmation email. You do not need to submit again.",
    });
  }
}

async function handleChat(request, response) {
  const data = await readJson(request, maxBodyBytesChat);
  if (typeof data.message !== "string") {
    sendJson(response, 400, { error: "Please enter a message of up to 1,200 characters." });
    return;
  }
  
  const message = data.message.trim();
  if (message.length === 0 || message.length > 1_200) {
    sendJson(response, 400, { error: "Please enter a message of up to 1,200 characters." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, { error: "The chat assistant is not configured yet. Please use the enquiry form instead." });
    return;
  }

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are the website assistant for ${process.env.INTERPRETER_NAME || "Ljubica Bielikova"}, an English teacher, language auditor, translator and interpreter based in Bratislava, Slovakia. Help visitors understand how to enquire about company English lessons, language audits, English–Slovak translation, and tutoring or interpreting. Be warm, concise, and reply in the language the visitor uses when possible. Do not invent prices, availability, qualifications, or legal/medical advice; invite visitors to use the enquiry form for specifics. You are an AI assistant, not the interpreter, and cannot confirm bookings.`,
          },
          { role: "user", content: message },
        ],
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!apiResponse.ok) {
      console.error("Chat provider returned an error with status:", apiResponse.status);
      sendJson(response, 502, { error: "The chat assistant is temporarily unavailable. Please use the enquiry form." });
      return;
    }

    const result = await apiResponse.json();
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.error("Chat provider returned no assistant message");
      sendJson(response, 502, { error: "The chat assistant did not return a reply. Please use the enquiry form." });
      return;
    }
    sendJson(response, 200, { reply: reply.trim() });
  } catch (error) {
    if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
      console.error("Chat request timed out");
    } else {
      console.error("Chat request failed");
    }
    sendJson(response, 502, { error: "The chat assistant is temporarily unavailable. Please use the enquiry form." });
  }
}

async function serveStatic(pathname, response) {
  let requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  // Normalize and resolve
  const normalized = requestedPath.replace(/\\/g, "/");
  // Prevent directory traversal attempts
  if (normalized.includes("..") || normalized.includes("//")) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }
  
  const filePath = resolve(publicRoot, `.${normalized}`);
  const resolvedPublicRoot = resolve(publicRoot);
  
  // Robust path traversal check
  if (filePath !== resolvedPublicRoot && !filePath.startsWith(resolvedPublicRoot + sep)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }
  
  // Ensure we're still within public root
  if (resolve(filePath).indexOf(resolvedPublicRoot) !== 0) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    const content = await readFile(filePath);
    applySecurityHeaders(response);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": pathname === "/" || extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    console.error("Unable to serve static file");
    sendJson(response, 500, { error: "Unable to load this page." });
  }
}

function logRequest(request, statusCode) {
  const method = request.method;
  const url = request.url;
  const ip = getClientIp(request);
  // Don't log query strings that might contain sensitive data, just log method and path
  try {
    const parsedUrl = new URL(url, `http://${request.headers.host || "localhost"}`);
    console.log(`${new Date().toISOString()} ${ip} ${method} ${parsedUrl.pathname} ${statusCode}`);
  } catch {
    console.log(`${new Date().toISOString()} ${ip} ${method} ${url.split("?")[0]} ${statusCode}`);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  
  // Add security headers to all responses
  applySecurityHeaders(response);

  const isApiRoute = ["/api/contact", "/api/chat", "/api/health"].includes(url.pathname);
  const origin = request.headers.origin;
  if (isApiRoute && origin) {
    if (!allowedOrigins.has(origin)) {
      sendJson(response, 403, { error: "This website is not allowed to use the API." });
      logRequest(request, 403);
      return;
    }

    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "Content-Type");
    response.setHeader("access-control-max-age", "600");
    response.setHeader("vary", "Origin");
  }

  if (request.method === "OPTIONS" && isApiRoute) {
    response.writeHead(204);
    response.end();
    return;
  }

  // Health check endpoint
  if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
    sendJson(response, 200, { status: "ok" });
    logRequest(request, 200);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/contact") {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(ip, "contact");
    if (!rateLimit.allowed) {
      response.setHeader("Retry-After", String(rateLimit.retryAfter || 60));
      sendJson(response, 429, { error: "Too many requests. Please try again later." });
      logRequest(request, 429);
      return;
    }
    try {
      await handleContact(request, response);
      logRequest(request, response.statusCode || 200);
    } catch (error) {
      console.error("Contact request failed");
      if (error.status) {
        sendJson(response, error.status, { error: error.status === 413 ? "Request body is too large." : error.message });
      } else {
        sendJson(response, 500, { error: "The enquiry could not be processed." });
      }
      logRequest(request, error.status || 500);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/chat") {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(ip, "chat");
    if (!rateLimit.allowed) {
      response.setHeader("Retry-After", String(rateLimit.retryAfter || 60));
      sendJson(response, 429, { error: "Too many requests. Please try again later." });
      logRequest(request, 429);
      return;
    }
    try {
      await handleChat(request, response);
      logRequest(request, response.statusCode || 200);
    } catch (error) {
      console.error("Chat request failed");
      if (error.status) {
        sendJson(response, error.status, { error: error.status === 413 ? "Request body is too large." : error.message });
      } else {
        sendJson(response, 500, { error: "The chat request could not be processed." });
      }
      logRequest(request, error.status || 500);
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed." });
    logRequest(request, 405);
    return;
  }

  try {
    await serveStatic(url.pathname, response);
    logRequest(request, response.statusCode || 200);
  } catch (error) {
    console.error("Static file serving failed");
    sendJson(response, 500, { error: "Unable to load this page." });
    logRequest(request, 500);
  }
});

server.listen(port, () => {
  console.log(`Interpreter website running at http://localhost:${port}`);
});
