import {
	HeadContent,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/react-router";
import { Anchor, AppShell, MantineProvider, Text } from "@mantine/core";
import { theme } from "../theme";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

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
				<HeadContent />
			</head>
			<body>
				<MantineProvider theme={theme}>
					<AppShell header={{ height: 60 }}>
						<AppShell.Header
							px="md"
							style={{ display: "flex", alignItems: "center" }}
						>
							<Anchor href="/" underline="never">
								<Text fw={700} size="lg" c="var(--text)">
									Flashcardz
								</Text>
							</Anchor>
						</AppShell.Header>
						<AppShell.Main>{children}</AppShell.Main>
					</AppShell>
				</MantineProvider>
				<Scripts />
			</body>
		</html>
	);
}
