-- Atomic running number, reset monthly, separate per company.
-- Applied by the seed script after `prisma db push`.
CREATE OR REPLACE FUNCTION next_memo_no(p_company_id INT)
RETURNS TEXT AS $$
DECLARE
  v_year  INT := EXTRACT(YEAR FROM now())::int;
  v_month INT := EXTRACT(MONTH FROM now())::int;
  v_code  TEXT;
  v_seq   INT;
BEGIN
  SELECT code INTO v_code FROM companies WHERE id = p_company_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Unknown company_id %', p_company_id;
  END IF;

  INSERT INTO memo_running (company_id, year, month, last_number)
    VALUES (p_company_id, v_year, v_month, 1)
  ON CONFLICT (company_id, year, month)
    DO UPDATE SET last_number = memo_running.last_number + 1
  RETURNING last_number INTO v_seq;

  RETURN 'No.' || v_code || ' '
       || lpad(v_year::text, 4, '0') || '-'
       || lpad(v_month::text, 2, '0') || '-'
       || lpad(v_seq::text, 3, '0');
END;
$$ LANGUAGE plpgsql;
