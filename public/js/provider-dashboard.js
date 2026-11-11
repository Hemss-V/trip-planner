/**
 * Roamly — Provider Portal Dashboard Controller
 * Pure Vanilla JavaScript DOM manipulation & Fetch API
 */

(function () {
  'use strict';

  // State
  let currentProviderId = null; // Set from session on load
  let allPackages = [];
  let allDestinations = [];
  let allCategories = [];
  let currentStatusFilter = 'all';
  let searchQuery = '';
  let activeAvailabilityPackageId = null;
  let activeItineraryPackageId = null;
  let currentBookingFilter = 'ALL';

  // DOM Elements
  const elements = {
    providerName: document.getElementById('provider-name'),
    providerEmail: document.getElementById('provider-email'),
    providerAvatar: document.getElementById('provider-avatar'),
    providerSelect: document.getElementById('provider-select'),

    // Nav Tabs & Views
    navTabs: document.querySelectorAll('.provider-nav-tab'),
    views: {
      packages: document.getElementById('view-packages'),
      bookings: document.getElementById('view-bookings'),
      requests: document.getElementById('view-requests'),
      reports: document.getElementById('view-reports')
    },
    badgeTotalPackages: document.getElementById('badge-total-packages'),
    badgeTotalBookings: document.getElementById('badge-total-bookings'),
    badgeTotalRequests: document.getElementById('badge-total-requests'),

    // Stats
    statTotal: document.getElementById('stat-total'),
    statApproved: document.getElementById('stat-approved'),
    statPending: document.getElementById('stat-pending'),
    statOther: document.getElementById('stat-other'),

    // Tab Badges
    badgeAll: document.getElementById('tab-count-all'),
    badgeApproved: document.getElementById('tab-count-approved'),
    badgePending: document.getElementById('tab-count-pending'),
    badgeOther: document.getElementById('tab-count-other'),

    // Table & Lists
    packagesTableBody: document.getElementById('packages-table-body'),
    packagesEmptyState: document.getElementById('packages-empty-state'),
    packagesCountDisplay: document.getElementById('packages-count-display'),

    // Search & Filter
    searchInput: document.getElementById('provider-search'),
    statusTabs: document.querySelectorAll('.status-tab-btn'),
    sortSelect: document.getElementById('provider-sort'),
    btnRefresh: document.getElementById('btn-refresh-dashboard'),
    btnOpenCreate: document.getElementById('btn-open-create-modal'),

    // Create Modal
    createModal: document.getElementById('create-package-modal'),
    createForm: document.getElementById('create-package-form'),
    createDestSelect: document.getElementById('create-destination'),
    createCatSelect: document.getElementById('create-category'),
    btnCloseCreate: document.getElementById('btn-close-create-modal'),
    btnCancelCreate: document.getElementById('btn-cancel-create'),

    // Edit Modal
    editModal: document.getElementById('edit-package-modal'),
    editForm: document.getElementById('edit-package-form'),
    editPackageId: document.getElementById('edit-package-id'),
    editTitle: document.getElementById('edit-title'),
    editDestSelect: document.getElementById('edit-destination'),
    editCatSelect: document.getElementById('edit-category'),
    editDuration: document.getElementById('edit-duration'),
    editPrice: document.getElementById('edit-price'),
    editCapacity: document.getElementById('edit-capacity'),
    editImage: document.getElementById('edit-image'),
    editDesc: document.getElementById('edit-desc'),
    btnCloseEdit: document.getElementById('btn-close-edit-modal'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),

    // Availability Modal
    availModal: document.getElementById('availability-modal'),
    availPkgTitle: document.getElementById('avail-modal-package-title'),
    availList: document.getElementById('avail-list-container'),
    availAddForm: document.getElementById('avail-add-form'),
    availDateInput: document.getElementById('avail-new-date'),
    availSeatsInput: document.getElementById('avail-new-seats'),
    btnCloseAvail: document.getElementById('btn-close-avail-modal'),

    // Itinerary Modal
    itinModal: document.getElementById('itinerary-modal'),
    itinPkgTitle: document.getElementById('itin-modal-package-title'),
    itinList: document.getElementById('itinerary-list-container'),
    itinAddForm: document.getElementById('itinerary-add-form'),
    itinDayNo: document.getElementById('itin-day-no'),
    itinDayTitle: document.getElementById('itin-day-title'),
    itinDayDesc: document.getElementById('itin-day-desc'),
    btnCloseItin: document.getElementById('btn-close-itin-modal'),

    // Bookings View Elements
    bookingsTableBody: document.getElementById('bookings-table-body'),
    bookingsEmptyState: document.getElementById('bookings-empty-state'),
    bookingStatusTabs: document.querySelectorAll('#booking-status-tabs .status-tab-btn'),
    btnRefreshBookings: document.getElementById('btn-refresh-bookings'),

    // Custom Requests View Elements
    requestsTableBody: document.getElementById('requests-table-body'),
    requestsEmptyState: document.getElementById('requests-empty-state'),
    btnRefreshRequests: document.getElementById('btn-refresh-requests'),

    // Reports Elements
    reportTotalRevenue: document.getElementById('report-total-revenue'),
    reportCompletedRevenue: document.getElementById('report-completed-revenue'),
    reportConfirmedRevenue: document.getElementById('report-confirmed-revenue'),
    reportTotalTravelers: document.getElementById('report-total-travelers'),
    reportsPackagesTableBody: document.getElementById('reports-packages-table-body'),

    // Toast Container
    toastBox: document.getElementById('provider-toast-box')
  };

  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + Math.round(num).toLocaleString('en-IN');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message, type = 'success') {
    if (!elements.toastBox) return;
    const toast = document.createElement('div');
    toast.className = `provider-toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : '✅'}</span>
      <span>${escapeHTML(message)}</span>
    `;
    elements.toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3500);
  }

  function initCurrentProvider(sessionUser) {
    // Super admin / admin can pass ?provider_id= in URL to view any provider
    const urlParams = new URLSearchParams(window.location.search);
    const qProvider = urlParams.get('provider_id');
    if (qProvider && !isNaN(parseInt(qProvider, 10))) {
      currentProviderId = parseInt(qProvider, 10);
      return;
    }
    // Use the signed-in provider's own ID
    if (sessionUser && sessionUser.user_id) {
      currentProviderId = sessionUser.user_id;
      return;
    }
    // Fallback: check localStorage (set by RoamlySession on login)
    const saved = localStorage.getItem('roamly_provider_id');
    if (saved && !isNaN(parseInt(saved, 10))) {
      currentProviderId = parseInt(saved, 10);
      return;
    }
    currentProviderId = 1;
  }

  async function loadProvidersList() {
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) return;
      const json = await res.json();
      const providers = json.data || [];

      if (elements.providerSelect && providers.length > 0) {
        elements.providerSelect.innerHTML = '';
        providers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.user_id;
          opt.textContent = `${p.name} (#${p.user_id})`;
          if (p.user_id === currentProviderId) {
            opt.selected = true;
          }
          elements.providerSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn('Could not load providers list:', e);
    }
  }

  async function loadFormMetadata() {
    try {
      const [destRes, catRes] = await Promise.all([
        fetch('/api/destinations'),
        fetch('/api/categories')
      ]);

      if (destRes.ok) {
        const destJson = await destRes.json();
        allDestinations = destJson.data || [];
        populateSelect(elements.createDestSelect, allDestinations, 'destination_id', 'name');
        populateSelect(elements.editDestSelect, allDestinations, 'destination_id', 'name');
      }

      if (catRes.ok) {
        const catJson = await catRes.json();
        allCategories = catJson.data || [];
        populateSelect(elements.createCatSelect, allCategories, 'category_id', 'category_name');
        populateSelect(elements.editCatSelect, allCategories, 'category_id', 'category_name');
      }
    } catch (err) {
      console.error('Error loading metadata:', err);
    }
  }

  function populateSelect(selectEl, items, valKey, textKey) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Select option…</option>';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item[valKey];
      opt.textContent = item[textKey];
      selectEl.appendChild(opt);
    });
  }

  // ==========================================
  // VIEW SWITCHER
  // ==========================================
  function switchView(viewName) {
    elements.navTabs.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-view') === viewName);
    });

    Object.keys(elements.views).forEach(key => {
      if (elements.views[key]) {
        elements.views[key].style.display = key === viewName ? 'block' : 'none';
      }
    });

    if (viewName === 'packages') {
      loadDashboardData(currentProviderId);
    } else if (viewName === 'bookings') {
      loadBookingsData();
    } else if (viewName === 'requests') {
      loadCustomRequestsData();
    } else if (viewName === 'reports') {
      loadReportsData();
    }
  }

  // ==========================================
  // 1. PACKAGES VIEW CONTROLLER
  // ==========================================
  async function loadDashboardData(providerId) {
    try {
      const res = await fetch(`/api/provider/dashboard?provider_id=${providerId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data;

      // Update provider identity
      if (data.provider) {
        if (elements.providerName) elements.providerName.textContent = data.provider.name;
        if (elements.providerEmail) elements.providerEmail.textContent = data.provider.email;
        if (elements.providerAvatar) elements.providerAvatar.textContent = (data.provider.name || 'P').charAt(0).toUpperCase();
      }

      // Update stats
      const stats = data.stats || {};
      if (elements.statTotal) elements.statTotal.textContent = stats.total || 0;
      if (elements.statApproved) elements.statApproved.textContent = stats.approved || 0;
      if (elements.statPending) elements.statPending.textContent = stats.pending || 0;
      if (elements.statOther) elements.statOther.textContent = stats.rejected_or_inactive || 0;

      // Update badge counts
      if (elements.badgeAll) elements.badgeAll.textContent = stats.total || 0;
      if (elements.badgeApproved) elements.badgeApproved.textContent = stats.approved || 0;
      if (elements.badgePending) elements.badgePending.textContent = stats.pending || 0;
      if (elements.badgeOther) elements.badgeOther.textContent = stats.rejected_or_inactive || 0;
      if (elements.badgeTotalPackages) elements.badgeTotalPackages.textContent = stats.total || 0;

      allPackages = data.packages || [];
      renderPackagesTable();

      // Also trigger a background check for total bookings & requests badges
      updateNavBadges();
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      showToast('Failed to load provider data.', 'error');
    }
  }

  async function updateNavBadges() {
    try {
      const [bRes, rRes] = await Promise.all([
        fetch(`/api/provider/bookings?provider_id=${currentProviderId}`),
        fetch(`/api/provider/custom-requests?provider_id=${currentProviderId}`)
      ]);
      if (bRes.ok) {
        const bJson = await bRes.json();
        if (elements.badgeTotalBookings) elements.badgeTotalBookings.textContent = (bJson.data || []).length;
      }
      if (rRes.ok) {
        const rJson = await rRes.json();
        if (elements.badgeTotalRequests) elements.badgeTotalRequests.textContent = (rJson.data || []).length;
      }
    } catch (e) {
      // ignore
    }
  }

  function renderPackagesTable() {
    if (!elements.packagesTableBody) return;

    let filtered = allPackages.filter(p => {
      if (currentStatusFilter === 'all') return true;
      if (currentStatusFilter === 'OTHER') {
        return p.status === 'REJECTED' || p.status === 'INACTIVE';
      }
      return p.status === currentStatusFilter;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        return (
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.destination_name && p.destination_name.toLowerCase().includes(q)) ||
          (p.city && p.city.toLowerCase().includes(q))
        );
      });
    }

    // Sort
    const sortVal = elements.sortSelect ? elements.sortSelect.value : 'newest';
    if (sortVal === 'price_asc') {
      filtered.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortVal === 'price_desc') {
      filtered.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortVal === 'duration_asc') {
      filtered.sort((a, b) => Number(a.duration_days) - Number(b.duration_days));
    }

    if (elements.packagesCountDisplay) {
      elements.packagesCountDisplay.textContent = `Showing ${filtered.length} of ${allPackages.length} package(s)`;
    }

    if (filtered.length === 0) {
      elements.packagesTableBody.innerHTML = '';
      if (elements.packagesEmptyState) elements.packagesEmptyState.hidden = false;
      return;
    }

    if (elements.packagesEmptyState) elements.packagesEmptyState.hidden = true;

    elements.packagesTableBody.innerHTML = filtered.map(pkg => {
      let statusBadgeClass = 'badge-pending';
      let statusLabel = 'Pending Review';
      if (pkg.status === 'APPROVED') {
        statusBadgeClass = 'badge-approved';
        statusLabel = 'Published';
      } else if (pkg.status === 'INACTIVE') {
        statusBadgeClass = 'badge-inactive';
        statusLabel = 'Paused';
      } else if (pkg.status === 'REJECTED') {
        statusBadgeClass = 'badge-rejected';
        statusLabel = 'Rejected';
      }

      const imgUrl = pkg.image || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';
      const itinCount = Number(pkg.itinerary_count) || 0;
      const availCount = Number(pkg.upcoming_availability_count) || 0;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <img src="${escapeHTML(imgUrl)}" alt="" style="width: 52px; height: 52px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-card);" onerror="this.src='https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80'">
              <div>
                <a href="../package-details.html?id=${pkg.package_id}" target="_blank" style="font-weight: 700; color: var(--primary); text-decoration: underline;" title="View public tour page">
                  ${escapeHTML(pkg.title)}
                </a>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
                  ${pkg.duration_days} Days / ${pkg.duration_days - 1} Nights • Max ${pkg.capacity} Pax
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHTML(pkg.destination_name || 'Destination')}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(pkg.state || '')}</div>
          </td>
          <td>
            <span style="display: inline-block; background: var(--bg-surface-soft); padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.82rem; font-weight: 600;">
              ${escapeHTML(pkg.category_name || 'General')}
            </span>
          </td>
          <td style="font-weight: 700; color: var(--primary);">
            ${formatINR(pkg.price)}
          </td>
          <td>
            <button type="button" class="action-icon-btn" data-action="manage-itin" data-package-id="${pkg.package_id}" data-package-title="${escapeHTML(pkg.title)}">
              🗺️ ${itinCount} Day${itinCount !== 1 ? 's' : ''}
            </button>
          </td>
          <td>
            <button type="button" class="action-icon-btn" data-action="manage-avail" data-package-id="${pkg.package_id}" data-package-title="${escapeHTML(pkg.title)}">
              🗓️ ${availCount} Date${availCount !== 1 ? 's' : ''}
            </button>
          </td>
          <td>
            <span class="provider-status-badge ${statusBadgeClass}">
              ${statusLabel}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button type="button" class="action-icon-btn" data-action="edit-pkg" data-package-id="${pkg.package_id}" title="Edit Tour Package">
                ✏️ Edit
              </button>
              <button type="button" class="action-icon-btn" data-action="toggle-status" data-package-id="${pkg.package_id}" data-current-status="${pkg.status}" title="Toggle Published / Paused">
                ${pkg.status === 'APPROVED' ? '⏸️' : '▶️'}
              </button>
              <button type="button" class="action-icon-btn action-btn-danger" data-action="delete-pkg" data-package-id="${pkg.package_id}" data-package-title="${escapeHTML(pkg.title)}" title="Delete Package">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachTableActionListeners();
  }

  function attachTableActionListeners() {
    // Availability
    elements.packagesTableBody.querySelectorAll('[data-action="manage-avail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        openAvailabilityModal(btn.getAttribute('data-package-id'), btn.getAttribute('data-package-title'));
      });
    });

    // Itinerary
    elements.packagesTableBody.querySelectorAll('[data-action="manage-itin"]').forEach(btn => {
      btn.addEventListener('click', () => {
        openItineraryModal(btn.getAttribute('data-package-id'), btn.getAttribute('data-package-title'));
      });
    });

    // Edit
    elements.packagesTableBody.querySelectorAll('[data-action="edit-pkg"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pkgId = parseInt(btn.getAttribute('data-package-id'), 10);
        const pkg = allPackages.find(p => p.package_id === pkgId);
        if (pkg) openEditModal(pkg);
      });
    });

    // Status Toggle
    elements.packagesTableBody.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const packageId = btn.getAttribute('data-package-id');
        const currentStatus = btn.getAttribute('data-current-status');
        const newStatus = currentStatus === 'APPROVED' ? 'INACTIVE' : 'APPROVED';

        try {
          const res = await fetch(`/api/provider/packages/${packageId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Status update failed');
          showToast(`Package status updated to ${newStatus}.`);
          loadDashboardData(currentProviderId);
        } catch (err) {
          showToast('Failed to update status: ' + err.message, 'error');
        }
      });
    });

    // Delete Package
    elements.packagesTableBody.querySelectorAll('[data-action="delete-pkg"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const packageId = btn.getAttribute('data-package-id');
        const title = btn.getAttribute('data-package-title');

        if (!confirm(`Are you sure you want to delete "${title}"? If it has existing bookings, it will be safely archived instead.`)) {
          return;
        }

        try {
          const res = await fetch(`/api/provider/packages/${packageId}?provider_id=${currentProviderId}`, {
            method: 'DELETE'
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ? json.error.message : 'Delete failed');

          showToast(json.message || 'Package processed successfully.');
          loadDashboardData(currentProviderId);
        } catch (err) {
          showToast('Failed to delete package: ' + err.message, 'error');
        }
      });
    });
  }

  // ==========================================
  // EDIT PACKAGE MODAL CONTROLLER
  // ==========================================
  function openEditModal(pkg) {
    if (!elements.editModal) return;
    elements.editPackageId.value = pkg.package_id;
    elements.editTitle.value = pkg.title;
    elements.editDestSelect.value = pkg.destination_id;
    elements.editCatSelect.value = pkg.category_id;
    elements.editDuration.value = pkg.duration_days;
    elements.editPrice.value = Math.round(Number(pkg.price));
    elements.editCapacity.value = pkg.capacity;
    elements.editImage.value = pkg.image || '';
    elements.editDesc.value = pkg.description || '';

    elements.editModal.classList.add('is-open');
  }

  function closeEditModal() {
    if (elements.editModal) elements.editModal.classList.remove('is-open');
  }

  async function handleEditPackageSubmit(e) {
    e.preventDefault();
    const pkgId = elements.editPackageId.value;

    const payload = {
      provider_id: currentProviderId,
      title: elements.editTitle.value.trim(),
      destination_id: elements.editDestSelect.value,
      category_id: elements.editCatSelect.value,
      duration_days: parseInt(elements.editDuration.value, 10),
      price: parseFloat(elements.editPrice.value),
      capacity: parseInt(elements.editCapacity.value, 10),
      image: elements.editImage.value.trim(),
      description: elements.editDesc.value.trim()
    };

    try {
      const res = await fetch(`/api/provider/packages/${pkgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Update failed');

      showToast('Tour package updated successfully!');
      closeEditModal();
      loadDashboardData(currentProviderId);
    } catch (err) {
      showToast('Failed to update package: ' + err.message, 'error');
    }
  }

  // ==========================================
  // ITINERARY MODAL CONTROLLER
  // ==========================================
  async function openItineraryModal(packageId, packageTitle) {
    activeItineraryPackageId = packageId;
    if (elements.itinPkgTitle) elements.itinPkgTitle.textContent = packageTitle || `Package #${packageId}`;
    if (elements.itinModal) elements.itinModal.classList.add('is-open');
    await loadPackageItinerary(packageId);
  }

  function closeItineraryModal() {
    activeItineraryPackageId = null;
    if (elements.itinModal) elements.itinModal.classList.remove('is-open');
  }

  async function loadPackageItinerary(packageId) {
    if (!elements.itinList) return;
    elements.itinList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem;">Loading day-by-day itinerary…</p>';

    try {
      const res = await fetch(`/api/provider/packages/${packageId}/itinerary`);
      if (!res.ok) throw new Error('Failed to load itinerary');
      const json = await res.json();
      const items = json.data || [];

      if (items.length === 0) {
        elements.itinList.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; background: var(--bg-surface-soft); border-radius: 8px;">
            <p style="color: var(--text-muted); font-size: 0.88rem;">No itinerary days added yet. Use the form below to add Day 1 activities.</p>
          </div>
        `;
        if (elements.itinDayNo) elements.itinDayNo.value = 1;
        return;
      }

      elements.itinList.innerHTML = items.map(item => `
        <div class="itinerary-day-card">
          <div>
            <div style="font-weight: 700; color: var(--primary); font-size: 0.92rem;">
              Day ${item.day_no}: ${escapeHTML(item.title)}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem; white-space: pre-line;">
              ${escapeHTML(item.description || 'No detailed activity description provided.')}
            </div>
          </div>
          <button type="button" class="action-icon-btn action-btn-danger" data-itin-id="${item.itinerary_id}" title="Remove Day">
            🗑️
          </button>
        </div>
      `).join('');

      // Auto-set next day number in the form
      const nextDay = Math.max(...items.map(i => i.day_no)) + 1;
      if (elements.itinDayNo) elements.itinDayNo.value = nextDay;

      // Attach delete handlers
      elements.itinList.querySelectorAll('[data-itin-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-itin-id');
          try {
            const delRes = await fetch(`/api/provider/itinerary/${id}`, { method: 'DELETE' });
            if (!delRes.ok) throw new Error('Delete failed');
            showToast('Itinerary day removed.');
            loadPackageItinerary(activeItineraryPackageId);
            loadDashboardData(currentProviderId);
          } catch (e) {
            showToast('Failed to remove day: ' + e.message, 'error');
          }
        });
      });
    } catch (err) {
      elements.itinList.innerHTML = '<p style="color: #9B1C1C;">Failed to load itinerary.</p>';
    }
  }

  async function handleAddItinerarySubmit(e) {
    e.preventDefault();
    if (!activeItineraryPackageId) return;

    const dayNo = parseInt(elements.itinDayNo.value, 10);
    const title = elements.itinDayTitle.value.trim();
    const description = elements.itinDayDesc.value.trim();

    try {
      const res = await fetch(`/api/provider/packages/${activeItineraryPackageId}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_no: dayNo, title, description })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Save failed');

      showToast(`Day ${dayNo} saved!`);
      elements.itinDayTitle.value = '';
      elements.itinDayDesc.value = '';
      loadPackageItinerary(activeItineraryPackageId);
      loadDashboardData(currentProviderId);
    } catch (err) {
      showToast('Error saving itinerary: ' + err.message, 'error');
    }
  }

  // ==========================================
  // AVAILABILITY MODAL CONTROLLER
  // ==========================================
  async function openAvailabilityModal(packageId, packageTitle) {
    activeAvailabilityPackageId = packageId;
    if (elements.availPkgTitle) elements.availPkgTitle.textContent = packageTitle || `Package #${packageId}`;
    if (elements.availModal) elements.availModal.classList.add('is-open');

    // Default departure date to 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    if (elements.availDateInput) elements.availDateInput.value = d.toISOString().split('T')[0];

    await loadPackageAvailability(packageId);
  }

  function closeAvailabilityModal() {
    activeAvailabilityPackageId = null;
    if (elements.availModal) elements.availModal.classList.remove('is-open');
  }

  async function loadPackageAvailability(packageId) {
    if (!elements.availList) return;
    elements.availList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem;">Loading departure dates…</p>';

    try {
      const res = await fetch(`/api/provider/packages/${packageId}/availability`);
      if (!res.ok) throw new Error('Failed to load availability');
      const json = await res.json();
      const dates = json.data || [];

      if (dates.length === 0) {
        elements.availList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem;">No departure dates scheduled. Add one below.</p>';
        return;
      }

      elements.availList.innerHTML = dates.map(item => `
        <div class="avail-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: var(--bg-surface-soft); border-radius: 6px; margin-bottom: 0.5rem;">
          <div>
            <strong>${formatDate(item.available_date)}</strong>
            <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.5rem;">
              (${item.seats_available} seats open)
            </span>
          </div>
          <button type="button" class="action-icon-btn action-btn-danger" data-avail-id="${item.availability_id}" title="Remove departure date">
            🗑️
          </button>
        </div>
      `).join('');

      elements.availList.querySelectorAll('[data-avail-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const aId = btn.getAttribute('data-avail-id');
          try {
            const delRes = await fetch(`/api/provider/availability/${aId}`, { method: 'DELETE' });
            if (!delRes.ok) throw new Error('Delete failed');
            showToast('Departure date removed.');
            loadPackageAvailability(activeAvailabilityPackageId);
            loadDashboardData(currentProviderId);
          } catch (e) {
            showToast('Failed to remove date: ' + e.message, 'error');
          }
        });
      });
    } catch (err) {
      elements.availList.innerHTML = '<p style="color: #9B1C1C;">Failed to load departure dates.</p>';
    }
  }

  async function handleAddAvailabilitySubmit(e) {
    e.preventDefault();
    if (!activeAvailabilityPackageId) return;

    const dateVal = elements.availDateInput.value;
    const seatsVal = parseInt(elements.availSeatsInput.value, 10);

    try {
      const res = await fetch(`/api/provider/packages/${activeAvailabilityPackageId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available_date: dateVal, seats_available: seatsVal, status: 'AVAILABLE' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Save failed');

      showToast('Departure date added!');
      loadPackageAvailability(activeAvailabilityPackageId);
      loadDashboardData(currentProviderId);
    } catch (err) {
      showToast('Error saving date: ' + err.message, 'error');
    }
  }

  // ==========================================
  // CREATE PACKAGE SUBMIT
  // ==========================================
  async function handleCreatePackageSubmit(e) {
    e.preventDefault();
    const form = elements.createForm;
    const payload = {
      provider_id: currentProviderId,
      title: form.title.value.trim(),
      destination_id: form.destination_id.value,
      category_id: form.category_id.value,
      duration_days: parseInt(form.duration_days.value, 10),
      price: parseFloat(form.price.value),
      capacity: parseInt(form.capacity.value, 10),
      image: form.image.value.trim(),
      initial_date: form.initial_date.value,
      description: form.description.value.trim()
    };

    try {
      const res = await fetch('/api/provider/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Creation failed');

      showToast('Package submitted for administrator review!');
      form.reset();
      if (elements.createModal) elements.createModal.classList.remove('is-open');
      loadDashboardData(currentProviderId);
    } catch (err) {
      showToast('Failed to create package: ' + err.message, 'error');
    }
  }

  // ==========================================
  // 2. BOOKINGS VIEW CONTROLLER
  // ==========================================
  async function loadBookingsData() {
    if (!elements.bookingsTableBody) return;
    elements.bookingsTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading customer bookings…</td></tr>';

    try {
      const res = await fetch(`/api/provider/bookings?provider_id=${currentProviderId}&status=${currentBookingFilter}`);
      if (!res.ok) throw new Error('Failed to load bookings');
      const json = await res.json();
      const bookings = json.data || [];

      if (bookings.length === 0) {
        elements.bookingsTableBody.innerHTML = '';
        if (elements.bookingsEmptyState) elements.bookingsEmptyState.hidden = false;
        return;
      }

      if (elements.bookingsEmptyState) elements.bookingsEmptyState.hidden = true;

      elements.bookingsTableBody.innerHTML = bookings.map(b => {
        let bClass = 'badge-pending';
        if (b.booking_status === 'CONFIRMED') bClass = 'badge-approved';
        if (b.booking_status === 'COMPLETED') bClass = 'badge-completed';
        if (b.booking_status === 'CANCELLED') bClass = 'badge-rejected';

        return `
          <tr>
            <td style="font-weight: 700;">#BK-${b.booking_id}</td>
            <td>
              <div style="font-weight: 600;">${escapeHTML(b.customer_name)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(b.customer_email)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(b.customer_mobile || '')}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--primary);">${escapeHTML(b.package_title)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${b.duration_days} Days</div>
            </td>
            <td>${formatDate(b.available_date) || 'Open Schedule'}</td>
            <td style="font-weight: 600;">${b.travelers} Pax</td>
            <td style="font-weight: 700; color: var(--primary);">${formatINR(b.total_amount)}</td>
            <td>
              <span style="font-size: 0.8rem; font-weight: 600; color: ${b.payment_status === 'PAID' ? '#2E7D32' : '#C86343'};">
                ${b.payment_status} (${b.payment_method || 'N/A'})
              </span>
            </td>
            <td>
              <span class="provider-status-badge ${bClass}">${b.booking_status}</span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="display: inline-flex; gap: 0.35rem;">
                ${b.booking_status === 'PENDING' ? `
                  <button type="button" class="btn btn-primary btn-sm" data-action="confirm-booking" data-booking-id="${b.booking_id}" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;">
                    Confirm
                  </button>
                ` : ''}
                ${b.booking_status === 'CONFIRMED' ? `
                  <button type="button" class="btn btn-outline btn-sm" data-action="complete-booking" data-booking-id="${b.booking_id}" style="padding: 0.3rem 0.6rem; font-size: 0.78rem; color: #2E7D32; border-color: #2E7D32;">
                    Complete
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Attach booking actions
      elements.bookingsTableBody.querySelectorAll('[data-action="confirm-booking"]').forEach(btn => {
        btn.addEventListener('click', () => updateBookingStatus(btn.getAttribute('data-booking-id'), 'CONFIRMED'));
      });
      elements.bookingsTableBody.querySelectorAll('[data-action="complete-booking"]').forEach(btn => {
        btn.addEventListener('click', () => updateBookingStatus(btn.getAttribute('data-booking-id'), 'COMPLETED'));
      });
    } catch (err) {
      elements.bookingsTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  async function updateBookingStatus(bookingId, status) {
    try {
      const res = await fetch(`/api/provider/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: currentProviderId, status })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Update failed');

      showToast(`Booking #${bookingId} marked as ${status}!`);
      loadBookingsData();
    } catch (err) {
      showToast('Failed to update booking: ' + err.message, 'error');
    }
  }

  // ==========================================
  // 3. CUSTOM REQUESTS VIEW CONTROLLER
  // ==========================================
  async function loadCustomRequestsData() {
    if (!elements.requestsTableBody) return;
    elements.requestsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading inquiries…</td></tr>';

    try {
      const res = await fetch(`/api/provider/custom-requests?provider_id=${currentProviderId}`);
      if (!res.ok) throw new Error('Failed to load custom requests');
      const json = await res.json();
      const requests = json.data || [];

      if (requests.length === 0) {
        elements.requestsTableBody.innerHTML = '';
        if (elements.requestsEmptyState) elements.requestsEmptyState.hidden = false;
        return;
      }

      if (elements.requestsEmptyState) elements.requestsEmptyState.hidden = true;

      elements.requestsTableBody.innerHTML = requests.map(req => {
        let planHtml = '';
        if (req.day_plan) {
          try {
            const plan = typeof req.day_plan === 'string' ? JSON.parse(req.day_plan) : req.day_plan;
            if (Array.isArray(plan)) {
              planHtml = `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.25rem;">${plan.length} Day Plan Scheduled</div>`;
            }
          } catch (e) {
            // ignore
          }
        }

        return `
          <tr>
            <td style="font-weight: 700;">#CI-${req.itinerary_id}</td>
            <td>
              <div style="font-weight: 600;">${escapeHTML(req.customer_name)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(req.customer_email)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(req.customer_mobile || '')}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--primary);">${escapeHTML(req.title)}</div>
              <div style="font-size: 0.78rem; color: var(--sage-dark); font-weight: 600;">📍 ${escapeHTML(req.destination_name)} (${escapeHTML(req.city)})</div>
              ${planHtml}
            </td>
            <td>
              <div><strong>${formatDate(req.start_date)}</strong></div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${req.duration_days} Day(s)</div>
            </td>
            <td>
              <div style="font-size: 0.82rem;"><strong>Pace:</strong> ${escapeHTML(req.travel_pace)}</div>
              <div style="font-size: 0.82rem;"><strong>Tier:</strong> ${escapeHTML(req.accommodation_tier)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(req.interests)}</div>
            </td>
            <td style="font-weight: 700; color: var(--primary);">
              ${formatINR(req.estimated_cost)}
            </td>
            <td>
              <span class="provider-status-badge ${req.booking_request_status === 'ACCEPTED' ? 'badge-approved' : (req.booking_request_status === 'REJECTED' ? 'badge-rejected' : 'badge-pending')}">
                ${req.booking_request_status}
              </span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              ${req.booking_request_status === 'SUBMITTED' ? `
                <div style="display: inline-flex; gap: 0.35rem;">
                  <button type="button" class="btn btn-primary btn-sm" data-action="accept-request" data-req-id="${req.itinerary_id}" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;">
                    Accept
                  </button>
                  <button type="button" class="btn btn-outline btn-sm action-btn-danger" data-action="reject-request" data-req-id="${req.itinerary_id}" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;">
                    Decline
                  </button>
                </div>
              ` : `
                <span style="font-size: 0.8rem; color: var(--text-muted);">Decided</span>
              `}
            </td>
          </tr>
        `;
      }).join('');

      elements.requestsTableBody.querySelectorAll('[data-action="accept-request"]').forEach(btn => {
        btn.addEventListener('click', () => updateRequestStatus(btn.getAttribute('data-req-id'), 'ACCEPTED'));
      });
      elements.requestsTableBody.querySelectorAll('[data-action="reject-request"]').forEach(btn => {
        btn.addEventListener('click', () => updateRequestStatus(btn.getAttribute('data-req-id'), 'REJECTED'));
      });
    } catch (err) {
      elements.requestsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  async function updateRequestStatus(requestId, status) {
    try {
      const res = await fetch(`/api/provider/custom-requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: currentProviderId, status })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Update failed');

      showToast(`Custom itinerary request marked as ${status}!`);
      loadCustomRequestsData();
    } catch (err) {
      showToast('Failed to update request: ' + err.message, 'error');
    }
  }

  // ==========================================
  // 4. REPORTS VIEW CONTROLLER
  // ==========================================
  async function loadReportsData() {
    try {
      const res = await fetch(`/api/provider/reports?provider_id=${currentProviderId}`);
      if (!res.ok) throw new Error('Failed to load reports');
      const json = await res.json();
      const data = json.data;
      const summary = data.summary || {};

      if (elements.reportTotalRevenue) elements.reportTotalRevenue.textContent = formatINR(summary.total_revenue || 0);
      if (elements.reportCompletedRevenue) elements.reportCompletedRevenue.textContent = formatINR(summary.completed_revenue || 0);
      if (elements.reportConfirmedRevenue) elements.reportConfirmedRevenue.textContent = formatINR(summary.upcoming_revenue || 0);
      if (elements.reportTotalTravelers) elements.reportTotalTravelers.textContent = summary.total_travelers || 0;

      // Render Package Breakdown Table
      const packages = data.packages || [];
      if (elements.reportsPackagesTableBody) {
        if (packages.length === 0) {
          elements.reportsPackagesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No package booking data found yet.</td></tr>';
          return;
        }

        elements.reportsPackagesTableBody.innerHTML = packages.map(p => `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHTML(p.title)}</td>
            <td>${formatINR(p.price)}</td>
            <td style="font-weight: 600;">${p.bookings_count || 0}</td>
            <td>${p.total_passengers || 0} Pax</td>
            <td style="font-weight: 700; color: var(--primary);">${formatINR(p.revenue || 0)}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Error loading reports:', err);
      showToast('Failed to load revenue reports.', 'error');
    }
  }

  // ==========================================
  // EVENT LISTENERS & SETUP
  // ==========================================
  function setupEventListeners() {
    // Navigation Tabs
    elements.navTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        switchView(view);
      });
    });

    // Provider Account Switcher
    if (elements.providerSelect) {
      elements.providerSelect.addEventListener('change', e => {
        currentProviderId = parseInt(e.target.value, 10);
        localStorage.setItem('roamly_provider_id', currentProviderId);
        showToast(`Switched account to provider #${currentProviderId}`);
        loadDashboardData(currentProviderId);
      });
    }

    // Refresh buttons
    if (elements.btnRefresh) elements.btnRefresh.addEventListener('click', () => loadDashboardData(currentProviderId));
    if (elements.btnRefreshBookings) elements.btnRefreshBookings.addEventListener('click', () => loadBookingsData());
    if (elements.btnRefreshRequests) elements.btnRefreshRequests.addEventListener('click', () => loadCustomRequestsData());

    // Search and Filters on Packages
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderPackagesTable();
      });
    }

    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', () => renderPackagesTable());
    }

    elements.statusTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.statusTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStatusFilter = btn.getAttribute('data-status') || 'all';
        renderPackagesTable();
      });
    });

    // Booking status filter tabs
    elements.bookingStatusTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.bookingStatusTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBookingFilter = btn.getAttribute('data-bstatus') || 'ALL';
        loadBookingsData();
      });
    });

    // Create Modal Triggers
    if (elements.btnOpenCreate) {
      elements.btnOpenCreate.addEventListener('click', () => {
        if (elements.createModal) elements.createModal.classList.add('is-open');
      });
    }
    if (elements.btnCloseCreate) {
      elements.btnCloseCreate.addEventListener('click', () => {
        if (elements.createModal) elements.createModal.classList.remove('is-open');
      });
    }
    if (elements.btnCancelCreate) {
      elements.btnCancelCreate.addEventListener('click', () => {
        if (elements.createModal) elements.createModal.classList.remove('is-open');
      });
    }
    if (elements.createForm) elements.createForm.addEventListener('submit', handleCreatePackageSubmit);

    // Edit Modal Triggers
    if (elements.btnCloseEdit) elements.btnCloseEdit.addEventListener('click', closeEditModal);
    if (elements.btnCancelEdit) elements.btnCancelEdit.addEventListener('click', closeEditModal);
    if (elements.editForm) elements.editForm.addEventListener('submit', handleEditPackageSubmit);

    // Availability Modal Triggers
    if (elements.btnCloseAvail) elements.btnCloseAvail.addEventListener('click', closeAvailabilityModal);
    if (elements.availAddForm) elements.availAddForm.addEventListener('submit', handleAddAvailabilitySubmit);

    // Itinerary Modal Triggers
    if (elements.btnCloseItin) elements.btnCloseItin.addEventListener('click', closeItineraryModal);
    if (elements.itinAddForm) elements.itinAddForm.addEventListener('submit', handleAddItinerarySubmit);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', async () => {
    // Require PROVIDER session — redirects to /login.html if not signed in
    let sessionUser = null;
    if (typeof RoamlySession !== 'undefined') {
      sessionUser = await RoamlySession.requireRole(['PROVIDER', 'ADMIN', 'SUPER_ADMIN']);
      if (!sessionUser) return; // redirect already triggered
    }

    initCurrentProvider(sessionUser);
    setupEventListeners();
    await loadProvidersList();
    await loadFormMetadata();
    await loadDashboardData(currentProviderId);
  });

})();
