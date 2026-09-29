import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "../providers.jsx";

createRoot(document.getElementById("root")).render(
	<ToastProvider>
		<App />
	</ToastProvider>,
);
