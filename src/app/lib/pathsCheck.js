/** Probes one candidate path against a base URL. Never throws: a network
 * error or timeout becomes `{ found: false, error: true }`. */
export async function probePath(baseUrl, path, { timeoutMs = 6000, signal } = {}) {
	const url = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
	const controller = new AbortController();
	const onAbort = () => controller.abort();
	signal?.addEventListener("abort", onAbort);
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { method: "GET", signal: controller.signal, credentials: "omit", redirect: "manual" });
		// redirect:"manual" yields an opaque-redirect (status 0) for 3xx — treat as found.
		const redirected = res.type === "opaqueredirect";
		const status = redirected ? 302 : res.status;
		return { path, url, status, found: status >= 200 && status < 400 };
	} catch {
		return { path, url, status: null, found: false, error: true };
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", onAbort);
	}
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
