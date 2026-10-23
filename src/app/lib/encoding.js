/**
 * Cipher registry: single source of truth for every encode/decode method,
 * imported by the Cipher panel, the context-menu quick view, and auto-decode.
 *
 * Each method: { id, label, group, encode?, decode?, params? }.
 * `encode`/`decode` take (text, opts) and may return a Promise (SHA hashes).
 * A missing `encode` or `decode` means the method is one-way / read-only.
 *
 * Security note (HTML decode): uses an inert DOMParser document, never
 * `innerHTML`, so decoding attacker-controlled strings can't trigger
 * network requests for embedded resources.
 */
import * as c from "./ciphers.js";
import { decodeJwt } from "./jwt.js";

export const GROUPS = ["Encodings", "Classic ciphers", "Hashes"];

const jwtDecode = (t) => {
	const { header, payload, signature, warnings } = decodeJwt(t);
	const parts = [`Header:\n${JSON.stringify(header, null, 2)}`, `Payload:\n${JSON.stringify(payload, null, 2)}`, `Signature: ${signature || "(none)"}`];
	if (warnings.length) parts.push(`Warnings:\n${warnings.map((w) => `- ${w}`).join("\n")}`);
	return parts.join("\n\n");
};
const oneWay = (name) => () => { throw new Error(`${name} is a one-way hash and can't be decoded. Use Hash ID to identify it.`); };

export const CIPHERS = [
	{ id: "base64", label: "Base64", group: "Encodings", encode: c.base64Encode, decode: c.base64Decode },
	{ id: "base64url", label: "Base64URL", group: "Encodings", encode: c.base64urlEncode, decode: c.base64urlDecode },
	{ id: "base32", label: "Base32", group: "Encodings", encode: c.base32Encode, decode: c.base32Decode },
	{ id: "base58", label: "Base58", group: "Encodings", encode: c.base58Encode, decode: c.base58Decode },
	{ id: "hex", label: "Hexadecimal", group: "Encodings", encode: c.hexEncode, decode: c.hexDecode },
	{ id: "binary", label: "Binary", group: "Encodings", encode: c.binaryEncode, decode: c.binaryDecode },
	{ id: "octal", label: "Octal", group: "Encodings", encode: c.octalEncode, decode: c.octalDecode },
	{ id: "url", label: "URL encoding (percent-encoding)", group: "Encodings", encode: c.urlEncode, decode: c.urlDecode },
	{ id: "html", label: "HTML entities", group: "Encodings", encode: c.htmlEncode, decode: c.htmlDecode },
	{ id: "unicode", label: "Unicode escapes", group: "Encodings", encode: c.unicodeEncode, decode: c.unicodeDecode },
	{ id: "punycode", label: "Punycode (domains)", group: "Encodings", encode: c.punycodeEncode, decode: c.punycodeDecode },
	{ id: "qp", label: "Quoted-Printable", group: "Encodings", encode: c.qpEncode, decode: c.qpDecode },
	{ id: "jwt", label: "JWT (decode only)", group: "Encodings", decode: jwtDecode },
	{ id: "rot13", label: "ROT13", group: "Classic ciphers", encode: c.rot13, decode: c.rot13 },
	{ id: "rot47", label: "ROT47", group: "Classic ciphers", encode: c.rot47, decode: c.rot47 },
	{
		id: "caesar", label: "Caesar cipher", group: "Classic ciphers",
		params: [{ id: "shift", label: "Shift", min: -25, max: 25, default: 3 }],
		encode: (t, o) => c.caesar(t, o?.shift ?? 3),
		decode: (t, o) => c.caesar(t, -(o?.shift ?? 3)),
	},
	{ id: "atbash", label: "Atbash", group: "Classic ciphers", encode: c.atbash, decode: c.atbash },
	{ id: "morse", label: "Morse code", group: "Classic ciphers", encode: c.morseEncode, decode: c.morseDecode },
	{ id: "md5", label: "MD5", group: "Hashes", encode: c.md5, decode: oneWay("MD5") },
	{ id: "sha1", label: "SHA-1", group: "Hashes", encode: c.shaHash("SHA-1"), decode: oneWay("SHA-1") },
	{ id: "sha256", label: "SHA-256", group: "Hashes", encode: c.shaHash("SHA-256"), decode: oneWay("SHA-256") },
	{ id: "sha512", label: "SHA-512", group: "Hashes", encode: c.shaHash("SHA-512"), decode: oneWay("SHA-512") },
];

/** id → { encode, decode } lookup (used by the context-menu window). */
export const encoding = Object.fromEntries(CIPHERS.map((m) => [m.id, m]));
/** [id, label] pairs, for label lookups. */
export const METHODS = CIPHERS.map((m) => [m.id, m.label]);

/* ── Auto decode ────────────────────────────────────────────────────────── */

/** Cheap shape checks: which formats could this text plausibly be? Keeps
 * auto-decode from trying (and ranking) every format on every layer. */
const DETECTORS = {
	base64: (s) => /^[A-Za-z0-9+/]{4,}={0,2}$/.test(s) && s.length % 4 === 0,
	base64url: (s) => /^[A-Za-z0-9_-]{4,}$/.test(s) && (/[-_]/.test(s) || s.length % 4 !== 0),
	base32: (s) => /^[A-Z2-7]{8,}={0,6}$/.test(s),
	hex: (s) => /^(?:[0-9a-fA-F]{2})+$/.test(s),
	binary: (s) => /^[01]{8,}$/.test(s) && s.length % 8 === 0,
	octal: (s) => /^[0-7]{1,3}(?:\s+[0-7]{1,3})+$/.test(s),
	url: (s) => /%[0-9a-fA-F]{2}/.test(s),
	html: (s) => /&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(s),
	unicode: (s) => /\\u[0-9a-fA-F]{4}/.test(s),
	qp: (s) => /=[0-9A-F]{2}/.test(s),
	punycode: (s) => /xn--/i.test(s),
};

export const AUTO_LABEL = Object.fromEntries(Object.keys(DETECTORS).map((id) => [id, encoding[id].label.replace(/ \(.*\)$/, "")]));

/** Formats the text could plausibly be, e.g. ["base64", "hex"]. */
export function detectFormats(text) {
	const s = (text || "").trim();
	if (!s) return [];
	const compact = s.replace(/\s+/g, "");
	return Object.keys(DETECTORS).filter((id) => DETECTORS[id](id === "octal" || id === "url" || id === "html" || id === "unicode" || id === "qp" || id === "punycode" ? s : compact));
}

/** Fraction of characters that look like readable text. */
function readability(s) {
	if (!s) return 0;
	let ok = 0, n = 0;
	for (const ch of s) {
		n++;
		const code = ch.codePointAt(0);
		if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) ok++;
	}
	return ok / n;
}

/**
 * Tries every plausible decoder, chained up to `maxDepth` layers deep
 * (CTF values are often base64-of-url-of-hex), and returns readable results
 * best first: fully-unwrapped results, then higher readability, then fewer layers.
 * Returns [{ value, path: ["base64","url"], score, terminal }].
 */
export function autoDecode(input, { maxDepth = 3, minScore = 0.85 } = {}) {
	const results = [];
	const seen = new Set([input]);

	// Returns how many readable results were found below `text`, so a result
	// that decodes no further ("terminal") can be ranked above its own layers.
	function explore(text, path, depth) {
		let found = 0;
		if (depth >= maxDepth) return found;
		for (const method of detectFormats(text)) {
			let out;
			try { out = encoding[method].decode(text); } catch { continue; }
			if (!out || seen.has(out)) continue;
			seen.add(out);
			const newPath = [...path, method];
			const score = readability(out);
			const entry = score >= minScore ? { value: out, path: newPath, score, terminal: true } : null;
			if (entry) { results.push(entry); found++; }
			const below = explore(out, newPath, depth + 1); // unreadable output can still decode further
			if (entry && below) entry.terminal = false;
			found += below;
		}
		return found;
	}

	explore((input || "").trim(), [], 0);
	return results.sort((a, b) => Number(b.terminal) - Number(a.terminal) || b.score - a.score || a.path.length - b.path.length).slice(0, 8);
}

export const describePath = (path) => path.map((m) => AUTO_LABEL[m] || m).join(" → ");
