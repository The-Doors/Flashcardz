import {
	Button,
	type CSSVariablesResolver,
	createTheme,
	Input,
	Modal,
	Paper,
} from "@mantine/core";

export const theme = createTheme({
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	fontSizes: { xs: "12px", sm: "13px", md: "14px" },
	defaultRadius: "8px",
	components: {
		Button: Button.extend({
			defaultProps: { size: "sm" },
			styles: { root: { height: 36, paddingInline: 14, fontSize: 13 } },
		}),
		Paper: Paper.extend({ defaultProps: { radius: 10, bg: "var(--panel)" } }),
		Modal: Modal.extend({
			defaultProps: { centered: true, radius: 12, padding: 24 },
			styles: {
				content: {
					background: "var(--panel)",
					border: "1px solid var(--border)",
				},
				header: { background: "var(--panel)" },
				title: { fontWeight: 700 },
			},
		}),
		Input: Input.extend({ styles: { input: { background: "var(--bg)" } } }),
	},
	headings: {
		sizes: {
			h1: { fontSize: "24px" },
			h2: { fontSize: "18px" },
			h3: { fontSize: "16px" },
		},
	},
	primaryColor: "flashcardz",
	colors: {
		flashcardz: [
			"#f2f7ff",
			"#e2ebff",
			"#c3d5ff",
			"#9dbbff",
			"#759fff",
			"#5688ff",
			"#3d78ff",
			"#2866e6",
			"#1a58cc",
			"#104bb3",
		],
	},
});

const appColors = {
	"--mantine-color-body": "var(--bg)",
	"--mantine-color-text": "var(--text)",
	"--mantine-color-dimmed": "var(--text-muted)",
	"--mantine-color-placeholder": "var(--text-muted)",
	"--mantine-color-default": "var(--panel)",
	"--mantine-color-default-color": "var(--text)",
	"--mantine-color-default-hover": "var(--panel-hover)",
	"--mantine-color-default-border": "var(--border)",
	"--mantine-color-disabled": "var(--panel-hover)",
	"--mantine-color-disabled-color": "var(--text-muted)",
	"--mantine-color-flashcardz-filled": "var(--accent)",
	"--mantine-color-flashcardz-filled-hover":
		"color-mix(in srgb, var(--accent), black 10%)",
};

export const cssVariablesResolver: CSSVariablesResolver = () => ({
	variables: {},
	light: appColors,
	dark: appColors,
});
