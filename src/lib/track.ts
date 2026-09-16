// Tráfico web anónimo (solo páginas de la plataforma, nunca links públicos de vacantes).

const KEY = "flux_wsid";
const EXCLUDED_PREFIXES = ["/apply", "/schedule", "/api", "/auth/impersonate", "/email"];

export function isTrackablePath(path: string) {
  return !EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function sessionKey() {
  if (typeof window === "undefined") return null;
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = uuid();
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return null;
  }
}

function deviceInfo() {
  const ua = navigator.userAgent || "";
  const mobile = /Mobi|Android|iPhone|iPod/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobi/i.test(ua));
  const device_type = tablet ? "tablet" : mobile ? "mobile" : "desktop";

  let os = "Otro";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Otro";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) browser = "Facebook app";
  else if (/Instagram/i.test(ua)) browser = "Instagram app";
  else if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  return { device_type, os, browser, user_agent: ua.slice(0, 400), language: navigator.language };
}

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/public/track", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* noop */
  }
  fetch("/api/public/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

let lastPath = "";

export function trackPageView(path: string) {
  if (typeof window === "undefined") return;
  if (!isTrackablePath(path) || path === lastPath) return;
  lastPath = path;
  const key = sessionKey();
  if (!key) return;

  const url = new URL(window.location.href);
  const utm = {
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    utm_content: url.searchParams.get("utm_content"),
    utm_term: url.searchParams.get("utm_term"),
  };
  const fbclid = url.searchParams.get("fbclid");
  if (!utm.utm_source && fbclid) utm.utm_source = "facebook";

  send({
    session_key: key,
    type: "pageview",
    path,
    referrer: document.referrer || null,
    ...utm,
    ...deviceInfo(),
  });
}

export function trackEvent(name: string, metadata: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const key = sessionKey();
  if (!key) return;
  send({
    session_key: key,
    type: "action",
    name,
    path: window.location.pathname,
    metadata,
    ...deviceInfo(),
  });
}
