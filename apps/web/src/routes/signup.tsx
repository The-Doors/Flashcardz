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

export const Route = createFileRoute("/signup")({
	component: SignupPage,
});

function SignupPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [message, setMessage] = useState<string | null>(null);

	function showError(errorMessage: string) {
		notifications.show({
			title: "Account creation failed",
			message: errorMessage,
			color: "red",
			duration: 5000,
		});
	}

	async function createAccount(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage(null);

		if (password !== confirmPassword) {
			showError("Passwords do not match.");
			return;
		}
		if (!supabase) {
			showError(
				"Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
			);
			return;
		}

		const { data, error: signUpError } = await supabase.auth.signUp({
			email,
			password,
			options: { emailRedirectTo: `${window.location.origin}/` },
		});
		if (signUpError) {
			showError(signUpError.message);
		} else if (!data.session) {
			setMessage("Check your email to confirm your account.");
		}
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
			options: { redirectTo: `${window.location.origin}/` },
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
								<Title order={2}>Create account</Title>
							</Stack>
							<form onSubmit={createAccount}>
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
									<PasswordInput
										label="Confirm password"
										required
										value={confirmPassword}
										onChange={(event) =>
											setConfirmPassword(event.currentTarget.value)
										}
									/>
									<Button type="submit" fullWidth>
										Create account
									</Button>
								</Stack>
							</form>
							<Text size="sm" ta="center">
								Already have an account? <Link to="/login">Sign in</Link>
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
				{message && (
					<Text c="green" role="status" ta="center">
						{message}
					</Text>
				)}
				<Text c="dimmed" size="sm" ta="center">
					By continuing, you agree to our{" "}
					<Anchor href="/terms">Terms of Service</Anchor> and{" "}
					<Anchor href="/privacy">Privacy Policy</Anchor>.
				</Text>
			</Stack>
		</Center>
	);
}
