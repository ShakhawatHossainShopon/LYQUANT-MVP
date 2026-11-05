export const NAVIGATION_CONFIG = {
  appName: "QUANT",
  appSubtitle: "Forex Indices",

  // Account environment info
  environment: "Real",
  accountType: "Cent",

  // Live Currency Conversion Rate for BDT display (auto-updated from free live exchange rate API)
  usdToBdtRate: 124.09,

  // Sidebar navigation routes
  links: [
    { name: "Dashboard", href: "/", iconName: "LayoutDashboard" },
    { name: "Charts", href: "/charts", iconName: "LineChart" },
    { name: "Position Volumes", href: "/positions", iconName: "Activity" },
    {
      name: "Risk Management",
      href: "/risk-management",
      iconName: "ShieldAlert",
    },
    { name: "My Assets", href: "/my-assets", iconName: "Bookmark" },
    { name: "Asset List", href: "/assets", iconName: "Layers" },
    { name: "Portfolio", href: "/portfolio", iconName: "PieChart" },
    { name: "News & Filter", href: "/news", iconName: "Radio" },
    { name: "Correlation", href: "/correlation", iconName: "GitCommit" },
    { name: "Time Window", href: "/time-window", iconName: "Clock" },
    { name: "History", href: "/exit-positions", iconName: "History" },
  ],
};

// Automatically fetch live real-time USD/BDT market rate from free public API (no API key required)
(async function initLiveBdtExchangeRate() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const cached = window.localStorage.getItem("lyquant_live_usd_bdt_rate");
      if (cached) {
        const cachedVal = parseFloat(cached);
        if (!isNaN(cachedVal) && cachedVal > 50) {
          NAVIGATION_CONFIG.usdToBdtRate = cachedVal;
        }
      }
    }

    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const data = await res.json();
      const liveRate = data?.rates?.BDT;
      if (liveRate && typeof liveRate === "number" && liveRate > 50) {
        const roundedRate = Number(liveRate.toFixed(2));
        NAVIGATION_CONFIG.usdToBdtRate = roundedRate;
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            "lyquant_live_usd_bdt_rate",
            String(roundedRate),
          );
        }
      }
    }
  } catch {
    // Silently fall back to current baseline if network is offline
  }
})();
