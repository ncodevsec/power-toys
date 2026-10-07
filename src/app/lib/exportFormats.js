export function toPostmanCollection(links, name = "Power Toys Export") {
	return {
		info: { name, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
		item: links.map((l) => {
			let url;
			try {
				const u = new URL(l.fullUrl);
				url = {
					raw: l.fullUrl,
					protocol: u.protocol.replace(":", ""),
					host: u.hostname.split("."),
					path: u.pathname.split("/").filter(Boolean),
					query: [...u.searchParams.entries()].map(([key, value]) => ({ key, value })),
				};
			} catch {
				url = { raw: l.fullUrl };
			}
			return { name: l.path || l.fullUrl, request: { method: "GET", header: [], url } };
		}),
	};
}

const escXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A simplified version of Burp Suite's "save selected items" sitemap XML —
 * covers the fields Burp needs to re-import a list of target URLs. */
export function toBurpSitemap(links) {
	const now = new Date().toISOString();
	const items = links
		.map((l) => {
			let host = "", port = "443", protocol = "https", path = l.fullUrl;
			try {
				const u = new URL(l.fullUrl);
				host = u.hostname;
				protocol = u.protocol.replace(":", "");
				port = u.port || (protocol === "https" ? "443" : "80");
				path = u.pathname + u.search;
			} catch {}
			return [
				"  <item>",
				`    <time>${now}</time>`,
				`    <url><![CDATA[${l.fullUrl}]]></url>`,
				`    <host ip="">${escXml(host)}</host>`,
				`    <port>${port}</port>`,
				`    <protocol>${protocol}</protocol>`,
				`    <path><![CDATA[${escXml(path)}]]></path>`,
				"    <method>GET</method>",
				"  </item>",
			].join("\n");
		})
		.join("\n");
	return `<?xml version="1.0"?>\n<items burpVersion="1.0" exportTime="${now}">\n${items}\n</items>`;
}

export function downloadText(text, filename, mime = "text/plain") {
	const url = URL.createObjectURL(new Blob([text], { type: mime }));
	const a = Object.assign(document.createElement("a"), { href: url, download: filename });
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
