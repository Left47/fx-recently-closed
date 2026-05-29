"use strict";

// Firefox exposes `browser`; fall back to `chrome` for safety.
const api = typeof browser !== "undefined" ? browser : chrome;

const INLINE_COUNT = 5;

const els = {
  recent: document.getElementById("recent-list"),
  overflow: document.getElementById("overflow-list"),
  seeAll: document.getElementById("see-all"),
  seeAllToggle: document.getElementById("see-all-toggle"),
  seeAllCount: document.getElementById("see-all-count"),
  empty: document.getElementById("empty"),
  tooltip: document.getElementById("tooltip"),
};

/** Restore a closed session by its sessionId, then close the popup. */
async function restore(sessionId) {
  try {
    await api.sessions.restore(sessionId);
  } catch (e) {
    console.error("Failed to restore session:", e);
  }
  window.close();
}

/** Fallback globe glyph for tabs without a favicon. */
function globe() {
  const span = document.createElement("span");
  span.className = "window-glyph";
  span.textContent = "🌐";
  return span;
}

/** A 16px favicon element for a tab, falling back to a globe glyph. */
function faviconIcon(tab) {
  const icon = document.createElement("span");
  icon.className = "icon";
  if (tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)) {
    const img = document.createElement("img");
    img.className = "favicon";
    img.src = tab.favIconUrl;
    img.alt = "";
    img.addEventListener("error", () => { img.replaceWith(globe()); });
    icon.appendChild(img);
  } else {
    icon.appendChild(globe());
  }
  return icon;
}

/** Build a row for a single closed tab. */
function tabRow(tab) {
  const li = document.createElement("li");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "row";
  btn.setAttribute("role", "menuitem");
  btn.title = `${tab.title || tab.url}\n${tab.url || ""}`.trim();

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = tab.title || tab.url || "Untitled";

  btn.append(faviconIcon(tab), title);
  btn.addEventListener("click", () => restore(tab.sessionId));
  btn.addEventListener("mouseenter", hideTooltip);

  li.appendChild(btn);
  return li;
}

/** Build a row for a single closed window, showing its tab count + tooltip. */
function windowRow(win) {
  const li = document.createElement("li");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "row has-flyout";
  btn.setAttribute("role", "menuitem");

  const tabs = win.tabs || [];
  const n = tabs.length;
  const lead = tabs.find(t => t.active) || tabs[0];
  const label = lead && (lead.title || lead.url) ? (lead.title || lead.url) : "Window";

  btn.title = `Closed window — ${n} tab${n === 1 ? "" : "s"}`;

  const icon = document.createElement("span");
  icon.className = "icon window-glyph";
  icon.textContent = "🗔";

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = label;

  const count = document.createElement("span");
  count.className = "count";
  count.textContent = `${n} tab${n === 1 ? "" : "s"}`;

  btn.append(icon, title, count);
  btn.addEventListener("click", () => restore(win.sessionId));

  // Hover shows a floating tooltip listing every tab in the closed window.
  btn.addEventListener("mouseenter", () => showTooltip(btn, win));
  btn.addEventListener("mouseleave", hideTooltip);

  li.appendChild(btn);
  return li;
}

/* ---- Tooltip (tab names of a closed window) ---------------------------- */

function buildTooltip(win) {
  const tabs = win.tabs || [];
  els.tooltip.replaceChildren();

  const head = document.createElement("div");
  head.className = "tooltip-head";
  head.textContent = `${tabs.length} tab${tabs.length === 1 ? "" : "s"}`;
  els.tooltip.appendChild(head);

  for (const tab of tabs) {
    const item = document.createElement("div");
    item.className = "tooltip-item";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = tab.title || tab.url || "Untitled";

    item.append(faviconIcon(tab), title);
    els.tooltip.appendChild(item);
  }
}

function showTooltip(row, win) {
  buildTooltip(win);
  els.tooltip.hidden = false;

  // Position after layout so we can measure the tooltip's real size and keep
  // it inside the popup viewport. Anchored just below the hovered row,
  // indented under its label.
  const rect = row.getBoundingClientRect();
  const tip = els.tooltip;
  const margin = 4;

  let left = rect.left + 28;
  let top = rect.bottom + 2;

  if (left + tip.offsetWidth > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - margin - tip.offsetWidth);
  }
  // If it would spill past the bottom, flip it above the row.
  if (top + tip.offsetHeight > window.innerHeight - margin) {
    const above = rect.top - 2 - tip.offsetHeight;
    top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - tip.offsetHeight);
  }

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideTooltip() {
  els.tooltip.hidden = true;
  els.tooltip.replaceChildren();
}

/* ---- Render ------------------------------------------------------------ */

function rowFor(session) {
  if (session.tab) return tabRow(session.tab);
  if (session.window) return windowRow(session.window);
  return null;
}

async function render() {
  let sessions = [];
  try {
    sessions = await api.sessions.getRecentlyClosed();
  } catch (e) {
    console.error("getRecentlyClosed failed:", e);
  }

  els.recent.replaceChildren();
  els.overflow.replaceChildren();

  if (!sessions.length) {
    els.empty.hidden = false;
    els.seeAll.hidden = true;
    return;
  }
  els.empty.hidden = true;

  const inline = sessions.slice(0, INLINE_COUNT);
  const overflow = sessions.slice(INLINE_COUNT);

  for (const s of inline) {
    const row = rowFor(s);
    if (row) els.recent.appendChild(row);
  }

  if (overflow.length) {
    for (const s of overflow) {
      const row = rowFor(s);
      if (row) els.overflow.appendChild(row);
    }
    els.seeAllCount.textContent = `${overflow.length} more`;
    els.seeAll.hidden = false;
  } else {
    els.seeAll.hidden = true;
  }
}

els.seeAllToggle.addEventListener("click", () => {
  const expanded = els.seeAllToggle.getAttribute("aria-expanded") === "true";
  els.seeAllToggle.setAttribute("aria-expanded", String(!expanded));
  els.overflow.hidden = expanded;
});
els.seeAllToggle.addEventListener("mouseenter", hideTooltip);

document.addEventListener("DOMContentLoaded", render);
