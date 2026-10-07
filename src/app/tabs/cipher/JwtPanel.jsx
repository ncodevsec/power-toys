import { useState } from "react";
import { Badge, Button, Code, CopyButton, Field, Textarea } from "../../components/ui/index.js";
import { decodeJwt } from "../../lib/jwt.js";
import { useToast } from "../../providers.jsx";

function JsonBlock({ title, data }) {
	const text = JSON.stringify(data, null, 2);
	return (
		<Field label={title} action={<CopyButton size="xs" label="" getText={() => text} />}>
			<Code block className="max-h-56 overflow-y-auto">{text}</Code>
		</Field>
	);
}

export default function JwtPanel() {
	const toast = useToast();
	const [input, setInput] = useState("");
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");

	const paste = async () => {
		try { setInput(await navigator.clipboard.readText()); toast("Pasted", "success"); }
		catch { toast("Paste failed – use Ctrl+V instead", "error"); }
	};

	const decode = () => {
		if (!input.trim()) return toast("Paste a JWT first", "error");
		try { setResult(decodeJwt(input)); setError(""); }
		catch (e) { setResult(null); setError(e.message); }
	};

	return (
		<div className="space-y-4">
			<Field label="JWT" action={<Button size="xs" variant="soft" icon="clipboard" onClick={paste}>Paste</Button>}>
				<Textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...." />
			</Field>
			<Button variant="primary" size="md" icon="key" onClick={decode}>Decode</Button>

			{error && <p className="rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-sm text-muted">{error}</p>}

			{result && (
				<div className="space-y-4">
					{!!result.warnings.length && (
						<div className="space-y-1.5 rounded-2xl border border-line bg-surface-2/60 p-3">
							{result.warnings.map((w, i) => (
								<div key={i} className="flex items-start gap-2 text-sm">
									<Badge tone="danger" className="mt-0.5 shrink-0">!</Badge>
									<span className="text-fg">{w}</span>
								</div>
							))}
						</div>
					)}
					<JsonBlock title="Header" data={result.header} />
					<JsonBlock title="Payload" data={result.payload} />
					<Field label="Signature">
						<Code block>{result.signature || "(none)"}</Code>
					</Field>
				</div>
			)}
		</div>
	);
}
