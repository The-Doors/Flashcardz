import {
  Anchor,
  Button,
  Divider,
  Modal,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import axios from "axios";
import type { AuthMode, SignInPayload, SignUpPayload } from "./types";

// Configure Axios for Laravel Sanctum
// Note: In a larger app, you should move this to a dedicated api.ts file
axios.defaults.baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";
axios.defaults.withCredentials = true;
axios.defaults.headers.common["Accept"] = "application/json";

// Optional: Extend SignUpPayload locally if your types.ts doesn't include 'name'
type ExtendedSignUpPayload = SignUpPayload & { name?: string };

interface AuthModalProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSignIn?: (data: SignInPayload) => void | Promise<void>;
  onSignUp?: (data: ExtendedSignUpPayload) => void | Promise<void>;
}

export function AuthModal({
  mode,
  onModeChange,
  onClose,
  onSignIn,
  onSignUp,
}: AuthModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  function showError(title: string, message: string) {
    notifications.show({
      title,
      message,
      color: "red",
      autoClose: 5000,
    });
  }

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInfoMessage(null);
    setLoading(true);

    try {
      if (onSignIn) {
        await onSignIn({ email, password });
      } else {
        // Initialize CSRF protection for Laravel Sanctum
        await axios.get("/sanctum/csrf-cookie");
        // Hit Laravel's default login endpoint
        await axios.post("/login", { email, password });
      }

      notifications.show({
        title: "Welcome back!",
        message: "You have signed in successfully.",
        color: "green",
      });
      
      onClose();
      // Optional: Force reload to refetch the authenticated user state in AppLayout
      window.location.reload();
    } catch (err: any) {
      showError(
        "Sign-in failed",
        err.response?.data?.message || err.message || "Failed to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInfoMessage(null);

    if (password !== confirmPassword) {
      showError("Sign-up failed", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (onSignUp) {
        await onSignUp({ email, password, confirmPassword, name });
        notifications.show({
          title: "Account created!",
          message: "Your account has been set up.",
          color: "green",
        });
        onClose();
      } else {
        // Initialize CSRF protection
        await axios.get("/sanctum/csrf-cookie");
        // Hit Laravel's default register endpoint
        await axios.post("/register", {
          name,
          email,
          password,
          password_confirmation: confirmPassword,
        });

        notifications.show({
          title: "Account created!",
          message: "You are now logged in.",
          color: "green",
        });
        onClose();
        window.location.reload();
      }
    } catch (err: any) {
      showError(
        "Account creation failed",
        err.response?.data?.message || err.message || "Failed to create account."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleAuth() {
    // Standard Laravel Socialite redirect
    window.location.href = `${axios.defaults.baseURL}/auth/google/redirect`;
  }

  return (
    <Modal
      opened={true}
      onClose={onClose}
      centered
      radius="md"
      padding="xl"
      title={
        <Title order={3}>
          {mode === "signin" ? "Welcome Back" : "Create Account"}
        </Title>
      }
    >
      <Stack gap="md">
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(val) => {
            onModeChange(val as AuthMode);
            setInfoMessage(null);
          }}
          data={[
            { label: "Sign In", value: "signin" },
            { label: "Sign Up", value: "signup" },
          ]}
        />

        <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp}>
          <Stack gap="sm">
            {mode === "signup" && (
              <TextInput
                label="Name"
                placeholder="Your full name"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            )}

            <TextInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />

            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />

            {mode === "signup" && (
              <PasswordInput
                label="Confirm Password"
                placeholder="Re-enter password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              />
            )}

            <Button type="submit" fullWidth loading={loading} mt="xs">
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </Stack>
        </form>

        {infoMessage && (
          <Text c="teal" size="sm" ta="center" fw={500}>
            {infoMessage}
          </Text>
        )}

        <Divider label="Or continue with" labelPosition="center" />

        <Button
          variant="default"
          fullWidth
          onClick={handleGoogleAuth}
          leftSection={<FaGoogle />}
        >
          Continue with Google
        </Button>

        <Text c="dimmed" size="xs" ta="center" mt="xs">
          By continuing, you agree to our{" "}
          <Anchor href="/terms" size="xs">
            Terms of Service
          </Anchor>{" "}
          and{" "}
          <Anchor href="/privacy" size="xs">
            Privacy Policy
          </Anchor>
          .
        </Text>
      </Stack>
    </Modal>
  );
}

export default AuthModal;