/**
 * Roamly — Member 3: Personalized Itinerary Planner Controller
 * Pure Vanilla JavaScript DOM manipulation & Fetch API
 */

(function () {
  'use strict';

  let currentCustomerId = 3; // Aarav Sharma
  let allDestinations = [];
  let allProviders = [];
  let currentEstimatedCost = 0;

  // Curated preference-based recommendations catalog (Rule-based, no LLM)
  const ACTIVITY_RECOMMENDATIONS = {
    // Kerala
    '1': {
      Heritage: [
        { morning: 'Colonial Fort Kochi heritage walk & St. Francis Church', afternoon: 'Visit Mattancherry Dutch Palace & Jewish Synagogue', evening: 'Kathakali classical dance & martial arts show' },
        { morning: 'Tripunithura Hill Palace museum excursion', afternoon: 'Traditional Kerala coir & handloom village tour', evening: 'Heritage tea tasting by Kochi harbour' }
      ],
      Nature: [
        { morning: 'Scenic Western Ghats drive past Cheeyappara waterfalls', afternoon: 'Munnar mist-covered tea estate walk & tea processing tour', evening: 'Cardamom & cinnamon spice plantation walk' },
        { morning: 'Alleppey tranquil backwaters houseboat cruise', afternoon: 'Vembanad lake canoeing through palm-fringed canals', evening: 'Sunset bird-watching at Kumarakom sanctuary' }
      ],
      Food: [
        { morning: 'Traditional appam & stew breakfast in old town cafe', afternoon: 'Authentic 24-dish Kerala sadhya feast on banana leaf', evening: 'Fresh coastal Karimeen pollichathu dinner at beachside shack' },
        { morning: 'Spice market sensory exploration in Mattancherry', afternoon: 'Fresh coconut toddy shop seafood pairing', evening: 'Cookery demonstration of Malabar parotta & curry' }
      ],
      Photography: [
        { morning: 'Sunrise photography at iconic Chinese Fishing Nets', afternoon: 'Misty landscape captures of Munnar emerald rolling hills', evening: 'Golden hour reflections along Alleppey mirror-like lagoons' }
      ]
    },
    // Rajasthan
    '2': {
      Heritage: [
        { morning: 'Ascend Jaipur Amber Fort by jeep & visit Sheesh Mahal', afternoon: 'Explore City Palace royal courtyards and Jantar Mantar', evening: 'Catch sunset over pink-hued bazaars from Nahargarh Fort' },
        { morning: 'Marvel at Mehrangarh Fort towering over blue Jodhpur', afternoon: 'Visit Jaswant Thada white marble royal cenotaphs', evening: 'Heritage haveli candle-lit dinner with folk music' }
      ],
      Nature: [
        { morning: 'Sunrise jeep trail through Aravalli wildlife sanctuary', afternoon: 'Camel safari over golden ripples of Sam Sand Dunes', evening: 'Campfire and desert stargazing under clear Thar skies' }
      ],
      Food: [
        { morning: 'Pyaaz kachori & masala chai in Johari Bazaar', afternoon: 'Royal Dal Baati Churma banquet in heritage haveli', evening: 'Savor traditional Ghewar & Laal Maas dinner' }
      ],
      Photography: [
        { morning: 'Hawa Mahal honeycomb facade in morning sunlight', afternoon: 'Vibrant turban & textile photography in Bapu Bazaar', evening: 'Lake Pichola illuminated palace reflections at dusk' }
      ]
    },
    // Goa
    '3': {
      Heritage: [
        { morning: 'Basilica of Bom Jesus and Se Cathedral in Old Goa', afternoon: 'Guided walk through pastel Portuguese Fontainhas Latin Quarter', evening: 'Explore Reis Magos Fort overlooking Mandovi estuary' }
      ],
      Nature: [
        { morning: 'Jeep safari through Bhagwan Mahavir Sanctuary to Dudhsagar', afternoon: 'Natural forest swimming and spice farm organic lunch', evening: 'Private sunset catamaran cruise with dolphin spotting' }
      ],
      Food: [
        { morning: 'Goan poi bread with chorizo or mushroom cafe breakfast', afternoon: 'Authentic Konkani fish thali & sol kadhi by the river', evening: 'Traditional multi-layered Bebinca dessert & beach seafood barbecue' }
      ],
      Photography: [
        { morning: 'Pastel colonial balconies and vintage streetscapes in Panaji', afternoon: 'Pristine crescent shores and palm silhouettes of Palolem', evening: 'Sunset golden hour across Chapora Fort cliff' }
      ]
    },
    // Default / Other
    'default': {
      Heritage: [
        { morning: 'Historic city centre landmark & monuments walking tour', afternoon: 'Visit premier local museum & ancient architectural sites', evening: 'Cultural folklore performance and artisan guild visit' }
      ],
      Nature: [
        { morning: 'Early morning nature trail and panoramic viewpoint hike', afternoon: 'Botanical gardens visit & riverside scenic picnic', evening: 'Sunset viewpoint stroll and tranquil birdwatching' }
      ],
      Food: [
        { morning: 'Breakfast sampling regional delicacies at local bakery', afternoon: 'Signature regional culinary thali or chef special lunch', evening: 'Street food discovery trail and dessert tasting' }
      ],
      Photography: [
        { morning: 'Golden hour architectural and street life photography', afternoon: 'Landscape vistas and natural light portraits', evening: 'Blue hour illuminated skyline or riverfront captures' }
      ]
    }
  };

  const elements = {
    // Selectors & Form inputs
    destinationSelect: document.getElementById('plan-destination'),
    startDateInput: document.getElementById('plan-start-date'),
    durationInput: document.getElementById('plan-duration'),
    travelersInput: document.getElementById('plan-travelers'),
    titleInput: document.getElementById('plan-title'),
    notesInput: document.getElementById('plan-notes'),
    providerSelect: document.getElementById('provider-select-submit'),

    // Preference Elements
    paceSelector: document.getElementById('pace-selector'),
    interestsSelector: document.getElementById('interests-selector'),
    tierSelector: document.getElementById('tier-selector'),
    btnAutoSuggest: document.getElementById('btn-auto-suggest'),
    btnAddDay: document.getElementById('btn-add-day'),
    daysContainer: document.getElementById('days-container'),

    // Live Cost Display
    costDays: document.getElementById('cost-disp-days'),
    costTravelers: document.getElementById('cost-disp-travelers'),
    costActivities: document.getElementById('cost-disp-activities'),
    costTier: document.getElementById('cost-disp-tier'),
    costHotel: document.getElementById('cost-disp-hotel'),
    costTransport: document.getElementById('cost-disp-transport'),
    costTotal: document.getElementById('cost-disp-total'),

    // Action Buttons
    btnSaveItinerary: document.getElementById('btn-save-itinerary'),
    btnPrintItinerary: document.getElementById('btn-print-itinerary'),
    btnSubmitProvider: document.getElementById('btn-submit-provider'),

    // Saved Drawer
    btnToggleSaved: document.getElementById('btn-toggle-saved-drawer'),
    savedModal: document.getElementById('saved-itineraries-modal'),
    savedList: document.getElementById('saved-itineraries-list'),
    btnCloseSaved: document.getElementById('btn-close-saved-drawer'),
    btnDoneSaved: document.getElementById('btn-done-saved-drawer'),
    savedCountBadge: document.getElementById('saved-plans-count'),

    userDisplay: document.getElementById('user-display'),
    toastBox: document.getElementById('provider-toast-box')
  };

  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + Math.round(num).toLocaleString('en-IN');
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
      <span>${type === 'error' ? '⚠️' : '🗺️'}</span>
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

  // Detect session user
  function initUser() {
    try {
      const stored = localStorage.getItem('roamly_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && u.user_id) {
          currentCustomerId = u.user_id;
          if (elements.userDisplay) elements.userDisplay.textContent = u.name;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Load Metadata
  async function loadMetadata() {
    try {
      const [destRes, provRes] = await Promise.all([
        fetch('/api/destinations'),
        fetch('/api/providers')
      ]);

      if (destRes.ok) {
        const json = await destRes.json();
        allDestinations = json.data || [];
        elements.destinationSelect.innerHTML = allDestinations.map(d => `
          <option value="${d.destination_id}">${escapeHTML(d.name)} (${escapeHTML(d.state)})</option>
        `).join('');
      }

      if (provRes.ok) {
        const json = await provRes.json();
        allProviders = json.data || [];
        elements.providerSelect.innerHTML = allProviders.map(p => `
          <option value="${p.user_id}">${escapeHTML(p.name)} (${p.total_packages || 0} packages)</option>
        `).join('');
      }

      // Default start date to 14 days ahead
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      elements.startDateInput.value = nextDate.toISOString().split('T')[0];

      // Auto generate initial schedule
      generateSchedule();
      calculateCost();
      loadSavedPlans();
    } catch (err) {
      console.error('Error loading planner metadata:', err);
    }
  }

  // Read current preference state
  function getPreferences() {
    const paceEl = document.querySelector('input[name="travel_pace"]:checked');
    const tierEl = document.querySelector('input[name="accommodation_tier"]:checked');
    const checkedInterests = Array.from(document.querySelectorAll('input[name="interest"]:checked')).map(el => el.value);

    return {
      destinationId: elements.destinationSelect.value || '1',
      durationDays: Math.max(1, Math.min(14, parseInt(elements.durationInput.value, 10) || 3)),
      travelers: Math.max(1, parseInt(elements.travelersInput.value, 10) || 2),
      pace: paceEl ? paceEl.value : 'Moderate',
      tier: tierEl ? tierEl.value : 'Standard',
      interests: checkedInterests.length > 0 ? checkedInterests : ['Heritage', 'Nature']
    };
  }

  // ==========================================
  // PREFERENCE-BASED RECOMMENDATION ENGINE
  // ==========================================
  function generateSchedule() {
    const prefs = getPreferences();
    const destKey = String(prefs.destinationId);
    const destData = ACTIVITY_RECOMMENDATIONS[destKey] || ACTIVITY_RECOMMENDATIONS['default'];

    // Collect available activity suggestions matching selected interests
    const activityPool = [];
    prefs.interests.forEach(interest => {
      const items = destData[interest] || (ACTIVITY_RECOMMENDATIONS['default'][interest] || []);
      activityPool.push(...items);
    });

    if (activityPool.length === 0) {
      activityPool.push(...(ACTIVITY_RECOMMENDATIONS['default'].Heritage || []));
    }

    elements.daysContainer.innerHTML = '';

    for (let day = 1; day <= prefs.durationDays; day++) {
      const suggestion = activityPool[(day - 1) % activityPool.length] || {
        morning: `Day ${day} morning excursion & breakfast`,
        afternoon: `Day ${day} afternoon guided exploration`,
        evening: `Day ${day} evening relaxation & dinner`
      };

      const dayCard = document.createElement('div');
      dayCard.className = 'day-builder-card';
      dayCard.setAttribute('data-day', day);
      dayCard.innerHTML = `
        <div class="day-builder-header">
          <div style="font-weight: 700; color: var(--primary); font-size: 1.05rem;">
            Day ${day}
          </div>
          ${prefs.durationDays > 1 ? `
            <button type="button" class="action-icon-btn action-btn-danger btn-remove-day" data-day="${day}" title="Remove this day">
              ✕ Remove
            </button>
          ` : ''}
        </div>

        <div class="time-slot-box">
          <div class="time-slot-label"><span>🌅</span> Morning (08:30 – 12:30)</div>
          <input type="text" class="time-slot-input day-morning" value="${escapeHTML(suggestion.morning)}" placeholder="Morning activity…">
        </div>

        <div class="time-slot-box">
          <div class="time-slot-label"><span>☀️</span> Afternoon (13:30 – 17:00)</div>
          <input type="text" class="time-slot-input day-afternoon" value="${escapeHTML(suggestion.afternoon)}" placeholder="Afternoon activity…">
        </div>

        <div class="time-slot-box" style="margin-bottom: 0;">
          <div class="time-slot-label"><span>🌙</span> Evening (18:00 – 21:30)</div>
          <input type="text" class="time-slot-input day-evening" value="${escapeHTML(suggestion.evening)}" placeholder="Evening activity…">
        </div>
      `;
      elements.daysContainer.appendChild(dayCard);
    }

    attachDayCardListeners();
    calculateCost();
  }

  function attachDayCardListeners() {
    elements.daysContainer.querySelectorAll('.btn-remove-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentDays = parseInt(elements.durationInput.value, 10);
        if (currentDays > 1) {
          elements.durationInput.value = currentDays - 1;
          generateSchedule();
        }
      });
    });
  }

  // ==========================================
  // LIVE COST ESTIMATOR
  // ==========================================
  function calculateCost() {
    const prefs = getPreferences();
    const days = prefs.durationDays;
    const travelers = prefs.travelers;

    // Rates based on Pace
    let dailyActivityPerPerson = 2200;
    if (prefs.pace === 'Relaxed') dailyActivityPerPerson = 1800;
    if (prefs.pace === 'Adventure') dailyActivityPerPerson = 3200;

    // Rates based on Accommodation Tier (per room/night)
    const rooms = Math.ceil(travelers / 2);
    let hotelPerRoomNight = 3200; // Standard
    if (prefs.tier === 'Budget') hotelPerRoomNight = 1600;
    if (prefs.tier === 'Luxury') hotelPerRoomNight = 7500;

    // Transport (per day for group)
    const dailyTransport = 1400;

    const totalActivities = dailyActivityPerPerson * days * travelers;
    const totalHotel = hotelPerRoomNight * days * rooms;
    const totalTransport = dailyTransport * days;

    const totalCost = totalActivities + totalHotel + totalTransport;
    currentEstimatedCost = totalCost;

    // Update Live Sidebar Displays
    elements.costDays.textContent = `${days} Day${days > 1 ? 's' : ''}`;
    elements.costTravelers.textContent = `${travelers} Traveler${travelers > 1 ? 's' : ''}`;
    elements.costActivities.textContent = formatINR(totalActivities);
    elements.costTier.textContent = prefs.tier;
    elements.costHotel.textContent = formatINR(totalHotel);
    elements.costTransport.textContent = formatINR(totalTransport);
    elements.costTotal.textContent = formatINR(totalCost);
  }

  // Collect current Day Plan array
  function collectDayPlan() {
    const dayCards = elements.daysContainer.querySelectorAll('.day-builder-card');
    const plan = [];

    dayCards.forEach((card, idx) => {
      const dayNo = idx + 1;
      const morning = card.querySelector('.day-morning') ? card.querySelector('.day-morning').value.trim() : '';
      const afternoon = card.querySelector('.day-afternoon') ? card.querySelector('.day-afternoon').value.trim() : '';
      const evening = card.querySelector('.day-evening') ? card.querySelector('.day-evening').value.trim() : '';

      plan.push({ day: dayNo, morning, afternoon, evening });
    });

    return plan;
  }

  // ==========================================
  // SAVE ITINERARY
  // ==========================================
  async function saveItinerary(isSubmitted = false, chosenProviderId = null) {
    const prefs = getPreferences();
    const title = elements.titleInput.value.trim() || 'My Custom Dream Holiday';
    const startDate = elements.startDateInput.value;
    const notes = elements.notesInput.value.trim();
    const dayPlan = collectDayPlan();

    if (!startDate) {
      showToast('Please select a travel start date.', 'error');
      return null;
    }

    const payload = {
      customer_id: currentCustomerId,
      destination_id: prefs.destinationId,
      title,
      start_date: startDate,
      duration_days: prefs.durationDays,
      travel_pace: prefs.pace,
      interests: prefs.interests.join(','),
      accommodation_tier: prefs.tier,
      estimated_cost: currentEstimatedCost,
      notes,
      day_plan: dayPlan,
      provider_id: chosenProviderId,
      booking_request_status: isSubmitted ? 'SUBMITTED' : 'DRAFT'
    };

    try {
      const res = await fetch('/api/customer/itineraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ? json.error.message : 'Save failed');

      showToast(json.message || 'Itinerary saved successfully!');
      loadSavedPlans();
      return json.data;
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
      return null;
    }
  }

  // ==========================================
  // SAVED ITINERARIES DRAWER
  // ==========================================
  async function loadSavedPlans() {
    try {
      const res = await fetch(`/api/customer/itineraries?customer_id=${currentCustomerId}`);
      if (!res.ok) return;
      const json = await res.json();
      const list = json.data || [];

      if (elements.savedCountBadge) elements.savedCountBadge.textContent = list.length;

      if (!elements.savedList) return;

      if (list.length === 0) {
        elements.savedList.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📂</div>
            <p>You haven't saved any custom itineraries yet.</p>
          </div>
        `;
        return;
      }

      elements.savedList.innerHTML = list.map(item => `
        <div style="background: var(--bg-surface-soft); border: 1px solid var(--border-card); border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">${escapeHTML(item.title)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              📍 ${escapeHTML(item.destination_name)} • ${item.duration_days} Days • ${formatINR(item.estimated_cost)}
            </div>
            <div style="font-size: 0.76rem; color: var(--sage-dark); font-weight: 600; margin-top: 0.2rem;">
              Status: ${item.booking_request_status} ${item.provider_name ? `• Assigned: ${escapeHTML(item.provider_name)}` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick='loadPlanDirect(${JSON.stringify(item)})' style="padding: 0.3rem 0.6rem; font-size: 0.78rem;">
              Load
            </button>
            <button type="button" class="action-icon-btn action-btn-danger" onclick="deletePlanDirect(${item.itinerary_id})" title="Delete saved plan">
              🗑️
            </button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.warn('Could not load saved plans:', e);
    }
  }

  window.loadPlanDirect = function(item) {
    elements.titleInput.value = item.title;
    elements.destinationSelect.value = item.destination_id;
    elements.startDateInput.value = item.start_date.split('T')[0];
    elements.durationInput.value = item.duration_days;
    elements.notesInput.value = item.notes || '';

    // Set Pace radio
    const paceRadio = document.querySelector(`input[name="travel_pace"][value="${item.travel_pace}"]`);
    if (paceRadio) {
      paceRadio.checked = true;
      updatePillStyling(elements.paceSelector, 'radio');
    }

    // Set Tier radio
    const tierRadio = document.querySelector(`input[name="accommodation_tier"][value="${item.accommodation_tier}"]`);
    if (tierRadio) {
      tierRadio.checked = true;
      updatePillStyling(elements.tierSelector, 'radio');
    }

    // Load custom day plan if present
    if (item.day_plan) {
      try {
        const parsed = typeof item.day_plan === 'string' ? JSON.parse(item.day_plan) : item.day_plan;
        if (Array.isArray(parsed) && parsed.length > 0) {
          elements.daysContainer.innerHTML = '';
          parsed.forEach((d, idx) => {
            const dayCard = document.createElement('div');
            dayCard.className = 'day-builder-card';
            dayCard.setAttribute('data-day', idx + 1);
            dayCard.innerHTML = `
              <div class="day-builder-header">
                <div style="font-weight: 700; color: var(--primary); font-size: 1.05rem;">
                  Day ${idx + 1}
                </div>
                <button type="button" class="action-icon-btn action-btn-danger btn-remove-day" data-day="${idx + 1}">
                  ✕ Remove
                </button>
              </div>

              <div class="time-slot-box">
                <div class="time-slot-label"><span>🌅</span> Morning</div>
                <input type="text" class="time-slot-input day-morning" value="${escapeHTML(d.morning || '')}">
              </div>

              <div class="time-slot-box">
                <div class="time-slot-label"><span>☀️</span> Afternoon</div>
                <input type="text" class="time-slot-input day-afternoon" value="${escapeHTML(d.afternoon || '')}">
              </div>

              <div class="time-slot-box" style="margin-bottom: 0;">
                <div class="time-slot-label"><span>🌙</span> Evening</div>
                <input type="text" class="time-slot-input day-evening" value="${escapeHTML(d.evening || '')}">
              </div>
            `;
            elements.daysContainer.appendChild(dayCard);
          });
          attachDayCardListeners();
        }
      } catch (e) {
        generateSchedule();
      }
    } else {
      generateSchedule();
    }

    calculateCost();
    elements.savedModal.classList.remove('is-open');
    showToast(`Loaded "${item.title}"!`);
  };

  window.deletePlanDirect = async function(id) {
    if (!confirm('Remove this saved custom itinerary?')) return;
    try {
      const res = await fetch(`/api/customer/itineraries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Itinerary removed.');
      loadSavedPlans();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  function updatePillStyling(container, type) {
    if (!container) return;
    const labels = container.querySelectorAll('.selection-pill-label');
    labels.forEach(lbl => {
      const input = lbl.querySelector('input');
      lbl.classList.toggle('is-selected', input ? input.checked : false);
    });
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    // Dynamic recalculation on form changes
    elements.destinationSelect.addEventListener('change', () => {
      generateSchedule();
    });

    elements.durationInput.addEventListener('change', () => {
      generateSchedule();
    });

    elements.travelersInput.addEventListener('input', calculateCost);

    // Pill click listeners
    [elements.paceSelector, elements.interestsSelector, elements.tierSelector].forEach(container => {
      if (!container) return;
      container.addEventListener('change', () => {
        updatePillStyling(container);
        calculateCost();
      });
    });

    // Auto-Suggest button
    if (elements.btnAutoSuggest) {
      elements.btnAutoSuggest.addEventListener('click', () => {
        generateSchedule();
        showToast('Suggested itinerary generated based on your travel style!');
      });
    }

    // Add Day button
    if (elements.btnAddDay) {
      elements.btnAddDay.addEventListener('click', () => {
        const cur = parseInt(elements.durationInput.value, 10) || 1;
        if (cur < 14) {
          elements.durationInput.value = cur + 1;
          generateSchedule();
        } else {
          showToast('Maximum duration is 14 days.', 'error');
        }
      });
    }

    // Save to Profile
    if (elements.btnSaveItinerary) {
      elements.btnSaveItinerary.addEventListener('click', () => saveItinerary(false));
    }

    // Print / Download
    if (elements.btnPrintItinerary) {
      elements.btnPrintItinerary.addEventListener('click', () => {
        window.print();
      });
    }

    // Submit to Local Provider
    if (elements.btnSubmitProvider) {
      elements.btnSubmitProvider.addEventListener('click', async () => {
        const provId = elements.providerSelect.value;
        if (!provId) {
          showToast('Please select a local provider.', 'error');
          return;
        }

        const resData = await saveItinerary(true, provId);
        if (resData) {
          showToast('Your custom itinerary has been submitted to the provider! They will review and confirm availability.');
        }
      });
    }

    // Saved Drawer Triggers
    if (elements.btnToggleSaved) elements.btnToggleSaved.addEventListener('click', () => elements.savedModal.classList.add('is-open'));
    if (elements.btnCloseSaved) elements.btnCloseSaved.addEventListener('click', () => elements.savedModal.classList.remove('is-open'));
    if (elements.btnDoneSaved) elements.btnDoneSaved.addEventListener('click', () => elements.savedModal.classList.remove('is-open'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initUser();
    setupEventListeners();
    await loadMetadata();
  });

})();

