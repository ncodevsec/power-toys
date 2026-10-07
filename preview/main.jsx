import "./mock-env.js"; // must run before App / lib/browser.js is evaluated
import { createRoot } from "react-dom/client";
import App from "../src/app/popup/App.jsx";
import ContextApp from "../src/app/context/App.jsx";
import { PatternsProvider, CustomPatternsProvider, SensitivePathsProvider, ToastProvider } from "../src/app/providers.jsx";
import { PreviewShell, Frame } from "./PreviewShell.jsx";

function Root() {
	return (
		<PatternsProvider>
			<CustomPatternsProvider>
				<SensitivePathsProvider>
					<ToastProvider>
						<PreviewShell>
							{(view) => {
								if (view === "popup") return <Frame width={600}><App /></Frame>;
								if (view === "fulltab") return <Frame width="100%"><App fullTab /></Frame>;
								return <Frame width={520}><ContextApp /></Frame>;
							}}
						</PreviewShell>
					</ToastProvider>
				</SensitivePathsProvider>
			</CustomPatternsProvider>
		</PatternsProvider>
	);
}

createRoot(document.getElementById("root")).render(<Root />);
