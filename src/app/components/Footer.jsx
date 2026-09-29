import { getVersion } from "../lib/browser.js";
import { GithubGlyph, Icon } from "./ui/index.js";

// Only real, already-documented destinations (all appear in the project's
// own README) — no placeholder or fabricated social accounts.
const LINKS = [
	{ href: "https://github.com/ncodevsec", label: "GitHub profile", glyph: <GithubGlyph size={17} /> },
	{ href: "https://github.com/ncodevsec/power-toys/stargazers", label: "Star on GitHub", icon: "star" },
	{ href: "https://github.com/ncodevsec/power-toys/issues", label: "Report an issue", icon: "alert-circle" },
	{ href: "https://github.com/ncodevsec/power-toys/discussions", label: "Join the discussion", icon: "message-circle" },
];

export function Footer() {
	return (
		<footer className="space-y-4 border-t border-line px-4 pb-7 pt-6">
			<div className="flex items-center justify-center gap-2.5">
				{LINKS.map((l) => (
					<a
						key={l.href}
						href={l.href}
						target="_blank"
						rel="noopener noreferrer"
						title={l.label}
						aria-label={l.label}
						className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-muted transition hover:border-brand/50 hover:text-brand hover:shadow-sm"
					>
						{l.glyph ?? <Icon name={l.icon} size={16} />}
					</a>
				))}
			</div>
			<div className="text-center">
				<p className="text-xs font-semibold text-muted">Power Toys v{getVersion()}</p>
				<p className="mt-0.5 text-[11px] text-subtle">A bug hunting toolkit, built for pentesters and bug hunters</p>
			</div>
		</footer>
	);
}
