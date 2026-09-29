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
