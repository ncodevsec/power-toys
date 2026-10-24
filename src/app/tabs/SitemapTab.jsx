import { useMemo, useState } from "react";
import { Badge, Button, Card, CardHeader, CopyButton, Dropdown, EmptyState, Icon, SearchInput, Spinner, Tabs } from "../components/ui/index.js";
import { Favicon } from "../components/Favicon.jsx";
import { SensitiveToggle, Toolbar } from "../components/Toolbar.jsx";
import { useStoredState } from "../hooks/useStoredState.js";
import { sendMessage } from "../lib/browser.js";
import { ENTRIES_KEY, STATE_KEY } from "../lib/sitemap.js";
import { downloadText, toBurpSitemap, toPostmanCollection } from "../lib/exportFormats.js";
import { cx, downloadJson, safeHref } from "../lib/utils.js";
import { isSensitiveLink } from "../lib/sensitivity.js";
import { usePatterns, useToast } from "../providers.jsx";

const KINDS = [["all", "All"], ["html", "HTML"], ["js", "JS"], ["css", "CSS"], ["xhr", "XHR"], ["other", "Other"]];
const KIND_OF = { main_frame: "html", sub_frame: "html", script: "js", stylesheet: "css", xmlhttprequest: "xhr" };
const kindOf = (type) => KIND_OF[type] || "other";
const statusTone = (s) => (!s || s >= 400 ? "danger" : "muted");
const PAGE = 200;
const SEP = "\u203a"; // node-key separator

/** Burp-style site map tree: host -> folders -> files. A request with a query
 * string is its own leaf ("login?next=/"), like Burp lists parameterised items.
 * Every node counts the requests in its whole subtree. */
function buildTree(rows) {
	const roots = new Map();
	const index = new Map();
	const node = (key, name, depth, host, type) => {
		const n = { key, name, depth, host, type, children: new Map(), entries: [], total: 0, third: true };
		index.set(key, n);
		return n;
	};
	for (const r of rows) {
		let u;
		try { u = new URL(r.url); } catch { continue; }
		const hostKey = `${u.protocol}//${u.host}`;
		let cur = roots.get(hostKey);
		if (!cur) roots.set(hostKey, (cur = node(hostKey, hostKey, 0, u.hostname, "host")));
		const chain = [cur];
		const segs = u.pathname.split("/").slice(1).map((x) => x || "/"); // "/" -> ["/"]; "/a/" -> ["a", "/"]
		segs.forEach((seg, i) => {
			const last = i === segs.length - 1;
			const name = last ? seg + u.search : seg;
			const key = cur.key + SEP + name;
			let next = cur.children.get(name);
			if (!next) { next = node(key, name, cur.depth + 1, u.hostname, last ? "file" : "dir"); cur.children.set(name, next); }
			if (!last && next.type === "file") next.type = "dir";
			cur = next;
			chain.push(cur);
		});
		cur.entries.push(r);
		for (const n of chain) { n.total++; if (!r.thirdParty) n.third = false; }
	}
	return { roots: [...roots.values()], index };
}

const hostOrder = (current) => {
	const base = (current || "").replace(/^www\./, "");
	const rev = (d) => d.split(".").reverse().join(".");
	return (a, b) => {
		const ia = !!base && (a.host === base || a.host.endsWith("." + base));
		const ib = !!base && (b.host === base || b.host.endsWith("." + base));
		if (ia !== ib) return ia ? -1 : 1;
		return rev(a.host).localeCompare(rev(b.host)) || a.key.localeCompare(b.key);
	};
};
const childOrder = (a, b) => {
	const da = a.children.size > 0, db = b.children.size > 0;
	if (da !== db) return da ? -1 : 1; // folders before files
	return a.name.localeCompare(b.name);
};

function subtreeEntries(n, out = []) {
	out.push(...n.entries);
	for (const c of n.children.values()) subtreeEntries(c, out);
	return out;
}

function TreeRow({ n, open, selected, onSelect, onToggle }) {
	const hasKids = n.children.size > 0;
	const own = n.entries[0];
	return (
		<li role="treeitem" aria-expanded={hasKids ? open : undefined} aria-selected={selected}>
			<div
				onClick={() => onSelect(n.key)}
				style={{ paddingLeft: 8 + n.depth * 14 }}
				className={cx("flex cursor-pointer items-center gap-1.5 py-1 pr-3 text-[13px]", selected ? "bg-brand-soft text-brand-ink" : "hover:bg-surface-2")}
			>
				<button type="button" aria-label={open ? "Collapse" : "Expand"} onClick={(e) => { e.stopPropagation(); if (hasKids) onToggle(n.key); }} className="grid size-4 shrink-0 place-items-center text-muted">
					{hasKids && <Icon name="chevron" size={12} className={cx("transition-transform", !open && "-rotate-90")} />}
				</button>
				{n.type === "host" ? <Favicon domain={n.host} size={18} /> : <Icon name={hasKids ? "folder" : "file"} size={14} className="text-muted" />}
				<span title={n.name} className={cx("min-w-0 flex-1 truncate font-mono", n.type === "host" && "font-semibold", n.third && n.type !== "host" && "text-muted")}>{n.name}</span>
				{n.entries.length > 0 && !hasKids && own.method !== "GET" && <Badge>{own.method}</Badge>}
				{n.entries.length > 0 && !hasKids && <Badge tone={statusTone(own.status)}>{own.status || "ERR"}</Badge>}
				<span className="shrink-0 text-[11px] text-subtle">{n.total}</span>
			</div>
		</li>
	);
}

export default function SitemapTab({ domain, fullTab = false }) {
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
	const [open, setOpen] = useState({}); // node key -> expanded (hosts default to open)
	const [selected, setSelected] = useState(null);
	const [limit, setLimit] = useState(PAGE);

	const rows = useMemo(
		() => entries.map((e) => ({ ...e, fullUrl: e.url, kind: kindOf(e.type) })),
		[entries],
	);

	const counts = useMemo(() => {
		const c = { all: rows.length };
		for (const r of rows) c[r.kind] = (c[r.kind] || 0) + 1;
		return c;
	}, [rows]);

	const filtered = useMemo(() => {
		const q = query.toLowerCase();
		return rows.filter(
			(r) =>
				(kind === "all" || r.kind === kind) &&
				(!hideThirdParty || !r.thirdParty) &&
				(!q || r.fullUrl.toLowerCase().includes(q)) &&
				(!onlySensitive || isSensitiveLink(r.fullUrl, compiled)),
		);
	}, [rows, kind, query, hideThirdParty, onlySensitive, compiled]);

	const { roots, index } = useMemo(() => buildTree(filtered), [filtered]);
	const sortedRoots = useMemo(() => [...roots].sort(hostOrder(tracking?.domain || domain)), [roots, tracking, domain]);

	const isOpen = (n) => !!query || (open[n.key] ?? n.depth === 0); // a search opens every match
	const flat = useMemo(() => {
		const out = [];
		const walk = (n) => {
			out.push(n);
			if (!n.children.size || !(!!query || (open[n.key] ?? n.depth === 0))) return;
			[...n.children.values()].sort(childOrder).forEach(walk);
		};
		sortedRoots.forEach(walk);
		return out;
	}, [sortedRoots, open, query]);

	const selectedNode = selected ? index.get(selected) : null;
	const tableRows = useMemo(() => {
		const list = selectedNode ? subtreeEntries(selectedNode) : filtered;
		return [...list].sort((a, b) => a.fullUrl.localeCompare(b.fullUrl) || a.method.localeCompare(b.method));
	}, [selectedNode, filtered]);

	const tabs = KINDS.map(([id, label]) => ({ id, label, count: counts[id] || 0 }));

	const toggle = (key) => setOpen((o) => ({ ...o, [key]: !(o[key] ?? index.get(key)?.depth === 0) }));
	const setAll = (value) => setOpen(Object.fromEntries([...index.keys()].map((k) => [k, value])));

	const onStart = async () => {
		if (!domain) return toast("No page to track", "error");
		await start(domain);
		toast("Tracking started - reload the page to capture its first requests", "success");
	};
	const onClear = async () => {
		await clear();
		setSelected(null);
		setLimit(PAGE);
		toast("Sitemap cleared", "success");
	};

	const uniqueUrls = () => [...new Map(filtered.map((r) => [r.fullUrl, r])).values()];
	const exportAs = (format) => {
		const list = uniqueUrls().map((r) => { let path = r.fullUrl; try { const u = new URL(r.fullUrl); path = u.pathname + u.search; } catch {} return { ...r, path }; });
		if (!list.length) return toast("Nothing to export", "error");
		const name = tracking?.domain || domain || "export";
		if (format === "postman") downloadJson(toPostmanCollection(list, name), `power-toys-sitemap-${name}.postman_collection.json`);
		if (format === "burp") downloadText(toBurpSitemap(list), `power-toys-sitemap-${name}.burp.xml`, "application/xml");
	};

	const shown = tableRows.slice(0, limit);

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
					<SearchInput value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} placeholder="Search recorded requests..." />

					{!flat.length ? (
						<EmptyState icon="search" title="No requests match" hint="Try adjusting the filters." />
					) : (
						<div className={cx("gap-3", fullTab ? "grid grid-cols-[minmax(280px,2fr)_3fr] items-start" : "space-y-3")}>
							<Card>
								<CardHeader
									title="Site map"
									actions={<>
										<Button size="xs" onClick={() => setAll(true)}>Expand all</Button>
										<Button size="xs" onClick={() => setAll(false)}>Collapse all</Button>
										<Badge>{filtered.length}</Badge>
									</>}
								/>
								<ul role="tree" className="max-h-[420px] overflow-auto py-1">
									{flat.map((n) => (
										<TreeRow key={n.key} n={n} open={isOpen(n)} selected={selected === n.key} onSelect={(k) => { setSelected(selected === k ? null : k); setLimit(PAGE); }} onToggle={toggle} />
									))}
								</ul>
							</Card>

							<Card>
								<CardHeader
									title={selectedNode ? selectedNode.name : "All requests"}
									actions={<>
										{selectedNode && <Button size="xs" onClick={() => setSelected(null)}>Show all</Button>}
										<Badge>{tableRows.length}</Badge>
									</>}
								/>
								<ul className="max-h-[420px] divide-y divide-line overflow-auto">
									{shown.map((r) => (
										<li key={`${r.method} ${r.url}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
											<Badge className="w-14 shrink-0 justify-center">{r.method}</Badge>
											<a href={safeHref(r.url)} target="_blank" rel="noopener noreferrer" title={r.url} className="min-w-0 flex-1 truncate font-mono text-fg hover:underline">{r.url.replace(/^https?:\/\//, "")}</a>
											{r.count > 1 && <span className="shrink-0 text-subtle">x{r.count}</span>}
											{isSensitiveLink(r.fullUrl, compiled) && <Badge tone="danger">Sensitive</Badge>}
											{r.thirdParty && <Badge>3rd party</Badge>}
											<Badge tone={statusTone(r.status)}>{r.status || "ERR"}</Badge>
											<Badge tone="brand">{r.kind.toUpperCase()}</Badge>
										</li>
									))}
								</ul>
								{tableRows.length > limit && (
									<div className="flex justify-center border-t border-line p-2">
										<Button size="xs" onClick={() => setLimit((n) => n + PAGE)}>Show more ({tableRows.length - limit} left)</Button>
									</div>
								)}
							</Card>
						</div>
					)}
				</>
			)}
		</div>
	);
}
