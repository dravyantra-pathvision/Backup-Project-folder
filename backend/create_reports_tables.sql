CREATE TABLE IF NOT EXISTS report_history (
    id SERIAL PRIMARY KEY,
    admin_uid VARCHAR(100) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    filters JSONB,
    format VARCHAR(20) NOT NULL, -- PDF, CSV, Excel
    file_url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
    id SERIAL PRIMARY KEY,
    admin_uid VARCHAR(100) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    filters JSONB,
    format VARCHAR(20) NOT NULL, -- PDF, CSV, Excel
    schedule_type VARCHAR(50) NOT NULL, -- Daily, Weekly, Monthly
    email_recipients TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_report_history_admin ON report_history(admin_uid);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
