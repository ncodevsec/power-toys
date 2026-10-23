import { Card, Tabs } from "../components/ui/index.js";
import { CIPHER_SUBTABS } from "../lib/navigation.js";
import EncodeDecodePanel from "./cipher/EncodeDecodePanel.jsx";
import JwtPanel from "./cipher/JwtPanel.jsx";
import HashIdPanel from "./cipher/HashIdPanel.jsx";
import UtilitiesPanel from "./cipher/UtilitiesPanel.jsx";

/**
 * `mode`/`onModeChange` are controlled from App.jsx (like Recon's sub-tab)
 * so the full-tab sidebar's Cipher accordion and this tab's own chip row
 * drive the same state. `fullTab` hides the chip row there, since the
 * sidebar already provides that navigation.
 */
export default function CipherTab({ mode, onModeChange, fullTab, preset }) {
	return (
		<div className="space-y-3">
			<Card>
				<div className="p-4">
					{mode === "encode" && <EncodeDecodePanel preset={preset} />}
					{mode === "jwt" && <JwtPanel />}
					{mode === "hash" && <HashIdPanel />}
					{mode === "tools" && <UtilitiesPanel />}
				</div>
			</Card>
		</div>
	);
}
