/**
 * Roamly — Member 3: Provider Portal Dashboard Controller
 * Pure Vanilla JavaScript DOM manipulation & Fetch API
 */

(function () {
  'use strict';

  // State
  let currentProviderId = null;
  let allPackages = [];
  let currentStatusFilter = 'all';
  let searchQuery = '';
  let activeAvailabilityPackageId = null;

  // DOM Elements
  const elements = {
    providerName: document.getElementById('provider-name'),
    providerEmail: document.getElementById('provider-email'),
    providerAvatar: document.getElementById('provider-avatar'),
    providerSelect: document.getElementById('provider-select'),
    
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

    // Availability Modal
    availModal: document.getElementById('availability-modal'),
    availPkgTitle: document.getElementById('avail-modal-package-title'),
    availList: document.getElementById('avail-list-container'),
    availAddForm: document.getElementById('avail-add-form'),
    availDateInput: document.getElementById('avail-new-date'),
    availSeatsInput: document.getElementById('avail-new-seats'),
    btnCloseAvail: document.getElementById('btn-close-avail-modal'),

    // Toast Container
    toastBox: document.getElementById('provider-toast-box')
  };

  /**
   * Currency formatter for INR
   */
  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + Math.round(num).toLocaleString('en-IN');
  }

  /**
   * Date formatter (e.g., "15 Nov 2026")
   */
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

  /**
   * Toast notification system
   */
  function showToast(message, type = 'success') {
    if (!elements.toastBox) return;
    const toast = document.createElement('div');
    toast.className = `provider-toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : '✅'}</span>
      <span>${message}</span>
    `;
    elements.toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3500);
  }

  /**
   * Detect current provider from URL query or localStorage
   */
  function initCurrentProvider() {
    const urlParams = new URLSearchParams(window.location.search);
    const qProvider = urlParams.get('provider_id');
    if (qProvider && !isNaN(parseInt(qProvider, 10))) {
      currentProviderId = parseInt(qProvider, 10);
      localStorage.setItem('roamly_provider_id', currentProviderId);
      return;
    }

    const savedProviderId = localStorage.getItem('roamly_provider_id');
    if (savedProviderId && !isNaN(parseInt(savedProviderId, 10))) {
      currentProviderId = parseInt(savedProviderId, 10);
      return;
    }

    // Default to provider ID 1 (Royal Heritage Journeys)
    currentProviderId = 1;
  }

  /**
   * Load providers for the switcher dropdown
   */
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
          opt.textContent = `${p.name} (${p.total_packages} pkg${p.total_packages === 1 ? '' : 's'})`;
          if (p.user_id === currentProviderId) {
            opt.selected = true;
          }
          elements.providerSelect.appendChild(opt);
        });

        elements.providerSelect.addEventListener('change', (e) => {
          currentProviderId = parseInt(e.target.value, 10);
          localStorage.setItem('roamly_provider_id', currentProviderId);
          loadDashboardData(currentProviderId);
        });
      }
    } catch (err) {
      console.warn('Unable to load providers list:', err);
    }
  }

  /**
   * Fetch destinations & categories for package creation modal
   */
  async function loadFormMetadata() {
    try {
      // Load Destinations
      const destRes = await fetch('/api/destinations');
      if (destRes.ok) {
        const json = await destRes.json();
        const destinations = json.data || [];
        if (elements.createDestSelect) {
          elements.createDestSelect.innerHTML = '<option value="">Select a destination…</option>';
          destinations.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.destination_id;
            opt.textContent = `${d.name} (${d.city}, ${d.state})`;
            elements.createDestSelect.appendChild(opt);
          });
        }
      }

      // Load Categories
      const catRes = await fetch('/api/categories');
      if (catRes.ok) {
        const json = await catRes.json();
        const categories = json.data || [];
        if (elements.createCatSelect) {
          elements.createCatSelect.innerHTML = '<option value="">Select a category…</option>';
          categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.category_id;
            opt.textContent = c.category_name;
            elements.createCatSelect.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.error('Error loading form metadata:', err);
    }
  }

  /**
   * Fetch provider dashboard statistics & package lists
   */
  async function loadDashboardData(providerId) {
    try {
      // Set loading visual
      if (elements.packagesTableBody) {
        elements.packagesTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
              <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🧭</div>
              Loading provider dashboard and live packages…
            </td>
          </tr>
        `;
      }

      const res = await fetch(`/api/provider/dashboard?provider_id=${encodeURIComponent(providerId)}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.message || 'Failed to parse dashboard data.');
      }

      const { provider, stats, packages } = json.data;
      allPackages = packages || [];

      // Update Provider Identity
      if (elements.providerName) elements.providerName.textContent = provider.name || 'Tour Provider';
      if (elements.providerEmail) elements.providerEmail.textContent = provider.email || '';
      if (elements.providerAvatar) {
        elements.providerAvatar.textContent = (provider.name || 'P').charAt(0).toUpperCase();
      }

      // Update 4 Metrics Cards
      if (elements.statTotal) elements.statTotal.textContent = stats.total || 0;
      if (elements.statApproved) elements.statApproved.textContent = stats.approved || 0;
      if (elements.statPending) elements.statPending.textContent = stats.pending || 0;
      if (elements.statOther) elements.statOther.textContent = stats.rejected_or_inactive || 0;

      // Update Filter Tab Badges
      if (elements.badgeAll) elements.badgeAll.textContent = stats.total || 0;
      if (elements.badgeApproved) elements.badgeApproved.textContent = stats.approved || 0;
      if (elements.badgePending) elements.badgePending.textContent = stats.pending || 0;
      if (elements.badgeOther) elements.badgeOther.textContent = stats.rejected_or_inactive || 0;

      // Render packages table
      renderPackagesTable();
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      showToast('Error loading provider data: ' + err.message, 'error');
      if (elements.packagesTableBody) {
        elements.packagesTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 3rem; color: #C62828;">
              <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
              Unable to load packages from MySQL. Verify server connection.
            </td>
          </tr>
        `;
      }
    }
  }

  /**
   * Filter and sort packages, then render DOM table rows
   */
  function renderPackagesTable() {
    if (!elements.packagesTableBody) return;

    // Filter by status tab
    let filtered = allPackages.filter(pkg => {
      const status = (pkg.status || '').toUpperCase();
      if (currentStatusFilter === 'APPROVED') return status === 'APPROVED';
      if (currentStatusFilter === 'PENDING') return status === 'PENDING';
      if (currentStatusFilter === 'OTHER') return status === 'REJECTED' || status === 'INACTIVE';
      return true; // 'all'
    });

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(pkg => {
        return (
          (pkg.title && pkg.title.toLowerCase().includes(q)) ||
          (pkg.destination_name && pkg.destination_name.toLowerCase().includes(q)) ||
          (pkg.city && pkg.city.toLowerCase().includes(q)) ||
          (pkg.category_name && pkg.category_name.toLowerCase().includes(q))
        );
      });
    }

    // Sort packages
    const sortVal = elements.sortSelect ? elements.sortSelect.value : 'newest';
    filtered.sort((a, b) => {
      if (sortVal === 'price_asc') return parseFloat(a.price) - parseFloat(b.price);
      if (sortVal === 'price_desc') return parseFloat(b.price) - parseFloat(a.price);
      if (sortVal === 'duration_asc') return parseInt(a.duration_days, 10) - parseInt(b.duration_days, 10);
      if (sortVal === 'duration_desc') return parseInt(b.duration_days, 10) - parseInt(a.duration_days, 10);
      // default: newest first
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    // Update match counter
    if (elements.packagesCountDisplay) {
      elements.packagesCountDisplay.textContent = `Showing ${filtered.length} of ${allPackages.length} package${allPackages.length === 1 ? '' : 's'}`;
    }

    // Empty state handling
    if (filtered.length === 0) {
      elements.packagesTableBody.innerHTML = '';
      if (elements.packagesEmptyState) {
        elements.packagesEmptyState.hidden = false;
      }
      return;
    }

    if (elements.packagesEmptyState) {
      elements.packagesEmptyState.hidden = true;
    }

    // Build rows
    elements.packagesTableBody.innerHTML = filtered.map(pkg => {
      const status = (pkg.status || 'PENDING').toUpperCase();
      let statusClass = 'status-pending';
      let statusLabel = 'Under Review';

      if (status === 'APPROVED') {
        statusClass = 'status-approved';
        statusLabel = 'Published';
      } else if (status === 'INACTIVE') {
        statusClass = 'status-inactive';
        statusLabel = 'Inactive';
      } else if (status === 'REJECTED') {
        statusClass = 'status-rejected';
        statusLabel = 'Rejected';
      }

      const availCount = Number(pkg.upcoming_availability_count) || 0;
      const itinDays = Number(pkg.itinerary_count) || Number(pkg.duration_days) || 1;
      const imageUrl = pkg.image || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';

      return `
        <tr data-package-id="${pkg.package_id}">
          <td>
            <div class="pkg-cell">
              <img 
                src="${imageUrl}" 
                alt="${escapeHTML(pkg.title)}" 
                class="pkg-thumb"
                onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';"
              >
              <div class="pkg-meta">
                <span class="pkg-title">${escapeHTML(pkg.title)}</span>
                <span class="pkg-submeta">
                  <span>⏱️ ${pkg.duration_days} Days / ${Math.max(1, pkg.duration_days - 1)} Nights</span>
                  <span>•</span>
                  <span>👥 Cap: ${pkg.capacity}</span>
                </span>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${escapeHTML(pkg.destination_name || 'Regional Destination')}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(pkg.city || '')}${pkg.state ? `, ${escapeHTML(pkg.state)}` : ''}</div>
          </td>
          <td>
            <span style="display: inline-block; font-size: 0.8rem; background: var(--bg-surface-soft); padding: 0.25rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); color: var(--primary);">
              ${escapeHTML(pkg.category_name || 'Tours')}
            </span>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">${formatINR(pkg.price)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">per traveler</div>
          </td>
          <td>
            <button 
              type="button" 
              class="action-link-btn btn-availability" 
              data-action="manage-avail" 
              data-package-id="${pkg.package_id}"
              data-package-title="${escapeHTML(pkg.title)}"
              title="Click to view & add departure dates"
            >
              📅 ${availCount} Date${availCount === 1 ? '' : 's'}
            </button>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="provider-action-group">
              <button 
                type="button" 
                class="action-link-btn btn-availability"
                data-action="manage-avail"
                data-package-id="${pkg.package_id}"
                data-package-title="${escapeHTML(pkg.title)}"
                title="Manage Dates & Seats"
              >
                📅 Availability
              </button>

              <a 
                href="../package-details.html?id=${pkg.package_id}" 
                target="_blank" 
                class="action-link-btn" 
                title="View Public Listing"
              >
                🔗 View
              </a>

              <button 
                type="button" 
                class="action-link-btn btn-toggle"
                data-action="toggle-status"
                data-package-id="${pkg.package_id}"
                data-current-status="${status}"
                title="${status === 'APPROVED' ? 'Pause package' : 'Make Active'}"
              >
                ${status === 'APPROVED' ? '⏸️ Pause' : '▶️ Activate'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row action listeners
    attachTableActionListeners();
  }

  /**
   * Safe HTML string escaping
   */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Row actions (Availability modal, Status toggle)
   */
  function attachTableActionListeners() {
    // Availability modal triggers
    const availBtns = elements.packagesTableBody.querySelectorAll('[data-action="manage-avail"]');
    availBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const packageId = btn.getAttribute('data-package-id');
        const packageTitle = btn.getAttribute('data-package-title');
        openAvailabilityModal(packageId, packageTitle);
      });
    });

    // Status toggle buttons
    const toggleBtns = elements.packagesTableBody.querySelectorAll('[data-action="toggle-status"]');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const packageId = btn.getAttribute('data-package-id');
        const currentStatus = btn.getAttribute('data-current-status');
        const newStatus = currentStatus === 'APPROVED' ? 'INACTIVE' : 'APPROVED';

        btn.disabled = true;
        btn.textContent = 'Updating…';

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
          btn.disabled = false;
          btn.textContent = currentStatus === 'APPROVED' ? '⏸️ Pause' : '▶️ Activate';
        }
      });
    });
  }

  /**
   * Open & load Availability Modal for a package
   */
  async function openAvailabilityModal(packageId, packageTitle) {
    activeAvailabilityPackageId = packageId;
    if (elements.availPkgTitle) {
      elements.availPkgTitle.textContent = packageTitle || `Package #${packageId}`;
    }

    // Set min date to today for the date picker
    if (elements.availDateInput) {
      const today = new Date().toISOString().split('T')[0];
      elements.availDateInput.min = today;
      elements.availDateInput.value = '';
    }

    if (elements.availModal) {
      elements.availModal.classList.add('active');
    }

    loadPackageAvailability(packageId);
  }

  /**
   * Close Availability Modal
   */
  function closeAvailabilityModal() {
    if (elements.availModal) {
      elements.availModal.classList.remove('active');
    }
    activeAvailabilityPackageId = null;
  }

  /**
   * Load availability entries for modal
   */
  async function loadPackageAvailability(packageId) {
    if (!elements.availList) return;
    elements.availList.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">Loading departure dates…</div>';

    try {
      const res = await fetch(`/api/provider/packages/${packageId}/availability`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const dates = json.data || [];

      if (dates.length === 0) {
        elements.availList.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--text-secondary); background: var(--bg-surface-soft); border-radius: var(--radius-sm);">
            No departure dates scheduled yet. Add an available departure date below.
          </div>
        `;
        return;
      }

      elements.availList.innerHTML = dates.map(d => {
        return `
          <div class="avail-item">
            <div>
              <span class="avail-date-text">📅 ${formatDate(d.available_date)}</span>
              <span style="margin-left: 0.5rem; font-size: 0.78rem; color: var(--text-muted);">(${d.available_date})</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="avail-seats-badge">🪑 ${d.seats_available} seats open</span>
              <button 
                type="button" 
                class="avail-del-btn" 
                data-avail-id="${d.availability_id}"
                title="Remove departure date"
              >
                🗑️
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Delete date listeners
      const delBtns = elements.availList.querySelectorAll('.avail-del-btn');
      delBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
          const availId = btn.getAttribute('data-avail-id');
          if (!confirm('Remove this departure date from public booking?')) return;

          btn.disabled = true;
          try {
            const delRes = await fetch(`/api/provider/availability/${availId}`, {
              method: 'DELETE'
            });
            if (!delRes.ok) throw new Error('Delete failed');
            showToast('Departure date removed.');
            loadPackageAvailability(packageId);
            loadDashboardData(currentProviderId);
          } catch (err) {
            showToast('Failed to remove departure date.', 'error');
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      elements.availList.innerHTML = `<div style="padding: 1rem; color: #C62828;">Error loading availability: ${err.message}</div>`;
    }
  }

  /**
   * Handle adding new availability date
   */
  async function handleAddAvailabilitySubmit(e) {
    e.preventDefault();
    if (!activeAvailabilityPackageId) return;

    const dateVal = elements.availDateInput ? elements.availDateInput.value : '';
    const seatsVal = elements.availSeatsInput ? parseInt(elements.availSeatsInput.value, 10) : 10;

    if (!dateVal) {
      showToast('Please pick a departure date.', 'error');
      return;
    }
    if (isNaN(seatsVal) || seatsVal <= 0) {
      showToast('Please specify available seat count (1 or more).', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/provider/packages/${activeAvailabilityPackageId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          available_date: dateVal,
          seats_available: seatsVal,
          status: 'AVAILABLE'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to save date');

      showToast('Departure date scheduled successfully.');
      if (elements.availDateInput) elements.availDateInput.value = '';
      loadPackageAvailability(activeAvailabilityPackageId);
      loadDashboardData(currentProviderId);
    } catch (err) {
      showToast('Error saving date: ' + err.message, 'error');
    }
  }

  /**
   * Open & Close "Create New Package" Modal
   */
  function openCreateModal() {
    if (elements.createModal) {
      elements.createModal.classList.add('active');
    }
  }

  function closeCreateModal() {
    if (elements.createModal) {
      elements.createModal.classList.remove('active');
    }
    if (elements.createForm) {
      elements.createForm.reset();
    }
  }

  /**
   * Handle Package Creation Form Submission
   */
  async function handleCreatePackageSubmit(e) {
    e.preventDefault();
    const form = elements.createForm;
    if (!form) return;

    const title = form.title.value.trim();
    const destination_id = form.destination_id.value;
    const category_id = form.category_id.value;
    const duration_days = parseInt(form.duration_days.value, 10);
    const price = parseFloat(form.price.value);
    const capacity = parseInt(form.capacity.value, 10);
    const image = form.image.value.trim();
    const description = form.description.value.trim();
    const initial_date = form.initial_date.value;

    if (title.length < 5) {
      showToast('Title must be at least 5 characters.', 'error');
      return;
    }
    if (!destination_id) {
      showToast('Please select a destination.', 'error');
      return;
    }
    if (!category_id) {
      showToast('Please select a tour category.', 'error');
      return;
    }
    if (isNaN(duration_days) || duration_days <= 0) {
      showToast('Duration must be at least 1 day.', 'error');
      return;
    }
    if (isNaN(price) || price < 0) {
      showToast('Valid package price is required.', 'error');
      return;
    }
    if (isNaN(capacity) || capacity <= 0) {
      showToast('Valid capacity is required.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting package…';
    }

    try {
      const res = await fetch('/api/provider/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: currentProviderId,
          destination_id,
          category_id,
          title,
          description,
          duration_days,
          price,
          capacity,
          image,
          initial_date
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Creation failed');

      showToast('🎉 Tour package created! Submitted for administrator approval.');
      closeCreateModal();
      loadDashboardData(currentProviderId);
    } catch (err) {
      showToast('Error creating package: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Package for Review';
      }
    }
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    // Refresh button
    if (elements.btnRefresh) {
      elements.btnRefresh.addEventListener('click', () => {
        loadDashboardData(currentProviderId);
        showToast('Dashboard refreshed from MySQL.');
      });
    }

    // Status filter tabs
    elements.statusTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.statusTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentStatusFilter = tab.getAttribute('data-status') || 'all';
        renderPackagesTable();
      });
    });

    // Search input (with debounce)
    if (elements.searchInput) {
      let timeout = null;
      elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          searchQuery = e.target.value.trim();
          renderPackagesTable();
        }, 200);
      });
    }

    // Sort select
    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', () => {
        renderPackagesTable();
      });
    }

    // Create Package Modal triggers
    if (elements.btnOpenCreate) {
      elements.btnOpenCreate.addEventListener('click', openCreateModal);
    }
    if (elements.btnCloseCreate) {
      elements.btnCloseCreate.addEventListener('click', closeCreateModal);
    }
    if (elements.btnCancelCreate) {
      elements.btnCancelCreate.addEventListener('click', closeCreateModal);
    }
    if (elements.createForm) {
      elements.createForm.addEventListener('submit', handleCreatePackageSubmit);
    }

    // Availability Modal triggers
    if (elements.btnCloseAvail) {
      elements.btnCloseAvail.addEventListener('click', closeAvailabilityModal);
    }
    if (elements.availAddForm) {
      elements.availAddForm.addEventListener('submit', handleAddAvailabilitySubmit);
    }

    // Backdrop click to close modals
    window.addEventListener('click', (e) => {
      if (e.target === elements.createModal) closeCreateModal();
      if (e.target === elements.availModal) closeAvailabilityModal();
    });

    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCreateModal();
        closeAvailabilityModal();
      }
    });
  }

  /**
   * Initialize on DOM Ready
   */
  document.addEventListener('DOMContentLoaded', () => {
    initCurrentProvider();
    setupEventListeners();
    loadProvidersList();
    loadFormMetadata();
    loadDashboardData(currentProviderId);
  });
})();
