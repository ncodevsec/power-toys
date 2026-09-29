/**
 * Installs a fake `chrome.*` surface backed by fixture data, so the real
 * popup App component can be mounted outside an actual extension for a
 * design/QA preview. Must run before the App/lib/browser.js module graph
 * is evaluated — see the note in src/app/lib/browser.js about lazy lookup.
 */
import defaultsJson from "../config/defaults.json";
import { FIXTURE_LINKS, FIXTURE_SECRETS } from "./fixtures.js";

const store = {
	local: {
		// Pre-seeded so the "Context-menu window" preview shows real content
		// instead of the empty "waiting for selection" state.
		contextMenuData: { selectedText: "session_id=8f19a2c7-4b3e-4a91-9c2d-6e1f0a5b7d3c", method: "base64", operation: "encode" },
	},
	sync: {},
};
let execCallIndex = 0;

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
};

const realFetch = window.fetch?.bind(window);
window.fetch = async (url, ...rest) => {
	if (String(url).includes("config/defaults.json")) return { json: async () => defaultsJson };
	return realFetch ? realFetch(url, ...rest) : new Response("{}");
};
