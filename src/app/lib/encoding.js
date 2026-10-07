/**
 * Shared Encoding/Decoding Utilities
 *
 * Single source of truth for every encode/decode transform, imported by the
 * popup Cipher tab and the context-menu quick view.
 *
 * Security note (HTML entity decode):
 * The previous implementation decoded HTML entities by assigning the
 * untrusted input to `div.innerHTML` and reading `textContent` back out.
 * Even though that `div` was never attached to the document, setting
 * `innerHTML` still causes the browser to *fetch* resources referenced
 * inside it (e.g. `<img src="https://attacker.example/pixel.gif">`).
 * Since this tool exists specifically to decode attacker-controlled
 * strings found on untrusted pages, that would leak the analyst's IP/UA
 * to a third party on every decode. `DOMParser` produces a document with
 * no browsing context, so referenced resources are never fetched.
 */
export const encoding = {
	base64: {
		encode: (t) => btoa(unescape(encodeURIComponent(t))),
		decode: (t) => decodeURIComponent(escape(atob(t))),
	},
	url: {
		encode: encodeURIComponent,
		decode: decodeURIComponent,
	},
	html: {
		encode: (t) => {
			const d = document.createElement("div");
			d.textContent = t;
			return d.innerHTML;
		},
		decode: (t) => {
			// Inert document — no browsing context, so no network
			// requests are made for embedded resources.
			const doc = new DOMParser().parseFromString(t, "text/html");
			return doc.documentElement.textContent || "";
		},
	},
	hex: {
		// Encode/decode over UTF-8 bytes (not UTF-16 code units). The old
		// implementation used `charCodeAt()` directly, which only produces
		// a clean 2-digit hex pair for Latin-1 code points (0-255). Any
		// character above that — emoji, accented letters, CJK, etc. —
		// produced a 3-4 digit hex chunk that silently desynced the fixed
		// 2-digit-pair decoder, corrupting the round trip.
		encode: (t) =>
			Array.from(new TextEncoder().encode(t), (b) =>
				b.toString(16).padStart(2, "0"),
			).join(""),
		decode: (t) => {
			const s = t.replace(/\s/g, "");
			const bytes = new Uint8Array(Math.floor(s.length / 2));
			for (let i = 0; i < bytes.length; i++)
				bytes[i] = parseInt(s.substr(i * 2, 2), 16);
			return new TextDecoder().decode(bytes);
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

export const METHODS = [
	["base64", "Base64"],
	["url", "URL encoding (percent-encoding)"],
	["html", "HTML entities"],
	["hex", "Hexadecimal"],
	["unicode", "Unicode escapes"],
];

const AUTO_DECODE_METHODS = ["base64", "url", "hex", "html", "unicode"];

/** Fraction of characters that are printable ASCII/whitespace — used to
 * score candidate auto-decode results. */
function printableScore(s) {
	if (!s) return 0;
	let printable = 0;
	for (const ch of s) {
		const code = ch.codePointAt(0);
		if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) printable++;
	}
	return printable / s.length;
}

/**
 * Tries every decode method, chained up to `maxDepth` layers deep (CTF
 * values are often base64-of-url-of-base64, etc.), and returns the
 * printable-looking results, best first.
 */
export function autoDecode(input, { maxDepth = 3, minScore = 0.85 } = {}) {
	const results = [];
	const seen = new Set([input]);

	function explore(text, path, depth) {
		if (depth >= maxDepth) return;
		for (const method of AUTO_DECODE_METHODS) {
			let out;
			try {
				out = encoding[method].decode(text);
			} catch {
				continue;
			}
			if (!out || seen.has(out)) continue;
			seen.add(out);
			const newPath = [...path, method];
			const score = printableScore(out);
			if (score >= minScore) results.push({ value: out, path: newPath, score });
			explore(out, newPath, depth + 1); // garbage-looking output can still decode further
		}
	}

	explore(input, [], 0);
	return results.sort((a, b) => b.score - a.score || a.path.length - b.path.length).slice(0, 8);
}
