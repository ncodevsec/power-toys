import { Button, Icon } from "./ui/index.js";
import { useStoredState } from "../hooks/useStoredState.js";
import { usePrefs } from "../lib/prefs.js";

const TIPS = [
	["eye", "Recon", "Open a site, then browse its Links, Params, Secrets, Paths and Headers."],
	["search", "Command palette", "Press Ctrl/Cmd+K to jump to any tool or cipher."],
	["lock", "Cipher", "Encode, decode or Auto Decode text; Utilities has a formatter, diff, epoch converter, UUID and regex tester."],
	["zap", "Right-click and shortcuts", "Select text and use Power Toys in the right-click menu, or press Ctrl/Cmd+Shift+D to auto-decode it."],
];

/** First-run welcome card. Dismissed once, or hidden for good by turning off
 * "Tips and hints" in Settings → General. */
export function Onboarding({ onOpenPalette }) {
	const [done, setDone, ready] = useStoredState("onboardingDone", false);
	const [prefs] = usePrefs();
	if (!ready || done || !prefs.showTips) return null;
	return (
		<section className="mb-4 space-y-3 rounded-2xl border border-brand/40 bg-brand-soft p-4" aria-label="Welcome">
			<div>
				<h2 className="text-sm font-extrabold text-fg">Welcome to Power Toys</h2>
				<p className="mt-0.5 text-xs text-muted">A few things worth knowing:</p>
			</div>
			<ul className="space-y-2">
				{TIPS.map(([icon, title, text]) => (
					<li key={title} className="flex items-start gap-2.5 text-xs">
						<span className="mt-0.5 text-brand-ink"><Icon name={icon} size={14} /></span>
						<span><span className="font-bold text-fg">{title}.</span> <span className="text-muted">{text}</span></span>
					</li>
				))}
			</ul>
			<p className="flex items-start gap-2 rounded-xl bg-surface/60 px-3 py-2 text-xs text-muted"><Icon name="shield" size={14} className="mt-0.5 text-brand-ink" />Privacy: everything runs locally in your browser. Nothing is sent to us. Requests go only to sites you choose to scan.</p>
			<div className="flex gap-2">
				<Button variant="primary" size="sm" icon="check" onClick={() => setDone(true)}>Got it</Button>
				<Button size="sm" icon="search" onClick={onOpenPalette}>Open command palette</Button>
			</div>
		</section>
	);
}
