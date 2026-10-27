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
