import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardHeader, Code, EmptyState, Field, Input, Modal, SearchInput, Select, Spinner, Toggle } from "../components/ui/index.js";
import { ResultCount, Toolbar } from "../components/Toolbar.jsx";
import { activeTab, cookies as cookiesApi } from "../lib/browser.js";
import { cookieUrl, emptyCookie, formatExpiry, fromDatetimeLocal, toDatetimeLocal } from "../lib/cookies.js";
import { downloadJson, pickJsonFile } from "../lib/utils.js";
import { isSensitiveParam } from "../lib/sensitivity.js";
import { usePatterns, useToast } from "../providers.jsx";

function CookieFormModal({ editing, onCancel, onSave }) {
	const [form, setForm] = useState(editing);
	useEffect(() => setForm(editing), [editing]);
	if (!editing || !form) return null;
	const set = (patch) => setForm((f) => ({ ...f, ...patch }));

	return (
		<Modal
			open={!!editing}
			title={editing._isNew ? "Add cookie" : "Edit cookie"}
			onClose={onCancel}
			footer={<>
				<Button size="md" onClick={onCancel}>Cancel</Button>
				<Button variant="primary" size="md" icon="check" onClick={() => onSave(form)}>Save</Button>
			</>}
		>
			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-3">
					<Field label="Name"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="session_id" /></Field>
					<Field label="Value"><Input value={form.value} onChange={(e) => set({ value: e.target.value })} placeholder="value" /></Field>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<Field label="Domain"><Input value={form.domain} onChange={(e) => set({ domain: e.target.value })} placeholder="example.com" /></Field>
					<Field label="Path"><Input value={form.path} onChange={(e) => set({ path: e.target.value })} placeholder="/" /></Field>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<Field label="SameSite">
						<Select value={form.sameSite} onChange={(e) => set({ sameSite: e.target.value })}>
							<option value="lax">Lax</option>
							<option value="strict">Strict</option>
							<option value="no_restriction">None</option>
						</Select>
					</Field>
					<Field label="Expiration">
						<Toggle
							checked={!!form.expirationDate}
							onChange={(v) => set({ expirationDate: v ? Math.floor(Date.now() / 1000) + 86400 : undefined })}
							label={form.expirationDate ? "Custom date" : "Session (default)"}
						/>
					</Field>
				</div>
				{!!form.expirationDate && (
					<Field label="Expires at">
						<Input type="datetime-local" value={toDatetimeLocal(form.expirationDate)} onChange={(e) => set({ expirationDate: fromDatetimeLocal(e.target.value) })} />
					</Field>
				)}
				<div className="flex flex-wrap gap-5 pt-1">
					<Toggle checked={form.secure} onChange={(v) => set({ secure: v })} label="Secure" />
					<Toggle checked={form.httpOnly} onChange={(v) => set({ httpOnly: v })} label="HttpOnly" />
				</div>
			</div>
		</Modal>
	);
}

export default function CookiesTab({ domain }) {
	const { compiled } = usePatterns();
	const toast = useToast();
	const [status, setStatus] = useState("loading");
	const [list, setList] = useState([]);
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState(null);
	const [deleting, setDeleting] = useState(null);

	const load = async () => {
		setStatus("loading");
		try {
			let d = domain;
			if (!d) {
				const tab = await activeTab();
				d = tab?.url ? new URL(tab.url).hostname : "";
			}
			if (!d) return setStatus("unavailable");
			const result = await cookiesApi.getAll({ domain: d });
			setList(result || []);
			setStatus("ready");
		} catch {
			setStatus("unavailable");
		}
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { load(); }, [domain]);

	const filtered = useMemo(() => {
		const q = query.toLowerCase();
		return list
			.filter((c) => !q || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [list, query]);

	const openAdd = () => setEditing({ ...emptyCookie(domain), _isNew: true });
	const openEdit = (c) => setEditing({ ...c, _isNew: false, _original: c });

	const saveCookie = async (form) => {
		if (!form.name.trim()) return toast("Cookie needs a name", "error");
		if (!form.domain.trim()) return toast("Cookie needs a domain", "error");
		const details = {
			url: cookieUrl(form),
			name: form.name,
			value: form.value,
			domain: form.domain,
			path: form.path || "/",
			secure: !!form.secure,
			httpOnly: !!form.httpOnly,
			sameSite: form.sameSite,
		};
		if (form.expirationDate) details.expirationDate = form.expirationDate;

		try {
			// Renaming or moving domain/path would otherwise leave the old
			// cookie behind alongside the new one, since a cookie's identity
			// is its name+domain+path together.
			const original = form._original;
			if (original && (original.name !== form.name || original.domain !== form.domain || original.path !== form.path)) {
				await cookiesApi.remove({ url: cookieUrl(original), name: original.name });
			}
			const result = await cookiesApi.set(details);
			if (!result) throw new Error("rejected");
			toast(form._isNew ? "Cookie added" : "Cookie updated", "success");
			setEditing(null);
			load();
		} catch {
			toast("Failed to save — check the domain and path are valid for this site", "error");
		}
	};

	const confirmDelete = async () => {
		if (!deleting) return;
		await cookiesApi.remove({ url: cookieUrl(deleting), name: deleting.name });
		toast("Cookie deleted", "success");
		setDeleting(null);
		load();
	};

	const onExport = () => {
		if (!filtered.length) return toast("No cookies to export", "error");
		downloadJson(filtered, `power-toys-cookies-${domain || "export"}-${Date.now()}.json`);
	};

	const onImport = async () => {
		try {
			const data = await pickJsonFile();
			if (!data) return;
			if (!Array.isArray(data)) return toast("Invalid cookie file — expected a JSON array", "error");
			let ok = 0;
			for (const c of data) {
				try {
					const result = await cookiesApi.set({
						url: cookieUrl(c),
						name: c.name,
						value: c.value,
						domain: c.domain,
						path: c.path || "/",
						secure: !!c.secure,
						httpOnly: !!c.httpOnly,
						sameSite: c.sameSite || "lax",
						...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
					});
					if (result) ok++;
				} catch {}
			}
			toast(`Imported ${ok} of ${data.length} cookie(s)`, ok ? "success" : "error");
			load();
		} catch {
			toast("Error reading cookie file", "error");
		}
	};

	return (
		<div className="space-y-3">
			<Toolbar
				left={<SearchInput value={query} onChange={setQuery} placeholder="Search cookies…" />}
				right={<>
					<Button icon="download" onClick={onExport}>Export</Button>
					<Button icon="upload" onClick={onImport}>Import</Button>
					<Button variant="primary" icon="plus" onClick={openAdd}>Add cookie</Button>
				</>}
			/>
			<ResultCount show={!!query} count={filtered.length} />

			{status === "loading" && <Spinner />}
			{status === "unavailable" && <EmptyState icon="shield" title="Unavailable on this page" hint="Browser and extension pages don't expose cookies." />}
			{status === "ready" && !filtered.length && <EmptyState icon="cookie" title="No cookies found" hint="This site hasn't set any cookies yet — or try Add cookie above." />}

			{status === "ready" && !!filtered.length && (
				<Card>
					<CardHeader title={domain || "Cookies"} actions={<Badge>{filtered.length} cookies</Badge>} />
					<ul className="divide-y divide-line">
						{filtered.map((c) => (
							<li key={`${c.domain}|${c.path}|${c.name}`} className="flex items-start justify-between gap-3 px-4 py-3">
								<div className="min-w-0 flex-1 space-y-1.5">
									<div className="flex flex-wrap items-center gap-2">
										<span className="size-1.5 shrink-0 rounded-full bg-brand" />
										<span className="truncate text-sm font-semibold">{c.name}</span>
										{isSensitiveParam(c.name, compiled) && <Badge tone="danger">Sensitive</Badge>}
									</div>
									<Code className="ml-3.5">{c.value.length > 80 ? c.value.slice(0, 80) + "…" : c.value || "(empty)"}</Code>
									<div className="ml-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-subtle">
										<span>{c.domain}{c.path}</span>
										<span>{formatExpiry(c)}</span>
										{c.secure && <span>Secure</span>}
										{c.httpOnly && <span>HttpOnly</span>}
										<span className="capitalize">{(c.sameSite || "lax").replace("_", " ")}</span>
									</div>
								</div>
								<div className="flex shrink-0 gap-1.5">
									<Button size="xs" icon="edit" onClick={() => openEdit(c)}>Edit</Button>
									<Button size="xs" icon="trash" onClick={() => setDeleting(c)}>Delete</Button>
								</div>
							</li>
						))}
					</ul>
				</Card>
			)}

			<CookieFormModal editing={editing} onCancel={() => setEditing(null)} onSave={saveCookie} />

			<Modal
				open={!!deleting}
				title="Delete cookie?"
				onClose={() => setDeleting(null)}
				footer={<>
					<Button size="md" onClick={() => setDeleting(null)}>Cancel</Button>
					<Button variant="primary" size="md" onClick={confirmDelete}>Delete</Button>
				</>}
			>
				<p className="text-sm text-muted">
					This removes <span className="font-semibold text-fg">{deleting?.name}</span> from {deleting?.domain}{deleting?.path}. This can't be undone.
				</p>
			</Modal>
		</div>
	);
}
