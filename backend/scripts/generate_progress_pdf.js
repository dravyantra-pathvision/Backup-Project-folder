// backend/scripts/generate_progress_pdf.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({
  margin: 35,
  size: 'A4',
  bufferPages: true,
  autoFirstPage: true
});

const outputPath = path.join(__dirname, '../../docs/DravYantra_Project_Progress_Report.pdf');

// Ensure docs directory exists
const docsDir = path.dirname(outputPath);
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Styling Tokens
const NAVY = '#0F172A';
const BLUE = '#1D4ED8';
const GREEN = '#15803D';
const DARK_TEXT = '#1E293B';
const LIGHT_BG = '#F8FAFC';
const BORDER_COLOR = '#CBD5E1';
const AMBER = '#B45309';
const MUTED_TEXT = '#64748B';

const PAGE_WIDTH = 525.28; // 595.28 - 70 margin

// Helper: Section Title
function drawSectionHeader(text, yPos) {
  doc.fillColor(NAVY)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(text, 35, yPos);
  doc.rect(35, yPos + 15, PAGE_WIDTH, 1.5).fill(BLUE);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1: EXECUTIVE SUMMARY, STATUS DASHBOARD & HARDWARE BOM
// ─────────────────────────────────────────────────────────────────────────────

// Header Banner
doc.rect(0, 0, 595.28, 75).fill(NAVY);
doc.fillColor('#FFFFFF')
   .fontSize(18)
   .font('Helvetica-Bold')
   .text('DravYantra Fleet Management Ecosystem', 35, 16);

doc.fontSize(10)
   .font('Helvetica')
   .text('Executive Project Progress Report & Heavy Vehicle Pilot Action Plan', 35, 40);

doc.fontSize(8)
   .fillColor('#94A3B8')
   .text('Generated: August 18, 2026  |  Production Readiness Status: 72% Complete', 35, 58);

// Executive Summary Card
let y = 90;
doc.rect(35, y, PAGE_WIDTH, 70).fillAndStroke(LIGHT_BG, BORDER_COLOR);

doc.fillColor(NAVY)
   .fontSize(10)
   .font('Helvetica-Bold')
   .text('EXECUTIVE SUMMARY', 45, y + 8);

doc.fillColor(DARK_TEXT)
   .fontSize(8.5)
   .font('Helvetica')
   .text(
     'DravYantra is an end-to-end IoT platform for real-time fleet tracking, fuel theft monitoring, and driver scorecards. The software platform (Mobile App, AWS Amplify Admin Panel, Express Backend REST API, PostgreSQL DB) is 92% complete and production-tested. Hardware component selection is 100% finalized. The project is executing an Action Plan covering App fine-tuning & simulation testing (7 Days), hardware procurement & prototype development (20 Days), firmware debugging (2-3 Days), and commercial vehicle owner alignment & mechanical installation (20 Days).',
     45,
     y + 22,
     { width: PAGE_WIDTH - 20, lineGap: 2 }
   );

// Project Status Dashboard
y = 175;
drawSectionHeader('PROJECT STATUS DASHBOARD', y);
y += 24;

const drawGauge = (label, pct, yPos, color) => {
  doc.fillColor(DARK_TEXT).fontSize(8.5).font('Helvetica-Bold').text(label, 35, yPos, { width: 190 });
  doc.fillColor(color).fontSize(8.5).font('Helvetica-Bold').text(`${pct}%`, 485, yPos, { width: 75, align: 'right' });
  
  doc.rect(235, yPos + 1, 245, 8).fill('#E2E8F0');
  const fillWidth = (245 * pct) / 100;
  if (fillWidth > 0) {
    doc.rect(235, yPos + 1, fillWidth, 8).fill(color);
  }
};

drawGauge('Overall System Readiness', 72, y, BLUE);
y += 18;
drawGauge('Software Apps & Simulation Scripts', 92, y, GREEN);
y += 18;
drawGauge('Hardware Component Selection (BOM)', 100, y, GREEN);
y += 18;
drawGauge('Hardware Procurement & Sourcing', 0, y, AMBER);
y += 18;
drawGauge('Firmware Prototype & Debugging', 10, y, AMBER);
y += 18;
drawGauge('Commercial Vehicle Mechanical Fitment', 0, y, AMBER);

// Hardware BOM Table
y = 300;
drawSectionHeader('FINALIZED HARDWARE BILL OF MATERIALS (BOM) & UNIT COSTS', y);
y += 24;

doc.rect(35, y, PAGE_WIDTH, 18).fill(NAVY);
doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
doc.text('CATEGORY', 42, y + 5);
doc.text('COMPONENT MODEL', 130, y + 5);
doc.text('UNIT PRICE', 270, y + 5);
doc.text('TECHNICAL FUNCTION & SYSTEM ROLE', 345, y + 5);
y += 18;

const bomList = [
  { cat: 'Microcontroller', model: 'Nordic nRF52840-DK', price: 'Rs 5,000', role: 'Central ARM Cortex-M4F MCU, BLE 5.4, sensor data aggregator' },
  { cat: 'GPS / GNSS', model: 'u-blox NEO-M9N-00B', price: 'Rs 1,500', role: 'Concurrent 4-GNSS constellation tracking, sub-meter positioning' },
  { cat: 'Cellular Modem', model: 'u-blox SARA-R10', price: 'Rs 5,000', role: 'Multi-band LTE Cat 1 / NB-IoT cellular cloud transmitter' },
  { cat: 'Vibration Sensor', model: 'Analog Devices ADXL345', price: 'Rs 250', role: '3-axis accelerometer for Engine ON/OFF/IDLE & crash alert' },
  { cat: 'Fuel Tank Sensor', model: 'Mercetech SP BLE-4', price: 'Rs 6,000', role: 'Wireless capacitive fuel level probe with BLE broadcast' },
];

bomList.forEach((item, idx) => {
  const bg = idx % 2 === 0 ? LIGHT_BG : '#FFFFFF';
  doc.rect(35, y, PAGE_WIDTH, 22).fillAndStroke(bg, BORDER_COLOR);
  doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text(item.cat, 42, y + 6);
  doc.fillColor(DARK_TEXT).font('Helvetica-Bold').text(item.model, 130, y + 6);
  doc.fillColor(GREEN).font('Helvetica-Bold').text(item.price, 270, y + 6);
  doc.fillColor(DARK_TEXT).font('Helvetica').text(item.role, 345, y + 6, { width: 210 });
  y += 22;
});

// Total Cost Box
doc.rect(35, y + 4, PAGE_WIDTH, 22).fillAndStroke('#F1F5F9', NAVY);
doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text('TOTAL PROTOTYPE HARDWARE UNIT COST:', 45, y + 10);
doc.fillColor(GREEN).fontSize(10).font('Helvetica-Bold').text('Rs 17,750 per vehicle unit', 320, y + 10, { align: 'right', width: 230 });

// Page 1 Footer
doc.fillColor(MUTED_TEXT).fontSize(8).font('Helvetica').text('DravYantra Confidential — Executive Status Report — Page 1 of 3', 35, 805, { align: 'center' });


// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2: COMPLETED WORK & SOFTWARE ARCHITECTURE (SIMPLE WORDS)
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();

y = 40;
drawSectionHeader('1. DETAILED COMPLETED WORK (SOFTWARE, API & CLOUD PLATFORM)', y);
y += 24;

doc.rect(35, y, PAGE_WIDTH, 18).fill(NAVY);
doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
doc.text('STATUS', 42, y + 5);
doc.text('MODULE / SCOPE', 110, y + 5);
doc.text('DETAILED IMPLEMENTATION COMPLETED', 210, y + 5);
doc.text('COMPLETION', 475, y + 5, { width: 80, align: 'right' });
y += 18;

const completedList = [
  { status: '[X] Done', scope: 'Mobile App', desc: 'Flutter onboarding wizard, authentication, Firebase email link verification, protected router', pct: '100%' },
  { status: '[X] Done', scope: 'Mobile App', desc: 'Real-time vehicle map tracking, trip history, fuel logs, vehicle & driver screens', pct: '100%' },
  { status: '[X] Done', scope: 'Admin Web', desc: 'AWS Amplify deployment pipeline & multi-tenant Organization approval workflow', pct: '100%' },
  { status: '[X] Done', scope: 'Admin Web', desc: 'Fleet Owners screen with default Status: All filter, soft delete & permanent purge', pct: '100%' },
  { status: '[X] Done', scope: 'Backend API', desc: 'Node.js Express REST API, JWT auth, requireApprovedOrg gate & audit logging', pct: '100%' },
  { status: '[X] Done', scope: 'Database', desc: 'PostgreSQL schema with audit logs, telemetry history & trip calculation engine', pct: '100%' },
  { status: '[X] Done', scope: 'Email & Reports', desc: 'Transactional Nodemailer (X-Priority: 1) & automated ExcelJS/PDFKit report generators', pct: '100%' },
  { status: '[X] Done', scope: 'Hardware BOM', desc: 'Finalized hardware component selection (Nordic nRF52840, NEO-M9N, SARA-R10, BLE-4)', pct: '100%' },
];

completedList.forEach((item, idx) => {
  const bg = idx % 2 === 0 ? LIGHT_BG : '#FFFFFF';
  doc.rect(35, y, PAGE_WIDTH, 26).fillAndStroke(bg, BORDER_COLOR);
  doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold').text(item.status, 42, y + 8);
  doc.fillColor(DARK_TEXT).font('Helvetica-Bold').text(item.scope, 110, y + 8);
  doc.font('Helvetica').text(item.desc, 210, y + 5, { width: 255, lineGap: 1.5 });
  doc.font('Helvetica-Bold').fillColor(GREEN).text(item.pct, 475, y + 8, { width: 80, align: 'right' });
  y += 26;
});

y += 25;
drawSectionHeader('SOFTWARE ARCHITECTURE & SECURITY GATES (SYSTEM DESIGN IN EASY WORDS)', y);
y += 24;

const drawSimpleCard = (x, yPos, title, simpleExplanation) => {
  doc.rect(x, yPos, 256, 75).fillAndStroke(LIGHT_BG, BORDER_COLOR);
  doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text(title, x + 8, yPos + 6);
  doc.fillColor(DARK_TEXT).fontSize(7.5).font('Helvetica').text(simpleExplanation, x + 8, yPos + 18, { width: 240, lineGap: 2 });
};

drawSimpleCard(
  35,
  y,
  'Organization Approval Security Gate',
  'When a new fleet owner signs up and verifies their email, our backend automatically blocks them from accessing app features until Super Admin approves their Organization Profile in the Admin Dashboard.'
);

drawSimpleCard(
  304,
  y,
  'Permanent Database Cleanup',
  'When an admin permanently deletes a fleet owner, the backend runs a clean cascade across 10 database tables (vehicles, drivers, trips, fuel logs, audit logs) and deletes their account from Firebase Auth.'
);

y += 85;
drawSimpleCard(
  35,
  y,
  'AWS Amplify Auto Web Hosting',
  'Our Admin Dashboard code is connected directly to GitHub. Whenever we push new updates to the repository, AWS Amplify automatically builds and publishes the new web version live on secure HTTPS servers.'
);

drawSimpleCard(
  304,
  y,
  'PostgreSQL Trip & Telemetry Engine',
  'Our database continuously receives location updates from moving vehicles and automatically calculates total distance traveled, average speed, idling time, and fuel consumption.'
);

// Page 2 Footer
doc.fillColor(MUTED_TEXT).fontSize(8).font('Helvetica').text('DravYantra Confidential — Executive Status Report — Page 2 of 3', 35, 805, { align: 'center' });


// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3: HARDWARE STACK & ACTION PLAN
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();

y = 40;
drawSectionHeader('2. FINALIZED HARDWARE COMPONENT STACK & SENSOR MECHANICS', y);
y += 24;

const drawHwCard = (yPos, name, model, price, details) => {
  doc.rect(35, yPos, PAGE_WIDTH, 44).fillAndStroke(LIGHT_BG, BORDER_COLOR);
  doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text(`${name}: ${model}`, 43, yPos + 6);
  doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold').text(price, 450, yPos + 6, { align: 'right', width: 100 });
  doc.fillColor(DARK_TEXT).fontSize(7.5).font('Helvetica').text(details, 43, yPos + 18, { width: PAGE_WIDTH - 20, lineGap: 1.5 });
};

drawHwCard(y, 'Microcontroller MCU', 'Nordic Semiconductor nRF52840-DK', 'Rs 5,000', '64MHz ARM Cortex-M4F MCU, BLE 5.4. Central hub reading wireless BLE fuel probe data and UART GNSS positioning strings.');
y += 48;
drawHwCard(y, 'GPS / GNSS Module', 'u-blox NEO-M9N-00B', 'Rs 1,500', 'Concurrent satellite tracking across 4 GNSS constellations (GPS, GLONASS, Galileo, BeiDou) for sub-meter positioning accuracy.');
y += 48;
drawHwCard(y, 'Cellular Modem', 'u-blox SARA-R10', 'Rs 5,000', 'Multi-band LTE Cat 1 / NB-IoT cellular module with 2G fallback for low-latency HTTPS/MQTT data transfer to AWS cloud server.');
y += 48;
drawHwCard(y, 'Fuel Level Sensor Probe', 'Mercetech SP BLE-4', 'Rs 6,000', 'Wireless capacitive fuel probe installed in diesel tank to broadcast real-time fuel levels over BLE and detect sudden fuel theft.');
y += 48;
drawHwCard(y, 'Vibration & Motion Sensor', 'Analog Devices ADXL345', 'Rs 250', '3-axis digital accelerometer measuring engine micro-vibrations across X, Y, Z axes for Engine ON/OFF/IDLE status & harsh braking.');

y += 60;
drawSectionHeader('3. ACTION PLAN TO HEAVY VEHICLE PILOT DEPLOYMENT', y);
y += 24;

const phases = [
  {
    phase: 'PHASE 1 (7 Days)',
    title: 'App Fine-Tuning & Backend Logic Simulation Testing',
    detail: 'Fine-tune minor UI details in Mobile App and Admin Dashboard. Run telemetry simulation scripts against backend API to thoroughly test trip calculation engines, speed alert thresholds, and fuel theft detection algorithms.'
  },
  {
    phase: 'PHASE 2 (20 Days)',
    title: 'Hardware Component Procurement & Prototype Building',
    detail: 'Purchase physical components (Nordic nRF52840-DK, u-blox NEO-M9N, u-blox SARA-R10, ADXL345, Mercetech SP BLE-4). Study datasheets & SDKs, understand pinouts & protocols, and build initial working hardware prototype.'
  },
  {
    phase: 'PHASE 3 (2-3 Days)',
    title: 'Hardware / Firmware Prototype Debugging',
    detail: 'Resolve hardware/firmware communication glitches, memory leaks, and BLE disconnection edge-cases. Calibrate ADXL345 3-axis vibration thresholds and map Mercetech BLE-4 fuel level capacitive lookup tables.'
  },
  {
    phase: 'PHASE 4 (20 Days)',
    title: 'Commercial Truck Owner Alignment & Mechanical Fitment',
    detail: 'Coordinate with heavy commercial vehicle fleet owners and consult automotive mechanical engineers regarding physical IP67 enclosure mounting, 12V/24V power buck converter wiring, and fuel tank probe placement. Conduct live road trial (100+ km).'
  }
];

phases.forEach((p) => {
  doc.rect(35, y, 105, 38).fill(BLUE);
  doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold').text(p.phase, 39, y + 14, { width: 97, align: 'center' });
  
  doc.rect(140, y, 420.28, 38).fillAndStroke('#FFFFFF', BORDER_COLOR);
  doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text(p.title, 148, y + 5);
  doc.fillColor(DARK_TEXT).fontSize(7.5).font('Helvetica').text(p.detail, 148, y + 16, { width: 405, lineGap: 1.5 });
  y += 44;
});

// Page 3 Footer
doc.fillColor(MUTED_TEXT).fontSize(8).font('Helvetica').text('DravYantra Confidential — Executive Status Report — Page 3 of 3', 35, 805, { align: 'center' });

doc.end();

stream.on('finish', () => {
  console.log(`Clean 3-page PDF successfully generated at: ${outputPath}`);
});
