import {
	Anchor,
	Button,
	Center,
	Divider,
	Image,
	Paper,
	PasswordInput,
	SimpleGrid,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	function showError(message: string) {
		notifications.show({
			title: "Sign-in failed",
			message,
			color: "red",
			duration: 5000,
		});
	}

	async function signInWithEmail(event: SubmitEvent) {
		event.preventDefault();
		if (!supabase) {
			showError(
				"Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
			);
			return;
		}

		const { error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (!signInError) window.location.assign("/auth-callback");
		if (signInError) showError(signInError.message);
	}

	async function signInWithGoogle() {
		if (!supabase) {
			showError(
				"Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
			);
			return;
		}

		const { error: signInError } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: `${window.location.origin}/auth-callback`,
			},
		});

		if (signInError) showError(signInError.message);
	}

	return (
		<Center mih="100%" p="md">
			<Stack w="100%" maw={900} gap="md">
				<Paper shadow="md" radius="md" withBorder>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						<Stack
							gap="lg"
							p={{ base: "lg", sm: "xl" }}
							style={{ flex: "1 1 360px" }}
						>
							<Stack align="center" gap={4}>
								<Title order={2}>Sign in</Title>
							</Stack>
							<form onSubmit={signInWithEmail}>
								<Stack gap="md">
									<TextInput
										label="Email"
										type="email"
										placeholder="son@example.com"
										required
										value={email}
										onChange={(event) => setEmail(event.currentTarget.value)}
									/>
									<PasswordInput
										label="Password"
										required
										value={password}
										onChange={(event) => setPassword(event.currentTarget.value)}
									/>
									<Button type="submit" fullWidth>
										Sign in
									</Button>
								</Stack>
							</form>
							<Text size="sm" ta="center">
								New here? <Link to="/signup">Create an account</Link>
							</Text>
							<Divider label="Or continue with" labelPosition="center" />
							<Button
								variant="default"
								fullWidth
								onClick={signInWithGoogle}
								leftSection={<FaGoogle />}
							>
								Continue with Google
							</Button>
						</Stack>
						<Image src="https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/James_D._Rolfe.jpg/250px-James_D._Rolfe.jpg" />
					</SimpleGrid>
				</Paper>
				<Text c="dimmed" size="sm" ta="center">
					By continuing, you agree to our{" "}
					<Anchor href="/terms">Terms of Service</Anchor> and{" "}
					<Anchor href="/privacy">Privacy Policy</Anchor>.
				</Text>
			</Stack>
		</Center>
	);
}
