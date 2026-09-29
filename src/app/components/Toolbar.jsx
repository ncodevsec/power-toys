import { Button } from "./ui/index.js";

export const Toolbar = ({ left, right }) => (
	<div className="flex flex-wrap items-center justify-between gap-2">
		<div className="min-w-0">{left}</div>
		<div className="flex items-center gap-2">{right}</div>
	</div>
);

export const SensitiveToggle = ({ active, onClick }) => (
	<Button icon="shield" active={active} onClick={onClick} title="Show only sensitive items">Sensitive</Button>
);

export const ResultCount = ({ show, count }) =>
	show ? <p className="px-1 text-xs font-bold text-brand">Found {count} {count === 1 ? "item" : "items"}</p> : null;
