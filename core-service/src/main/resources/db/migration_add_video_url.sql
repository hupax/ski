-- Add video_path column to analysis_records table
ALTER TABLE analysis_records ADD COLUMN IF NOT EXISTS video_path VARCHAR(500);

COMMENT ON COLUMN analysis_records.video_path IS 'MinIO object path for the analyzed video window';
