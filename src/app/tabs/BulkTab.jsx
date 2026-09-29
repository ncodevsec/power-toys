import { useState } from "react";
import { Button, Card, Field, Textarea } from "../components/ui/index.js";
import { sendMessage } from "../lib/browser.js";
import { extractUrls, groupUrlsByHost } from "../lib/links.js";
import { cx } from "../lib/utils.js";
import { useToast } from "../providers.jsx";

const MODES = [
	{ id: "newTabs", title: "New tabs", hint: "One background tab per URL" },
	{ id: "newWindow", title: "One window", hint: "All URLs in a single new window" },
	{ id: "eachDomain", title: "Window per domain", hint: "Group URLs by hostname" },
];

/** A properly-styled radio row (indicator + title + hint), used as a
 * cleaner, more legible replacement for native radio inputs. */
function RadioRow({ title, hint, selected, onSelect }) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onSelect}
			className={cx(
				"flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
				selected ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40",
			)}
		>
			<span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition", selected ? "border-brand" : "border-line")}>
				{selected && <span className="size-2.5 rounded-full bg-brand" />}
			</span>
			<span className="min-w-0">
				<span className="block text-sm font-bold">{title}</span>
				<span className="block text-xs text-muted">{hint}</span>
			</span>
		</button>
	);
}

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
					<div role="radiogroup" aria-label="Opening options" className="space-y-2">
						{MODES.map((m) => (
							<RadioRow key={m.id} title={m.title} hint={m.hint} selected={mode === m.id} onSelect={() => setMode(m.id)} />
						))}
					</div>
				</Field>

				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold text-muted">{summary}</p>
					<Button variant="primary" size="md" icon="external" onClick={open}>Open URLs</Button>
				</div>
			</div>
		</Card>
	);
}
