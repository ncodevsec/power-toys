import { useMemo, useState } from "react";
import { Badge, Button, CopyButton, Dropdown, EmptyState, SearchInput, Spinner, Tabs } from "../components/ui/index.js";
import { DomainCard } from "../components/DomainCard.jsx";
import { ResultCount, SensitiveToggle, Toolbar } from "../components/Toolbar.jsx";
import { useStoredState } from "../hooks/useStoredState.js";
import { sendMessage } from "../lib/browser.js";
import { ENTRIES_KEY, STATE_KEY } from "../lib/sitemap.js";
import { groupByDomain } from "../lib/links.js";
import { downloadText, toBurpSitemap, toPostmanCollection } from "../lib/exportFormats.js";
import { downloadJson, safeHref } from "../lib/utils.js";
import { isSensitiveLink } from "../lib/sensitivity.js";
import { usePatterns, useToast } from "../providers.jsx";

const KINDS = [["all", "All"], ["html", "HTML"], ["js", "JS"], ["css", "CSS"], ["xhr", "XHR"], ["other", "Other"]];
const KIND_OF = { main_frame: "html", sub_frame: "html", script: "js", stylesheet: "css", xmlhttprequest: "xhr" };
const kindOf = (type) => KIND_OF[type] || "other";
const statusTone = (s) => (!s || s >= 400 ? "danger" : "muted");
const PAGE = 300;

export default function SitemapTab({ domain }) {
	const { compiled } = usePatterns();
	const toast = useToast();
	const [tracking] = useStoredState(STATE_KEY, null);
	const [entriesMap, , loaded] = useStoredState(ENTRIES_KEY, {});
	const entries = useMemo(() => Object.values(entriesMap || {}), [entriesMap]);
	const start = (d) => sendMessage({ action: "sitemapStart", domain: d });
	const stop = () => sendMessage({ action: "sitemapStop" });
	const clear = () => sendMessage({ action: "sitemapClear" });
	const [kind, setKind] = useState("all");
	const [query, setQuery] = useState("");
	const [onlySensitive, setOnlySensitive] = useState(false);
	const [hideThirdParty, setHideThirdParty] = useState(false);
	const [limit, setLimit] = useState(PAGE);

	const rows = useMemo(
		() =>
			entries.map((e) => {
				let host = "", path = e.url;
				try {
					const u = new URL(e.url);
					host = u.hostname;
					path = u.pathname + u.search;
				} catch {}
				return { ...e, fullUrl: e.url, domain: host, path, kind: kindOf(e.type) };
			}),
		[entries],
	);

	const counts = useMemo(() => {
		const c = { all: rows.length };
		for (const r of rows) c[r.kind] = (c[r.kind] || 0) + 1;
		return c;
	}, [rows]);

	const filtered = useMemo(() => {
		const q = query.toLowerCase();
		return rows
			.filter(
				(r) =>
					(kind === "all" || r.kind === kind) &&
					(!hideThirdParty || !r.thirdParty) &&
					(!q || r.fullUrl.toLowerCase().includes(q)) &&
					(!onlySensitive || isSensitiveLink(r.fullUrl, compiled)),
			)
			.sort((a, b) => b.lastSeen - a.lastSeen);
	}, [rows, kind, query, hideThirdParty, onlySensitive, compiled]);

	const groups = useMemo(() => groupByDomain(filtered.slice(0, limit), tracking?.domain || domain), [filtered, limit, tracking, domain]);

	const tabs = KINDS.map(([id, label]) => ({ id, label, count: counts[id] || 0 }));

	const onStart = async () => {
		if (!domain) return toast("No page to track", "error");
		await start(domain);
		toast("Tracking started - reload the page to capture its first requests", "success");
	};

	const onClear = async () => {
		await clear();
		setLimit(PAGE);
		toast("Sitemap cleared", "success");
	};

	const uniqueUrls = () => [...new Map(filtered.map((r) => [r.fullUrl, r])).values()];

	const exportAs = (format) => {
		const list = uniqueUrls();
		if (!list.length) return toast("Nothing to export", "error");
		const name = tracking?.domain || domain || "export";
		if (format === "postman") downloadJson(toPostmanCollection(list, name), `power-toys-sitemap-${name}.postman_collection.json`);
		if (format === "burp") downloadText(toBurpSitemap(list), `power-toys-sitemap-${name}.burp.xml`, "application/xml");
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					{tracking && <span className="size-2 shrink-0 animate-pulse rounded-full bg-brand" />}
					<p className="text-xs text-muted">
						{tracking ? (
							<>Recording <span className="font-mono text-fg">{tracking.domain}</span> - browse the site and requests show up here live.</>
						) : (
							<>Records the pages, scripts, styles and XHR/fetch calls your browser makes on <span className="font-mono text-fg">{domain || "this site"}</span>.</>
						)}
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					{tracking ? (
						<Button variant="primary" size="md" icon="stop" onClick={() => stop()}>Stop</Button>
					) : (
						<Button variant="primary" size="md" icon="record" onClick={onStart}>Start tracking</Button>
					)}
					<Button size="md" icon="trash" onClick={onClear}>Clear</Button>
				</div>
			</div>

			{!loaded && <Spinner />}

			{loaded && !rows.length && (
				<EmptyState
					icon="sitemap"
					title="Nothing recorded yet"
					hint={tracking ? "Reload the page or click around - new requests appear here as they happen." : "Click Start tracking, then browse the site."}
				/>
			)}

			{loaded && !!rows.length && (
				<>
					<Toolbar
						left={<Tabs variant="chip" items={tabs} value={kind} onChange={(k) => { setKind(k); setLimit(PAGE); }} />}
						right={<>
							<Button icon="external" active={hideThirdParty} onClick={() => setHideThirdParty((v) => !v)} title="Hide requests to other domains">1st party</Button>
							<SensitiveToggle active={onlySensitive} onClick={() => setOnlySensitive((v) => !v)} />
							<CopyButton getText={() => uniqueUrls().map((r) => r.fullUrl).join("\n")} empty="No URLs to copy" />
							<Dropdown icon="download" label="Export" items={[
								{ label: "Postman collection", onClick: () => exportAs("postman") },
								{ label: "Burp sitemap (XML)", onClick: () => exportAs("burp") },
							]} />
						</>}
					/>
					<SearchInput value={query} onChange={setQuery} placeholder="Search recorded requests..." />
					<ResultCount show={!!query} count={filtered.length} />

					{!groups.length ? (
						<EmptyState icon="search" title="No requests match" hint="Try adjusting the filters." />
					) : (
						groups.map(({ domain: d, links: group }) => (
							<DomainCard key={d} domain={d} count={group.length} unit="requests" getCopyText={() => group.map((r) => r.fullUrl).join("\n")}>
								{group.map((r) => (
									<li key={`${r.method} ${r.url}`} className="flex items-center gap-2.5 px-4 py-2 text-sm">
										<Badge className="w-14 shrink-0 justify-center">{r.method}</Badge>
										<a href={safeHref(r.url)} target="_blank" rel="noopener noreferrer" title={r.url} className="min-w-0 flex-1 truncate font-medium text-fg hover:underline">{r.path}</a>
										{r.count > 1 && <span className="shrink-0 text-xs text-subtle">x{r.count}</span>}
										{isSensitiveLink(r.fullUrl, compiled) && <Badge tone="danger">Sensitive</Badge>}
										{r.thirdParty && <Badge>3rd party</Badge>}
										<Badge tone={statusTone(r.status)}>{r.status || "ERR"}</Badge>
										<Badge tone="brand">{r.kind.toUpperCase()}</Badge>
									</li>
								))}
							</DomainCard>
						))
					)}

					{filtered.length > limit && (
						<div className="flex justify-center">
							<Button onClick={() => setLimit((n) => n + PAGE)}>Show more ({filtered.length - limit} left)</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
