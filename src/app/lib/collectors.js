/**
 * Page collectors.
 *
 * These functions are serialized by `scripting.executeScript({ func })` and
 * executed INSIDE the inspected page, so each one must be fully
 * self-contained: no imports, no closures, no shared helpers.
 * They are the single source for both the popup and the context-menu page
 * action (background.js) - previously they were duplicated in both files.
 */

export function collectAllLinksInPage() {
	const uniqueLinks = new Map();
	const EXT_RE = /\.[a-zA-Z0-9]+$/;
	const selectors =
		"a[href],link[href],script[src],img[src],iframe[src],source[src],video[src],audio[src],[data-url]";

	for (const tag of document.querySelectorAll(selectors)) {
		const url = tag.href || tag.src || tag.getAttribute("data-url");
		if (!url?.startsWith("http") || uniqueLinks.has(url)) continue;

		const cleanUrl = url.split("?")[0].split("#")[0];
		let category;
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

export function collectSecretsFromPage() {
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
