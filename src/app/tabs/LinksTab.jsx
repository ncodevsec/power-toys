import { useMemo, useState } from "react";
import { Badge, CopyButton, EmptyState, SearchInput, Tabs } from "../components/ui/index.js";
import { DomainCard } from "../components/DomainCard.jsx";
import { ResultCount, SensitiveToggle, Toolbar } from "../components/Toolbar.jsx";
import { getFileExtension, groupByDomain, sortedFileTypes } from "../lib/links.js";
import { isSensitiveLink } from "../lib/sensitivity.js";
import { usePatterns } from "../providers.jsx";

const CATEGORIES = ["All", "Paths", "Files", "Others"];

export default function LinksTab({ links, domain }) {
	const { compiled } = usePatterns();
	const [category, setCategory] = useState("All");
	const [fileType, setFileType] = useState(null);
	const [query, setQuery] = useState("");
	const [onlySensitive, setOnlySensitive] = useState(false);

	const filtered = useMemo(() => {
		const q = query.toLowerCase();
		return links.filter(
			(l) =>
				(category === "All" || l.category === category) &&
				(!q || l.fullUrl.toLowerCase().includes(q) || l.domain.includes(q) || l.path.toLowerCase().includes(q)) &&
				(!onlySensitive || isSensitiveLink(l.fullUrl, compiled)),
		);
	}, [links, category, query, onlySensitive, compiled]);

	const fileTypes = category === "Files" ? sortedFileTypes(filtered) : [];
	const visible = category === "Files" && fileType ? filtered.filter((l) => getFileExtension(l.fullUrl) === fileType) : filtered;
	const groups = useMemo(() => groupByDomain(visible, domain), [visible, domain]);

	const tabs = CATEGORIES.map((c) => ({
		id: c,
		label: c,
		count: c === "All" ? links.length : links.filter((l) => l.category === c).length,
	}));

	return (
		<div className="space-y-3">
			<Toolbar
				left={<Tabs variant="chip" items={tabs} value={category} onChange={(c) => { setCategory(c); setFileType(null); }} />}
				right={<>
					<SensitiveToggle active={onlySensitive} onClick={() => setOnlySensitive((v) => !v)} />
					<CopyButton getText={() => visible.map((l) => l.fullUrl).join("\n")} empty="No links to copy" />
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
			<ResultCount show={!!query} count={visible.length} />

			{!groups.length ? (
				<EmptyState icon="search" title="No links found" hint="Try adjusting your search or category filters." />
			) : (
				groups.map(({ domain: d, links: group }) => (
					<DomainCard key={d} domain={d} count={group.length} unit="links" getCopyText={() => group.map((l) => l.fullUrl).join("\n")}>
						{group.map((l) => (
							<li key={l.fullUrl} className="flex items-center gap-2.5 px-4 py-2 text-sm">
								<span className="size-1.5 shrink-0 rounded-full bg-brand" />
								<a href={l.fullUrl} target="_blank" rel="noopener noreferrer" title={l.fullUrl} className="min-w-0 truncate font-medium text-brand hover:underline">{l.path}</a>
								{isSensitiveLink(l.fullUrl, compiled) && <Badge tone="danger">Sensitive</Badge>}
							</li>
						))}
					</DomainCard>
				))
			)}
		</div>
	);
}
