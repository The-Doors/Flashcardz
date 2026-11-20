import {
	ColorSchemeScript,
	localStorageColorSchemeManager,
	MantineProvider,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import "@mantine/notifications/styles.css";

import type { QueryClient } from "@tanstack/react-query";
import { AuthProvider } from "../lib/auth";
import appCss from "../styles.css?url";
import { cssVariablesResolver, theme } from "../theme";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Flashcardz",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<ColorSchemeScript
					defaultColorScheme="dark"
					localStorageKey="flashcards-theme"
				/>
				<HeadContent />
			</head>
			<body>
				<MantineProvider
					theme={theme}
					cssVariablesResolver={cssVariablesResolver}
					defaultColorScheme="dark"
					colorSchemeManager={localStorageColorSchemeManager({
						key: "flashcards-theme",
					})}
				>
					<Notifications />
					<AuthProvider>{children}</AuthProvider>
				</MantineProvider>
				<Scripts />
			</body>
		</html>
	);
}
