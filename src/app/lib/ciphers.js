/**
 * Pure cipher/encoding algorithms. Every function takes a string and returns
 * a string, throwing an Error with a user-readable message on invalid input.
 * Byte-oriented codecs work over UTF-8 so non-Latin text round-trips.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
const toBytes = (t) => enc.encode(t);
const fromBytes = (b) => dec.decode(b);
const stripWs = (t) => t.replace(/\s+/g, "");
const fail = (name, why) => { throw new Error(`Invalid ${name}: ${why}`); };
const badChar = (name, t, re) => { const m = t.match(re); if (m) fail(name, `unexpected character "${m[0]}"`); };

/* ── Base64 / Base64URL ─────────────────────────────────────────────────── */
const bin = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");
export const base64Encode = (t) => btoa(bin(toBytes(t)));
export function base64Decode(t) {
	let s = stripWs(t);
	badChar("Base64", s, /[^A-Za-z0-9+/=]/);
	s = s.replace(/=+$/, "");
	if (s.length % 4 === 1) fail("Base64", "length can't be right (a stray trailing character)");
	const raw = atob(s.padEnd(s.length + ((4 - (s.length % 4)) % 4), "="));
	return fromBytes(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
}
export const base64urlEncode = (t) => base64Encode(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function base64urlDecode(t) {
	const s = stripWs(t);
	badChar("Base64URL", s, /[^A-Za-z0-9\-_=]/);
	return base64Decode(s.replace(/-/g, "+").replace(/_/g, "/"));
}

/* ── Base32 (RFC 4648) ──────────────────────────────────────────────────── */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(t) {
	let bits = 0, val = 0, out = "";
	for (const b of toBytes(t)) {
		val = (val << 8) | b; bits += 8;
		while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
	}
	if (bits) out += B32[(val << (5 - bits)) & 31];
	return out + "=".repeat((8 - (out.length % 8)) % 8);
}
export function base32Decode(t) {
	const s = stripWs(t).toUpperCase().replace(/=+$/, "");
	badChar("Base32", s, /[^A-Z2-7]/);
	let bits = 0, val = 0;
	const out = [];
	for (const c of s) {
		val = (val << 5) | B32.indexOf(c); bits += 5;
		if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
	}
	return fromBytes(Uint8Array.from(out));
}

/* ── Base58 (Bitcoin alphabet) ──────────────────────────────────────────── */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Encode(t) {
	const bytes = toBytes(t);
	let zeros = 0;
	while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
	let n = 0n;
	for (const b of bytes) n = (n << 8n) | BigInt(b);
	let out = "";
	while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
	return "1".repeat(zeros) + out;
}
export function base58Decode(t) {
	const s = stripWs(t);
	badChar("Base58", s, /[^1-9A-HJ-NP-Za-km-z]/);
	let zeros = 0;
	while (zeros < s.length && s[zeros] === "1") zeros++;
	let n = 0n;
	for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
	const out = [];
	while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
	return fromBytes(Uint8Array.from([...new Array(zeros).fill(0), ...out]));
}

/* ── Hex / binary / octal ───────────────────────────────────────────────── */
export const hexEncode = (t) => Array.from(toBytes(t), (b) => b.toString(16).padStart(2, "0")).join("");
export function hexDecode(t) {
	const s = stripWs(t).replace(/0x|\\x/gi, "");
	badChar("hex", s, /[^0-9a-fA-F]/);
	if (s.length % 2) fail("hex", "odd number of digits");
	return fromBytes(Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16)));
}
export const binaryEncode = (t) => Array.from(toBytes(t), (b) => b.toString(2).padStart(8, "0")).join(" ");
export function binaryDecode(t) {
	const s = stripWs(t);
	badChar("binary", s, /[^01]/);
	if (s.length % 8) fail("binary", `length ${s.length} isn't a multiple of 8 bits`);
	return fromBytes(Uint8Array.from(s.match(/.{8}/g) || [], (b) => parseInt(b, 2)));
}
export const octalEncode = (t) => Array.from(toBytes(t), (b) => b.toString(8).padStart(3, "0")).join(" ");
export function octalDecode(t) {
	const parts = t.trim().split(/[\s,]+/).filter(Boolean);
	return fromBytes(Uint8Array.from(parts, (p) => {
		if (!/^[0-7]{1,3}$/.test(p)) fail("octal", `"${p}" isn't an octal byte`);
		const v = parseInt(p, 8);
		if (v > 255) fail("octal", `"${p}" is larger than 377`);
		return v;
	}));
}

/* ── URL / HTML / Unicode escapes ───────────────────────────────────────── */
export const urlEncode = encodeURIComponent;
export function urlDecode(t) {
	try { return decodeURIComponent(t); } catch { return fail("URL encoding", "malformed % sequence"); }
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
export function htmlEncode(t) {
	if (typeof document === "undefined") return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); // background worker has no DOM
	const d = document.createElement("div");
	d.textContent = t;
	return d.innerHTML;
}
export function htmlDecode(t) {
	if (typeof DOMParser === "undefined") { // background worker: decode the common entities by hand
		return t.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) => (d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : ENT[n.toLowerCase()] ?? m));
	}
	// DOMParser makes an inert document, so embedded resources are never fetched.
	return new DOMParser().parseFromString(t, "text/html").documentElement.textContent || "";
}
export const unicodeEncode = (t) => Array.from(t, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
export function unicodeDecode(t) {
	if (!/\\u[0-9a-fA-F]{4}/.test(t)) fail("Unicode escapes", "no \\uXXXX sequences found");
	return t.replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

/* ── Punycode (RFC 3492), applied per domain label ──────────────────────── */
const PB = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700;
const adapt = (delta, n, first) => {
	delta = first ? Math.floor(delta / DAMP) : delta >> 1;
	delta += Math.floor(delta / n);
	let k = 0;
	while (delta > ((PB - TMIN) * TMAX) >> 1) { delta = Math.floor(delta / (PB - TMIN)); k += PB; }
	return Math.floor(k + ((PB - TMIN + 1) * delta) / (delta + SKEW));
};
const digit = (d) => String.fromCharCode(d < 26 ? 97 + d : 22 + d);
const threshold = (k, bias) => (k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias);
function punyEncodeLabel(label) {
	const cps = Array.from(label, (c) => c.codePointAt(0));
	let out = cps.filter((c) => c < 128).map((c) => String.fromCharCode(c)).join("");
	const b = out.length;
	let h = b;
	if (b) out += "-";
	let n = 128, delta = 0, bias = 72;
	while (h < cps.length) {
		const m = Math.min(...cps.filter((c) => c >= n));
		delta += (m - n) * (h + 1);
		n = m;
		for (const c of cps) {
			if (c < n) delta++;
			if (c === n) {
				let q = delta;
				for (let k = PB; ; k += PB) {
					const t = threshold(k, bias);
					if (q < t) break;
					out += digit(t + ((q - t) % (PB - t)));
					q = Math.floor((q - t) / (PB - t));
				}
				out += digit(q);
				bias = adapt(delta, h + 1, h === b);
				delta = 0;
				h++;
			}
		}
		delta++; n++;
	}
	return out;
}
function punyDecodeLabel(input) {
	const lastDash = input.lastIndexOf("-");
	const out = lastDash > 0 ? Array.from(input.slice(0, lastDash), (c) => c.codePointAt(0)) : [];
	let i = 0, n = 128, bias = 72;
	for (let idx = lastDash > 0 ? lastDash + 1 : 0; idx < input.length;) {
		const oldi = i;
		for (let w = 1, k = PB; ; k += PB) {
			if (idx >= input.length) fail("Punycode", "input ends unexpectedly");
			const c = input.charCodeAt(idx++);
			const d = c >= 48 && c <= 57 ? c - 22 : c >= 65 && c <= 90 ? c - 65 : c >= 97 && c <= 122 ? c - 97 : PB;
			if (d >= PB) fail("Punycode", `unexpected character "${input[idx - 1]}"`);
			i += d * w;
			const t = threshold(k, bias);
			if (d < t) break;
			w *= PB - t;
		}
		const len = out.length + 1;
		bias = adapt(i - oldi, len, oldi === 0);
		n += Math.floor(i / len);
		i %= len;
		out.splice(i++, 0, n);
	}
	return String.fromCodePoint(...out);
}
export const punycodeEncode = (t) => t.split(".").map((l) => (/[^\x00-\x7f]/.test(l) ? "xn--" + punyEncodeLabel(l) : l)).join(".");
export function punycodeDecode(t) {
	if (!/xn--/i.test(t)) fail("Punycode", 'no "xn--" label found');
	return t.split(".").map((l) => (/^xn--/i.test(l) ? punyDecodeLabel(l.slice(4)) : l)).join(".");
}

/* ── Quoted-Printable ───────────────────────────────────────────────────── */
export function qpEncode(t) {
	const b = toBytes(t);
	let out = "", line = 0;
	for (let i = 0; i < b.length; i++) {
		const c = b[i], next = b[i + 1];
		if (c === 13 && next === 10) { out += "\r\n"; i++; line = 0; continue; }
		if (c === 10) { out += "\n"; line = 0; continue; }
		const literal = (c >= 33 && c <= 126 && c !== 61) || ((c === 32 || c === 9) && next !== undefined && next !== 10 && next !== 13);
		const tok = literal ? String.fromCharCode(c) : "=" + c.toString(16).toUpperCase().padStart(2, "0");
		if (line + tok.length > 75) { out += "=\r\n"; line = 0; }
		out += tok; line += tok.length;
	}
	return out;
}
export function qpDecode(t) {
	const s = t.replace(/=\r?\n/g, "");
	const bytes = [];
	for (let i = 0; i < s.length; i++) {
		if (s[i] === "=") {
			const h = s.slice(i + 1, i + 3);
			if (!/^[0-9A-Fa-f]{2}$/.test(h)) fail("Quoted-Printable", `"=" at position ${i + 1} isn't followed by two hex digits`);
			bytes.push(parseInt(h, 16)); i += 2;
		} else bytes.push(...toBytes(s[i]));
	}
	return fromBytes(Uint8Array.from(bytes));
}

/* ── Classic ciphers ────────────────────────────────────────────────────── */
const mapChars = (t, fn) => Array.from(t, fn).join("");
export const rot13 = (t) => mapChars(t, (c) => (/[a-z]/i.test(c) ? String.fromCharCode(((c.charCodeAt(0) - (c <= "Z" ? 65 : 97) + 13) % 26) + (c <= "Z" ? 65 : 97)) : c));
export const rot47 = (t) => mapChars(t, (c) => { const x = c.charCodeAt(0); return x >= 33 && x <= 126 ? String.fromCharCode(33 + ((x - 33 + 47) % 94)) : c; });
export function caesar(t, shift = 3) {
	const s = ((Math.trunc(Number(shift)) % 26) + 26) % 26;
	if (Number.isNaN(Number(shift))) fail("shift", "enter a whole number");
	return mapChars(t, (c) => {
		if (!/[a-z]/i.test(c)) return c;
		const base = c <= "Z" ? 65 : 97;
		return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
	});
}
export const atbash = (t) => mapChars(t, (c) => (/[a-z]/i.test(c) ? String.fromCharCode((c <= "Z" ? 90 : 122) - (c.charCodeAt(0) - (c <= "Z" ? 65 : 97))) : c));

const MORSE = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.", ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", _: "..--.-", '"': ".-..-.", $: "...-..-", "@": ".--.-." };
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
export const morseEncode = (t) => t.toUpperCase().split(/\s+/).filter(Boolean).map((w) => Array.from(w, (c) => MORSE[c] ?? fail("Morse", `no code for "${c}"`)).join(" ")).join(" / ");
export function morseDecode(t) {
	badChar("Morse", t, /[^.\-/|\s·−_]/);
	const norm = t.replace(/[·]/g, ".").replace(/[−_]/g, "-");
	return norm.trim().split(/\s*[/|]\s*|\s{3,}/).map((w) => w.trim().split(/\s+/).map((s) => MORSE_REV[s] ?? fail("Morse", `"${s}" isn't a known Morse sequence`)).join("")).join(" ");
}

/* ── Hashes (one-way) ───────────────────────────────────────────────────── */
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
export const shaHash = (algo) => async (t) => hex(await crypto.subtle.digest(algo, toBytes(t)));

export function md5(t) {
	const bytes = toBytes(t);
	const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
	const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
	const len = bytes.length;
	const blocks = ((len + 8) >> 6) + 1;
	const w = new Uint32Array(blocks * 16);
	for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
	w[len >> 2] |= 0x80 << ((len % 4) * 8);
	w[blocks * 16 - 2] = (len * 8) >>> 0;
	w[blocks * 16 - 1] = Math.floor(len / 0x20000000);
	let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
	for (let o = 0; o < w.length; o += 16) {
		let A = a0, B = b0, C = c0, D = d0;
		for (let i = 0; i < 64; i++) {
			let F, g;
			if (i < 16) { F = (B & C) | (~B & D); g = i; }
			else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
			else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
			else { F = C ^ (B | ~D); g = (7 * i) % 16; }
			F = (F + A + K[i] + w[o + g]) >>> 0;
			A = D; D = C; C = B;
			const s = S[(i >> 4) * 4 + (i % 4)];
			B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
		}
		a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
	}
	const le = (n) => Array.from({ length: 4 }, (_, i) => ((n >>> (i * 8)) & 255).toString(16).padStart(2, "0")).join("");
	return le(a0) + le(b0) + le(c0) + le(d0);
}
