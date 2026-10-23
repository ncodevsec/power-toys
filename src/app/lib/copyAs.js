export const COPY_MODES = [
	["plain", "Plain text"],
	["json", "JSON string"],
	["escaped", "Escaped"],
];

/** plain: as-is · json: a quoted JSON string · escaped: JSON-escaped without the quotes (\n, \", \\). */
export function formatCopy(text, mode) {
	if (mode === "json") return JSON.stringify(text);
	if (mode === "escaped") return JSON.stringify(text).slice(1, -1);
	return text;
}
