import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { BrandMark } from "@/components/BrandMark";
import { PublicHeader } from "@/components/PublicSite";

const features = [
  ["✦", "Curated agriculture products"],
  ["↗", "Trusted supplier network"],
  ["▣", "Clear business ordering"],
  ["✓", "Support for local retailers"],
];

function LoginHeader() {
  const links = [["About", "/about"], ["Categories", "/categories"], ["Brands", "/brands"], ["Services", "/services"], ["For retailers", "/retailers"]];
  return <header className="site-header login-header">
    <Link className="brand" href="/"><span className="brand-mark"><BrandMark className="brand-mark-icon"/></span><span>AGRI-ONE<small>AGRICULTURE BUSINESS PLATFORM</small></span></Link>
    <nav aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
    <div className="header-actions"><Link className="login-link" href="/login">Sign in</Link><Link className="button button-green button-small" href="/register">Join Agri-One <span>↗</span></Link></div>
  </header>;
}

function AgricultureArtwork() {
  return <div className="login-artwork" role="img" aria-label="Green agricultural fields with young crops under a warm sunrise">
    <div className="artwork-sun"/><div className="artwork-hills artwork-hill-back"/><div className="artwork-hills artwork-hill-front"/>
    <div className="artwork-field-lines"><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="artwork-crop crop-one">♧</div><div className="artwork-crop crop-two">♧</div><div className="artwork-crop crop-three">♧</div>
    <div className="artwork-caption"><span>✦</span><div><small>GROWING TOGETHER</small><strong>Rooted in better farming</strong></div><b>AGRI-ONE</b></div>
  </div>;
}

function LoginPage() {
  return <><LoginHeader/><main className="login-page">
    <section className="login-story">
      <div className="eyebrow"><span/> AGRI-ONE / LOGIN</div>
      <h1>Welcome Back to<br/><em>AGRI-ONE</em></h1>
      <h2>Smart Agriculture. Smarter Business.</h2>
      <p>Sign in to discover dependable products, connect with trusted suppliers, and keep your agriculture business moving.</p>
      <div className="login-features">{features.map(([icon, label]) => <div key={label}><span>{icon}</span>{label}</div>)}</div>
      <AgricultureArtwork/>
    </section>
    <section className="login-form-side" aria-label="Account sign in">
      <aside className="contact-card login-card"><div className="eyebrow">SECURE BUSINESS ACCESS</div><h2>Sign in to your account</h2><AuthForm mode="login"/><p className="auth-switch">New to Agri-One? <Link href="/register">Create an account</Link></p></aside>
    </section>
  </main></>;
}

function RegisterPage() {
  return <><PublicHeader/><main className="info-page"><div className="eyebrow"><span/> AGRI-ONE / REGISTER</div><div className="info-layout"><div><h1>Join the Agri-One network</h1><p className="info-intro">Create a retailer or supplier account to get started. Your business will be reviewed before ordering is enabled.</p><div className="info-list">{["Retailer and supplier business accounts", "Secure password based sign in", "Organizations are reviewed before ordering"].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</div>)}</div></div><aside className="contact-card"><div className="eyebrow">SECURE BUSINESS ACCESS</div><h2>Create your business account</h2><AuthForm mode="register"/><p className="auth-switch">Already registered? <Link href="/login">Sign in</Link></p></aside></div></main></>;
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  return mode === "login" ? <LoginPage/> : <RegisterPage/>;
}
