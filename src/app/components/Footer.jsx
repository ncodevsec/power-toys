import { getVersion } from "../lib/browser.js";

export function Footer() {
	return (
		<footer className="px-4 pb-8 pt-4 text-center text-xs text-subtle">
			<p className="font-semibold text-muted">Power Toys v{getVersion()} · A bug hunting tool</p>
			<p className="mt-1">
				by <a className="font-bold text-brand hover:underline" href="https://github.com/ncodevsec" target="_blank" rel="noopener noreferrer">nCodevSec</a>
				{" · "}
				<a className="font-bold text-brand hover:underline" href="https://github.com/ncodevsec/power-toys" target="_blank" rel="noopener noreferrer">GitHub</a>
			</p>
		</footer>
	);
}
