/**
 * Identifies likely hash algorithms from a string's length and character
 * set. Hash identification is inherently ambiguous (many algorithms share
 * a length), so this returns every plausible match rather than one guess.
 */
const HEX = /^[a-f0-9]+$/i;
const BASE64ISH = /^[a-zA-Z0-9+/]+=*$/;

const HEX_CANDIDATES = [
	[32, ["MD5", "MD4", "NTLM", "LM"]],
	[40, ["SHA-1", "RIPEMD-160"]],
	[56, ["SHA-224", "SHA3-224"]],
	[64, ["SHA-256", "SHA3-256", "BLAKE2s", "GOST"]],
	[96, ["SHA-384", "SHA3-384"]],
	[128, ["SHA-512", "SHA3-512", "BLAKE2b", "Whirlpool"]],
];

export function identifyHash(input) {
	const s = (input || "").trim();
	if (!s) return [];
	const matches = [];

	if (HEX.test(s)) {
		for (const [len, names] of HEX_CANDIDATES) {
			if (s.length === len) matches.push(...names.map((name) => ({ name, note: `${len}-char hex` })));
		}
	}

	if (/^\$2[aby]?\$\d{2}\$/.test(s)) matches.push({ name: "bcrypt", note: "$2a$/$2b$/$2y$ prefix" });
	if (/^\$1\$/.test(s)) matches.push({ name: "MD5 crypt", note: "$1$ prefix" });
	if (/^\$5\$/.test(s)) matches.push({ name: "SHA-256 crypt", note: "$5$ prefix" });
	if (/^\$6\$/.test(s)) matches.push({ name: "SHA-512 crypt", note: "$6$ prefix" });
	if (/^\$argon2(id|i|d)\$/.test(s)) matches.push({ name: "Argon2", note: "$argon2 prefix" });
	if (/^\$pbkdf2/.test(s)) matches.push({ name: "PBKDF2", note: "$pbkdf2 prefix" });

	if (/^[a-f0-9]{32}:[a-f0-9]+$/i.test(s)) matches.push({ name: "MD5 (salted, hash:salt)", note: "hash:salt format" });

	if (!matches.length && BASE64ISH.test(s) && s.length % 4 === 0) {
		const byteLen = (s.length / 4) * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
		if (byteLen === 16) matches.push({ name: "MD5 (base64)", note: `decodes to ${byteLen} bytes` });
		else if (byteLen === 20) matches.push({ name: "SHA-1 (base64)", note: `decodes to ${byteLen} bytes` });
		else if (byteLen === 32) matches.push({ name: "SHA-256 (base64)", note: `decodes to ${byteLen} bytes` });
		else if (byteLen === 64) matches.push({ name: "SHA-512 (base64)", note: `decodes to ${byteLen} bytes` });
	}

	return matches;
}
