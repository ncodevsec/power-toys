export function compileCustomPatterns(items = []) {
	return items
		.map((p) => {
			try {
				return { ...p, re: new RegExp(p.pattern, p.flags || "g") };
			} catch {
				return null; // an invalid user-edited regex is skipped, not fatal
			}
		})
		.filter(Boolean);
}

/**
 * Scans already-collected link URLs and secret values/comments (no new page
 * injection needed) against each compiled custom pattern.
 * Returns [{ name, id, matches: [{ value, source }] }], patterns with no
 * matches omitted.
 */
export function scanForCustomPatterns(compiledPatterns, { links = [], secrets = {} } = {}) {
	if (!compiledPatterns.length) return [];

	const corpus = [];
	for (const l of links) corpus.push({ text: l.fullUrl, source: "Link" });
	for (const key of ["apiKeys", "credentials", "endpoints", "paths", "comments", "hiddenLinks"]) {
		for (const item of secrets[key] || []) {
			const text = item.pattern || item.value || item.content || "";
			if (text) corpus.push({ text, source: item.type || key });
		}
	}

	const out = [];
	for (const p of compiledPatterns) {
		const seen = new Set();
		const matches = [];
		for (const { text, source } of corpus) {
			p.re.lastIndex = 0;
			let m;
			while ((m = p.re.exec(text))) {
				const key = `${m[0]}|${source}`;
				if (!seen.has(key)) {
					seen.add(key);
					matches.push({ value: m[0], source });
				}
				if (!p.re.global) break;
				if (m.index === p.re.lastIndex) p.re.lastIndex++; // guard against zero-width match loops
			}
		}
		if (matches.length) out.push({ id: p.id, name: p.name, matches });
	}
	return out;
}
