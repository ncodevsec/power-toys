// === State ===
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
let currentSecretsCategory = "All";
let currentSearchQuery = "";
let currentSecretsSearchQuery = "";
let showOnlySensitiveLinks = false;
let cachedDomain = "";

let SENSITIVE_PATTERNS = { params: [], urlPatterns: [] };
let DEFAULT_PATTERNS_RAW = { params: [], urlPatterns: [] };

// === Pattern Utilities ===

function parseUrlPatterns(rawPatterns = []) {
	return rawPatterns.map((p) => {
		const m = p.match(/^\/(.*)\/([igm]*)$/);
		try {
			return m ? new RegExp(m[1], m[2]) : new RegExp(p);
		} catch {
			return new RegExp(p);
		}
	});
}

function applyPatterns(patterns) {
	if (patterns.params) SENSITIVE_PATTERNS.params = patterns.params;
	if (patterns.urlPatterns)
		SENSITIVE_PATTERNS.urlPatterns = parseUrlPatterns(patterns.urlPatterns);
}

async function loadPatterns() {
	// Load defaults from JSON
	try {
		const res = await fetch(chrome.runtime.getURL("config/defaults.json"));
		const defaults = await res.json();
		DEFAULT_PATTERNS_RAW = {
			params: defaults.params || [],
			urlPatterns: defaults.urlPatterns || [],
		};
		SENSITIVE_PATTERNS.params = defaults.params || [];
		SENSITIVE_PATTERNS.urlPatterns = parseUrlPatterns(defaults.urlPatterns);
	} catch (e) {
		console.error("Error loading default patterns:", e);
	}

	// Override with custom patterns from storage (sync first, fallback to local)
	await new Promise((resolve) => {
		chrome.storage.sync.get(["sensitivePatterns"], (result) => {
			if (result.sensitivePatterns) {
				applyPatterns(result.sensitivePatterns);
				return resolve();
			}
			chrome.storage.local.get(["sensitivePatterns"], (local) => {
				if (local.sensitivePatterns)
					applyPatterns(local.sensitivePatterns);
				resolve();
			});
		});
	});
}

// === Link Collection (injected into page via executeScript) ===

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

// === Secrets Collection (injected into page via executeScript) ===

function collectSecretsFromPage() {
	const secrets = {
		apiKeys: [],
		credentials: [],
		endpoints: [],
		paths: [],
		comments: [],
		hiddenLinks: [],
	};

	// DEBUG: Log function execution
	console.log("[collectSecretsFromPage] ===== FUNCTION STARTED =====");
	console.log("[collectSecretsFromPage] Page URL:", window.location.href);
	console.log(
		"[collectSecretsFromPage] Document ready state:",
		document.readyState,
	);
	console.log("[collectSecretsFromPage] Document title:", document.title);

	// DEBUG: Check if we can access source code
	const pageSource = document.documentElement.outerHTML;
	console.log(
		"[collectSecretsFromPage] Page source code length:",
		pageSource.length,
	);
	console.log(
		"[collectSecretsFromPage] Page source first 500 chars:",
		pageSource.substring(0, 500),
	);
	console.log(
		"[collectSecretsFromPage] Page source last 500 chars:",
		pageSource.substring(Math.max(0, pageSource.length - 500)),
	);

	const secretPatterns = {
		apiKeys: [
			/(?:api[_-]?key|apikey|api_secret|apiSecret|access[_-]?key|accessKey|secret[_-]?key|secretKey)\s*[:=]\s*['""`]([a-zA-Z0-9\-_.]+)['""`]/gi,
			/(?:authorization|bearer|x-api-key|x-access-token)\s*[:=]\s*['""`]([a-zA-Z0-9\-_.]+)['""`]/gi,
			/(?:token|auth_?token|access_?token|refresh_?token)\s*[:=]\s*['""`]([a-zA-Z0-9\-_.]+)['""`]/gi,
		],
		credentials: [
			/(?:username|user|login)\s*[:=]\s*['""`]([^'""`\s]+)['""`]/gi,
			/(?:password|passwd|pwd|pass)\s*[:=]\s*['""`]([^'""`\s]+)['""`]/gi,
			/(?:email)\s*[:=]\s*['""`]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})['""`]/gi,
		],
		endpoints: [
			/(?:endpoint|url|base_?url|api_?url|server)\s*[:=]\s*['""`](https?:\/\/[^\s'""`]+)['""`]/gi,
			/(?:host|hostname|domain)\s*[:=]\s*['""`]([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?)['""`]/gi,
		],
		paths: [
			/\/[a-zA-Z0-9_\-./]*(?:admin|api|internal|private|secret|debug|backup|upload|download|webhook|callback)[a-zA-Z0-9_\-./]*/gi,
			/\/[a-zA-Z0-9_\-./]*(?:\.git|\.env|\.config|backup|\.sql|\.db|\.jar)[a-zA-Z0-9_\-./]*/gi,
		],
	};

	// Scan HTML comments for hidden links and sensitive info
	const walker = document.createTreeWalker(
		document.documentElement,
		NodeFilter.SHOW_COMMENT,
		null,
		false,
	);
	let comment;
	const commentTexts = [];

	// DEBUG: Start comment scanning
	console.log("[collectSecretsFromPage] ===== STARTING COMMENT SCAN =====");
	console.log(
		"[collectSecretsFromPage] TreeWalker created, SHOW_COMMENT = ",
		NodeFilter.SHOW_COMMENT,
	);

	let commentIndex = 0;
	while ((comment = walker.nextNode())) {
		commentIndex++;
		const text = comment.textContent || comment.nodeValue || "";
		console.log(
			`[collectSecretsFromPage] Comment #${commentIndex} found (length: ${text.length}):`,
			text.substring(0, 100),
		);

		if (text && text.length > 0) {
			commentTexts.push(text);
			console.log(
				`[collectSecretsFromPage]   → Storing comment, total comments so far: ${commentTexts.length}`,
			);

			// Simple href extraction - catch href=/path
			const simpleHrefRegex = /href\s*=\s*['"]*([^\s'">\]]+)/gi;
			let hrefMatch;
			while ((hrefMatch = simpleHrefRegex.exec(text)) !== null) {
				const val = hrefMatch[1]?.trim();
				console.log(
					`[collectSecretsFromPage]   → Href match found: ${val}`,
				);
				if (val && !secrets.hiddenLinks.find((l) => l.value === val)) {
					secrets.hiddenLinks.push({
						type: "Hidden Link",
						value: val,
						source: "HTML Comment",
						context: text.substring(0, 100),
					});
					console.log(
						`[collectSecretsFromPage]     ✓ Added to hiddenLinks: ${val}`,
					);
				}
			}

			// Extract paths starting with /
			const paths = text.match(/\/[^\s<>"'`\)]*[\w\-]/g) || [];
			paths.forEach((path) => {
				if (
					path.length > 2 &&
					!secrets.hiddenLinks.find((l) => l.value === path)
				) {
					secrets.hiddenLinks.push({
						type: "Hidden Path",
						value: path,
						source: "HTML Comment",
						context: text.substring(0, 100),
					});
				}
			});

			// Extract full URLs
			const urls = text.match(/https?:\/\/[^\s<>"'`\)]+/g) || [];
			urls.forEach((url) => {
				if (!secrets.hiddenLinks.find((l) => l.value === url)) {
					secrets.hiddenLinks.push({
						type: "Hidden URL",
						value: url,
						source: "HTML Comment",
						context: text.substring(0, 100),
					});
				}
			});

			// Extract debug, admin, api, internal links
			const suspiciousLinks = text.match(
				/['"](\/[^\s'"]*(?:debug|admin|api|internal|private|secret|backup)[^\s'"]*)['"]/gi,
			);
			if (suspiciousLinks) {
				suspiciousLinks.forEach((m) => {
					const val = m.replace(/['"]/g, "");
					if (!secrets.hiddenLinks.find((l) => l.value === val)) {
						secrets.hiddenLinks.push({
							type: "Hidden Link",
							value: val,
							source: "HTML Comment",
							context: text.substring(0, 100),
						});
					}
				});
			}

			// Store ALL comments (not just sensitive ones)
			// This way the Comments sub-tab will show all comments from the page
			// Include the <!-- and --> markers to show the full comment
			const fullComment = `<!-- ${text} -->`;
			secrets.comments.push({
				type: "HTML Comment",
				content: fullComment,
				source: "Page Source",
			});
		}
	}

	// DEBUG: Log comment scanning results
	console.log("[collectSecretsFromPage] ===== COMMENT SCAN COMPLETE =====");
	console.log(
		"[collectSecretsFromPage] Total comments found:",
		commentTexts.length,
	);
	if (commentTexts.length === 0) {
		console.log(
			"[collectSecretsFromPage] ℹ️  No HTML comments found on this page.",
		);
		console.log(
			"[collectSecretsFromPage] This is normal for most production websites as comments are often removed during minification/build processes.",
		);
	} else {
		console.log("[collectSecretsFromPage] All comments:", commentTexts);
	}
	console.log(
		"[collectSecretsFromPage] Hidden links found:",
		secrets.hiddenLinks.length,
	);
	if (secrets.hiddenLinks.length > 0) {
		console.log(
			"[collectSecretsFromPage] Hidden links details:",
			JSON.stringify(secrets.hiddenLinks, null, 2),
		);
	} else {
		console.log(
			"[collectSecretsFromPage] WARNING: No hidden links found in comments!",
		);
	}

	// Scan all text content for suspicious patterns
	const allText = document.body.innerText;
	const allHtml = document.documentElement.outerHTML;

	// DEBUG: Check what we're scanning
	console.log("[collectSecretsFromPage] All HTML length:", allHtml.length);
	console.log("[collectSecretsFromPage] All text length:", allText.length);

	// IMPORTANT: Exclude content from injected extensions and vendor code
	// Only scan the main document content, not vendor/injected scripts
	const isVendorCode = (str) => {
		const vendorPatterns = [
			/grammarly/i,
			/live-server/i,
			/chrome-extension/i,
			/injected/i,
			/hb-blur/i,
			/sessionStorage/i,
			/Service Worker/i,
		];
		return vendorPatterns.some((p) => p.test(str));
	};

	// Extract API Keys - but filter out false positives
	for (const pattern of secretPatterns.apiKeys) {
		let match;
		while ((match = pattern.exec(allHtml))) {
			// Skip vendor code
			if (isVendorCode(match[0])) {
				console.log(
					"[collectSecretsFromPage] Skipping vendor code:",
					match[0].substring(0, 50),
				);
				continue;
			}
			secrets.apiKeys.push({
				type: "API Key",
				pattern: match[0].substring(0, 100),
				value: match[1]?.substring(0, 100),
				source: "HTML/JS",
			});
		}
	}

	// Extract Credentials - but filter out false positives
	for (const pattern of secretPatterns.credentials) {
		let match;
		while ((match = pattern.exec(allHtml))) {
			// Skip vendor code
			if (isVendorCode(match[0])) {
				console.log(
					"[collectSecretsFromPage] Skipping vendor code:",
					match[0].substring(0, 50),
				);
				continue;
			}
			secrets.credentials.push({
				type: "Credential",
				pattern: match[0].substring(0, 100),
				value: match[1]?.substring(0, 100),
				source: "HTML/JS",
			});
		}
	}

	// Extract Endpoints - but filter out false positives
	for (const pattern of secretPatterns.endpoints) {
		let match;
		while ((match = pattern.exec(allHtml))) {
			// Skip vendor code
			if (isVendorCode(match[0])) {
				console.log(
					"[collectSecretsFromPage] Skipping vendor endpoint:",
					match[0].substring(0, 50),
				);
				continue;
			}
			secrets.endpoints.push({
				type: "Endpoint",
				value: match[1]?.substring(0, 150),
				source: "HTML/JS",
			});
		}
	}

	// Extract Hidden Paths - but filter out false positives
	for (const pattern of secretPatterns.paths) {
		let match;
		while ((match = pattern.exec(allHtml))) {
			const path = match[0];
			// Skip vendor code
			if (isVendorCode(path)) {
				console.log(
					"[collectSecretsFromPage] Skipping vendor path:",
					path.substring(0, 50),
				);
				continue;
			}
			if (!secrets.paths.find((p) => p.value === path)) {
				secrets.paths.push({
					type: "Path",
					value: path,
					source: "HTML/JS",
				});
			}
		}
	}

	// Scan script tags
	for (const script of document.querySelectorAll("script")) {
		if (!script.src && script.textContent) {
			const code = script.textContent;

			// Extract JavaScript comments (both // and /* */ style)
			const jsComments = [];

			// Extract single-line comments (//)
			const singleLineComments = code.match(/\/\/.*$/gm) || [];
			singleLineComments.forEach((comment) => {
				const cleaned = comment.replace(/^\/\/\s*/, "").trim();
				if (cleaned && cleaned.length > 0) {
					jsComments.push(`// ${cleaned}`);
				}
			});

			// Extract multi-line comments (/* */)
			const multiLineComments = code.match(/\/\*[\s\S]*?\*\//g) || [];
			multiLineComments.forEach((comment) => {
				const cleaned = comment
					.replace(/^\/\*\s*/, "")
					.replace(/\s*\*\/$/, "")
					.trim();
				if (cleaned && cleaned.length > 0) {
					jsComments.push(`/* ${cleaned} */`);
				}
			});

			// Add all JS comments to secrets.comments
			jsComments.forEach((jsComment) => {
				secrets.comments.push({
					type: "JavaScript Comment",
					content: jsComment,
					source: "Script",
				});
			});

			// Look for API keys in inline scripts
			const apiKeyMatches = code.match(
				/(?:api[_-]?key|apikey|api_secret|token|auth_token)\s*[:=]\s*['""`]([a-zA-Z0-9\-_.]+)['""`]/gi,
			);
			if (apiKeyMatches) {
				apiKeyMatches.forEach((match) => {
					if (!secrets.apiKeys.find((s) => s.pattern === match)) {
						secrets.apiKeys.push({
							type: "API Key (Script)",
							pattern: match.substring(0, 100),
							source: "Script",
						});
					}
				});
			}

			// Look for credentials
			const credMatches = code.match(
				/(?:password|passwd|pwd)\s*[:=]\s*['""`]([^'""`\s]+)['""`]/gi,
			);
			if (credMatches) {
				credMatches.forEach((match) => {
					secrets.credentials.push({
						type: "Credential (Script)",
						pattern: match.substring(0, 100),
						source: "Script",
					});
				});
			}

			// Look for endpoints
			const endpointMatches = code.match(
				/(https?:\/\/[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?(?:\/[^\s'""`]*)?)/g,
			);
			if (endpointMatches) {
				endpointMatches.forEach((match) => {
					if (!secrets.endpoints.find((s) => s.value === match)) {
						secrets.endpoints.push({
							type: "Endpoint (Script)",
							value: match.substring(0, 150),
							source: "Script",
						});
					}
				});
			}
		}
	}

	// Scan CSS files for suspicious content and comments
	for (const style of document.querySelectorAll("style")) {
		const css = style.textContent;

		// Extract CSS comments (/* */ style only)
		const cssComments = css.match(/\/\*[\s\S]*?\*\//g) || [];
		cssComments.forEach((comment) => {
			const cleaned = comment
				.replace(/^\/\*\s*/, "")
				.replace(/\s*\*\/$/, "")
				.trim();
			if (cleaned && cleaned.length > 0) {
				secrets.comments.push({
					type: "CSS Comment",
					content: `/* ${cleaned} */`,
					source: "Style",
				});
			}
		});

		// Look for suspicious URLs in CSS
		const suspiciousMatches = css.match(
			/(?:url\(|@import)['"(`]([^'"`)]+)['"`)]/gi,
		);
		if (suspiciousMatches) {
			suspiciousMatches.forEach((match) => {
				if (!secrets.endpoints.find((s) => s.value === match)) {
					secrets.endpoints.push({
						type: "Resource (CSS)",
						value: match.substring(0, 150),
						source: "CSS",
					});
				}
			});
		}
	}

	// Check for data attributes that might contain sensitive info
	for (const el of document.querySelectorAll(
		"[data-api], [data-key], [data-token], [data-secret], [data-password], [data-auth]",
	)) {
		for (const attr of el.attributes) {
			if (
				attr.name.startsWith("data-") &&
				/(?:api|key|token|secret|password|auth)/.test(attr.name)
			) {
				const value = attr.value;
				if (value.length > 0 && value.length < 500) {
					secrets.apiKeys.push({
						type: "Data Attribute",
						pattern: `${attr.name}="${value.substring(0, 100)}"`,
						source: "HTML Attributes",
					});
				}
			}
		}
	}

	// Remove duplicates
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

function isSensitiveLink(url) {
	try {
		const { pathname, search, searchParams } = new URL(url);
		const path = pathname + search;
		return (
			SENSITIVE_PATTERNS.urlPatterns.some((p) => p.test(path)) ||
			SENSITIVE_PATTERNS.params.some((p) => searchParams.has(p))
		);
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

// === Theme ===

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

// === Tab Switching ===

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
	if (topLevel === "secrets") {
		setTimeout(() => renderSecrets(), 50);
	}
});

// Settings sub-tab switching via delegation
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

// Links sub-tab switching
document.getElementById("linksSubTabBar").addEventListener("click", (e) => {
	if (e.target.closest("#sensitiveLinkFilterBtn")) {
		showOnlySensitiveLinks = !showOnlySensitiveLinks;
		document
			.getElementById("sensitiveLinkFilterBtn")
			.classList.toggle("filter-active", showOnlySensitiveLinks);
		if (!document.getElementById("links-view").classList.contains("hidden"))
			renderLinks();
		else if (
			!document.getElementById("params-view").classList.contains("hidden")
		)
			renderParams();
		return;
	}

	const subTab = e.target.dataset.subtab;
	if (!subTab) return;

	document
		.querySelectorAll("#linksSubTabBar .sub-tab-item")
		.forEach((el) => el.classList.remove("sub-tab-active"));
	e.target.classList.add("sub-tab-active");

	const isParams = subTab === "links-params";
	document.getElementById("links-view").classList.toggle("hidden", isParams);
	document
		.getElementById("params-view")
		.classList.toggle("hidden", !isParams);

	if (isParams) {
		renderParams();
		return;
	}

	const CAT_MAP = {
		"links-all": "All",
		"links-paths": "Paths",
		"links-javascript": "JavaScript",
		"links-json": "JSON",
		"links-images": "Images",
		"links-others": "Others",
	};
	currentCategory = CAT_MAP[subTab] || "All";
	renderLinks();
});

// Secrets sub-tab switching
document.addEventListener("click", (e) => {
	if (!e.target.closest("#secretsSubTabBar")) return;
	if (!e.target.dataset.subtab) return;
	document
		.querySelectorAll("#secretsSubTabBar .sub-tab-item")
		.forEach((el) => el.classList.remove("sub-tab-active"));
	e.target.classList.add("sub-tab-active");
	const map = {
		"secrets-all": "all",
		"secrets-apikeys": "apiKeys",
		"secrets-credentials": "credentials",
		"secrets-endpoints": "endpoints",
		"secrets-paths": "paths",
		"secrets-hiddenlinks": "hiddenLinks",
		"secrets-comments": "comments",
	};
	currentSecretsCategory = map[e.target.dataset.subtab] || "all";
	renderSecrets();
});

// Search
document.getElementById("searchInput").addEventListener("input", (e) => {
	currentSearchQuery = e.target.value.toLowerCase();
	if (!document.getElementById("links-view").classList.contains("hidden"))
		renderLinks();
	else if (
		!document.getElementById("params-view").classList.contains("hidden")
	)
		renderParams();
});

// Secrets Search
document.addEventListener("input", (e) => {
	if (e.target.id !== "secretsSearchInput") return;
	currentSecretsSearchQuery = e.target.value.toLowerCase();
	renderSecrets();
});

// === Render Functions ===

function renderLinks() {
	const resultsDiv = document.getElementById("links-view");
	resultsDiv.innerHTML = "";

	// Update category tab counts
	for (const tab of document.querySelectorAll("#tabBar .tab-item")) {
		const type = tab.dataset.type;
		const count = allLinksGlobal.filter(
			(l) => type === "All" || l.category === type,
		).length;
		tab.innerHTML = `${type} <span class="tab-count">${count}</span>`;
	}

	const filtered = allLinksGlobal
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

	if (!filtered.length) {
		resultsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">Search</div><p class="font-semibold">No links found</p><p class="text-xs mt-1">Try adjusting your search or category filters</p></div>`;
		document.getElementById("searchResults").classList.add("hidden");
		return;
	}

	// Group by domain
	const grouped = {};
	const mainBase = cachedDomain.replace("www.", "");
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
		section.innerHTML = `
			<div class="domain-header-box">
				<div class="flex items-center">
					<img src="https://www.google.com/s2/favicons?sz=64&domain=${domain}" class="w-5 h-5 mr-3 rounded bg-white" onerror="this.src='images/links16.ico'">
					<h2 class="text-sm font-bold truncate" style="max-width:250px">${domain}</h2>
				</div>
				<span class="badge-count">${links.length} Links</span>
			</div>
			<ul class="space-y-2 ml-2">
				${links
					.map((link) => {
						const sensitive = isSensitiveLink(link.fullUrl);
						return `<li class="flex items-center text-sm">
						<span class="bullet-point mr-2">•</span>
						<a href="${link.fullUrl}" target="_blank" class="cyber-link text-blue-500 font-semibold" title="${link.fullUrl}">${link.path}</a>
						${sensitive ? '<span class="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-0.5 rounded">Sensitive</span>' : ""}
					</li>`;
					})
					.join("")}
			</ul>`;
		frag.appendChild(section);
	}
	resultsDiv.appendChild(frag);

	const searchEl = document.getElementById("searchResults");
	if (currentSearchQuery) {
		searchEl.textContent = `Found ${filtered.length} link${filtered.length !== 1 ? "s" : ""}`;
		searchEl.classList.remove("hidden");
	} else {
		searchEl.classList.add("hidden");
	}
}

function renderParams() {
	const paramsDiv = document.getElementById("params-view");
	paramsDiv.innerHTML = "";

	const allParams = {};
	for (const link of allLinksGlobal) {
		try {
			const { hostname: domain, searchParams } = new URL(link.fullUrl);
			const domParams = (allParams[domain] ||= {});
			searchParams.forEach((value, key) => {
				const entry = (domParams[key] ||= {
					values: new Set(),
				});
				entry.values.add(value);
			});
		} catch {}
	}

	let domains = Object.entries(allParams)
		.filter(([, p]) => Object.keys(p).length > 0)
		.sort((a, b) => a[0].localeCompare(b[0]));

	if (currentSearchQuery || showOnlySensitiveLinks) {
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
							(!showOnlySensitiveLinks || isSensitiveParam(name))
						);
					}),
				);
				return [domain, filtered];
			})
			.filter(([, p]) => Object.keys(p).length > 0);
	}

	if (!domains.length) {
		paramsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">No mail</div><p class="font-semibold">No parameters found</p><p class="text-xs mt-1">No URL parameters were detected on this page</p></div>`;
		return;
	}

	const frag = document.createDocumentFragment();
	for (const [domain, params] of domains) {
		const entries = Object.entries(params).sort((a, b) =>
			a[0].localeCompare(b[0]),
		);
		const section = document.createElement("div");
		section.className = "cyber-card";
		const items = entries
			.map(([name, data]) => {
				const sensitive = isSensitiveParam(name);
				const values = [...data.values].slice(0, 3);
				const more = data.values.size - 3;
				return `<li class="text-sm">
				<div class="flex items-center">
					<span class="bullet-point mr-2">•</span>
					<span class="text-blue-500 font-semibold">${name}</span>
					${sensitive ? '<span class="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-0.5 rounded">Sensitive</span>' : ""}
				</div>
				<div class="text-xs text-gray-600 dark:text-gray-400 ml-4 mt-2">
					${values.map((v) => `<div class="break-all"><code>${v.substring(0, 50)}${v.length > 50 ? "..." : ""}</code></div>`).join("")}
					${more > 0 ? `<div class="text-gray-500 italic">+${more} more value${more > 1 ? "s" : ""}</div>` : ""}
				</div>
			</li>`;
			})
			.join("");
		section.innerHTML = `
			<div class="domain-header-box">
				<div class="flex items-center">
					<img src="https://www.google.com/s2/favicons?sz=64&domain=${domain}" class="w-5 h-5 mr-3 rounded bg-white" onerror="this.src='images/links16.ico'">
					<h2 class="text-sm font-bold truncate" style="max-width:250px">${domain}</h2>
				</div>
				<span class="badge-count">${entries.length} Params</span>
			</div>
			<ul class="space-y-3 ml-2">${items}</ul>`;
		frag.appendChild(section);
	}
	paramsDiv.appendChild(frag);
}

// === Render Secrets ===

function renderSecrets() {
	const secretsDiv = document.getElementById("secrets-view");
	if (!secretsDiv) return;
	secretsDiv.innerHTML = "";

	if (
		!allSecretsGlobal.apiKeys.length &&
		!allSecretsGlobal.credentials.length &&
		!allSecretsGlobal.endpoints.length &&
		!allSecretsGlobal.paths.length &&
		!allSecretsGlobal.comments.length &&
		!allSecretsGlobal.hiddenLinks.length
	) {
		secretsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">🔍</div><p class="font-semibold">No secrets found</p><p class="text-xs mt-1">This page has no exposed sensitive information</p></div>`;
		return;
	}

	let items = [];
	if (currentSecretsCategory === "all") {
		Object.values(allSecretsGlobal).forEach((arr) => items.push(...arr));
	} else if (allSecretsGlobal[currentSecretsCategory]) {
		items = allSecretsGlobal[currentSecretsCategory];
	}

	if (currentSecretsSearchQuery) {
		items = items.filter((item) => {
			const s = currentSecretsSearchQuery;
			return (
				item.pattern?.toLowerCase().includes(s) ||
				item.value?.toLowerCase().includes(s) ||
				item.content?.toLowerCase().includes(s) ||
				item.type?.toLowerCase().includes(s)
			);
		});
	}

	if (!items.length) {
		secretsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><p class="font-semibold">No results</p></div>`;
		document
			.getElementById("secretsSearchResults")
			?.classList.add("hidden");
		return;
	}

	const grouped = {};
	items.forEach((item) => {
		(grouped[item.type] ||= []).push(item);
	});

	const frag = document.createDocumentFragment();
	Object.entries(grouped).forEach(([type, typeItems]) => {
		const div = document.createElement("div");
		div.className = "cyber-card";
		const itemsHtml = typeItems
			.map((item) => {
				const val = item.pattern || item.value || item.content || "";
				// For comments, show full content; for others, truncate to 150 chars
				const isComment =
					type === "HTML Comment" ||
					type === "JavaScript Comment" ||
					type === "CSS Comment";
				const displayVal = isComment ? val : val.substring(0, 150);
				const isHiddenLink =
					type === "Hidden Link" || type === "Hidden URL";

				// Escape HTML entities for proper display
				const escapeHtml = (text) => {
					const div = document.createElement("div");
					div.textContent = text;
					return div.innerHTML;
				};

				const linkHtml = isHiddenLink
					? `<a href="${val}" target="_blank" class="text-blue-400 hover:underline font-mono">${escapeHtml(displayVal)}</a>`
					: escapeHtml(displayVal);

				return `<li class="flex items-center text-sm gap-2">
					<span class="bullet-point mr-1">•</span>
					<code class="text-xs bg-gray-900 text-green-400 px-2 py-1 rounded font-mono flex-1 break-all">${linkHtml}${!isComment && val.length > 150 ? "..." : ""}</code>
					<span class="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap text-gray-700 dark:text-gray-300">${item.source}</span>
				</li>`;
			})
			.join("");
		div.innerHTML = `<div class="domain-header-box"><h2 class="text-sm font-bold">${type}</h2><span class="badge-count">${typeItems.length}</span></div><ul class="space-y-1 ml-2">${itemsHtml}</ul>`;
		frag.appendChild(div);
	});

	secretsDiv.appendChild(frag);
	const sr = document.getElementById("secretsSearchResults");
	if (currentSecretsSearchQuery && sr) {
		sr.textContent = `Found ${items.length} secret${items.length !== 1 ? "s" : ""}`;
		sr.classList.remove("hidden");
	} else if (sr) {
		sr.classList.add("hidden");
	}
}

// === Encoding / Decoding ===

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
		alert("Please select an encoding method");
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
		alert("Please perform an encode/decode operation first");
		return;
	}
	if (!encodeOutput.value.trim()) {
		alert("No output to repeat");
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

document.getElementById("copyResultBtn").addEventListener("click", function () {
	if (!encodeOutput.value) {
		alert("No output to copy");
		return;
	}
	navigator.clipboard.writeText(encodeOutput.value);
	flashCopied(this, this.innerHTML);
});

document.getElementById("copyBtn").addEventListener("click", function () {
	navigator.clipboard.writeText(
		allLinksGlobal.map((l) => l.fullUrl).join("\n"),
	);
	const orig = this.innerHTML;
	this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
	setTimeout(() => {
		this.innerHTML = orig;
	}, 1500);
});

document.getElementById("openTabBtn").addEventListener("click", async () => {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	});
	const domain = new URL(tab.url).hostname;
	chrome.tabs.create({
		url: chrome.runtime.getURL(
			`src/pages/popup.html?fullTab=true&domain=${domain}`,
		),
	});
});

document.getElementById("settingsBtn")?.addEventListener("click", () => {
	document.querySelector('[data-toplevel="settings"]')?.click();
});

// === Settings Functions ===

function loadPopupSettings() {
	chrome.storage.local.get(["sensitivePatterns"], (local) => {
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
		alert("Please enter at least one parameter or URL pattern");
		return;
	}
	const patterns = { params, urlPatterns };
	chrome.storage.sync.set({ sensitivePatterns: patterns });
	chrome.storage.local.set({ sensitivePatterns: patterns }, () => {
		alert("Settings saved successfully!");
		applyPatterns(patterns);
	});
}

function resetPopupToDefaults() {
	if (!confirm("Reset to default patterns?")) return;
	const defaults = {
		params: DEFAULT_PATTERNS_RAW.params,
		urlPatterns: DEFAULT_PATTERNS_RAW.urlPatterns,
	};
	chrome.storage.sync.set({ sensitivePatterns: defaults });
	chrome.storage.local.set({ sensitivePatterns: defaults }, () => {
		alert("Reset to defaults!");
		applyPatterns(defaults);
		loadPopupSettings();
	});
}

function exportPopupSettings() {
	chrome.storage.local.get(["sensitivePatterns"], (result) => {
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
		alert("Settings exported!");
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
				if (!patterns.params || !patterns.urlPatterns) {
					alert("Invalid settings file format!");
					return;
				}
				chrome.storage.sync.set({ sensitivePatterns: patterns });
				chrome.storage.local.set(
					{ sensitivePatterns: patterns },
					() => {
						alert("Settings imported successfully!");
						applyPatterns(patterns);
						loadPopupSettings();
					},
				);
			} catch {
				alert("Error parsing settings file!");
			}
		};
		reader.readAsText(file);
	});
	input.click();
}

function attachEventListeners() {
	// Use event delegation for settings buttons (works for both parameter-keywords and url-patterns tabs)
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
		?.addEventListener("click", () => {
			setTimeout(loadPopupSettings, 50);
		});
}

// === Init ===

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

		chrome.storage.local.get(["savedLinks", "savedSecrets"], (data) => {
			if (data.savedLinks) {
				allLinksGlobal = data.savedLinks;
				renderLinks();
			} else {
				// Retry once — storage write from background may still be in flight
				setTimeout(() => {
					chrome.storage.local.get(["savedLinks"], (data2) => {
						allLinksGlobal = data2.savedLinks || [];
						if (allLinksGlobal.length) renderLinks();
						else
							document.getElementById("links-view").innerHTML =
								'<p class="text-yellow-500 text-center">No links found. Try opening from the extension popup instead.</p>';
					});
				}, 200);
			}

			if (data.savedSecrets) {
				allSecretsGlobal = data.savedSecrets;
			}
		});
	} else {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (tab.url.startsWith("chrome")) {
			const linksView = document.getElementById("links-view");
			if (linksView) {
				linksView.innerHTML =
					'<p class="text-red-500 text-center">Unavailable on this page.</p>';
			}
			return;
		}
		try {
			cachedDomain = new URL(tab.url).hostname;
		} catch {}

		// Collect links and secrets
		console.log("[POPUP] Starting to collect secrets from page...");

		chrome.scripting.executeScript(
			{ target: { tabId: tab.id }, function: collectAllLinksInPage },
			(results) => {
				console.log(
					"[POPUP] collectAllLinksInPage callback fired, results:",
					results,
				);
				if (results?.[0]) {
					allLinksGlobal = results[0].result;
					chrome.storage.local.set({ savedLinks: allLinksGlobal });
					renderLinks();
				}
			},
		);

		chrome.scripting.executeScript(
			{ target: { tabId: tab.id }, function: collectSecretsFromPage },
			(results) => {
				console.log(
					"[POPUP] collectSecretsFromPage callback fired, results:",
					results,
				);
				if (results?.[0]) {
					allSecretsGlobal = results[0].result;
					console.log(
						"[POPUP] allSecretsGlobal updated:",
						allSecretsGlobal,
					);
					chrome.storage.local.set({
						savedSecrets: allSecretsGlobal,
					});
					console.log("Secrets collected:", allSecretsGlobal);
					setTimeout(() => renderSecrets(), 100);
				}
			},
		);
	}
});
