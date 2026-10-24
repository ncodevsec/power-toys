// Sitemap tracker. While tracking is on, records every request the browser
// makes for the tracked site (pages, scripts, stylesheets, XHR/fetch, images...)
// Burp-style, into storage.local. Requests the site makes to other domains
// are kept too and flagged `thirdParty`. State lives in memory while the
// worker is awake, is flushed on a short debounce, and is reloaded lazily
// because an MV3 service worker can be stopped and restarted at any time.
export const STATE_KEY = "sitemapState";
export const ENTRIES_KEY = "sitemapEntries";
const MAX_ENTRIES = 5000;
const FILTER = { urls: ["http://*/*", "https://*/*"] };

let tracking = null; // { domain, startedAt } | null
let entries = {}; // "METHOD url" -> entry
let size = 0;
let loaded = null;
let timer = null;

const getLocal = (api, keys) => new Promise((resolve) => api.storage.local.get(keys, (r) => resolve(r || {})));
const setLocal = (api, data) => new Promise((resolve) => api.storage.local.set(data, () => resolve()));

function syncBadge(api) {
	try {
		api.action.setBadgeText({ text: tracking ? "REC" : "" });
		if (tracking) api.action.setBadgeBackgroundColor({ color: "#dc2626" });
	} catch {}
}

const load = (api) =>
	(loaded ||= getLocal(api, [STATE_KEY, ENTRIES_KEY]).then((r) => {
		tracking = r[STATE_KEY] || null;
		entries = r[ENTRIES_KEY] || {};
		size = Object.keys(entries).length;
		syncBadge(api);
	}));

function flush(api, now = false) {
	clearTimeout(timer);
	const write = () => setLocal(api, { [ENTRIES_KEY]: entries });
	if (now) return write();
	timer = setTimeout(write, 400);
}

export async function startSitemap(api, domain) {
	if (!domain) return { ok: false, error: "No site to track" };
	await load(api);
	tracking = { domain, startedAt: Date.now() };
	await setLocal(api, { [STATE_KEY]: tracking });
	syncBadge(api);
	return { ok: true };
}

export async function stopSitemap(api) {
	await load(api);
	tracking = null;
	await setLocal(api, { [STATE_KEY]: null });
	await flush(api, true);
	syncBadge(api);
	return { ok: true };
}

export async function clearSitemap(api) {
	await load(api);
	entries = {};
	size = 0;
	await flush(api, true);
	return { ok: true };
}

const hostOf = (u) => {
	try {
		return new URL(u).hostname;
	} catch {
		return "";
	}
};
const inScope = (host, scope) => !!host && (host === scope || host.endsWith("." + scope));

export async function recordRequest(api, details, failed) {
	if (details.tabId < 0) return; // service-worker / extension-page traffic
	const source = details.initiator || details.documentUrl || details.originUrl || "";
	if (/^(chrome|moz)-extension:/.test(source)) return; // this tool's own probes (Paths, Headers)

	await load(api);
	if (!tracking) return;

	const scope = tracking.domain.replace(/^www\./, "");
	const own = inScope(hostOf(details.url), scope);
	if (!own && !inScope(hostOf(source), scope)) return;

	const key = `${details.method} ${details.url}`;
	const now = Date.now();
	const status = failed ? 0 : details.statusCode;
	const prev = entries[key];
	if (prev) {
		prev.count++;
		prev.lastSeen = now;
		prev.status = status;
	} else {
		if (size >= MAX_ENTRIES) return;
		entries[key] = { method: details.method, url: details.url, type: details.type, status, count: 1, firstSeen: now, lastSeen: now, thirdParty: !own };
		size++;
	}
	flush(api);
}

/** Registers the webRequest listeners (top level, so a restarted worker wakes for them). */
export function registerSitemap(api) {
	if (!api.webRequest) return;
	api.webRequest.onCompleted.addListener((d) => { recordRequest(api, d, false); }, FILTER);
	api.webRequest.onErrorOccurred.addListener((d) => { recordRequest(api, d, true); }, FILTER);
	load(api); // restores the REC badge after a worker restart
}
