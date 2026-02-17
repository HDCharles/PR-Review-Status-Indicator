// ==UserScript==
// @name         GitHub Notifications - PR Review Status Indicator
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Shows your review status on PRs in the Review Requested notifications page
// @match        https://github.com/notifications*
// @match        https://github.com/*/pull/*
// @match        https://github.com/*/pulls*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// ==/UserScript==

(function () {
  "use strict";

  // --- Configuration keys ---
  const TOKEN_KEY = "gh_review_status_pat";
  const USERNAME_KEY = "gh_review_status_username";
  const DISPLAY_KEY = "gh_review_status_display";
  const SCOPE_KEY = "gh_review_status_scope";

  // --- Menu commands ---
  GM_registerMenuCommand("Set GitHub PAT", () => {
    const token = prompt("Enter your GitHub Personal Access Token:");
    if (token) GM_setValue(TOKEN_KEY, token.trim());
  });

  GM_registerMenuCommand("Set GitHub Username", () => {
    const username = prompt("Enter your GitHub username:");
    if (username) GM_setValue(USERNAME_KEY, username.trim().toLowerCase());
  });

  GM_registerMenuCommand("Display: Icon only", () => {
    GM_setValue(DISPLAY_KEY, "icon");
    location.reload();
  });

  GM_registerMenuCommand("Display: Icon + Text", () => {
    GM_setValue(DISPLAY_KEY, "icon-text");
    location.reload();
  });

  GM_registerMenuCommand("Display: Icon + Text + Color", () => {
    GM_setValue(DISPLAY_KEY, "icon-text-color");
    location.reload();
  });

  GM_registerMenuCommand("Scope: Review Requested only", () => {
    GM_setValue(SCOPE_KEY, "review-requested");
    location.reload();
  });

  GM_registerMenuCommand("Scope: All notifications", () => {
    GM_setValue(SCOPE_KEY, "all-notifications");
    location.reload();
  });

  GM_registerMenuCommand("Scope: Everywhere (notifications + PR pages)", () => {
    GM_setValue(SCOPE_KEY, "everywhere");
    location.reload();
  });

  // --- Getters ---
  function getToken() {
    return GM_getValue(TOKEN_KEY, "");
  }
  function getUsername() {
    return GM_getValue(USERNAME_KEY, "");
  }
  function getDisplayMode() {
    return GM_getValue(DISPLAY_KEY, "icon-text-color");
  }
  function getScope() {
    return GM_getValue(SCOPE_KEY, "review-requested");
  }

  // --- Page detection ---
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const query = params.get("query") || "";

  const isReviewRequestedPage =
    path === "/notifications" && query.includes("reason:review-requested");
  const isNotificationsPage = path === "/notifications";
  const isPRPage = /^\/[^/]+\/[^/]+\/pull\/\d+/.test(path);
  const isPRListPage = /^\/[^/]+\/[^/]+\/pulls/.test(path);

  function shouldRun() {
    const scope = getScope();
    switch (scope) {
      case "review-requested":
        return isReviewRequestedPage;
      case "all-notifications":
        return isNotificationsPage;
      case "everywhere":
        return isNotificationsPage || isPRPage || isPRListPage;
      default:
        return isReviewRequestedPage;
    }
  }

  if (!shouldRun()) return;

  // --- Styles ---
  const style = document.createElement("style");
  style.textContent = `
    .review-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-weight: 500;
      padding: 0 6px;
      border-radius: 8px;
      white-space: nowrap;
      vertical-align: middle;
      line-height: 20px;
      height: 20px;
      margin-left: 6px;
      position: relative;
      top: -1px;
    }

    /* --- Icon + Text + Color mode --- */
    .review-status-badge.mode-icon-text-color.approved {
      background: #1a7f37;
      color: #fff;
    }
    .review-status-badge.mode-icon-text-color.changes-requested {
      background: #cf222e;
      color: #fff;
    }
    .review-status-badge.mode-icon-text-color.commented {
      background: #9a6700;
      color: #fff;
    }
    .review-status-badge.mode-icon-text-color.pending {
      background: #656d76;
      color: #fff;
    }

    /* --- Icon + Text mode (no background) --- */
    .review-status-badge.mode-icon-text {
      background: transparent;
      padding: 0 2px;
    }
    .review-status-badge.mode-icon-text.approved { color: #3fb950; }
    .review-status-badge.mode-icon-text.changes-requested { color: #f85149; }
    .review-status-badge.mode-icon-text.commented { color: #d29922; }
    .review-status-badge.mode-icon-text.pending { color: #848d97; }

    /* --- Icon only mode --- */
    .review-status-badge.mode-icon {
      background: transparent;
      padding: 0 2px;
      gap: 0;
    }
    .review-status-badge.mode-icon.approved { color: #3fb950; }
    .review-status-badge.mode-icon.changes-requested { color: #f85149; }
    .review-status-badge.mode-icon.commented { color: #d29922; }
    .review-status-badge.mode-icon.pending { color: #848d97; }

    /* --- Loading / error --- */
    .review-status-badge.loading {
      background: transparent;
      color: #848d97;
      padding: 0 2px;
    }
    .review-status-badge.error {
      background: transparent;
      color: #f85149;
      font-size: 10px;
      padding: 0 2px;
    }
  `;
  document.head.appendChild(style);

  // --- Status definitions ---
  const STATUSES = {
    approved: { icon: "✅", text: "Approved" },
    "changes-requested": { icon: "🔄", text: "Changes requested" },
    commented: { icon: "💬", text: "Commented" },
    pending: { icon: "⏳", text: "Pending" },
  };

  function renderBadge(badge, stateKey, mode) {
    const s = STATUSES[stateKey];
    const modeClass = `mode-${mode}`;
    badge.className = `review-status-badge ${modeClass} ${stateKey}`;

    if (mode === "icon") {
      badge.textContent = s.icon;
      badge.title = s.text;
    } else {
      badge.textContent = `${s.icon} ${s.text}`;
      badge.title = "";
    }
  }

  // --- API helper ---
  function ghAPI(path) {
    const token = getToken();
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: `https://api.github.com${path}`,
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        onload(resp) {
          if (resp.status === 200) {
            resolve(JSON.parse(resp.responseText));
          } else {
            reject(new Error(`API ${resp.status}: ${path}`));
          }
        },
        onerror(err) {
          reject(err);
        },
      });
    });
  }

  // --- Review status lookup ---
  async function getReviewStatus(owner, repo, prNumber, username) {
    const reviews = await ghAPI(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=100`
    );

    const myReviews = reviews
      .filter((r) => r.user.login.toLowerCase() === username)
      .filter((r) => r.state !== "PENDING")
      .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));

    if (myReviews.length === 0) return "pending";

    const latest = myReviews[myReviews.length - 1];
    switch (latest.state) {
      case "APPROVED":
        return "approved";
      case "CHANGES_REQUESTED":
        return "changes-requested";
      case "COMMENTED":
        return "commented";
      default:
        return "commented";
    }
  }

  // --- Parse PR info from a URL/href ---
  function parsePRLink(href) {
    const match = href.match(/\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: match[3] };
  }

  // --- Attach badge helper ---
  function attachBadge(targetEl, prInfo, username, mode) {
    if (targetEl.querySelector(".review-status-badge")) return;

    const badge = document.createElement("span");
    badge.className = "review-status-badge loading";
    badge.textContent = "⏳";
    targetEl.appendChild(badge);

    getReviewStatus(prInfo.owner, prInfo.repo, prInfo.number, username)
      .then((stateKey) => renderBadge(badge, stateKey, mode))
      .catch((err) => {
        badge.className = "review-status-badge error";
        badge.textContent = "⚠";
        badge.title = err.message;
      });
  }

  // --- Process notifications page ---
  function processNotifications() {
    const username = getUsername();
    const mode = getDisplayMode();
    if (!getToken() || !username) return;

    const rows = document.querySelectorAll(".notifications-list-item");
    for (const row of rows) {
      if (row.querySelector(".review-status-badge")) continue;

      const link = row.querySelector("a.notification-list-item-link");
      if (!link) continue;

      const prInfo = parsePRLink(link.getAttribute("href"));
      if (!prInfo) continue;

      const titleEl = row.querySelector(".markdown-title");
      if (!titleEl) continue;

      attachBadge(titleEl, prInfo, username, mode);
    }
  }

  // --- Process a single PR page ---
  function processPRPage() {
    const username = getUsername();
    const mode = getDisplayMode();
    if (!getToken() || !username) return;

    const prInfo = parsePRLink(window.location.pathname);
    if (!prInfo) return;

    // Target the PR title heading
    const titleEl =
      document.querySelector(".gh-header-title .js-issue-title") ||
      document.querySelector(".gh-header-title .markdown-title") ||
      document.querySelector("h1.gh-header-title bdi");
    if (!titleEl || titleEl.querySelector(".review-status-badge")) return;

    attachBadge(titleEl, prInfo, username, mode);
  }

  // --- Process PR list pages (e.g. /pulls) ---
  function processPRList() {
    const username = getUsername();
    const mode = getDisplayMode();
    if (!getToken() || !username) return;

    // Each row in a PR list has a link to the PR
    const items = document.querySelectorAll("[id^='issue_']");
    for (const item of items) {
      if (item.querySelector(".review-status-badge")) continue;

      const link = item.querySelector("a[data-hovercard-type='pull_request']") ||
                   item.querySelector("a[href*='/pull/']");
      if (!link) continue;

      const prInfo = parsePRLink(link.getAttribute("href"));
      if (!prInfo) continue;

      attachBadge(link, prInfo, username, mode);
    }
  }

  // --- Main dispatcher ---
  function run() {
    if (isNotificationsPage) {
      processNotifications();
    }
    if (isPRPage) {
      processPRPage();
    }
    if (isPRListPage) {
      processPRList();
    }
  }

  run();

  const observer = new MutationObserver(() => {
    clearTimeout(observer._timeout);
    observer._timeout = setTimeout(run, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
