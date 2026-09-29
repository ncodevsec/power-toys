import { useState } from "react";
import { useToast } from "../../providers.jsx";
import { Button } from "./Button.jsx";

/** Copies `getText()`; shows a check for 1.5s. Toasts `empty` if nothing to copy. */
export function CopyButton({ getText, label = "Copy", empty = "Nothing to copy", ...props }) {
	const toast = useToast();
	const [done, setDone] = useState(false);
	const onClick = async () => {
		const text = getText();
		if (!text?.trim()) return toast(empty, "error");
		try {
			await navigator.clipboard.writeText(text);
			setDone(true);
			setTimeout(() => setDone(false), 1500);
		} catch {
			toast("Failed to copy", "error");
		}
	};
	return (
		<Button icon={done ? "check" : "copy"} onClick={onClick} {...props}>
			{label && (done ? "Copied!" : label)}
		</Button>
	);
}
