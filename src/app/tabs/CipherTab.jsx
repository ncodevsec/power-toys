import { useState } from "react";
import { Badge, Button, Card, CopyButton, Field, Select, Textarea } from "../components/ui/index.js";
import { encoding } from "../lib/encoding.js";
import { useToast } from "../providers.jsx";

export const METHODS = [
	["base64", "Base64"],
	["url", "URL encoding (percent-encoding)"],
	["html", "HTML entities"],
	["hex", "Hexadecimal"],
	["unicode", "Unicode escapes"],
];

export default function CipherTab() {
	const toast = useToast();
	const [input, setInput] = useState("");
	const [output, setOutput] = useState("");
	const [method, setMethod] = useState("");
	const [last, setLast] = useState(null); // { method, op }
	const [repeats, setRepeats] = useState(0);

	const run = (op) => {
		if (!method) return toast("Please select an encoding method", "error");
		try { setOutput(encoding[method][op](input)); setLast({ method, op }); setRepeats(0); }
		catch (e) { setOutput(`Error: ${e.message}`); }
	};

	const repeat = () => {
		if (!last) return toast("Perform an encode/decode operation first", "error");
		if (!output.trim()) return toast("No output to repeat", "error");
		try { setOutput(encoding[last.method][last.op](output)); setRepeats((n) => n + 1); }
		catch (e) { setOutput(`Error: ${e.message}`); }
	};

	const paste = async () => {
		try { setInput(await navigator.clipboard.readText()); toast("Pasted", "success"); }
		catch { toast("Paste failed – use Ctrl+V instead", "error"); }
	};

	return (
		<Card>
			<div className="space-y-4 p-4">
				<Field label="Input text" action={<Button size="xs" variant="soft" icon="clipboard" onClick={paste}>Paste</Button>}>
					<Textarea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter text to encode or decode…" />
				</Field>
				<Field label="Method">
					<Select value={method} onChange={(e) => setMethod(e.target.value)}>
						<option value="">Select an encoding method…</option>
						{METHODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
					</Select>
				</Field>
				<div className="flex items-center gap-2">
					<Button variant="primary" size="md" icon="lock" onClick={() => run("encode")}>Encode</Button>
					<Button variant="soft" size="md" icon="key" onClick={() => run("decode")}>Decode</Button>
					<Button size="md" icon="repeat" onClick={repeat} title="Repeat the last operation on the output">
						Repeat <Badge>{repeats}</Badge>
					</Button>
				</div>
				<Field label="Output" action={<CopyButton size="xs" getText={() => output} empty="No output to copy" />}>
					<Textarea rows={4} value={output} readOnly placeholder="Result will appear here…" />
				</Field>
			</div>
		</Card>
	);
}
