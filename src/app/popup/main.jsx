import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider, PatternsProvider } from "../providers.jsx";

const fullTab = new URLSearchParams(location.search).has("fullTab");
if (fullTab) document.title = "Power Toys — Full View";

createRoot(document.getElementById("root")).render(
	<PatternsProvider>
		<ToastProvider>
			<App fullTab={fullTab} />
		</ToastProvider>
	</PatternsProvider>,
);
