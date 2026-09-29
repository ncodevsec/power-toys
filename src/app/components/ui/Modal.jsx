import { useEffect } from "react";
import { IconButton } from "./Button.jsx";

export function Modal({ open, title, onClose, footer, children }) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 grid place-items-center p-4">
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
			<div role="dialog" aria-modal="true" className="relative flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-pop">
				<div className="flex items-center justify-between border-b border-line bg-surface-2/70 px-5 py-3">
					<h2 className="text-base font-bold">{title}</h2>
					<IconButton icon="x" label="Close" variant="ghost" onClick={onClose} />
				</div>
				<div className="overflow-y-auto p-5">{children}</div>
				{footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2/70 px-5 py-3">{footer}</div>}
			</div>
		</div>
	);
}
