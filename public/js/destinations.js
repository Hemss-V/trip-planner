/**
 * Roamly - Destinations Page Script
 * Member 2: Destinations & Tour Package Discovery
 */

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('destinations-page-grid');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  if (!grid) return;

  // Render skeleton
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line lg"></div>
        <div class="skeleton skeleton-line"></div>
      </div>
    </div>
  `).join('');

  try {
    const destinations = await fetchDestinations();

    if (!destinations || destinations.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📍</div>
          <h3 class="empty-title">No Destinations Registered</h3>
          <p class="empty-desc">Check back soon as new Indian travel destinations are added to our registry.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    destinations.forEach(dest => {
      const card = document.createElement('article');
      card.className = 'destination-card';

      const countText = dest.package_count === 1 ? '1 Curated Trip' : `${dest.package_count} Curated Trips`;
      const startingText = Number(dest.starting_price) > 0 ? `From ${formatINR(dest.starting_price)}` : 'Trips Available';
      const fallbackImage = FALLBACK_IMAGES.destination;

      card.innerHTML = `
        <div class="destination-img-wrap">
          <img class="destination-img" 
               src="${dest.image || fallbackImage}" 
               alt="${dest.name}" 
               loading="lazy"
               onerror="this.onerror=null; this.src='${fallbackImage}'">
          <span class="destination-badge">${countText}</span>
        </div>
        <div class="destination-content">
          <div class="destination-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${dest.city}, ${dest.state}, ${dest.country || 'India'}</span>
          </div>
          <h2 class="destination-name" style="font-size: 1.45rem;">${dest.name}</h2>
          <p class="destination-desc">${dest.description || 'Explore scenic landscapes and deep cultural heritage.'}</p>
          <div class="destination-footer">
            <div class="destination-price-info">
              <span class="destination-price-label">Starting from</span>
              <span class="destination-price-val">${startingText}</span>
            </div>
            <a href="packages.html?destination=${encodeURIComponent(dest.destination_id)}" class="btn btn-outline btn-sm">
              Explore Packages →
            </a>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `
      <div class="error-banner" style="grid-column: 1 / -1;">
        <strong>Error:</strong> Unable to retrieve destinations from the database.
      </div>
    `;
  }
});
