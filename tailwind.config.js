/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/pages/**/*.{html,js}", "./src/scripts/**/*.js"],
	theme: {
		extend: {
			colors: {
				"cyber-dark": "#0a0c10",
				"cyber-card": "rgba(18, 21, 28, 0.8)",
			},
		},
	},
	plugins: [],
	darkMode: "class",
};
