export const CIPHER_HISTORY_KEY = "cipherHistory";
export const PATH_HISTORY_KEY = "pathHistory";

const clip = (s, n = 2000) => (s.length > n ? s.slice(0, n) : s);

/** Adds a cipher run to the front of a history list (newest first), dropping
 * an immediate duplicate and trimming to `limit`. Long values are clipped. */
export function pushCipher(list, entry, limit) {
	const e = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), ...entry, input: clip(entry.input), output: clip(entry.output) };
	const top = list[0];
	const dup = top && top.method === e.method && top.op === e.op && top.input === e.input;
	return [e, ...(dup ? list.slice(1) : list)].slice(0, limit);
}

export const formatWhen = (ts) => new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
