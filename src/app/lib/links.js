const FILE_TYPE_ORDER = ["js","json","php","css","html","xml","yaml","yml","csv","svg","png","jpg","jpeg","gif","webp","ico","pdf","zip","tar","gz","txt","md","doc","docx","xls","xlsx","ppt","pptx"];

export const getFileExtension = (url) => {
	const m = url.split("?")[0].split("#")[0].match(/\.([a-zA-Z0-9]+)$/);
	return m ? m[1].toLowerCase() : null;
};

/** [{type, count}] in a predefined order, unknown types appended A-Z. */
export function sortedFileTypes(links) {
	const counts = new Map();
	for (const l of links) {
		if (l.category !== "Files") continue;
		const ext = getFileExtension(l.fullUrl);
		if (ext) counts.set(ext, (counts.get(ext) || 0) + 1);
	}
	const known = FILE_TYPE_ORDER.filter((t) => counts.has(t));
	const rest = [...counts.keys()].filter((t) => !FILE_TYPE_ORDER.includes(t)).sort();
	return [...known, ...rest].map((type) => ({ type, count: counts.get(type) }));
}

/** Group by domain; the current site first, then its subdomains, then A-Z. */
export function groupByDomain(links, current = "") {
	const groups = {};
	for (const l of links) (groups[l.domain] ||= []).push(l);
	const base = current.replace("www.", "");
	const rev = (d) => d.split(".").reverse().join(".");
	return Object.keys(groups)
		.sort((a, b) => {
			if (a === current) return -1;
			if (b === current) return 1;
			const ar = a === base || a.endsWith("." + base);
			const br = b === base || b.endsWith("." + base);
			if (ar !== br) return ar ? -1 : 1;
			return rev(a).localeCompare(rev(b));
		})
		.map((domain) => ({
			domain,
			links: groups[domain].sort((a, b) => a.path.localeCompare(b.path)),
		}));
}

export function extractUrls(text) {
	const found = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]*/g) || [];
	return [...new Set(found.map((u) => u.trim()).filter(Boolean))];
}

export function groupUrlsByHost(urls) {
	const map = new Map();
	for (const u of urls) {
		try {
			const host = new URL(u).hostname;
			map.set(host, [...(map.get(host) || []), u]);
		} catch {}
	}
	return map;
}
