/**
 * Installs a fake `chrome.*` surface backed by fixture data, so the real
 * popup App component can be mounted outside an actual extension for a
 * design/QA preview. Must run before the App/lib/browser.js module graph
 * is evaluated — see the note in src/app/lib/browser.js about lazy lookup.
 */
import defaultsJson from "../config/defaults.json";
import { FIXTURE_LINKS, FIXTURE_SECRETS, FIXTURE_COOKIES } from "./fixtures.js";

const store = {
	local: {
		// Pre-seeded so the "Context-menu window" preview shows real content
		// instead of the empty "waiting for selection" state.
		contextMenuData: { selectedText: "session_id=8f19a2c7-4b3e-4a91-9c2d-6e1f0a5b7d3c", method: "base64", operation: "encode" },
		// Pre-seeded so the "Full tab view" preview (which reads cached scan
		// results from storage instead of re-scanning a tab) shows the same
		// fixture data as the popup view, instead of an empty state.
		savedLinks: FIXTURE_LINKS,
		savedSecrets: FIXTURE_SECRETS,
	},
	sync: {},
};
let execCallIndex = 0;
let cookieStore = [...FIXTURE_COOKIES];

const normDomain = (d) => (d || "").replace(/^\./, "");
const domainMatches = (cookieDomain, filterDomain) => {
	const c = normDomain(cookieDomain), f = normDomain(filterDomain);
	return c === f || c.endsWith("." + f);
};

window.chrome = {
	runtime: {
		id: "preview",
		getManifest: () => ({ version: "0.6.0-preview" }),
		getURL: (p) => "/" + p,
		sendMessage: (msg, cb) => cb && cb({}),
		lastError: null,
	},
	storage: {
		local: {
			get: (keys, cb) => cb(Object.fromEntries(keys.map((k) => [k, store.local[k]]).filter(([, v]) => v !== undefined))),
			set: (data, cb) => { Object.assign(store.local, data); cb && cb(); },
		},
		sync: {
			get: (keys, cb) => cb(Object.fromEntries(keys.map((k) => [k, store.sync[k]]).filter(([, v]) => v !== undefined))),
			set: (data, cb) => { Object.assign(store.sync, data); cb && cb(); },
		},
	},
	tabs: {
		query: (q, cb) => cb([{ id: 1, url: "https://app.example.com/dashboard" }]),
		create: ({ url }) => window.open(url, "_blank"),
	},
	scripting: {
		executeScript: ({ func }, cb) => {
			// usePageData always fires the links collector before the secrets collector.
			const isLinks = execCallIndex++ % 2 === 0;
			setTimeout(() => cb([{ result: isLinks ? FIXTURE_LINKS : FIXTURE_SECRETS }]), 350); // simulate scan latency
		},
	},
	windows: { create: () => {} },
	// Backed by a real mutable in-memory array so add/edit/delete/import/export
	// in the Cookies tab preview actually work, not just render static data.
	cookies: {
		getAll: ({ domain } = {}, cb) => cb(cookieStore.filter((c) => !domain || domainMatches(c.domain, domain))),
		set: (details, cb) => {
			let host = "";
			try { host = new URL(details.url).hostname; } catch { return cb(null); }
			const domain = details.domain || host;
			const path = details.path || "/";
			const next = {
				name: details.name,
				value: details.value ?? "",
				domain,
				path,
				secure: !!details.secure,
				httpOnly: !!details.httpOnly,
				sameSite: details.sameSite || "lax",
				...(details.expirationDate ? { expirationDate: details.expirationDate } : {}),
			};
			cookieStore = cookieStore.filter((c) => !(c.name === next.name && c.domain === next.domain && c.path === next.path));
			cookieStore.push(next);
			cb(next);
		},
		remove: (details, cb) => {
			let host = "";
			try { host = new URL(details.url).hostname; } catch {}
			cookieStore = cookieStore.filter((c) => !(c.name === details.name && domainMatches(c.domain, host)));
			cb({ name: details.name, url: details.url });
		},
	},
};

const realFetch = window.fetch?.bind(window);
window.fetch = async (url, ...rest) => {
	if (String(url).includes("config/defaults.json")) return { json: async () => defaultsJson };
	return realFetch ? realFetch(url, ...rest) : new Response("{}");
};
