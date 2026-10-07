import { Card, Tabs } from "../components/ui/index.js";
import { CIPHER_SUBTABS } from "../lib/navigation.js";
import EncodeDecodePanel from "./cipher/EncodeDecodePanel.jsx";
import AutoDecodePanel from "./cipher/AutoDecodePanel.jsx";
import JwtPanel from "./cipher/JwtPanel.jsx";
import HashIdPanel from "./cipher/HashIdPanel.jsx";

/**
 * `mode`/`onModeChange` are controlled from App.jsx (like Recon's sub-tab)
 * so the full-tab sidebar's Cipher accordion and this tab's own chip row
 * drive the same state. `fullTab` hides the chip row there, since the
 * sidebar already provides that navigation.
 */
export default function CipherTab({ mode, onModeChange, fullTab }) {
	return (
		<div className="space-y-3">
			{!fullTab && <Tabs variant="chip" items={CIPHER_SUBTABS} value={mode} onChange={onModeChange} />}
			<Card>
				<div className="p-4">
					{mode === "encode" && <EncodeDecodePanel />}
					{mode === "auto" && <AutoDecodePanel />}
					{mode === "jwt" && <JwtPanel />}
					{mode === "hash" && <HashIdPanel />}
				</div>
			</Card>
		</div>
	);
}
