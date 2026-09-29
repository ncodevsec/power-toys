import { useState } from "react";
import { Button, Card, Field, Icon, Textarea } from "../components/ui/index.js";
import { sendMessage } from "../lib/browser.js";
import { extractUrls, groupUrlsByHost } from "../lib/links.js";
import { cx } from "../lib/utils.js";
import { useToast } from "../providers.jsx";

const MODES = [
	{ id: "newTabs", title: "New tabs", hint: "One background tab per URL" },
	{ id: "newWindow", title: "One window", hint: "All URLs in a single new window" },
	{ id: "eachDomain", title: "Window per domain", hint: "Group URLs by hostname" },
];

export default function BulkTab() {
	const toast = useToast();
	const [text, setText] = useState("");
	const [mode, setMode] = useState("newTabs");
	const [summary, setSummary] = useState("");

	const paste = async () => {
		try { setText(await navigator.clipboard.readText()); toast("URLs pasted", "success"); }
		catch { toast("Paste failed – use Ctrl+V instead", "error"); }
	};

	const open = async () => {
		const urls = extractUrls(text);
		if (!urls.length) return toast(text.trim() ? "No valid URLs found" : "Please enter at least one URL", "error");
		let windows = urls.length, msg = { action: "openUrlsInNewTabs", urls };
		if (mode === "newWindow") { msg = { action: "openUrlsInNewWindow", urls }; windows = 1; }
		if (mode === "eachDomain") { const map = groupUrlsByHost(urls); msg = { action: "openUrlsByDomain", domainMap: [...map] }; windows = map.size; }
		await sendMessage(msg);
		toast(`Opening ${urls.length} URL(s)…`, "success");
		setSummary(`Processed ${urls.length} URL(s) across ${windows} ${mode === "newTabs" ? "tab(s)" : "window(s)"}.`);
		setTimeout(() => setSummary(""), 4000);
	};

	return (
		<Card>
			<div className="space-y-4 p-4">
				<Field label="URLs (one per line)" action={<div className="flex gap-1.5">
					<Button size="xs" variant="soft" icon="clipboard" onClick={paste}>Paste</Button>
					<Button size="xs" icon="copy" onClick={() => text.trim() ? navigator.clipboard.writeText(text).then(() => toast("Copied", "success")) : toast("Input is empty", "error")}>Copy</Button>
					<Button size="xs" icon="trash" onClick={() => { setText(""); setSummary(""); }}>Clear</Button>
				</div>}>
					<Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"https://example.com/a\nhttps://example.com/b"} />
				</Field>

				<Field label="Opening options">
					<div className="grid grid-cols-3 gap-2">
						{MODES.map((m) => (
							<button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
								className={cx("rounded-2xl border p-3 text-left transition", mode === m.id ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line hover:border-brand/40")}>
								<span className="flex items-center gap-1.5 text-sm font-bold"><Icon name={mode === m.id ? "check" : "external"} size={14} className="text-brand" />{m.title}</span>
								<span className="mt-1 block text-xs text-muted">{m.hint}</span>
							</button>
						))}
					</div>
				</Field>

				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold text-brand">{summary}</p>
					<Button variant="primary" size="md" icon="external" onClick={open}>Open URLs</Button>
				</div>
			</div>
		</Card>
	);
}
