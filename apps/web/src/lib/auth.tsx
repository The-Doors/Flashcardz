import type { Session } from "@supabase/supabase-js";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import type {
	SignInPayload,
	SignUpPayload,
	UserInfo,
} from "../components/types";
import { createUser, readCurrentUser } from "./api-lib";
import { supabase } from "./supabase";

type AuthContextValue = {
	user?: UserInfo;
	userId?: string;
	needsUsername: boolean;
	signIn: (data: SignInPayload) => Promise<void>;
	signUp: (data: SignUpPayload) => Promise<void>;
	chooseUsername: (username: string) => Promise<void>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requireSupabase() {
	if (!supabase) {
		throw new Error(
			"Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
		);
	}
	return supabase;
}

async function signIn({ email, password }: SignInPayload) {
	const { error } = await requireSupabase().auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw new Error(error.message);
}

async function signUp({ username, email, password }: SignUpPayload) {
	const { data, error } = await requireSupabase().auth.signUp({
		email,
		password,
		options: {
			data: { username },
			emailRedirectTo: `${window.location.origin}/auth-callback`,
		},
	});
	if (error) throw new Error(error.message);
	if (!data.session)
		throw new Error("Check your email to confirm your account.");
}

async function signOut() {
	const { error } = await requireSupabase().auth.signOut();
	if (error) console.error(error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [username, setUsername] = useState<string>();
	const [needsUsername, setNeedsUsername] = useState(false);
	const userId = session?.user.id;

	useEffect(() => {
		if (!supabase) return;
		const client = supabase;
		void client.auth.getSession().then(({ data }) => setSession(data.session));
		const { subscription } = client.auth.onAuthStateChange((_event, next) => {
			setSession(next);
		}).data;
		return () => subscription.unsubscribe();
	}, []);

	// Laravel creates the profile on the first authenticated /auth/me call. A
	// session with no profile still needs a username, which AuthModal collects.
	useEffect(() => {
		setUsername(undefined);
		setNeedsUsername(false);
		if (!supabase || !userId) return;
		const client = supabase;
		let active = true;
		async function loadProfile() {
			const { data } = await client.auth.getSession();
			if (!active || !data.session) return;
			const profile = await readCurrentUser(data.session.access_token);
			if (!active) return;
			setUsername(profile?.username);
			setNeedsUsername(profile === null);
		}
		loadProfile().catch(console.error);
		return () => {
			active = false;
		};
	}, [userId]);

	async function chooseUsername(chosenUsername: string) {
		const profile = await createUser(chosenUsername);
		setUsername(profile.username);
		setNeedsUsername(false);
	}

	const user: UserInfo | undefined = session
		? {
				name: username ?? session.user.email,
				email: session.user.email,
				avatarUrl: session.user.user_metadata.avatar_url,
			}
		: undefined;

	return (
		<AuthContext.Provider
			value={{
				user,
				userId,
				needsUsername,
				signIn,
				signUp,
				chooseUsername,
				signOut,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used inside AuthProvider.");
	return context;
}
