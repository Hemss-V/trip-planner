# Roamly: Local Tourism Package Booking System

A full-stack tourism platform for discovering and booking local tour packages across India. Built without frameworks, using Vanilla HTML/CSS/JavaScript (Fetch API), pure Node.js (`http`, `url`, `fs`, `path`) and MySQL 8.0+.

## Features

**Authentication (Member 1)**
- Public registration page (`register.html`) for `CUSTOMER` and `PROVIDER` roles.
- Client-side validation before submitting to `POST /api/auth/register`:
  - Email format check
  - Indian mobile number (optional `+91`, starts with 6-9, 10 digits)
  - Password of at least 8 characters with an uppercase letter, a lowercase letter and a digit
  - Password confirmation match
- Inline field errors and a form-level alert for server responses.

**Discovery (Member 2)**
- Hero search with category selector and quick-search chips.
- Destination cards with live package counts and starting prices (₹).
- Package filters by keyword, destination, category, price range, duration and departure date.
- Sorting by recommended, price and duration, with removable filter tags.
- Package details as a slide-in drawer and as a standalone page (`package-details.html?id=:id`), with a day-by-day itinerary and live seat availability.

**Provider Dashboard and Package Administration (Member 3)**
- Provider dashboard for managing tourism packages.
- Package administration APIs for providers to manage their packages.
- Live availability manager for departure dates and seat capacity.

**Booking and payments:** in progress. Package selection is passed on via `package_id`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Communication | Fetch API (AJAX) |
| Backend | Node.js built-in modules only (no Express) |
| Database | MySQL 8.0+ with `mysql2/promise` |

## Database

Schema: `database/schema.sql` (database name `tourism_booking`)

| Area | Tables |
|---|---|
| Users and access | `users`, `addresses`, `admin_permissions`, `system_logs` |
| Catalog | `destinations`, `categories`, `tour_packages`, `package_itinerary`, `package_availability` |
| Transactions | `bookings`, `payments`, `reviews` |

Tables use primary and foreign keys with constraints. Users have one of four roles: `CUSTOMER`, `PROVIDER`, `ADMIN` or `SUPER_ADMIN`.

## Getting Started

**1. Install dependencies**
```bash
npm install
```

**2. Configure the environment.** Copy `.env.example` to `.env` and fill in your MySQL credentials:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=tourism_booking
```

**3. Create the database.** Run `database/schema.sql` in MySQL Workbench or the MySQL CLI:
```bash
mysql -u root -p < database/schema.sql
```

**4. Seed demo data** (destinations, categories, packages, itineraries, availability):
```bash
npm run seed
```

**5. Start the server**
```bash
npm start
```
Open **http://localhost:3000**. The registration page is at **http://localhost:3000/register.html**.

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a customer or provider |
| `GET` | `/api/destinations` | List destinations with package counts and starting price |
| `GET` | `/api/destinations/:id` | Destination details and its approved packages |
| `GET` | `/api/categories` | List categories with package counts |
| `GET` | `/api/packages` | Filterable, sortable package catalog |
| `GET` | `/api/packages/:id` | Package details, itinerary and availability |

**Package query parameters:** `search`/`q`, `destination`, `category`, `minPrice`, `maxPrice`, `minDuration`, `maxDuration`, `date` (YYYY-MM-DD), `sort` (`recommended`, `price_asc`, `price_desc`, `duration_asc`, `duration_desc`).

Provider package administration and availability endpoints are implemented in `server/server.js`.

## Project Structure

```
trip-planner/
├── .env.example
├── package.json
├── database/
│   ├── schema.sql              # MySQL schema
│   └── seed-demo-data.sql      # Demo data
├── server/
│   ├── server.js               # HTTP server and REST API
│   ├── seed.js                 # Seed runner
│   └── config/db.js            # MySQL connection pool
└── public/
    ├── index.html, destinations.html, packages.html, package-details.html
    ├── login.html, register.html
    ├── (provider dashboard pages)
    ├── css/styles.css
    └── js/
        ├── api.js, app.js, destinations.js
        ├── packages.js, package-details.js
        ├── register.js         # Registration validation and submit
        └── (provider dashboard scripts)
```
