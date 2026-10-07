import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Field, Input } from "../../components/ui/index.js";
import { identifyHash } from "../../lib/hash.js";
import { useToast } from "../../providers.jsx";

export default function HashIdPanel() {
	const toast = useToast();
	const [input, setInput] = useState("");
	const [checked, setChecked] = useState(false);

	const matches = useMemo(() => (checked ? identifyHash(input) : []), [checked, input]);

	const paste = async () => {
		try { setInput(await navigator.clipboard.readText()); setChecked(false); toast("Pasted", "success"); }
		catch { toast("Paste failed – use Ctrl+V instead", "error"); }
	};

	return (
		<div className="space-y-4">
			<Field label="Hash" action={<Button size="xs" variant="soft" icon="clipboard" onClick={paste}>Paste</Button>}>
				<Input value={input} onChange={(e) => { setInput(e.target.value); setChecked(false); }} placeholder="5f4dcc3b5aa765d61d8327deb882cf99" className="font-mono" />
			</Field>
			<Button variant="primary" size="md" icon="hash" onClick={() => (input.trim() ? setChecked(true) : toast("Enter a hash first", "error"))}>
				Identify
			</Button>

			{checked && !matches.length && (
				<EmptyState icon="hash" title="No match" hint="Doesn't match a recognized hash length or format." />
			)}

			{!!matches.length && (
				<div className="space-y-2">
					{matches.map((m, i) => (
						<div key={i} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface-2/60 px-4 py-2.5">
							<span className="text-sm font-semibold">{m.name}</span>
							<Badge>{m.note}</Badge>
						</div>
					))}
				</div>
			)}
			<p className="text-xs text-subtle">Hash identification is ambiguous by nature — many algorithms share a length. Treat these as candidates, not certainties.</p>
		</div>
	);
}
