import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  Flame,
} from "lucide-react";
import "./AppLayout.css";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

type ActivityData = Record<string, number>;
type NavId = "community" | "create" | "tutorial" | "groups" | "settings" | "home" | "profile";
type Theme = "dark" | "light";
type UserInfo = { name?: string; email?: string; avatarUrl?: string };
type NavItem = { id: "community" | "create" | "tutorial" | "groups"; label: string; icon: LucideIcon };
type HeatmapDay = { iso: string; count: number } | null;
type AppLayoutProps = {
  children: React.ReactNode;
  appName?: string;
  active?: NavId;
  onNavigate?: (id: NavId) => void;
  onSearch?: (query: string) => void;
  user?: UserInfo;
  onLogout?: () => void;
  activity?: ActivityData;
};
type TopBarProps = {
  appName: string;
  theme: Theme;
  onToggleTheme: () => void;
  onSearch?: (query: string) => void;
  onNavigate?: (id: NavId) => void;
  user?: UserInfo;
  onLogout?: () => void;
};
type SideBarProps = {
  active: NavId;
  onNavigate?: (id: NavId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activity: ActivityData;
};

const NAV_ITEMS: NavItem[] = [
  { id: "community", label: "Community", icon: Compass },
  { id: "create", label: "Create", icon: PlusSquare },
  { id: "tutorial", label: "Tutorial", icon: GraduationCap },
  { id: "groups", label: "Groups", icon: Users },
];

const HEATMAP_WEEKS = 16;
const THEME_KEY = "flashcards-theme";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// 0 = no activity, 4 = heaviest
const levelFor = (count: number): number => {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
};

// Deterministic placeholder data so the demo heat map doesn't flicker.
// Replace by passing real data from FastAPI via the `activity` prop.
const buildDemoActivity = (): ActivityData => {
  const data: ActivityData = {};
  const today = new Date();
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (rand() > 0.45) data[toISO(d)] = Math.floor(rand() * 40);
  }
  return data;
};

/**
 * Builds columns of weeks (Sun -> Sat) ending with the current week.
 * Future days in the current week are returned as `null` so they render blank.
 */
const buildWeeks = (activity: ActivityData): HeatmapDay[][] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (HEATMAP_WEEKS - 1) * 7);

  const weeks = [];
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const days: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > today) {
        days.push(null);
      } else {
        const iso = toISO(date);
        days.push({ iso, count: activity[iso] || 0 });
      }
    }
    weeks.push(days);
  }
  return weeks;
};

const computeStreak = (activity: ActivityData): number => {
  const day = new Date();
  // Don't break the streak just because today hasn't been studied yet.
  if (!activity[toISO(day)]) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (activity[toISO(day)] > 0) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
};

/* ------------------------------------------------------------------ */
/* Heat map                                                            */
/* ------------------------------------------------------------------ */

function StudyHeatmap({ activity }: { activity: ActivityData }) {
  const weeks = useMemo(() => buildWeeks(activity), [activity]);
  const total = useMemo(
    () => weeks.flat().reduce((sum, d) => sum + (d ? d.count : 0), 0),
    [weeks]
  );
  const streak = useMemo(() => computeStreak(activity), [activity]);

  return (
    <section className="fc-heatmap" aria-label="Study activity">
      <div className="fc-heatmap-head">
        <span className="fc-heatmap-title">Study activity</span>
        <span className="fc-heatmap-streak" title="Current streak">
          <Flame size={14} aria-hidden="true" />
          {streak}d
        </span>
      </div>

      <div className="fc-heatmap-grid" role="img"
        aria-label={`${total} cards studied in the last ${HEATMAP_WEEKS} weeks`}>
        {weeks.map((week, wi) => (
          <div className="fc-heatmap-col" key={wi}>
            {week.map((day, di) =>
              day ? (
                <span
                  key={di}
                  className={`fc-cell lvl-${levelFor(day.count)}`}
                  title={`${day.count} card${day.count === 1 ? "" : "s"} on ${day.iso}`}
                />
              ) : (
                <span key={di} className="fc-cell empty" />
              )
            )}
          </div>
        ))}
      </div>

      <div className="fc-heatmap-foot">
        <span>{total} cards in {HEATMAP_WEEKS} weeks</span>
        <span className="fc-legend" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`fc-cell lvl-${l}`} />
          ))}
          More
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({ appName, theme, onToggleTheme, onSearch, onNavigate, user, onLogout }: TopBarProps) {
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
      <button className="fc-brand" onClick={() => onNavigate?.("home")} aria-label={`${appName} home`}>
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
              <button role="menuitem" onClick={() => { setMenuOpen(false); onNavigate?.("profile"); }}>
                <User size={16} aria-hidden="true" /> Profile
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); onNavigate?.("settings"); }}>
                <Settings size={16} aria-hidden="true" /> Account settings
              </button>
              <hr />
              <button role="menuitem" onClick={() => { setMenuOpen(false); onLogout?.(); }}>
                <LogOut size={16} aria-hidden="true" /> Log out
              </button>
            </div>
          )}
        </div>
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
      onClick={() => onNavigate?.(id)}
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

/**
 * Props
 *  - children:   page content, rendered in the main area
 *  - appName:    brand text in the top bar
 *  - active:     id of the current page ("community" | "create" | "tutorial" | "groups" | "settings")
 *  - onNavigate: (id) => void   (swap for react-router's useNavigate)
 *  - onSearch:   (query) => void
 *  - user:       { name, email, avatarUrl }
 *  - onLogout:   () => void
 *  - activity:   { "YYYY-MM-DD": cardsStudied }  - heat map data from your API
 */
export default function AppLayout({
  children,
  appName = "FlashCardz",
  active = "community",
  onNavigate,
  onSearch,
  user,
  onLogout,
  activity,
}: AppLayoutProps) {
  // Dark by default; remember the user's choice.
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme | null) || "dark";
    } catch {
      return "dark";
    }
  });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable - ignore */
    }
  }, [theme]);

  const demoActivity = useMemo(buildDemoActivity, []);
  const data = activity ?? demoActivity;

  return (
    <div className="fc-app" data-theme={theme}>
      <TopBar
        appName={appName}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onSearch={onSearch}
        onNavigate={onNavigate}
        user={user}
        onLogout={onLogout}
      />
      <div className="fc-body">
        <SideBar
          active={active}
          onNavigate={onNavigate}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          activity={data}
        />
        <main className="fc-main">{children}</main>
      </div>
    </div>
  );
}