import { useEffect, useState } from "react";
import { Button, Card, CardHeader, Field, Modal, Tabs, Textarea } from "../components/ui/index.js";
import { getVersion } from "../lib/browser.js";
import { downloadJson, pickJsonFile } from "../lib/utils.js";
import { usePatterns, useToast } from "../providers.jsx";

const SECTIONS = [{ id: "general", label: "General" }, { id: "urls", label: "URL patterns" }, { id: "params", label: "Parameter keywords" }];

export default function SettingsTab() {
	const { raw, save, reset } = usePatterns();
	const toast = useToast();
	const [section, setSection] = useState("general");
	const [params, setParams] = useState("");
	const [urls, setUrls] = useState("");
	const [confirmReset, setConfirmReset] = useState(false);

	useEffect(() => {
		setParams(raw.params.join(", "));
		setUrls(raw.urlPatterns.join("\n"));
	}, [raw]);

	const onSave = async () => {
		const next = {
			params: params.split(",").map((p) => p.trim()).filter(Boolean),
			urlPatterns: urls.split("\n").map((p) => p.trim()).filter(Boolean),
		};
		if (!next.params.length && !next.urlPatterns.length) return toast("Enter at least one parameter or URL pattern", "error");
		await save(next);
		toast("Settings saved!", "success");
	};

	const onImport = async () => {
		try {
			const data = await pickJsonFile();
			if (!data) return;
			if (!Array.isArray(data.params) || !Array.isArray(data.urlPatterns)) return toast("Invalid settings file format!", "error");
			await save({ params: data.params, urlPatterns: data.urlPatterns });
			toast("Settings imported!", "success");
		} catch { toast("Error parsing settings file!", "error"); }
	};

	const actions = (
		<div className="flex flex-wrap gap-2">
			<Button variant="primary" size="md" icon="check" onClick={onSave}>Save settings</Button>
			<Button size="md" icon="refresh" onClick={() => setConfirmReset(true)}>Reset to defaults</Button>
		</div>
	);

	return (
		<div className="space-y-3">
			<Tabs variant="chip" items={SECTIONS} value={section} onChange={setSection} />
			<Card>
				<CardHeader title={SECTIONS.find((s) => s.id === section).label} />
				<div className="space-y-4 p-4">
					{section === "general" && (
						<>
							<dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-sm">
								<dt className="text-muted">Version</dt><dd className="font-semibold">{getVersion()}</dd>
								<dt className="text-muted">Author</dt><dd className="font-semibold">nCodevSec</dd>
								<dt className="text-muted">GitHub</dt>
								<dd><a className="font-semibold text-brand hover:underline" href="https://github.com/ncodevsec/power-toys" target="_blank" rel="noopener noreferrer">github.com/ncodevsec/power-toys</a></dd>
							</dl>
							<div className="flex gap-2">
								<Button size="md" icon="download" onClick={() => downloadJson(raw, `power-toys-settings-${Date.now()}.json`)}>Export settings</Button>
								<Button size="md" icon="upload" onClick={onImport}>Import settings</Button>
							</div>
						</>
					)}
					{section === "urls" && (
						<>
							<Field label="URL patterns (regex, one per line)" hint="Example: /admin/i or /\.git/i">
								<Textarea rows={9} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="Enter regex patterns, one per line…" />
							</Field>
							{actions}
						</>
					)}
					{section === "params" && (
						<>
							<Field label="Sensitive parameter keywords" hint="Comma-separated. Example: api_key, password, token">
								<Textarea rows={9} value={params} onChange={(e) => setParams(e.target.value)} placeholder="Enter keywords separated by commas…" />
							</Field>
							{actions}
						</>
					)}
				</div>
			</Card>

			<Modal open={confirmReset} title="Reset to defaults?" onClose={() => setConfirmReset(false)}
				footer={<>
					<Button size="md" onClick={() => setConfirmReset(false)}>Cancel</Button>
					<Button variant="primary" size="md" onClick={async () => { await reset(); setConfirmReset(false); toast("Reset to defaults!", "success"); }}>Reset</Button>
				</>}>
				<p className="text-sm text-muted">Your custom URL patterns and parameter keywords will be replaced by the built-in defaults.</p>
			</Modal>
		</div>
	);
}
