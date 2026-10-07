import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader.jsx";
import { Badge, Button, CopyButton, IconButton, Textarea } from "../components/ui/index.js";
import { METHODS } from "../lib/encoding.js";
import { encoding } from "../lib/encoding.js";
import { getURL, sendMessage, storage } from "../lib/browser.js";
import { useToast } from "../providers.jsx";

const methodLabel = (id) => METHODS.find(([m]) => m === id)?.[1] || id;

export default function App() {
	const toast = useToast();
	const [data, setData] = useState(null); // { selectedText, method, operation }
	const [output, setOutput] = useState("");
	const [repeats, setRepeats] = useState(0);
	const fullScreen = new URLSearchParams(location.search).has("selectedText");

	useEffect(() => {
		const run = (d) => {
			if (!d?.selectedText || !encoding[d.method]?.[d.operation]) return;
			setData(d);
			try { setOutput(encoding[d.method][d.operation](d.selectedText)); }
			catch (e) { setOutput(`Error: ${e.message}`); }
		};
		if (fullScreen) {
			const p = new URLSearchParams(location.search);
			run({ selectedText: p.get("selectedText"), method: p.get("method"), operation: p.get("operation") });
			return;
		}
		sendMessage({ action: "getContextData" }).then((res) => {
			if (res?.selectedText) return run(res);
			storage.get("local", ["contextMenuData"]).then((r) => run(r?.contextMenuData));
		});
	}, [fullScreen]);

	const repeat = () => {
		if (!data || !output.trim()) return toast("No output to repeat", "error");
		try { setOutput(encoding[data.method][data.operation](output)); setRepeats((n) => n + 1); }
		catch (e) { setOutput(`Error: ${e.message}`); }
	};

	const openFull = () => {
		const p = new URLSearchParams({ selectedText: document.getElementById("ctx-input")?.value || "", method: data.method, operation: data.operation });
		window.open(getURL(`src/pages/context-popup.html?${p}`), "_blank");
		window.close();
	};

	return (
		<div>
			<AppHeader
				title="Encode" accent="/Decode"
				subtitle={data ? `${methodLabel(data.method)} · ${data.operation}` : "Waiting for selection…"}
				actions={<>
					{data && <Badge tone="solid">{data.operation}</Badge>}
					{!fullScreen && <IconButton icon="maximize" label="Open full screen" onClick={openFull} />}
				</>}
			/>
			<div className="space-y-4 p-4">
				<div className="space-y-1.5">
					<label className="text-xs font-bold uppercase tracking-wider text-muted">Input</label>
					<Textarea id="ctx-input" rows={5} readOnly value={data?.selectedText || ""} placeholder="Select text on a page and use the right-click menu…" />
				</div>
				<div className="space-y-1.5">
					<label className="text-xs font-bold uppercase tracking-wider text-muted">Output</label>
					<Textarea rows={5} readOnly value={output} />
				</div>
				<div className="flex gap-2">
					<CopyButton className="flex-1" variant="primary" size="md" getText={() => output} empty="No output to copy" />
					<Button className="flex-1" size="md" icon="repeat" onClick={repeat}>Repeat <Badge>{repeats}</Badge></Button>
				</div>
			</div>
		</div>
	);
}
