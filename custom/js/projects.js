document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("story-list");
  const sortEl = document.getElementById("projects-sort");
  const filterEl = document.getElementById("projects-filter");
  const JSON_PATH = new URL("projects.json", location.href).toString();
  const FALLBACK_THUMB = "/custom/img/thumb-fallback.png";

  const safe = (v, d = "") => (v == null ? d : v);
  const resolveThumb = (p) => {
    if (!p) return FALLBACK_THUMB;
    if (/^(?:https?:)?\/\//i.test(p) || p.startsWith("/")) return p;
    try { return new URL(p, location.href).toString(); } catch { return p || FALLBACK_THUMB; }
  };
  const parseDate = (s) => {
    if (!s) return new Date(0);
    const parts = String(s).split("-");
    return parts.length >= 3 ? new Date(Date.UTC(Number(parts[0]), Number(parts[1])-1, Number(parts[2]))) : new Date(s);
  };
  const esc = (s) => (s == null ? "" : String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"));

  async function loadProjects() {
    if (listEl) listEl.innerHTML = `<div class="loader" role="status" aria-live="polite"><p>Loading…</p></div>`;
    let raw;
    try {
      const res = await fetch(JSON_PATH, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      raw = await res.json();
    } catch {
      raw = [];
    }

    const arr = Array.isArray(raw) ? raw : [];
    const normalized = arr.map(it => ({
      slug: safe(it.slug, safe(it.id, "")),
      title: safe(it.title, safe(it.name, "Untitled Project")),
      tagline: safe(it.tagline, safe(it.description, "")),
      thumbnail: resolveThumb(it.thumbnail || it.thumb || it.thumb_url || ""),
      link: safe(it.link, it.href) || (it.slug ? `pages/projects.html?proj=${encodeURIComponent(it.slug)}` : "#"),
      dateObj: parseDate(it.date),
      finished: !!it.finished
    }));

    window.__PROJECTS = normalized;
    renderProjects();
  }

  function renderProjects() {
    const data = (window.__PROJECTS || []).slice();
    const filter = filterEl?.value || "all";
    let filtered = data.filter(p => filter === "all" || (filter === "finished" ? p.finished : !p.finished));

    const sort = sortEl?.value || "newest";
    filtered.sort((a,b) => sort === "newest" ? b.dateObj - a.dateObj : a.dateObj - b.dateObj);

    if (!listEl) return;
    if (!filtered.length) {
      listEl.innerHTML = `<div class="no-results" role="status" aria-live="polite"><p>No projects matched your filter.</p></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(p => {
      const titleId = `proj-title-${esc(p.slug || p.title).replace(/\s+/g,'-')}`;
      return `
        <article class="story-row" role="listitem" aria-labelledby="${titleId}">
          <img class="story-thumb" src="${esc(p.thumbnail)}" alt="${esc(p.title)}" loading="lazy" decoding="async"
            onerror="this.onerror=null;this.src='${FALLBACK_THUMB}';" />
          <div class="story-meta">
            <h3 id="${titleId}" class="story-title">${esc(p.title)}</h3>
            <p class="story-blurb">${esc(p.tagline)}</p>
          </div>
          <a class="read-btn" href="${esc(p.link)}" aria-label="Open ${esc(p.title)}">Open</a>
        </article>
      `;
    }).join("");
  }

  if (sortEl) sortEl.addEventListener("change", renderProjects);
  if (filterEl) filterEl.addEventListener("change", renderProjects);

  loadProjects();
});
