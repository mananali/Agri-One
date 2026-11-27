"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AuthResponse = {
  accessToken: string;
  user: { name: string; role: "RETAILER" | "SUPPLIER" | "ADMIN" };
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState("");

  useEffect(() => {
    if (mode !== "login") return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const savedEmail = window.localStorage.getItem("agri-one-login-id") ?? "";
      setRememberedEmail(savedEmail);
      setRememberMe(Boolean(savedEmail));
    });
    return () => { active = false; };
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());

    if (mode === "login") {
      if (rememberMe) window.localStorage.setItem("agri-one-login-id", String(values.email ?? ""));
      else window.localStorage.removeItem("agri-one-login-id");
    }

    try {
      const response = await fetch(`${apiBase}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? {
          organizationName: values.organizationName,
          name: values.name,
          email: values.email,
          phone: values.phone || undefined,
          password: values.password,
          accountType: values.accountType,
        } : { email: values.email, password: values.password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Could not sign in.");
      }

      const auth = result as AuthResponse;
      window.sessionStorage.setItem("agri-one-access-token", auth.accessToken);
      const requestedNext = mode === "login" ? new URLSearchParams(window.location.search).get("next") : null;
      const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : null;
      router.push(auth.user.role === "RETAILER" && safeNext ? safeNext : auth.user.role === "ADMIN" ? "/admin" : auth.user.role === "SUPPLIER" ? "/supplier" : "/retailer");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not connect to Agri-One API.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    {mode === "register" && <>
      <label>Your name<input name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Asha Das"/></label>
      <label>Business name<input name="organizationName" required minLength={2} maxLength={120} autoComplete="organization" placeholder="Green Valley Stores"/></label>
      <label>Business type<select name="accountType" defaultValue="RETAILER"><option value="RETAILER">Retailer</option><option value="SUPPLIER">Supplier</option></select></label>
      <label>Phone number<input name="phone" type="tel" pattern="\\+?[1-9][0-9]{7,14}" autoComplete="tel" placeholder="+919876543210"/></label>
    </>}
    <label>{mode === "login" ? "Business Email / Login ID" : "Business email"}<input name="email" required type={mode === "login" ? "text" : "email"} minLength={mode === "login" ? 3 : undefined} maxLength={254} autoComplete={mode === "login" ? "username" : "email"} value={mode === "login" ? rememberedEmail : undefined} onChange={mode === "login" ? event => setRememberedEmail(event.target.value) : undefined} placeholder={mode === "login" ? "CodeEnv or you@business.com" : "you@business.com"}/></label>
    <label>Password<span className="password-field"><input name="password" required type={showPassword ? "text" : "password"} minLength={mode === "register" ? 12 : 1} maxLength={72} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"}/>{mode === "login" && <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>}</span></label>
    {mode === "login" && <div className="login-options"><label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)}/>Remember me</label><Link href="/contact">Forgot password?</Link></div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button button-green" type="submit" disabled={busy}>{busy ? "Connecting…" : mode === "register" ? "Create business account" : "Sign in"} <span>↗</span></button>
    <small>{mode === "register" ? "Your organization will need verification before placing orders." : "Admin: CodeEnv · Retailer and supplier: business email"}</small>
  </form>;
}
