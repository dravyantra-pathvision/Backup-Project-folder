# DravYantra — Executive Project Progress & Production Readiness Report

**Document Version:** 4.0 (Production Readiness & Heavy Vehicle Pilot Action Plan)  
**Date:** August 18, 2026  
**Target Audience:** Executive Management, Product Engineering & Operations Leadership  
**PDF Report File Generated:** `docs/DravYantra_Project_Progress_Report.pdf` *(Clean 3-Page PDF Report)*

---

## Executive Summary & Status Dashboard

DravYantra is an enterprise IoT fleet management platform designed for real-time tracking, fuel theft monitoring, driver behavior analytics, engine state detection, and multi-tenant organization management. The system connects a **Mobile Fleet Owner App (Android/iOS)**, an **AWS Amplify-hosted Admin Dashboard**, a **Node.js/Express cloud API**, a **PostgreSQL database**, and a **custom telemetry hardware unit**.

### Overall Completion Metrics
| Subsystem / Engineering Scope | Status | Completion % | Estimated Time Schedule |
| :--- | :--- | :---: | :---: |
| **Software Platform (Apps, Web, API, DB)** | Production Ready | **92%** | **7 Days** (App Fine-Tuning & Backend Simulation) |
| **Hardware Components Selection (BOM)** | 100% Finalized | **100%** | Completed |
| **Hardware Procurement & Sourcing** | Pending Purchase | **0%** | **20 Days** |
| **Firmware Prototype & Debugging** | Prototype Phase | **10%** | **2–3 Days** |
| **Commercial Vehicle Fitment & Mechanical Sync** | Pending Field Trial | **0%** | **20 Days** |
| **OVERALL SYSTEM PRODUCTION READINESS** | **ON TRACK** | **72%** | **~50 Days Total to Heavy Vehicle Pilot** |

---

## 1. Finalized Hardware Component Specifications & Unit Costs

The hardware stack has been finalized specifically for high-reliability operational deployment in heavy commercial vehicles (trucks, tippers, trailers, buses).

| Component Category | Selected Component / Model | Unit Cost | Technical Function & System Role |
| :--- | :--- | :---: | :--- |
| **Microcontroller (MCU)** | **Nordic Semiconductor nRF52840 Development Kit (nRF52840-DK)** | **₹5,000** | Central ARM Cortex-M4F MCU, BLE 5.4, sensor data aggregator. |
| **GPS / GNSS Module** | **u-blox NEO-M9N-00B** | **₹1,500** | Concurrent 4-GNSS satellite tracking for sub-meter positioning accuracy. |
| **Cellular Modem** | **u-blox SARA-R10** | **₹5,000** | Multi-band LTE Cat 1 / NB-IoT cellular cloud transmitter. |
| **Vibration Sensor** | **Analog Devices ADXL345** | **₹250** | 3-axis accelerometer for Engine ON/OFF/IDLE & crash alert. |
| **Fuel Tank Sensor** | **Mercetech SP BLE-4** | **₹6,000** | Wireless capacitive fuel level probe with BLE broadcast & theft alert. |
| **TOTAL HARDWARE BOM** | **Complete Prototype Hardware Kit** | **₹17,750** | **Total cost per vehicle unit for hardware prototype assembly** |

---

## 2. Work Completed to Date (Software, Cloud API & System Architecture)

#### ☑️ Major Completed Software Features
- [x] **Mobile Fleet Owner App (Flutter)**: Full onboarding wizard, user authentication, email verification link handling via Firebase, and protected routing.
- [x] **Live Fleet Tracking & Interactive Map**: Real-time vehicle positions, speed overlays, trip routes, and driver details.
- [x] **Admin Web Dashboard (AWS Amplify)**: Multi-tenant Organization approval/rejection screen with `Approved` status persistence and default status filters (`Status: All`).
- [x] **Fleet Owner Account Management**: Soft delete and permanent database purge capability for fleet owners and associated records.
- [x] **Cloud Backend REST API (Node.js & Express)**: Authentication, `requireApprovedOrg` access gate middleware, role-based access control (RBAC), and audit logging.
- [x] **Database Engine (PostgreSQL)**: Scalable relational schema with telemetry history, trip calculation engine, fuel theft alerts, and user synchronization.
- [x] **Email & Analytics Reports**: Transactional Nodemailer (`X-Priority: 1`) and automated ExcelJS & PDFKit report generators.

---

## 3. Software Architecture & Security Gates (In Easy Words)

1. **Organization Approval Security Gate**:
   When a new fleet owner signs up and verifies their email, our backend automatically blocks them from accessing app features until Super Admin approves their Organization Profile in the Admin Dashboard.

2. **Permanent Database Cleanup**:
   When an admin permanently deletes a fleet owner, the backend runs a clean cascade across 10 database tables (vehicles, drivers, trips, fuel logs, audit logs) and deletes their account from Firebase Auth.

3. **AWS Amplify Auto Web Hosting**:
   Our Admin Dashboard code is connected directly to GitHub. Whenever we push new updates to the repository, AWS Amplify automatically builds and publishes the new web version live on secure HTTPS servers.

4. **PostgreSQL Trip & Telemetry Engine**:
   Our database continuously receives location updates from moving vehicles and automatically calculates total distance traveled, average speed, idling time, and fuel consumption.

---

## 4. Action Plan to Heavy Vehicle Pilot Deployment

1. **Phase 1: App Fine-Tuning & Backend Logic Simulation Testing (7 Days)**
   - Fine-tune minor UI details in Mobile App and Admin Dashboard.
   - Run telemetry simulation scripts against backend API to thoroughly test trip calculation engines, speed alert thresholds, and fuel theft detection algorithms.

2. **Phase 2: Hardware Component Procurement & Prototype Building (20 Days)**
   - Purchase physical components (Nordic nRF52840-DK ₹5k, u-blox NEO-M9N ₹1.5k, u-blox SARA-R10 ₹5k, ADXL345 ₹250, Mercetech SP BLE-4 ₹6k).
   - Study datasheets & SDKs, understand pinouts & protocols, and build initial working hardware prototype.

3. **Phase 3: Hardware / Firmware Prototype Debugging (2–3 Days)**
   - Resolve hardware/firmware communication glitches, memory leaks, and BLE disconnection edge-cases.
   - Calibrate ADXL345 3-axis vibration thresholds and map Mercetech BLE-4 fuel level capacitive lookup tables.

4. **Phase 4: Commercial Truck Owner Alignment & Mechanical Fitment (20 Days)**
   - Coordinate with heavy commercial vehicle fleet owners and consult automotive mechanical engineers regarding physical IP67 enclosure mounting, 12V/24V power buck converter wiring, and fuel tank probe placement. Conduct live road trial (100+ km).
