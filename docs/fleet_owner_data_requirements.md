# DravYantra — Fleet Owner Data Requirements
### Complete Data Collection Reference with Justifications

This document lists every single piece of data collected from Fleet Owners - whether entered manually or uploaded as a file. Organized in 10 sections with Play Store Data Safety justifications.

## SECTION 1 — Account Registration

### 1.1 Full Name
- Type: Text Input | Required: Yes | Screen: Sign Up
- Why: Personalizes your account, displays identity on dashboard, appears in system audit logs for accountability. Never sold to third parties.

### 1.2 Email Address  
- Type: Email | Required: Yes | Validation: Valid email format | Screen: Sign Up
- Why: Primary login credential & account identifier. Used for verification emails, password resets, system alerts (fuel theft, speeding, compliance). Never shared for marketing.

### 1.3 Password
- Type: Secure Text | Required: Yes | Min: 8 chars + uppercase + lowercase + number + symbol | Screen: Sign Up
- Why: Authenticates access to your account. Never stored in plain text - encrypted via Firebase Authentication's industry-standard hashing.

### 1.4 Confirm Password
- Type: Secure Text | Required: Yes | Screen: Sign Up
- Why: UI-only verification that password was typed correctly. Never stored or transmitted - discarded immediately after on-device validation.

### 1.5 Google Account (OAuth)
- Type: OAuth | Required: Optional | Accesses: Display Name + Email only | Screen: Sign Up
- Why: Faster sign-in alternative. Only accesses your name and email - no contacts, calendar, drive, or other Google data.

---

## SECTION 2 — Organization Onboarding (3-Step Wizard)

### Step 1 - Basic Information

### 2.1 Company Name
- Type: Text | Required: Yes | Screen: Onboarding Wizard Step 1
- Why: Primary identifier for your organization across the entire platform. Appears on dashboard, reports, driver records, vehicle documents, invoices. Required for KYB (Know Your Business) verification.

### 2.2 Contact Phone Number
- Type: Phone | Required: Yes | Format: +91 + 10 digits (starting 6-9) | Screen: Onboarding Wizard Step 1
- Why: Primary operational contact for your fleet. Used for WhatsApp alerts (over-speed, fuel theft, idling), SMS alerts (compliance expiry), and DravYantra support contact. Never shared with third-party advertisers.

### 2.3 Contact Email
- Type: Email | Required: Yes | Screen: Onboarding Wizard Step 1
- Why: Used for operational email alerts, monthly fleet reports, compliance reminders. May differ from login email (e.g., a team operations mailbox). Visible to admin-role users in your organization.

### Step 2 - Location Information

### 2.4 Company Address
- Type: Location Autocomplete | Required: Yes | Screen: Onboarding Wizard Step 2
- Why: Required for KYB verification. Cross-validated against PAN and GSTIN registration state. Used for official org profile, state-based tax documentation, regional jurisdiction tracking. NOT used for marketing.

### 2.5 City
- Type: Text (auto-filled, editable) | Required: Yes | Screen: Onboarding Wizard Step 2
- Why: Required component of registered business address. Used with State to validate GSTIN state code and generate region-specific compliance reports.

### 2.6 State
- Type: Text (auto-filled, editable) | Required: Yes | Screen: Onboarding Wizard Step 2
- Why: Required to cross-validate GSTIN (state code embedded in first 2 digits). Also used for inter-state vs. intra-state trip classification and permit compliance tracking.

### Step 3 - Business and Tax Details

### 2.7 PAN Number (Permanent Account Number)
- Type: Alphanumeric (10 chars) | Required: Yes | Format: AAAAA9999A | Screen: Onboarding Wizard Step 3
- Why: Mandatory Indian tax identifier for KYB verification. Confirms legitimate tax-registered business identity. Cross-validates with GSTIN. Required for regulatory compliance of commercial fleet software in India. Encrypted at rest - only KYB-role admins can access.

### 2.8 GSTIN (GST Identification Number)
- Type: Alphanumeric (15 chars) | Required: Yes | Format: 2-digit state + PAN + entity code + Z + checksum | Screen: Onboarding Wizard Step 3
- Why: Confirms GST-registered business status. Validates operating state. Enables e-Way Bill tracking for inter-state transport. Required for tax-compliant trip reports and invoices. Satisfies Motor Vehicles Act and GST regulations. Stored encrypted.

### 2.9 Fleet Size
- Type: Dropdown | Required: Yes | Options: 1-10, 11-50, 50-100, 100+ | Screen: Onboarding Wizard Step 3
- Why: Scales subscription plan and resources. Tailors analytics benchmarks. Recommends appropriate hardware bundles. Used for anonymized aggregate market research.

### 2.10 Industry Type
- Type: Dropdown | Required: Yes | Options: Logistics & Transportation, Manufacturing, E-commerce & Retail, Construction & Mining, Agriculture, Other | Screen: Onboarding Wizard Step 3 / Settings
- Why: Customizes dashboard KPIs per sector. Tailors alert thresholds. Enables sector-specific fuel benchmarks and fleet performance reports.

---

## SECTION 3 — Vehicle Management (Add/Edit Vehicle)

### 3.1 Vehicle Registration Plate Number
- Type: Text | Required: Yes | Format: Indian XX NN XX NNNN | Screen: Vehicles > Add/Edit Vehicle
- Why: Unique legal vehicle identifier. Primary key to link GPS telemetry to correct vehicle. Associates trips, fuel logs, driver assignments, compliance docs. Required for e-Way Bill records and live tracking.

### 3.2 Vehicle Make (Manufacturer)
- Type: Text | Required: Optional | Example: Tata, Ashok Leyland, Mahindra | Screen: Vehicles > Add/Edit Vehicle
- Why: Used for maintenance scheduling, manufacturer-specific fuel efficiency benchmarks, fleet composition analytics, and vehicle health calculations.

### 3.3 Vehicle Model / Year
- Type: Text | Required: Optional | Example: 2024, 2020, 2015 | Screen: Vehicles > Add/Edit Vehicle
- Why: Used to calculate Vehicle Health Score based on age. Older vehicles flagged for priority maintenance. Supports data-driven replacement cycle decisions.

### 3.4 Vehicle Type
- Type: Dropdown | Required: Yes | Options: 6 Wheeler, 8 Wheeler, 10+ Wheelers | Screen: Vehicles > Add/Edit Vehicle
- Why: Determines applicable permit/overloading regulations, load capacity limits, national permit requirements (10+ wheelers), and fleet categorization in analytics.

### 3.5 Fuel Type
- Type: Dropdown | Required: Yes | Options: Diesel, Petrol, CNG, EV | Screen: Vehicles > Add/Edit Vehicle
- Why: Critical for accurate fuel consumption calculations including theft detection, idle waste calculations, money wasted, CO2 emission estimates. Incorrect type produces inaccurate telemetry.

### 3.6 Fuel Tank Capacity (Liters)
- Type: Numeric | Required: Optional (strongly recommended) | Screen: Vehicles > Add/Edit Vehicle
- Why: Required to convert raw hardware fuel readings to meaningful percentage levels on dashboard. Enables refueling recommendations and theft detection calibration.

### 3.7 Mileage / Fuel Efficiency (km/L)
- Type: Decimal Number | Required: Optional (strongly recommended) | Screen: Vehicles > Add/Edit Vehicle
- Why: Declared average efficiency used to calculate expected fuel consumption, detect deviations (engine issues/overloading), power "Money Saved vs Wasted" analytics, and set driver performance benchmarks.

### 3.8 Hardware Device ID (Microcontroller UID)
- Type: Text or QR Code Scan | Required: Yes | Screen: Vehicles > Add/Edit Vehicle
- Why: Unique identifier of DravYantra GPS+telemetry hardware installed in vehicle. Binds physical device to vehicle record. Routes all real-time telemetry (GPS, speed, fuel, ignition) to correct vehicle. Without this, vehicle cannot be monitored.

### 3.9 RC Registration Date
- Type: Date Picker | Required: Yes | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: Establishes legal registration date. Used for vehicle age and health score calculation, RC renewal tracking (required after 15 years in India), and compliance alert generation.

### 3.10 RC Document (File Upload)
- Type: File Upload (PDF/Image) | Required: Yes | Storage: encrypted vehicle_docs bucket | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: Legal proof of vehicle registration from RTO. Required for KYV (Know Your Vehicle) verification. Enables digital retrieval during roadside checks or audits. Access-controlled - only authorized org users can view.

### 3.11 Insurance Expiry Date
- Type: Date Picker | Required: Yes | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: Tracked to generate automated expiry alerts (30 days, 7 days, day-of), prevent assigning uninsured vehicles to trips (Motor Vehicles Act violation), and maintain fleet compliance overview.

### 3.12 Insurance Certificate (File Upload)
- Type: File Upload (PDF/Image) | Required: Yes | Storage: encrypted vehicle_docs bucket | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: Legal document proving valid motor insurance (Motor Vehicles Act 1988). Provides digital copy for roadside verification. Enables centralized compliance document repository. Stored encrypted.

### 3.13 PUC Expiry Date
- Type: Date Picker | Required: Yes | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: Tracked to ensure emission standards compliance (Central Motor Vehicles Rules), generate pre-expiry alerts, prevent assigning expired-PUC vehicles to trips, and support fleet-wide emission compliance reporting.

### 3.14 PUC Certificate (File Upload)
- Type: File Upload (PDF/Image) | Required: Yes | Storage: encrypted vehicle_docs bucket | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: Proves vehicle passed emission testing. Provides digital archive for spot checks. Required for DravYantra fleet verification. Evidence for insurance/legal purposes.

### 3.15 Next Service Date
- Type: Date Picker | Required: Optional (strongly recommended) | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: Enables proactive maintenance reminders before service is due. Prevents overuse between service intervals. Tracks service history. Improves vehicle health predictions and reduces trip breakdowns.

### 3.16 National Permit Expiry Date
- Type: Date Picker | Required: Optional (required for inter-state vehicles) | Screen: Vehicles > Add/Edit Vehicle > Compliance Docs
- Why: National permit required for commercial vehicles crossing state lines (especially 10+ wheelers). Tracking prevents illegal inter-state trips and heavy Motor Vehicles Act fines. Generates compliance alerts before expiry.

---

## SECTION 4 — Driver Management (Add/Edit Driver)

### 4.1 Driver Full Name
- Type: Text | Required: Yes | Screen: Drivers > Add/Edit Driver
- Why: Primary driver identifier. Used to assign driver to vehicles/trips, display on live tracking map, generate per-driver performance reports (trip history, money saved/wasted), and track license compliance.

### 4.2 Driver Age
- Type: Number | Required: Yes | Minimum: 18 | Screen: Drivers > Add/Edit Driver
- Why: Verifies minimum legal driving age (18 years LMV, 20 years transport vehicles under Indian law). Prevents minors from being employed as commercial drivers. Enables age-based risk profiling for insurance. System automatically rejects drivers under 18.

### 4.3 Driver Phone Number
- Type: Phone | Required: Yes | Format: +91 + 10 digits (starting 6-9) | Screen: Drivers > Add/Edit Driver
- Why: Used to contact driver during active trips, reach driver in emergencies/breakdowns, send trip assignment notifications (future feature), and for identity verification. Only accessible to authorized fleet owners/admins. Never shared publicly.

### 4.4 Experience (Years of Driving)
- Type: Number | Required: Yes | Screen: Drivers > Add/Edit Driver
- Why: Used in Driver Performance Scoring algorithm. Provides context for performance expectations, informs trip assignment decisions (experienced drivers for long routes), and satisfies insurance requirements for minimum experience thresholds.

### 4.5 Blood Group
- Type: Dropdown | Required: Yes | Options: A+, A-, B+, B-, AB+, AB-, O+, O- | Screen: Drivers > Add/Edit Driver
- Why: Critical safety detail for emergency response. Enables medical teams to immediately identify blood type for transfusions in case of accident. Accessible to emergency responders via fleet owner or transport manager.

### 4.6 Driving License Number
- Type: Text | Required: Yes | Format: State Code + RTO + Year + Number | Screen: Drivers > Add/Edit Driver
- Why: Legal requirement for employing commercial drivers. Verifies valid license, enables expiry tracking and renewal reminders, satisfies Motor Vehicles Act requirements, provides evidence for roadside inspections/legal disputes.

### 4.7 Driving License Expiry Date
- Type: Date Picker | Required: Yes | Screen: Drivers > Add/Edit Driver
- Why: Tracked to auto-alert fleet owner 30 days before expiry, prevent expired-license driver assignments (criminal offense under Motor Vehicles Act), and generate compliance summaries for renewal planning.

### 4.8 Home Address / Hometown
- Type: Text | Required: Optional | Screen: Drivers > Add/Edit Driver
- Why: Used for emergency contact communication, distance-from-depot calculations for route optimization, and understanding driver availability for regional deployment. Accessible only to authorized fleet management personnel.

### 4.9 Driver Photo (Camera Capture)
- Type: Camera Capture (Front Camera) | Required: Yes | Storage: encrypted driver_docs bucket | Screen: Drivers > Add/Edit Driver
- Why: Visual identity verification for fleet owners/managers. Profile display in dashboard and driver cards. Emergency identification in accidents. KYD (Know Your Driver) verification by DravYantra admins. Stored encrypted - only authorized org personnel can view.

### 4.10 Aadhar Card (File Upload)
- Type: File Upload (PDF/Image) | Required: Yes | Storage: encrypted driver_docs bucket | Screen: Drivers > Add/Edit Driver
- Why: Government-issued photo ID proof. Required for KYD identity verification, legal compliance (Indian transport regulations require employer to maintain driver ID documents), background verification support, and confirming right to work in India. SENSITIVE DATA - classified as SPI under DPDP Act 2023. Encrypted and access-controlled. Only KYD verification team + authorized fleet owners can access.

### 4.11 Driving License Document (File Upload)
- Type: File Upload (PDF/Image) | Required: Yes | Storage: encrypted driver_docs bucket | Screen: Drivers > Add/Edit Driver
- Why: Official license document copy. Provides verifiable digital copy linked to entered license number. Confirms license validity and expiry. Serves as legal evidence for accidents/insurance claims. Satisfies Motor Vehicles Act documentation requirements. Accessible only to assigned fleet owner and DravYantra admins.

---

## SECTION 5 — Trip Management (Schedule New Trip)

### 5.1 Vehicle Selection
- Type: Dropdown (from registered vehicles) | Required: Yes | Screen: Trips > Schedule New Trip
- Why: Links trip to specific registered vehicle. Routes all telemetry (GPS, speed, fuel) to correct vehicle. Enforces single-assignment (vehicle cannot have 2 active trips). Enables live tracking during trip.

### 5.2 Driver Selection
- Type: Dropdown (from registered drivers) | Required: Yes | Screen: Trips > Schedule New Trip
- Why: Links specific driver to trip. Updates driver's trip count and performance stats in real-time. Enforces single-assignment (driver cannot have 2 active trips). Attributes driving behavior (braking, speeding, idling) to correct driver.

### 5.3 Origin City (From)
- Type: City Search (Indian city database) | Required: Yes | Screen: Trips > Schedule New Trip
- Why: Defines trip start location. Used for automatic road distance calculation, trip progress tracking, inter-state determination (requires national permit/e-Way Bill), and live tracking map display.

### 5.4 Destination City (To)
- Type: City Search (Indian city database) | Required: Yes | Screen: Trips > Schedule New Trip
- Why: Defines trip end location. Combined with origin for road distance calculation, e-Way Bill route validation (GST requirement), ETA and delay tracking, and geofence alert generation for route deviation.

### 5.5 e-Way Bill Number
- Type: 12-digit Numeric | Required: Optional (mandatory for GST-eligible transport) | Screen: Trips > Schedule New Trip
- Why: GST-mandated electronic permit for goods worth Rs.50,000+ across state lines. Links trip to legal GST documentation. Enables audit/compliance verification. Displayed in trip detail and driver profile for spot checks.

### 5.6 e-Way Bill Document (File Upload)
- Type: File Upload (PDF/Image) | Required: Optional | Storage: encrypted trip_docs bucket | Screen: Trips > Schedule New Trip
- Why: Digital copy of GST e-Way Bill. Provides driver access during police checks and toll checkpoints. Stores copy linked to specific trip record. Enables remote retrieval if physical copy is lost.

### 5.7 Client Name
- Type: Text | Required: Yes | Screen: Trips > Schedule New Trip
- Why: Records which customer commissioned the trip. Enables client-wise reporting, billing summaries, service delivery tracking, invoice/dispute resolution, and fleet utilization analysis by client.

### 5.8 Load Type / Description
- Type: Text | Required: Yes | Screen: Trips > Schedule New Trip
- Why: Documents goods being transported. Required to match e-Way Bill commodity declarations, determine if special permits apply (hazardous/oversized), generate accurate audit documentation, and maintain cargo history per vehicle.

---

## SECTION 6 — Fleet Settings (Operational Configuration)

### 6.1 Fleet Over-Speeding Limit (km/h)
- Type: Number | Required: Yes (default provided) | Screen: Settings > Fleet Settings
- Why: Maximum speed threshold before alerts trigger. Enables speed policy enforcement, accident risk reduction, road speed limit compliance, and potentially lower insurance premiums.

### 6.2 Fleet Fuel Theft Limit (Liters)
- Type: Decimal Number | Required: Yes (default provided) | Screen: Settings > Fleet Settings
- Why: Maximum acceptable sudden fuel drop before system flags potential theft. Calibrates detection sensitivity - higher values for large-tank vehicles, lower for small tanks. Triggers alerts, logs incidents, and notifies owner.

### 6.3 Idle Duration Limit (Minutes)
- Type: Number | Required: Yes (default provided) | Screen: Settings > Fleet Settings
- Why: Maximum idle time (engine on + stationary) before alert triggers. Enforces anti-idling policy. System calculates "Money Wasted" and "Idle Fuel Wasted" per trip in real-time.

### 6.4 Low Mileage Threshold (km/L)
- Type: Decimal Number | Required: Yes (default provided) | Screen: Settings > Fleet Settings
- Why: Minimum acceptable fuel efficiency. Triggers alert when below threshold. Identifies fuel waste from poor driving, engine issues, wrong tire pressure, or overloading.

### 6.5 Default Fuel Price (Rs/Liter)
- Type: Decimal Number | Required: Yes (default provided) | Screen: Settings > Fleet Settings
- Why: Used in all financial calculations: Money Saved = Fuel saved x Price; Money Wasted = Idle fuel x Price; Theft Cost = Stolen liters x Price. Fleet owner sets to match actual local fuel cost for accurate analytics.

---

## SECTION 7 — Alert & Notification Preferences

### 7.1 WhatsApp Alerts Toggle
- Type: Toggle On/Off | Screen: Settings > Alert Thresholds > Notification Channels
- Why: If enabled, WhatsApp alerts sent to org contact phone when any threshold is breached (over-speed, fuel theft, idle, low mileage, compliance expiry). Preferred real-time channel for Indian fleet operators.

### 7.2 SMS Alerts Toggle
- Type: Toggle On/Off | Screen: Settings > Alert Thresholds > Notification Channels
- Why: If enabled, SMS alerts for critical events. Fallback channel when WhatsApp unavailable. User-controlled preference.

### 7.3 Email Alerts Toggle
- Type: Toggle On/Off | Screen: Settings > Alert Thresholds > Notification Channels
- Why: If enabled, email alerts for all threshold events and compliance reminders. Provides written, archivable record for audit and insurance purposes.

### 7.4 Push Notifications Toggle
- Type: Toggle On/Off | Screen: Settings > Alert Thresholds > Notification Channels
- Why: If enabled, real-time push notifications to fleet owner's device. Fastest alerting channel for immediate response to critical events.

---

## SECTION 8 — User Profile (Personal Account Settings)

### 8.1 User Full Name
- Type: Text (editable) | Screen: Settings > User Profile
- Why: Personalizes dashboard, identifies user in multi-user org audit logs, used in email communications and organization activity feed.

### 8.2 Work Email (Read-Only)
- Type: Display Only | Screen: Settings > User Profile
- Why: Login email from Firebase Authentication. Shown for reference only - cannot be changed in-app for security (prevents unauthorized account takeover). Tied to all alert communications.

### 8.3 Personal Phone Number
- Type: Phone (editable) | Format: Indian mobile | Screen: Settings > User Profile
- Why: Reaches specific logged-in user (vs. org general contact). May be used for 2FA (future), account recovery, and direct support contact.

### 8.4 Employee ID
- Type: Text (editable) | Required: Optional | Screen: Settings > User Profile
- Why: Used in multi-user orgs to attribute actions to specific employees in audit logs. Supports internal accountability.

### 8.5 Department
- Type: Text (editable) | Required: Optional | Screen: Settings > User Profile
- Why: Categorizes user within org (Operations, Logistics, Finance). Used for role-based access control and audit log filtering by department.

### 8.6 Language Preference
- Type: Text (editable) | Required: Optional | Screen: Settings > User Profile
- Why: Stores preferred language for multi-language interface support (future feature). Eliminates need to re-select language on each login.

---

## SECTION 9 — Support Tickets

### 9.1 Support Ticket Subject
- Type: Text | Required: Yes | Screen: Settings > Support Tickets > Create Ticket
- Why: Enables support team to triage and route inquiry to correct department. Clear subject accelerates resolution.

### 9.2 Support Ticket Description / Message
- Type: Multi-line Text | Required: Yes | Screen: Settings > Support Tickets > Create Ticket
- Why: Provides detailed context for the fleet owner's issue or feedback. Used exclusively to resolve the support request. Stored in internal ticketing system - not shared externally.

---

## SECTION 10 — Automatically Collected Data (No User Input)

### 10.1 GPS Location (Real-Time)
- Source: Hardware device installed in vehicle
- Why: Core fleet tracking feature. Powers live tracking map, route deviation detection, geofencing alerts, trip progress. Linked to vehicle (not driver personally). Used exclusively for fleet monitoring.

### 10.2 Vehicle Speed (Real-Time)
- Source: Hardware device (GPS-derived)
- Why: Detects over-speeding, tracks trip progress, calculates trip distances, contributes to driver performance scoring.

### 10.3 Fuel Level (Real-Time)
- Source: Fuel sensor via hardware device
- Why: Calculates fuel consumption per trip, detects sudden drops (theft), generates low-fuel alerts, displays fuel percentage on dashboard.

### 10.4 Ignition / Engine State (On/Off)
- Source: Hardware device
- Why: Differentiates idling (engine on + stationary) from legitimate stops. Enables accurate idle time and idle fuel waste calculations.

### 10.5 Trip Duration and Distance
- Source: Calculated from GPS data during trips
- Why: Used for fuel consumption calculations, driver performance scores, money saved/wasted metrics, and trip reports.

### 10.6 Firebase Analytics and Crash Reports
- Source: Firebase SDK
- Why: Identifies bugs, improves app stability, understands feature usage. No PII included in crash reports.

---

## Summary Table (All 67 Fields + 6 Auto-collected)

| # | Field | Section | Type | Required | File Upload |
|---|-------|---------|------|----------|-------------|
| 1 | Full Name | Account | Text | Yes | - |
| 2 | Email | Account | Email | Yes | - |
| 3 | Password | Account | Secure | Yes | - |
| 4 | Confirm Password | Account | Secure | Yes | - |
| 5 | Google OAuth | Account | OAuth | Optional | - |
| 6 | Company Name | Onboarding | Text | Yes | - |
| 7 | Contact Phone | Onboarding | Phone | Yes | - |
| 8 | Contact Email | Onboarding | Email | Yes | - |
| 9 | Company Address | Onboarding | Location | Yes | - |
| 10 | City | Onboarding | Text | Yes | - |
| 11 | State | Onboarding | Text | Yes | - |
| 12 | PAN Number | Onboarding | Alphanumeric | Yes | - |
| 13 | GSTIN | Onboarding | Alphanumeric | Yes | - |
| 14 | Fleet Size | Onboarding | Dropdown | Yes | - |
| 15 | Industry Type | Onboarding | Dropdown | Yes | - |
| 16 | Vehicle Plate | Vehicle | Text | Yes | - |
| 17 | Vehicle Make | Vehicle | Text | Optional | - |
| 18 | Vehicle Model/Year | Vehicle | Text | Optional | - |
| 19 | Vehicle Type | Vehicle | Dropdown | Yes | - |
| 20 | Fuel Type | Vehicle | Dropdown | Yes | - |
| 21 | Fuel Tank Capacity | Vehicle | Number | Optional | - |
| 22 | Mileage (km/L) | Vehicle | Decimal | Optional | - |
| 23 | Hardware Device ID | Vehicle | Text/QR | Yes | - |
| 24 | RC Registration Date | Vehicle | Date | Yes | - |
| 25 | RC Document | Vehicle | File | Yes | YES |
| 26 | Insurance Expiry Date | Vehicle | Date | Yes | - |
| 27 | Insurance Certificate | Vehicle | File | Yes | YES |
| 28 | PUC Expiry Date | Vehicle | Date | Yes | - |
| 29 | PUC Certificate | Vehicle | File | Yes | YES |
| 30 | Next Service Date | Vehicle | Date | Optional | - |
| 31 | National Permit Date | Vehicle | Date | Optional | - |
| 32 | Driver Name | Driver | Text | Yes | - |
| 33 | Driver Age | Driver | Number | Yes | - |
| 34 | Driver Phone | Driver | Phone | Yes | - |
| 35 | Experience (Years) | Driver | Number | Yes | - |
| 36 | Blood Group | Driver | Dropdown | Yes | - |
| 37 | License Number | Driver | Text | Yes | - |
| 38 | License Expiry Date | Driver | Date | Yes | - |
| 39 | Home Address | Driver | Text | Optional | - |
| 40 | Driver Photo | Driver | Camera | Yes | YES |
| 41 | Aadhar Card | Driver | File | Yes | YES (SPI) |
| 42 | License Document | Driver | File | Yes | YES |
| 43 | Vehicle (Trip) | Trip | Dropdown | Yes | - |
| 44 | Driver (Trip) | Trip | Dropdown | Yes | - |
| 45 | Origin City | Trip | City Search | Yes | - |
| 46 | Destination City | Trip | City Search | Yes | - |
| 47 | e-Way Bill Number | Trip | 12-digit | Optional | - |
| 48 | e-Way Bill Document | Trip | File | Optional | YES |
| 49 | Client Name | Trip | Text | Yes | - |
| 50 | Load Description | Trip | Text | Yes | - |
| 51 | Speed Limit (km/h) | Settings | Number | Yes | - |
| 52 | Fuel Theft Limit (L) | Settings | Decimal | Yes | - |
| 53 | Idle Duration (mins) | Settings | Number | Yes | - |
| 54 | Low Mileage (km/L) | Settings | Decimal | Yes | - |
| 55 | Fuel Price (Rs/L) | Settings | Decimal | Yes | - |
| 56 | WhatsApp Toggle | Alerts | Toggle | Yes | - |
| 57 | SMS Toggle | Alerts | Toggle | Yes | - |
| 58 | Email Toggle | Alerts | Toggle | Yes | - |
| 59 | Push Notif. Toggle | Alerts | Toggle | Yes | - |
| 60 | User Full Name | Profile | Text | Yes | - |
| 61 | Work Email | Profile | Display | Auto | - |
| 62 | Personal Phone | Profile | Phone | Yes | - |
| 63 | Employee ID | Profile | Text | Optional | - |
| 64 | Department | Profile | Text | Optional | - |
| 65 | Language Preference | Profile | Text | Optional | - |
| 66 | Ticket Subject | Support | Text | Yes | - |
| 67 | Ticket Description | Support | Text | Yes | - |
| A1 | GPS Location | Auto | Hardware | Auto | - |
| A2 | Vehicle Speed | Auto | Hardware | Auto | - |
| A3 | Fuel Level | Auto | Hardware | Auto | - |
| A4 | Engine State | Auto | Hardware | Auto | - |
| A5 | Trip Distance | Auto | Calculated | Auto | - |
| A6 | Firebase Analytics | Auto | SDK | Auto | - |

Total: 67 user-entered fields + 6 automatically collected = 73 total data points
File uploads: 8 document uploads (RC, Insurance, PUC, Driver Photo, Aadhar, License, e-Way Bill) stored in encrypted cloud storage.

---

## Data Retention Policy

| Data Category | Retention Period |
|---------------|-----------------|
| Account credentials | Until account deletion |
| Organization profile (PAN, GSTIN, address) | Subscription duration + 7 years (legal requirement) |
| Vehicle compliance documents (RC, Insurance, PUC) | 7 years after document expiry |
| Driver documents (Aadhar, License) | Duration of employment + 3 years |
| Trip records | 5 years (GST audit compliance) |
| Real-time telemetry (GPS, speed, fuel) | 1 year rolling history |
| Support ticket messages | 3 years |
| Push notification tokens | Until logout or app uninstall |

---

## Data Security Measures

- Documents (RC, Insurance, PUC, Aadhar, License) stored in encrypted, access-controlled cloud storage (Supabase with Row-Level Security)
- Sensitive fields (PAN, GSTIN) encrypted at rest
- All API communications secured via HTTPS/TLS
- Authentication via Firebase Authentication (industry-standard OAuth2 + JWT)
- Document access restricted to authenticated users within the same organization
- Aadhar card treated as Sensitive Personal Information (SPI) under India's DPDP Act, 2023

---

## Contact for Data Inquiries
- Email: privacy@dravyantra.in (update with actual email)
- Data Protection Officer: (add name)
- DravYantra Technologies Pvt. Ltd. (update with legal entity name)

Last updated: August 2026
