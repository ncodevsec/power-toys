/**
 * Headers worth flagging for a pentest/bug-bounty audience, with what's
 * "good" to see present and what's informative when present.
 */
export const SECURITY_HEADERS = [
	{ key: "content-security-policy", label: "Content-Security-Policy", missingIsIssue: true, hint: "No CSP — reduces defense against XSS." },
	{ key: "strict-transport-security", label: "Strict-Transport-Security", missingIsIssue: true, hint: "No HSTS — connections can be downgraded to HTTP." },
	{ key: "x-frame-options", label: "X-Frame-Options", missingIsIssue: true, hint: "No clickjacking protection (also check CSP frame-ancestors)." },
	{ key: "x-content-type-options", label: "X-Content-Type-Options", missingIsIssue: true, hint: "No nosniff — browsers may MIME-sniff responses." },
	{ key: "referrer-policy", label: "Referrer-Policy", missingIsIssue: false, hint: "Not set — the default browser behavior applies." },
	{ key: "permissions-policy", label: "Permissions-Policy", missingIsIssue: false, hint: "Not set — no explicit restriction on browser features." },
	{ key: "set-cookie", label: "Set-Cookie", missingIsIssue: false, hint: "Check for Secure / HttpOnly / SameSite on the Cookies tab." },
	{ key: "server", label: "Server", missingIsIssue: false, hint: "Reveals server software/version — useful recon, not a vuln by itself." },
	{ key: "x-powered-by", label: "X-Powered-By", missingIsIssue: false, hint: "Reveals backend framework/version." },
	{ key: "access-control-allow-origin", label: "Access-Control-Allow-Origin", missingIsIssue: false, hint: "`*` or a reflected Origin on a credentialed endpoint is worth a closer look." },
];

/** Normalizes a fetch Response's headers (or a Headers/Map-like in tests)
 * into a plain lowercase-keyed object. */
function headersToObject(headers) {
	const out = {};
	if (!headers) return out;
	const entries = typeof headers.entries === "function" ? headers.entries() : headers;
	for (const [k, v] of entries) out[k.toLowerCase()] = v;
	return out;
}

export async function checkSecurityHeaders(url) {
	const res = await fetch(url, { method: "GET", credentials: "omit" });
	const all = headersToObject(res.headers);
	const rows = SECURITY_HEADERS.map((h) => ({ ...h, value: all[h.key] ?? null }));
	const extra = Object.entries(all).filter(([k]) => !SECURITY_HEADERS.some((h) => h.key === k));
	return { status: res.status, rows, extra };
}
