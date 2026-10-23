/** Small developer utilities used by Cipher → Utilities. Each throws a readable Error on bad input. */
import { base64Decode } from "./ciphers.js";

/* ── Formatters ─────────────────────────────────────────────────────────── */
export function formatJson(text, { minify = false } = {}) {
	let value;
	try { value = JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
	return minify ? JSON.stringify(value) : JSON.stringify(value, null, 2);
}

/** Decodes Base64 and, when the result is JSON, pretty-prints it. */
export function base64Pretty(text) {
	const decoded = base64Decode(text);
	try { return JSON.stringify(JSON.parse(decoded), null, 2); } catch { return decoded; }
}

/** Splits a URL into readable parts, with percent-escapes decoded. */
export function prettyUrl(text) {
	let u;
	try { u = new URL(text.trim()); } catch { throw new Error("Not a valid absolute URL — include the scheme, e.g. https://example.com/…"); }
	const dec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
	const lines = [`Scheme:   ${u.protocol.replace(":", "")}`, `Host:     ${u.hostname}`];
	if (u.port) lines.push(`Port:     ${u.port}`);
	if (u.username) lines.push(`User:     ${dec(u.username)}`);
	lines.push(`Path:     ${dec(u.pathname)}`);
	const params = [...u.searchParams.entries()];
	if (params.length) { lines.push("Query:"); for (const [k, v] of params) lines.push(`  ${k} = ${v}`); }
	if (u.hash) lines.push(`Fragment: ${dec(u.hash.slice(1))}`);
	return lines.join("\n");
}

/* ── Diff (LCS) ─────────────────────────────────────────────────────────── */
const MAX_CELLS = 4_000_000;

/** Token diff of two arrays → [{ type: "same" | "add" | "del", text }]. */
export function diffTokens(a, b) {
	const n = a.length, m = b.length;
	if (n * m > MAX_CELLS) throw new Error("Inputs are too large to diff (limit ≈ 2000 lines or words each).");
	const w = m + 1;
	const dp = new Uint32Array((n + 1) * w);
	for (let i = n - 1; i >= 0; i--)
		for (let j = m - 1; j >= 0; j--)
			dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
	const out = [];
	let i = 0, j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
		else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) out.push({ type: "del", text: a[i++] });
		else out.push({ type: "add", text: b[j++] });
	}
	while (i < n) out.push({ type: "del", text: a[i++] });
	while (j < m) out.push({ type: "add", text: b[j++] });
	return out;
}

export const diffText = (a, b, mode = "lines") => (mode === "words" ? diffTokens(a.split(/(\s+)/), b.split(/(\s+)/)) : diffTokens(a.split("\n"), b.split("\n")));

/* ── Timestamps ─────────────────────────────────────────────────────────── */
const UNITS = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
const relative = (ms) => {
	const diff = Math.round((ms - Date.now()) / 1000);
	const [unit, secs] = UNITS.find(([, s]) => Math.abs(diff) >= s) || UNITS[5];
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(diff / secs), unit);
};

/** Accepts epoch seconds, epoch milliseconds (auto-detected), or any date string. */
export function convertTime(input) {
	const s = input.trim();
	if (!s) throw new Error("Enter an epoch value or a date");
	const ms = /^-?\d+(\.\d+)?$/.test(s) ? (Math.abs(Number(s)) >= 1e11 ? Number(s) : Number(s) * 1000) : Date.parse(s);
	const d = new Date(ms);
	if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) throw new Error("Couldn't read that as an epoch or a date");
	return [
		["Seconds", String(Math.floor(ms / 1000))],
		["Milliseconds", String(Math.round(ms))],
		["ISO 8601 (UTC)", d.toISOString()],
		["UTC", d.toUTCString()],
		["Local", d.toLocaleString()],
		["Relative", relative(ms)],
	];
}

/* ── UUID ───────────────────────────────────────────────────────────────── */
export function makeUuids(count, { upper = false, dashes = true } = {}) {
	return Array.from({ length: count }, () => {
		let id = crypto.randomUUID();
		if (!dashes) id = id.replace(/-/g, "");
		return upper ? id.toUpperCase() : id;
	});
}

/* ── Regex tester ───────────────────────────────────────────────────────── */
export function testRegex(pattern, flags, text, limit = 500) {
	let re;
	try { re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g"); } catch (e) { throw new Error(e.message); }
	const out = [];
	for (const m of text.matchAll(re)) {
		out.push({ index: m.index, match: m[0], groups: m.slice(1), named: m.groups || null });
		if (out.length >= limit) break;
	}
	return out;
}
