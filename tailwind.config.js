/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/pages/**/*.{html,js}", "./src/scripts/**/*.js"],
	theme: {
		extend: {
			colors: {
				"bg-main": "var(--bg-main, #f8fafc)",
				"bg-card": "var(--bg-card, #ffffff)",
				"bg-header": "var(--bg-header, #f3f4f6)",
				"text-main": "var(--text-main, #1e293b)",
				"text-muted": "var(--text-muted, #64748b)",
				border: "var(--border-color, #e2e8f0)",
				"accent-blue": "#3b82f6",
				"accent-green": "#3bf699",
				"accent-red": "#ef4444",
				"accent-yellow": "#ffd651",
				"cyber-dark": "#0a0c10",
				"cyber-card": "rgba(18, 21, 28, 0.8)",
			},
			spacing: {
				container: "650px",
			},
			borderRadius: {
				sm: "0.5rem",
				md: "6px",
				lg: "12px",
			},
			boxShadow: {
				sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
				md: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
				lg: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
			},
			fontFamily: {
				sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
				mono: '"Courier New", monospace',
			},
			transitionDuration: {
				100: "0.1s",
			},
		},
	},
	plugins: [],
	darkMode: "class",
};
