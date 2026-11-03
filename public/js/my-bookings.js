/**
 * Roamly — Member 2: Customer Booking History & Feedback Controller
 * Pure Vanilla JavaScript DOM manipulation & Fetch API
 */

(function () {
  'use strict';

  // State
  let currentCustomerId = 3; // Default to Aarav Sharma
  let allBookings = [];
  let currentFilter = 'all';

  // Active modal targets
  let pendingCancelBooking = null;
  let activeReviewBooking = null;

  // DOM Elements
  const el = {
    customerSelect: document.getElementById('history-customer-select'),
    btnRefresh: document.getElementById('btn-refresh-history'),
    listContainer: document.getElementById('bookings-list-container'),
    emptyState: document.getElementById('bookings-empty-state'),
    countLabel: document.getElementById('bookings-count-label'),
    filterTabs: document.querySelectorAll('.status-tab-btn'),

    // Metrics
    metricTotal: document.getElementById('metric-total-bookings'),
    metricUpcoming: document.getElementById('metric-upcoming-bookings'),
    metricCancelled: document.getElementById('metric-cancelled-bookings'),
    metricSpent: document.getElementById('metric-total-spent'),

    // Tab Badges
    badgeAll: document.getElementById('tab-count-all'),
    badgeConfirmed: document.getElementById('tab-count-confirmed'),
    badgeCompleted: document.getElementById('tab-count-completed'),
    badgeCancelled: document.getElementById('tab-count-cancelled'),

    // Review Modal
    reviewModal: document.getElementById('review-modal'),
    reviewPkgTitle: document.getElementById('review-pkg-title'),
    reviewForm: document.getElementById('review-form'),
    starPicker: document.getElementById('star-picker'),
    reviewRatingVal: document.getElementById('review-rating-val'),
    reviewComment: document.getElementById('review-comment'),
    btnCloseReview: document.getElementById('btn-close-review-modal'),
    btnCancelReview: document.getElementById('btn-cancel-review'),

    // Cancel Modal
    cancelModal: document.getElementById('cancel-modal'),
    cancelRef: document.getElementById('cancel-modal-ref'),
    cancelPkg: document.getElementById('cancel-modal-pkg'),
    cancelSeats: document.getElementById('cancel-modal-seats'),
    btnCloseCancel: document.getElementById('btn-close-cancel-modal'),
    btnAbortCancel: document.getElementById('btn-abort-cancel'),
    btnConfirmCancel: document.getElementById('btn-confirm-cancel'),

    // Toast
    toastBox: document.getElementById('history-toast-box')
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
   * Date formatter (e.g. "15 Nov 2026")
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
    if (!el.toastBox) return;
    const toast = document.createElement('div');
    toast.className = `provider-toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : '✅'}</span>
      <span>${message}</span>
    `;
    el.toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3500);
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
   * Load customer bookings from MySQL
   */
  async function loadCustomerBookings(customerId) {
    try {
      if (el.listContainer) {
        el.listContainer.innerHTML = `
          <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🧭</div>
            Loading your bookings from MySQL...
          </div>
        `;
      }

      const res = await fetch(`/api/customer/bookings?customer_id=${encodeURIComponent(customerId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      allBookings = json.data || [];

      updateMetrics();
      renderBookings();
    } catch (err) {
      console.error('Error loading bookings:', err);
      if (el.listContainer) {
        el.listContainer.innerHTML = `
          <div style="padding: 3rem; text-align: center; color: #C62828;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
            Unable to load reservations from database: ${escapeHTML(err.message)}
          </div>
        `;
      }
    }
  }

  /**
   * Compute metrics & badge counts
   */
  function updateMetrics() {
    let upcomingCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let totalSpent = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    allBookings.forEach(b => {
      const status = (b.booking_status || '').toUpperCase();
      if (status === 'CANCELLED') {
        cancelledCount++;
      } else {
        totalSpent += parseFloat(b.total_amount) || 0;
        if (b.available_date && b.available_date < todayStr) {
          completedCount++;
        } else {
          upcomingCount++;
        }
      }
    });

    if (el.metricTotal) el.metricTotal.textContent = allBookings.length;
    if (el.metricUpcoming) el.metricUpcoming.textContent = upcomingCount;
    if (el.metricCancelled) el.metricCancelled.textContent = cancelledCount;
    if (el.metricSpent) el.metricSpent.textContent = formatINR(totalSpent);

    if (el.badgeAll) el.badgeAll.textContent = allBookings.length;
    if (el.badgeConfirmed) el.badgeConfirmed.textContent = upcomingCount;
    if (el.badgeCompleted) el.badgeCompleted.textContent = completedCount;
    if (el.badgeCancelled) el.badgeCancelled.textContent = cancelledCount;
  }

  /**
   * Filter and render booking cards
   */
  function renderBookings() {
    if (!el.listContainer) return;

    const todayStr = new Date().toISOString().split('T')[0];

    let filtered = allBookings.filter(b => {
      const status = (b.booking_status || '').toUpperCase();
      if (currentFilter === 'CANCELLED') return status === 'CANCELLED';
      if (currentFilter === 'CONFIRMED') return status === 'CONFIRMED' && (!b.available_date || b.available_date >= todayStr);
      if (currentFilter === 'COMPLETED') return status === 'COMPLETED' || (status === 'CONFIRMED' && b.available_date && b.available_date < todayStr);
      return true; // 'all'
    });

    if (el.countLabel) {
      el.countLabel.textContent = `Showing ${filtered.length} of ${allBookings.length} booking${allBookings.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      el.listContainer.innerHTML = '';
      if (el.emptyState) el.emptyState.hidden = false;
      return;
    }

    if (el.emptyState) el.emptyState.hidden = true;

    el.listContainer.innerHTML = filtered.map(b => {
      const refCode = 'ROAM-' + String(b.booking_id).padStart(6, '0');
      const isCancelled = (b.booking_status === 'CANCELLED');
      const isPast = b.available_date && b.available_date < todayStr;
      
      let statusClass = 'status-approved';
      let statusText = 'CONFIRMED';

      if (isCancelled) {
        statusClass = 'status-rejected';
        statusText = 'CANCELLED & REFUNDED';
      } else if (isPast) {
        statusClass = 'status-inactive';
        statusText = 'COMPLETED TRIP';
      }

      const imageUrl = b.package_image || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';
      const hasReview = Boolean(b.review_id);

      return `
        <div class="booking-history-card" data-booking-id="${b.booking_id}">
          <div class="booking-card-media">
            <img 
              src="${imageUrl}" 
              alt="${escapeHTML(b.package_title)}" 
              class="booking-card-thumb"
              onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';"
            >
          </div>

          <div class="booking-card-body">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
              <div>
                <span style="font-family: monospace; font-size: 0.78rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em;">
                  REFERENCE: ${refCode}
                </span>
                <h3 style="font-family: var(--font-serif); font-size: 1.25rem; color: var(--primary); margin: 0.15rem 0;">
                  ${escapeHTML(b.package_title)}
                </h3>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  📍 ${escapeHTML(b.destination_name)} (${escapeHTML(b.destination_city)}, ${escapeHTML(b.destination_state)})
                </div>
              </div>

              <span class="status-pill ${statusClass}">${statusText}</span>
            </div>

            <!-- Booking Highlights Grid -->
            <div class="booking-highlights-row">
              <div class="highlight-item">
                <span class="highlight-label">Departure Date</span>
                <strong class="highlight-val" style="color: var(--terracotta);">
                  📅 ${formatDate(b.available_date)}
                </strong>
              </div>

              <div class="highlight-item">
                <span class="highlight-label">Party Size</span>
                <strong class="highlight-val">
                  👥 ${b.travelers} Traveler${b.travelers === 1 ? '' : 's'}
                </strong>
              </div>

              <div class="highlight-item">
                <span class="highlight-label">Duration</span>
                <strong class="highlight-val">
                  ⏱️ ${b.duration_days} Days
                </strong>
              </div>

              <div class="highlight-item">
                <span class="highlight-label">Total Paid</span>
                <strong class="highlight-val" style="color: var(--primary);">
                  ${formatINR(b.total_amount)}
                </strong>
              </div>
            </div>

            <!-- Existing Review Snippet -->
            ${hasReview ? `
              <div class="booking-review-snippet">
                <div style="display: flex; align-items: center; gap: 0.4rem; color: #F59E0B; font-size: 0.95rem;">
                  <span>${'★'.repeat(b.rating)}${'☆'.repeat(5 - b.rating)}</span>
                  <strong style="color: var(--text-primary); font-size: 0.82rem;">Your Verified Review:</strong>
                </div>
                <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">
                  "${escapeHTML(b.review_comment)}"
                </p>
              </div>
            ` : ''}

            <!-- Card Actions Row -->
            <div class="booking-card-actions">
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                Reserved on ${formatDate(b.booked_at)} via <strong>${b.payment_method || 'UPI'}</strong>
              </div>

              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <a 
                  href="../package-details.html?id=${b.package_id}" 
                  class="action-link-btn"
                  title="View complete tour itinerary"
                >
                  🔗 View Itinerary
                </a>

                ${!isCancelled ? `
                  <button 
                    type="button" 
                    class="action-link-btn" 
                    data-action="open-review" 
                    data-booking-id="${b.booking_id}"
                    data-title="${escapeHTML(b.package_title)}"
                    data-rating="${b.rating || 5}"
                    data-comment="${escapeHTML(b.review_comment || '')}"
                    style="border-color: #F59E0B; color: #B45309;"
                  >
                    ★ ${hasReview ? 'Edit Review' : 'Rate & Review'}
                  </button>

                  <button 
                    type="button" 
                    class="action-link-btn" 
                    data-action="open-cancel" 
                    data-booking-id="${b.booking_id}"
                    data-ref="${refCode}"
                    data-title="${escapeHTML(b.package_title)}"
                    data-seats="${b.travelers}"
                    style="border-color: #F5C6CB; color: #C62828;"
                  >
                    🗑️ Cancel Booking
                  </button>
                ` : ''}
              </div>
            </div>

          </div>
        </div>
      `;
    }).join('');

    attachActionListeners();
  }

  /**
   * Attach Action listeners (Review and Cancel modals)
   */
  function attachActionListeners() {
    // Review triggers
    const reviewBtns = el.listContainer.querySelectorAll('[data-action="open-review"]');
    reviewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const bookingId = btn.getAttribute('data-booking-id');
        const title = btn.getAttribute('data-title');
        const rating = parseInt(btn.getAttribute('data-rating'), 10) || 5;
        const comment = btn.getAttribute('data-comment') || '';

        activeReviewBooking = { bookingId, title };
        if (el.reviewPkgTitle) el.reviewPkgTitle.textContent = title;
        if (el.reviewComment) el.reviewComment.value = comment;
        setStarRating(rating);

        if (el.reviewModal) el.reviewModal.classList.add('active');
      });
    });

    // Cancel triggers
    const cancelBtns = el.listContainer.querySelectorAll('[data-action="open-cancel"]');
    cancelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const bookingId = btn.getAttribute('data-booking-id');
        const ref = btn.getAttribute('data-ref');
        const title = btn.getAttribute('data-title');
        const seats = btn.getAttribute('data-seats');

        pendingCancelBooking = { bookingId, ref, title, seats };
        if (el.cancelRef) el.cancelRef.textContent = ref;
        if (el.cancelPkg) el.cancelPkg.textContent = title;
        if (el.cancelSeats) el.cancelSeats.textContent = seats;

        if (el.cancelModal) el.cancelModal.classList.add('active');
      });
    });
  }

  /**
   * Star rating UI handler
   */
  function setStarRating(rating) {
    if (el.reviewRatingVal) el.reviewRatingVal.value = rating;
    if (!el.starPicker) return;

    const stars = el.starPicker.querySelectorAll('.star-item');
    stars.forEach(star => {
      const val = parseInt(star.getAttribute('data-value'), 10);
      star.classList.toggle('active', val <= rating);
    });
  }

  /**
   * Setup review modal interactions
   */
  function setupReviewModal() {
    if (el.starPicker) {
      const stars = el.starPicker.querySelectorAll('.star-item');
      stars.forEach(star => {
        star.addEventListener('click', () => {
          const val = parseInt(star.getAttribute('data-value'), 10);
          setStarRating(val);
        });
      });
    }

    if (el.reviewForm) {
      el.reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeReviewBooking) return;

        const rating = parseInt(el.reviewRatingVal.value, 10);
        const comment = el.reviewComment.value.trim();

        if (comment.length < 5) {
          showToast('Please write a review comment (at least 5 characters).', 'error');
          return;
        }

        const submitBtn = el.reviewForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting…';
        }

        try {
          const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              booking_id: activeReviewBooking.bookingId,
              rating: rating,
              comment: comment
            })
          });

          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Failed to submit review');

          showToast('⭐ Thank you! Your review has been saved to MySQL.');
          if (el.reviewModal) el.reviewModal.classList.remove('active');
          loadCustomerBookings(currentCustomerId);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Verified Review';
          }
        }
      });
    }

    if (el.btnCloseReview) {
      el.btnCloseReview.addEventListener('click', () => {
        if (el.reviewModal) el.reviewModal.classList.remove('active');
      });
    }
    if (el.btnCancelReview) {
      el.btnCancelReview.addEventListener('click', () => {
        if (el.reviewModal) el.reviewModal.classList.remove('active');
      });
    }
  }

  /**
   * Setup cancellation modal interactions
   */
  function setupCancelModal() {
    if (el.btnConfirmCancel) {
      el.btnConfirmCancel.addEventListener('click', async () => {
        if (!pendingCancelBooking) return;

        el.btnConfirmCancel.disabled = true;
        el.btnConfirmCancel.textContent = 'Cancelling & Restocking Seats…';

        try {
          const res = await fetch(`/api/bookings/${pendingCancelBooking.bookingId}/cancel`, {
            method: 'POST'
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Cancellation failed');

          showToast(`Booking ${pendingCancelBooking.ref} cancelled. Seats returned to inventory.`);
          if (el.cancelModal) el.cancelModal.classList.remove('active');
          loadCustomerBookings(currentCustomerId);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          if (el.btnConfirmCancel) {
            el.btnConfirmCancel.disabled = false;
            el.btnConfirmCancel.textContent = 'Yes, Cancel Booking';
          }
        }
      });
    }

    if (el.btnCloseCancel) {
      el.btnCloseCancel.addEventListener('click', () => {
        if (el.cancelModal) el.cancelModal.classList.remove('active');
      });
    }
    if (el.btnAbortCancel) {
      el.btnAbortCancel.addEventListener('click', () => {
        if (el.cancelModal) el.cancelModal.classList.remove('active');
      });
    }
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    // Refresh button
    if (el.btnRefresh) {
      el.btnRefresh.addEventListener('click', () => {
        loadCustomerBookings(currentCustomerId);
        showToast('Booking records refreshed from MySQL.');
      });
    }

    // Filter Tabs
    el.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-tab') || 'all';
        renderBookings();
      });
    });

    // Customer Selector Switcher
    if (el.customerSelect) {
      el.customerSelect.addEventListener('change', (e) => {
        currentCustomerId = parseInt(e.target.value, 10);
        loadCustomerBookings(currentCustomerId);
        showToast(`Viewing bookings for customer #${currentCustomerId}`);
      });
    }

    // Backdrop click
    window.addEventListener('click', (e) => {
      if (e.target === el.reviewModal) el.reviewModal.classList.remove('active');
      if (e.target === el.cancelModal) el.cancelModal.classList.remove('active');
    });

    // Esc key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.reviewModal) el.reviewModal.classList.remove('active');
        if (el.cancelModal) el.cancelModal.classList.remove('active');
      }
    });

    setupReviewModal();
    setupCancelModal();
  }

  /**
   * DOM Ready
   */
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadCustomerBookings(currentCustomerId);
  });
})();

