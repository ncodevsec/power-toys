// Background script for context menu and message handling
// Firefox & Chrome compatible
"use strict";

// API Compatibility: Use 'chrome' API everywhere (works in both browsers)
const api =
	typeof chrome !== "undefined"
		? chrome
		: typeof browser !== "undefined"
			? browser
			: null;

if (!api) {
	console.error("Extension API not available");
}

let contextMenuData = {};

// ─── Link collection — injected into page via executeScript ───────────────────
function collectAllLinksInPage() {
	const uniqueLinks = new Map();
	const IMG_RE = /\.(jpeg|jpg|gif|png|svg|webp|ico)$/i;
	const EXT_RE = /\.[a-zA-Z0-9]+$/;
	const selectors =
		"a[href],link[href],script[src],img[src],iframe[src],source[src],video[src],audio[src],[data-url]";

	for (const tag of document.querySelectorAll(selectors)) {
		const url = tag.href || tag.src || tag.getAttribute("data-url");
		if (!url?.startsWith("http") || uniqueLinks.has(url)) continue;

		const cleanUrl = url.split("?")[0].split("#")[0];
		let category;
		if (cleanUrl.endsWith(".js")) category = "JavaScript";
		else if (cleanUrl.endsWith(".json")) category = "JSON";
		else if (IMG_RE.test(cleanUrl)) category = "Images";
		else if (EXT_RE.test(cleanUrl)) category = "Others";
		else category = "Paths";

		try {
			const { hostname, pathname, search, hash } = new URL(url);
			uniqueLinks.set(url, {
				fullUrl: url,
				category,
				domain: hostname,
				path: pathname + search + hash || "/",
			});
		} catch {}
	}
	return [...uniqueLinks.values()];
}

// ─── Minimal secrets collection — injected into page via executeScript ────────
function collectSecretsMinimal() {
	const secrets = {
		apiKeys: [],
		credentials: [],
		endpoints: [],
		paths: [],
		comments: [],
		hiddenLinks: [],
	};

	const secretPatterns = {
		apiKeys: [
			/(?:api[_-]?key|apikey|api_secret|apiSecret|access[_-]?key|accessKey|secret[_-]?key|secretKey)\s*[:=]\s*['"`]([a-zA-Z0-9\-_.]{8,})[`'"]/gi,
			/(?:authorization|bearer|x-api-key|x-access-token)\s*[:=]\s*['"`]([a-zA-Z0-9\-_.]{8,})[`'"]/gi,
			/(?:token|auth_?token|access_?token|refresh_?token)\s*[:=]\s*['"`]([a-zA-Z0-9\-_.]{8,})[`'"]/gi,
		],
		credentials: [
			/(?:username|user|login)\s*[:=]\s*['"`]([^'"`\s]+)[`'"]/gi,
			/(?:password|passwd|pwd|pass)\s*[:=]\s*['"`]([^'"`\s]+)[`'"]/gi,
			/(?:email)\s*[:=]\s*['"`]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[`'"]/gi,
		],
		endpoints: [
			/(?:endpoint|url|base_?url|api_?url|server)\s*[:=]\s*['"`](https?:\/\/[^\s'"`]+)[`'"]/gi,
			/(?:host|hostname|domain)\s*[:=]\s*['"`]([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?)[`'"]/gi,
		],
		paths: [
			/\/[a-zA-Z0-9_\-.\/]*(?:admin|api|internal|private|secret|debug|backup|upload|download|webhook|callback)[a-zA-Z0-9_\-.\/]*/gi,
			/\/[a-zA-Z0-9_\-.\/]*(?:\.git|\.env|\.config|backup|\.sql|\.db|\.jar)[a-zA-Z0-9_\-.\/]*/gi,
		],
	};

	// Collect all href and src URLs from anchor tags to exclude them from secrets
	const linksFromTags = new Set();
	const selectors =
		"a[href],link[href],script[src],img[src],iframe[src],source[src],video[src],audio[src],[data-url]";
	for (const tag of document.querySelectorAll(selectors)) {
		const url = tag.href || tag.src || tag.getAttribute("data-url");
		if (url) linksFromTags.add(url.split("?")[0].split("#")[0]);
	}

	// Scan HTML comments
	const walker = document.createTreeWalker(
		document.documentElement,
		NodeFilter.SHOW_COMMENT,
		null,
	);
	let comment;
	while ((comment = walker.nextNode())) {
		const text = comment.textContent || comment.nodeValue || "";
		if (!text || text.length === 0) continue;

		const urls = text.match(/https?:\/\/[^\s<>"'`\)]+/g) || [];
		urls.forEach((url) => {
			if (!secrets.hiddenLinks.find((l) => l.value === url)) {
				secrets.hiddenLinks.push({
					type: "Hidden URL",
					value: url,
					source: "HTML Comment",
				});
			}
		});

		// Collect paths from comments (excluding HTML tags like textarea, xmp, etc.)
		const paths = text.match(/\/[^\s<>"'`\)]*[\w\-]/g) || [];
		const htmlTags = [
			"textarea",
			"xmp",
			"script",
			"style",
			"pre",
			"code",
			"title",
			"body",
			"head",
			"html",
			"div",
			"span",
			"p",
			"a",
			"form",
		];
		paths.forEach((path) => {
			// Skip if path is just an HTML tag name like /textarea, /xmp, /script, etc.
			const pathName = path.substring(1).toLowerCase(); // Remove leading /
			if (htmlTags.includes(pathName)) return;
			if (
				path.length > 2 &&
				!secrets.hiddenLinks.find((l) => l.value === path)
			) {
				secrets.hiddenLinks.push({
					type: "Hidden Path",
					value: path,
					source: "HTML Comment",
				});
			}
		});

		secrets.comments.push({
			type: "HTML Comment",
			content: `<!-- ${text} -->`,
			source: "Page Source",
			sourceUrl: window.location.href,
		});
	}

	// Extract JS and CSS code only to scan for secrets
	let jsCode = "";
	let cssCode = "";

	for (const script of document.querySelectorAll("script:not([src])")) {
		jsCode += "\n" + (script.textContent || "");
	}

	for (const style of document.querySelectorAll("style")) {
		cssCode += "\n" + (style.textContent || "");
	}

	const searchCode = jsCode + cssCode;

	// Scan JS/CSS code for patterns
	Object.entries(secretPatterns).forEach(([category, patterns]) => {
		patterns.forEach((pattern) => {
			let match;
			while ((match = pattern.exec(searchCode)) !== null) {
				let value = match[1] || match[0];
				// Fix protocol-relative URLs (// instead of https://)
				if (value?.startsWith("//")) {
					value = "https:" + value;
				}
				if (category === "apiKeys") {
					if (!secrets.apiKeys.find((x) => x.value === value))
						secrets.apiKeys.push({ type: "API Key", value });
				} else if (category === "credentials") {
					if (!secrets.credentials.find((x) => x.value === value))
						secrets.credentials.push({ type: "Credential", value });
				} else if (category === "endpoints") {
					// Skip if this endpoint is already in the links tab
					if (
						!linksFromTags.has(value?.split("?")[0].split("#")[0])
					) {
						if (!secrets.endpoints.find((x) => x.value === value))
							secrets.endpoints.push({ type: "Endpoint", value });
					}
				} else if (category === "paths") {
					// Skip if this path is already in the links tab
					if (!linksFromTags.has(value)) {
						if (!secrets.paths.find((x) => x.value === value))
							secrets.paths.push({ type: "Path", value });
					}
				}
			}
		});
	});

	return secrets;
}

// ─── Context menu definitions ─────────────────────────────────────────────────
const ENCODING_METHODS = [
	{
		id: "encode-base64",
		title: "Base64 Encode",
		method: "base64",
		op: "encode",
	},
	{
		id: "decode-base64",
		title: "Base64 Decode",
		method: "base64",
		op: "decode",
	},
	{ id: "encode-url", title: "URL Encode", method: "url", op: "encode" },
	{ id: "decode-url", title: "URL Decode", method: "url", op: "decode" },
	{
		id: "encode-html",
		title: "HTML Entity Encode",
		method: "html",
		op: "encode",
	},
	{
		id: "decode-html",
		title: "HTML Entity Decode",
		method: "html",
		op: "decode",
	},
	{ id: "encode-hex", title: "Hex Encode", method: "hex", op: "encode" },
	{ id: "decode-hex", title: "Hex Decode", method: "hex", op: "decode" },
	{
		id: "encode-unicode",
		title: "Unicode Encode",
		method: "unicode",
		op: "encode",
	},
	{
		id: "decode-unicode",
		title: "Unicode Decode",
		method: "unicode",
		op: "decode",
	},
];

const METHOD_MAP = Object.fromEntries(
	ENCODING_METHODS.map((m) => [m.id, { method: m.method, op: m.op }]),
);

function createContextMenus() {
	api.contextMenus.removeAll(() => {
		api.contextMenus.create({
			id: "power-toys-main",
			title: "Power Toys",
			contexts: ["page", "selection", "link", "image"],
		});

		api.contextMenus.create({
			id: "encode-decode-parent",
			title: "Encode/Decode",
			parentId: "power-toys-main",
			contexts: ["selection"],
		});

		for (const item of ENCODING_METHODS) {
			api.contextMenus.create({
				id: item.id,
				title: item.title,
				parentId: "encode-decode-parent",
				contexts: ["selection"],
			});
		}
	});
}

// ─── Install handler ──────────────────────────────────────────────────────────
api.runtime.onInstalled.addListener(() => {
	api.storage.sync.get(["sensitivePatterns"], (result) => {
		if (!result || !result.sensitivePatterns) {
			fetch(api.runtime.getURL("config/defaults.json"))
				.then((r) => r.json())
				.then((defaults) => {
					api.storage.sync.set({ sensitivePatterns: defaults });
					api.storage.local.set({ sensitivePatterns: defaults });
				})
				.catch(() => {
					const empty = { params: [], urlPatterns: [] };
					api.storage.sync.set({ sensitivePatterns: empty });
					api.storage.local.set({ sensitivePatterns: empty });
				});
		}
	});
	createContextMenus();
});

// ─── Context menu click handler ───────────────────────────────────────────────
api.contextMenus.onClicked.addListener(async (info, tab) => {
	const { menuItemId, selectionText } = info;

	if (menuItemId === "power-toys-main") {
		// Validate tab URL before parsing
		let domain = "";
		try {
			domain = new URL(tab.url).hostname;
		} catch {
			return;
		}

		// Run both collections in parallel, then open the tab
		const [linksResult, secretsResult] = await Promise.allSettled([
			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: collectAllLinksInPage,
			}),
			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: collectSecretsMinimal,
			}),
		]);

		const links =
			linksResult.status === "fulfilled"
				? (linksResult.value?.[0]?.result ?? [])
				: [];
		const secrets =
			secretsResult.status === "fulfilled"
				? (secretsResult.value?.[0]?.result ?? {
						apiKeys: [],
						credentials: [],
						endpoints: [],
						paths: [],
						comments: [],
						hiddenLinks: [],
					})
				: {
						apiKeys: [],
						credentials: [],
						endpoints: [],
						paths: [],
						comments: [],
						hiddenLinks: [],
					};

		await api.storage.local.set({
			savedLinks: links,
			savedSecrets: secrets,
		});

		api.tabs.create({
			url: api.runtime.getURL(
				`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`,
			),
		});
		return;
	}

	const methodData = METHOD_MAP[menuItemId];
	if (methodData && selectionText) {
		contextMenuData = {
			selectedText: selectionText,
			method: methodData.method,
			operation: methodData.op,
		};
		// Firefox: Create a popup window without explicit positioning
		// Firefox doesn't support system.display API, so we'll use a simpler approach
		const popupUrl = api.runtime.getURL("src/pages/context-popup.html");

		// Try to use api.windows if available (Chrome), fall back to tab creation (Firefox)
		if (api.windows && api.windows.create) {
			try {
				api.windows.create({
					url: popupUrl,
					type: "popup",
					width: 500,
					height: 500,
				});
			} catch (e) {
				// Fallback for Firefox: create a tab instead
				api.tabs.create({ url: popupUrl });
			}
		} else {
			// Firefox fallback: create a new tab
			api.tabs.create({ url: popupUrl });
		}
	}
});

// ─── Message handler — validate sender origin ─────────────────────────────────
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// Only respond to messages from our own extension pages
	// Firefox uses moz-extension:// and Chrome uses chrome-extension://
	const extensionOrigin = sender.origin;
	const isOwnExtension =
		extensionOrigin &&
		(extensionOrigin.includes("chrome-extension://") ||
			extensionOrigin.includes("moz-extension://"));
	if (!isOwnExtension) {
		return false;
	}
	if (request?.action === "getContextData") {
		sendResponse(contextMenuData);
	}
	return false;
});
