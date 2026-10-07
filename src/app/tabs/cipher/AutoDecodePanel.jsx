import { useMemo, useState } from "react";
import { Badge, Button, CopyButton, EmptyState, Field, Textarea } from "../../components/ui/index.js";
import { autoDecode } from "../../lib/encoding.js";
import { useToast } from "../../providers.jsx";

const METHOD_LABEL = { base64: "Base64", url: "URL", html: "HTML", hex: "Hex", unicode: "Unicode" };

export default function AutoDecodePanel() {
	const toast = useToast();
	const [input, setInput] = useState("");
	const [ran, setRan] = useState(false);

	const results = useMemo(() => (ran ? autoDecode(input) : []), [ran, input]);

	const paste = async () => {
		try { setInput(await navigator.clipboard.readText()); toast("Pasted", "success"); }
		catch { toast("Paste failed – use Ctrl+V instead", "error"); }
	};

	return (
		<div className="space-y-4">
			<Field label="Input text" action={<Button size="xs" variant="soft" icon="clipboard" onClick={paste}>Paste</Button>}>
				<Textarea rows={4} value={input} onChange={(e) => { setInput(e.target.value); setRan(false); }} placeholder="Paste an unknown or multi-layer encoded value…" />
			</Field>
			<Button variant="primary" size="md" icon="zap" onClick={() => (input.trim() ? setRan(true) : toast("Enter some text first", "error"))}>
				Auto-decode
			</Button>

			{ran && !results.length && (
				<EmptyState icon="zap" title="No printable decode found" hint="Tried Base64, URL, HTML, Hex, and Unicode up to 3 layers deep — nothing produced readable text." />
			)}

			{!!results.length && (
				<div className="space-y-2">
					{results.map((r, i) => (
						<div key={i} className="space-y-1.5 rounded-2xl border border-line bg-surface-2/60 p-3">
							<div className="flex items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-1.5">
									{r.path.map((m, idx) => (
										<Badge key={idx} tone={idx === r.path.length - 1 ? "brand" : "muted"}>{METHOD_LABEL[m]}</Badge>
									))}
								</div>
								<CopyButton size="xs" label="" getText={() => r.value} />
							</div>
							<p className="break-all font-mono text-[13px] text-fg">{r.value}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
