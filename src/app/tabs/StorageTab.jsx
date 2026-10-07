import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardHeader, Code, EmptyState, Field, Input, Modal, SearchInput, Spinner, Tabs } from "../components/ui/index.js";
import { ResultCount, Toolbar } from "../components/Toolbar.jsx";
import { useWebStorage } from "../hooks/useWebStorage.js";
import { downloadJson, pickJsonFile } from "../lib/utils.js";
import { useToast } from "../providers.jsx";

const AREAS = [
	{ id: "local", label: "Local Storage" },
	{ id: "session", label: "Session Storage" },
];

function ItemFormModal({ editing, onCancel, onSave }) {
	const [form, setForm] = useState(editing);
	useEffect(() => setForm(editing), [editing]);
	if (!editing || !form) return null;
	return (
		<Modal open title={editing._isNew ? "Add item" : "Edit item"} onClose={onCancel}
			footer={<>
				<Button size="md" onClick={onCancel}>Cancel</Button>
				<Button variant="primary" size="md" icon="check" onClick={() => onSave(form)}>Save</Button>
			</>}
		>
			<div className="space-y-4">
				<Field label="Key">
					<Input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="auth_token" disabled={!form._isNew} />
				</Field>
				<Field label="Value">
					<Input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="value" />
				</Field>
			</div>
		</Modal>
	);
}

export default function StorageTab({ domain, fullTab }) {
	const toast = useToast();
	const { status, local, session, editable, setItem, removeItem } = useWebStorage({ fullTab });
	const [area, setArea] = useState("local");
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState(null);
	const [deleting, setDeleting] = useState(null);

	const items = area === "local" ? local : session;
	const filtered = useMemo(() => {
		const q = query.toLowerCase();
		return items.filter((i) => !q || i.key.toLowerCase().includes(q) || (i.value || "").toLowerCase().includes(q)).sort((a, b) => a.key.localeCompare(b.key));
	}, [items, query]);

	const openAdd = () => setEditing({ key: "", value: "", _isNew: true });
	const openEdit = (item) => setEditing({ ...item, _isNew: false });

	const save = async (form) => {
		if (!form.key.trim()) return toast("Key can't be empty", "error");
		const ok = await setItem(area, form.key, form.value);
		if (ok) { toast(form._isNew ? "Item added" : "Item updated", "success"); setEditing(null); }
		else toast("Couldn't save — no active page to write to", "error");
	};

	const confirmDelete = async () => {
		if (!deleting) return;
		await removeItem(area, deleting.key);
		toast("Item deleted", "success");
		setDeleting(null);
	};

	const onExport = () => {
		if (!filtered.length) return toast("Nothing to export", "error");
		downloadJson(filtered, `power-toys-${area}-storage-${domain || "export"}-${Date.now()}.json`);
	};

	const onImport = async () => {
		try {
			const data = await pickJsonFile();
			if (!data) return;
			if (!Array.isArray(data)) return toast("Invalid file — expected a JSON array", "error");
			let ok = 0;
			for (const item of data) {
				if (item?.key && (await setItem(area, item.key, item.value ?? ""))) ok++;
			}
			toast(`Imported ${ok} of ${data.length} item(s)`, ok ? "success" : "error");
		} catch {
			toast("Error reading file", "error");
		}
	};

	return (
		<div className="space-y-3">
			<Toolbar
				left={<Tabs variant="chip" items={AREAS} value={area} onChange={setArea} />}
				right={editable ? <>
					<Button icon="download" onClick={onExport}>Export</Button>
					<Button icon="upload" onClick={onImport}>Import</Button>
					<Button variant="primary" icon="plus" onClick={openAdd}>Add item</Button>
				</> : <Button icon="download" onClick={onExport}>Export</Button>}
			/>

			{!editable && (
				<p className="rounded-2xl border border-dashed border-line px-4 py-2.5 text-xs text-muted">
					Read-only snapshot taken when this page was opened. Use the popup directly on the page to add, edit, or delete items.
				</p>
			)}

			<SearchInput value={query} onChange={setQuery} placeholder="Search storage…" />
			<ResultCount show={!!query} count={filtered.length} />

			{status === "loading" && <Spinner />}
			{status === "unavailable" && <EmptyState icon="shield" title="Unavailable on this page" hint="Browser and extension pages don't expose storage." />}
			{(status === "ready" || status === "empty") && !filtered.length && (
				<EmptyState icon="database" title="No items found" hint={`This site hasn't stored anything in ${area === "local" ? "localStorage" : "sessionStorage"}.`} />
			)}

			{!!filtered.length && (
				<Card>
					<CardHeader title={AREAS.find((a) => a.id === area).label} actions={<Badge>{filtered.length}</Badge>} />
					<ul className="divide-y divide-line">
						{filtered.map((item) => (
							<li key={item.key} className="flex items-start justify-between gap-3 px-4 py-2.5">
								<div className="min-w-0 flex-1 space-y-1">
									<div className="flex items-center gap-2">
										<span className="size-1.5 shrink-0 rounded-full bg-brand" />
										<span className="truncate text-sm font-semibold">{item.key}</span>
									</div>
									<Code className="ml-3.5">{(item.value || "").length > 120 ? item.value.slice(0, 120) + "…" : item.value || "(empty)"}</Code>
								</div>
								{editable && (
									<div className="flex shrink-0 gap-1.5">
										<Button size="xs" icon="edit" onClick={() => openEdit(item)}>Edit</Button>
										<Button size="xs" icon="trash" onClick={() => setDeleting(item)}>Delete</Button>
									</div>
								)}
							</li>
						))}
					</ul>
				</Card>
			)}

			<ItemFormModal editing={editing} onCancel={() => setEditing(null)} onSave={save} />

			<Modal open={!!deleting} title="Delete item?" onClose={() => setDeleting(null)}
				footer={<>
					<Button size="md" onClick={() => setDeleting(null)}>Cancel</Button>
					<Button variant="primary" size="md" onClick={confirmDelete}>Delete</Button>
				</>}
			>
				<p className="text-sm text-muted">This removes <span className="font-semibold text-fg">{deleting?.key}</span> from {area === "local" ? "localStorage" : "sessionStorage"}. This can't be undone.</p>
			</Modal>
		</div>
	);
}
