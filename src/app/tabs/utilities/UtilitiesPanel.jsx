import { useMemo, useState } from "react";
import { Badge, Button, CopyButton, EmptyState, Field, Input, Select, Textarea, Toggle } from "../../components/ui/index.js";
import { CopyAs } from "../../components/CopyAs.jsx";
import { base64Pretty, convertTime, diffText, formatJson, makeUuids, prettyUrl, testRegex } from "../../lib/devtools.js";
import { useToast } from "../../providers.jsx";

const Notice = ({ children }) => <p role="alert" className="rounded-2xl border border-brand bg-brand-soft px-4 py-2.5 text-sm text-brand-ink">{children}</p>;

/* ── JSON / Base64 / URL formatter ──────────────────────────────────────── */
const FORMATS = {
	json: { label: "Beautify JSON", run: (t) => formatJson(t) },
	minify: { label: "Minify JSON", run: (t) => formatJson(t, { minify: true }) },
	base64: { label: "Base64 → text / JSON", run: base64Pretty },
	url: { label: "Break down URL", run: prettyUrl },
};

function FormatterTool() {
	const [input, setInput] = useState("");
	const [mode, setMode] = useState("json");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const run = () => {
		if (!input.trim()) return setError("Enter some text first");
		try { setOutput(FORMATS[mode].run(input)); setError(""); } catch (e) { setError(e.message); }
	};
	return (
		<div className="space-y-4">
			<Field label="Input"><Textarea rows={6} value={input} onChange={(e) => setInput(e.target.value)} placeholder='{"paste":"JSON, Base64, or a URL"}' /></Field>
			<div className="flex flex-wrap items-center gap-2">
				<div className="w-56"><Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Format">{Object.entries(FORMATS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}</Select></div>
				<Button variant="primary" size="md" icon="zap" onClick={run}>Run</Button>
			</div>
			{error && <Notice>{error}</Notice>}
			<Field label="Output" action={<div className="flex gap-1.5"><CopyButton size="xs" getText={() => output} empty="No output to copy" /><CopyAs getText={() => output} empty="No output to copy" /></div>}>
				<Textarea rows={8} readOnly value={output} placeholder="Result will appear here…" />
			</Field>
		</div>
	);
}

/* ── Text diff ──────────────────────────────────────────────────────────── */
function DiffTool() {
	const [a, setA] = useState("");
	const [b, setB] = useState("");
	const [mode, setMode] = useState("lines");
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");
	const run = () => {
		if (!a && !b) return setError("Enter text on at least one side");
		try { setResult(diffText(a, b, mode)); setError(""); } catch (e) { setResult(null); setError(e.message); }
	};
	const changes = result ? result.filter((r) => r.type !== "same").length : 0;
	const tone = { add: "bg-ok/15 text-ok", del: "bg-brand-soft text-brand-ink line-through decoration-brand/40", same: "text-muted" };
	const mark = { add: "+ ", del: "− ", same: "  " };
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3">
				<Field label="Original"><Textarea rows={7} value={a} onChange={(e) => setA(e.target.value)} /></Field>
				<Field label="Changed"><Textarea rows={7} value={b} onChange={(e) => setB(e.target.value)} /></Field>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<div className="w-40"><Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Diff mode"><option value="lines">By line</option><option value="words">By word</option></Select></div>
				<Button variant="primary" size="md" icon="refresh" onClick={run}>Compare</Button>
				<Button size="md" icon="repeat" onClick={() => { setA(b); setB(a); setResult(null); }}>Swap sides</Button>
			</div>
			{error && <Notice>{error}</Notice>}
			{result && (changes === 0 ? (
				<EmptyState icon="check" title="No differences" hint="Both sides are identical." />
			) : (
				<div className="space-y-1.5">
					<Badge tone="brand">{changes} change{changes > 1 ? "s" : ""}</Badge>
					<pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-line bg-surface-2/60 p-3 font-mono text-[12px] leading-relaxed">
						{mode === "lines"
							? result.map((r, i) => <div key={i} className={tone[r.type]}>{mark[r.type]}{r.text}</div>)
							: result.map((r, i) => <span key={i} className={tone[r.type]}>{r.text}</span>)}
					</pre>
				</div>
			))}
		</div>
	);
}

/* ── Epoch / date converter ─────────────────────────────────────────────── */
function TimeTool() {
	const [input, setInput] = useState("");
	const [rows, setRows] = useState([]);
	const [error, setError] = useState("");
	const run = (value = input) => {
		try { setRows(convertTime(value)); setError(""); } catch (e) { setRows([]); setError(e.message); }
	};
	return (
		<div className="space-y-4">
			<Field label="Epoch (seconds or milliseconds) or a date" hint="Examples: 1700000000 · 1700000000000 · 2024-05-01T12:00:00Z">
				<div className="flex gap-2">
					<Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="1700000000" className="font-mono" />
					<Button variant="primary" size="md" onClick={() => run()}>Convert</Button>
					<Button size="md" onClick={() => { const now = String(Math.floor(Date.now() / 1000)); setInput(now); run(now); }}>Now</Button>
				</div>
			</Field>
			{error && <Notice>{error}</Notice>}
			{!rows.length && !error && <EmptyState icon="clock" title="Nothing converted yet" hint="Enter a value above, or press Now." />}
			{!!rows.length && (
				<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
					{rows.map(([label, value]) => (
						<li key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
							<div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p><p className="break-all font-mono text-[13px]">{value}</p></div>
							<CopyButton size="xs" label="" getText={() => value} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/* ── UUID generator ─────────────────────────────────────────────────────── */
function UuidTool() {
	const [count, setCount] = useState(1);
	const [upper, setUpper] = useState(false);
	const [dashes, setDashes] = useState(true);
	const [ids, setIds] = useState(() => makeUuids(1));
	const generate = (c = count, o = { upper, dashes }) => setIds(makeUuids(c, o));
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-4">
				<div className="w-28"><Select value={count} onChange={(e) => { const c = Number(e.target.value); setCount(c); generate(c); }} aria-label="How many">{[1, 5, 10, 25].map((n) => <option key={n} value={n}>{n} UUID{n > 1 ? "s" : ""}</option>)}</Select></div>
				<Toggle checked={upper} onChange={(v) => { setUpper(v); generate(count, { upper: v, dashes }); }} label="Uppercase" />
				<Toggle checked={dashes} onChange={(v) => { setDashes(v); generate(count, { upper, dashes: v }); }} label="Dashes" />
			</div>
			<div className="flex gap-2">
				<Button variant="primary" size="md" icon="refresh" onClick={() => generate()}>Generate</Button>
				<CopyButton size="md" label="Copy all" getText={() => ids.join("\n")} />
			</div>
			<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
				{ids.map((id, i) => (
					<li key={i} className="flex items-center justify-between gap-3 px-4 py-2"><span className="break-all font-mono text-[13px]">{id}</span><CopyButton size="xs" label="" getText={() => id} /></li>
				))}
			</ul>
			<p className="text-xs text-subtle">Version 4 (random), generated locally with your browser's crypto API.</p>
		</div>
	);
}

/* ── Regex tester ───────────────────────────────────────────────────────── */
function RegexTool() {
	const [pattern, setPattern] = useState("");
	const [flags, setFlags] = useState("gi");
	const [text, setText] = useState("");
	const { result, error } = useMemo(() => {
		if (!pattern || !text) return { result: null, error: "" };
		try { return { result: testRegex(pattern, flags, text), error: "" }; } catch (e) { return { result: null, error: e.message }; }
	}, [pattern, flags, text]);
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-[1fr_6rem] gap-3">
				<Field label="Pattern"><Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="flag\{[^}]+\}" className="font-mono" /></Field>
				<Field label="Flags"><Input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="gi" className="font-mono" /></Field>
			</div>
			<Field label="Test text"><Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text to search…" /></Field>
			{error && <Notice>{error}</Notice>}
			{!error && !result && <EmptyState icon="search" title="Enter a pattern and some text" hint="Matches update as you type." />}
			{result && (!result.length ? (
				<EmptyState icon="search" title="No matches" hint="The pattern didn't match anything in the text." />
			) : (
				<div className="space-y-2">
					<div className="flex items-center justify-between"><Badge tone="brand">{result.length}{result.length >= 500 ? "+" : ""} match{result.length > 1 ? "es" : ""}</Badge><CopyButton size="xs" label="Copy matches" getText={() => result.map((m) => m.match).join("\n")} /></div>
					<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
						{result.map((m, i) => (
							<li key={i} className="space-y-1 px-4 py-2">
								<div className="flex items-center justify-between gap-3"><code className="break-all font-mono text-[13px] text-fg">{m.match || "(empty match)"}</code><span className="shrink-0 text-[11px] text-subtle">at {m.index}</span></div>
								{(m.groups.length > 0 || m.named) && (
									<p className="font-mono text-[11px] text-muted">
										{m.groups.map((g, gi) => `$${gi + 1}=${g ?? "∅"}`).join("  ")}{m.named ? "  " + Object.entries(m.named).map(([k, v]) => `${k}=${v ?? "∅"}`).join("  ") : ""}
									</p>
								)}
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}

// `tool` is controlled by App.jsx (via the Utilities sub-tabs in the popup
// chip row / full-tab sidebar), so this panel renders just the chosen tool.
export default function UtilitiesPanel({ tool }) {
	return (
		<div className="space-y-4">
			{tool === "format" && <FormatterTool />}
			{tool === "diff" && <DiffTool />}
			{tool === "time" && <TimeTool />}
			{tool === "uuid" && <UuidTool />}
			{tool === "regex" && <RegexTool />}
		</div>
	);
}
