import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Compass,
  Home,
  FolderOpen,
  UserRound,
  Route,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const navigation = [
  { to: "/dashboard", Icon: Home, label: "Overview" },
  { to: "/documents", Icon: FolderOpen, label: "Documents" },
  { to: "/profile", Icon: UserRound, label: "Career profile" },
  { to: "/planning", Icon: Route, label: "Career planning" },
  { to: "/resumes", Icon: FileText, label: "Resumes" },
];
export function Layout() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const location = useLocation();
  const name = String(
    session?.user.user_metadata?.full_name ||
      session?.user.email?.split("@")[0] ||
      "Student",
  );
  const title =
    navigation.find((n) => location.pathname.startsWith(n.to))?.label ||
    "Account settings";
  return (
    <div className="shell">
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" to="/dashboard" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            <Compass />
          </span>
          <span>
            <b>Career Compass</b>
            <small>Student workspace</small>
          </span>
        </Link>
        <button
          className="icon mobile nav-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ to, Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="account-link"
          >
            <span className="avatar">{name[0].toUpperCase()}</span>
            <span>
              <b>{name}</b>
              <small>Account & preferences</small>
            </span>
            <Settings size={17} />
          </Link>
          <button
            className="secondary"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <button
            className="icon mobile"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span>{title}</span>
          <span className="workspace-label">Your work. Your next step.</span>
        </div>
        <div id="workspace-content" tabIndex={-1} className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
