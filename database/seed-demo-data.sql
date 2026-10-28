-- Local Tourism Package Booking System
-- Member 2: Destinations & Tour Package Discovery Demo Data Seed Script
-- Safe to run multiple times (idempotent with INSERT IGNORE)

USE tourism_booking;

-- 1. Providers
INSERT IGNORE INTO users (user_id, name, email, password, mobile, role, status) VALUES
(1, 'Royal Heritage Journeys', 'heritage@roamly.in', '$2b$10$demoHashedPasswordRoamly1234', '+91 98765 43210', 'PROVIDER', 'ACTIVE'),
(2, 'Wanderlust India Expeditions', 'wanderlust@roamly.in', '$2b$10$demoHashedPasswordRoamly5678', '+91 98220 12345', 'PROVIDER', 'ACTIVE'),
(3, 'Aarav Sharma', 'aarav@customer.in', '$2b$10$demoHashedPasswordRoamly9999', '+91 98111 22334', 'CUSTOMER', 'ACTIVE'),
(4, 'Priya Nair', 'priya@customer.in', '$2b$10$demoHashedPasswordRoamly8888', '+91 98444 55667', 'CUSTOMER', 'ACTIVE');

-- 2. Categories
INSERT IGNORE INTO categories (category_id, category_name, description, status) VALUES
(1, 'Heritage & Culture', 'Step into royal palaces, majestic forts, and ancient spiritual landmarks rich in folklore.', 'ACTIVE'),
(2, 'Backwaters & Nature', 'Cruise peaceful canals, emerald tea estates, and soothing tropical backdrops.', 'ACTIVE'),
(3, 'Beaches & Coastal', 'Sun-kissed sands, pristine coastal sunsets, and laid-back seaside escapes.', 'ACTIVE'),
(4, 'Adventure & Treks', 'Himalayan mountain passes, alpine valleys, river rapids, and high-altitude trails.', 'ACTIVE'),
(5, 'Spiritual & Pilgrimage', 'Sacred river ghats, ancient temple rituals, and soulful mindfulness sanctuaries.', 'ACTIVE'),
(6, 'Wildlife & Eco-Tours', 'Untamed tiger reserves, dense jungle canopies, and bird-watching safaris.', 'ACTIVE');

-- 3. Destinations
INSERT IGNORE INTO destinations (destination_id, name, city, state, country, description, status) VALUES
(1, 'Kerala Backwaters & Hills', 'Kochi', 'Kerala', 'India', 'God\'s Own Country celebrated for serene emerald backwaters, misty spice hills of Munnar, and peaceful Arabian Sea shores.', 'ACTIVE'),
(2, 'Royal Rajasthan', 'Jaipur', 'Rajasthan', 'India', 'The majestic desert realm of royal hill forts, pink-hued palaces, colorful bazaars, and legendary chivalric history.', 'ACTIVE'),
(3, 'Goan Coastline', 'Panaji', 'Goa', 'India', 'A tropical coastal paradise boasting golden beaches, Portuguese-era colonial architecture, and sunset cruises.', 'ACTIVE'),
(4, 'Himachal Alpine Valley', 'Manali', 'Himachal Pradesh', 'India', 'Cradled in the Himalayan ranges with snow-capped peaks, alpine pine forests, river rapids, and peaceful valleys.', 'ACTIVE'),
(5, 'Ladakh High Desert', 'Leh', 'Ladakh', 'India', 'The mystical roof of the world featuring dramatic moonscapes, ancient Buddhist monasteries, and crystal blue Pangong Lake.', 'ACTIVE'),
(6, 'Varanasi Sacred River', 'Varanasi', 'Uttar Pradesh', 'India', 'One of the world\'s oldest living cities on the sacred banks of the Ganges, renowned for evocative evening aartis and silk weaving.', 'ACTIVE');

-- 4. Tour Packages (all APPROVED for public discovery)
INSERT IGNORE INTO tour_packages (package_id, provider_id, destination_id, category_id, title, description, duration_days, price, capacity, image, status) VALUES
(1, 1, 1, 2, 'Kerala Backwaters & Munnar Tea Estates', 'Glide through tranquil palm-fringed lagoons aboard a traditional deluxe houseboat and wander through mist-shrouded green tea plantations in Munnar. Includes authentic Kerala sadhya meals, spice plantation visits, and Kathakali cultural evening.', 5, 24999.00, 15, 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(2, 1, 2, 1, 'Royal Rajasthan Forts & Palaces Trail', 'Immerse yourself in royal history across Jaipur, Jodhpur, and Udaipur. Marvel at the intricate Amber Fort, the majestic Mehrangarh citadel, and serene Lake Pichola while staying in authentic heritage havelis.', 6, 32500.00, 18, 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(3, 2, 3, 3, 'Goan Heritage & Sunset Coastal Haven', 'Unwind along peaceful South Goan coastlines, discover historic 16th-century churches of Old Goa, explore lush organic spice farms, and savor authentic Konkani seafood on a private sunset catamaran cruise.', 4, 18999.00, 20, 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(4, 2, 4, 4, 'Manali Alpine Escapade & Solang Valley', 'Experience exhilarating paragliding and river crossing in Solang Valley, drive through the engineering marvel of Atal Tunnel to Lahaul, and rejuvenate beside natural hot sulfur springs in Vashisht.', 5, 21500.00, 14, 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(5, 1, 5, 4, 'Ladakh High-Pass & Pangong Tso Expedition', 'Cross Khardung La, one of the world\'s highest motorable passes, marvel at Nubra Valley\'s double-humped camel dunes, and stargaze by the changing turquoise waters of high-altitude Pangong Lake.', 7, 42000.00, 12, 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(6, 1, 6, 5, 'Sacred Varanasi Ghats & Spiritual Awakening', 'Witness the mesmerizing Maha Aarti at Dashashwamedh Ghat from a traditional wooden boat, explore ancient Sarnath where Lord Buddha gave his first sermon, and discover centuries of spiritual music and silk weaving.', 3, 12999.00, 16, 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(7, 2, 1, 6, 'Wayanad Rainforest & Wildlife Sanctuary Retreat', 'Trek through prehistoric Edakkal Caves, spot wild elephants on an open-jeep safari through Muthanga Wildlife Sanctuary, and stay in eco-friendly treehouse retreats enveloped in morning coffee mist.', 3, 14500.00, 12, 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(8, 1, 2, 4, 'Jaisalmer Thar Desert Camel Safari & Stargazing', 'Camp in luxury Swiss tents beneath billions of desert stars, ride camels over rippling golden sand dunes of Sam, and explore the living golden citadel of Jaisalmer Fort.', 4, 19999.00, 16, 'https://images.unsplash.com/photo-1509299349698-dd22323b5963?auto=format&fit=crop&w=1200&q=80', 'APPROVED'),
(9, 1, 2, 6, 'Ranthambore Royal Tiger Safari & Fort Trail', 'Embark on thrilling morning and evening open-gypsy safaris into the deep teak forests of Ranthambore Tiger Reserve. Ascend the UNESCO World Heritage Ranthambore Fort and stay in luxury jungle lodges.', 3, 18500.00, 12, 'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80', 'PENDING'),
(10, 1, 2, 1, 'Shekhawati Painted Havelis Heritage Trail', 'Explore the open-air art gallery of Rajasthan with richly frescoed 19th-century havelis in Mandawa and Nawalgarh. Authentic Marwari banquet and folk performances included.', 2, 8999.00, 15, 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80', 'INACTIVE'),
(11, 2, 3, 2, 'Dudhsagar Waterfalls & Jungle Jeep Trek', 'Ride through Bhagwan Mahavir Wildlife Sanctuary to the roaring four-tiered white cascades of Dudhsagar. Includes natural forest swimming, spice plantation tour, and Konkani feast.', 2, 7499.00, 18, 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80', 'PENDING'),
(12, 2, 3, 4, 'Goa Extreme Watersports & Island Scuba', 'Thrilling jet-skiing, parasailing, and certified shallow reef diving near Grande Island. Complete safety equipment and underwater video footage provided.', 1, 4500.00, 10, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80', 'REJECTED');

-- 5. Day-by-Day Itineraries
INSERT IGNORE INTO package_itinerary (package_id, day_no, title, description) VALUES
-- Package 1 (Kerala, 5 days)
(1, 1, 'Arrival in Kochi & Colonial Fort Kochi', 'Arrive at Kochi Airport. Check in and visit historic Fort Kochi, Chinese Fishing Nets, St. Francis Church, and enjoy an evening Kathakali classical dance performance.'),
(1, 2, 'Scenic Drive to Munnar Tea Country', 'Travel up the picturesque Western Ghats through misty Cheeyappara and Valara waterfalls. Check in at Munnar resort with panoramic tea hill views.'),
(1, 3, 'Eravikulam National Park & Tea Museum', 'Morning wildlife trek in Eravikulam National Park to spot the endangered Nilgiri Tahr. Afternoon tour of the Tata Tea Museum with tea tasting session.'),
(1, 4, 'Alleppey Backwaters Houseboat Cruise', 'Drive to Alleppey and board your traditional handcrafted Kettuvallam houseboat. Cruise tranquil canals while freshly prepared Kerala sadhya lunch is served on board.'),
(1, 5, 'Kumarakom Bird Sanctuary & Departure', 'Morning village walk through coir-making settlements, visit Kumarakom Bird Sanctuary, and transfer to Kochi Airport for departure.'),

-- Package 2 (Rajasthan, 6 days)
(2, 1, 'Arrival in the Pink City - Jaipur', 'Welcome greeting in Jaipur. Visit the iconic Hawa Mahal facade and City Palace museum. Evening stroll through colorful Johari and Bapu Bazaars.'),
(2, 2, 'Amber Fort & Nahargarh Sunset', 'Elephant or jeep ride up to Amber Fort. Marvel at Sheesh Mahal (Mirror Palace). Catch a golden sunset over the Aravalli hills from Nahargarh Fort.'),
(2, 3, 'Blue City Odyssey - Jodhpur', 'Drive to Jodhpur. Ascend the imposing Mehrangarh Fort overlooking azure houses. Visit Jaswant Thada marble cenotaph and clock tower market.'),
(2, 4, 'Ranakpur Marble Temples to Udaipur', 'Scenic drive through Ranakpur with a guided tour of the 1,444 uniquely carved marble pillars of the Jain Temple. Arrive in the romantic City of Lakes, Udaipur.'),
(2, 5, 'City Palace & Sunset Boat Ride on Lake Pichola', 'Tour the grand Udaipur City Palace complex. In the evening, embark on a private motorboat cruise around Lake Pichola, viewing the illuminated Jag Mandir and Lake Palace.'),
(2, 6, 'Saheliyon-ki-Bari & Farewell', 'Visit the lush fountains of Saheliyon-ki-Bari and Jagdish Temple before transfer to Udaipur Airport.'),

-- Package 3 (Goa, 4 days)
(3, 1, 'Arrival & Calangute Coastal Sunset', 'Arrive in Goa, check in to your beach resort, and relax by the Arabian Sea with chilled coconut water and sunset beach stroll.'),
(3, 2, 'Old Goa Heritage Churches & Spice Plantation', 'Explore Basilica of Bom Jesus and Se Cathedral. Relish an organic Konkani buffet lunch at Sahakari Spice Farm with plantation walk.'),
(3, 3, 'Palolem Beach & Private Sunset Catamaran', 'Discover the crescent shores of Palolem in South Goa. Board a private sunset catamaran cruise with dolphin spotting and acoustic sundowner.'),
(3, 4, 'Fontainhas Latin Quarter & Departure', 'Wander through the vibrant pastel streets of Fontainhas in Panaji, taste traditional Bebinca at a local bakery, and transfer to airport.'),

-- Package 4 (Himachal, 5 days)
(4, 1, 'Arrival in Manali & Old Manali Vibe', 'Transfer to Manali hotel. Evening walk through Old Manali wooden cafes, cedar-wood Hadimba Temple, and Manu Temple.'),
(4, 2, 'Solang Valley Thrills & Adventure', 'Full day of thrilling adventures in Solang Valley: paragliding over green slopes, zorbing, and cable car ropeway rides.'),
(4, 3, 'Atal Tunnel & Sissu Waterfall, Lahaul', 'Cross the spectacular 9.02 km Atal Tunnel beneath Rohtang Pass to enter the stark, rugged beauty of Lahaul Valley and Sissu waterfall.'),
(4, 4, 'Jogini Waterfalls & Vashisht Hot Springs', 'Gentle pine forest hike to multi-tiered Jogini Waterfalls. Rejuvenate tired muscles in the natural thermal sulfur baths of Vashisht village.'),
(4, 5, 'Naggar Castle & Departure', 'Visit the historic timber-and-stone Naggar Castle and Nicholas Roerich art gallery before departing for Chandigarh/Delhi.'),

-- Package 5 (Ladakh, 7 days)
(5, 1, 'Arrival in Leh & Complete Acclimatization', 'Fly into Leh (3,500m). Full day of gentle rest and hydration to acclimatize to high altitude. Evening walk to Shanti Stupa for panoramic sunset.'),
(5, 2, 'Indus Valley Monasteries & Hall of Fame', 'Visit ancient Thiksey Monastery (resembling Tibet\'s Potala Palace), Shey Palace, and Sindhu Ghat.'),
(5, 3, 'Over Khardung La to Nubra Valley', 'Drive over legendary Khardung La (17,582 ft). Descend into the dramatic Nubra Valley. Ride double-humped Bactrian camels among Hunder sand dunes.'),
(5, 4, 'Diskit Gompa & Maitreya Buddha Statue', 'Visit the giant 106-foot Maitreya Buddha statue and 14th-century Diskit Monastery. Afternoon relaxation in Sumur village.'),
(5, 5, 'Nubra to High-Altitude Pangong Tso', 'Drive along the wild Shyok River route to the world-famous Pangong Lake (14,270 ft). Watch the lake shift between shades of turquoise, cobalt, and emerald.'),
(5, 6, 'Pangong Sunrise & Return to Leh via Chang La', 'Catch an ethereal sunrise over Pangong Lake. Return to Leh crossing Chang La pass (17,590 ft). Evening leisure shopping in Leh Bazaar.'),
(5, 7, 'Departure from Leh', 'Morning transfer to Leh Kushok Bakula Rimpochee Airport with unforgettable mountain memories.'),

-- Package 6 (Varanasi, 3 days)
(6, 1, 'Arrival & Grand Evening Ganga Aarti', 'Arrive in Varanasi. At dusk, witness the spellbinding Maha Aarti ceremony at Dashashwamedh Ghat from a reserved wooden boat on the river.'),
(6, 2, 'Subah-e-Banaras Boat Ride & Sarnath', 'Dawn boat cruise along the sacred ghats watching morning prayers and rituals. Afternoon excursion to Sarnath Dhamek Stupa and museum.'),
(6, 3, 'Kashi Vishwanath Corridor & Silk Weavers', 'Visit the magnificent Shri Kashi Vishwanath Golden Temple, explore heritage silk-weaving handloom quarters, and departure.');

-- 6. Package Availability
INSERT IGNORE INTO package_availability (package_id, available_date, seats_available, status) VALUES
(1, '2026-11-05', 8, 'AVAILABLE'),
(1, '2026-11-20', 12, 'AVAILABLE'),
(1, '2026-12-10', 4, 'AVAILABLE'),
(2, '2026-11-12', 10, 'AVAILABLE'),
(2, '2026-12-01', 14, 'AVAILABLE'),
(3, '2026-11-08', 15, 'AVAILABLE'),
(3, '2026-11-25', 18, 'AVAILABLE'),
(4, '2026-11-15', 6, 'AVAILABLE'),
(4, '2026-12-05', 10, 'AVAILABLE'),
(5, '2026-11-10', 5, 'AVAILABLE'),
(6, '2026-11-03', 11, 'AVAILABLE'),
(6, '2026-11-18', 14, 'AVAILABLE'),
(7, '2026-11-14', 8, 'AVAILABLE'),
(8, '2026-11-22', 12, 'AVAILABLE');
