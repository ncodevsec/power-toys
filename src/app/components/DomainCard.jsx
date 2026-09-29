import { Badge, Card, CardHeader, CopyButton } from "./ui/index.js";
import { initialOf } from "../lib/utils.js";

/** Card with a domain avatar, a count badge and a "copy group" button. */
export function DomainCard({ domain, count, unit, getCopyText, children }) {
	return (
		<Card>
			<CardHeader
				leading={<span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand text-[11px] font-extrabold text-white">{initialOf(domain)}</span>}
				title={domain}
				actions={<><Badge>{count} {unit}</Badge><CopyButton label="" size="xs" getText={getCopyText} /></>}
			/>
			<ul className="divide-y divide-line">{children}</ul>
		</Card>
	);
}
