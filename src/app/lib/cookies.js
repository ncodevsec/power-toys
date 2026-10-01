/**
 * chrome.cookies.set() needs a `url`, not just a domain — it derives the
 * cookie's effective host/scheme from it. Building the url directly from
 * the cookie's own domain/path/secure fields keeps them always consistent
 * with each other (no way to end up with a url that disagrees with the
 * domain you typed).
 */
export function cookieUrl(cookie) {
	const host = (cookie.domain || "").replace(/^\./, "");
	const path = cookie.path || "/";
	return `${cookie.secure ? "https" : "http"}://${host}${path}`;
}

export function emptyCookie(domain) {
	return {
		name: "",
		value: "",
		domain: domain || "",
		path: "/",
		secure: false,
		httpOnly: false,
		sameSite: "lax",
		expirationDate: undefined, // undefined/absent = session cookie
	};
}

/** chrome.cookies expirationDate is Unix seconds; absent means "session". */
export function formatExpiry(cookie) {
	if (!cookie.expirationDate) return "Session";
	return new Date(cookie.expirationDate * 1000).toLocaleString();
}

export function toDatetimeLocal(expirationDateSeconds) {
	if (!expirationDateSeconds) return "";
	const d = new Date(expirationDateSeconds * 1000);
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value) {
	if (!value) return undefined;
	const ms = new Date(value).getTime();
	return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

export function sameCookieIdentity(a, b) {
	return a.name === b.name && a.domain === b.domain && a.path === b.path;
}
