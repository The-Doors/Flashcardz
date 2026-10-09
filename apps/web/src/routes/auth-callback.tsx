import { Alert, Button, Center, Stack, Text, TextInput, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createUser, readCurrentUser } from "../lib/api-lib";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/auth-callback")({
	component: AuthCallbackPage,
});

function AuthCallbackPage() {
	const [checking, setChecking] = useState(true);
	const [needsUsername, setNeedsUsername] = useState(false);
	const [username, setUsername] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [created, setCreated] = useState(false);

	useEffect(() => {
		let active = true;
		async function checkProfile() {
			if (!supabase) {
				setError("Supabase is not configured.");
				setChecking(false);
				return;
			}
			const {
				data: { session },
				error: sessionError,
			} = await supabase.auth.getSession();
			if (!active) return;
			if (sessionError || !session) {
				setError("Sign-in could not be completed. Please return to login and try again.");
				setChecking(false);
				return;
			}
			try {
				const profile = await readCurrentUser(session.access_token);
				if (active) setNeedsUsername(profile === null);
      } catch (error) {
        console.error(error);
				if (active) setError("Unable to check your profile. Refresh to retry.");
			} finally {
				if (active) setChecking(false);
			}
		}
		void checkProfile();
		const subscription = supabase?.auth.onAuthStateChange(() => {
			void checkProfile();
		}).data.subscription;
		return () => {
			active = false;
			subscription?.unsubscribe();
		};
	}, []);

	async function submitUsername(event: SubmitEvent) {
		event.preventDefault();
		setError(null);
		if (!supabase) return;
		setSubmitting(true);
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) throw new Error("Sign in to finish setting up your profile.");
			await createUser(session.access_token, { username });
			setNeedsUsername(false);
			setCreated(true);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not create your profile.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Center mih="100%" p="md">
			<Stack w="100%" maw={420}>
				{checking ? (
					<Text>Checking your account…</Text>
				) : created ? (
					<>
						<Title order={2}>Account ready</Title>
						<Button component={Link} to="/">Continue</Button>
					</>
				) : needsUsername ? (
					<>
						<Title order={2}>Choose your username</Title>
						{error && <Alert color="red">{error}</Alert>}
						<form onSubmit={submitUsername}>
							<Stack>
								<TextInput
									label="Username"
									required
									minLength={1}
									maxLength={50}
									pattern="[A-Za-z0-9_]+"
									value={username}
									onChange={(event) => setUsername(event.currentTarget.value)}
								/>
								<Button type="submit" loading={submitting}>
									Create profile
								</Button>
							</Stack>
						</form>
					</>
				) : (
					<>
						<Title order={2}>Unable to finish sign-in</Title>
						{error && <Alert color="red">{error}</Alert>}
						<Button component={Link} to="/login">
							Return to login
						</Button>
					</>
				)}
			</Stack>
		</Center>
	);
}
