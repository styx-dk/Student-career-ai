import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Compass, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Notice } from "../components/UI";

export function AuthPage() {
  const { session, configured } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/dashboard" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage("Password reset instructions sent.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-logo">
          <Compass />
          Career Compass
        </div>
        <div>
          <p className="eyebrow">Your next chapter starts here.</p>
          <h1>A little more confident about what comes next.</h1>
          <p>
            Collect your work, discover your strengths and take your next step
            with confidence.
          </p>
          <div className="fact-row">
            <span>
              <b>01</b> Your work
            </span>
            <span>
              <b>02</b> Your strengths
            </span>
            <span>
              <b>03</b> Your direction
            </span>
          </div>
        </div>
        <small>
          Current analysis ≠ forecast ≠ simulation. We keep the distinction
          clear.
        </small>
      </section>
      <section className="auth-panel">
        <div className="auth-form">
          <p className="eyebrow">Student workspace</p>
          <h2>
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Create your account"
                : "Reset password"}
          </h2>
          <p>
            {mode === "login"
              ? "Your work and your next steps are right where you left them."
              : mode === "register"
                ? "A personal space for your skills, experience and ambitions."
                : "We will email a secure reset link."}
          </p>
          {!configured && (
            <Notice kind="error">
              Supabase frontend variables are not configured. See SETUP.md.
            </Notice>
          )}
          {error && <Notice kind="error">{error}</Notice>}
          {message && <Notice kind="success">{message}</Notice>}
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@college.edu"
              />
            </label>
            {mode !== "reset" && (
              <label>
                Password
                <div className="password">
                  <input
                    type={show ? "text" : "password"}
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    className="icon"
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </label>
            )}
            <button className="primary wide" disabled={busy || !configured}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          </form>
          <div className="auth-links">
            {mode !== "login" && (
              <button onClick={() => setMode("login")}>Back to sign in</button>
            )}
            {mode === "login" && (
              <>
                <button onClick={() => setMode("register")}>
                  Create an account
                </button>
                <button onClick={() => setMode("reset")}>
                  Forgot password?
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
