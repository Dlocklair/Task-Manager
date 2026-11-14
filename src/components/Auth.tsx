import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { sb } from "../lib/supabase";

export function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "link" | "signin" | "signup") => {
    if (!sb) return;
    setBusy(true);
    setError(null);
    const redirect = window.location.origin;
    const res =
      kind === "link"
        ? await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
        : kind === "signin"
          ? await sb.auth.signInWithPassword({ email, password })
          : await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (res.error) setError(res.error.message);
    else if (kind === "link") setSent("We sent a sign-in link to");
    else if (kind === "signup" && !res.data.session) setSent("Confirm your account with the link we sent to");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(usePassword ? "signin" : "link");
  };

  return (
    <div className="auth">
      <div className="auth-art" aria-hidden="true">
        <div className="auth-art-rows">
          <span style={{ width: "72%" }} className="c1" /><span style={{ width: "54%" }} className="c2" /><span style={{ width: "86%" }} className="c3" /><span style={{ width: "40%" }} className="c4" />
        </div>
        <p>Every project, task and person in one place, on every device you own.</p>
      </div>
      <div className="auth-panel">
        <div className="brand dark"><span className="brand-mark" />Task Manager</div>
        {sent ? (
          <div className="auth-sent">
            <MailCheck size={32} />
            <h1>Check your email</h1>
            <p>{sent} <strong>{email}</strong>. Open it on this device to finish signing in.</p>
            <button className="btn" onClick={() => setSent(null)}>Use a different email</button>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <h1>Sign in</h1>
            <label>Email<input type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            {usePassword && (
              <label>Password<input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn primary big" type="submit" disabled={busy}>{busy ? "One moment" : usePassword ? "Sign in" : "Email me a sign-in link"}</button>
            {usePassword && (
              <button className="btn big" type="button" disabled={busy || !email || password.length < 8} onClick={() => void run("signup")}>Create an account</button>
            )}
            <button className="link" type="button" onClick={() => { setUsePassword(!usePassword); setError(null); }}>
              {usePassword ? "Sign in with an email link instead" : "Sign in with a password instead"}
            </button>
            <a className="link" href="?demo">Look around with sample data</a>
          </form>
        )}
      </div>
    </div>
  );
}
