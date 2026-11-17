import {
	ActionIcon,
	Avatar,
	Button,
	Group,
	Kbd,
	Menu,
	Text,
	TextInput,
	UnstyledButton,
	useComputedColorScheme,
	useMantineColorScheme,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Compass,
	GraduationCap,
	Layers,
	LogOut,
	Moon,
	PanelLeftClose,
	PanelLeftOpen,
	PlusSquare,
	Search,
	Settings,
	Sun,
	User,
	Users,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { loadStudyActivity, STUDY_ACTIVITY_QUERY_KEY } from "../lib/api-lib";
import { useAuth } from "../lib/auth";
import AuthModal from "./AuthModal";
import StudyHeatmap from "./StudyHeatmap";
import type {
	ActivityData,
	AuthMode,
	NavId,
	SignInPayload,
	SignUpPayload,
	UserInfo,
} from "./types";
import "./AppLayout.css";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

type Theme = "dark" | "light";
type NavItem = {
	id: "community" | "create" | "tutorial" | "groups";
	label: string;
	icon: LucideIcon;
};
type AppLayoutProps = {
	children: React.ReactNode;
	appName?: string;
	active?: NavId;
	onNavigate?: (id: NavId) => void;
	onSearch?: (query: string) => void;
	user?: UserInfo;
	onLogout?: () => void;
	/** Throw an Error to show its message inside the modal. */
	onSignIn?: (data: SignInPayload) => void | Promise<void>;
	onSignUp?: (data: SignUpPayload) => void | Promise<void>;
	activity?: ActivityData;
};
type TopBarProps = {
	appName: string;
	theme: Theme;
	onToggleTheme: () => void;
	onSearch?: (query: string) => void;
	onNavigate: (id: NavId) => void;
	user?: UserInfo;
	onLogout?: () => void;
	onOpenAuth: (mode: AuthMode) => void;
};
type SideBarProps = {
	active: NavId;
	onNavigate: (id: NavId) => void;
	collapsed: boolean;
	onToggleCollapsed: () => void;
	activity?: ActivityData;
};

const NAV_ITEMS: NavItem[] = [
	{ id: "community", label: "Community", icon: Compass },
	{ id: "create", label: "Create", icon: PlusSquare },
	{ id: "tutorial", label: "Tutorial", icon: GraduationCap },
	{ id: "groups", label: "Groups", icon: Users },
];

const NAV_PATHS: Record<NavId, string> = {
	home: "/",
	community: "/community",
	create: "/create",
	tutorial: "/tutorial",
	groups: "/groups",
	settings: "/settings",
	profile: "/profile",
};

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({
	appName,
	theme,
	onToggleTheme,
	onSearch,
	onNavigate,
	user,
	onLogout,
	onOpenAuth,
}: TopBarProps) {
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);

	// "/" focuses search (like LeetCode / GitHub)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const tag = document.activeElement?.tagName;
			const typing = tag === "INPUT" || tag === "TEXTAREA";
			if (e.key === "/" && !typing) {
				e.preventDefault();
				searchRef.current?.focus();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const submit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const q = query.trim();
		if (q) onSearch?.(q);
	};

	const initial = (user?.name || "U").charAt(0).toUpperCase();

	return (
		<header className="fc-topbar">
			<UnstyledButton
				className="fc-brand"
				onClick={() => onNavigate("home")}
				aria-label={`${appName} home`}
			>
				<Layers size={22} aria-hidden="true" />
				<span>{appName}</span>
			</UnstyledButton>
			<search className="fc-search">
				<form onSubmit={submit} style={{ width: "100%" }}>
					<TextInput
						ref={searchRef}
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search flashcard sets"
						aria-label="Search flashcard sets"
						leftSection={<Search size={16} aria-hidden="true" />}
						rightSection={
							<Kbd size="xs" aria-hidden="true">
								/
							</Kbd>
						}
						size="xs"
						w="100%"
					/>
				</form>
			</search>
			<Group gap={8} wrap="nowrap" ml="auto">
				<ActionIcon
					variant="subtle"
					color="gray"
					onClick={onToggleTheme}
					aria-label={
						theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
					}
					title={theme === "dark" ? "Light mode" : "Dark mode"}
					size={32}
				>
					{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
				</ActionIcon>
				{user ? (
					<Menu position="bottom-end" width={220}>
						<Menu.Target>
							<UnstyledButton aria-label="User settings">
								<Avatar
									src={user.avatarUrl}
									alt=""
									size={30}
									radius="xl"
									color="flashcardz"
								>
									{initial}
								</Avatar>
							</UnstyledButton>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Label>
								<Text fw={700} truncate>
									{user.name || "Guest"}
								</Text>
								{user.email && (
									<Text size="xs" c="dimmed" truncate>
										{user.email}
									</Text>
								)}
							</Menu.Label>
							<Menu.Item
								leftSection={<User size={16} aria-hidden="true" />}
								onClick={() => onNavigate("profile")}
							>
								Profile
							</Menu.Item>
							<Menu.Item
								leftSection={<Settings size={16} aria-hidden="true" />}
								onClick={() => onNavigate("settings")}
							>
								Settings
							</Menu.Item>
							<Menu.Divider />
							<Menu.Item
								leftSection={<LogOut size={16} aria-hidden="true" />}
								onClick={onLogout}
							>
								Sign out
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				) : (
					<Group gap={8} wrap="nowrap">
						<Button
							variant="subtle"
							color="gray"
							h={32}
							onClick={() => onOpenAuth("signin")}
						>
							Sign in
						</Button>
						<Button h={32} onClick={() => onOpenAuth("signup")}>
							Sign up
						</Button>
					</Group>
				)}
			</Group>
		</header>
	);
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function SideBar({
	active,
	onNavigate,
	collapsed,
	onToggleCollapsed,
	activity,
}: SideBarProps) {
	const renderItem = ({
		id,
		label,
		icon: Icon,
	}: NavItem | { id: "settings"; label: string; icon: LucideIcon }) => (
		<UnstyledButton
			key={id}
			className={`fc-nav-item ${active === id ? "active" : ""}`}
			onClick={() => onNavigate(id)}
			aria-current={active === id ? "page" : undefined}
			title={label}
			aria-label={label}
		>
			<Icon size={18} aria-hidden="true" />
			<span className="fc-nav-label">{label}</span>
		</UnstyledButton>
	);

	return (
		<aside
			className={`fc-sidebar ${collapsed ? "collapsed" : ""}`}
			aria-label="Primary"
		>
			<nav className="fc-nav">{NAV_ITEMS.map(renderItem)}</nav>

			<StudyHeatmap activity={activity} />

			<div className="fc-sidebar-bottom">
				{renderItem({ id: "settings", label: "Settings", icon: Settings })}
				<UnstyledButton
					className="fc-nav-item fc-collapse"
					onClick={onToggleCollapsed}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{collapsed ? (
						<PanelLeftOpen size={18} />
					) : (
						<PanelLeftClose size={18} />
					)}
					<span className="fc-nav-label">Collapse</span>
				</UnstyledButton>
			</div>
		</aside>
	);
}

/* ------------------------------------------------------------------ */
/* Layout (default export)                                             */
/* ------------------------------------------------------------------ */

export default function AppLayout({
	children,
	appName = "FlashCardz",
	active = "community",
	onNavigate,
	onSearch,
	user: userOverride,
	onLogout,
	onSignIn,
	onSignUp,
	activity,
}: AppLayoutProps) {
	const routerNavigate = useNavigate();
	const auth = useAuth();
	const user = userOverride ?? auth.user;
	const { data: studyActivity } = useQuery({
		queryKey: [STUDY_ACTIVITY_QUERY_KEY, auth.userId],
		queryFn: loadStudyActivity,
		enabled: !!auth.userId && !auth.needsUsername,
	});

	const theme = useComputedColorScheme("dark");
	const { setColorScheme } = useMantineColorScheme();
	const [collapsed, setCollapsed] = useState(false);
	const [authMode, setAuthMode] = useState<AuthMode | null>(null);

	const handleNavigate = (id: NavId) => {
		if (onNavigate) {
			onNavigate(id);
			return;
		}
		void routerNavigate({ to: NAV_PATHS[id] });
	};

	const handleOpenAuth = (mode: AuthMode) => {
		setAuthMode(mode);
	};

	return (
		<div className="fc-app" data-theme={theme}>
			<TopBar
				appName={appName}
				theme={theme}
				onToggleTheme={() =>
					setColorScheme(theme === "dark" ? "light" : "dark")
				}
				onSearch={
					onSearch ??
					((q) => void routerNavigate({ to: "/search", search: { q } }))
				}
				onNavigate={handleNavigate}
				user={user}
				onLogout={onLogout ?? auth.signOut}
				onOpenAuth={handleOpenAuth}
			/>
			<div className="fc-body">
				<SideBar
					active={active}
					onNavigate={handleNavigate}
					collapsed={collapsed}
					onToggleCollapsed={() => setCollapsed((c) => !c)}
					activity={activity ?? (auth.userId ? studyActivity : undefined)}
				/>
				<main className="fc-main">{children}</main>
			</div>

			{auth.needsUsername && (
				<AuthModal
					key="username"
					mode="username"
					onModeChange={setAuthMode}
					onClose={auth.signOut}
					onChooseUsername={auth.chooseUsername}
				/>
			)}

			{authMode && !user && !auth.needsUsername && (
				<AuthModal
					mode={authMode}
					onModeChange={setAuthMode}
					onClose={() => setAuthMode(null)}
					onSignIn={onSignIn ?? auth.signIn}
					onSignUp={onSignUp ?? auth.signUp}
				/>
			)}
		</div>
	);
}
