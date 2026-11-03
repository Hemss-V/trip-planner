# Member 2: Implementation Roadmap & Technical Guide
## Module: Booking Engine, Payments, Cancellations, Reviews & Coupon System

> **Role Ownership**: Complete reservation lifecycle, transaction handling, customer booking management, post-trip feedback, and the promotional discount system.  
> **Tech Stack**: HTML5, Vanilla CSS3, Vanilla JavaScript (DOM + AJAX/Fetch), Pure Node.js built-ins (`http`, `url`, `crypto`), MySQL (`mysql2/promise`). **No Express, No React/Vue**.

---

## 1. Executive Summary & Ownership Boundaries

As **Member 2**, you own all transactional and financial capabilities of the platform. You take travelers from the moment they click **"Book Package"** on a tour details page through checkout, payment confirmation, itinerary reservation, post-booking management (history & cancellations), and feedback collection (ratings & reviews). You also own the **Coupon & Discount Promotional Engine**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MEMBER 2 WORKFLOW PIPELINE                      │
├─────────────────────┬───────────────────┬──────────────────────────────┤
│ 1. Checkout Entry   │ 2. Reservation &  │ 3. Post-Booking Lifecycle    │
│    & Discounts      │    Payment        │    & Feedback                │
│                     │                   │                              │
│ • Select Date       │ • Decrement Seats │ • View Active/Past Bookings  │
│ • Choose Travelers  │ • Process Payment │ • Cancel Eligible Trips      │
│ • Apply Promo Code  │ • Generate Ticket │ • Restock Availability       │
│ • Live Total Recalc │ • Status -> PAID  │ • 1-5 Star Ratings & Reviews │
└─────────────────────┴───────────────────┴──────────────────────────────┘
```

---

## 2. File & Directory Ownership

All your files will live in the existing repository structure:

```
tourism_booking/
├── database/
│   ├── schema.sql                     <-- Add 'coupons' table definition
│   └── seed-demo-data.sql             <-- Add initial active coupons & sample bookings
├── server/
│   └── server.js                      <-- Add Member 2 REST endpoints in request router
└── public/
    ├── package-details.html           <-- Hook "Book Now" button to booking.html & render reviews
    ├── customer/
    │   ├── booking.html               <-- Interactive Checkout & Payment Simulation
    │   └── my-bookings.html           <-- Booking History, Cancel Trips & Review Modal
    └── js/
        ├── booking.js                 <-- Checkout controller, coupon validation & payment
        ├── my-bookings.js             <-- Bookings list, cancellation logic & review form
        └── package-details.js         <-- Update handoff notice -> real link, display reviews
```

---

## 3. Database Specifications

### A. Existing Tables Utilized by Member 2
1. **`bookings`**: Stores customer package reservations.
   * `booking_id` (PK, INT AUTO_INCREMENT)
   * `customer_id` (FK -> `users.user_id`)
   * `package_id` (FK -> `tour_packages.package_id`)
   * `availability_id` (FK -> `package_availability.availability_id`)
   * `travelers` (INT, CHECK > 0)
   * `total_amount` (DECIMAL 10,2)
   * `booking_status` (ENUM: `'PENDING'`, `'CONFIRMED'`, `'CANCELLED'`, `'COMPLETED'`)
   * `payment_status` (ENUM: `'PENDING'`, `'PAID'`, `'FAILED'`, `'REFUNDED'`)
   * `booked_at` (TIMESTAMP)

2. **`payments`**: Records simulated payment transactions.
   * `payment_id` (PK, INT AUTO_INCREMENT)
   * `booking_id` (FK -> `bookings.booking_id`, UNIQUE)
   * `customer_id` (FK -> `users.user_id`)
   * `amount` (DECIMAL 10,2)
   * `payment_method` (VARCHAR 50: `'UPI'`, `'CARD'`, `'NETBANKING'`, `'PAY_ON_ARRIVAL'`)
   * `payment_status` (ENUM: `'PENDING'`, `'SUCCESS'`, `'FAILED'`, `'REFUNDED'`)
   * `paid_at` (TIMESTAMP)

3. **`package_availability`**: Checked and updated during booking and cancellation.
   * `seats_available` (Must decrement on booking, increment on cancellation)

4. **`reviews`**: Post-trip ratings and feedback.
   * `review_id` (PK, INT AUTO_INCREMENT)
   * `booking_id` (FK -> `bookings.booking_id`, UNIQUE)
   * `customer_id` (FK -> `users.user_id`)
   * `package_id` (FK -> `tour_packages.package_id`)
   * `rating` (INT, CHECK 1-5)
   * `comment` (TEXT)
   * `created_at` (TIMESTAMP)

### B. New Table: `coupons` (Special Additional Feature)
Execute this in MySQL / append to `database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS coupons (
    coupon_id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    discount_type ENUM('PERCENT', 'FLAT') NOT NULL DEFAULT 'PERCENT',
    discount_value DECIMAL(10,2) NOT NULL,
    min_booking_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    max_discount DECIMAL(10,2) NULL,
    valid_until DATE NOT NULL,
    usage_limit INT NOT NULL DEFAULT 100,
    times_used INT NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Seed Coupons for Testing:
```sql
INSERT IGNORE INTO coupons (code, description, discount_type, discount_value, min_booking_amount, max_discount, valid_until, status) VALUES
('EXPLORE10', '10% discount on all tour packages', 'PERCENT', 10.00, 5000.00, 3000.00, '2027-12-31', 'ACTIVE'),
('FESTIVE25', 'Flat 25% festive discount for group trips', 'PERCENT', 25.00, 15000.00, 5000.00, '2027-12-31', 'ACTIVE'),
('ROAMLY1000', 'Flat ₹1,000 off on premium holidays', 'FLAT', 1000.00, 10000.00, 1000.00, '2027-12-31', 'ACTIVE');
```

---

## 4. Backend REST API Specifications (Pure Node.js in `server/server.js`)

Implement all routes inside the `if (pathname.startsWith('/api/'))` block in `server/server.js`.

### 1. `POST /api/coupons/validate` (Coupon Validation)
* **Request Body**:
  ```json
  {
    "code": "EXPLORE10",
    "total_amount": 24999.00
  }
  ```
* **Validation Logic**:
  * Case-insensitive match on `code`.
  * Status must be `'ACTIVE'`.
  * `valid_until >= CURDATE()`.
  * `times_used < usage_limit`.
  * `total_amount >= min_booking_amount`.
  * Computes discount:
    * If `PERCENT`: `discount = (total_amount * discount_value) / 100`. Cap at `max_discount` if not null.
    * If `FLAT`: `discount = discount_value`.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "code": "EXPLORE10",
      "discount_type": "PERCENT",
      "discount_value": 10,
      "discount_amount": 2499.90,
      "final_amount": 22499.10,
      "message": "Coupon EXPLORE10 applied successfully!"
    }
  }
  ```

### 2. `POST /api/bookings` (Create Booking & Decrement Seats)
* **Request Body**:
  ```json
  {
    "customer_id": 3,
    "package_id": 1,
    "availability_id": 1,
    "travelers": 2,
    "coupon_code": "EXPLORE10",
    "lead_passenger": {
      "full_name": "Aarav Sharma",
      "email": "aarav@customer.in",
      "phone": "+91 98111 22334"
    }
  }
  ```
* **Database Transaction Flow**:
  1. Verify package is `'APPROVED'`.
  2. Verify `seats_available >= travelers` in `package_availability`.
  3. Calculate base price `package.price * travelers`.
  4. If `coupon_code` provided, re-verify and apply discount.
  5. Atomically decrement available seats:
     ```sql
     UPDATE package_availability 
     SET seats_available = seats_available - ? 
     WHERE availability_id = ? AND seats_available >= ?
     ```
  6. Insert row into `bookings` (`booking_status = 'PENDING'`, `payment_status = 'PENDING'`).
  7. If coupon used, increment `times_used` in `coupons`.
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Booking initiated successfully.",
    "data": {
      "booking_id": 42,
      "total_amount": 44998.20,
      "status": "PENDING"
    }
  }
  ```

### 3. `POST /api/payments` (Simulate Payment)
* **Request Body**:
  ```json
  {
    "booking_id": 42,
    "customer_id": 3,
    "amount": 44998.20,
    "payment_method": "UPI",
    "payment_details": { "upi_id": "aarav@oksbi" }
  }
  ```
* **Logic**:
  1. Insert row into `payments` table (`payment_status = 'SUCCESS'`, `paid_at = NOW()`).
  2. Update `bookings`:
     ```sql
     UPDATE bookings 
     SET booking_status = 'CONFIRMED', payment_status = 'PAID' 
     WHERE booking_id = ?
     ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Payment verified! Your booking is confirmed.",
    "data": { "payment_id": 18, "booking_id": 42, "status": "CONFIRMED" }
  }
  ```

### 4. `GET /api/customer/bookings` (Booking History)
* **Query**: `?customer_id=3`
* **Query Joins**:
  ```sql
  SELECT 
    b.booking_id, b.travelers, b.total_amount, b.booking_status, b.payment_status, b.booked_at,
    p.package_id, p.title AS package_title, p.image AS package_image, p.duration_days,
    d.name AS destination_name, d.city, d.state,
    pa.available_date,
    pay.payment_method, pay.paid_at,
    r.review_id, r.rating, r.comment AS review_comment
  FROM bookings b
  JOIN tour_packages p ON b.package_id = p.package_id
  JOIN destinations d ON p.destination_id = d.destination_id
  JOIN package_availability pa ON b.availability_id = pa.availability_id
  LEFT JOIN payments pay ON b.booking_id = pay.booking_id
  LEFT JOIN reviews r ON b.booking_id = r.booking_id
  WHERE b.customer_id = ?
  ORDER BY b.booked_at DESC
  ```

### 5. `POST /api/bookings/:id/cancel` (Cancel Booking & Restock Seats)
* **URL Param**: `id` (`booking_id`)
* **Logic**:
  1. Check booking status: Cannot cancel if already `'CANCELLED'`.
  2. Check departure date eligibility (e.g. `available_date >= CURDATE()`).
  3. Atomically restore seats:
     ```sql
     UPDATE package_availability pa
     JOIN bookings b ON pa.availability_id = b.availability_id
     SET pa.seats_available = pa.seats_available + b.travelers
     WHERE b.booking_id = ?
     ```
  4. Update booking:
     ```sql
     UPDATE bookings SET booking_status = 'CANCELLED', payment_status = 'REFUNDED' WHERE booking_id = ?
     ```

### 6. `POST /api/reviews` & `GET /api/packages/:id/reviews`
* **POST**: Inserts review (`booking_id`, `customer_id`, `package_id`, `rating`, `comment`). Only allowed if booking is `'COMPLETED'` or `'CONFIRMED'`.
* **GET**: Returns verified traveler reviews and average star rating for a package.

---

## 5. Frontend Pages & Workflows

### Page 1: `public/customer/booking.html` (Checkout & Payments)
* **URL Parameter**: `booking.html?package_id=1`
* **UI Structure**:
  1. **Package Summary Banner**: Shows selected package thumbnail, title, destination, duration, and price per person.
  2. **Step 1: Departure Date Selection**:
     * Dropdown / radio chips populated dynamically from `package_availability` (dates with `seats_available > 0`).
     * Live badge showing open seats left.
  3. **Step 2: Number of Travelers**:
     * Number input or stepper (+ / - buttons).
     * Validated against available seats for selected date.
  4. **Step 3: Lead Traveler Details**:
     * Full Name, Email, Mobile number, Special Dietary/Medical notes.
  5. **Step 4: Promo Code & Discount Box**:
     * Text input + "Apply Coupon" button.
     * Instant visual calculation: Subtotal, Discount (-₹), and Grand Total.
  6. **Step 5: Simulated Payment Gateway**:
     * Tabbed selector: `UPI`, `Debit / Credit Card`, `Net Banking`, `Pay on Arrival`.
     * Clean mock inputs (UPI VPA input, Card number & expiry).
     * Button: **"Confirm & Pay ₹[Total]"**.
  7. **Confirmation Modal / Screen**:
     * Animated checkmark, generated Booking Reference ID, printable trip voucher, and "View My Bookings" button.

### Page 2: `public/customer/my-bookings.html` (Bookings & Reviews)
* **UI Structure**:
  1. **Customer Header**: Displays traveler name with account switcher (for testing with Aarav / Priya).
  2. **Tabs**: `All Bookings`, `Upcoming Trips`, `Completed`, `Cancelled`.
  3. **Booking Cards**:
     * Package photo, destination, departure date countdown (`"Leaves in 4 days"`).
     * Traveler count, total paid, payment method badge.
     * Status Pill: `CONFIRMED` (green), `PENDING` (orange), `CANCELLED` (red), `COMPLETED` (blue).
  4. **Action Buttons**:
     * **"Cancel Booking"**: Confirms with modal, checks eligibility, initiates seat restock.
     * **"Write Review"**: Opens modal with interactive 1-5 star selector + feedback textarea.
     * **"View Public Itinerary"**: Quick link back to `package-details.html`.

### Page 3: Update `public/package-details.html` & `package-details.js`
* Replace the current handoff notice on line 173-191 of `package-details.js` with:
  ```javascript
  // Direct link to real checkout
  window.location.href = `customer/booking.html?package_id=${pkg.package_id}`;
  ```
* Render a **"Customer Reviews & Ratings"** card at the bottom of the page showing verified trip feedback and average star score.

---

## 6. Step-by-Step Implementation Checklist

Follow this exact sequence to build Member 2 cleanly without merge conflicts:

- [ ] **Step 1: Database Migration**
  - [ ] Add `coupons` table to `database/schema.sql`.
  - [ ] Add sample coupons and seed data into `database/seed-demo-data.sql`.
  - [ ] Run `npm run seed` to apply schema updates.
- [ ] **Step 2: Backend Coupon & Booking APIs in `server/server.js`**
  - [ ] Implement `handleValidateCoupon()` (`POST /api/coupons/validate`).
  - [ ] Implement `handleCreateBooking()` (`POST /api/bookings`) with seat availability check and atomic decrement.
  - [ ] Implement `handleCreatePayment()` (`POST /api/payments`) with booking confirmation.
  - [ ] Implement `handleGetCustomerBookings()` (`GET /api/customer/bookings`).
  - [ ] Implement `handleCancelBooking()` (`POST /api/bookings/:id/cancel`) with seat restoration.
  - [ ] Implement `handleCreateReview()` (`POST /api/reviews`) and `handleGetPackageReviews()` (`GET /api/packages/:id/reviews`).
- [ ] **Step 3: Frontend Checkout Page**
  - [ ] Create `public/customer/booking.html`.
  - [ ] Create `public/js/booking.js` with date picking, traveler counter, coupon AJAX validation, and payment simulation.
  - [ ] Add checkout styling in `public/css/styles.css`.
- [ ] **Step 4: Connect Details Page to Checkout**
  - [ ] Update `public/js/package-details.js` to redirect to `booking.html`.
  - [ ] Inject verified customer reviews component on package details page.
- [ ] **Step 5: Frontend Booking History & Feedback**
  - [ ] Create `public/customer/my-bookings.html`.
  - [ ] Create `public/js/my-bookings.js` with booking cards, cancellation trigger, and review submission modal.
- [ ] **Step 6: Automated Testing & Git Commit**
  - [ ] Test booking with valid date and seat reduction.
  - [ ] Test applying coupon `EXPLORE10` and verify discount calculation.
  - [ ] Test booking cancellation and verify seat count increments back.
  - [ ] Test review submission and verify display on package details.
  - [ ] Commit and push to GitHub.

