/**
 * Roamly — Member 3: Central Admin Console Controller
 * Pure Vanilla JavaScript DOM manipulation & Fetch API
 */

(function () {
  'use strict';

  const currentAdminId = 5; // Anita Desai (Admin)
  let allAdminPackages = [];
  let currentPkgFilter = 'ALL';
  let currentRoleFilter = 'ALL';
  let pkgSearchQuery = '';
  let userSearchQuery = '';

  const elements = {
    navTabs: document.querySelectorAll('.admin-nav-tab'),
    views: {
      overview: document.getElementById('view-overview'),
      moderation: document.getElementById('view-moderation'),
      destinations: document.getElementById('view-destinations'),
      categories: document.getElementById('view-categories'),
      users: document.getElementById('view-users'),
      reports: document.getElementById('view-reports')
    },
    // Overview Stats
    statPendingPkgs: document.getElementById('stat-pending-pkgs'),
    statPublishedPkgs: document.getElementById('stat-published-pkgs'),
    statPendingProvs: document.getElementById('stat-pending-provs'),
    statPlatformRevenue: document.getElementById('stat-platform-revenue'),
    badgePendingModeration: document.getElementById('badge-pending-moderation'),
    badgePendingProviders: document.getElementById('badge-pending-providers'),
    overviewPendingPkgsList: document.getElementById('overview-pending-pkgs-list'),
    overviewPendingProvsList: document.getElementById('overview-pending-provs-list'),

    // Moderation
    adminPackagesTableBody: document.getElementById('admin-packages-table-body'),
    pkgModerationTabs: document.querySelectorAll('#pkg-moderation-tabs .status-tab-btn'),
    adminPkgSearch: document.getElementById('admin-pkg-search'),
    btnRefreshPackages: document.getElementById('btn-refresh-packages'),

    // Destinations
    destinationsTableBody: document.getElementById('destinations-table-body'),
    btnOpenCreateDest: document.getElementById('btn-open-create-destination'),
    destModal: document.getElementById('dest-modal'),
    destModalTitle: document.getElementById('dest-modal-title'),
    destForm: document.getElementById('dest-form'),
    destId: document.getElementById('dest-id'),
    destName: document.getElementById('dest-name'),
    destCity: document.getElementById('dest-city'),
    destState: document.getElementById('dest-state'),
    destDesc: document.getElementById('dest-desc'),
    destStatus: document.getElementById('dest-status'),
    btnCloseDestModal: document.getElementById('btn-close-dest-modal'),
    btnCancelDest: document.getElementById('btn-cancel-dest'),

    // Categories
    categoriesTableBody: document.getElementById('categories-table-body'),
    btnOpenCreateCat: document.getElementById('btn-open-create-category'),
    catModal: document.getElementById('cat-modal'),
    catModalTitle: document.getElementById('cat-modal-title'),
    catForm: document.getElementById('cat-form'),
    catId: document.getElementById('cat-id'),
    catName: document.getElementById('cat-name'),
    catDesc: document.getElementById('cat-desc'),
    catStatus: document.getElementById('cat-status'),
    btnCloseCatModal: document.getElementById('btn-close-cat-modal'),
    btnCancelCat: document.getElementById('btn-cancel-cat'),

    // Users
    usersTableBody: document.getElementById('users-table-body'),
    userRoleTabs: document.querySelectorAll('#user-role-tabs .status-tab-btn'),
    adminUserSearch: document.getElementById('admin-user-search'),
    btnRefreshUsers: document.getElementById('btn-refresh-users'),

    // Reports
    reportTotalBookings: document.getElementById('report-total-bookings'),
    reportGrossRevenue: document.getElementById('report-gross-revenue'),
    reportActiveProviders: document.getElementById('report-active-providers'),
    reportTotalCustomers: document.getElementById('report-total-customers'),
    reportDestTableBody: document.getElementById('report-dest-table-body'),
    reportProvTableBody: document.getElementById('report-prov-table-body'),

    // Toast
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
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

  function switchView(viewName) {
    elements.navTabs.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-view') === viewName);
    });

    Object.keys(elements.views).forEach(key => {
      if (elements.views[key]) {
        elements.views[key].style.display = key === viewName ? 'block' : 'none';
      }
    });

    if (viewName === 'overview') loadOverviewData();
    if (viewName === 'moderation') loadPackagesData();
    if (viewName === 'destinations') loadDestinationsData();
    if (viewName === 'categories') loadCategoriesData();
    if (viewName === 'users') loadUsersData();
    if (viewName === 'reports') loadReportsData();
  }

  // ==========================================
  // 1. OVERVIEW DATA
  // ==========================================
  async function loadOverviewData() {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) throw new Error('Failed to load admin dashboard');
      const json = await res.json();
      const data = json.data;

      const pkgs = data.packages || {};
      const users = data.users || {};
      const finances = data.finances || {};

      if (elements.statPendingPkgs) elements.statPendingPkgs.textContent = pkgs.pending_packages || 0;
      if (elements.statPublishedPkgs) elements.statPublishedPkgs.textContent = pkgs.approved_packages || 0;
      if (elements.statPendingProvs) elements.statPendingProvs.textContent = users.pending_providers || 0;
      if (elements.statPlatformRevenue) elements.statPlatformRevenue.textContent = formatINR(finances.total_revenue || 0);

      const pendingCount = Number(pkgs.pending_packages) || 0;
      if (elements.badgePendingModeration) {
        elements.badgePendingModeration.textContent = pendingCount;
        elements.badgePendingModeration.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }

      // Render Overview Pending Packages
      const pendingPkgsList = data.pendingPackages || [];
      if (elements.overviewPendingPkgsList) {
        if (pendingPkgsList.length === 0) {
          elements.overviewPendingPkgsList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem;">No packages currently pending review.</p>';
        } else {
          elements.overviewPendingPkgsList.innerHTML = pendingPkgsList.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
              <div>
                <div style="font-weight: 700; color: var(--primary); font-size: 0.92rem;">${escapeHTML(p.title)}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">By ${escapeHTML(p.provider_name)} • ${formatINR(p.price)}</div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" onclick="moderateDirect(${p.package_id}, 'APPROVED')" style="padding: 0.25rem 0.6rem; font-size: 0.78rem;">
                Approve
              </button>
            </div>
          `).join('');
        }
      }

      // Render Overview Pending Providers
      const pendingProvsList = data.pendingProviders || [];
      if (elements.overviewPendingProvsList) {
        if (pendingProvsList.length === 0) {
          elements.overviewPendingProvsList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem;">No provider registrations pending review.</p>';
        } else {
          elements.overviewPendingProvsList.innerHTML = pendingProvsList.map(u => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
              <div>
                <div style="font-weight: 700; color: var(--primary); font-size: 0.92rem;">${escapeHTML(u.name)}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(u.email)} • ${escapeHTML(u.mobile || '')}</div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" onclick="approveProviderDirect(${u.user_id})" style="padding: 0.25rem 0.6rem; font-size: 0.78rem;">
                Approve
              </button>
            </div>
          `).join('');
        }
      }

    } catch (err) {
      console.error('Error in loadOverviewData:', err);
    }
  }

  // Global helper for quick actions from overview
  window.moderateDirect = async function(pkgId, status) {
    await updatePackageModeration(pkgId, status);
    loadOverviewData();
  };

  window.approveProviderDirect = async function(userId) {
    await updateUserStatusDirect(userId, 'ACTIVE');
    loadOverviewData();
  };

  // ==========================================
  // 2. PACKAGE MODERATION VIEW
  // ==========================================
  async function loadPackagesData() {
    if (!elements.adminPackagesTableBody) return;
    elements.adminPackagesTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading packages for review…</td></tr>';

    try {
      const res = await fetch(`/api/admin/packages?status=${currentPkgFilter}&search=${encodeURIComponent(pkgSearchQuery)}`);
      if (!res.ok) throw new Error('Failed to load packages');
      const json = await res.json();
      allAdminPackages = json.data || [];

      if (allAdminPackages.length === 0) {
        elements.adminPackagesTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No packages match this filter.</td></tr>';
        return;
      }

      elements.adminPackagesTableBody.innerHTML = allAdminPackages.map(pkg => {
        let badgeClass = 'badge-pending';
        if (pkg.status === 'APPROVED') badgeClass = 'badge-approved';
        if (pkg.status === 'REJECTED') badgeClass = 'badge-rejected';
        if (pkg.status === 'INACTIVE') badgeClass = 'badge-inactive';

        return `
          <tr>
            <td>
              <a href="../package-details.html?id=${pkg.package_id}" target="_blank" style="font-weight: 700; color: var(--primary); text-decoration: underline;" title="Inspect public page">
                ${escapeHTML(pkg.title)}
              </a>
              <div style="font-size: 0.76rem; color: var(--text-muted);">Package #${pkg.package_id} • Created ${formatDate(pkg.created_at)}</div>
            </td>
            <td>
              <div style="font-weight: 600;">${escapeHTML(pkg.provider_name)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(pkg.provider_email)}</div>
            </td>
            <td>
              <div style="font-weight: 600;">📍 ${escapeHTML(pkg.destination_name || 'Destination')}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(pkg.category_name || '')}</div>
            </td>
            <td>
              ${pkg.duration_days} Days • Max ${pkg.capacity} Pax
            </td>
            <td style="font-weight: 700; color: var(--primary);">
              ${formatINR(pkg.price)}
            </td>
            <td>
              <span class="provider-status-badge ${badgeClass}">${pkg.status}</span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="display: inline-flex; gap: 0.35rem;">
                ${pkg.status !== 'APPROVED' ? `
                  <button type="button" class="btn btn-primary btn-sm" onclick="updatePackageModeration(${pkg.package_id}, 'APPROVED')" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;">
                    Approve
                  </button>
                ` : ''}
                ${pkg.status !== 'REJECTED' ? `
                  <button type="button" class="btn btn-outline btn-sm action-btn-danger" onclick="rejectPackagePrompt(${pkg.package_id})" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;">
                    Reject
                  </button>
                ` : ''}
                ${pkg.status === 'APPROVED' ? `
                  <button type="button" class="btn btn-outline btn-sm" onclick="updatePackageModeration(${pkg.package_id}, 'INACTIVE')" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;">
                    Disable
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      elements.adminPackagesTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  window.updatePackageModeration = async function(pkgId, status, note = '') {
    try {
      const res = await fetch(`/api/admin/packages/${pkgId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: currentAdminId, status, note })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Moderation failed');
      showToast(`Package #${pkgId} marked as ${status}`);
      loadPackagesData();
      loadOverviewData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  window.rejectPackagePrompt = function(pkgId) {
    const reason = prompt('Please enter the reason for rejection (this will be logged for the provider):', 'Incomplete itinerary activities or pricing adjustment needed');
    if (reason === null) return;
    updatePackageModeration(pkgId, 'REJECTED', reason.trim());
  };

  // ==========================================
  // 3. DESTINATIONS VIEW (CRUD)
  // ==========================================
  async function loadDestinationsData() {
    if (!elements.destinationsTableBody) return;
    elements.destinationsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading destinations…</td></tr>';

    try {
      const res = await fetch('/api/admin/destinations');
      if (!res.ok) throw new Error('Failed to load destinations');
      const json = await res.json();
      const destinations = json.data || [];

      elements.destinationsTableBody.innerHTML = destinations.map(d => `
        <tr>
          <td style="font-weight: 700; color: var(--primary);">${escapeHTML(d.name)}</td>
          <td>${escapeHTML(d.city)}, ${escapeHTML(d.state)}</td>
          <td>${escapeHTML(d.country)}</td>
          <td style="font-weight: 600;">${d.package_count || 0} Package(s)</td>
          <td>
            <span class="provider-status-badge ${d.status === 'ACTIVE' ? 'badge-approved' : 'badge-inactive'}">
              ${d.status}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button type="button" class="action-icon-btn" onclick='openEditDestModal(${JSON.stringify(d)})'>
                ✏️ Edit
              </button>
              <button type="button" class="action-icon-btn action-btn-danger" onclick="deleteDestination(${d.destination_id}, '${escapeHTML(d.name)}')">
                🗑️ Delete
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      elements.destinationsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  function openCreateDestModal() {
    elements.destId.value = '';
    elements.destForm.reset();
    elements.destModalTitle.textContent = 'Add New Destination';
    elements.destModal.classList.add('is-open');
  }

  window.openEditDestModal = function(d) {
    elements.destId.value = d.destination_id;
    elements.destName.value = d.name;
    elements.destCity.value = d.city;
    elements.destState.value = d.state;
    elements.destDesc.value = d.description || '';
    elements.destStatus.value = d.status;
    elements.destModalTitle.textContent = `Edit Destination #${d.destination_id}`;
    elements.destModal.classList.add('is-open');
  };

  async function handleDestFormSubmit(e) {
    e.preventDefault();
    const id = elements.destId.value;
    const isEdit = Boolean(id);
    const payload = {
      admin_id: currentAdminId,
      name: elements.destName.value.trim(),
      city: elements.destCity.value.trim(),
      state: elements.destState.value.trim(),
      country: 'India',
      description: elements.destDesc.value.trim(),
      status: elements.destStatus.value
    };

    try {
      const url = isEdit ? `/api/admin/destinations/${id}` : '/api/admin/destinations';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Save failed');

      showToast(isEdit ? 'Destination updated!' : 'Destination created successfully!');
      elements.destModal.classList.remove('is-open');
      loadDestinationsData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  window.deleteDestination = async function(id, name) {
    if (!confirm(`Are you sure you want to delete destination "${name}"? Destinations with existing packages cannot be deleted.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/destinations/${id}?admin_id=${currentAdminId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Delete failed');
      showToast('Destination deleted successfully.');
      loadDestinationsData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==========================================
  // 4. CATEGORIES VIEW (CRUD)
  // ==========================================
  async function loadCategoriesData() {
    if (!elements.categoriesTableBody) return;
    elements.categoriesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading categories…</td></tr>';

    try {
      const res = await fetch('/api/admin/categories');
      if (!res.ok) throw new Error('Failed to load categories');
      const json = await res.json();
      const categories = json.data || [];

      elements.categoriesTableBody.innerHTML = categories.map(c => `
        <tr>
          <td style="font-weight: 700; color: var(--primary);">${escapeHTML(c.category_name)}</td>
          <td style="font-size: 0.88rem; color: var(--text-secondary); max-width: 380px;">${escapeHTML(c.description || 'No description')}</td>
          <td style="font-weight: 600;">${c.package_count || 0} Package(s)</td>
          <td>
            <span class="provider-status-badge ${c.status === 'ACTIVE' ? 'badge-approved' : 'badge-inactive'}">
              ${c.status}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button type="button" class="action-icon-btn" onclick='openEditCatModal(${JSON.stringify(c)})'>
                ✏️ Edit
              </button>
              <button type="button" class="action-icon-btn action-btn-danger" onclick="deleteCategory(${c.category_id}, '${escapeHTML(c.category_name)}')">
                🗑️ Delete
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      elements.categoriesTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  function openCreateCatModal() {
    elements.catId.value = '';
    elements.catForm.reset();
    elements.catModalTitle.textContent = 'Add New Category';
    elements.catModal.classList.add('is-open');
  }

  window.openEditCatModal = function(c) {
    elements.catId.value = c.category_id;
    elements.catName.value = c.category_name;
    elements.catDesc.value = c.description || '';
    elements.catStatus.value = c.status;
    elements.catModalTitle.textContent = `Edit Category #${c.category_id}`;
    elements.catModal.classList.add('is-open');
  };

  async function handleCatFormSubmit(e) {
    e.preventDefault();
    const id = elements.catId.value;
    const isEdit = Boolean(id);
    const payload = {
      admin_id: currentAdminId,
      category_name: elements.catName.value.trim(),
      description: elements.catDesc.value.trim(),
      status: elements.catStatus.value
    };

    try {
      const url = isEdit ? `/api/admin/categories/${id}` : '/api/admin/categories';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Save failed');

      showToast(isEdit ? 'Category updated!' : 'Category created successfully!');
      elements.catModal.classList.remove('is-open');
      loadCategoriesData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  window.deleteCategory = async function(id, name) {
    if (!confirm(`Are you sure you want to delete category "${name}"? Categories with active packages cannot be deleted.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/categories/${id}?admin_id=${currentAdminId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Delete failed');
      showToast('Category deleted successfully.');
      loadCategoriesData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==========================================
  // 5. USER ACCOUNT MANAGEMENT
  // ==========================================
  async function loadUsersData() {
    if (!elements.usersTableBody) return;
    elements.usersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading accounts…</td></tr>';

    try {
      const res = await fetch(`/api/admin/users?role=${currentRoleFilter}&search=${encodeURIComponent(userSearchQuery)}`);
      if (!res.ok) throw new Error('Failed to load users');
      const json = await res.json();
      const users = json.data || [];

      if (users.length === 0) {
        elements.usersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No accounts found.</td></tr>';
        return;
      }

      elements.usersTableBody.innerHTML = users.map(u => {
        let statusBadgeClass = 'badge-pending';
        if (u.status === 'ACTIVE') statusBadgeClass = 'badge-approved';
        if (u.status === 'BLOCKED') statusBadgeClass = 'badge-rejected';
        if (u.status === 'INACTIVE') statusBadgeClass = 'badge-inactive';

        const activityLabel = u.role === 'PROVIDER' ? `${u.activity_count} Package(s)` : `${u.activity_count} Booking(s)`;

        return `
          <tr>
            <td style="font-weight: 700;">#U-${u.user_id}</td>
            <td>
              <div style="font-weight: 700; color: var(--primary);">${escapeHTML(u.name)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(u.email)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(u.mobile || '')}</div>
            </td>
            <td>
              <span style="font-weight: 700; font-size: 0.82rem; color: ${u.role === 'PROVIDER' ? 'var(--primary)' : 'var(--sage-dark)'};">
                ${u.role}
              </span>
            </td>
            <td>${activityLabel}</td>
            <td>
              <span class="provider-status-badge ${statusBadgeClass}">${u.status}</span>
            </td>
            <td>${formatDate(u.created_at)}</td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="display: inline-flex; gap: 0.35rem;">
                ${u.status === 'PENDING' ? `
                  <button type="button" class="btn btn-primary btn-sm" onclick="updateUserStatusDirect(${u.user_id}, 'ACTIVE')" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;">
                    Approve
                  </button>
                  <button type="button" class="btn btn-outline btn-sm action-btn-danger" onclick="updateUserStatusDirect(${u.user_id}, 'REJECTED')" style="padding: 0.25rem 0.55rem; font-size: 0.78rem;">
                    Reject
                  </button>
                ` : ''}
                ${u.status === 'ACTIVE' ? `
                  <button type="button" class="action-icon-btn action-btn-danger" onclick="updateUserStatusDirect(${u.user_id}, 'BLOCKED')" title="Block user access">
                    🚫 Block
                  </button>
                ` : ''}
                ${u.status === 'BLOCKED' ? `
                  <button type="button" class="action-icon-btn" onclick="updateUserStatusDirect(${u.user_id}, 'ACTIVE')" title="Unblock user access" style="color: #2E7D32;">
                    ✅ Unblock
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      elements.usersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #9B1C1C;">Error: ${err.message}</td></tr>`;
    }
  }

  window.updateUserStatusDirect = async function(userId, status) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: currentAdminId, status })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Update failed');
      showToast(`User #${userId} status set to ${status}`);
      loadUsersData();
      loadOverviewData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // ==========================================
  // 6. SYSTEM-WIDE REPORTS
  // ==========================================
  async function loadReportsData() {
    try {
      const res = await fetch('/api/admin/reports');
      if (!res.ok) throw new Error('Failed to load reports');
      const json = await res.json();
      const data = json.data;
      const sum = data.summary || {};

      if (elements.reportTotalBookings) elements.reportTotalBookings.textContent = sum.total_bookings || 0;
      if (elements.reportGrossRevenue) elements.reportGrossRevenue.textContent = formatINR(sum.total_revenue || 0);
      if (elements.reportActiveProviders) elements.reportActiveProviders.textContent = sum.active_providers || 0;
      if (elements.reportTotalCustomers) elements.reportTotalCustomers.textContent = sum.total_customers || 0;

      // Destination Table
      const byDest = data.byDestination || [];
      if (elements.reportDestTableBody) {
        elements.reportDestTableBody.innerHTML = byDest.map(d => `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHTML(d.destination_name)}</td>
            <td>${escapeHTML(d.state)}</td>
            <td style="font-weight: 600;">${d.bookings}</td>
            <td style="font-weight: 700; color: var(--primary);">${formatINR(d.revenue)}</td>
          </tr>
        `).join('');
      }

      // Top Providers Table
      const topProvs = data.topProviders || [];
      if (elements.reportProvTableBody) {
        elements.reportProvTableBody.innerHTML = topProvs.map(p => `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHTML(p.provider_name)}</td>
            <td>${p.packages_count} Tour(s)</td>
            <td style="font-weight: 600;">${p.bookings_count}</td>
            <td style="font-weight: 700; color: var(--primary);">${formatINR(p.total_revenue)}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Error loading admin reports:', err);
      showToast('Failed to load reports.', 'error');
    }
  }

  // ==========================================
  // SETUP EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    elements.navTabs.forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
    });

    // Packages moderation filters
    elements.pkgModerationTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.pkgModerationTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPkgFilter = btn.getAttribute('data-status') || 'ALL';
        loadPackagesData();
      });
    });

    if (elements.adminPkgSearch) {
      elements.adminPkgSearch.addEventListener('input', e => {
        pkgSearchQuery = e.target.value.trim();
        loadPackagesData();
      });
    }

    if (elements.btnRefreshPackages) elements.btnRefreshPackages.addEventListener('click', loadPackagesData);

    // User filters
    elements.userRoleTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.userRoleTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRoleFilter = btn.getAttribute('data-urole') || 'ALL';
        loadUsersData();
      });
    });

    if (elements.adminUserSearch) {
      elements.adminUserSearch.addEventListener('input', e => {
        userSearchQuery = e.target.value.trim();
        loadUsersData();
      });
    }

    if (elements.btnRefreshUsers) elements.btnRefreshUsers.addEventListener('click', loadUsersData);

    // Destination Modal Triggers
    if (elements.btnOpenCreateDest) elements.btnOpenCreateDest.addEventListener('click', openCreateDestModal);
    if (elements.btnCloseDestModal) elements.btnCloseDestModal.addEventListener('click', () => elements.destModal.classList.remove('is-open'));
    if (elements.btnCancelDest) elements.btnCancelDest.addEventListener('click', () => elements.destModal.classList.remove('is-open'));
    if (elements.destForm) elements.destForm.addEventListener('submit', handleDestFormSubmit);

    // Category Modal Triggers
    if (elements.btnOpenCreateCat) elements.btnOpenCreateCat.addEventListener('click', openCreateCatModal);
    if (elements.btnCloseCatModal) elements.btnCloseCatModal.addEventListener('click', () => elements.catModal.classList.remove('is-open'));
    if (elements.btnCancelCat) elements.btnCancelCat.addEventListener('click', () => elements.catModal.classList.remove('is-open'));
    if (elements.catForm) elements.catForm.addEventListener('submit', handleCatFormSubmit);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadOverviewData();
  });

})();

