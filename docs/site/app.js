const SEARCH_INDEX = [
  { title: "Welcome", url: "./index.html", section: "Get Started", keywords: "overview quickstart docs" },
  { title: "Quickstart", url: "./quickstart.html", section: "Get Started", keywords: "install run scripts setup" },
  { title: "Platform Guide", url: "./platform-guide.html", section: "Guides", keywords: "web desktop client backend core server node gateway architecture features" },
  { title: "Core API", url: "./api-core.html", section: "API", keywords: "auth servers invites social billing" },
  { title: "Server Node API", url: "./api-server-node.html", section: "API", keywords: "guilds channels messages voice attachments emotes" },
  { title: "Method Index", url: "./api-methods.html", section: "API", keywords: "all endpoints methods routes core server node api v9" },
  { title: "Extension SDK", url: "./extensions-sdk.html", section: "Extensions", keywords: "commands config runtime manifest" },
  { title: "Extension + RPC Apps", url: "./integrations-rpc.html", section: "Extensions", keywords: "rpc bridge local api payloads activity images buttons extensions auth" },
  { title: "Extension API helpers", url: "./extensions-sdk.html#helpers", section: "Extensions", keywords: "apis.servers apis.invites apis.nodeGuilds" },
  { title: "Attachments and Embeds", url: "./guides.html#attachments", section: "Guides", keywords: "uploads files link embed message embed" },
  { title: "Invites and Join Flow", url: "./guides.html#invites", section: "Guides", keywords: "join link accept flow permanent invite" },
  { title: "Badges and Boost perks", url: "./guides.html#badges", section: "Guides", keywords: "admin owner boost badge" },
  { title: "Rich Presence model", url: "./platform-guide.html#rich-presence-model-no-app-id", section: "Guides", keywords: "rpc presence image url buttons no app id" },
  { title: "Desktop RPC bridge", url: "./platform-guide.html#desktop-client-capabilities", section: "Guides", keywords: "desktop rpc bridge 127.0.0.1 6463 rpc activity health" },
  { title: "Auth and Token Refresh", url: "./operations.html#auth", section: "Operations", keywords: "access token refresh token sessions" },
  { title: "Logging and Diagnostics", url: "./operations.html#logging", section: "Operations", keywords: "logs warn error debug_http debug_voice" },
  { title: "Environment variables", url: "./operations.html#env", section: "Operations", keywords: "env config deployment" }
];

function normalizePathname(pathname) {
  const clean = pathname.split("?")[0].split("#")[0];
  return clean.endsWith("/") ? `${clean}index.html` : clean;
}

function setActiveNav() {
  const current = normalizePathname(window.location.pathname);
  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    const absolute = new URL(href, window.location.href);
    const isActive = normalizePathname(absolute.pathname) === current;
    link.classList.toggle("active", isActive);
  });
}

function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("mobile-toggle");
  if (!sidebar || !toggle) return;
  toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.addEventListener("click", () => sidebar.classList.remove("open"));
  });
}

function setupSearch() {
  const input = document.getElementById("doc-search");
  const list = document.getElementById("search-results");
  if (!input || !list) return;

  function close() {
    list.classList.remove("open");
  }

  function render(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      list.innerHTML = "";
      close();
      return;
    }

    const matches = SEARCH_INDEX.filter((entry) => {
      const hay = `${entry.title} ${entry.section} ${entry.keywords}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 8);

    if (!matches.length) {
      list.innerHTML = '<div class="search-item">No results</div>';
      list.classList.add("open");
      return;
    }

    list.innerHTML = matches
      .map(
        (m) => `<a class="search-item" href="${m.url}">
          <div>${m.title}</div>
          <div class="search-meta">${m.section}</div>
        </a>`
      )
      .join("");
    list.classList.add("open");
  }

  input.addEventListener("input", () => render(input.value));
  input.addEventListener("focus", () => render(input.value));

  document.addEventListener("click", (event) => {
    if (!list.contains(event.target) && event.target !== input) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== input) {
      event.preventDefault();
      input.focus();
    }
    if (event.key === "Escape") {
      close();
      input.blur();
    }
  });
}

setActiveNav();
setupSidebar();
setupSearch();
