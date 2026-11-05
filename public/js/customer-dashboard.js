/**
 * Roamly - Customer Home Dashboard (Member 1)
 * Welcome banner, travel stats, upcoming trips, saved packages, quick search.
 */
(function () {
  const $ = (id) => document.getElementById(id);

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function statusClass(status) {
    return { PENDING: 'is-pending', CANCELLED: 'is-cancelled', COMPLETED: 'is-completed' }[status] || '';
  }

  function renderUpcoming(bookings) {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = bookings
      .filter((b) => ['PENDING', 'CONFIRMED'].includes(b.booking_status) && b.available_date >= today)
      .sort((a, b) => a.available_date.localeCompare(b.available_date));

    $('stat-upcoming').textContent = upcoming.length;
    $('stat-total').textContent = bookings.length;
    $('stat-spent').textContent = formatINR(
      bookings.filter((b) => b.booking_status !== 'CANCELLED').reduce((s, b) => s + Number(b.total_amount || 0), 0)
    );

    const list = $('upcoming-list');
    if (upcoming.length === 0) {
      list.innerHTML = `
        <div class="mini-empty">
          No upcoming trips yet.<br>
          <a href="budget-finder.html" class="btn btn-primary btn-sm" style="margin-top: 0.75rem;">Find a trip within budget</a>
        </div>`;
      return;
    }

    list.innerHTML = upcoming.slice(0, 4).map((b) => {
      const days = Math.ceil((new Date(b.available_date) - new Date(today)) / 86400000);
      return `
        <div class="mini-item">
          <img src="${escapeHTML(b.package_image || FALLBACK_IMAGES.package)}" alt="" onerror="handleImageError(this)">
          <div>
            <div class="mini-item-title">${escapeHTML(b.package_title)}</div>
            <div class="mini-item-meta">
              📅 ${formatDate(b.available_date)} · ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}
              · ${b.travelers} traveler${b.travelers > 1 ? 's' : ''}
            </div>
          </div>
          <span class="status-pill ${statusClass(b.booking_status)}">${escapeHTML(b.booking_status)}</span>
        </div>`;
    }).join('');
  }

  function renderWishlist() {
    const saved = RoamlyWishlist.all();
    $('stat-saved').textContent = saved.length;
    const list = $('wishlist-list');

    if (saved.length === 0) {
      list.innerHTML = `
        <div class="mini-empty">
          Nothing saved yet. Tap ♡ on a package in the Budget Finder or on a package page to keep it here.
        </div>`;
      return;
    }

    list.innerHTML = saved.slice(0, 5).map((p) => `
      <div class="mini-item">
        <img src="${escapeHTML(p.image || FALLBACK_IMAGES.package)}" alt="" onerror="handleImageError(this)">
        <div>
          <a class="mini-item-title" href="../package-details.html?id=${encodeURIComponent(p.package_id)}">${escapeHTML(p.title)}</a>
          <div class="mini-item-meta">
            ${escapeHTML(p.destination_name || '')} · ${p.duration_days} days · ${formatINR(p.price)}/person
          </div>
        </div>
        <button type="button" class="link-btn is-danger" data-remove="${escapeHTML(p.package_id)}" aria-label="Remove ${escapeHTML(p.title)} from saved">Remove</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        RoamlyWishlist.toggle({ package_id: btn.dataset.remove });
        renderWishlist();
      });
    });
  }

  async function loadProfileNudge() {
    try {
      const [{ data: profile }, { data: addresses }] = await Promise.all([
        apiRequest('GET', '/customer/profile'),
        apiRequest('GET', '/customer/addresses')
      ]);
      const missing = [];
      if (!profile.mobile) missing.push('a mobile number');
      if (addresses.length === 0) missing.push('a billing address');
      if (missing.length) {
        const nudge = $('profile-nudge');
        nudge.hidden = false;
        nudge.innerHTML = `✨ Complete your profile: add ${missing.join(' and ')} for faster checkout. <a href="profile.html" style="font-weight:700; text-decoration:underline;">Update profile →</a>`;
      }
    } catch (e) {
      // Non-critical.
    }
  }

  async function init() {
    const user = await RoamlySession.requireRole('CUSTOMER');
    if (!user) return;

    $('dashboard-root').hidden = false;
    $('welcome-title').textContent = `${greeting()}, ${user.name.split(' ')[0]}!`;

    $('quick-search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('quick-search-input').value.trim();
      window.location.href = `../packages.html${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    });

    renderWishlist();
    loadProfileNudge();

    try {
      const json = await apiRequest('GET', `/customer/bookings?customer_id=${encodeURIComponent(user.user_id)}`);
      renderUpcoming(json.data || []);
    } catch (err) {
      $('upcoming-list').innerHTML = `<div class="mini-empty">Couldn't load your trips: ${escapeHTML(err.message)}</div>`;
    }
  }

  init();
})();
