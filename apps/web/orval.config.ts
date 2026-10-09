import { defineConfig } from "orval";

export default defineConfig({
	api: {
		input: "http://127.0.0.1:8000/openapi.json",
		output: {
			target: "./src/lib/generated/api-generated.ts",
			client: "fetch",
			mode: "single",
			baseUrl: "/api",
			mock: false,
		},
	},
});
