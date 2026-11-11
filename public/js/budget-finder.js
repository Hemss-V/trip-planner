/**
 * Roamly - Smart Budget-Based Package Finder
 * Live-recalculates as inputs change and calls POST /api/packages/budget-finder.
 */
(function () {
  const $ = (id) => document.getElementById(id);

  const LIMITS = { travelersMin: 1, travelersMax: 20, durationMax: 30, budgetMin: 1000, budgetMax: 10000000 };

  const state = {
    budget: 50000,
    travelers: 2,
    duration: 0, // 0 = any
    flex: true,
    category: '',
    stretch: 20
  };

  let requestSeq = 0;
  let debounceTimer = null;
  let lastResults = null;
  let toastTimer = null;

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2500);
  }

  // ---------------- URL state (shareable searches) ----------------

  function readStateFromURL() {
    const p = new URLSearchParams(window.location.search);
    const num = (k) => Number(p.get(k));
    if (num('budget') >= LIMITS.budgetMin && num('budget') <= LIMITS.budgetMax) state.budget = num('budget');
    if (num('travelers') >= 1 && num('travelers') <= LIMITS.travelersMax) state.travelers = Math.round(num('travelers'));
    if (num('days') >= 0 && num('days') <= LIMITS.durationMax) state.duration = Math.round(num('days'));
    if (p.get('flex') === '0') state.flex = false;
    if (p.get('category')) state.category = p.get('category');
    if (num('stretch') >= 5 && num('stretch') <= 50) state.stretch = num('stretch');
  }

  function writeStateToURL() {
    const p = new URLSearchParams({
      budget: state.budget,
      travelers: state.travelers,
      days: state.duration,
      flex: state.flex ? 1 : 0,
      stretch: state.stretch
    });
    if (state.category) p.set('category', state.category);
    history.replaceState(null, '', `${window.location.pathname}?${p}`);
  }

  // ---------------- Inputs ----------------

  function syncInputs() {
    $('bf-budget-display').textContent = formatINR(state.budget);
    $('bf-budget-range').value = Math.min(Math.max(state.budget, 5000), 300000);
    if (document.activeElement !== $('bf-budget-input')) $('bf-budget-input').value = state.budget;
    $('bf-travelers').textContent = state.travelers;
    $('bf-travelers-minus').disabled = state.travelers <= LIMITS.travelersMin;
    $('bf-travelers-plus').disabled = state.travelers >= LIMITS.travelersMax;
    $('bf-duration').textContent = state.duration ? `${state.duration}` : 'Any';
    $('bf-duration-minus').disabled = state.duration <= 0;
    $('bf-duration-plus').disabled = state.duration >= LIMITS.durationMax;
    $('bf-flex').checked = state.flex;
    $('bf-flex').disabled = !state.duration;
    $('bf-stretch').value = state.stretch;
    $('bf-stretch-display').textContent = `${state.stretch}%`;
    document.querySelectorAll('#bf-vibes .vibe-chip').forEach((chip) => {
      const active = chip.dataset.category === String(state.category);
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    renderBreakdown();
  }

  /** Instant client-side breakdown, so numbers react before the server answers. */
  function renderBreakdown(matches) {
    const perPerson = state.budget / state.travelers;
    $('bd-total').textContent = formatINR(state.budget);
    $('bd-person').textContent = formatINR(perPerson);
    $('bd-day').textContent = state.duration ? formatINR(perPerson / state.duration) : '—';
    if (matches !== undefined) $('bd-matches').textContent = matches;
  }

  function update(changes) {
    Object.assign(state, changes);
    syncInputs();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(search, 300);
  }

  function bindInputs() {
    $('bf-budget-range').addEventListener('input', (e) => update({ budget: Number(e.target.value) }));
    $('bf-budget-input').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (v >= LIMITS.budgetMin && v <= LIMITS.budgetMax) update({ budget: Math.round(v) });
    });
    $('bf-budget-input').addEventListener('blur', syncInputs);
    $('bf-travelers-minus').addEventListener('click', () => update({ travelers: Math.max(LIMITS.travelersMin, state.travelers - 1) }));
    $('bf-travelers-plus').addEventListener('click', () => update({ travelers: Math.min(LIMITS.travelersMax, state.travelers + 1) }));
    $('bf-duration-minus').addEventListener('click', () => update({ duration: Math.max(0, state.duration - 1) }));
    $('bf-duration-plus').addEventListener('click', () => update({ duration: Math.min(LIMITS.durationMax, state.duration + 1) }));
    $('bf-flex').addEventListener('change', (e) => update({ flex: e.target.checked }));
    $('bf-stretch').addEventListener('input', (e) => update({ stretch: Number(e.target.value) }));
    $('bf-vibes').addEventListener('click', (e) => {
      const chip = e.target.closest('.vibe-chip');
      if (chip) update({ category: chip.dataset.category });
    });
    $('bf-form').addEventListener('submit', (e) => e.preventDefault());
  }

  async function loadVibes() {
    try {
      const categories = await fetchCategories();
      const wrap = $('bf-vibes');
      categories.forEach((c) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'vibe-chip';
        chip.dataset.category = String(c.category_id);
        chip.setAttribute('role', 'radio');
        chip.textContent = c.category_name;
        wrap.appendChild(chip);
      });
      syncInputs();
    } catch (e) {
      // Vibe filter just stays at "Any vibe".
    }
  }

  // ---------------- Search & render ----------------

  async function search() {
    const seq = ++requestSeq;
    writeStateToURL();
    $('bf-results-wrap').setAttribute('aria-busy', 'true');
    $('bf-error').hidden = true;
    try {
      const json = await apiRequest('POST', '/packages/budget-finder', {
        budget: state.budget,
        travelers: state.travelers,
        duration_days: state.duration,
        duration_flex: state.flex ? 1 : 0,
        category_id: state.category || null,
        stretch_pct: state.stretch
      });
      if (seq !== requestSeq) return; // a newer search superseded this one
      lastResults = json.data;
      renderResults(json.data);
    } catch (err) {
      if (seq !== requestSeq) return;
      $('bf-error').hidden = false;
      $('bf-error').textContent = err.message;
      $('bf-results').innerHTML = '';
      renderBreakdown('–');
    } finally {
      if (seq === requestSeq) $('bf-results-wrap').setAttribute('aria-busy', 'false');
    }
  }

  function card(p, tier) {
    const saved = RoamlyWishlist.has(p.package_id);
    const meter = Math.min(p.budget_used_pct, 100);
    let callout = '';
    if (tier === 'saver' || tier === 'within') {
      callout = `
        <div class="bf-callout">
          💵 <strong>${formatINR(p.leftover)}</strong> left over
          (${formatINR(p.leftover_per_person)}/person${p.duration_days ? `, ≈ ${formatINR(p.daily_allowance_per_person)}/day` : ''})
          for food, shopping &amp; extras.
        </div>`;
    } else {
      callout = `
        <div class="bf-callout">
          ⬆️ <strong>${formatINR(p.over_by)}</strong> over budget (${formatINR(p.over_by_per_person)}/person)
        </div>
        <ul class="bf-perks">${(p.premium_highlights || []).map((h) => `<li>${escapeHTML(h)}</li>`).join('')}</ul>`;
    }

    const rating = p.avg_rating !== null ? `★ ${p.avg_rating} (${p.review_count})` : 'New';
    const next = p.next_available_date
      ? `Next departure ${formatDate(p.next_available_date)}`
      : 'No open dates for your group yet';

    return `
      <article class="bf-card">
        <div class="bf-card-img">
          <img src="${escapeHTML(p.image || FALLBACK_IMAGES.package)}" alt="${escapeHTML(p.title)}" loading="lazy" onerror="handleImageError(this)">
          <span class="package-pill-category">${escapeHTML(p.category_name)}</span>
          <button type="button" class="bf-save-btn" data-save="${p.package_id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save package'}">${saved ? '❤️' : '🤍'}</button>
        </div>
        <div class="bf-card-body">
          <div class="bf-card-meta">📍 ${escapeHTML(p.destination_name)} · ${p.duration_days} days · ${rating}</div>
          <h3 class="bf-card-title">${escapeHTML(p.title)}</h3>
          <div class="bf-cost-row"><span>${formatINR(p.price_per_person)} × ${state.travelers}</span><strong>${formatINR(p.trip_cost)}</strong></div>
          <div class="bf-meter" title="${p.budget_used_pct}% of your budget"><span style="width:${meter}%"></span></div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${p.budget_used_pct}% of budget · ${escapeHTML(next)}</div>
          ${callout}
          <div class="bf-card-actions">
            <a class="btn btn-outline btn-sm" href="../package-details.html?id=${p.package_id}">Details</a>
            <a class="btn btn-primary btn-sm" href="booking.html?package_id=${p.package_id}">Book</a>
          </div>
        </div>
      </article>`;
  }

  function tierSection(key, title, subtitle, items, cssTier) {
    if (!items.length) return '';
    return `
      <section class="bf-tier tier-${cssTier}" aria-labelledby="tier-${key}">
        <div class="bf-tier-header">
          <div>
            <h2 id="tier-${key}">${title} <span style="color: var(--text-muted); font-size: 0.95rem;">(${items.length})</span></h2>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="bf-results-grid">${items.map((p) => card(p, cssTier)).join('')}</div>
      </section>`;
  }

  function renderResults(data) {
    const { summary, tiers } = data;
    renderBreakdown(summary.total_matches);

    if (summary.total_matches === 0) {
      $('bf-results').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧳</div>
          <h3 class="empty-title">No trips match yet</h3>
          <p class="empty-desc">
            Try raising your budget, reducing travelers, choosing "Any" duration or another vibe.
            Packages also need room for your whole group of ${summary.travelers}.
          </p>
        </div>`;
      return;
    }

    const range = summary.duration_range
      ? ` lasting ${summary.duration_range[0] === summary.duration_range[1] ? summary.duration_range[0] : summary.duration_range.join('–')} days`
      : '';

    $('bf-results').innerHTML =
      tierSection('within', '✅ Within Budget',
        `Trips${range} that use most of your ${formatINR(summary.budget)} for ${summary.travelers} traveler${summary.travelers > 1 ? 's' : ''}.`,
        tiers.within_budget, 'within') +
      tierSection('saver', '💰 Best Value / Budget Saver',
        `Costs ${formatINR(summary.saver_threshold)} or less, leaving at least 20% as pocket allowance.`,
        tiers.budget_saver, 'saver') +
      tierSection('stretch', '✨ Stretch Match',
        `Up to ${summary.stretch_pct}% above budget (max ${formatINR(summary.stretch_ceiling)}) with premium extras.`,
        tiers.stretch_match, 'stretch');
  }

  function bindSaveButtons() {
    $('bf-results').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-save]');
      if (!btn || !lastResults) return;
      const all = [].concat(lastResults.tiers.within_budget, lastResults.tiers.budget_saver, lastResults.tiers.stretch_match);
      const pkg = all.find((p) => String(p.package_id) === btn.dataset.save);
      if (!pkg) return;
      const nowSaved = RoamlyWishlist.toggle(pkg);
      document.querySelectorAll(`[data-save="${pkg.package_id}"]`).forEach((b) => {
        b.textContent = nowSaved ? '❤️' : '🤍';
        b.setAttribute('aria-pressed', String(nowSaved));
        b.setAttribute('aria-label', nowSaved ? 'Remove from saved' : 'Save package');
      });
      toast(nowSaved
        ? (RoamlySession.getUser() ? 'Saved to your dashboard' : 'Saved. Sign in to see it on your dashboard')
        : 'Removed from saved');
    });
  }

  readStateFromURL();
  bindInputs();
  bindSaveButtons();
  syncInputs();
  loadVibes();
  search();
})();
