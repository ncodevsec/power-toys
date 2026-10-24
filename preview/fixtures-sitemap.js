const now = Date.now();
const sm = (method, url, type, status, count = 1, thirdParty = false) => ({
  method, url, type, status, count, thirdParty,
  firstSeen: now - 60000, lastSeen: now - count * 1000,
});

export const FIXTURE_SITEMAP = Object.fromEntries(
  [
    sm("GET", "https://app.example.com/dashboard", "main_frame", 200),
    sm("GET", "https://app.example.com/assets/bundle.min.js", "script", 200, 2),
    sm("GET", "https://app.example.com/assets/app.css", "stylesheet", 200),
    sm("GET", "https://app.example.com/assets/logo.svg", "image", 200),
    sm("GET", "https://app.example.com/assets/img/hero.png", "image", 200),
    sm("GET", "https://app.example.com/static/js/vendor.js", "script", 200),
    sm("POST", "https://app.example.com/api/v1/auth/login", "xmlhttprequest", 401),
    sm("GET", "https://app.example.com/api/v1/me?session_id=8f19a2c7", "xmlhttprequest", 200, 3),
    sm("GET", "https://app.example.com/admin/legacy", "main_frame", 404),
    sm("GET", "https://cdn.example.com/lib/react.production.min.js", "script", 200),
    sm("GET", "https://www.googletagmanager.com/gtag/js?id=G-1PXQ", "script", 200, 1, true),
  ].map((e) => [`${e.method} ${e.url}`, e]),
);
