-- Migration: Add logo_url column to companies table
-- Purpose: Store company logo URL/path for dynamic logo display in mobile app

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255);

-- Add sample logo URLs for existing companies
UPDATE companies SET logo_url = '/images/brk_logo.png' WHERE company_code = 'BRK';
UPDATE companies SET logo_url = '/images/skk_logo.png' WHERE company_code = 'SKK';
UPDATE companies SET logo_url = '/images/ailab_logo.png' WHERE company_code = 'AILAB';

-- Verify the column was added
SELECT company_code, company_name, logo_url, active
FROM companies
ORDER BY company_code;
