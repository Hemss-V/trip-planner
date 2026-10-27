/**
 * Roamly - Packages Exploration Script
 * Member 2: Destinations & Tour Package Discovery
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Read initial query params from URL
  const urlParams = new URLSearchParams(window.location.search);

  const filterState = {
    search: urlParams.get('search') || '',
    destination: urlParams.get('destination') || '',
    category: urlParams.get('category') || '',
    minPrice: urlParams.get('minPrice') || '',
    maxPrice: urlParams.get('maxPrice') || '',
    minDuration: urlParams.get('minDuration') || '',
    maxDuration: urlParams.get('maxDuration') || '',
    date: urlParams.get('date') || '',
    sort: urlParams.get('sort') || 'recommended'
  };

  // DOM Elements
  const packagesGrid = document.getElementById('packages-page-grid');
  const resultsCountEl = document.getElementById('results-count');
  const activeFiltersEl = document.getElementById('active-filters');

  const filterSearchInput = document.getElementById('filter-search');
  const filterDestSelect = document.getElementById('filter-destination');
  const filterCatSelect = document.getElementById('filter-category');
  const filterMinPrice = document.getElementById('filter-min-price');
  const filterMaxPrice = document.getElementById('filter-max-price');
  const filterDurationSelect = document.getElementById('filter-duration');
  const filterDateInput = document.getElementById('filter-date');
  const filterSortSelect = document.getElementById('filter-sort');
  const filterResetBtn = document.getElementById('filter-reset-btn');

  // Modal Elements
  const packageModal = document.getElementById('package-modal');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Mobile Menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // Pre-fill controls with initial values
  if (filterSearchInput && filterState.search) filterSearchInput.value = filterState.search;
  if (filterMinPrice && filterState.minPrice) filterMinPrice.value = filterState.minPrice;
  if (filterMaxPrice && filterState.maxPrice) filterMaxPrice.value = filterState.maxPrice;
  if (filterDateInput && filterState.date) filterDateInput.value = filterState.date;
  if (filterSortSelect && filterState.sort) filterSortSelect.value = filterState.sort;

  if (filterDurationSelect) {
    if (filterState.minDuration === '1' && filterState.maxDuration === '3') {
      filterDurationSelect.value = '1-3';
    } else if (filterState.minDuration === '4' && filterState.maxDuration === '5') {
      filterDurationSelect.value = '4-5';
    } else if (filterState.minDuration === '6') {
      filterDurationSelect.value = '6+';
    }
  }

  // Render Skeletons
  function renderSkeletons() {
    if (!packagesGrid) return;
    packagesGrid.innerHTML = Array(6).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line lg"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>
      </div>
    `).join('');
  }

  // Populate Dropdowns
  async function initDropdowns() {
    try {
      const [destinations, categories] = await Promise.all([
        fetchDestinations(),
        fetchCategories()
      ]);

      if (filterDestSelect && destinations) {
        destinations.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.destination_id;
          opt.textContent = `${d.name} (${d.state})`;
          filterDestSelect.appendChild(opt);
        });
        if (filterState.destination) {
          filterDestSelect.value = filterState.destination;
        }
      }

      if (filterCatSelect && categories) {
        categories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.category_id;
          opt.textContent = c.category_name;
          filterCatSelect.appendChild(opt);
        });
        if (filterState.category) {
          filterCatSelect.value = filterState.category;
        }
      }
    } catch (err) {
      console.error('Failed to populate filter dropdowns:', err);
    }
  }

  // Update browser URL query string non-destructively
  function syncURL() {
    const params = new URLSearchParams();
    if (filterState.search) params.set('search', filterState.search);
    if (filterState.destination) params.set('destination', filterState.destination);
    if (filterState.category) params.set('category', filterState.category);
    if (filterState.minPrice) params.set('minPrice', filterState.minPrice);
    if (filterState.maxPrice) params.set('maxPrice', filterState.maxPrice);
    if (filterState.minDuration) params.set('minDuration', filterState.minDuration);
    if (filterState.maxDuration) params.set('maxDuration', filterState.maxDuration);
    if (filterState.date) params.set('date', filterState.date);
    if (filterState.sort && filterState.sort !== 'recommended') params.set('sort', filterState.sort);

    const newQuery = params.toString();
    const newURL = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
    window.history.replaceState({}, '', newURL);
  }

  // Load and render packages
  async function loadPackages() {
    renderSkeletons();
    updateActiveFilterTags();
    syncURL();

    try {
      const packages = await fetchPackages(filterState);
      if (!packagesGrid) return;

      if (resultsCountEl) {
        resultsCountEl.innerHTML = `Showing <span>${packages.length}</span> ${packages.length === 1 ? 'package' : 'packages'} found`;
      }

      if (!packages || packages.length === 0) {
        packagesGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-icon">🎒</div>
            <h3 class="empty-title">No Matching Tour Packages</h3>
            <p class="empty-desc">We couldn't find any tour packages matching your selected filters. Try loosening your criteria or resetting filters.</p>
            <button class="btn btn-primary" id="empty-reset-btn">Reset All Filters</button>
          </div>
        `;
        const resetBtn = document.getElementById('empty-reset-btn');
        if (resetBtn) {
          resetBtn.addEventListener('click', resetAllFilters);
        }
        return;
      }

      packagesGrid.innerHTML = '';
      packages.forEach(pkg => {
        const card = createPackageCard(pkg);
        packagesGrid.appendChild(card);
      });
    } catch (err) {
      if (packagesGrid) {
        packagesGrid.innerHTML = `
          <div class="error-banner" style="grid-column: 1 / -1;">
            <strong>Unable to load packages.</strong> Please ensure the server and database are running.
          </div>
        `;
      }
    }
  }

  function createPackageCard(pkg) {
    const card = document.createElement('article');
    card.className = 'package-card';

    const fallbackImage = FALLBACK_IMAGES.package;
    const seatsInfo = pkg.total_seats_available > 0 
      ? `<span class="package-pill-seats">${pkg.total_seats_available} Seats Left</span>` 
      : '';

    card.innerHTML = `
      <div class="package-img-wrap">
        <img class="package-img" 
             src="${pkg.image || fallbackImage}" 
             alt="${pkg.title}" 
             loading="lazy"
             onerror="this.onerror=null; this.src='${fallbackImage}'">
        <span class="package-pill-category">${pkg.category_name || 'Tour'}</span>
        <span class="package-pill-duration">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${pkg.duration_days} ${pkg.duration_days === 1 ? 'Day' : 'Days'}
        </span>
        ${seatsInfo}
      </div>
      <div class="package-body">
        <div class="package-destination">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${pkg.destination_name} (${pkg.city})</span>
        </div>
        <h3 class="package-title">${pkg.title}</h3>
        <p class="package-desc">${pkg.description}</p>
        <div class="package-provider">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>By ${pkg.provider_name || 'Licensed Regional Partner'}</span>
        </div>
        <div class="package-footer">
          <div class="package-pricing">
            <span class="package-price-label">Price per traveler</span>
            <div class="package-price-val">${formatINR(pkg.price)} <span>/ person</span></div>
          </div>
          <button class="btn btn-primary btn-sm view-details-btn" data-package-id="${pkg.package_id}">
            View Details
          </button>
        </div>
      </div>
    `;

    const viewBtn = card.querySelector('.view-details-btn');
    viewBtn.addEventListener('click', () => {
      openPackageModal(pkg.package_id);
    });

    return card;
  }

  // Active filter tags
  function updateActiveFilterTags() {
    if (!activeFiltersEl) return;
    activeFiltersEl.innerHTML = '';
    const tags = [];

    if (filterState.search) tags.push({ label: `Search: "${filterState.search}"`, key: 'search' });
    if (filterState.destination && filterDestSelect) {
      const selectedOpt = filterDestSelect.options[filterDestSelect.selectedIndex];
      if (selectedOpt && selectedOpt.value) tags.push({ label: `Destination: ${selectedOpt.textContent}`, key: 'destination' });
    }
    if (filterState.category && filterCatSelect) {
      const selectedOpt = filterCatSelect.options[filterCatSelect.selectedIndex];
      if (selectedOpt && selectedOpt.value) tags.push({ label: `Category: ${selectedOpt.textContent}`, key: 'category' });
    }
    if (filterState.minPrice) tags.push({ label: `Min: ${formatINR(filterState.minPrice)}`, key: 'minPrice' });
    if (filterState.maxPrice) tags.push({ label: `Max: ${formatINR(filterState.maxPrice)}`, key: 'maxPrice' });
    if (filterState.minDuration || filterState.maxDuration) {
      let durText = 'Duration';
      if (filterState.minDuration && filterState.maxDuration) durText = `${filterState.minDuration}-${filterState.maxDuration} Days`;
      else if (filterState.minDuration) durText = `≥ ${filterState.minDuration} Days`;
      else if (filterState.maxDuration) durText = `≤ ${filterState.maxDuration} Days`;
      tags.push({ label: durText, key: 'duration' });
    }
    if (filterState.date) tags.push({ label: `Date: ${formatDate(filterState.date)}`, key: 'date' });

    tags.forEach(t => {
      const tag = document.createElement('span');
      tag.className = 'filter-tag';
      tag.innerHTML = `
        ${t.label}
        <span class="filter-tag-remove" data-key="${t.key}" title="Remove filter">&times;</span>
      `;
      tag.querySelector('.filter-tag-remove').addEventListener('click', () => {
        removeFilter(t.key);
      });
      activeFiltersEl.appendChild(tag);
    });
  }

  function removeFilter(key) {
    if (key === 'search') { filterState.search = ''; if (filterSearchInput) filterSearchInput.value = ''; }
    else if (key === 'destination') { filterState.destination = ''; if (filterDestSelect) filterDestSelect.value = ''; }
    else if (key === 'category') { filterState.category = ''; if (filterCatSelect) filterCatSelect.value = ''; }
    else if (key === 'minPrice') { filterState.minPrice = ''; if (filterMinPrice) filterMinPrice.value = ''; }
    else if (key === 'maxPrice') { filterState.maxPrice = ''; if (filterMaxPrice) filterMaxPrice.value = ''; }
    else if (key === 'duration') { filterState.minDuration = ''; filterState.maxDuration = ''; if (filterDurationSelect) filterDurationSelect.value = ''; }
    else if (key === 'date') { filterState.date = ''; if (filterDateInput) filterDateInput.value = ''; }
    loadPackages();
  }

  function resetAllFilters() {
    filterState.search = '';
    filterState.destination = '';
    filterState.category = '';
    filterState.minPrice = '';
    filterState.maxPrice = '';
    filterState.minDuration = '';
    filterState.maxDuration = '';
    filterState.date = '';
    filterState.sort = 'recommended';

    if (filterSearchInput) filterSearchInput.value = '';
    if (filterDestSelect) filterDestSelect.value = '';
    if (filterCatSelect) filterCatSelect.value = '';
    if (filterMinPrice) filterMinPrice.value = '';
    if (filterMaxPrice) filterMaxPrice.value = '';
    if (filterDurationSelect) filterDurationSelect.value = '';
    if (filterDateInput) filterDateInput.value = '';
    if (filterSortSelect) filterSortSelect.value = 'recommended';

    loadPackages();
  }

  // Filter Listeners
  if (filterResetBtn) filterResetBtn.addEventListener('click', resetAllFilters);

  let searchTimeout = null;
  if (filterSearchInput) {
    filterSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterState.search = e.target.value.trim();
        loadPackages();
      }, 250);
    });
  }

  if (filterDestSelect) {
    filterDestSelect.addEventListener('change', (e) => {
      filterState.destination = e.target.value;
      loadPackages();
    });
  }

  if (filterCatSelect) {
    filterCatSelect.addEventListener('change', (e) => {
      filterState.category = e.target.value;
      loadPackages();
    });
  }

  if (filterMinPrice) {
    filterMinPrice.addEventListener('input', (e) => {
      filterState.minPrice = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(loadPackages, 350);
    });
  }

  if (filterMaxPrice) {
    filterMaxPrice.addEventListener('input', (e) => {
      filterState.maxPrice = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(loadPackages, 350);
    });
  }

  if (filterDurationSelect) {
    filterDurationSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === '1-3') { filterState.minDuration = 1; filterState.maxDuration = 3; }
      else if (val === '4-5') { filterState.minDuration = 4; filterState.maxDuration = 5; }
      else if (val === '6+') { filterState.minDuration = 6; filterState.maxDuration = ''; }
      else { filterState.minDuration = ''; filterState.maxDuration = ''; }
      loadPackages();
    });
  }

  if (filterDateInput) {
    filterDateInput.addEventListener('change', (e) => {
      filterState.date = e.target.value;
      loadPackages();
    });
  }

  if (filterSortSelect) {
    filterSortSelect.addEventListener('change', (e) => {
      filterState.sort = e.target.value;
      loadPackages();
    });
  }

  // Modal handlers
  async function openPackageModal(packageId) {
    if (!packageModal || !modalBody) return;
    packageModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    modalBody.innerHTML = `
      <div style="padding: 3rem; text-align: center;">
        <div class="skeleton skeleton-line lg" style="margin: 0 auto 1.5rem auto;"></div>
        <div class="skeleton skeleton-line" style="margin: 0 auto 1rem auto; width: 60%;"></div>
        <p style="color: var(--text-muted); margin-top: 1rem;">Loading tour package details...</p>
      </div>
    `;

    try {
      const pkg = await fetchPackageById(packageId);

      let itineraryHtml = '';
      if (pkg.itinerary && pkg.itinerary.length > 0) {
        itineraryHtml = `
          <div class="itinerary-section">
            <h3 style="margin-bottom: 0.5rem;">Day-by-Day Itinerary</h3>
            <p style="color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 1.5rem;">
              Carefully organized schedule crafted for an immersive and relaxing experience.
            </p>
            <div class="timeline">
              ${pkg.itinerary.map(item => `
                <div class="timeline-step">
                  <div class="timeline-marker">${item.day_no}</div>
                  <div class="timeline-content">
                    <span class="timeline-day-tag">Day ${item.day_no}</span>
                    <h4 class="timeline-title">${item.title}</h4>
                    <p class="timeline-desc">${item.description || 'Guided activities and local discovery.'}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      let availabilityHtml = '';
      if (pkg.availability && pkg.availability.length > 0) {
        availabilityHtml = `
          <div style="margin-top: 2rem;">
            <h4 style="font-size: 1.1rem; margin-bottom: 0.75rem;">Upcoming Departure Dates</h4>
            <div class="availability-list">
              ${pkg.availability.map(avail => `
                <div class="availability-item">
                  <div class="availability-date">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>${formatDate(avail.available_date)}</span>
                  </div>
                  <span class="availability-seats">${avail.seats_available} Seats Available</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      modalBody.innerHTML = `
        <div style="position: relative; height: 320px; overflow: hidden;">
          <img src="${pkg.image || FALLBACK_IMAGES.package}" 
               alt="${pkg.title}" 
               style="width: 100%; height: 100%; object-fit: cover;"
               onerror="this.onerror=null; this.src='${FALLBACK_IMAGES.package}'">
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(18,38,28,0.85), transparent); padding: 2rem 2rem 1.25rem;">
            <span class="hero-tag" style="margin-bottom: 0.5rem;">${pkg.category_name}</span>
            <h2 style="color: #fff; margin-bottom: 0.25rem; font-size: 1.85rem;">${pkg.title}</h2>
            <div style="color: rgba(255,255,255,0.9); font-size: 0.92rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>📍 ${pkg.destination_name} (${pkg.city}, ${pkg.state})</span>
              <span>•</span>
              <span>🕒 ${pkg.duration_days} Days / ${Math.max(1, pkg.duration_days - 1)} Nights</span>
            </div>
          </div>
        </div>

        <div style="padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface-soft); padding: 1.25rem 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
            <div>
              <span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Price per traveler</span>
              <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary);">${formatINR(pkg.price)} <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted);">/ person</span></div>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <a href="package-details.html?id=${pkg.package_id}" class="btn btn-outline btn-sm" target="_blank">
                Full Page ↗
              </a>
              <button class="btn btn-terracotta btn-sm book-handoff-btn" data-package-id="${pkg.package_id}">
                Book This Package
              </button>
            </div>
          </div>

          <div style="margin-bottom: 2rem;">
            <h4 style="font-size: 1.15rem; margin-bottom: 0.6rem;">Trip Overview</h4>
            <p style="color: var(--text-secondary); line-height: 1.65;">${pkg.description}</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-sm);">
            <div>
              <span class="detail-meta-label">Provider</span>
              <div class="detail-meta-value">${pkg.provider_name || 'Roamly Partner'}</div>
            </div>
            <div>
              <span class="detail-meta-label">Group Capacity</span>
              <div class="detail-meta-value">Up to ${pkg.capacity} Travelers</div>
            </div>
            <div>
              <span class="detail-meta-label">Destination</span>
              <div class="detail-meta-value">${pkg.city}, ${pkg.state}</div>
            </div>
          </div>

          ${itineraryHtml}
          ${availabilityHtml}

          <!-- Booking Handoff Banner -->
          <div class="booking-handoff-banner" id="handoff-notice" style="display: none;">
            <div class="booking-handoff-icon">ℹ️</div>
            <div class="booking-handoff-text">
              <h4>Booking Module Handoff Notice</h4>
              <p>
                You are ready to book <strong>${pkg.title}</strong> (ID: #${pkg.package_id}). 
                This package discovery module successfully packages the selection. Booking and payment processing are handled by Member 3's module upon team integration.
              </p>
            </div>
          </div>
        </div>
      `;

      const bookBtn = modalBody.querySelector('.book-handoff-btn');
      if (bookBtn) {
        bookBtn.addEventListener('click', () => {
          const notice = modalBody.querySelector('#handoff-notice');
          if (notice) {
            notice.style.display = 'flex';
            notice.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    } catch (err) {
      modalBody.innerHTML = `
        <div style="padding: 3rem; text-align: center;">
          <h3 style="color: #721C24;">Failed to Load Package Details</h3>
          <p style="color: var(--text-muted); margin: 1rem 0;">Please check your connection and try again.</p>
          <button class="btn btn-primary" onclick="document.getElementById('package-modal').classList.remove('active')">Close</button>
        </div>
      `;
    }
  }

  function closeModal() {
    if (packageModal) {
      packageModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (packageModal) {
    packageModal.addEventListener('click', (e) => {
      if (e.target === packageModal) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && packageModal && packageModal.classList.contains('active')) {
      closeModal();
    }
  });

  // Init
  await initDropdowns();
  await loadPackages();
});
