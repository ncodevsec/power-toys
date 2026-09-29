import { useEffect, useRef, useState } from "react";
import { Button } from "./Button.jsx";
import { Icon } from "./Icon.jsx";

export function Dropdown({ label, icon, items }) {
	const [open, setOpen] = useState(false);
	const ref = useRef();
	useEffect(() => {
		const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
		document.addEventListener("click", close);
		return () => document.removeEventListener("click", close);
	}, []);
	return (
		<div ref={ref} className="relative">
			<Button icon={icon} onClick={() => setOpen((o) => !o)}>
				{label}
				<Icon name="chevron" size={12} />
			</Button>
			{open && (
				<div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-pop">
					{items.map((it) => (
						<button key={it.label} onClick={() => { setOpen(false); it.onClick(); }} className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-fg transition hover:bg-brand-soft hover:text-brand-ink">
							{it.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
