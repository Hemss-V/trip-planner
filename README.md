# Local Tourism Package Booking System — Roamly
## Member 2 Module: Destinations & Tour Package Discovery

A full-stack, database-driven travel discovery web platform designed for local tourism packages across India. Built strictly within the required project constraints using Vanilla HTML5, CSS3, Vanilla JavaScript (Fetch API), pure Node.js (`http`, `url`, `fs`, `path`), and MySQL 8.0+.

---

## 🧭 Features Implemented (Member 2)

1. **Brand Identity & Premium Design System**:
   - Centralized design tokens in `public/css/styles.css`.
   - Warm ivory/off-white background, deep forest-green primary, muted sage accents, restrained terracotta highlights.
   - Refined serif headings (`Playfair Display`) & clean sans-serif UI typography (`Plus Jakarta Sans`).
   - Generous whitespace, rounded cards, subtle shadows, micro-animations, and full responsiveness across desktop, tablet, and mobile.
   - Graceful fallback image handling for all destination and package photography.

2. **Hero Discovery & Search**:
   - Atmospheric background imagery and compelling tagline.
   - Working search box querying package titles, descriptions, destinations, and categories.
   - Dynamic category selector populated from MySQL.
   - Quick search chips (e.g., Kerala Backwaters, Royal Rajasthan, Goan Coastline, Himachal Valleys) that trigger instant filtering and smooth scroll to results.

3. **Popular Destinations Discovery**:
   - Cards dynamically populated from MySQL via `/api/destinations`.
   - Displays destination imagery, name, city, state, country, description, real database package counts, and starting prices in INR (₹).
   - "View Trips" button that instantly filters the packages catalog by the selected destination.

4. **Comprehensive Tour Package Filtering & Sorting**:
   - Real-time keyword search with input debouncing.
   - Destination filter dropdown (populated from MySQL).
   - Category filter dropdown (populated from MySQL).
   - Numeric Min and Max price range filtering in INR (₹).
   - Practical duration presets (Short 1–3 Days, Medium 4–5 Days, Long 6+ Days).
   - Date departure availability filtering against `package_availability`.
   - Sorting by: Recommended, Price: Low to High, Price: High to Low, Duration: Shortest First, Duration: Longest First.
   - Active filter tags with single-click removal and "Reset All Filters" control.
   - Real-time match counter and friendly empty states.

5. **Package Details & Vertical Day-by-Day Itinerary**:
   - Fast, interactive slide-in modal drawer on both `index.html` and `packages.html`.
   - Dedicated standalone shareable page on `package-details.html?id=:id`.
   - Day-by-day vertical timeline with Day 1, Day 2, etc. fetched from `package_itinerary` ordered by `day_no ASC`.
   - Departure dates calendar with live seat counts from `package_availability`.
   - Clear operator credentials and destination highlight card.

6. **Booking Module Integration Handoff**:
   - Clean, non-destructive handoff notification explaining that `package_id` and selection are prepared for Member 3's booking and payment module upon team assembly.

---

## 🛠️ Technology Stack (Strictly Enforced)

- **Frontend**: HTML5, Vanilla CSS3, Vanilla JavaScript (DOM manipulation, Event Listeners).
- **Communication**: AJAX via native `fetch()` API.
- **Backend**: Pure Node.js built-in modules (`http`, `url`, `fs`, `path`). *No Express, Fastify, or external backend frameworks.*
- **Database**: MySQL 8.0+ using parameterized queries with `mysql2/promise` connection pool.

---

## 🚀 Getting Started

### 1. Environment Configuration
Ensure your `.env` file in the project root matches your local MySQL credentials:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=tourism_booking
```

### 2. Database Setup & Demo Seed
If you haven't yet run the schema or seed:
```bash
# 1. Apply Schema (if not already applied in MySQL Workbench)
# File located at: database/schema.sql

# 2. Seed Realistic Indian Tourism Demo Data
npm run seed
```

### 3. Start the Server
```bash
npm start
```
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/destinations` | List all active destinations with package counts & starting price |
| `GET` | `/api/destinations/:id` | Retrieve one destination by ID and its approved packages |
| `GET` | `/api/categories` | List all active tour categories with package counts |
| `GET` | `/api/packages` | Filterable and sortable tour packages catalog |
| `GET` | `/api/packages/:id` | Full package details, day-by-day itinerary, and upcoming availability |

#### Package Filter Query Parameters:
- `search` / `q`: Keyword search across package title, description, destination, and category.
- `destination`: Filter by destination ID or name.
- `category`: Filter by category ID or name.
- `minPrice`: Minimum price in INR.
- `maxPrice`: Maximum price in INR.
- `minDuration`: Minimum days.
- `maxDuration`: Maximum days.
- `date`: Available departure date (YYYY-MM-DD).
- `sort`: `recommended`, `price_asc`, `price_desc`, `duration_asc`, `duration_desc`.

---

## 📁 File Structure

```
trip-planner/
├── .env                         # Local environment configuration
├── .env.example                 # Example environment template
├── package.json                 # Project configuration & scripts
├── database/
│   ├── schema.sql               # MySQL 8.0+ database schema
│   └── seed-demo-data.sql       # Safe idempotent seed data script
├── server/
│   ├── server.js                # Pure Node.js HTTP server & REST API
│   ├── seed.js                  # Automated seed runner
│   └── config/
│       └── db.js                # MySQL2 connection pool module
└── public/
    ├── index.html               # Main discovery landing page
    ├── destinations.html        # Regional destinations exploration page
    ├── packages.html            # Advanced filter & package listing page
    ├── package-details.html     # Dedicated package & itinerary detail page
    ├── login.html               # Member 1 Auth placeholder
    ├── register.html            # Member 1 Auth placeholder
    ├── css/
    │   └── styles.css           # Complete design system & responsive styling
    └── js/
        ├── api.js               # Reusable API fetch client & formatters
        ├── app.js               # Homepage interactivity & modal coordinator
        ├── destinations.js      # Destinations page controller
        ├── packages.js          # Packages page filter & state controller
        └── package-details.js   # Package details & itinerary controller
```
