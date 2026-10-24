import { Card } from "../components/ui/index.js";
import BulkTab from "./BulkTab.jsx";
import UtilitiesPanel from "./utilities/UtilitiesPanel.jsx";

// `mode` is controlled from App.jsx (like Recon/Cipher sub-tabs) so the popup's
// chip row and the full-tab sidebar's Utilities accordion drive the same state.
export default function UtilitiesTab({ mode }) {
	if (mode === "bulk") return <BulkTab />;
	return (
		<Card>
			<div className="p-4">
				<UtilitiesPanel tool={mode} />
			</div>
		</Card>
	);
}
