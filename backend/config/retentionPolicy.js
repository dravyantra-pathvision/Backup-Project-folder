// config/retentionPolicy.js
/**
 * DravYantra Central Data Retention & Deletion Policy
 * Classifies data categories according to DPDP Act 2023, Google Play Policies, and Indian Tax Regulations.
 */

const RETENTION_POLICY = {
  FIREBASE_AUTH: {
    action: 'HARD_DELETE',
    timing: 'FINAL_STEP',
    reason: 'Account identity removal upon completion of application data cleanup.',
  },
  PERSONAL_PROFILE: {
    action: 'ANONYMIZE',
    reason: 'RETAIN_FOR_SECURITY_AUDIT',
    anonymizedFields: ['full_name', 'email', 'phone', 'employee_id', 'department'],
  },
  KYB_ORGANIZATION: {
    action: 'ANONYMIZE',
    reason: 'AGGREGATE_MARKET_STATISTICS',
    wipedFields: ['pan', 'gstin', 'address', 'contact_number', 'contact_email', 'city', 'state'],
    retainedFields: ['fleet_size', 'industry_type'],
  },
  DOCUMENT_FILES: {
    action: 'HARD_DELETE',
    reason: 'SENSITIVE_PERSONAL_DATA_PURGE',
    targets: ['rc_url', 'insurance_url', 'puc_url', 'image_url', 'aadhar_url', 'license_url', 'eway_bill_url', 'attachments'],
  },
  VEHICLES_AND_DRIVERS: {
    action: 'HARD_DELETE',
    reason: 'FLEET_OWNERSHIP_TERMINATION',
  },
  TRIPS_AND_TELEMETRY: {
    action: 'HARD_DELETE',
    reason: 'SENSITIVE_LOCATION_TELEMETRY_PURGE',
    targets: ['trips', 'fuel_logs', 'alerts', 'vehicle_baselines', 'fuel_loss_events', 'monthly_savings_wallet'],
  },
  IOT_DEVICES: {
    action: 'UNASSIGN_AND_PRESERVE',
    reason: 'HARDWARE_ASSET_INVENTORY_REUSE',
    unassignFields: ['assigned_organization', 'assigned_vehicle'],
  },
  NOTIFICATION_TOKENS: {
    action: 'HARD_DELETE',
    reason: 'COMMUNICATION_TERMINATION',
  },
  SUPPORT_TICKETS: {
    action: 'ANONYMIZE',
    reason: 'QUALITY_ASSURANCE_HISTORY',
    wipedFields: ['description', 'attachments', 'uid', 'sender_id'],
  },
  TAX_INVOICES: {
    action: 'RETAIN_ANONYMIZED',
    reason: 'FINANCIAL_TAX_COMPLIANCE',
    pseudonymizedFields: ['org_uid'],
  },
  SECURITY_AUDIT_LOGS: {
    action: 'ANONYMIZE',
    reason: 'SECURITY_INCIDENT_AUDIT_TRAIL',
    pseudonymizedFields: ['user_uid', 'admin_uid', 'fleet_owner_uid'],
  },
};

module.exports = RETENTION_POLICY;
