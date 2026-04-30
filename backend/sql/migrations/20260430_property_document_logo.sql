ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS document_logo VARCHAR(64) NOT NULL DEFAULT 'pramod_hotels_resorts';

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_document_logo_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_document_logo_check
  CHECK (document_logo IN ('pramod_hotels_resorts','pramod_lands_end_radisson'));
