"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CircleHelp,
  Download,
  Menu,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/features", label: "Features" },
  { href: "/security", label: "Security" },
  { href: "/demo", label: "Demo" },
  { href: "/download", label: "Download", icon: Download },
  { href: "/faq", label: "FAQ", icon: CircleHelp },
  { href: "/help", label: "Help" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SessionNavigation() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  return session?.user ? (
    <>
      <Link className={`global-login${isAccountRoute(pathname) ? " is-active" : ""}`} href="/dashboard" aria-current={isAccountRoute(pathname) ? "page" : undefined}>{session.user.name || "Account"}</Link>
      <Link className={`global-cta${pathname === "/account" ? " is-current" : ""}`} href="/account" aria-current={pathname === "/account" ? "page" : undefined}>My account</Link>
    </>
  ) : (
    <>
      <LoginNavLink />
      <RegisterNavLink />
    </>
  );
}

function isAccountRoute(pathname: string) {
  return pathname === "/dashboard" || pathname === "/account";
}

function LoginNavLink() {
  const pathname = usePathname();
  const active = ["/login", "/forgot-password", "/reset-password"].includes(pathname);
  return <Link className={`global-login${active ? " is-active" : ""}`} href="/login" aria-current={active ? "page" : undefined}>Login</Link>;
}

function RegisterNavLink() {
  const pathname = usePathname();
  const active = pathname === "/register";
  return <Link className={`global-cta${active ? " is-current" : ""}`} href="/register" aria-current={active ? "page" : undefined}>Get Started <span aria-hidden="true">→</span></Link>;
}

export function SiteHeader({ authAvailable }: { authAvailable: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="global-header">
      <div className="global-header-inner">
        <Link className="global-brand" href="/" aria-label="PrivSentinel home">
          <Image className="global-brand-logo" src="/PrivSentinel.png" alt="" width={40} height={40} priority />
          <span>PrivSentinel</span>
        </Link>
        <button
          className="global-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav id="primary-navigation" className={`global-nav${menuOpen ? " is-open" : ""}`} aria-label="Primary navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={`global-nav-link${isActive(pathname, href) ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {Icon && <Icon aria-hidden="true" size={13} />}
              {label}
            </Link>
          ))}
          {authAvailable ? <SessionNavigation /> : <><LoginNavLink /><RegisterNavLink /></>}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/features", label: "Features" },
    { href: "/security", label: "Security" },
    { href: "/demo", label: "Demo" },
    { href: "/download", label: "Download" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/help", label: "Help" },
    { href: "/faq", label: "FAQ" },
  ];
  return (
    <footer className="global-footer">
      <div className="global-footer-inner">
        <div className="global-footer-brand">
          <Link className="global-brand" href="/">
            <Image className="global-brand-logo" src="/PrivSentinel.png" alt="" width={34} height={34} />
            <span>PrivSentinel</span>
          </Link>
          <p>Secure today. Safer tomorrow.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          {links.map(({ href, label }) => (
            <Link href={href} key={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "is-current" : undefined}>{label}</Link>
          ))}
        </nav>
        <p className="footer-copyright">© PrivSentinel</p>
      </div>
    </footer>
  );
}
