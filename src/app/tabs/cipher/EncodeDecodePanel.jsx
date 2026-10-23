import { useEffect, useMemo, useState } from "react";
import { Badge, Button, CopyButton, Field, Input, Select, Textarea } from "../../components/ui/index.js";
import { CopyAs } from "../../components/CopyAs.jsx";
import { AUTO_LABEL, CIPHERS, GROUPS, autoDecode, describePath, detectFormats, encoding } from "../../lib/encoding.js";
import { useToast } from "../../providers.jsx";
import { useStoredState } from "../../hooks/useStoredState.js";
import { usePrefs } from "../../lib/prefs.js";
import { CIPHER_HISTORY_KEY, pushCipher } from "../../lib/history.js";
import CipherHistory from "./CipherHistory.jsx";

const DEPTHS = [1, 2, 3, 4, 5];

export default function EncodeDecodePanel({ preset }) {
	const toast = useToast();
	const [prefs] = usePrefs();
	const [history, setHistory] = useStoredState(CIPHER_HISTORY_KEY, []);
	const [input, setInput] = useState("");
	const [output, setOutput] = useState("");
	const [method, setMethod] = useState("");
	const [shift, setShift] = useState(3);
	const [last, setLast] = useState(null); // { method, op, opts }
	const [repeats, setRepeats] = useState(0);
	const [error, setError] = useState("");
	const [auto, setAuto] = useState(null); // { results, input } after an Auto Decode run
	const [depth, setDepth] = useState(3);

	// The command palette can jump here with a method already chosen.
	useEffect(() => { if (preset?.method && encoding[preset.method]) { setMethod(preset.method); setAuto(null); setError(""); } }, [preset]);

	const record = (entry) => { if (prefs.historyEnabled) setHistory((h) => pushCipher(h, entry, prefs.historyLimit)); };
	const labelOf = (id) => (id === "auto" ? "Auto Decode" : encoding[id]?.label.replace(/ \(.*\)$/, "") || id);

	const def = encoding[method];
	const opts = def?.params ? { shift: Number(shift) } : undefined;
	const likely = useMemo(() => detectFormats(input), [input]);

	const apply = async (m, op, text, o) => {
		try {
			const out = await encoding[m][op](text, o);
			setOutput(out); setError("");
			record({ method: m, op, input: text, output: out, ...(o ? { opts: o } : {}) });
			return true;
		} catch (e) {
			setError(e.message);
			return false;
		}
	};

	const run = async (op) => {
		if (!method) return toast("Please select a method", "error");
		if (!input) return toast("Enter some text first", "error");
		setAuto(null);
		if (await apply(method, op, input, opts)) { setLast({ method, op, opts }); setRepeats(0); }
	};

	const repeat = async () => {
		if (!last) return toast("Perform an encode/decode operation first", "error");
		if (!output.trim()) return toast("No output to repeat", "error");
		setAuto(null);
		if (await apply(last.method, last.op, output, last.opts)) setRepeats((n) => n + 1);
	};

	const runAuto = (text = input) => {
		if (!text.trim()) return toast("Enter some text first", "error");
		const results = autoDecode(text, { maxDepth: depth });
		setLast(null);
		if (!results.length) { setAuto({ results: [] }); setError(""); return; }
		setAuto({ results });
		setOutput(results[0].value);
		setError("");
		record({ method: "auto", op: "decode", input: text, output: results[0].value });
	};

	const restore = (h) => {
		if (h.method !== "auto" && encoding[h.method]) setMethod(h.method);
		if (h.opts?.shift !== undefined) setShift(h.opts.shift);
		setInput(h.input); setOutput(h.output); setError(""); setAuto(null);
	};

	const swap = () => {
		setInput(output); setOutput(input); setError(""); setAuto(null);
	};

	// Paste from the clipboard and immediately auto-decode it.
	const pasteAndProcess = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (!text.trim()) return toast("Clipboard is empty", "error");
			setInput(text);
			runAuto(text);
		} catch { toast("Paste failed – use Ctrl+V instead", "error"); }
	};

	const paste = async () => {
		try { setInput(await navigator.clipboard.readText()); toast("Pasted", "success"); }
		catch { toast("Paste failed – use Ctrl+V instead", "error"); }
	};

	return (
		<div className="space-y-4">
			<Field label="Input text" action={<div className="flex gap-1.5">
				<Button size="xs" variant="soft" icon="clipboard" onClick={paste}>Paste</Button>
				<Button size="xs" variant="soft" icon="zap" onClick={pasteAndProcess} title="Paste from the clipboard and auto-decode it">Paste &amp; process</Button>
				<Button size="xs" icon="trash" onClick={() => { setInput(""); setOutput(""); setError(""); setAuto(null); }}>Clear</Button>
			</div>}>
				<Textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter text to encode or decode…" />
			</Field>
			{!!input.trim() && !!likely.length && (
				<p className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
					Looks like:
					{likely.map((id) => <button key={id} onClick={() => setMethod(id)} title="Use this method"><Badge tone="brand">{AUTO_LABEL[id]}</Badge></button>)}
				</p>
			)}

			<div className="grid grid-cols-[1fr_auto] items-end gap-3">
				<Field label="Method">
					<Select value={method} onChange={(e) => setMethod(e.target.value)}>
						<option value="">Select a method…</option>
						{GROUPS.map((g) => (
							<optgroup key={g} label={g}>
								{CIPHERS.filter((m) => m.group === g).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
							</optgroup>
						))}
					</Select>
				</Field>
				{def?.params?.map((p) => (
					<Field key={p.id} label={p.label}>
						<Input type="number" min={p.min} max={p.max} value={shift} onChange={(e) => setShift(e.target.value)} className="!w-20" />
					</Field>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Button variant="primary" size="md" icon="lock" disabled={!!def && !def.encode} title={def && !def.encode ? `${def.label} can't be encoded` : undefined} onClick={() => run("encode")}>Encode</Button>
				<Button variant="soft" size="md" icon="key" disabled={!!def && !def.decode} title={def && !def.decode ? `${def.label} can't be decoded` : undefined} onClick={() => run("decode")}>Decode</Button>
				<div className="flex items-center">
					<Button size="md" icon="zap" className="!rounded-r-none" onClick={() => runAuto()} title="Detect the format and decode, up to the chosen number of layers">Auto Decode</Button>
					<select aria-label="Auto decode depth" value={depth} onChange={(e) => setDepth(Number(e.target.value))} title="Maximum layers to unwrap" className="h-10 rounded-r-xl border border-l-0 border-line bg-surface px-2 text-xs font-semibold text-fg outline-none">
						{DEPTHS.map((d) => <option key={d} value={d}>{d} layer{d > 1 ? "s" : ""}</option>)}
					</select>
				</div>
				<Button size="md" icon="repeat" onClick={repeat} title="Repeat the last operation on the output">Repeat <Badge>{repeats}</Badge></Button>
				<Button size="md" icon="refresh" onClick={swap} title="Swap input and output">Swap</Button>
			</div>

			{error && <p role="alert" className="rounded-2xl border border-brand bg-brand-soft px-4 py-2.5 text-sm text-brand-ink">{error}</p>}

			{auto && !auto.results.length && (
				<p className="rounded-2xl border border-line bg-surface-2/60 px-4 py-2.5 text-sm text-muted">No readable decoding found (tried up to {depth} layer{depth > 1 ? "s" : ""}). Try a different method manually, or raise the layer limit.</p>
			)}

			<Field label="Output" action={<div className="flex gap-1.5"><CopyButton size="xs" getText={() => output} empty="No output to copy" /><CopyAs getText={() => output} empty="No output to copy" /></div>}>
				<Textarea rows={4} value={output} readOnly placeholder="Result will appear here…" />
			</Field>

			<CipherHistory
				items={history}
				enabled={prefs.historyEnabled}
				labelOf={labelOf}
				onRestore={restore}
				onDelete={(id) => setHistory((h) => h.filter((x) => x.id !== id))}
				onClear={() => { setHistory([]); toast("Cipher history cleared", "success"); }}
			/>

			{auto?.results.length > 0 && (
				<div className="space-y-2">
					<p className="text-xs font-bold uppercase tracking-wider text-muted">Detected: {describePath(auto.results[0].path)}{auto.results.length > 1 ? ` · ${auto.results.length - 1} other guess${auto.results.length > 2 ? "es" : ""}` : ""}</p>
					{auto.results.map((r, i) => (
						<div key={i} className="space-y-1.5 rounded-2xl border border-line bg-surface-2/60 p-3">
							<div className="flex items-center justify-between gap-2">
								<div className="flex min-w-0 flex-wrap items-center gap-1.5">
									{i === 0 && <Badge tone="brand">Best guess</Badge>}
									<Badge tone="muted">{describePath(r.path)}</Badge>
									<span className="text-[11px] text-subtle">{Math.round(r.score * 100)}% readable</span>
								</div>
								<div className="flex gap-1.5">
									{i > 0 && <Button size="xs" variant="soft" onClick={() => setOutput(r.value)}>Use</Button>}
									<CopyButton size="xs" label="" getText={() => r.value} />
								</div>
							</div>
							<p className="break-all font-mono text-[13px] text-fg">{r.value.length > 300 ? r.value.slice(0, 300) + "…" : r.value}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
