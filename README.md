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
- Full Provider Portal suite: My Packages, Edit Package, Package Bookings, Provider Reports.
- Package CRUD: add, edit, and safely archive/delete packages.
- Day-by-day Itinerary Builder & Activity Manager for morning, afternoon, and evening activities.
- Live departure date and seat capacity manager (`package_availability`).
- Customer booking management: view reservations and update status to `CONFIRMED` or `COMPLETED`.
- Revenue and performance statistics by package and monthly trends.
- Custom tour request review and acceptance/rejection from travelers.

**Central Administrator Portal (Member 3)**
- Central Admin dashboard with platform-wide health metrics.
- Package moderation: approve, reject (with feedback), or pause/disable packages.
- Destination & Category CRUD management with integrity checks.
- User account management: verify and approve pending providers, block/unblock users.
- System-wide revenue, booking volume, and operator performance analytics.

**Super Administrator Portal (Member 3)**
- Super Admin governance console.
- Admin account creation and granular permission delegation (`admin_permissions`).
- Filterable system activity audit logs (`system_logs`) tracking logins, moderation, and account status updates.

**Personalized Itinerary Planner (Member 3 — Special Feature)**
- Interactive customer trip planner (`public/customer/itinerary-planner.html`).
- Destination & travel dates selection.
- Travel pace (Relaxed, Moderate, Adventure) and Interests (Heritage, Nature, Food, Photography).
- Accommodation comfort tier selection (Budget, Standard, Luxury).
- Day-by-day morning, afternoon, and evening activity builder with add/remove day controls.
- Rule-based preference recommendation logic matching destination attractions.
- Live dynamic cost estimator calculating activities, accommodation, and transport in real time.
- Save custom itineraries to customer profile.
- Clean printable voucher / PDF layout (`window.print()`).
- Direct custom booking request submission to local tour providers.

**Reservation & Booking Engine (Member 2)**
- Step-by-step checkout: date picker from live availability, traveler count stepper, lead passenger form.
- Atomic booking creation: seat decrement, booking record, payment record in a single transaction.
- Four payment methods simulated: UPI, Credit/Debit Card, Net Banking, Pay on Arrival.
- Ticket voucher modal with booking ID and printable summary.

**Promotional Coupon & Discount System (Member 2 — Special Feature)**
- Active coupon listing via `GET /api/coupons`.
- Real-time AJAX validation: checks expiry, usage limit, minimum booking amount; returns computed discount.
- Coupons: `EXPLORE10` (10% off), `FESTIVE25` (25% off), `ROAMLY1000` (₹1,000 flat), `EARLYBIRD` (15% off).
- Order summary recalculates live on coupon apply/remove.

**Booking History & Cancellations (Member 2)**
- Customer booking history page with metrics banner (total trips, amount spent, upcoming bookings).
- Filter tabs: All / Upcoming / Completed / Cancelled.
- Cancellation workflow with modal confirmation; seats are restocked automatically.
- Cancellation refund status recorded in `payments` table.

**Verified Reviews & Star Ratings (Member 2)**
- Review submission modal (1–5 stars + comment) locked to confirmed bookings only.
- Reviews display on `package-details.html` with average rating and total count.

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
| Promotions | `coupons` |

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

| `GET` | `/api/coupons` | List active promotional coupons |
| `POST` | `/api/coupons/validate` | Validate a coupon code and compute discount |
| `POST` | `/api/bookings` | Create a booking (atomic seat decrement + payment record) |
| `GET` | `/api/customer/bookings` | Booking history for a customer (query: `customer_id`) |
| `GET` | `/api/bookings/:id` | Single booking detail for voucher / receipt |
| `POST` | `/api/bookings/:id/cancel` | Cancel a booking and restock seats |
| `POST` | `/api/reviews` | Submit a verified star review for a completed booking |
| `GET` | `/api/packages/:id/reviews` | Package reviews with average rating and count |

Provider package administration and availability endpoints are implemented in `server/server.js` and `server/member3_handlers.js`.

### Member 3 Additional API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Multi-role user sign-in with audit activity logging |
| `GET` | `/api/provider/packages` | List all packages for provider with itinerary, booking, and revenue counts |
| `PUT` | `/api/provider/packages/:id` | Update package title, details, duration, price, capacity |
| `DELETE` | `/api/provider/packages/:id` | Delete package or safely archive if bookings exist |
| `GET` | `/api/provider/packages/:id/itinerary` | Get day-by-day itinerary schedule |
| `POST` | `/api/provider/packages/:id/itinerary` | Add or update day activity |
| `DELETE` | `/api/provider/itinerary/:id` | Remove itinerary day activity |
| `GET` | `/api/provider/bookings` | Provider bookings list with customer details |
| `PATCH` | `/api/provider/bookings/:id/status` | Update booking status (`CONFIRMED`, `COMPLETED`) |
| `GET` | `/api/provider/reports` | Provider financial metrics and package performance |
| `GET` | `/api/provider/custom-requests` | Inquiries submitted from Itinerary Planner |
| `PATCH` | `/api/provider/custom-requests/:id/status`| Accept or reject custom inquiry |
| `GET` | `/api/admin/dashboard` | Admin overview with package, user, and financial stats |
| `GET` | `/api/admin/packages` | Filterable package list for quality moderation |
| `PATCH` | `/api/admin/packages/:id/status` | Admin moderate package (`APPROVED`, `REJECTED`, `INACTIVE`) |
| `GET`/`POST` | `/api/admin/destinations` | Destinations management (CRUD) |
| `PUT`/`DELETE`| `/api/admin/destinations/:id` | Update / delete destination |
| `GET`/`POST` | `/api/admin/categories` | Categories management (CRUD) |
| `PUT`/`DELETE`| `/api/admin/categories/:id` | Update / delete category |
| `GET` | `/api/admin/users` | List customer & provider accounts |
| `PATCH` | `/api/admin/users/:id/status` | Approve provider, block/unblock user account |
| `GET` | `/api/admin/reports` | Platform-wide financial reports & destination breakdown |
| `GET`/`POST` | `/api/superadmin/admins` | List all administrators / create new administrator |
| `PATCH` | `/api/superadmin/admins/:id/permissions`| Update admin access permissions |
| `PATCH` | `/api/superadmin/admins/:id/status` | Block or unblock administrator |
| `GET` | `/api/superadmin/logs` | Security activity audit trail (`system_logs`) |
| `GET`/`POST` | `/api/customer/itineraries` | View customer saved itineraries / create custom plan |
| `GET`/`DELETE`| `/api/customer/itineraries/:id`| Retrieve single plan / delete custom plan |
| `POST` | `/api/customer/itineraries/:id/submit`| Submit custom plan request to local operator |

### Demo Test Credentials for Presentation & Evaluation

| Role | Email | Password | Direct Portal URL |
|---|---|---|---|
| **Customer** | `aarav@customer.in` | `demoPassword123` | [customer/itinerary-planner.html](http://localhost:3000/customer/itinerary-planner.html) |
| **Tour Provider** | `heritage@roamly.in` | `demoPassword123` | [provider/dashboard.html](http://localhost:3000/provider/dashboard.html) |
| **Administrator** | `admin@roamly.in` | `demoPassword123` | [admin/dashboard.html](http://localhost:3000/admin/dashboard.html) |
| **Super Admin** | `superadmin@roamly.in` | `demoPassword123` | [superadmin/dashboard.html](http://localhost:3000/superadmin/dashboard.html) |

## Project Structure

```
trip-planner/
├── .env
├── package.json
├── database/
│   ├── schema.sql              # MySQL schema (all tables + custom_itineraries)
│   └── seed-demo-data.sql      # Seed data (users, packages, bookings, logs)
├── server/
│   ├── server.js               # Pure Node.js HTTP server and router
│   ├── member3_handlers.js     # Member 3 REST API handlers & audit logger
│   ├── seed.js                 # Database seed runner
│   ├── test_member3.js         # Automated backend test suite
│   └── config/db.js            # MySQL connection pool
└── public/
    ├── index.html, destinations.html, packages.html, package-details.html
    ├── login.html, register.html
    ├── provider/
    │   └── dashboard.html      # Provider Portal (Packages, Bookings, Requests, Reports)
    ├── admin/
    │   ├── dashboard.html      # Central Admin Console (Moderation, CRUD, Users, Reports)
    │   └── admin.js            # Admin Controller
    ├── superadmin/
    │   ├── dashboard.html      # Super Admin Portal (Admins, Permissions, Audit Logs)
    │   └── superadmin.js       # Super Admin Controller
    ├── customer/
    │   ├── booking.html        # Booking checkout
    │   ├── my-bookings.html    # Customer booking history & reviews
    │   └── itinerary-planner.html # Personalized Day-by-Day Itinerary Planner
    ├── css/styles.css          # Design system & styles
    └── js/
        ├── api.js, app.js, packages.js, register.js
        ├── provider-dashboard.js   # Provider Portal controller
        └── itinerary-planner.js    # Personalized Itinerary Planner controller
```
