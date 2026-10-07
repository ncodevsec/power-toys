import { useMemo, useState } from "react";
import { Badge, Button, Card, CardHeader, Code, CopyButton, EmptyState, Modal, SearchInput, Tabs } from "../components/ui/index.js";
import { ResultCount, SensitiveToggle, Toolbar } from "../components/Toolbar.jsx";
import { countLines, safeHref, truncateToLines } from "../lib/utils.js";
import { isSensitiveSecret } from "../lib/sensitivity.js";
import { compileCustomPatterns, scanForCustomPatterns } from "../lib/customPatterns.js";
import { usePatterns, useCustomPatterns } from "../providers.jsx";

const GROUP_LABEL = {
	"API Key": "API Keys", "Data Attribute": "API Keys", Credential: "Credentials",
	Endpoint: "URLs", "Hidden URL": "URLs", "Hidden Link": "URLs", "Resource (CSS)": "URLs",
	"Hidden Path": "Paths", Path: "Paths",
};
const COMMENT_TYPES = new Set(["HTML Comment", "JavaScript Comment", "CSS Comment"]);
const URL_TYPES = new Set(["Endpoint", "Hidden Link", "Hidden URL", "Resource (CSS)"]);

const rawValue = (i) => i.pattern || i.value || i.content || "";
const CATEGORY_ITEMS = {
	all: (s) => Object.values(s).flat(),
	apiKeys: (s) => s.apiKeys,
	credentials: (s) => s.credentials,
	urls: (s) => [...s.endpoints, ...s.paths, ...s.hiddenLinks],
	comments: (s) => s.comments,
};

function SecretRow({ item, onView }) {
	const isComment = COMMENT_TYPES.has(item.type);
	const val = rawValue(item);
	const shown = !isComment && val.startsWith("//") ? "https:" + val : val;
	const preview = countLines(shown) > 5 ? truncateToLines(shown, 5) : shown.length > 150 ? shown.slice(0, 150) : shown;
	const href = URL_TYPES.has(item.type) ? safeHref(item.fullUrl || shown) : null;
	return (
		<li className="flex items-start gap-3 px-4 py-2.5">
			<span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />
			<div className="min-w-0 flex-1">
				{href ? (
					<a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline"><Code>{preview}</Code></a>
				) : (
					<Code block>{preview}{preview.length < shown.length && "…"}</Code>
				)}
			</div>
			{shown.length > preview.length && <Button size="xs" variant="soft" icon="eye" onClick={() => onView(val)}>View</Button>}
		</li>
	);
}

function CustomMatchRow({ match }) {
	return (
		<li className="flex items-center gap-3 px-4 py-2.5">
			<span className="mt-0 size-1.5 shrink-0 rounded-full bg-brand" />
			<Code className="min-w-0 flex-1">{match.value}</Code>
			<Badge tone="muted">{match.source}</Badge>
		</li>
	);
}

export default function SecretsTab({ secrets, links = [] }) {
	const { compiled } = usePatterns();
	const customPatterns = useCustomPatterns();
	const [category, setCategory] = useState("all");
	const [query, setQuery] = useState("");
	const [onlySensitive, setOnlySensitive] = useState(false);
	const [viewing, setViewing] = useState(null);

	const customGroups = useMemo(
		() => scanForCustomPatterns(compileCustomPatterns(customPatterns?.items), { links, secrets }),
		[customPatterns?.items, links, secrets],
	);
	const customCount = customGroups.reduce((n, g) => n + g.matches.length, 0);

	const counts = {
		all: CATEGORY_ITEMS.all(secrets).length,
		apiKeys: secrets.apiKeys.length,
		credentials: secrets.credentials.length,
		urls: CATEGORY_ITEMS.urls(secrets).length,
		comments: secrets.comments.length,
		custom: customCount,
	};

	const items = useMemo(() => {
		if (category === "custom") return [];
		const q = query.toLowerCase();
		return CATEGORY_ITEMS[category](secrets).filter(
			(i) =>
				(!q || [i.pattern, i.value, i.content, i.type].some((f) => f?.toLowerCase().includes(q))) &&
				(!onlySensitive || isSensitiveSecret(i, compiled)),
		);
	}, [secrets, category, query, onlySensitive, compiled]);

	const filteredCustomGroups = useMemo(() => {
		if (category !== "all" && category !== "custom") return [];
		const q = query.toLowerCase();
		return customGroups
			.map((g) => ({ ...g, matches: g.matches.filter((m) => !q || m.value.toLowerCase().includes(q)) }))
			.filter((g) => g.matches.length);
	}, [customGroups, category, query]);

	const groups = useMemo(() => {
		const g = {};
		for (const i of items) (g[GROUP_LABEL[i.type] || i.type] ||= []).push(i);
		return Object.entries(g);
	}, [items]);

	const textOf = (i) => (COMMENT_TYPES.has(i.type) ? i.content || i.sourceText || "" : i.value || i.pattern || "");
	const tabs = [["all", "All"], ["apiKeys", "API Keys"], ["credentials", "Creds"], ["urls", "Links"], ["comments", "Comments"], ["custom", "Custom"]].map(([id, label]) => ({ id, label, count: counts[id] }));

	const copyAll = () => {
		const builtin = items.map(textOf).filter((t) => t.trim());
		const custom = filteredCustomGroups.flatMap((g) => g.matches.map((m) => m.value));
		return [...builtin, ...custom].join("\n");
	};

	return (
		<div className="space-y-3">
			<Toolbar
				left={<Tabs variant="chip" items={tabs} value={category} onChange={setCategory} />}
				right={<>
					<SensitiveToggle active={onlySensitive} onClick={() => setOnlySensitive((v) => !v)} />
					<CopyButton getText={copyAll} empty="No secrets to copy" />
				</>}
			/>
			<SearchInput value={query} onChange={setQuery} placeholder="Search secrets…" />
			<ResultCount show={!!query} count={items.length + filteredCustomGroups.reduce((n, g) => n + g.matches.length, 0)} />

			{!groups.length && !filteredCustomGroups.length ? (
				<EmptyState icon="key" title={counts.all ? "No results" : "No secrets found"} hint={counts.all ? "Nothing matches the current filters." : "This page has no exposed sensitive information."} />
			) : (
				<>
					{groups.map(([label, list]) => (
						<Card key={label}>
							<CardHeader title={label} actions={<><Badge>{list.length}</Badge><CopyButton label="" size="xs" getText={() => list.map(textOf).filter((t) => t.trim()).join("\n")} /></>} />
							<ul className="divide-y divide-line">{list.map((i, idx) => <SecretRow key={idx} item={i} onView={setViewing} />)}</ul>
						</Card>
					))}
					{filteredCustomGroups.map((g) => (
						<Card key={g.id}>
							<CardHeader title={g.name} actions={<><Badge tone="danger">{g.matches.length}</Badge><CopyButton label="" size="xs" getText={() => g.matches.map((m) => m.value).join("\n")} /></>} />
							<ul className="divide-y divide-line">{g.matches.map((m, idx) => <CustomMatchRow key={idx} match={m} />)}</ul>
						</Card>
					))}
				</>
			)}

			<Modal open={viewing !== null} title="Full content" onClose={() => setViewing(null)} footer={<CopyButton label="Copy" getText={() => viewing || ""} />}>
				<pre className="whitespace-pre-wrap break-words rounded-2xl bg-surface-2 p-4 font-mono text-[13px] leading-relaxed">{viewing}</pre>
			</Modal>
		</div>
	);
}
