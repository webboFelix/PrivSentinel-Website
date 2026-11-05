"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Crown,
  Download,
  Headset,
  Home,
  Info,
  LayoutGrid,
  LogOut,
  Menu,
  Play,
  Shield,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useProfileQuery } from "@/hooks/use-profile";
import { useUiStore } from "@/stores/ui-store";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About", icon: Info },
  { href: "/features", label: "Features", icon: LayoutGrid },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/demo", label: "Demo", icon: Play },
  { href: "/download", label: "Download", icon: Download },
  { href: "/faq", label: "FAQ", icon: CircleHelp },
  { href: "/help", label: "Help", icon: Headset },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SessionNavigation() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;
  const { data: profileData } = useProfileQuery(userId);
  const profileMenuOpen = useUiStore((state) => state.profileMenuOpen);
  const setProfileMenuOpen = useUiStore((state) => state.setProfileMenuOpen);
  const closeNavigation = useUiStore((state) => state.closeNavigation);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (!profileMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen, setProfileMenuOpen]);

  if (!session?.user) {
    return <div className="global-auth-links"><LoginNavLink /><RegisterNavLink /></div>;
  }

  const fullName = profileData?.profile?.fullName || session.user.name || "Account";
  const email = session.user.email;
  const avatar = profileData?.avatar || session.user.image || null;
  const initials = fullName.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "U";
  const menuItems = [
    { href: "/account", label: "Profile", icon: UserRound },
    { href: "/account", label: "Account settings", icon: Settings },
    { href: "/account#billing", label: "Billing & subscription", icon: CreditCard },
    { href: "/account#download-history", label: "Download history", icon: Download },
    { href: "/security", label: "Security & privacy", icon: ShieldCheck },
    { href: "/help", label: "Support center", icon: Headset },
  ];

  async function signOut() {
    setLogoutError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setLogoutError("Could not sign out. Please try again.");
        return;
      }
    } catch {
      setLogoutError("Could not sign out. Please try again.");
      return;
    }
    queryClient.removeQueries({ queryKey: ["profile"] });
    queryClient.removeQueries({ queryKey: ["account-data"] });
    queryClient.removeQueries({ queryKey: ["testimonials", "mine"] });
    closeNavigation();
    router.replace("/");
  }

  function focusMenuItem(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items?.length) return;
    event.preventDefault();
    const currentIndex = Array.from(items).indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : currentIndex === -1
          ? (event.key === "ArrowDown" ? 0 : items.length - 1)
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  return (
    <div className="global-profile-menu" ref={menuRef}>
      <button
        ref={triggerRef}
        className={`global-profile-trigger${isAccountRoute(pathname) ? " is-active" : ""}`}
        type="button"
        aria-label={`Open profile menu for ${fullName}`}
        aria-haspopup="menu"
        aria-expanded={profileMenuOpen}
        aria-controls="profile-dropdown"
        onClick={() => {
          setLogoutError("");
          setProfileMenuOpen(!profileMenuOpen);
        }}
      >
        <span className="global-profile-avatar" aria-hidden="true">{avatar
          ? <Image src={avatar} alt="" width={50} height={50} unoptimized />
          : initials}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {profileMenuOpen && <div id="profile-dropdown" className="global-profile-dropdown" role="menu" aria-label="Profile menu" onKeyDown={focusMenuItem}>
        <div className="global-profile-summary">
          <span className="global-profile-avatar is-large" aria-hidden="true">{avatar
            ? <Image src={avatar} alt="" width={54} height={54} unoptimized />
            : initials}</span>
          <span className="global-profile-identity"><strong>{fullName}</strong><span>{email}</span><small><Crown size={13} aria-hidden="true" /> Free plan</small></span>
        </div>
        <div className="global-profile-menu-items">
          {menuItems.map(({ href, label, icon: Icon }) => (
            <Link key={label} href={href} role="menuitem" onClick={() => { setProfileMenuOpen(false); setMobileMenuClosed(); }}>
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </div>
        {logoutError && <p className="global-profile-error" role="alert">{logoutError}</p>}
        <div className="global-profile-logout">
          <button type="button" role="menuitem" onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" /><span>Log out</span></button>
        </div>
      </div>}
      <div className="global-mobile-account">
        <Link className="global-mobile-account-link" href="/account" onClick={closeNavigation}>
          <span className="global-profile-avatar" aria-hidden="true">{avatar
            ? <Image src={avatar} alt="" width={42} height={42} unoptimized />
            : initials}</span>
          <span className="global-profile-identity"><strong>{fullName}</strong><span>{email}</span></span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        {logoutError && <p className="global-profile-error" role="alert">{logoutError}</p>}
        <div className="global-profile-logout">
          <button type="button" onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" /><span>Log out</span></button>
        </div>
      </div>
    </div>
  );
}

function setMobileMenuClosed() {
  useUiStore.getState().setMobileNavigationOpen(false);
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

function PrimaryNavigation({ pathname, closeNavigation }: { pathname: string; closeNavigation: () => void }) {
  const { data: session } = authClient.useSession();
  const { data: profileData } = useProfileQuery(session?.user?.id);
  const isAdministrator = profileData?.role === "admin" || profileData?.role === "super_admin";
  const links = isAdministrator
    ? [...navigation, { href: "/admin", label: "Admin", icon: Shield }]
    : navigation;

  return (
    <nav className="global-nav" aria-label="Primary navigation">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={`global-nav-link${isActive(pathname, href) ? " is-active" : ""}`}
          onClick={closeNavigation}
        >
          <Icon aria-hidden="true" size={15} />
          {label}
          <ChevronRight className="global-nav-chevron" aria-hidden="true" size={17} />
        </Link>
      ))}
    </nav>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const mobileNavigationOpen = useUiStore((state) => state.mobileNavigationOpen);
  const setMobileNavigationOpen = useUiStore((state) => state.setMobileNavigationOpen);
  const closeNavigation = useUiStore((state) => state.closeNavigation);
  const navigationDensity = useUiPreferencesStore((state) => state.navigationDensity);
  const headerRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setMobileNavigationOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false);
        menuToggleRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavigationOpen, setMobileNavigationOpen]);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [pathname, setMobileNavigationOpen]);

  return (
    <header className="global-header">
      <div className="global-header-inner" data-density={navigationDensity} ref={headerRef}>
        <div className="global-brand-group">
          <Link className="global-brand" href="/" aria-label="PrivSentinel home">
            <Image className="global-brand-logo" src="/PrivSentinel.png" alt="" width={60} height={60} priority />
            <span>Priv<span className="global-brand-accent">Sentinel</span></span>
          </Link>
          <span className="global-header-divider" aria-hidden="true" />
        </div>
        <div className={`global-mobile-panel${mobileNavigationOpen ? " is-open" : ""}`} id="primary-navigation">
          <div className="global-mobile-panel-header">
            <Link className="global-brand" href="/" aria-label="PrivSentinel home" onClick={closeNavigation}>
              <Image className="global-brand-logo" src="/PrivSentinel.png" alt="" width={48} height={48} />
              <span>Priv<span className="global-brand-accent">Sentinel</span></span>
            </Link>
            <button className="global-mobile-panel-close" type="button" aria-label="Close navigation" onClick={closeNavigation}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
            <PrimaryNavigation pathname={pathname} closeNavigation={closeNavigation} />
          <div className="global-header-actions"><SessionNavigation /></div>
        </div>
        <button
          ref={menuToggleRef}
          className="global-menu-toggle"
          type="button"
          aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavigationOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileNavigationOpen(!mobileNavigationOpen)}
        >
          <Menu className="menu-icon-open" size={20} aria-hidden="true" />
          <X className="menu-icon-close" size={20} aria-hidden="true" />
        </button>
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
