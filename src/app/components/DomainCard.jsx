import { Badge, Card, CardHeader, CopyButton } from "./ui/index.js";
import { Favicon } from "./Favicon.jsx";

/** Card with a domain favicon, a count badge and a "copy group" button. */
export function DomainCard({ domain, count, unit, getCopyText, children }) {
	return (
		<Card>
			<CardHeader
				leading={<Favicon domain={domain} size={24} />}
				title={domain}
				actions={<><Badge>{count} {unit}</Badge><CopyButton label="" size="xs" getText={getCopyText} /></>}
			/>
			<ul className="divide-y divide-line">{children}</ul>
		</Card>
	);
}
