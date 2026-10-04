import { defineConfig } from "vite";
import type { RolldownLog } from "rolldown";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({
			rollupConfig: {
				external: [/^@sentry\//],
				onwarn(warning: RolldownLog, warn: (warning: RolldownLog) => void) {
					if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
				},
			},
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
