/**
 * Roamly - Standalone Package Details Script
 * Member 2: Destinations & Tour Package Discovery
 */

document.addEventListener('DOMContentLoaded', async () => {
  const contentEl = document.getElementById('package-detail-content');
  const breadcrumbTitle = document.getElementById('breadcrumb-package-title');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const packageId = urlParams.get('id');

  if (!packageId || isNaN(parseInt(packageId, 10))) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h2 class="empty-title">Invalid Package Selection</h2>
        <p class="empty-desc">No valid tour package ID was provided in the request URL.</p>
        <a href="packages.html" class="btn btn-primary">Browse All Tour Packages</a>
      </div>
    `;
    return;
  }

  try {
    const pkg = await fetchPackageById(packageId);

    if (breadcrumbTitle) {
      breadcrumbTitle.textContent = pkg.title;
    }
    document.title = `${pkg.title} — Roamly Tour Details`;

    // Itinerary Timeline
    let itineraryHtml = '';
    if (pkg.itinerary && pkg.itinerary.length > 0) {
      itineraryHtml = `
        <div class="itinerary-section" style="margin-top: 3.5rem;">
          <span class="section-tag">Day-by-Day Schedule</span>
          <h2 style="margin-bottom: 0.5rem;">Detailed Itinerary</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">
            Every day is thoughtfully planned to balance guided exploration, local flavor, and comfortable rest.
          </p>
          <div class="timeline">
            ${pkg.itinerary.map(item => `
              <div class="timeline-step">
                <div class="timeline-marker">${item.day_no}</div>
                <div class="timeline-content">
                  <span class="timeline-day-tag">Day ${item.day_no}</span>
                  <h3 class="timeline-title">${item.title}</h3>
                  <p class="timeline-desc">${item.description || 'Guided activities and local discovery.'}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      itineraryHtml = `
        <div class="itinerary-section" style="margin-top: 3rem; background: var(--bg-surface); padding: 2rem; border-radius: var(--radius-md); border: 1px solid var(--border-card); text-align: center;">
          <h3>Itinerary In Preparation</h3>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">The day-by-day itinerary schedule for this tour package will be updated shortly.</p>
        </div>
      `;
    }

    // Availability Dates
    let availabilityHtml = '';
    if (pkg.availability && pkg.availability.length > 0) {
      availabilityHtml = `
        <div style="background: var(--bg-surface); border-radius: var(--radius-md); padding: 1.75rem; border: 1px solid var(--border-card); margin-top: 2rem;">
          <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">Upcoming Departure Dates</h3>
          <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 1.25rem;">
            Select from upcoming scheduled group departures with verified seat availability:
          </p>
          <div class="availability-list">
            ${pkg.availability.map(avail => `
              <div class="availability-item">
                <div class="availability-date">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

    // Destination Info Card
    const destinationCardHtml = `
      <div style="background: var(--bg-surface); border-radius: var(--radius-md); padding: 1.75rem; border: 1px solid var(--border-card); margin-top: 2rem;">
        <span class="section-tag" style="margin-bottom: 0.5rem;">Destination Highlight</span>
        <h3 style="font-size: 1.35rem; margin-bottom: 0.5rem;">${pkg.destination_name}</h3>
        <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">
          ${pkg.destination_description || 'A timeless region filled with cultural depth, authentic cuisine, and natural beauty.'}
        </p>
        <div style="font-size: 0.88rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem;">
          <span>📍 Located in ${pkg.city}, ${pkg.state}, ${pkg.country || 'India'}</span>
        </div>
      </div>
    `;

    // Render full page
    contentEl.innerHTML = `
      <div class="detail-header-grid">
        <div class="detail-img-wrap">
          <img class="detail-img" 
               src="${pkg.image || FALLBACK_IMAGES.package}" 
               alt="${pkg.title}"
               onerror="this.onerror=null; this.src='${FALLBACK_IMAGES.package}'">
        </div>

        <div class="detail-summary-card">
          <div class="detail-badges">
            <span class="section-tag" style="margin-bottom: 0;">${pkg.category_name}</span>
            <span class="package-pill-duration" style="position: static; background: var(--primary);">
              🕒 ${pkg.duration_days} Days / ${Math.max(1, pkg.duration_days - 1)} Nights
            </span>
          </div>

          <h1 class="detail-title">${pkg.title}</h1>

          <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--sage-dark); font-weight: 600; margin-bottom: 1.25rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${pkg.destination_name} (${pkg.city}, ${pkg.state})</span>
          </div>

          <div class="detail-price-box">
            <div>
              <span class="package-price-label">Price per traveler</span>
              <div class="detail-price-amount">${formatINR(pkg.price)}</div>
            </div>
            <span style="font-size: 0.85rem; color: var(--text-muted);">Taxes & guidance included</span>
          </div>

          <div class="detail-meta-list">
            <div class="detail-meta-item">
              <span class="detail-meta-label">Tour Duration</span>
              <span class="detail-meta-value">${pkg.duration_days} Days</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Max Group Size</span>
              <span class="detail-meta-value">${pkg.capacity} Travelers</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Tour Category</span>
              <span class="detail-meta-value">${pkg.category_name}</span>
            </div>
            <div class="detail-meta-item">
              <span class="detail-meta-label">Organized By</span>
              <span class="detail-meta-value">${pkg.provider_name || 'Roamly Partner'}</span>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn btn-terracotta btn-lg" id="detail-book-btn" style="flex: 2;">
              Continue to Booking →
            </button>
            <a href="packages.html" class="btn btn-outline btn-lg" style="flex: 1;">
              Back
            </a>
          </div>

          <!-- Booking Handoff Notice -->
          <div class="booking-handoff-banner" id="detail-handoff-notice" style="display: none;">
            <div class="booking-handoff-icon">ℹ️</div>
            <div class="booking-handoff-text">
              <h4>Booking Module Handoff Notice</h4>
              <p>
                Package <strong>${pkg.title}</strong> (ID: #${pkg.package_id}) is confirmed. 
                Customer booking and payment transactions belong to Member 3's Booking & Payment module upon final group project assembly.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Description & Destination Info -->
      <div style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 2.5rem; align-items: start;">
        <div>
          <div style="background: var(--bg-surface); border-radius: var(--radius-md); padding: 2rem; border: 1px solid var(--border-card);">
            <h2 style="font-size: 1.6rem; margin-bottom: 0.85rem;">About This Experience</h2>
            <p style="color: var(--text-secondary); font-size: 1.05rem; line-height: 1.7; margin-bottom: 1.5rem;">
              ${pkg.description}
            </p>

            <div style="background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <h4 style="font-size: 0.95rem; margin-bottom: 0.4rem; color: var(--primary);">Operator Contact & Credentials</h4>
              <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                <strong>Operator:</strong> ${pkg.provider_name || 'Licensed Tour Operator'}
              </p>
              ${pkg.provider_email ? `<p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><strong>Email:</strong> ${pkg.provider_email}</p>` : ''}
              ${pkg.provider_mobile ? `<p style="font-size: 0.88rem; color: var(--text-secondary);"><strong>Mobile:</strong> ${pkg.provider_mobile}</p>` : ''}
            </div>
          </div>

          <!-- Day-by-Day Itinerary -->
          ${itineraryHtml}
        </div>

        <div>
          ${availabilityHtml}
          ${destinationCardHtml}
        </div>
      </div>
    `;

    // Hook book button
    const bookBtn = document.getElementById('detail-book-btn');
    if (bookBtn) {
      bookBtn.addEventListener('click', () => {
        const notice = document.getElementById('detail-handoff-notice');
        if (notice) {
          notice.style.display = 'flex';
          notice.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

  } catch (err) {
    contentEl.innerHTML = `
      <div class="error-banner">
        <strong>Error:</strong> Unable to load the requested package details from the database.
      </div>
      <div style="text-align: center; margin-top: 2rem;">
        <a href="packages.html" class="btn btn-primary">Return to Packages</a>
      </div>
    `;
  }
});
