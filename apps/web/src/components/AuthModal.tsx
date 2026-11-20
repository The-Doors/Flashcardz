import {
	Alert,
	Anchor,
	Button,
	Modal,
	PasswordInput,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { type FormEvent, useState } from "react";
import type { AuthMode, SignInPayload, SignUpPayload } from "./types";

type AuthModalProps = {
	mode: AuthMode;
	onModeChange: (mode: AuthMode) => void;
	onClose: () => void;
	/** Throw an Error (e.g. "Incorrect email or password") to show it in the form. */
	onSignIn?: (data: SignInPayload) => void | Promise<void>;
	onSignUp?: (data: SignUpPayload) => void | Promise<void>;
	/** The parent removes the modal once a username is saved. Closing means cancelling. */
	onChooseUsername?: (username: string) => void | Promise<void>;
};

type Errors = Partial<
	Record<"username" | "email" | "password" | "confirm", string>
>;

const USERNAME_RE = /^[A-Za-z0-9_]{1,29}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export default function AuthModal({
	mode,
	onModeChange,
	onClose,
	onSignIn,
	onSignUp,
	onChooseUsername,
}: AuthModalProps) {
	const isSignUp = mode === "signup";
	const isUsername = mode === "username";
	const asksUsername = isSignUp || isUsername;

	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState<Errors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const switchMode = () => {
		setErrors({});
		setFormError(null);
		setPassword("");
		setConfirm("");
		setShowPassword(false);
		onModeChange(isSignUp ? "signin" : "signup");
	};

	const validate = (): Errors => {
		const next: Errors = {};
		if (asksUsername && !USERNAME_RE.test(username.trim()))
			next.username = "Use 1–29 letters, numbers, or underscores.";
		if (isUsername) return next;
		if (!EMAIL_RE.test(email.trim()))
			next.email = "Enter a valid email address.";
		if (!password) next.password = "Enter your password.";
		else if (isSignUp && password.length < MIN_PASSWORD)
			next.password = `Use at least ${MIN_PASSWORD} characters.`;
		if (isSignUp && confirm !== password)
			next.confirm = "Passwords don’t match.";
		return next;
	};

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (submitting) return;

		const found = validate();
		setErrors(found);
		if (Object.keys(found).length > 0) return;

		setFormError(null);
		setSubmitting(true);
		try {
			if (isUsername) {
				await onChooseUsername?.(username.trim());
				return;
			}
			if (isSignUp)
				await onSignUp?.({
					username: username.trim(),
					email: email.trim(),
					password,
				});
			else await onSignIn?.({ email: email.trim(), password });
			onClose();
		} catch (err) {
			setFormError(
				err instanceof Error
					? err.message
					: "Something went wrong. Please try again.",
			);
			setSubmitting(false);
		}
	};

	return (
		<Modal
			key={mode}
			opened
			onClose={() => !submitting && onClose()}
			title={
				isUsername
					? "Choose your username"
					: isSignUp
						? "Create your account"
						: "Welcome back"
			}
			size={400}
			closeOnEscape={!submitting}
			closeOnClickOutside={!submitting}
			closeButtonProps={{ disabled: submitting, "aria-label": "Close" }}
		>
			<Text c="dimmed" mb={20}>
				{isUsername
					? "Pick a username to finish setting up your account."
					: isSignUp
						? "Sign up to save your sets and track your progress."
						: "Sign in to pick up where you left off."}
			</Text>
			<form onSubmit={submit} noValidate>
				<Stack gap={14}>
					{asksUsername && (
						<TextInput
							data-autofocus
							label="Username"
							autoComplete="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							error={errors.username}
						/>
					)}
					{!isUsername && (
						<>
							<TextInput
								data-autofocus={!asksUsername || undefined}
								label="Email"
								type="email"
								autoComplete="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								error={errors.email}
							/>
							<PasswordInput
								label="Password"
								autoComplete={isSignUp ? "new-password" : "current-password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								error={errors.password}
								visible={showPassword}
								onVisibilityChange={setShowPassword}
							/>
						</>
					)}
					{isSignUp && (
						<PasswordInput
							label="Confirm password"
							autoComplete="new-password"
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
							error={errors.confirm}
							visible={showPassword}
							onVisibilityChange={setShowPassword}
						/>
					)}
					{formError && (
						<Alert color="red" role="alert">
							{formError}
						</Alert>
					)}
					<Button type="submit" fullWidth loading={submitting} mt={4}>
						{submitting
							? "Please wait…"
							: isUsername
								? "Continue"
								: isSignUp
									? "Sign up"
									: "Sign in"}
					</Button>
				</Stack>
			</form>
			{!isUsername && (
				<Text c="dimmed" ta="center" mt={18}>
					{isSignUp ? "Already have an account?" : "New to FlashCardz?"}{" "}
					<Anchor
						component="button"
						type="button"
						onClick={switchMode}
						disabled={submitting}
						fw={600}
					>
						{isSignUp ? "Sign in" : "Sign up"}
					</Anchor>
				</Text>
			)}
		</Modal>
	);
}
