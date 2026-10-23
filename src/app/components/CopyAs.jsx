import { Dropdown } from "./ui/index.js";
import { COPY_MODES, formatCopy } from "../lib/copyAs.js";
import { useToast } from "../providers.jsx";

/** "Copy as…" menu: plain text, a JSON string, or an escaped string. */
export function CopyAs({ getText, empty = "Nothing to copy" }) {
	const toast = useToast();
	const copy = async (mode) => {
		const text = getText();
		if (!text?.trim()) return toast(empty, "error");
		try {
			await navigator.clipboard.writeText(formatCopy(text, mode));
			toast("Copied", "success");
		} catch {
			toast("Failed to copy", "error");
		}
	};
	return <Dropdown icon="copy" label="Copy as" items={COPY_MODES.map(([mode, label]) => ({ label, onClick: () => copy(mode) }))} />;
}
