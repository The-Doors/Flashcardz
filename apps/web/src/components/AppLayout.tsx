import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  Sun,
  Moon,
  Settings,
  Compass,
  PlusSquare,
  GraduationCap,
  Users,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  LogOut,
} from "lucide-react";
import StudyHeatmap from "./StudyHeatmap";
import AuthModal from "./AuthModal";
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
type NavItem = { id: "community" | "create" | "tutorial" | "groups"; label: string; icon: LucideIcon };
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

const THEME_KEY = "flashcards-theme";

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({ appName, theme, onToggleTheme, onSearch, onNavigate, user, onLogout, onOpenAuth }: TopBarProps) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close the user menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: globalThis.MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (q) onSearch?.(q);
  };

  const initial = (user?.name || "U").charAt(0).toUpperCase();

  return (
    <header className="fc-topbar">
      <button className="fc-brand" onClick={() => onNavigate("home")} aria-label={`${appName} home`}>
        <Layers size={22} aria-hidden="true" />
        <span>{appName}</span>
      </button>

      <form className="fc-search" role="search" onSubmit={submit}>
        <Search size={16} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search flashcard sets"
          aria-label="Search flashcard sets"
        />
        <kbd aria-hidden="true">/</kbd>
      </form>

      <div className="fc-topbar-actions">
        <button
          className="fc-icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user ? (
          <div className="fc-user" ref={menuRef}>
            <button
              className="fc-avatar"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="User settings"
            >
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initial}
            </button>

            {menuOpen && (
              <div className="fc-menu" role="menu">
                <div className="fc-menu-head">
                  <strong>{user?.name || "Guest"}</strong>
                  {user?.email && <span>{user.email}</span>}
                </div>
                <button role="menuitem" onClick={() => { setMenuOpen(false); onNavigate("profile"); }}>
                  <User size={16} aria-hidden="true" /> Profile
                </button>
                <button role="menuitem" onClick={() => { setMenuOpen(false); onNavigate("settings"); }}>
                  <Settings size={16} aria-hidden="true" /> Account settings
                </button>
                <hr />
                <button role="menuitem" onClick={() => { setMenuOpen(false); onLogout?.(); }}>
                  <LogOut size={16} aria-hidden="true" /> Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="fc-auth-actions">
            <button className="fc-btn-ghost" onClick={() => onOpenAuth("signin")}>
              Sign in
            </button>
            <button className="fc-btn-primary" onClick={() => onOpenAuth("signup")}>
              Sign up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function SideBar({ active, onNavigate, collapsed, onToggleCollapsed, activity }: SideBarProps) {
  const renderItem = ({ id, label, icon: Icon }: NavItem | { id: "settings"; label: string; icon: LucideIcon }) => (
    <button
      key={id}
      className={`fc-nav-item ${active === id ? "active" : ""}`}
      onClick={() => onNavigate(id)}
      aria-current={active === id ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="fc-nav-label">{label}</span>
    </button>
  );

  return (
    <aside className={`fc-sidebar ${collapsed ? "collapsed" : ""}`} aria-label="Primary">
      <nav className="fc-nav">{NAV_ITEMS.map(renderItem)}</nav>

      <StudyHeatmap activity={activity} />

      <div className="fc-sidebar-bottom">
        {renderItem({ id: "settings", label: "Settings", icon: Settings })}
        <button
          className="fc-nav-item fc-collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className="fc-nav-label">Collapse</span>
        </button>
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
  user,
  onLogout,
  onSignIn,
  onSignUp,
  activity,
}: AppLayoutProps) {
  const routerNavigate = useNavigate();

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme | null) || "dark";
    } catch {
      return "dark";
    }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable - ignore */
    }
  }, [theme]);

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
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onSearch={onSearch}
        onNavigate={handleNavigate}
        user={user}
        onLogout={onLogout}
        onOpenAuth={handleOpenAuth}
      />
      <div className="fc-body">
        <SideBar
          active={active}
          onNavigate={handleNavigate}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          activity={activity}
        />
        <main className="fc-main">{children}</main>
      </div>

      {authMode && !user && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthMode(null)}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
        />
      )}
    </div>
  );
}