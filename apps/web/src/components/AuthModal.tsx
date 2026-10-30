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
import { supabase } from "../lib/supabase";
import type { AuthMode, SignInPayload, SignUpPayload } from "./types";

interface AuthModalProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSignIn?: (data: SignInPayload) => void | Promise<void>;
  onSignUp?: (data: SignUpPayload) => void | Promise<void>;
}

export function AuthModal({
  mode,
  onModeChange,
  onClose,
  onSignIn,
  onSignUp,
}: AuthModalProps) {
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

  function checkSupabaseConfig(): boolean {
    if (!supabase) {
      showError(
        "Configuration Error",
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      );
      return false;
    }
    return true;
  }

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInfoMessage(null);
    setLoading(true);

    try {
      // If AppLayout provided an onSignIn handler, use it
      if (onSignIn) {
        await onSignIn({ email, password });
      } else {
        // Fallback directly to Supabase client
        if (!checkSupabaseConfig()) return;
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      notifications.show({
        title: "Welcome back!",
        message: "You have signed in successfully.",
        color: "green",
      });
      onClose();
    } catch (err: any) {
      showError("Sign-in failed", err.message || "Failed to sign in.");
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
      // If AppLayout provided an onSignUp handler, use it
      if (onSignUp) {
        await onSignUp({ email, password, confirmPassword });
        notifications.show({
          title: "Account created!",
          message: "Your account has been set up.",
          color: "green",
        });
        onClose();
      } else {
        // Fallback directly to Supabase client
        if (!checkSupabaseConfig()) return;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth-callback`,
          },
        });
        if (error) throw error;

        if (data.session) {
          notifications.show({
            title: "Account created!",
            message: "You are now logged in.",
            color: "green",
          });
          onClose();
          return;
        } else {
          setInfoMessage("Check your email to confirm your account before logging in.");
        }
      }
    } catch (err: any) {
      showError("Account creation failed", err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    if (!checkSupabaseConfig()) return;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth-callback`,
      },
    });

    if (error) showError("Google authentication failed", error.message);
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