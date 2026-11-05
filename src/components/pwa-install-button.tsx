"use client";

import { AppWindow, Download, Play } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeToStandalone(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    mediaQuery.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") return false;
  const safariNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || safariNavigator.standalone === true;
}

function getServerStandaloneSnapshot() {
  return false;
}

function browserInstructions() {
  const userAgent = navigator.userAgent;
  if (/Edg\//.test(userAgent)) {
    return "In Microsoft Edge, open the menu, choose Apps, then select Install this site as an app.";
  }
  if ((navigator as Navigator & { brave?: unknown }).brave || /Brave/.test(userAgent)) {
    return "In Brave, use the install icon in the address bar if shown, or open the menu and choose Save and share → Create shortcut or Install. The wording can vary by version.";
  }
  if (/Chrome\//.test(userAgent)) {
    return "In Chrome, use the install icon in the address bar if shown, or open the menu and choose Cast, save and share → Install page as app.";
  }
  if (/Firefox\//.test(userAgent)) {
    return "This browser does not support desktop PWA installation for this site. Open PrivSentinel in Chrome, Brave, or Edge to install it as an app.";
  }
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) {
    return "Safari does not support desktop PWA installation for this site. Open PrivSentinel in Chrome, Brave, or Edge to install it as an app.";
  }
  return "This browser did not provide an installation prompt. Check its menu for an Install app option; availability and wording vary by browser.";
}

export function PwaInstallButton({ variant = "hero" }: { variant?: "hero" | "inline" }) {
  const isStandalone = useSyncExternalStore(
    subscribeToStandalone,
    getStandaloneSnapshot,
    getServerStandaloneSnapshot,
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstructions("");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isStandalone || isInstalled) return null;

  function handleInstall() {
    setInstructions(browserInstructions());
  }

  return (
    <div className={`pwa-install pwa-install-${variant}${instructions ? " has-help" : ""}`}>
      <button
        className="pwa-install-button"
        type="button"
        aria-expanded={Boolean(instructions)}
        aria-controls={`pwa-install-help-${variant}`}
        onClick={() => void handleInstall()}
      >
        <AppWindow size={16} aria-hidden="true" />
        Install Web App
      </button>
      {instructions && <div className="pwa-install-help" id={`pwa-install-help-${variant}`} role="status">
        <p>{instructions}</p>
        <a href="/download"><Download size={13} aria-hidden="true" /> Download for Windows</a>
        <button type="button" aria-label="Dismiss install instructions" onClick={() => setInstructions("")}><Play size={12} aria-hidden="true" /></button>
      </div>}
    </div>
  );
}
