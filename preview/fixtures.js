export const FIXTURE_LINKS = [
	{ fullUrl: "https://app.example.com/dashboard", category: "Paths", domain: "app.example.com", path: "/dashboard" },
	{ fullUrl: "https://app.example.com/admin/users?session_id=8f19a2c7&role=admin", category: "Paths", domain: "app.example.com", path: "/admin/users?session_id=8f19a2c7&role=admin" },
	{ fullUrl: "https://app.example.com/api/v1/auth/login", category: "Paths", domain: "app.example.com", path: "/api/v1/auth/login" },
	{ fullUrl: "https://app.example.com/reset-password?token=eyJhbGciOi.reset.tok", category: "Paths", domain: "app.example.com", path: "/reset-password?token=eyJhbGciOi.reset.tok" },
	{ fullUrl: "https://app.example.com/assets/bundle.min.js", category: "Files", domain: "app.example.com", path: "/assets/bundle.min.js" },
	{ fullUrl: "https://app.example.com/assets/app.css", category: "Files", domain: "app.example.com", path: "/assets/app.css" },
	{ fullUrl: "https://app.example.com/assets/logo.svg", category: "Files", domain: "app.example.com", path: "/assets/logo.svg" },
	{ fullUrl: "https://app.example.com/reports/q3-financials.pdf", category: "Files", domain: "app.example.com", path: "/reports/q3-financials.pdf" },
	{ fullUrl: "https://app.example.com/backup/2024-export.sql", category: "Files", domain: "app.example.com", path: "/backup/2024-export.sql" },
	{ fullUrl: "https://app.example.com/about", category: "Others", domain: "app.example.com", path: "/about" },
	{ fullUrl: "https://cdn.example.com/lib/react.production.min.js", category: "Files", domain: "cdn.example.com", path: "/lib/react.production.min.js" },
	{ fullUrl: "https://cdn.example.com/fonts/inter.woff2", category: "Files", domain: "cdn.example.com", path: "/fonts/inter.woff2" },
	{ fullUrl: "https://api.stripe.com/v1/tokens?client_secret=sk_live_51H8x", category: "Paths", domain: "api.stripe.com", path: "/v1/tokens?client_secret=sk_live_51H8x" },
	{ fullUrl: "https://www.googletagmanager.com/gtag/js?id=G-1PXQ", category: "Others", domain: "www.googletagmanager.com", path: "/gtag/js?id=G-1PXQ" },
];

export const FIXTURE_SECRETS = {
	apiKeys: [
		{ type: "API Key", pattern: "apiKey: 'AIzaSyD-9f8h2mNcR7pQvXo1kLwYtZs3eB6jUiA'", value: "AIzaSyD-9f8h2mNcR7pQvXo1kLwYtZs3eB6jUiA", source: "JS/CSS Code" },
		{ type: "API Key", pattern: "authorization: 'Bearer 7f0a3c9e5d2b1846af90c3de6712bf58'", value: "7f0a3c9e5d2b1846af90c3de6712bf58", source: "JS/CSS Code" },
		{ type: "Data Attribute", pattern: "data-token=\"pk_live_51H8xTz9QwErTy\"", source: "HTML Attributes" },
	],
	credentials: [
		{ type: "Credential", pattern: "username: 'svc_deploy_bot'", value: "svc_deploy_bot", source: "JS/CSS Code" },
		{ type: "Credential", pattern: "password: 'Tmp!Passw0rd2024'", value: "Tmp!Passw0rd2024", source: "JS/CSS Code" },
	],
	endpoints: [
		{ type: "Endpoint", value: "https://internal-api.example.com/v2/graphql", source: "JS/CSS Code" },
		{ type: "Endpoint", value: "https://staging.example.com/webhook/deploy", source: "JS/CSS Code" },
	],
	paths: [
		{ type: "Path", value: "/api/internal/debug/dump", source: "JS/CSS Code" },
		{ type: "Path", value: "/.git/config", source: "JS/CSS Code" },
	],
	comments: [
		{ type: "HTML Comment", content: "<!-- TODO: remove /admin/legacy before launch, still using default creds -->", source: "Page Source", sourceUrl: "https://app.example.com/dashboard" },
		{ type: "JavaScript Comment", content: "// FIXME: hardcoded staging key, rotate before prod deploy", source: "Script", sourceUrl: "https://app.example.com/dashboard" },
	],
	hiddenLinks: [
		{ type: "Hidden URL", value: "https://old-staging.example.com/admin", source: "HTML Comment" },
		{ type: "Hidden Path", value: "/internal/status", source: "HTML Comment" },
	],
};
