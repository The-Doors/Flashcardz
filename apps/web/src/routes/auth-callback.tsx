import { Alert, Button, Center, Stack, Text, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/auth-callback")({
	component: AuthCallbackPage,
});

/** Lands OAuth and email-confirmation redirects on the homepage, where AuthModal takes over. */
function AuthCallbackPage() {
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!supabase) {
			setFailed(true);
			return;
		}
		void supabase.auth.getSession().then(({ data, error }) => {
			if (error || !data.session) setFailed(true);
			else window.location.replace("/");
		});
	}, []);

	return (
		<Center mih="100%" p="md">
			<Stack w="100%" maw={420}>
				{failed ? (
					<>
						<Title order={2}>Unable to finish sign-in</Title>
						<Alert color="red">
							Sign-in could not be completed. Please try again.
						</Alert>
						<Button component={Link} to="/">
							Back to home
						</Button>
					</>
				) : (
					<Text>Signing you in…</Text>
				)}
			</Stack>
		</Center>
	);
}
