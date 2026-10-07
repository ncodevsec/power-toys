function base64UrlDecode(str) {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
	return decodeURIComponent(escape(atob(padded)));
}

const WEAK_ALGS = new Set(["none", "HS256"]); // HS256 isn't inherently weak, but is the alg most often targeted for key-confusion attacks against an RS256-expecting verifier

/**
 * Decodes a JWT without verifying the signature (there's no key to verify
 * with here — this is an inspection tool, not a validator).
 * Returns { header, payload, signature, warnings[] } or throws on a
 * structurally invalid token.
 */
export function decodeJwt(token) {
	const parts = (token || "").trim().split(".");
	if (parts.length !== 3) throw new Error("A JWT has three dot-separated parts (header.payload.signature)");

	const header = JSON.parse(base64UrlDecode(parts[0]));
	const payload = JSON.parse(base64UrlDecode(parts[1]));
	const signature = parts[2];

	const warnings = [];
	if ((header.alg || "").toLowerCase() === "none") warnings.push("alg is \"none\" — the server may accept this token with no signature check at all.");
	else if (WEAK_ALGS.has(header.alg)) warnings.push(`alg is ${header.alg} — if the server expects RS256/ES256, an attacker-supplied HS256 token signed with the public key can sometimes bypass verification (the classic "algorithm confusion" attack).`);
	if (!signature) warnings.push("No signature present.");
	if (payload.exp) {
		const expiresAt = payload.exp * 1000;
		if (expiresAt < Date.now()) warnings.push(`Expired ${new Date(expiresAt).toLocaleString()}.`);
	} else {
		warnings.push("No exp claim — this token never expires.");
	}

	return { header, payload, signature, warnings };
}

export const formatClaimTime = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000).toLocaleString() : null);
