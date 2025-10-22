
/* ---------- Background helper ---------- */
const bgLayer = document.getElementById('bgLayer');
function setBackground(src){
  if(!bgLayer) return;
  bgLayer.style.backgroundImage = `url('${src}')`;
}
/*setBackground('./custom/img/title-candidate3.jpg');*/

/* ---------- Utilities ---------- */
function basename(path){ return (path||'').split('/').pop(); }
function debounce(fn, wait = 120){
  let t = null;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this, args), wait);
  };
}

/* ---------- Core DOM refs ---------- */
const contentBox = document.getElementById('contentBox');
const contentsList = document.getElementById('contentsList');
const expandAllBtn = document.getElementById('expandAllBtn');
const closeAllBtn = document.getElementById('closeAllBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const chapList = document.getElementById('chapList');

/* ---------- Left-nav sequence builder (robust DOM-order collection) ---------- */
function resolveHrefToBasename(href){
  try {
    const url = new URL(href, window.location.href);
    return basename(url.pathname);
  } catch (err){
    const cleaned = (href || '').split(/[?#]/)[0];
    return basename(cleaned);
  }
}

function buildLeftNavSequence(){
  const seq = [];
  if(!chapList) return seq;

  // Collect all anchors under chapList in DOM order (include anchors even if they lost href).
  const anchors = Array.from(chapList.querySelectorAll('a'));
  const seen = new Set();

  anchors.forEach(a => {
    // only consider anchors that are part of a .chap-item (ignore unrelated links)
    const li = a.closest('.chap-item');
    if(!li) return;

    // prefer explicit anchor href; fallback to li.dataset.href (for items that use data-href)
    const hrefRaw = a.getAttribute('href') || li.dataset.href || '';
    const base = resolveHrefToBasename(hrefRaw);
    const key = `${hrefRaw}|${base}|${a.innerText.trim()}`;

    if(seen.has(key)) return;
    seen.add(key);

    seq.push({
      href: hrefRaw,
      base,
      label: a.innerText.trim()
    });
  });

  // Also include any chap-item[data-href] that may not have an <a> inside (edge-case).
  Array.from(chapList.querySelectorAll('.chap-item[data-href]')).forEach(li => {
    const dh = li.dataset.href;
    if(!dh) return;
    const dhBase = resolveHrefToBasename(dh);
    if(seq.some(s => s.base === dhBase)) return;
    seq.push({ href: dh, base: dhBase, label: dh });
  });

  return seq;
}

function findCurrentNavIndex(){
  const seq = buildLeftNavSequence();
  const currentPathBasename = basename(window.location.pathname || '') || '';
  const currentFull = window.location.href;

  // 1) Exact basename match.
  let idx = seq.findIndex(item => item.base === currentPathBasename);
  if(idx !== -1) return idx;

  // 2) Match by resolved pathname (endsWith)
  idx = seq.findIndex(item => {
    try {
      const resolved = new URL(item.href, window.location.href).pathname;
      return currentFull.endsWith(resolved) || window.location.pathname.endsWith(resolved);
    } catch (err){ return false; }
  });
  if(idx !== -1) return idx;

  // 3) Exact resolved pathname match
  idx = seq.findIndex(item => {
    try {
      const r = new URL(item.href, window.location.href);
      const curr = new URL(window.location.href);
      return r.pathname === curr.pathname;
    } catch (err) { return false; }
  });
  if(idx !== -1) return idx;

  // 4) Loose fallback: label contains filename
  const curFile = currentPathBasename.toLowerCase();
  idx = seq.findIndex(item => (item.label||'').toLowerCase().includes(curFile));
  if(idx !== -1) return idx;

  console.warn('[guide.js] Left-nav sequence did not find a match for current page:', window.location.href, 'sequence:', seq);
  return -1;
}

/* Prev/Next controls follow the seq order exactly */
function updatePageNavStates(){
  const seq = buildLeftNavSequence();
  const cur = findCurrentNavIndex();
  const hasPrev = cur > 0;
  const hasNext = cur >= 0 && cur < seq.length - 1;
  if(prevPageBtn) { prevPageBtn.disabled = !hasPrev; prevPageBtn.classList.toggle('disabled', !hasPrev); }
  if(nextPageBtn) { nextPageBtn.disabled = !hasNext; nextPageBtn.classList.toggle('disabled', !hasNext); }
}
if(prevPageBtn){
  prevPageBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const seq = buildLeftNavSequence();
    let cur = findCurrentNavIndex();
    if(cur === -1) {
      // pick nearest: try to find insertion position by pathname order — fallback to first
      cur = seq.length ? 0 : -1;
    }
    if(cur > 0 && seq[cur-1] && seq[cur-1].href){
      window.location.href = seq[cur-1].href;
    }
  });
}
if(nextPageBtn){
  nextPageBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const seq = buildLeftNavSequence();
    let cur = findCurrentNavIndex();
    if(cur === -1) {
      cur = seq.length ? 0 : -1;
    }
    if(cur >= 0 && cur < seq.length - 1 && seq[cur+1] && seq[cur+1].href){
      window.location.href = seq[cur+1].href;
    }
  });
}

/* ---------- Panels / Anchors (right contents) ---------- */
function getPanels(){ return contentBox ? Array.from(contentBox.querySelectorAll('.panel')) : []; }
let panels = getPanels();
let currentPanelIndex = panels.findIndex(p => p.classList.contains('open'));
if(currentPanelIndex === -1) currentPanelIndex = 0;

function buildContents(){
  panels = getPanels();
  if(!contentsList) return;
  contentsList.innerHTML = '';
  panels.forEach((p, i) => {
    const heading = p.querySelector('.panel-header h3');
    const title = heading ? heading.innerText.trim() : `Panel ${i+1}`;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${p.id}`;
    a.textContent = `${i+1}. ${title}`;
    a.dataset.index = i;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const targetHash = `#${p.id}`;
      if(location.hash !== targetHash) history.pushState(null, '', targetHash);
      openPanel(i, true, () => navigateToElement(p, 0, 'smooth'), { closeOthers:false, scrollOnOpen:true });
    });
    li.appendChild(a);

    const children = Array.from(p.querySelectorAll('.anchor[data-parent]'));
    if(children.length){
      const sub = document.createElement('ul'); sub.className = 'contents-sublist';
      children.forEach(child => {
        const chi = document.createElement('li');
        const ca = document.createElement('a');
        ca.href = `#${child.id}`;
        ca.textContent = child.querySelector('h4') ? child.querySelector('h4').innerText.trim() : child.id;
        ca.dataset.index = i;
        ca.dataset.anchorId = child.id;
        ca.addEventListener('click', (ev) => {
          ev.preventDefault();
          const targetHash = `#${child.id}`;
          if(location.hash !== targetHash) history.pushState(null, '', targetHash);
          openPanel(i, true, () => {
            const headerH = panels[i].querySelector('.panel-header')?.offsetHeight || 0;
            navigateToElement(child, headerH, 'smooth');
          }, { closeOthers:false, scrollOnOpen:true });
        });
        chi.appendChild(ca); sub.appendChild(chi);
      });
      li.appendChild(sub);
    }
    contentsList.appendChild(li);
  });
}

/* set caret */
function setPanelCaret(panel){
  const header = panel.querySelector('.panel-header');
  const caret = header?.querySelector('.caret');
  if(panel.classList.contains('open')){
    header && header.setAttribute('aria-expanded','true');
    if(caret) caret.textContent = '▾';
  } else {
    header && header.setAttribute('aria-expanded','false');
    if(caret) caret.textContent = '▸';
  }
}

/* open panel */
function openPanel(index, smooth=true, cb=null, opts={closeOthers:false, scrollOnOpen:true}){
  panels = getPanels();
  if(index < 0 || index >= panels.length) return;
  const target = panels[index];
  if(opts.closeOthers){
    panels.forEach(p=>{ if(p !== target && p.classList.contains('open')){ p.classList.remove('open'); setPanelCaret(p); }});
  }
  if(!target.classList.contains('open')){
    target.classList.add('open'); setPanelCaret(target);
    setTimeout(()=>{
      if(opts.scrollOnOpen) navigateToElement(target, 0, smooth ? 'smooth' : 'auto');
      if(typeof cb === 'function') cb();
      updateActivePanel(index);
      updateActiveLinks();
    }, smooth ? 120 : 10);
  } else {
    if(opts.scrollOnOpen) navigateToElement(target, 0, smooth ? 'smooth' : 'auto');
    updateActivePanel(index);
    updateActiveLinks();
    if(typeof cb === 'function') cb();
  }
}

/* panel header toggle */
if(contentBox){
  contentBox.addEventListener('click', (e)=>{
    const header = e.target.closest('.panel-header'); if(!header) return;
    const panel = header.closest('.panel'); if(!panel) return;
    const idx = Number(panel.dataset.index) || 0;
    const wasOpen = panel.classList.contains('open');
    if(wasOpen){
      panel.classList.remove('open'); setPanelCaret(panel);
      const openIdx = getPanels().findIndex(p=>p.classList.contains('open'));
      updateActivePanel(openIdx >= 0 ? openIdx : 0);
      updateActiveLinks();
    } else {
      openPanel(idx, true, null, { closeOthers:false, scrollOnOpen:false });
    }
  });
}

/* ---------- Scroll root & helpers ---------- */
function getActiveScrollRoot(){
  if(contentBox && contentBox.scrollHeight > contentBox.clientHeight) return contentBox;
  return (document.scrollingElement || document.documentElement);
}
function getScrollTop(){
  const root = getActiveScrollRoot();
  if(root === document.scrollingElement || root === document.documentElement) return window.scrollY || document.documentElement.scrollTop || 0;
  return root.scrollTop || 0;
}
function navigateToElement(el, headerOffset = 0, behavior = 'smooth'){
  if(!el) return;
  const root = getActiveScrollRoot();
  const rootIsPage = (root === document.scrollingElement || root === document.documentElement);
  const rootRect = rootIsPage ? { top: 0 } : root.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const offsetWithin = elRect.top - rootRect.top;
  const currentScroll = getScrollTop();
  const target = Math.max(0, Math.round(currentScroll + offsetWithin - headerOffset - 4));
  try {
    if(rootIsPage) window.scrollTo({ top: target, behavior });
    else root.scrollTo({ top: target, behavior });
  } catch (err){
    if(rootIsPage) window.scrollTo(0, target);
    else root.scrollTop = target;
  }
}

/* ---------- Scroll handling (rAF) ---------- */
let scrollRaf = null;
function scrollHandler(){ if(scrollRaf) return; scrollRaf = requestAnimationFrame(()=>{ handleContentScroll(); scrollRaf = null; }); }
window.addEventListener('scroll', scrollHandler, { passive: true });
if(contentBox) contentBox.addEventListener('scroll', scrollHandler, { passive: true });

function handleContentScroll(){
  panels = getPanels();
  const st = getScrollTop();
  let idx = -1;
  for(let i = panels.length - 1; i >= 0; i--){
    const pr = panels[i].getBoundingClientRect();
    const root = getActiveScrollRoot();
    const rootRect = (root === document.scrollingElement || root === document.documentElement) ? { top: 0 } : root.getBoundingClientRect();
    const panelTopRel = st + (pr.top - rootRect.top);
    if(st + 10 >= panelTopRel - 2){ idx = i; break; }
  }
  if(idx === -1) idx = 0;
  currentPanelIndex = idx;
  updateActivePanel(idx);
  updateActiveLinks();
}



/* ---------- Right-nav: keep active link visible (robust) ---------- */

/**
 * Find the nearest scrollable ancestor (vertical) of `el`.
 * Falls back to the viewport (document.scrollingElement) if none found.
 */
function findVerticalScrollParent(el) {
  if (!el) return document.scrollingElement || document.documentElement;
  let cur = el.parentElement;
  while (cur && cur !== document.documentElement) {
    const style = getComputedStyle(cur);
    const overflowY = style.overflowY;
    const isScrollable = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
      && cur.scrollHeight > cur.clientHeight + 2;
    if (isScrollable) return cur;
    cur = cur.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

/**
 * Debounced helper that ensures the provided link is visible inside its scroll container.
 * If the container is the page, it uses window.scrollTo; otherwise it scrolls the container.
 */
const debouncedEnsureNavVisible = debounce((link) => {
  try {
    if (!link) return;
    // prefer the .contents-panel if available, otherwise find nearest scrollable ancestor
    const preferredContainer = link.closest('.contents-panel') || contentsList && contentsList.closest('.contents-panel');
    const scrollRoot = preferredContainer || findVerticalScrollParent(link);

    // If scrollRoot is the page root, use element.scrollIntoView with nearest
    const isPageRoot = (scrollRoot === document.scrollingElement || scrollRoot === document.documentElement);

    // small padding so active item isn't glued to the top/bottom
    const PAD = 8;

    // If the container supports scrollTo and we can compute positions, do a precise scroll
    try {
      const linkRect = link.getBoundingClientRect();
      const rootRect = isPageRoot ? { top: 0, bottom: window.innerHeight } : scrollRoot.getBoundingClientRect();

      // check if fully visible
      if (linkRect.top >= rootRect.top + PAD && linkRect.bottom <= rootRect.bottom - PAD) {
        // already visible — nothing to do
        return;
      }

      // compute target scrollTop relative to scrollRoot
      if (!isPageRoot) {
        const currentScroll = scrollRoot.scrollTop;
        const offsetWithin = linkRect.top - rootRect.top;
        const desiredTop = Math.max(0, Math.round(currentScroll + offsetWithin - PAD));
        // smooth scroll (fallback to instant)
        try { scrollRoot.scrollTo({ top: desiredTop, behavior: 'smooth' }); }
        catch (err) { scrollRoot.scrollTop = desiredTop; }
        return;
      }
    } catch (err) {
      // fallthrough to scrollIntoView fallback
    }

    // fallback: scroll the element into view (block: 'nearest' avoids jumping)
    try {
      link.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    } catch (err) {
      try { link.scrollIntoView(true); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    // don't allow this to break the rest of your UI
    console.warn('[guide.js] ensureNavVisible error', e);
  }
}, 120);



function updateActiveLinks(){
  if(!contentsList) return;
  contentsList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
  panels = getPanels();
  if(!panels.length) return;

  const st = getScrollTop();
  const root = getActiveScrollRoot();
  const rootRect = (root === document.scrollingElement || root === document.documentElement) ? { top: 0 } : root.getBoundingClientRect();

  const allAnchors = Array.from(contentBox.querySelectorAll('.anchor'));
  const visibleAnchors = allAnchors.filter(a => {
    const panel = a.closest('.panel');
    if(!panel) return false;
    if(!panel.classList.contains('open')) return false;
    return a.offsetParent !== null;
  });

  const currentPanel = panels[currentPanelIndex];
  const headerH = currentPanel ? (currentPanel.querySelector('.panel-header')?.offsetHeight || 0) : 0;
  const offset = Math.max(60, headerH + 12);

  let currentAnchor = null;
  for(let i = 0; i < visibleAnchors.length; i++){
    const a = visibleAnchors[i];
    const aRect = a.getBoundingClientRect();
    const anchorTopRel = (aRect.top - rootRect.top) + st;
    if(anchorTopRel - offset <= st) currentAnchor = a;
    else break;
  }

  if(currentAnchor){
    const subLink = contentsList.querySelector(`a[href="#${currentAnchor.id}"]`);
    if(subLink){ subLink.classList.add('active'); debouncedEnsureNavVisible(subLink); return; }
  }

  const panel = panels[currentPanelIndex];
  if(panel){
    const panelLink = contentsList.querySelector(`a[href="#${panel.id}"]`);
    if(panelLink){ panelLink.classList.add('active'); debouncedEnsureNavVisible(panelLink); }
  }
  
}

/* ---------- Build / Rebuild ---------- */
function rebuildAll(){
  panels = getPanels();
  panels.forEach((p,i)=> p.dataset.index = i);
  buildContents();
  panels.forEach(setPanelCaret);
  if(!panels.some(p=>p.classList.contains('open')) && panels[0]) panels[0].classList.add('open');
  currentPanelIndex = panels.findIndex(p=>p.classList.contains('open'));
  if(currentPanelIndex === -1) currentPanelIndex = 0;
  updateActivePanel(currentPanelIndex);
  updatePageNavStates();
  updateActiveLinks();
}
const debouncedRebuildAll = debounce(rebuildAll, 140);
rebuildAll();

const obs = new MutationObserver(()=>{ const newPanels = getPanels(); if(newPanels.length !== panels.length || newPanels.some((p,i)=>p.id !== panels[i]?.id)) rebuildAll(); });
if(contentBox) obs.observe(contentBox, { childList:true, subtree:true });

/* ---------- Left nav behaviour (disable current page + parent toggle) ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  const currentFile = basename(window.location.pathname) || '';
  // mark the current page link in the left nav but DO NOT remove href (I need it for sequence)
  document.querySelectorAll('.chap-link, .sub-list a, .chap-list a').forEach(a=>{
    const hrefAttr = a.getAttribute('href') || '';
    const hrefBase = basename(hrefAttr);
    if(hrefBase === currentFile){
      a.classList.add('disabled');
      // keep the href attribute so builders/resolvers can read it, but prevent navigation
      a.setAttribute('aria-current','page');
      // ensure I don't add duplicate handlers
      if(!a._guide_disabled_handler_added){
        a.addEventListener('click', function(e){
          // prevent navigating to the same page
          e.preventDefault();
          // optionally focus or open the page's panel instead of navigating
          // (find corresponding panel by id if I want to scroll into view)
        });
        a._guide_disabled_handler_added = true;
      }
      const parentLi = a.closest('.chap-item');
      if(parentLi) parentLi.classList.add('active');
    }
  });

  // parent toggle for Mod List (vertical collapse)
  const parent = document.getElementById('modListParent');
  if(parent){
    const header = parent.querySelector('.parent-header');
    const btn = parent.querySelector('.tog');
    const toggle = (ev) => {
      ev && ev.preventDefault();
      parent.classList.toggle('open');
      const isOpen = parent.classList.contains('open');
      parent.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if(btn) btn.textContent = isOpen ? '▾' : '▸';
      debouncedRebuildAll();
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (ev)=>{ if(ev.key === 'Enter' || ev.key === ' ') { toggle(ev); }});
  }

  updatePageNavStates();
  // initial link highlighting & scroll alignment
  handleContentScroll();

  if(location.hash){
    setTimeout(()=>{ window.dispatchEvent(new Event('hashchange')); }, 60);
  }
});

/* ---------- updateActivePanel ---------- */
function updateActivePanel(index){
  panels = getPanels();
  currentPanelIndex = (typeof index === 'number' && index >= 0 && index < panels.length) ? index : currentPanelIndex;
  if(contentsList) contentsList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
  updatePageNavStates();
}

/* ---------- Expand/Close ---------- */
function expandAllPanels(){
  getPanels().forEach(p => { if(!p.classList.contains('open')){ p.classList.add('open'); setPanelCaret(p); }});
  const firstOpen = getPanels().findIndex(p=>p.classList.contains('open'));
  updateActivePanel(firstOpen >= 0 ? firstOpen : 0);
  updateActiveLinks();
}
function closeAllPanels(){
  getPanels().forEach(p => { p.classList.remove('open'); setPanelCaret(p); });
  updateActivePanel(0);
  updateActiveLinks();
}
expandAllBtn && expandAllBtn.addEventListener('click', (e)=>{ e.preventDefault(); expandAllPanels(); });
closeAllBtn && closeAllBtn.addEventListener('click', (e)=>{ e.preventDefault(); closeAllPanels(); });

/* ---------- Extras (universal toggles) ---------- */
document.querySelectorAll('[id^="toggleTextureImgBtn"]').forEach(btn => {
  const idSuffix = btn.id.replace('toggleTextureImgBtn', '');
  const wrap = document.getElementById(`textureImgWrap${idSuffix}`);
  if(!wrap) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = wrap.classList.toggle('open');
    wrap.setAttribute('aria-hidden', !isOpen);
    btn.textContent = isOpen ? 'Close' : 'Open/Close';
  });
});

/* ---------- Debug helpers ---------- */
window.__STEP = {
  getPanels,
  openPanel,
  goToPanel: (i)=> openPanel(i, true, null, { closeOthers:true, scrollOnOpen:true }),
  rebuildAll,
  setBackground,
  expandAllPanels,
  closeAllPanels,
  updateActiveLinks,
  buildLeftNavSequence,
  findCurrentNavIndex
};

/* initial */
rebuildAll();

// -------------------- Informational carousel (stable live-sync, race-hardened) --------------------
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const CAROUSEL_SELECTOR = '.informational-carousel';
    const carousels = Array.from(document.querySelectorAll(CAROUSEL_SELECTOR));
    if (!carousels.length) return;

    // one capture-phase interceptor to ensure per-carousel LB handles clicks first
    if (!window._mwbc_carousel_click_interceptor_added) {
      window._mwbc_carousel_click_interceptor_added = true;
      document.addEventListener('click', (ev) => {
        const a = ev.target.closest && ev.target.closest('.informational-carousel a.glightbox');
        if (!a) return;
        const carousel = a.closest('.informational-carousel');
        if (!carousel) return;

        const anchors = Array.from(carousel.querySelectorAll('a.glightbox'));
        const i = anchors.indexOf(a);
        if (i === -1) return;

        const lb = carousel._mwbc_lb;
        if (lb && typeof lb.openAt === 'function') {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          try { lb.openAt(i); } catch (err) { try { lb.open(); setTimeout(()=> lb.goTo && lb.goTo(i), 40); } catch(e){} }
          return;
        }

        // if no stored instance, build a temporary GLightbox from DOM order and open it
        if (typeof GLightbox === 'function') {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          try {
            const elements = anchors.map(a2 => ({
              href: a2.href,
              type: 'image',
              title: a2.dataset.title || '',
              description: a2.dataset.description || ''
            }));
            const tempLb = GLightbox({ elements, touchNavigation:true, loop:false, zoomable:true });
            carousel._mwbc_lb = tempLb;
            // bind slide -> update track (minimal)
            try {
              tempLb.on && tempLb.on('slide_after_load', (payload) => {
                const si = (payload && typeof payload.slideIndex === 'number') ? payload.slideIndex :
                  (typeof tempLb.getActiveSlideIndex === 'function' ? tempLb.getActiveSlideIndex() : null);
                if (si !== null && typeof si === 'number') {
                  const track = carousel.querySelector('.infc-track');
                  if (track) track.style.transform = `translateX(-${si * 100}%)`;
                }
              });
            } catch (e) {}
            tempLb.openAt(i);
          } catch (err) {
            // give up quietly and allow default behavior if GLightbox not present
          }
        }
      }, true); // capture
    }

    carousels.forEach((carousel, cIndex) => {
      const track = carousel.querySelector('.infc-track');
      const slides = Array.from(carousel.querySelectorAll('.infc-item'));
      if (!track || slides.length === 0) return;

      // controls / DOM refs
      let prev = carousel.querySelector('.infc-prev');
      let next = carousel.querySelector('.infc-next');
      let viewport = carousel.querySelector('.infc-viewport');
      let dotsWrap = carousel.querySelector('.infc-dots');

      // create missing nodes defensively
      if (!dotsWrap) { dotsWrap = document.createElement('div'); dotsWrap.className = 'infc-dots'; }
      if (!prev) { prev = document.createElement('button'); prev.className = 'infc-arrow infc-prev'; prev.type = 'button'; prev.innerHTML = '‹'; carousel.prepend(prev); }
      if (!next) { next = document.createElement('button'); next.className = 'infc-arrow infc-next'; next.type = 'button'; next.innerHTML = '›'; carousel.appendChild(next); }

      // ensure controls row
      let controls = carousel.querySelector('.infc-controls');
      if (!controls) {
        controls = document.createElement('div'); controls.className = 'infc-controls';
        if (viewport && viewport.parentNode) viewport.parentNode.insertBefore(controls, viewport.nextSibling);
        else carousel.appendChild(controls);
      }
      // move into controls idempotently
      if (controls !== prev.parentNode) controls.appendChild(prev);
      if (controls !== dotsWrap.parentNode) controls.appendChild(dotsWrap);
      if (controls !== next.parentNode) controls.appendChild(next);

      // state
      let idx = 0;
      let lightboxInstance = null;
      let lightboxOpen = false;
      let lastRequestedOpenIndex = null; // set when we call openAt/open programmatically
      let isSyncingFromLightbox = false; // guard to avoid feedback loop
      const anchors = Array.from(carousel.querySelectorAll('a.glightbox'));
      const galleryName = `mwbc-carousel-${cIndex}`;

      // normalize anchors (ensures ordered elements if GLightbox uses elements later)
      anchors.forEach(a => a.setAttribute('data-gallery', galleryName));

      // build dots fresh
      dotsWrap.innerHTML = '';
      slides.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.index = i;
        b.setAttribute('aria-label', `Go to step ${i + 1}`);
        if (i === 0) b.setAttribute('aria-current', 'true');
        // handler
        const handler = () => { idx = i; update(); };
        b._mwbc_click = handler;
        b.addEventListener('click', handler);
        dotsWrap.appendChild(b);
      });

      // bind arrows once
      function bindArrow(btn, dir) {
        if (!btn) return;
        if (btn._mwbc_bound) return;
        const fn = () => {
          if (dir === 'prev' && idx > 0) { idx -= 1; update(); }
          else if (dir === 'next' && idx < slides.length - 1) { idx += 1; update(); }
        };
        btn.addEventListener('click', fn);
        btn._mwbc_bound = true;
        btn._mwbc_fn = fn;
        // blur helpers
        btn.addEventListener('pointerup', () => setTimeout(() => btn.blur(), 10));
        btn.addEventListener('pointercancel', () => btn.blur());
      }
      bindArrow(prev, 'prev');
      bindArrow(next, 'next');

      // keyboard nav for viewport — IGNORE when lightbox is open
      if (viewport && !viewport._mwbc_kbd) {
        viewport.addEventListener('keydown', (ev) => {
          if (lightboxOpen) return; // prevent double handling when modal has focus
          if (ev.key === 'ArrowLeft') { ev.preventDefault(); prev.click(); }
          if (ev.key === 'ArrowRight') { ev.preventDefault(); next.click(); }
        });
        viewport._mwbc_kbd = true;
      }

      // touch swipe
      if (viewport && !viewport._mwbc_touch) {
        let startX = null;
        let isTouch = false;
        viewport.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isTouch = true; }, { passive: true });
        viewport.addEventListener('touchmove', (e) => {
          if (!isTouch) return;
          const dx = e.touches[0].clientX - startX;
          track.style.transition = 'none';
          track.style.transform = `translateX(calc(-${idx * 100}% + ${dx}px))`;
        }, { passive: true });
        viewport.addEventListener('touchend', (e) => {
          isTouch = false;
          const dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 60) {
            if (dx < 0 && idx < slides.length - 1) next.click();
            else if (dx > 0 && idx > 0) prev.click();
          } else update();
          startX = null;
        });
        viewport._mwbc_touch = true;
      }

      // visual update
      function update(animate = true) {
        track.style.transition = animate ? 'transform 420ms cubic-bezier(.2,.9,.2,1)' : 'none';
        track.style.transform = `translateX(-${idx * 100}%)`;

        Array.from(dotsWrap.children).forEach((d, i) => {
          if (i === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });

        // arrows enable/disable
        if (idx <= 0) {
          prev.setAttribute('disabled', ''); prev.classList.add('infc-disabled'); prev.setAttribute('aria-disabled', 'true');
        } else {
          prev.removeAttribute('disabled'); prev.classList.remove('infc-disabled'); prev.removeAttribute('aria-disabled');
        }
        if (idx >= slides.length - 1) {
          next.setAttribute('disabled', ''); next.classList.add('infc-disabled'); next.setAttribute('aria-disabled', 'true');
        } else {
          next.removeAttribute('disabled'); next.classList.remove('infc-disabled'); next.removeAttribute('aria-disabled');
        }

        if (viewport) viewport.setAttribute('aria-label', `Step ${idx + 1} of ${slides.length}`);

        // push to lightbox if open and we're not currently syncing from it
        if (!isSyncingFromLightbox) safeLightboxGoTo(idx);
      }

      // safe push to LB
      function safeLightboxGoTo(n) {
        if (!lightboxOpen || !lightboxInstance) return;
        // avoid pushing if we just requested this open (debounce)
        if (lastRequestedOpenIndex !== null && lastRequestedOpenIndex === n) return;
        try {
          if (typeof lightboxInstance.getActiveSlideIndex === 'function') {
            const active = lightboxInstance.getActiveSlideIndex();
            if (typeof active === 'number' && active === n) return;
          }
          if (typeof lightboxInstance.goToSlide === 'function') lightboxInstance.goToSlide(n);
          else if (typeof lightboxInstance.goTo === 'function') lightboxInstance.goTo(n);
          else if (typeof lightboxInstance.openAt === 'function') lightboxInstance.openAt(n);
        } catch (err) { /* ignore timing errors */ }
      }

      // GLightbox init + robust binding
      function tryInitLightbox() {
        try {
          if (typeof GLightbox !== 'function') throw new Error('GLightbox missing');

          const elements = anchors.map(a => ({
            href: a.href,
            type: 'image',
            title: a.dataset.title || '',
            description: a.dataset.description || ''
          }));

          lightboxInstance = GLightbox({ elements, touchNavigation:true, loop:false, zoomable:true });
          try { carousel._mwbc_lb = lightboxInstance; } catch (e) {}

          // attach click handlers (explicit openAt) and remove old if present
          anchors.forEach((a, i) => {
            if (a._mwbc_click) a.removeEventListener('click', a._mwbc_click);
            const handler = (ev) => {
              ev.preventDefault();
              // remember we explicitly requested this open so we avoid pushing the same index back
              lastRequestedOpenIndex = i;
              setTimeout(()=> lastRequestedOpenIndex = null, 500); // short window to cover init
              try {
                if (lightboxInstance && typeof lightboxInstance.openAt === 'function') lightboxInstance.openAt(i);
                else if (lightboxInstance && typeof lightboxInstance.goTo === 'function') lightboxInstance.goTo(i);
                else { lightboxInstance.open && lightboxInstance.open(); setTimeout(()=> lightboxInstance.goTo && lightboxInstance.goTo(i), 50); }
              } catch (err) { console.error('[guide.js] lightbox open error', err); }
            };
            a.addEventListener('click', handler);
            a._mwbc_click = handler;
          });

          bindLightboxSync();
        } catch (err) {
          // retry shortly if GLightbox isn't present yet
          setTimeout(() => { try { if (typeof GLightbox === 'function') tryInitLightbox(); } catch (e) {} }, 250);
        }
      }

      function bindLightboxSync() {
        if (!lightboxInstance || typeof lightboxInstance.on !== 'function') return;
        if (lightboxInstance._mwbc_bound) return;
        lightboxInstance._mwbc_bound = true;
        try { carousel._mwbc_lb = lightboxInstance; } catch (e) {}

        // helper to extract index from different payload shapes
        const extractIndex = (payload) => {
          if (payload === null || payload === undefined) return null;
          if (typeof payload === 'number') return payload;
          if (typeof payload === 'object') {
            if (typeof payload.slideIndex === 'number') return payload.slideIndex;
            if (typeof payload.index === 'number') return payload.index;
            if (payload.current && typeof payload.current.index === 'number') return payload.current.index;
          }
          try {
            if (typeof lightboxInstance.getActiveSlideIndex === 'function') {
              const gi = lightboxInstance.getActiveSlideIndex();
              if (typeof gi === 'number') return gi;
            }
          } catch (e) {}
          return null;
        };

        // mark open/close state (do NOT force openAt here — it caused races)
        lightboxInstance.on('open', () => { lightboxOpen = true; /* don't call openAt here */ });

        // slide event -> update page (guarded)
        const onSlide = (payload) => {
          const si = extractIndex(payload);
          if (si === null) return;
          if (si !== idx) {
            isSyncingFromLightbox = true;
            idx = si;
            update();
            // small debounce before allowing page -> LB pushes again
            setTimeout(() => { isSyncingFromLightbox = false; }, 80);
          }
        };

        // try several event names to be compatible
        try { lightboxInstance.on('slide_after_load', onSlide); } catch (e) {}
        try { lightboxInstance.on('slide_changed', onSlide); } catch (e) {}
        try { lightboxInstance.on('slide_before_change', onSlide); } catch (e) {}

        lightboxInstance.on('close', () => {
          lightboxOpen = false;
          lastRequestedOpenIndex = null;
          isSyncingFromLightbox = false;
          try { if (viewport) viewport.focus(); } catch (e) {}
        });
      }

      tryInitLightbox();
      // initial render
      update(false);
    }); // end per-carousel foreach
  }); // end DOMContentLoaded
})(); // end iife
