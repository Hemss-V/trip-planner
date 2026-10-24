-- Local Tourism Package Booking System
-- Database schema for MySQL 8.0+
-- Run this file in MySQL Workbench to create the database and all tables.

CREATE DATABASE IF NOT EXISTS tourism_booking
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE tourism_booking;

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    role ENUM('CUSTOMER', 'PROVIDER', 'ADMIN', 'SUPER_ADMIN')
        NOT NULL DEFAULT 'CUSTOMER',
    status ENUM('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING')
        NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(20),
    CONSTRAINT fk_addresses_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS destinations (
    destination_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    description TEXT,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS tour_packages (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id INT NOT NULL,
    destination_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    duration_days INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    capacity INT NOT NULL,
    image VARCHAR(500),
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE')
        NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_packages_provider
        FOREIGN KEY (provider_id) REFERENCES users(user_id),
    CONSTRAINT fk_packages_destination
        FOREIGN KEY (destination_id) REFERENCES destinations(destination_id),
    CONSTRAINT fk_packages_category
        FOREIGN KEY (category_id) REFERENCES categories(category_id),
    CONSTRAINT chk_package_duration CHECK (duration_days > 0),
    CONSTRAINT chk_package_price CHECK (price >= 0),
    CONSTRAINT chk_package_capacity CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS package_itinerary (
    itinerary_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    day_no INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    CONSTRAINT fk_itinerary_package
        FOREIGN KEY (package_id) REFERENCES tour_packages(package_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_itinerary_day CHECK (day_no > 0),
    CONSTRAINT uq_package_day UNIQUE (package_id, day_no)
);

CREATE TABLE IF NOT EXISTS package_availability (
    availability_id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    available_date DATE NOT NULL,
    seats_available INT NOT NULL,
    status ENUM('AVAILABLE', 'FULL', 'CLOSED')
        NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT fk_availability_package
        FOREIGN KEY (package_id) REFERENCES tour_packages(package_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_package_date UNIQUE (package_id, available_date),
    CONSTRAINT chk_seats_available CHECK (seats_available >= 0)
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    package_id INT NOT NULL,
    availability_id INT NOT NULL,
    travelers INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    booking_status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')
        NOT NULL DEFAULT 'PENDING',
    payment_status ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED')
        NOT NULL DEFAULT 'PENDING',
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_customer
        FOREIGN KEY (customer_id) REFERENCES users(user_id),
    CONSTRAINT fk_booking_package
        FOREIGN KEY (package_id) REFERENCES tour_packages(package_id),
    CONSTRAINT fk_booking_availability
        FOREIGN KEY (availability_id) REFERENCES package_availability(availability_id),
    CONSTRAINT chk_booking_travelers CHECK (travelers > 0),
    CONSTRAINT chk_booking_amount CHECK (total_amount >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')
        NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_payment_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    CONSTRAINT fk_payment_customer
        FOREIGN KEY (customer_id) REFERENCES users(user_id),
    CONSTRAINT chk_payment_amount CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    package_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    CONSTRAINT fk_review_customer
        FOREIGN KEY (customer_id) REFERENCES users(user_id),
    CONSTRAINT fk_review_package
        FOREIGN KEY (package_id) REFERENCES tour_packages(package_id),
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    CONSTRAINT fk_permission_admin
        FOREIGN KEY (admin_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_admin_permission UNIQUE (admin_id, permission_name)
);

CREATE TABLE IF NOT EXISTS system_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);
