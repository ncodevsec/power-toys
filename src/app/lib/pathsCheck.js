/** Probes a list of candidate paths against a base URL, a handful at a
 * time, and reports which respond as present. */
export async function checkPaths(baseUrl, paths, { concurrency = 6, timeoutMs = 6000, onProgress } = {}) {
	const base = baseUrl.replace(/\/$/, "");
	const results = [];
	let i = 0;
	let done = 0;

	async function worker() {
		while (i < paths.length) {
			const path = paths[i++];
			const url = `${base}/${path.replace(/^\//, "")}`;
			let entry;
			try {
				const controller = new AbortController();
				const timer = setTimeout(() => controller.abort(), timeoutMs);
				const res = await fetch(url, { method: "GET", signal: controller.signal, credentials: "omit" });
				clearTimeout(timer);
				entry = { path, url, status: res.status, found: res.status >= 200 && res.status < 400 };
			} catch {
				entry = { path, url, status: null, found: false, error: true };
			}
			results.push(entry);
			onProgress?.(++done, paths.length);
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, paths.length || 1) }, worker));
	return results.sort((a, b) => a.path.localeCompare(b.path));
}

/** Sends a minimal introspection query to a suspected GraphQL endpoint. */
export async function checkGraphqlIntrospection(url) {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query: "{__schema{queryType{name}}}" }),
			credentials: "omit",
		});
		const data = await res.json().catch(() => null);
		return { open: !!data?.data?.__schema, status: res.status };
	} catch {
		return { open: false, status: null, error: true };
	}
}
