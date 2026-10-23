import { useMemo, useState } from "react";
import { Badge, Button, CopyButton, Dropdown, EmptyState, Modal, SearchInput, Select, Tabs } from "../components/ui/index.js";
import { DomainCard } from "../components/DomainCard.jsx";
import { ResultCount, SensitiveToggle, Toolbar } from "../components/Toolbar.jsx";
import { getFileExtension, groupByDomain, sortedFileTypes } from "../lib/links.js";
import { isSensitiveLink } from "../lib/sensitivity.js";
import { toBurpSitemap, toCsv, toPostmanCollection, downloadText } from "../lib/exportFormats.js";
import { downloadJson } from "../lib/utils.js";
import { sendMessage } from "../lib/browser.js";
import { usePatterns, useToast } from "../providers.jsx";

const CATEGORIES = ["All", "Paths", "Files", "Others"];
const SORTS = [["path", "Path A–Z"], ["pathDesc", "Path Z–A"], ["sensitive", "Sensitive first"], ["short", "Shortest first"], ["long", "Longest first"]];
const OPEN_CONFIRM_OVER = 15;

/** Same page = same URL ignoring #fragment and a trailing slash. */
const normalizeUrl = (u) => {
	try { const x = new URL(u); x.hash = ""; return x.toString().replace(/\/$/, ""); } catch { return u; }
};

export default function LinksTab({ links, domain }) {
	const { compiled } = usePatterns();
	const toast = useToast();
	const [category, setCategory] = useState("All");
	const [fileType, setFileType] = useState(null);
	const [query, setQuery] = useState("");
	const [onlySensitive, setOnlySensitive] = useState(false);
	const [unique, setUnique] = useState(false);
	const [sort, setSort] = useState("path");
	const [selected, setSelected] = useState(() => new Set());
	const [confirmOpen, setConfirmOpen] = useState(null); // urls awaiting confirmation

	const { filtered, removed } = useMemo(() => {
		const q = query.toLowerCase();
		const matched = links.filter(
			(l) =>
				(category === "All" || l.category === category) &&
				(!q || l.fullUrl.toLowerCase().includes(q) || l.domain.includes(q) || l.path.toLowerCase().includes(q)) &&
				(!onlySensitive || isSensitiveLink(l.fullUrl, compiled)),
		);
		if (!unique) return { filtered: matched, removed: 0 };
		const seen = new Set();
		const deduped = matched.filter((l) => { const k = normalizeUrl(l.fullUrl); if (seen.has(k)) return false; seen.add(k); return true; });
		return { filtered: deduped, removed: matched.length - deduped.length };
	}, [links, category, query, onlySensitive, unique, compiled]);

	const fileTypes = category === "Files" ? sortedFileTypes(filtered) : [];
	const visible = category === "Files" && fileType ? filtered.filter((l) => getFileExtension(l.fullUrl) === fileType) : filtered;

	const groups = useMemo(() => {
		const cmp = {
			path: (a, b) => a.path.localeCompare(b.path),
			pathDesc: (a, b) => b.path.localeCompare(a.path),
			sensitive: (a, b) => Number(isSensitiveLink(b.fullUrl, compiled)) - Number(isSensitiveLink(a.fullUrl, compiled)) || a.path.localeCompare(b.path),
			short: (a, b) => a.fullUrl.length - b.fullUrl.length,
			long: (a, b) => b.fullUrl.length - a.fullUrl.length,
		}[sort];
		return groupByDomain(visible, domain).map((g) => ({ ...g, links: [...g.links].sort(cmp) }));
	}, [visible, domain, sort, compiled]);

	const tabs = CATEGORIES.map((c) => ({ id: c, label: c, count: c === "All" ? links.length : links.filter((l) => l.category === c).length }));

	const selectedVisible = visible.filter((l) => selected.has(l.fullUrl));
	const toggle = (url) => setSelected((s) => { const n = new Set(s); n.has(url) ? n.delete(url) : n.add(url); return n; });

	const exportAs = (format) => {
		if (!visible.length) return toast("No links to export", "error");
		const name = domain || "export";
		if (format === "postman") downloadJson(toPostmanCollection(visible, domain || "Power Toys Export"), `power-toys-links-${name}.postman_collection.json`);
		if (format === "burp") downloadText(toBurpSitemap(visible), `power-toys-links-${name}.burp.xml`, "application/xml");
		if (format === "csv") downloadText(toCsv(visible, (u) => isSensitiveLink(u, compiled)), `power-toys-links-${name}.csv`, "text/csv");
		if (format === "json") downloadJson(visible.map((l) => ({ ...l, sensitive: isSensitiveLink(l.fullUrl, compiled) })), `power-toys-links-${name}.json`);
	};

	const openUrls = async (urls) => {
		if (!urls.length) return toast("No links to open", "error");
		if (urls.length > OPEN_CONFIRM_OVER && confirmOpen !== urls) return setConfirmOpen(urls);
		setConfirmOpen(null);
		await sendMessage({ action: "openUrlsInNewTabs", urls });
		toast(`Opening ${urls.length} link${urls.length > 1 ? "s" : ""}…`, "success");
	};

	return (
		<div className="space-y-3">
			<Toolbar
				left={<Tabs variant="chip" items={tabs} value={category} onChange={(c) => { setCategory(c); setFileType(null); }} />}
				right={<>
					<SensitiveToggle active={onlySensitive} onClick={() => setOnlySensitive((v) => !v)} />
					<CopyButton getText={() => visible.map((l) => l.fullUrl).join("\n")} label="Copy all" empty="No links to copy" />
					<Dropdown icon="external" label="Open" items={[
						{ label: `Open selected (${selectedVisible.length})`, onClick: () => openUrls(selectedVisible.map((l) => l.fullUrl)) },
						{ label: `Open all (${visible.length})`, onClick: () => openUrls(visible.map((l) => l.fullUrl)) },
					]} />
					<Dropdown icon="download" label="Export" items={[
						{ label: "CSV", onClick: () => exportAs("csv") },
						{ label: "JSON", onClick: () => exportAs("json") },
						{ label: "Postman collection", onClick: () => exportAs("postman") },
						{ label: "Burp sitemap (XML)", onClick: () => exportAs("burp") },
					]} />
				</>}
			/>
			{fileTypes.length > 0 && (
				<Tabs
					variant="chip"
					value={fileType ?? "all"}
					onChange={(t) => setFileType(t === "all" ? null : t)}
					items={[{ id: "all", label: "All", count: fileTypes.reduce((s, f) => s + f.count, 0) }, ...fileTypes.map((f) => ({ id: f.type, label: f.type.toUpperCase(), count: f.count }))]}
				/>
			)}
			<SearchInput value={query} onChange={setQuery} placeholder="Search links…" />

			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-1.5">
					<Button size="xs" active={unique} icon="copy" onClick={() => setUnique((v) => !v)} title="Hide links that point to the same page (ignoring #fragment and a trailing slash)">Remove duplicates</Button>
					<Button size="xs" onClick={() => setSelected(new Set(visible.map((l) => l.fullUrl)))}>Select all</Button>
					{!!selected.size && <Button size="xs" icon="x" onClick={() => setSelected(new Set())}>Clear selection</Button>}
					{!!selectedVisible.length && <Badge tone="brand">{selectedVisible.length} selected</Badge>}
					{unique && removed > 0 && <Badge>{removed} duplicate{removed > 1 ? "s" : ""} hidden</Badge>}
				</div>
				<div className="w-40"><Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort links" className="!py-1.5 !text-xs">{SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select></div>
			</div>
			<ResultCount show={!!query} count={visible.length} />

			{!groups.length ? (
				<EmptyState icon="search" title="No links found" hint="Try adjusting your search, filters, or turning off Remove duplicates." />
			) : (
				groups.map(({ domain: d, links: group }) => (
					<DomainCard key={d} domain={d} count={group.length} unit="links" getCopyText={() => group.map((l) => l.fullUrl).join("\n")}>
						{group.map((l) => (
							<li key={l.fullUrl} className="flex items-center gap-2.5 px-4 py-2 text-sm">
								<input type="checkbox" checked={selected.has(l.fullUrl)} onChange={() => toggle(l.fullUrl)} aria-label={`Select ${l.path}`} className="size-3.5 shrink-0 cursor-pointer accent-brand" />
								<a href={l.fullUrl} target="_blank" rel="noopener noreferrer" title={l.fullUrl} className="min-w-0 truncate font-medium text-fg hover:underline">{l.path}</a>
								{isSensitiveLink(l.fullUrl, compiled) && <Badge tone="danger">Sensitive</Badge>}
								<span className="ml-auto shrink-0"><CopyButton size="xs" label="" getText={() => l.fullUrl} /></span>
							</li>
						))}
					</DomainCard>
				))
			)}

			<Modal open={!!confirmOpen} title="Open many tabs?" onClose={() => setConfirmOpen(null)}
				footer={<><Button size="md" onClick={() => setConfirmOpen(null)}>Cancel</Button><Button variant="primary" size="md" icon="external" onClick={() => openUrls(confirmOpen)}>Open {confirmOpen?.length}</Button></>}>
				<p className="text-sm text-muted">This will open <span className="font-semibold text-fg">{confirmOpen?.length}</span> new tabs at once.</p>
			</Modal>
		</div>
	);
}
