"use strict";

// ─── State ────────────────────────────────────────────────────────────────────
let allLinksGlobal = [];
let allSecretsGlobal = {
	apiKeys: [],
	credentials: [],
	endpoints: [],
	paths: [],
	comments: [],
	hiddenLinks: [],
};
let currentCategory = "All";
let currentSecretsCategory = "all";
let currentSearchQuery = "";
let currentSecretsSearchQuery = "";
let showOnlySensitiveLinks = false;
let showOnlySensitiveSecrets = false;
let showOnlySensitiveParams = false;
let cachedDomain = "";
let currentFileType = null; // null means "All" for Files category
let SENSITIVE_PATTERNS = { params: [], urlPatterns: [] };
let DEFAULT_PATTERNS_RAW = { params: [], urlPatterns: [] };

// Predefined order of file types
const FILE_TYPE_ORDER = [
	"js",
	"json",
	"php",
	"css",
	"html",
	"xml",
	"yaml",
	"yml",
	"csv",
	"svg",
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"ico",
	"pdf",
	"zip",
	"tar",
	"gz",
	"txt",
	"md",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
];

// ─── Encoding functions (single source of truth) ──────────────────────────────
const encodingFunctions = {
	base64: {
		encode: (t) => btoa(unescape(encodeURIComponent(t))),
		decode: (t) => decodeURIComponent(escape(atob(t))),
	},
	url: { encode: encodeURIComponent, decode: decodeURIComponent },
	html: {
		encode: (t) => {
			const d = document.createElement("div");
			d.textContent = t;
			return d.innerHTML;
		},
		decode: (t) => {
			const d = document.createElement("div");
			d.innerHTML = t;
			return d.textContent || d.innerText || "";
		},
	},
	hex: {
		encode: (t) =>
			Array.from(t, (c) =>
				c.charCodeAt(0).toString(16).padStart(2, "0"),
			).join(""),
		decode: (t) => {
			const s = t.replace(/\s/g, "");
			let r = "";
			for (let i = 0; i < s.length; i += 2)
				r += String.fromCharCode(parseInt(s.substr(i, 2), 16));
			return r;
		},
	},
	unicode: {
		encode: (t) =>
			Array.from(
				t,
				(c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
			).join(""),
		decode: (t) =>
			t.replace(/\\u([0-9a-fA-F]{4})/g, (_, c) =>
				String.fromCharCode(parseInt(c, 16)),
			),
	},
};

// ─── Safe text helper — escapes for use in textContent, not innerHTML ─────────
function escapeHtml(str) {
	const d = document.createElement("div");
	d.textContent = str;
	return d.innerHTML;
}

// ─── DOM Helper — reduce redundant createElement calls ────────────────────────
function createElement(tag, className = "", textContent = "", attributes = {}) {
	const el = document.createElement(tag);
	if (className) el.className = className;
	if (textContent) el.textContent = textContent;
	Object.entries(attributes).forEach(([key, val]) =>
		el.setAttribute(key, val),
	);
	return el;
}

// ─── Count and truncate lines helpers ──────────────────────────────────────────
function countLines(text) {
	if (!text) return 0;
	return text.split("\n").length;
}

function truncateToLines(text, maxLines) {
	if (!text) return text;
	const lines = text.split("\n");
	if (lines.length <= maxLines) return text;
	return lines.slice(0, maxLines).join("\n");
}

function openModal(title, content) {
	const modal = document.getElementById("itemModal");
	const modalTitle = document.getElementById("modalTitle");
	const modalContent = document.getElementById("modalContent");

	modalTitle.textContent = title;
	modalContent.textContent = content;
	modal.classList.remove("hidden");
}

function closeModal() {
	const modal = document.getElementById("itemModal");
	modal.classList.add("hidden");
}

// ─── Toast notification — replaces alert() calls ─────────────────────────────
function showToast(message, type = "info") {
	let toast = document.getElementById("pt-toast");
	if (!toast) {
		toast = document.createElement("div");
		toast.id = "pt-toast";
		toast.style.cssText =
			"position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:8px;font-size:0.8rem;font-weight:600;z-index:9999;opacity:0;transition:opacity 0.2s ease;pointer-events:none;max-width:260px;";
		document.body.appendChild(toast);
	}
	const colors = { info: "#3b82f6", error: "#ef4444", success: "#10b981" };
	toast.style.backgroundColor = colors[type] || colors.info;
	toast.style.color = "#fff";
	toast.textContent = message;
	toast.style.opacity = "1";
	clearTimeout(toast._timer);
	toast._timer = setTimeout(() => {
		toast.style.opacity = "0";
	}, 2500);
}

// ─── Pattern utilities ────────────────────────────────────────────────────────
function parseUrlPatterns(rawPatterns = []) {
	return rawPatterns
		.map((p) => {
			const m = p.match(/^\/(.*)\/([igm]*)$/);
			try {
				return m ? new RegExp(m[1], m[2]) : new RegExp(p);
			} catch {
				return null;
			}
		})
		.filter(Boolean);
}

function applyPatterns(patterns) {
	if (patterns.params) SENSITIVE_PATTERNS.params = patterns.params;
	if (patterns.urlPatterns)
		SENSITIVE_PATTERNS.urlPatterns = parseUrlPatterns(patterns.urlPatterns);
}

async function loadPatterns() {
	try {
		const res = await fetch(
			window.getBrowserAPI().runtime.getURL("config/defaults.json"),
		);
		const defaults = await res.json();
		DEFAULT_PATTERNS_RAW = {
			params: defaults.params || [],
			urlPatterns: defaults.urlPatterns || [],
		};
		SENSITIVE_PATTERNS.params = defaults.params || [];
		SENSITIVE_PATTERNS.urlPatterns = parseUrlPatterns(defaults.urlPatterns);
	} catch {}

	await new Promise((resolve) => {
		window
			.getBrowserAPI()
			.storage.sync.get(["sensitivePatterns"], (result) => {
				if (result.sensitivePatterns) {
					applyPatterns(result.sensitivePatterns);
					return resolve();
				}
				window
					.getBrowserAPI()
					.storage.local.get(["sensitivePatterns"], (local) => {
						if (local.sensitivePatterns)
							applyPatterns(local.sensitivePatterns);
						resolve();
					});
			});
	});
}

// ─── Link collection (injected into page) ────────────────────────────────────
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
		const EXT_RE = /\.[a-zA-Z0-9]+$/;
		if (EXT_RE.test(cleanUrl)) category = "Files";
		else if (
			cleanUrl.endsWith("/") ||
			cleanUrl.split("/").pop().indexOf(".") === -1
		)
			category = "Paths";
		else category = "Others";

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

// ─── Secrets collection (injected into page) ──────────────────────────────────
function collectSecretsFromPage() {
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
			/\/[a-zA-Z0-9_\-./]*(?:admin|api|internal|private|secret|debug|backup|upload|download|webhook|callback)[a-zA-Z0-9_\-./]*/gi,
			/\/[a-zA-Z0-9_\-./]*(?:\.git|\.env|\.config|backup|\.sql|\.db|\.jar)[a-zA-Z0-9_\-./]*/gi,
		],
	};

	const VENDOR_RE =
		/grammarly|live-server|chrome-extension|injected|hb-blur|sessionStorage|Service Worker/i;

	// Collect all href and src URLs from anchor tags to exclude them from secrets
	const linksFromTags = new Set();
	const selectors =
		"a[href],link[href],script[src],img[src],iframe[src],source[src],video[src],audio[src],[data-url]";
	for (const tag of document.querySelectorAll(selectors)) {
		const url = tag.href || tag.src || tag.getAttribute("data-url");
		if (url) linksFromTags.add(url.split("?")[0].split("#")[0]);
	}

	// Scan HTML comments for hidden links and paths from COMMENTS ONLY
	const walker = document.createTreeWalker(
		document.documentElement,
		NodeFilter.SHOW_COMMENT,
		null,
	);
	let comment;
	while ((comment = walker.nextNode())) {
		const text = comment.textContent || comment.nodeValue || "";
		if (!text) continue;

		// Only collect href references from comments (not in main page tags)
		const hrefRe = /href\s*=\s*['"]*([\S'">\]]+)/gi;
		let hm;
		while ((hm = hrefRe.exec(text)) !== null) {
			const val = hm[1]?.replace(/['"]/g, "").trim();
			if (val && !secrets.hiddenLinks.find((l) => l.value === val))
				secrets.hiddenLinks.push({
					type: "Hidden Link",
					value: val,
					source: "HTML Comment",
					context: text.substring(0, 100),
				});
		}

		// Collect protocol-relative URLs first (starting with //)
		const protocolRelativeUrls =
			text.match(/\/\/[a-zA-Z0-9\-_.]+[^\s<>"'`\)]*[\w\/]/g) || [];
		protocolRelativeUrls.forEach((url) => {
			if (!secrets.hiddenLinks.find((l) => l.value === url))
				secrets.hiddenLinks.push({
					type: "Hidden URL",
					value: url,
					source: "HTML Comment",
					context: text.substring(0, 100),
				});
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
			// Skip if path looks like a protocol-relative URL (contains //)
			if (path.includes("//")) return;
			// Skip if path is just an HTML tag name like /textarea, /xmp, /script, etc.
			const pathName = path.substring(1).toLowerCase(); // Remove leading /
			if (htmlTags.includes(pathName)) return;
			if (
				path.length > 2 &&
				!secrets.hiddenLinks.find((l) => l.value === path)
			)
				secrets.hiddenLinks.push({
					type: "Hidden Path",
					value: path,
					source: "HTML Comment",
					context: text.substring(0, 100),
				});
		});

		// Collect URLs from comments
		const urls = text.match(/https?:\/\/[^\s<>"'`\)]+/g) || [];
		urls.forEach((url) => {
			if (!secrets.hiddenLinks.find((l) => l.value === url))
				secrets.hiddenLinks.push({
					type: "Hidden URL",
					value: url,
					source: "HTML Comment",
					context: text.substring(0, 100),
				});
		});

		// Collect suspicious links from comments
		const suspiciousLinks = text.match(
			/['"](\/[^\s'"]*(?:debug|admin|api|internal|private|secret|backup)[^\s'"]*)["']/gi,
		);
		if (suspiciousLinks) {
			suspiciousLinks.forEach((m) => {
				const val = m.replace(/['"]/g, "");
				if (!secrets.hiddenLinks.find((l) => l.value === val))
					secrets.hiddenLinks.push({
						type: "Hidden Link",
						value: val,
						source: "HTML Comment",
						context: text.substring(0, 100),
					});
			});
		}

		secrets.comments.push({
			type: "HTML Comment",
			content: `<!-- ${text} -->`,
			source: "Page Source",
			sourceUrl: window.location.href,
			sourceText: text,
		});
	}

	// Extract JS and CSS code only (not full HTML) to avoid scanning href attributes
	let jsCode = "";
	let cssCode = "";

	// Collect inline scripts
	for (const script of document.querySelectorAll("script:not([src])")) {
		jsCode += "\n" + (script.textContent || "");
	}

	// Collect inline styles
	for (const style of document.querySelectorAll("style")) {
		cssCode += "\n" + (style.textContent || "");
	}

	// Search for API keys in JS and CSS code only
	for (const pattern of secretPatterns.apiKeys) {
		let match;
		while ((match = pattern.exec(jsCode + cssCode))) {
			if (VENDOR_RE.test(match[0])) continue;
			secrets.apiKeys.push({
				type: "API Key",
				pattern: match[0].substring(0, 100),
				value: match[1]?.substring(0, 100),
				source: "JS/CSS Code",
			});
		}
	}

	// Search for credentials in JS and CSS code only
	for (const pattern of secretPatterns.credentials) {
		let match;
		while ((match = pattern.exec(jsCode + cssCode))) {
			if (VENDOR_RE.test(match[0])) continue;
			secrets.credentials.push({
				type: "Credential",
				pattern: match[0].substring(0, 100),
				value: match[1]?.substring(0, 100),
				source: "JS/CSS Code",
			});
		}
	}

	// Search for endpoints in JS and CSS code only (exclude those from links tab)
	for (const pattern of secretPatterns.endpoints) {
		let match;
		while ((match = pattern.exec(jsCode + cssCode))) {
			if (VENDOR_RE.test(match[0])) continue;
			let endpoint = match[1];
			let displayEndpoint = endpoint; // Keep original for display
			// Fix protocol-relative URLs (// instead of https://)
			if (endpoint?.startsWith("//")) {
				endpoint = "https:" + endpoint; // For link functionality
				displayEndpoint = match[1]; // Keep original for display
			}
			// Skip if this endpoint is already in the links tab
			if (!linksFromTags.has(endpoint?.split("?")[0].split("#")[0])) {
				if (!secrets.endpoints.find((e) => e.value === displayEndpoint))
					secrets.endpoints.push({
						type: "Endpoint",
						value: displayEndpoint?.substring(0, 150),
						source: "JS/CSS Code",
						fullUrl: endpoint, // Store full URL separately for clicking
					});
			}
		}
	}

	// Search for paths in JS and CSS code only (exclude those from links tab)
	for (const pattern of secretPatterns.paths) {
		let match;
		while ((match = pattern.exec(jsCode + cssCode))) {
			let path = match[0];
			if (VENDOR_RE.test(path)) continue;

			// Skip if it's a full URL (starts with http:// or https://)
			if (path.startsWith("http://") || path.startsWith("https://")) {
				// This is actually a full URL/endpoint, skip it from paths
				continue;
			}

			// Convert protocol-relative URLs to HTTPS
			let displayPath = path;
			if (path.startsWith("//")) {
				const fullPath = "https:" + path;
				// Add to endpoints instead of paths if it's a full URL now
				if (!linksFromTags.has(fullPath)) {
					if (!secrets.endpoints.find((e) => e.value === path))
						secrets.endpoints.push({
							type: "Endpoint",
							value: path,
							source: "JS/CSS Code",
							fullUrl: fullPath,
						});
				}
				continue;
			}

			// Only add relative paths (starting with /)
			if (!linksFromTags.has(path)) {
				if (!secrets.paths.find((p) => p.value === path))
					secrets.paths.push({
						type: "Path",
						value: path,
						source: "JS/CSS Code",
					});
			}
		}
	}

	// Scan inline scripts for comments, API keys, credentials, endpoints, and paths
	for (const script of document.querySelectorAll("script:not([src])")) {
		const code = script.textContent;
		if (!code) continue;

		// Collect comments from scripts
		const singleLineComments = code.match(/(?<!:)\/\/.*$/gm) || [];
		singleLineComments.forEach((c) => {
			const cleaned = c.replace(/^\/\/\s*/, "").trim();
			// Skip CDATA markers, URL protocol markers (://), and lines that are just paths
			// Don't filter if it looks like a real comment (has words/context)
			const isJustUrl = /^https?:\/\/|^\/\//.test(cleaned);
			if (
				cleaned &&
				!cleaned.match(/^<!\[CDATA\[|^\]\]>/) &&
				!isJustUrl
			) {
				secrets.comments.push({
					type: "JavaScript Comment",
					content: `// ${cleaned}`,
					source: "Script",
					sourceUrl: window.location.href,
					sourceText: cleaned,
				});
			}
		});

		const multiLineComments = code.match(/\/\*[\s\S]*?\*\//g) || [];
		multiLineComments.forEach((c) => {
			const cleaned = c
				.replace(/^\/\*\s*/, "")
				.replace(/\s*\*\/$/, "")
				.trim();
			if (cleaned)
				secrets.comments.push({
					type: "JavaScript Comment",
					content: `/* ${cleaned} */`,
					source: "Script",
					sourceUrl: window.location.href,
					sourceText: cleaned,
				});
		});

		// Note: API Keys and credentials are already scanned in jsCode above
	}

	// CSS comment scanning and endpoints/paths
	for (const style of document.querySelectorAll("style")) {
		const css = style.textContent;
		if (!css) continue;

		// Collect comments from styles
		const cssComments = css.match(/\/\*[\s\S]*?\*\//g) || [];
		cssComments.forEach((c) => {
			const cleaned = c
				.replace(/^\/\*\s*/, "")
				.replace(/\s*\*\/$/, "")
				.trim();
			if (cleaned)
				secrets.comments.push({
					type: "CSS Comment",
					content: `/* ${cleaned} */`,
					source: "Style",
					sourceUrl: window.location.href,
					sourceText: cleaned,
				});
		});
	}

	// Inline styles
	for (const style of document.querySelectorAll("style")) {
		const css = style.textContent;
		const cssComments = css.match(/\/\*[\s\S]*?\*\//g) || [];
		cssComments.forEach((c) => {
			const cleaned = c
				.replace(/^\/\*\s*/, "")
				.replace(/\s*\*\/$/, "")
				.trim();
			if (cleaned)
				secrets.comments.push({
					type: "CSS Comment",
					content: `/* ${cleaned} */`,
					source: "Style",
					sourceUrl: window.location.href,
					sourceText: cleaned,
				});
		});
		const suspiciousMatches = css.match(
			/(?:url\(|@import)['"`(]([^'"`)+]+)['"`+)]/gi,
		);
		if (suspiciousMatches)
			suspiciousMatches.forEach((match) => {
				// Skip data URLs (not actual secrets)
				if (match.includes("data:")) return;

				if (!secrets.endpoints.find((s) => s.value === match))
					secrets.endpoints.push({
						type: "Resource (CSS)",
						value: match.substring(0, 150),
						source: "CSS",
					});
			});
	}

	// Sensitive data attributes
	for (const el of document.querySelectorAll(
		"[data-api],[data-key],[data-token],[data-secret],[data-password],[data-auth]",
	)) {
		for (const attr of el.attributes) {
			if (
				attr.name.startsWith("data-") &&
				/(?:api|key|token|secret|password|auth)/.test(attr.name)
			) {
				const value = attr.value;
				if (value.length > 0 && value.length < 500)
					secrets.apiKeys.push({
						type: "Data Attribute",
						pattern: `${attr.name}="${value.substring(0, 100)}"`,
						source: "HTML Attributes",
					});
			}
		}
	}

	// Deduplicate
	Object.keys(secrets).forEach((key) => {
		secrets[key] = secrets[key].filter(
			(item, index, arr) =>
				index ===
				arr.findIndex(
					(t) => JSON.stringify(t) === JSON.stringify(item),
				),
		);
	});

	return secrets;
}

// ─── Sensitivity helpers ──────────────────────────────────────────────────────
function isSensitiveLink(url) {
	try {
		const { pathname, search, searchParams } = new URL(url);
		const path = pathname + search;
		const urlPatternMatch = SENSITIVE_PATTERNS.urlPatterns.some((p) =>
			p.test(path),
		);
		const paramMatch = SENSITIVE_PATTERNS.params.some((p) =>
			searchParams.has(p),
		);
		const result = urlPatternMatch || paramMatch;
		return result;
	} catch {
		return false;
	}
}

function isSensitiveParam(name) {
	const lower = name.toLowerCase();
	return SENSITIVE_PATTERNS.params.some(
		(p) => lower.includes(p) || p.includes(lower),
	);
}

function isSensitiveSecret(item) {
	const value = item.pattern || item.value || item.content || "";
	const lower = value.toLowerCase();
	const result =
		SENSITIVE_PATTERNS.urlPatterns.some((p) => p.test(value)) ||
		SENSITIVE_PATTERNS.params.some(
			(p) => lower.includes(p) || p.includes(lower),
		);
	return result;
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
	const select = document.getElementById("themeSelect");
	const apply = (theme) => {
		const dark =
			theme === "dark" ||
			(theme === "system" &&
				matchMedia("(prefers-color-scheme: dark)").matches);
		document.documentElement.classList.toggle("dark", dark);
	};
	select.addEventListener("change", (e) => {
		apply(e.target.value);
		localStorage.setItem("theme", e.target.value);
	});
	const saved = localStorage.getItem("theme") || "system";
	select.value = saved;
	apply(saved);
}

// ─── Tab switching ────────────────────────────────────────────────────────────
document.getElementById("topLevelTabBar").addEventListener("click", (e) => {
	const topLevel = e.target.dataset.toplevel;
	if (!topLevel) return;
	document
		.querySelectorAll("#topLevelTabBar .top-level-tab")
		.forEach((el) => el.classList.remove("tab-active"));
	e.target.classList.add("tab-active");
	document
		.querySelectorAll(".section-content")
		.forEach((el) => el.classList.add("hidden"));
	document.getElementById(`${topLevel}-section`)?.classList.remove("hidden");
	if (topLevel === "secrets") setTimeout(() => renderSecrets(), 50);
	if (topLevel === "params") setTimeout(() => renderParams(), 50);
});

document.addEventListener("click", (e) => {
	const tab = e.target.closest(".settings-tab");
	if (!tab?.dataset.settingsTab) return;
	document
		.querySelectorAll(".settings-tab")
		.forEach((t) => t.classList.remove("active"));
	document
		.querySelectorAll(".settings-tab-content")
		.forEach((c) => c.classList.remove("active"));
	tab.classList.add("active");
	document.getElementById(tab.dataset.settingsTab)?.classList.add("active");
});

document.getElementById("linksSubTabBar").addEventListener("click", (e) => {
	const subTab = e.target.dataset.subtab;
	if (!subTab) return;
	document
		.querySelectorAll("#linksSubTabBar .sub-tab-item")
		.forEach((el) => el.classList.remove("sub-tab-active"));
	e.target.classList.add("sub-tab-active");

	const CAT_MAP = {
		"links-all": "All",
		"links-paths": "Paths",
		"links-files": "Files",
		"links-others": "Others",
	};
	currentCategory = CAT_MAP[subTab] || "All";
	currentFileType = null; // Reset file type when category changes
	renderLinks();
});

document.addEventListener("click", (e) => {
	if (!e.target.closest("#secretsSubTabBar") || !e.target.dataset.subtab)
		return;
	document
		.querySelectorAll("#secretsSubTabBar .sub-tab-item")
		.forEach((el) => el.classList.remove("sub-tab-active"));
	e.target.classList.add("sub-tab-active");
	const map = {
		"secrets-all": "all",
		"secrets-apikeys": "apiKeys",
		"secrets-credentials": "credentials",
		"secrets-urls": "urls",
		"secrets-comments": "comments",
	};
	currentSecretsCategory = map[e.target.dataset.subtab] || "all";
	renderSecrets();
});

document.getElementById("secretsSubTabBar").addEventListener("click", (e) => {
	// Subtab click handling
});

document.getElementById("searchInput").addEventListener("input", (e) => {
	currentSearchQuery = e.target.value.toLowerCase();
	renderLinks();
});

// Handle nested file type tab clicks
document.addEventListener("click", (e) => {
	if (!e.target.closest("#fileTypesSubTabBar")) return;
	const fileTypeTab = e.target.closest(".sub-tab-item");
	if (!fileTypeTab || !fileTypeTab.closest("#fileTypesTabs")) return;

	document
		.querySelectorAll("#fileTypesTabs .sub-tab-item")
		.forEach((el) => el.classList.remove("sub-tab-active"));
	fileTypeTab.classList.add("sub-tab-active");
	const fileTypeValue = fileTypeTab.dataset.fileType;
	currentFileType =
		fileTypeValue === "null" || fileTypeValue === undefined
			? null
			: fileTypeValue;
	renderLinks();
});

document.addEventListener("input", (e) => {
	if (e.target.id === "secretsSearchInput") {
		currentSecretsSearchQuery = e.target.value.toLowerCase();
		renderSecrets();
	}
	if (e.target.id === "paramsSearchInput") {
		currentSearchQuery = e.target.value.toLowerCase();
		renderParams();
	}
});

// ─── Search Results Helper ────────────────────────────────────────────────────
function updateSearchResults(elementId, itemCount, searchQuery) {
	const el = document.getElementById(elementId);
	if (!el) return;
	if (searchQuery) {
		el.textContent = `Found ${itemCount} ${itemCount !== 1 ? "item" : "items"}`;
		el.classList.remove("hidden");
	} else {
		el.classList.add("hidden");
	}
}

// ─── Badge helper ─────────────────────────────────────────────────────────────
function setBadge(selector, count) {
	const el = document.querySelector(`[data-subtab="${selector}"]`);
	if (!el) return;
	let badge = el.querySelector(".count-badge");
	if (!badge) {
		badge = createElement("span", "count-badge");
		el.appendChild(badge);
	}
	badge.textContent = count;
}

function updateLinksSubtabCounts() {
	setBadge("links-all", allLinksGlobal.length);
	setBadge(
		"links-paths",
		allLinksGlobal.filter((l) => l.category === "Paths").length,
	);
	setBadge(
		"links-files",
		allLinksGlobal.filter((l) => l.category === "Files").length,
	);
	setBadge(
		"links-others",
		allLinksGlobal.filter((l) => l.category === "Others").length,
	);
}

function updateSecretsSubtabCounts() {
	const urlCount =
		allSecretsGlobal.endpoints.length +
		allSecretsGlobal.paths.length +
		allSecretsGlobal.hiddenLinks.length;
	const total =
		allSecretsGlobal.apiKeys.length +
		allSecretsGlobal.credentials.length +
		urlCount +
		allSecretsGlobal.comments.length;
	setBadge("secrets-all", total);
	setBadge("secrets-apikeys", allSecretsGlobal.apiKeys.length);
	setBadge("secrets-credentials", allSecretsGlobal.credentials.length);
	setBadge("secrets-urls", urlCount);
	setBadge("secrets-comments", allSecretsGlobal.comments.length);
}

// Helper function to get file extension from URL
function getFileExtension(url) {
	const cleanUrl = url.split("?")[0].split("#")[0];
	const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
	return match ? match[1].toLowerCase() : null;
}

// Helper function to get sorted unique file types with their counts
function getSortedFileTypesWithCounts(links) {
	const fileTypeMap = new Map(); // fileType -> count

	for (const link of links) {
		if (link.category === "Files") {
			const ext = getFileExtension(link.fullUrl);
			if (ext) {
				fileTypeMap.set(ext, (fileTypeMap.get(ext) || 0) + 1);
			}
		}
	}

	// Sort by predefined order, then append any unknown types alphabetically
	const sorted = [];
	for (const fileType of FILE_TYPE_ORDER) {
		if (fileTypeMap.has(fileType)) {
			sorted.push({ type: fileType, count: fileTypeMap.get(fileType) });
		}
	}
	// Add remaining file types alphabetically
	const remaining = Array.from(fileTypeMap.entries())
		.filter(([type]) => !FILE_TYPE_ORDER.includes(type))
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([type, count]) => ({ type, count }));
	sorted.push(...remaining);

	return sorted;
}

// Helper function to render file type subtabs
function renderFileTypeSubtabs(links) {
	const fileTypesBar = document.getElementById("fileTypesSubTabBar");
	const fileTypesTabs = document.getElementById("fileTypesTabs");

	if (currentCategory !== "Files") {
		fileTypesBar.classList.add("hidden");
		return;
	}

	const fileTypesWithCounts = getSortedFileTypesWithCounts(links);
	if (fileTypesWithCounts.length === 0) {
		fileTypesBar.classList.add("hidden");
		return;
	}

	fileTypesBar.classList.remove("hidden");
	fileTypesTabs.innerHTML = "";

	// Count total files for "All" tab
	const totalFiles = fileTypesWithCounts.reduce(
		(sum, item) => sum + item.count,
		0,
	);

	// Add "All" tab
	const allTabContainer = document.createElement("div");
	allTabContainer.className = "badge-container z-10";
	const allTab = document.createElement("div");
	allTab.dataset.fileType = "null";
	allTab.className =
		"sub-tab-item " + (currentFileType === null ? "sub-tab-active" : "");
	const allTabContent = document.createElement("span");
	allTabContent.textContent = "All";
	allTab.appendChild(allTabContent);

	// Create superscript badge
	const allBadge = document.createElement("span");
	allBadge.className = "count-badge z-100";
	allBadge.textContent = totalFiles;
	allBadge.style.display = totalFiles > 0 ? "flex" : "none";
	allTab.appendChild(allBadge);

	allTabContainer.appendChild(allTab);
	fileTypesTabs.appendChild(allTabContainer);

	// Add file type tabs in order
	for (const { type, count } of fileTypesWithCounts) {
		const tabContainer = document.createElement("div");
		tabContainer.className = "badge-container";
		const tab = document.createElement("div");
		tab.dataset.fileType = type;
		tab.className =
			"sub-tab-item " +
			(currentFileType === type ? "sub-tab-active" : "");
		const typeContent = document.createElement("span");
		typeContent.textContent = type.toUpperCase();
		tab.appendChild(typeContent);

		// Create superscript badge
		const badge = document.createElement("span");
		badge.className = "count-badge";
		badge.textContent = count;
		badge.style.display = count > 0 ? "flex" : "none";
		tab.appendChild(badge);

		tabContainer.appendChild(tab);
		fileTypesTabs.appendChild(tabContainer);
	}
}

// ─── Render Links ─────────────────────────────────────────────────────────────
function renderLinks() {
	updateLinksSubtabCounts();
	const resultsDiv = document.getElementById("links-view");
	resultsDiv.innerHTML = "";

	let filtered = allLinksGlobal
		.filter(
			(l) => currentCategory === "All" || l.category === currentCategory,
		)
		.filter(
			(l) =>
				!currentSearchQuery ||
				l.fullUrl.toLowerCase().includes(currentSearchQuery) ||
				l.domain.includes(currentSearchQuery) ||
				l.path.toLowerCase().includes(currentSearchQuery),
		)
		.filter((l) => !showOnlySensitiveLinks || isSensitiveLink(l.fullUrl));

	// Render file type subtabs for Files category
	renderFileTypeSubtabs(filtered);

	// Filter by selected file type if in Files category
	if (currentCategory === "Files" && currentFileType !== null) {
		filtered = filtered.filter(
			(l) => getFileExtension(l.fullUrl) === currentFileType,
		);
	}

	if (!filtered.length) {
		resultsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">🔍</div><p class="font-semibold">No links found</p><p class="text-xs mt-1">Try adjusting your search or category filters</p></div>`;
		document.getElementById("searchResults").classList.add("hidden");
		return;
	}

	const grouped = {};
	const mainBase = cachedDomain.replace("www.", "");

	// Group by domain
	for (const link of filtered) (grouped[link.domain] ||= []).push(link);

	const sortedDomains = Object.keys(grouped).sort((a, b) => {
		if (a === cachedDomain) return -1;
		if (b === cachedDomain) return 1;
		const aRel = a === mainBase || a.endsWith("." + mainBase);
		const bRel = b === mainBase || b.endsWith("." + mainBase);
		if (aRel !== bRel) return aRel ? -1 : 1;
		return a
			.split(".")
			.reverse()
			.join(".")
			.localeCompare(b.split(".").reverse().join("."));
	});

	const frag = document.createDocumentFragment();
	for (const domain of sortedDomains) {
		const links = grouped[domain].sort((a, b) =>
			a.path.localeCompare(b.path),
		);
		const section = document.createElement("div");
		section.className = "cyber-card";

		// Build domain header safely
		const headerBox = document.createElement("div");
		headerBox.className = "domain-header-box";
		const titleWrap = document.createElement("div");
		titleWrap.className = "flex items-center";
		const favicon = document.createElement("img");
		favicon.src = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
		favicon.className = "w-5 h-5 mr-3 rounded bg-white";
		favicon.onerror = function () {
			this.style.display = "none";
		};
		const domainTitle = document.createElement("h2");
		domainTitle.className = "text-sm font-bold truncate";
		domainTitle.style.maxWidth = "250px";
		domainTitle.textContent = domain;
		titleWrap.append(favicon, domainTitle);
		const badgeContainer = document.createElement("div");
		badgeContainer.className = "flex items-center gap-2";
		const badge = document.createElement("span");
		badge.className = "badge-count";
		badge.textContent = `${links.length} Links`;
		const copyGroupBtn = document.createElement("button");
		copyGroupBtn.type = "button";
		copyGroupBtn.className = "btn btn-blue text-xs px-2 py-1";
		copyGroupBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-right:0.3rem"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
		copyGroupBtn.addEventListener("click", () => {
			navigator.clipboard.writeText(
				links.map((l) => l.fullUrl).join("\n"),
			);
			flashCopied(copyGroupBtn, copyGroupBtn.innerHTML);
		});
		badgeContainer.append(badge, copyGroupBtn);
		headerBox.append(titleWrap, badgeContainer);

		const ul = document.createElement("ul");
		ul.className = "space-y-2 ml-2";
		for (const link of links) {
			const sensitive = isSensitiveLink(link.fullUrl);
			const li = document.createElement("li");
			li.className = "flex items-center text-sm";
			const bullet = document.createElement("span");
			bullet.className = "bullet-point mr-2";
			bullet.textContent = "•";
			const a = document.createElement("a");
			a.href = link.fullUrl;
			a.target = "_blank";
			a.rel = "noopener noreferrer";
			a.className = "cyber-link text-blue-500 font-semibold";
			a.title = link.fullUrl;
			a.textContent = link.path;
			li.append(bullet, a);
			if (sensitive) {
				const badge = document.createElement("span");
				badge.className =
					"ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-0.5 rounded";
				badge.textContent = "Sensitive";
				li.appendChild(badge);
			}
			ul.appendChild(li);
		}
		section.append(headerBox, ul);
		frag.appendChild(section);
	}
	resultsDiv.appendChild(frag);

	updateSearchResults("searchResults", filtered.length, currentSearchQuery);
}

// ─── Render Params ────────────────────────────────────────────────────────────
function renderParams() {
	updateLinksSubtabCounts();
	const paramsDiv = document.getElementById("params-view");
	paramsDiv.innerHTML = "";

	const allParams = {};
	for (const link of allLinksGlobal) {
		try {
			const { hostname: domain, searchParams } = new URL(link.fullUrl);
			const domParams = (allParams[domain] ||= {});
			searchParams.forEach((value, key) => {
				(domParams[key] ||= { values: new Set() }).values.add(value);
			});
		} catch {}
	}

	let domains = Object.entries(allParams)
		.filter(([, p]) => Object.keys(p).length > 0)
		.sort((a, b) => a[0].localeCompare(b[0]));

	if (currentSearchQuery || showOnlySensitiveParams) {
		domains = domains
			.map(([domain, params]) => {
				const filtered = Object.fromEntries(
					Object.entries(params).filter(([name, data]) => {
						const matchSearch =
							!currentSearchQuery ||
							name.toLowerCase().includes(currentSearchQuery) ||
							[...data.values].some((v) =>
								v.toLowerCase().includes(currentSearchQuery),
							) ||
							domain.toLowerCase().includes(currentSearchQuery);
						return (
							matchSearch &&
							(!showOnlySensitiveParams || isSensitiveParam(name))
						);
					}),
				);
				return [domain, filtered];
			})
			.filter(([, p]) => Object.keys(p).length > 0);
	}

	if (!domains.length) {
		paramsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">🔍</div><p class="font-semibold">No parameters found</p><p class="text-xs mt-1">No URL parameters were detected on this page</p></div>`;
		return;
	}

	const frag = document.createDocumentFragment();
	for (const [domain, params] of domains) {
		const entries = Object.entries(params).sort((a, b) =>
			a[0].localeCompare(b[0]),
		);
		const section = document.createElement("div");
		section.className = "cyber-card";

		const headerBox = document.createElement("div");
		headerBox.className = "domain-header-box";
		const titleWrap = document.createElement("div");
		titleWrap.className = "flex items-center";
		const favicon = document.createElement("img");
		favicon.src = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
		favicon.className = "w-5 h-5 mr-3 rounded bg-white";
		favicon.onerror = function () {
			this.style.display = "none";
		};
		const domainTitle = document.createElement("h2");
		domainTitle.className = "text-sm font-bold truncate";
		domainTitle.style.maxWidth = "250px";
		domainTitle.textContent = domain;
		titleWrap.append(favicon, domainTitle);
		const badgeContainer = document.createElement("div");
		badgeContainer.className = "flex items-center gap-2";
		const bdg = document.createElement("span");
		bdg.className = "badge-count";
		bdg.textContent = `${entries.length} Params`;
		const copyGroupBtn = document.createElement("button");
		copyGroupBtn.type = "button";
		copyGroupBtn.className = "btn btn-blue text-xs px-2 py-1";
		copyGroupBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-right:0.3rem"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
		copyGroupBtn.addEventListener("click", () => {
			const paramLines = [];
			for (const [name, data] of entries) {
				for (const value of data.values) {
					paramLines.push(`${name}=${value}`);
				}
			}
			navigator.clipboard.writeText(paramLines.join("\n"));
			flashCopied(copyGroupBtn, copyGroupBtn.innerHTML);
		});
		badgeContainer.append(bdg, copyGroupBtn);
		headerBox.append(titleWrap, badgeContainer);

		const ul = document.createElement("ul");
		ul.className = "space-y-3 ml-2";
		for (const [name, data] of entries) {
			const sensitive = isSensitiveParam(name);
			const values = [...data.values].slice(0, 3);
			const more = data.values.size - 3;
			const li = document.createElement("li");
			li.className = "text-sm";

			const row = document.createElement("div");
			row.className = "flex items-center";
			const bullet = document.createElement("span");
			bullet.className = "bullet-point mr-2";
			bullet.textContent = "•";
			const nameEl = document.createElement("span");
			nameEl.className = "text-blue-500 font-semibold";
			nameEl.textContent = name;
			row.append(bullet, nameEl);
			if (sensitive) {
				const sb = document.createElement("span");
				sb.className =
					"ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-0.5 rounded";
				sb.textContent = "Sensitive";
				row.appendChild(sb);
			}

			const valDiv = document.createElement("div");
			valDiv.className =
				"text-xs text-gray-600 dark:text-gray-400 ml-4 mt-2";
			values.forEach((v) => {
				const vd = document.createElement("div");
				vd.className = "break-all";
				const code = document.createElement("code");
				code.textContent =
					v.substring(0, 50) + (v.length > 50 ? "..." : "");
				vd.appendChild(code);
				valDiv.appendChild(vd);
			});
			if (more > 0) {
				const moreEl = document.createElement("div");
				moreEl.className = "text-gray-500 italic";
				moreEl.textContent = `+${more} more value${more > 1 ? "s" : ""}`;
				valDiv.appendChild(moreEl);
			}
			li.append(row, valDiv);
			ul.appendChild(li);
		}
		section.append(headerBox, ul);
		frag.appendChild(section);
	}
	paramsDiv.appendChild(frag);
}

// ─── Render Secrets ───────────────────────────────────────────────────────────
function renderSecrets() {
	updateSecretsSubtabCounts();
	const secretsDiv = document.getElementById("secrets-view");
	if (!secretsDiv) return;
	secretsDiv.innerHTML = "";

	const isEmpty =
		!allSecretsGlobal.apiKeys.length &&
		!allSecretsGlobal.credentials.length &&
		!allSecretsGlobal.endpoints.length &&
		!allSecretsGlobal.paths.length &&
		!allSecretsGlobal.comments.length &&
		!allSecretsGlobal.hiddenLinks.length;

	if (isEmpty) {
		secretsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">🔍</div><p class="font-semibold">No secrets found</p><p class="text-xs mt-1">This page has no exposed sensitive information</p></div>`;
		return;
	}

	let items = [];
	if (currentSecretsCategory === "all")
		Object.values(allSecretsGlobal).forEach((arr) => items.push(...arr));
	else if (currentSecretsCategory === "urls")
		items = [
			...allSecretsGlobal.endpoints,
			...allSecretsGlobal.paths,
			...allSecretsGlobal.hiddenLinks,
		];
	else if (allSecretsGlobal[currentSecretsCategory])
		items = allSecretsGlobal[currentSecretsCategory];

	if (currentSecretsSearchQuery) {
		const s = currentSecretsSearchQuery;
		items = items.filter(
			(item) =>
				item.pattern?.toLowerCase().includes(s) ||
				item.value?.toLowerCase().includes(s) ||
				item.content?.toLowerCase().includes(s) ||
				item.type?.toLowerCase().includes(s),
		);
	}

	if (showOnlySensitiveSecrets) {
		items = items.filter((item) => isSensitiveSecret(item));
	}

	if (!items.length) {
		secretsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><p class="font-semibold">No results</p></div>`;
		document
			.getElementById("secretsSearchResults")
			?.classList.add("hidden");
		return;
	}

	const grouped = {};

	// Consolidation map: map all similar types to main categories
	const categoryMap = {
		"API Key": "API Keys",
		Credential: "Credentials",
		Endpoint: "URLs",
		"Hidden URL": "URLs",
		"Hidden Link": "URLs",
		"Hidden Path": "Paths",
		Path: "Paths",
		"Resource (CSS)": "URLs",
		"Data Attribute": "API Keys",
		// Keep comment types separate
		"HTML Comment": "HTML Comment",
		"JavaScript Comment": "JavaScript Comment",
		"CSS Comment": "CSS Comment",
	};

	// Group items by consolidated category
	items.forEach((item) => {
		const mainCategory = categoryMap[item.type] || item.type;
		(grouped[mainCategory] ||= []).push(item);
	});

	const frag = document.createDocumentFragment();
	Object.entries(grouped).forEach(([type, typeItems]) => {
		const div = document.createElement("div");
		div.className = "cyber-card";

		const headerBox = document.createElement("div");
		headerBox.className = "domain-header-box";
		const h2 = document.createElement("h2");
		h2.className = "text-sm font-bold";
		h2.textContent = type;
		const badgeContainer = document.createElement("div");
		badgeContainer.className = "flex items-center gap-2";
		const bdg = document.createElement("span");
		bdg.className = "badge-count";
		bdg.textContent = typeItems.length;
		const copyGroupBtn = document.createElement("button");
		copyGroupBtn.type = "button";
		copyGroupBtn.className = "btn btn-blue text-xs px-2 py-1";
		copyGroupBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-right:0.3rem"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
		copyGroupBtn.addEventListener("click", () => {
			const toCopy = typeItems
				.map((item) => {
					if (
						item.type === "HTML Comment" ||
						item.type === "JavaScript Comment" ||
						item.type === "CSS Comment"
					)
						return item.content || item.sourceText || "";
					return item.value || item.pattern || "";
				})
				.filter((v) => v.trim());
			navigator.clipboard.writeText(toCopy.join("\n"));
			flashCopied(copyGroupBtn, copyGroupBtn.innerHTML);
		});
		badgeContainer.append(bdg, copyGroupBtn);
		headerBox.append(h2, badgeContainer);

		const ul = document.createElement("ul");
		ul.className = "space-y-1 ml-2";
		const isCommentType =
			type === "HTML Comment" ||
			type === "JavaScript Comment" ||
			type === "CSS Comment";
		const isHiddenLinkType =
			type === "Hidden Link" || type === "Hidden URL";
		// Check if any items in this group are URL-like (Endpoint, Hidden Link, Hidden URL, Resource CSS)
		const isUrlCategory = type === "URLs";
		const isUrlType = (item) =>
			item.type === "Endpoint" ||
			item.type === "Hidden Link" ||
			item.type === "Hidden URL" ||
			item.type === "Resource (CSS)";

		typeItems.forEach((item) => {
			const val = item.pattern || item.value || item.content || "";
			// Add https: to protocol-relative URLs for display (but not for comments)
			const displayValueForRendering =
				!isCommentType && val.startsWith("//") ? "https:" + val : val;
			const lineCount = countLines(displayValueForRendering);
			const hasMultipleLines = lineCount > 5;
			const isVeryLong = displayValueForRendering.length > 150;
			const shouldTruncate = hasMultipleLines || isVeryLong;

			let displayVal;
			if (hasMultipleLines) {
				displayVal = truncateToLines(displayValueForRendering, 5);
			} else if (isVeryLong) {
				displayVal = displayValueForRendering.substring(0, 150);
			} else {
				displayVal = displayValueForRendering;
			}

			const li = document.createElement("li");
			li.className = "flex items-center justify-between text-sm gap-2";
			const inner = document.createElement("div");
			inner.className = "flex items-center gap-2 flex-1 min-w-0";
			const bullet = document.createElement("span");
			bullet.className = "bullet-point mr-1";
			bullet.textContent = "•";
			const code = document.createElement("code");
			code.className =
				"text-xs bg-gray-900 text-green-400 px-2 py-1 rounded font-mono flex-1 break-all";

			// Render as link if it's a URL-type item
			if (isHiddenLinkType || (isUrlCategory && isUrlType(item))) {
				const a = document.createElement("a");
				// Use fullUrl if available (for protocol-relative URLs), otherwise use val
				a.href = item.fullUrl || val;
				a.target = "_blank";
				a.rel = "noopener noreferrer";
				a.className = "text-blue-400 hover:underline font-mono";
				a.textContent = displayVal;
				code.appendChild(a);
			} else {
				code.textContent =
					displayVal +
					(shouldTruncate &&
					!isCommentType &&
					val.length > displayVal.length
						? "..."
						: "") +
					(hasMultipleLines ? "\n..." : "");
			}
			inner.append(bullet, code);
			li.appendChild(inner);

			// Add "View Full" button if content was truncated
			if (val.length > displayVal.length) {
				const viewBtn = document.createElement("button");
				viewBtn.type = "button";
				viewBtn.className = "btn btn-blue text-xs px-2 py-1";
				viewBtn.textContent = "View Full";
				viewBtn.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					openModal(`${type} - Full Content`, val);
				});
				li.appendChild(viewBtn);
			}

			ul.appendChild(li);
		});

		div.append(headerBox, ul);
		frag.appendChild(div);
	});
	secretsDiv.appendChild(frag);

	const sr = document.getElementById("secretsSearchResults");
	if (sr) {
		if (currentSecretsSearchQuery) {
			sr.textContent = `Found ${items.length} secret${items.length !== 1 ? "s" : ""}`;
			sr.classList.remove("hidden");
		} else {
			sr.classList.add("hidden");
		}
	}
}

// ─── Cipher / Encoding tab ────────────────────────────────────────────────────
const encodeInput = document.getElementById("encodeInput");
const encodeMethod = document.getElementById("encodeMethod");
const encodeOutput = document.getElementById("encodeOutput");
const repeatCounter = document.getElementById("repeatCounter");
let lastOperation = null,
	lastMethod = null,
	repeatCount = 0;

function runEncoding(op) {
	const method = encodeMethod.value;
	if (!method) {
		showToast("Please select an encoding method", "error");
		return;
	}
	try {
		encodeOutput.value = encodingFunctions[method][op](encodeInput.value);
		lastOperation = op;
		lastMethod = method;
		repeatCount = 0;
		repeatCounter.textContent = 0;
	} catch (e) {
		encodeOutput.value = `Error: ${e.message}`;
	}
}

document
	.getElementById("encodeBtn")
	.addEventListener("click", () => runEncoding("encode"));
document
	.getElementById("decodeBtn")
	.addEventListener("click", () => runEncoding("decode"));

document.getElementById("repeatBtn").addEventListener("click", () => {
	if (!lastOperation || !lastMethod) {
		showToast("Please perform an encode/decode operation first", "error");
		return;
	}
	if (!encodeOutput.value.trim()) {
		showToast("No output to repeat", "error");
		return;
	}
	try {
		encodeOutput.value = encodingFunctions[lastMethod][lastOperation](
			encodeOutput.value,
		);
		repeatCounter.textContent = ++repeatCount;
	} catch (e) {
		encodeOutput.value = `Error: ${e.message}`;
	}
});

function flashCopied(btn, origHtml) {
	btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-right:0.5rem"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
	setTimeout(() => {
		btn.innerHTML = origHtml;
	}, 1500);
}

// ─── Unified Event Delegation System for Action Buttons ────────────────────────
// This consolidates all action button handlers using data-action attributes
document.addEventListener("click", async (event) => {
	const actionBtn = event.target.closest("[data-action]");
	if (!actionBtn) return;

	const action = actionBtn.getAttribute("data-action");

	// Cipher paste input
	if (action === "paste-input") {
		try {
			const text = await navigator.clipboard.readText();
			encodeInput.value = text;
			showToast("Pasted successfully", "success");
		} catch (err) {
			showToast(
				"Paste failed. Please check extension permissions or use Ctrl+V manually",
				"error",
			);
		}
	}
	// Copy actions
	else if (action === "copy-result") {
		if (!encodeOutput.value) {
			showToast("No output to copy", "error");
			return;
		}
		navigator.clipboard.writeText(encodeOutput.value);
		flashCopied(actionBtn, actionBtn.innerHTML);
	} else if (action === "copy-links") {
		const filtered = allLinksGlobal
			.filter(
				(l) =>
					currentCategory === "All" || l.category === currentCategory,
			)
			.filter(
				(l) =>
					!currentSearchQuery ||
					l.fullUrl.toLowerCase().includes(currentSearchQuery) ||
					l.domain.toLowerCase().includes(currentSearchQuery) ||
					l.path.toLowerCase().includes(currentSearchQuery),
			)
			.filter(
				(l) => !showOnlySensitiveLinks || isSensitiveLink(l.fullUrl),
			);
		if (!filtered.length) {
			showToast("No links to copy", "error");
			return;
		}
		navigator.clipboard.writeText(
			filtered.map((l) => l.fullUrl).join("\n"),
		);
		flashCopied(actionBtn, actionBtn.innerHTML);
	} else if (action === "copy-secrets") {
		const categoryKey =
			currentSecretsCategory === "all" ? null : currentSecretsCategory;
		let items = [];
		if (categoryKey === "apiKeys") items = allSecretsGlobal.apiKeys;
		else if (categoryKey === "credentials")
			items = allSecretsGlobal.credentials;
		else if (categoryKey === "urls")
			items = [
				...allSecretsGlobal.endpoints,
				...allSecretsGlobal.paths,
				...allSecretsGlobal.hiddenLinks,
			];
		else if (categoryKey === "comments") items = allSecretsGlobal.comments;
		else
			items = [
				...allSecretsGlobal.apiKeys,
				...allSecretsGlobal.credentials,
				...allSecretsGlobal.endpoints,
				...allSecretsGlobal.paths,
				...allSecretsGlobal.comments,
				...allSecretsGlobal.hiddenLinks,
			];

		if (currentSecretsSearchQuery) {
			const s = currentSecretsSearchQuery;
			items = items.filter(
				(item) =>
					(item.value || item.content || item.sourceText || "")
						.toLowerCase()
						.includes(s) ||
					(item.type || "").toLowerCase().includes(s),
			);
		}
		if (!items.length) {
			showToast("No secrets to copy", "error");
			return;
		}
		const toCopy = items
			.map((item) => {
				if (
					item.type === "HTML Comment" ||
					item.type === "JavaScript Comment" ||
					item.type === "CSS Comment"
				)
					return item.content || item.sourceText || "";
				return item.value || item.pattern || "";
			})
			.filter((v) => v.trim());
		navigator.clipboard.writeText(toCopy.join("\n"));
		flashCopied(actionBtn, actionBtn.innerHTML);
	}
	// Params copy menu toggle
	else if (action === "copy-params-menu") {
		const menu = document.getElementById("copyParamsMenu");
		menu.style.display = menu.style.display === "none" ? "flex" : "none";
		event.stopPropagation();
	}
	// Params copy with copy type selection
	else if (action === "copy-params") {
		const copyType = actionBtn.getAttribute("data-copy-type");
		const allParams = {};
		for (const link of allLinksGlobal) {
			try {
				const { hostname: domain, searchParams } = new URL(
					link.fullUrl,
				);
				if (!allParams[domain]) allParams[domain] = {};
				for (const [key, val] of searchParams) {
					if (!allParams[domain][key]) allParams[domain][key] = [];
					if (!allParams[domain][key].includes(val))
						allParams[domain][key].push(val);
				}
			} catch {}
		}

		let result = [];
		if (copyType === "names") {
			const uniqueKeys = new Set();
			for (const domain in allParams) {
				Object.keys(allParams[domain]).forEach((k) =>
					uniqueKeys.add(k),
				);
			}
			result = Array.from(uniqueKeys);
		} else if (copyType === "values") {
			for (const domain in allParams) {
				for (const param in allParams[domain]) {
					result.push(
						...allParams[domain][param].filter(
							(v) => !result.includes(v),
						),
					);
				}
			}
		} else {
			for (const domain in allParams) {
				for (const param in allParams[domain]) {
					allParams[domain][param].forEach((val) => {
						const line = `${param}=${val}`;
						if (!result.includes(line)) result.push(line);
					});
				}
			}
		}

		if (!result.length) {
			showToast("No params to copy", "error");
			return;
		}
		navigator.clipboard.writeText(result.join("\n"));
		flashCopied(actionBtn, actionBtn.innerHTML);
		document.getElementById("copyParamsMenu").style.display = "none";
	}
	// Filter actions
	else if (action === "filter-sensitive-links") {
		showOnlySensitiveLinks = !showOnlySensitiveLinks;
		actionBtn.classList.toggle("filter-active", showOnlySensitiveLinks);
		renderLinks();
	} else if (action === "filter-sensitive-secrets") {
		showOnlySensitiveSecrets = !showOnlySensitiveSecrets;
		actionBtn.classList.toggle("filter-active", showOnlySensitiveSecrets);
		renderSecrets();
	} else if (action === "filter-sensitive-params") {
		showOnlySensitiveParams = !showOnlySensitiveParams;
		actionBtn.classList.toggle("filter-active", showOnlySensitiveParams);
		renderParams();
	}
	// Bulk Opener actions
	else if (action === "bulk-paste") {
		try {
			const text = await navigator.clipboard.readText();
			document.getElementById("bulkUrlInput").value = text;
			showToast("URLs pasted successfully", "success");
		} catch (err) {
			showToast(
				"Paste failed. Please check extension permissions in chrome://extensions or use Ctrl+V manually",
				"error",
			);
		}
	} else if (action === "bulk-copy") {
		const textarea = document.getElementById("bulkUrlInput");
		const text = textarea.value.trim();
		if (!text) {
			showToast("Input is empty", "error");
			return;
		}
		try {
			await navigator.clipboard.writeText(text);
			showToast("URLs copied to clipboard", "success");
		} catch {
			showToast("Failed to copy to clipboard", "error");
		}
	} else if (action === "bulk-clear") {
		document.getElementById("bulkUrlInput").value = "";
		document.getElementById("bulkOpenerResults").classList.add("hidden");
		showToast("Input cleared", "info");
	} else if (action === "bulk-open") {
		const textarea = document.getElementById("bulkUrlInput");
		const mode = document.querySelector(
			'input[name="bulkOpenerMode"]:checked',
		)?.value;
		const text = textarea.value.trim();

		if (!mode) {
			showToast("Please select an opening option", "error");
			return;
		}

		if (!text) {
			showToast("Please enter at least one URL", "error");
			return;
		}

		const urls = extractUrls(text);
		if (urls.length === 0) {
			showToast("No valid URLs found", "error");
			return;
		}

		if (mode === "newTabs") {
			window
				.getBrowserAPI()
				.runtime.sendMessage(
					{ action: "openUrlsInNewTabs", urls: urls },
					() => {
						showToast(
							`Opening ${urls.length} URL(s) in new tabs...`,
							"success",
						);
						updateBulkOpenerResults(urls.length, urls.length);
					},
				);
		} else if (mode === "newWindow") {
			window
				.getBrowserAPI()
				.runtime.sendMessage(
					{ action: "openUrlsInNewWindow", urls: urls },
					() => {
						showToast(
							`Opening ${urls.length} URL(s) in a new window...`,
							"success",
						);
						updateBulkOpenerResults(urls.length, 1);
					},
				);
		} else if (mode === "eachDomain") {
			const domainMap = getUniqueDomains(urls);
			window.getBrowserAPI().runtime.sendMessage(
				{
					action: "openUrlsByDomain",
					domainMap: Array.from(domainMap),
				},
				() => {
					showToast(
						`Opening ${domainMap.size} domain(s) in separate window(s)...`,
						"success",
					);
					updateBulkOpenerResults(urls.length, domainMap.size);
				},
			);
		}
	}
	// Settings actions
	else if (action === "settings-save") {
		savePopupSettings();
	} else if (action === "settings-reset") {
		resetPopupToDefaults();
	} else if (action === "export-settings") {
		exportPopupSettings();
	} else if (action === "import-settings") {
		importPopupSettings();
	}
	// Modal actions
	else if (action === "modal-copy") {
		const content = document.getElementById("modalContent").textContent;
		if (content) {
			navigator.clipboard
				.writeText(content)
				.then(() => {
					showToast("Copied to clipboard!", "success");
				})
				.catch(() => {
					showToast("Failed to copy", "error");
				});
		}
	}
	// Tab actions
	else if (action === "open-tab") {
		const [tab] = await window.getBrowserAPI().tabs.query({
			active: true,
			currentWindow: true,
		});
		try {
			const domain = new URL(tab.url).hostname;
			window.getBrowserAPI().tabs.create({
				url: window
					.getBrowserAPI()
					.runtime.getURL(
						`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`,
					),
			});
		} catch {}
	}
});

// Close params menu when clicking outside
document.addEventListener("click", function (e) {
	if (!e.target.closest("[data-action='copy-params-menu']")) {
		document.getElementById("copyParamsMenu").style.display = "none";
	}
});

// ─── Settings ─────────────────────────────────────────────────────────────────
function loadPopupSettings() {
	window.getBrowserAPI().storage.local.get(["sensitivePatterns"], (local) => {
		const patterns = local.sensitivePatterns || {
			params: SENSITIVE_PATTERNS.params,
			urlPatterns: DEFAULT_PATTERNS_RAW.urlPatterns,
		};
		const paramsEl = document.getElementById("sensitiveParams");
		const urlsEl = document.getElementById("urlPatterns");
		if (!paramsEl || !urlsEl) return;
		paramsEl.value = Array.isArray(patterns.params)
			? patterns.params.join(", ")
			: "";
		urlsEl.value = Array.isArray(patterns.urlPatterns)
			? patterns.urlPatterns.join("\n")
			: "";
	});
}

function savePopupSettings() {
	const paramsEl = document.getElementById("sensitiveParams");
	const urlsEl = document.getElementById("urlPatterns");
	if (!paramsEl || !urlsEl) return;
	const params = paramsEl.value
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);
	const urlPatterns = urlsEl.value
		.split("\n")
		.map((p) => p.trim())
		.filter(Boolean);
	if (!params.length && !urlPatterns.length) {
		showToast(
			"Please enter at least one parameter or URL pattern",
			"error",
		);
		return;
	}
	const patterns = { params, urlPatterns };
	window.getBrowserAPI().storage.sync.set({ sensitivePatterns: patterns });
	window
		.getBrowserAPI()
		.storage.local.set({ sensitivePatterns: patterns }, () => {
			showToast("Settings saved!", "success");
			applyPatterns(patterns);
		});
}

function resetPopupToDefaults() {
	if (!confirm("Reset to default patterns?")) return;
	const defaults = {
		params: DEFAULT_PATTERNS_RAW.params,
		urlPatterns: DEFAULT_PATTERNS_RAW.urlPatterns,
	};
	window.getBrowserAPI().storage.sync.set({ sensitivePatterns: defaults });
	window
		.getBrowserAPI()
		.storage.local.set({ sensitivePatterns: defaults }, () => {
			showToast("Reset to defaults!", "success");
			applyPatterns(defaults);
			loadPopupSettings();
		});
}

function exportPopupSettings() {
	window
		.getBrowserAPI()
		.storage.local.get(["sensitivePatterns"], (result) => {
			const patterns = result.sensitivePatterns || {
				params: SENSITIVE_PATTERNS.params,
				urlPatterns: DEFAULT_PATTERNS_RAW.urlPatterns,
			};
			const url = URL.createObjectURL(
				new Blob([JSON.stringify(patterns, null, 2)], {
					type: "application/json",
				}),
			);
			const a = Object.assign(document.createElement("a"), {
				href: url,
				download: `power-toys-settings-${Date.now()}.json`,
			});
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			showToast("Settings exported!", "success");
		});
}

function importPopupSettings() {
	const input = Object.assign(document.createElement("input"), {
		type: "file",
		accept: ".json",
	});
	input.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				const patterns = JSON.parse(ev.target.result);
				if (
					!Array.isArray(patterns.params) ||
					!Array.isArray(patterns.urlPatterns)
				) {
					showToast("Invalid settings file format!", "error");
					return;
				}
				window
					.getBrowserAPI()
					.storage.sync.set({ sensitivePatterns: patterns });
				window
					.getBrowserAPI()
					.storage.local.set({ sensitivePatterns: patterns }, () => {
						showToast("Settings imported!", "success");
						applyPatterns(patterns);
						loadPopupSettings();
					});
			} catch {
				showToast("Error parsing settings file!", "error");
			}
		};
		reader.readAsText(file);
	});
	input.click();
}

function attachEventListeners() {
	document.addEventListener("click", (e) => {
		if (e.target.closest(".settings-save-btn")) savePopupSettings();
		if (e.target.closest(".settings-reset-btn")) resetPopupToDefaults();
	});
	document
		.getElementById("popupExportBtn")
		?.addEventListener("click", exportPopupSettings);
	document
		.getElementById("popupImportBtn")
		?.addEventListener("click", importPopupSettings);
	document
		.querySelector('[data-toplevel="settings"]')
		?.addEventListener("click", () => setTimeout(loadPopupSettings, 50));

	// ─── Modal Event Handlers ──────────────────────────────────────────────
	const modal = document.getElementById("itemModal");
	const modalOverlay = document.getElementById("modalOverlay");
	const modalCloseBtn = document.getElementById("modalCloseBtn");
	const modalCopyBtn = document.getElementById("modalCopyBtn");

	if (modalCloseBtn) {
		modalCloseBtn.addEventListener("click", closeModal);
	}

	if (modalOverlay) {
		modalOverlay.addEventListener("click", closeModal);
	}

	// Delegated to unified event delegation system

	// Close modal on Escape key
	if (modal) {
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && !modal.classList.contains("hidden")) {
				closeModal();
			}
		});
	}
}

// ─── Bulk URL Opener functionality ───────────────────────────────────────────
function extractUrls(text) {
	const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]*)/g;
	const urls = [];
	let match;
	while ((match = urlRegex.exec(text)) !== null) {
		const url = match[1].trim();
		if (url && !urls.includes(url)) {
			urls.push(url);
		}
	}
	return urls;
}

function getDomain(url) {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

function getUniqueDomains(urls) {
	const domains = new Map();
	urls.forEach((url) => {
		const domain = getDomain(url);
		if (domain) {
			if (!domains.has(domain)) {
				domains.set(domain, []);
			}
			domains.get(domain).push(url);
		}
	});
	return domains;
}

// Delegated to unified event delegation system

function updateBulkOpenerResults(totalUrls, windows) {
	const resultsDiv = document.getElementById("bulkOpenerResults");
	const resultsText = document.getElementById("bulkOpenerResultsText");
	resultsText.textContent = `📊 Processed ${totalUrls} URL(s) across ${windows} window(s).`;
	resultsDiv.classList.remove("hidden");
	setTimeout(() => {
		resultsDiv.classList.add("hidden");
	}, 4000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
	initTheme();
	await loadPatterns();
	attachEventListeners();

	const urlParams = new URLSearchParams(location.search);
	const isFullTab = urlParams.has("fullTab");

	if (isFullTab) {
		document.body.classList.add("full-tab");
		document.getElementById("openTabBtn").style.display = "none";
		cachedDomain = urlParams.get("domain") || "";

		window
			.getBrowserAPI()
			.storage.local.get(["savedLinks", "savedSecrets"], (data) => {
				if (data.savedLinks?.length) {
					allLinksGlobal = data.savedLinks;
					renderLinks();
				} else {
					// Single retry for background race
					setTimeout(() => {
						window
							.getBrowserAPI()
							.storage.local.get(["savedLinks"], (data2) => {
								allLinksGlobal = data2.savedLinks || [];
								if (allLinksGlobal.length) renderLinks();
								else
									document.getElementById(
										"links-view",
									).innerHTML =
										'<p class="text-yellow-500 text-center py-8">No links found. Try opening from the extension popup instead.</p>';
							});
					}, 250);
				}
				if (data.savedSecrets) allSecretsGlobal = data.savedSecrets;
			});
	} else {
		const [tab] = await window.getBrowserAPI().tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!tab?.url || tab.url.startsWith("chrome")) {
			document.getElementById("links-view").innerHTML =
				'<p class="text-red-500 text-center py-8">Unavailable on this page.</p>';
			return;
		}
		try {
			cachedDomain = new URL(tab.url).hostname;
		} catch {}

		window
			.getBrowserAPI()
			.scripting.executeScript(
				{ target: { tabId: tab.id }, function: collectAllLinksInPage },
				(results) => {
					if (results?.[0]) {
						allLinksGlobal = results[0].result;
						window
							.getBrowserAPI()
							.storage.local.set({ savedLinks: allLinksGlobal });
						renderLinks();
					}
				},
			);

		window
			.getBrowserAPI()
			.scripting.executeScript(
				{ target: { tabId: tab.id }, function: collectSecretsFromPage },
				(results) => {
					if (results?.[0]) {
						allSecretsGlobal = results[0].result;
						window.getBrowserAPI().storage.local.set({
							savedSecrets: allSecretsGlobal,
						});
						setTimeout(() => renderSecrets(), 100);
					}
				},
			);
	}
});
