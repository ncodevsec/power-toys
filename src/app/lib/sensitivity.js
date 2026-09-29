const test = (re, s) => {
	re.lastIndex = 0; // patterns may carry the g flag
	return re.test(s);
};

export function parseUrlPatterns(raw = []) {
	return raw
		.map((p) => {
			const m = p.match(/^\/(.*)\/([igm]*)$/);
			try {
				return m ? new RegExp(m[1], m[2]) : new RegExp(p);
			} catch {
				return null;
			}
		})
		.filter(Boolean);
}

export const compilePatterns = ({ params = [], urlPatterns = [] } = {}) => ({
	params,
	urlPatterns: parseUrlPatterns(urlPatterns),
});

export function isSensitiveLink(url, p) {
	try {
		const { pathname, search, searchParams } = new URL(url);
		const path = pathname + search;
		return (
			p.urlPatterns.some((re) => test(re, path)) ||
			p.params.some((name) => searchParams.has(name))
		);
	} catch {
		return false;
	}
}

export function isSensitiveParam(name, p) {
	const lower = name.toLowerCase();
	return p.params.some((k) => lower.includes(k) || k.includes(lower));
}

export function isSensitiveSecret(item, p) {
	const value = item.pattern || item.value || item.content || "";
	const lower = value.toLowerCase();
	return (
		p.urlPatterns.some((re) => test(re, value)) ||
		p.params.some((k) => lower.includes(k) || k.includes(lower))
	);
}
