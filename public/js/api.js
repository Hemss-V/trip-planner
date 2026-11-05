/**
 * Roamly - API Client & Utility Functions
 * Pure Vanilla JavaScript Fetch API
 */

const API_BASE = '/api';

// Fallback images in case Unsplash or network fails
const FALLBACK_IMAGES = {
  package: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
  destination: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80'
};

/**
 * Currency Formatter for Indian Rupee (₹)
 */
function formatINR(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

/**
 * Format date string (YYYY-MM-DD) into readable format (e.g., "Nov 15, 2026")
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Image error fallback handler
 */
function handleImageError(imgEl, type = 'package') {
  imgEl.onerror = null; // Prevent infinite loop
  imgEl.src = FALLBACK_IMAGES[type] || FALLBACK_IMAGES.package;
}

/**
 * Fetch all active destinations
 */
async function fetchDestinations() {
  try {
    const res = await fetch(`${API_BASE}/destinations`);
    if (!res.ok) {
      throw new Error(`Failed to fetch destinations (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('API Error in fetchDestinations:', err);
    throw err;
  }
}

/**
 * Fetch a single destination with its packages
 */
async function fetchDestinationById(id) {
  try {
    const res = await fetch(`${API_BASE}/destinations/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch destination details (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.error(`API Error in fetchDestinationById(${id}):`, err);
    throw err;
  }
}

/**
 * Fetch all active categories
 */
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) {
      throw new Error(`Failed to fetch categories (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('API Error in fetchCategories:', err);
    throw err;
  }
}

/**
 * Fetch tour packages with search, filtering, and sorting parameters
 * @param {Object} filters
 */
async function fetchPackages(filters = {}) {
  try {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search.trim());
    if (filters.destination) params.append('destination', filters.destination);
    if (filters.category) params.append('category', filters.category);
    if (filters.minPrice !== undefined && filters.minPrice !== '' && !isNaN(filters.minPrice)) {
      params.append('minPrice', filters.minPrice);
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== '' && !isNaN(filters.maxPrice)) {
      params.append('maxPrice', filters.maxPrice);
    }
    if (filters.minDuration !== undefined && filters.minDuration !== '' && !isNaN(filters.minDuration)) {
      params.append('minDuration', filters.minDuration);
    }
    if (filters.maxDuration !== undefined && filters.maxDuration !== '' && !isNaN(filters.maxDuration)) {
      params.append('maxDuration', filters.maxDuration);
    }
    if (filters.date) params.append('date', filters.date);
    if (filters.sort) params.append('sort', filters.sort);

    const queryString = params.toString();
    const url = `${API_BASE}/packages${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch packages (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('API Error in fetchPackages:', err);
    throw err;
  }
}

/**
 * Fetch a single package by ID (including full itinerary and availability)
 */
async function fetchPackageById(id) {
  try {
    const res = await fetch(`${API_BASE}/packages/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch tour package details (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.error(`API Error in fetchPackageById(${id}):`, err);
    throw err;
  }
}

/* ==========================================================================
 * Member 1: Session, Auth & Dynamic Header
 * --------------------------------------------------------------------------
 * The server keeps the session in an HttpOnly cookie (roamly_session).
 * localStorage['roamly_user'] caches the public user profile so every page
 * can render the header instantly; it is re-validated against /api/auth/me.
 * ========================================================================== */

const ROLE_META = {
  CUSTOMER:    { label: 'Customer',    icon: '👤', dashboard: '/customer/customer-dashboard.html' },
  PROVIDER:    { label: 'Provider',    icon: '🏢', dashboard: '/provider/dashboard.html' },
  ADMIN:       { label: 'Admin',       icon: '🛡️', dashboard: '/admin/dashboard.html' },
  SUPER_ADMIN: { label: 'Super Admin', icon: '⚡', dashboard: '/superadmin/dashboard.html' }
};

/**
 * JSON fetch helper. Throws an Error carrying the server's message and status.
 */
async function apiRequest(method, path, body) {
  const options = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, options);
  let json = {};
  try { json = await res.json(); } catch (e) { /* non-JSON response */ }
  if (!res.ok || json.success === false) {
    const err = new Error(json.message || (json.error && json.error.message) || `Request failed (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Escape text before inserting it into HTML templates. */
function escapeHTML(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const RoamlySession = {
  STORAGE_KEY: 'roamly_user',

  getUser() {
    try {
      const u = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
      return u && u.user_id ? u : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    const { token, ...safe } = user || {}; // never persist the raw token
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safe));
    if (safe.role === 'PROVIDER') localStorage.setItem('roamly_provider_id', safe.user_id);
    RoamlyWishlist.adoptGuestItems();
    renderSessionHeader();
  },

  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('roamly_provider_id');
    renderSessionHeader();
  },

  dashboardFor(role) {
    return (ROLE_META[role] && ROLE_META[role].dashboard) || '/';
  },

  /** Ask the server who is signed in. Returns the user, or null when signed out. */
  async refresh() {
    try {
      const json = await apiRequest('GET', '/auth/me');
      this.setUser(json.data);
      return json.data;
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        this.clear();
        return null;
      }
      return this.getUser(); // network/server hiccup: keep cached state
    }
  },

  async logout(redirectTo = '/login.html') {
    try {
      await apiRequest('POST', '/auth/logout');
    } catch (e) {
      // Still clear locally even if the server is unreachable.
    }
    this.clear();
    if (redirectTo) window.location.href = redirectTo;
  },

  /**
   * Guard for role-restricted pages. Redirects to login (with ?next=) when
   * nobody is signed in, or to the user's own dashboard on a role mismatch.
   */
  async requireRole(roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    const user = await this.refresh();
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?next=${next}`);
      return null;
    }
    if (allowed.length && !allowed.includes(user.role)) {
      window.location.replace(this.dashboardFor(user.role));
      return null;
    }
    return user;
  }
};

/** Per-user saved packages (wishlist), stored in the browser. */
const RoamlyWishlist = {
  key() {
    const u = RoamlySession.getUser();
    return `roamly_wishlist_${u ? u.user_id : 'guest'}`;
  },
  all() {
    try { return JSON.parse(localStorage.getItem(this.key()) || '[]'); } catch (e) { return []; }
  },
  has(packageId) {
    return this.all().some((p) => String(p.package_id) === String(packageId));
  },
  /** Adds or removes a package. Returns true when the package is now saved. */
  toggle(pkg) {
    const list = this.all();
    const idx = list.findIndex((p) => String(p.package_id) === String(pkg.package_id));
    if (idx > -1) {
      list.splice(idx, 1);
    } else {
      list.unshift({
        package_id: pkg.package_id,
        title: pkg.title,
        price: Number(pkg.price !== undefined ? pkg.price : pkg.price_per_person),
        duration_days: pkg.duration_days,
        image: pkg.image || '',
        destination_name: pkg.destination_name || '',
        saved_at: new Date().toISOString()
      });
    }
    localStorage.setItem(this.key(), JSON.stringify(list.slice(0, 50)));
    return idx === -1;
  },
  /** Move packages saved while signed out into the signed-in user's list. */
  adoptGuestItems() {
    const guestKey = 'roamly_wishlist_guest';
    let guest = [];
    try { guest = JSON.parse(localStorage.getItem(guestKey) || '[]'); } catch (e) { /* ignore */ }
    if (!guest.length || this.key() === guestKey) return;
    const mine = this.all();
    const ids = new Set(mine.map((p) => String(p.package_id)));
    const merged = guest.filter((p) => !ids.has(String(p.package_id))).concat(mine).slice(0, 50);
    localStorage.setItem(this.key(), JSON.stringify(merged));
    localStorage.removeItem(guestKey);
  }
};

/**
 * Inject the signed-in user's chip (name, role badge, dashboard shortcut,
 * sign out) into the page header's .nav-actions area.
 */
function renderSessionHeader() {
  const actions = document.querySelector('.site-header .nav-actions');
  if (!actions) return;

  const existing = actions.querySelector('.session-widget');
  if (existing) existing.remove();

  const guestLinks = actions.querySelectorAll('a[href$="login.html"], a[href$="register.html"]');
  const user = RoamlySession.getUser();

  if (!user) {
    guestLinks.forEach((a) => { a.hidden = false; });
    return;
  }
  guestLinks.forEach((a) => { a.hidden = true; });

  const meta = ROLE_META[user.role] || { label: user.role, icon: '👤', dashboard: '/' };
  const firstName = String(user.name || 'Traveler').split(' ')[0];
  const initials = String(user.name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const profileHref = user.role === 'CUSTOMER' ? '/customer/profile.html' : meta.dashboard;

  const widget = document.createElement('div');
  widget.className = 'session-widget';
  widget.innerHTML = `
    <a class="session-chip" href="${profileHref}" title="${escapeHTML(user.name)} (${escapeHTML(user.email || '')})">
      <span class="session-avatar">${escapeHTML(initials)}</span>
      <span class="session-name">${escapeHTML(firstName)}</span>
      <span class="session-role-badge role-${escapeHTML(String(user.role).toLowerCase())}">${meta.icon} ${escapeHTML(meta.label)}</span>
    </a>
    <a class="btn btn-primary btn-sm session-dashboard-btn" href="${meta.dashboard}">Dashboard</a>
    <button type="button" class="btn btn-outline btn-sm session-signout-btn">Sign Out</button>
  `;
  widget.querySelector('.session-signout-btn').addEventListener('click', () => RoamlySession.logout());

  const mobileBtn = actions.querySelector('.mobile-menu-btn');
  actions.insertBefore(widget, mobileBtn || null);
}

document.addEventListener('DOMContentLoaded', () => {
  renderSessionHeader();
  // Re-validate the cached session in the background (no request for guests).
  if (RoamlySession.getUser()) RoamlySession.refresh();
});
