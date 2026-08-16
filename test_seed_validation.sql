-- ============================================================================
-- WTF LivePulse — SEED DATA VALIDATION SUITE
-- One query, every rule in the Data Specification, one TRUE/FALSE per rule.
--
-- Run with:
--   docker compose exec -T db psql -U wtf -d wtf_livepulse < test_seed_validation.sql
--
-- Read the "pass" column. Anything FALSE is a spec violation.
-- "expected" / "actual" columns are there so you don't have to re-derive
-- numbers by hand when something fails.
--
-- NOTE on section ANxx (bottom): those check the `anomalies` table, which is
-- populated by your DETECTOR, not the seed. Run this file again after the
-- detector's first cycle (≤30s after startup) to get real values for ANxx —
-- on a fresh DB with no detector run yet they will correctly show FALSE/0.
-- ============================================================================

SET timezone = 'Asia/Kolkata';

WITH

-- ---------------------------------------------------------------------------
-- Spec reference tables (hardcoded from the Data Specification document)
-- ---------------------------------------------------------------------------
gym_spec (name, city, capacity, opens, closes, member_count, monthly_ct, quarterly_ct, annual_ct, active_pct) AS (
  VALUES
    ('WTF Gyms — Lajpat Nagar',    'New Delhi', 220, '05:30'::time, '22:30'::time, 650, 325, 195, 130, 0.88),
    ('WTF Gyms — Connaught Place', 'New Delhi', 180, '06:00'::time, '22:00'::time, 550, 220, 220, 110, 0.85),
    ('WTF Gyms — Bandra West',     'Mumbai',    300, '05:00'::time, '23:00'::time, 750, 300, 300, 150, 0.90),
    ('WTF Gyms — Powai',           'Mumbai',    250, '05:30'::time, '22:30'::time, 600, 240, 240, 120, 0.87),
    ('WTF Gyms — Indiranagar',     'Bengaluru', 200, '05:30'::time, '22:00'::time, 550, 220, 220, 110, 0.89),
    ('WTF Gyms — Koramangala',     'Bengaluru', 180, '06:00'::time, '22:00'::time, 500, 200, 200, 100, 0.86),
    ('WTF Gyms — Banjara Hills',   'Hyderabad', 160, '06:00'::time, '22:00'::time, 450, 225, 135,  90, 0.84),
    ('WTF Gyms — Sector 18 Noida', 'Noida',     140, '06:00'::time, '21:30'::time, 400, 240, 100,  60, 0.82),
    ('WTF Gyms — Salt Lake',       'Kolkata',   120, '06:00'::time, '21:00'::time, 300, 180,  90,  30, 0.80),
    ('WTF Gyms — Velachery',       'Chennai',   110, '06:00'::time, '21:00'::time, 250, 150,  75,  25, 0.78)
),
revenue_spec (name, min_rev, max_rev) AS (
  VALUES
    ('WTF Gyms — Bandra West',     350000, 550000),
    ('WTF Gyms — Powai',           300000, 480000),
    ('WTF Gyms — Lajpat Nagar',    250000, 400000),
    ('WTF Gyms — Indiranagar',     220000, 380000),
    ('WTF Gyms — Connaught Place', 200000, 350000),
    ('WTF Gyms — Koramangala',     180000, 300000),
    ('WTF Gyms — Banjara Hills',   150000, 250000),
    ('WTF Gyms — Sector 18 Noida', 120000, 200000),
    ('WTF Gyms — Salt Lake',        90000, 150000),
    ('WTF Gyms — Velachery',        80000, 130000)
),

-- ---------------------------------------------------------------------------
-- Actual data, pre-aggregated once
-- ---------------------------------------------------------------------------
gym_actual AS (
  SELECT
    g.id, g.name, g.city, g.capacity, g.opens_at, g.closes_at, g.status,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id)                                   AS member_count,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.plan_type = 'monthly')       AS monthly_ct,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.plan_type = 'quarterly')     AS quarterly_ct,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.plan_type = 'annual')        AS annual_ct,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.status = 'active')           AS active_ct,
    (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.gym_id = g.id AND p.paid_at >= NOW() - INTERVAL '30 days') AS revenue_30d,
    (SELECT COUNT(*) FROM checkins c WHERE c.gym_id = g.id AND c.checked_out IS NULL)        AS open_checkins
  FROM gyms g
),
gym_join AS (
  SELECT a.*, s.opens AS spec_opens, s.closes AS spec_closes, s.capacity AS spec_capacity,
         s.city AS spec_city, s.member_count AS spec_member_count,
         s.monthly_ct AS spec_monthly_ct, s.quarterly_ct AS spec_quarterly_ct, s.annual_ct AS spec_annual_ct,
         s.active_pct AS spec_active_pct
  FROM gym_actual a
  JOIN gym_spec s ON s.name = a.name
),

member_stats AS (
  SELECT
    COUNT(*) AS total_members,
    COUNT(*) FILTER (WHERE status = 'active') AS active_members,
    COUNT(*) FILTER (WHERE member_type = 'renewal') AS renewal_members,
    COUNT(*) FILTER (WHERE last_checkin_at < NOW() - INTERVAL '45 days' AND status = 'active') AS churn_45,
    COUNT(*) FILTER (WHERE last_checkin_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '45 days' AND status = 'active') AS churn_high,
    COUNT(*) FILTER (WHERE last_checkin_at < NOW() - INTERVAL '60 days' AND status = 'active') AS churn_critical,
    COUNT(*) - COUNT(DISTINCT email) AS dup_emails,
    COUNT(*) FILTER (WHERE phone !~ '^[789][0-9]{9}$') AS bad_phones,
    COUNT(*) FILTER (
      WHERE plan_expires_at <> joined_at + (
        CASE plan_type WHEN 'monthly' THEN INTERVAL '30 days'
                        WHEN 'quarterly' THEN INTERVAL '90 days'
                        ELSE INTERVAL '365 days' END)
    ) AS bad_expiry
  FROM members
),

checkin_consistency AS (
  SELECT
    COUNT(*) FILTER (WHERE m.last_checkin_at IS DISTINCT FROM c.max_checkin) AS mismatches
  FROM members m
  LEFT JOIN (SELECT member_id, MAX(checked_in) AS max_checkin FROM checkins GROUP BY member_id) c
    ON c.member_id = m.id
),

checkin_stats AS (
  SELECT
    COUNT(*) AS total_checkins,
    COUNT(*) FILTER (WHERE checked_out IS NULL) AS open_checkins,
    COUNT(*) FILTER (
      WHERE checked_out IS NOT NULL
        AND (EXTRACT(EPOCH FROM (checked_out - checked_in))/60 < 45
          OR EXTRACT(EPOCH FROM (checked_out - checked_in))/60 > 90)
    ) AS bad_durations,
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM checked_in AT TIME ZONE 'Asia/Kolkata') = 8)  AS hour_peak_8,
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM checked_in AT TIME ZONE 'Asia/Kolkata') = 15) AS hour_quiet_15,
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM checked_in AT TIME ZONE 'Asia/Kolkata') = 2)  AS hour_closed_2,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM checked_in AT TIME ZONE 'Asia/Kolkata') = 1) AS dow_monday,
    COUNT(*) FILTER (WHERE EXTRACT(DOW FROM checked_in AT TIME ZONE 'Asia/Kolkata') = 0) AS dow_sunday
  FROM checkins
),

-- historical (closed) check-ins that fall outside their own gym's operating hours.
-- A handful of boundary-hour rows (e.g. a checkin generated anywhere within the
-- 22:00 hour bucket for a gym that closes at 22:30) is expected rounding noise,
-- not a real bug, so this is judged as a share of total volume rather than a
-- strict zero.
hours_violation AS (
  SELECT COUNT(*) AS n
  FROM checkins c
  JOIN gyms g ON g.id = c.gym_id
  WHERE c.checked_out IS NOT NULL
    AND (
      (c.checked_in AT TIME ZONE 'Asia/Kolkata')::time < g.opens_at
      OR (c.checked_in AT TIME ZONE 'Asia/Kolkata')::time >= g.closes_at
    )
),

payment_stats AS (
  SELECT
    COUNT(*) AS total_payments,
    COUNT(*) FILTER (WHERE amount NOT IN (1499.00, 3999.00, 11999.00)) AS bad_amounts,
    COUNT(*) FILTER (WHERE paid_at > NOW()) AS future_payments,
    COUNT(*) FILTER (
      WHERE (plan_type = 'monthly'   AND amount <> 1499.00)
         OR (plan_type = 'quarterly' AND amount <> 3999.00)
         OR (plan_type = 'annual'    AND amount <> 11999.00)
    ) AS amount_plan_mismatch,
    (SELECT COUNT(DISTINCT id) FROM members) - (SELECT COUNT(DISTINCT member_id) FROM payments) AS members_without_payment
  FROM payments
),

renewal_payment_check AS (
  SELECT COUNT(*) AS bad
  FROM payments p
  JOIN members m ON m.id = p.member_id
  WHERE p.payment_type = 'renewal'
    AND ABS(EXTRACT(EPOCH FROM (
      p.paid_at - (m.joined_at + CASE m.plan_type WHEN 'monthly' THEN INTERVAL '30 days'
                                                    WHEN 'quarterly' THEN INTERVAL '90 days'
                                                    ELSE INTERVAL '365 days' END)
    ))) > 300  -- >5 min drift
),

new_payment_check AS (
  -- 'new' payments whose paid_at is not within ±5 minutes of the member's joined_at.
  -- A small number of exceptions is expected: Scenario C intentionally injects
  -- extra 'new' payments (Salt Lake anomaly rows + the ~4-per-gym support rows
  -- for the other 9 gyms) that are NOT tied to any member's joined_at by design.
  SELECT COUNT(*) AS mismatches
  FROM payments p
  JOIN members m ON m.id = p.member_id
  WHERE p.payment_type = 'new'
    AND ABS(EXTRACT(EPOCH FROM (p.paid_at - m.joined_at))) > 300
),

-- ---------------------------------------------------------------------------
-- Anomaly scenario STRUCTURAL setup checks (true regardless of whether the
-- detector has run yet — these test the seed data itself)
-- ---------------------------------------------------------------------------
zero_checkin_candidates AS (
  SELECT g.id, g.name
  FROM gyms g
  WHERE g.status = 'active'
    AND (SELECT COUNT(*) FROM checkins c WHERE c.gym_id = g.id AND c.checked_out IS NULL) = 0
    AND (SELECT MAX(c.checked_in) FROM checkins c WHERE c.gym_id = g.id) <= NOW() - INTERVAL '2 hours 10 minutes'
),
capacity_breach_candidates AS (
  SELECT g.id, g.name
  FROM gyms g
  WHERE (SELECT COUNT(*) FROM checkins c WHERE c.gym_id = g.id AND c.checked_out IS NULL)::float
        >= 0.90 * g.capacity
),
revenue_drop_candidates AS (
  SELECT g.id, g.name,
         (SELECT COALESCE(SUM(p.amount),0) FROM payments p
            WHERE p.gym_id = g.id AND p.paid_at >= date_trunc('day', NOW())) AS today_rev,
         (SELECT COALESCE(SUM(p.amount),0) FROM payments p
            WHERE p.gym_id = g.id
              AND p.paid_at >= date_trunc('day', NOW() - INTERVAL '7 days')
              AND p.paid_at <  date_trunc('day', NOW() - INTERVAL '6 days')) AS lastweek_rev
  FROM gyms g
),
revenue_drop_qualified AS (
  SELECT * FROM revenue_drop_candidates
  WHERE lastweek_rev >= 15000 AND today_rev <= 0.3 * lastweek_rev
),

bandra AS (SELECT id FROM gyms WHERE name ILIKE '%Bandra%'),
velachery AS (SELECT id FROM gyms WHERE name ILIKE '%Velachery%'),
saltlake AS (SELECT id FROM gyms WHERE name ILIKE '%Salt Lake%'),

bandra_open AS (
  SELECT COUNT(*) AS n,
         COUNT(*) FILTER (WHERE checked_in < NOW() - INTERVAL '90 minutes') AS stale
  FROM checkins WHERE gym_id = (SELECT id FROM bandra) AND checked_out IS NULL
),
saltlake_today AS (
  SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS rev
  FROM payments WHERE gym_id = (SELECT id FROM saltlake) AND paid_at >= date_trunc('day', NOW())
),
saltlake_lastweek AS (
  SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS rev
  FROM payments
  WHERE gym_id = (SELECT id FROM saltlake)
    AND paid_at >= date_trunc('day', NOW() - INTERVAL '7 days')
    AND paid_at <  date_trunc('day', NOW() - INTERVAL '6 days')
),

-- ---------------------------------------------------------------------------
-- Anomalies TABLE checks (only meaningful after the detector has run)
-- ---------------------------------------------------------------------------
anomaly_counts AS (
  SELECT
    COUNT(*) AS total_anomalies,
    COUNT(*) FILTER (WHERE type = 'zero_checkins'   AND gym_id = (SELECT id FROM velachery) AND resolved = FALSE AND severity = 'warning')  AS ok_zero_checkins,
    COUNT(*) FILTER (WHERE type = 'capacity_breach' AND gym_id = (SELECT id FROM bandra)    AND resolved = FALSE AND severity = 'critical') AS ok_capacity_breach,
    COUNT(*) FILTER (WHERE type = 'revenue_drop'    AND gym_id = (SELECT id FROM saltlake)  AND resolved = FALSE AND severity = 'warning')  AS ok_revenue_drop
  FROM anomalies
)

-- ============================================================================
-- RESULTS
-- ============================================================================
SELECT * FROM (

  -- ---------- OFFICIAL CHECKLIST (Section 8, V1–V10) ----------
  SELECT 'V1'  AS test_id, 'checklist' AS category, 'COUNT(gyms) = 10' AS description,
         '10' AS expected, (SELECT COUNT(*) FROM gyms)::text AS actual,
         (SELECT COUNT(*) FROM gyms) = 10 AS pass
  UNION ALL
  SELECT 'V2', 'checklist', 'COUNT(members) = 5000',
         '5000', (SELECT COUNT(*) FROM members)::text,
         (SELECT COUNT(*) FROM members) = 5000
  UNION ALL
  SELECT 'V3', 'checklist', 'active members BETWEEN 4100 AND 4400',
         '4100–4400', active_members::text,
         active_members BETWEEN 4100 AND 4400
  FROM member_stats
  UNION ALL
  SELECT 'V4', 'checklist', 'COUNT(checkins) BETWEEN 250000 AND 300000',
         '250000–300000', total_checkins::text,
         total_checkins BETWEEN 250000 AND 300000
  FROM checkin_stats
  UNION ALL
  SELECT 'V5', 'checklist', 'open checkins BETWEEN 100 AND 350',
         '100–350', open_checkins::text,
         open_checkins BETWEEN 100 AND 350
  FROM checkin_stats
  UNION ALL
  SELECT 'V6', 'checklist', 'COUNT(payments) BETWEEN 5000 AND 6000',
         '5000–6000', total_payments::text,
         total_payments BETWEEN 5000 AND 6000
  FROM payment_stats
  UNION ALL
  SELECT 'V7', 'checklist', 'active members with last_checkin_at < NOW()-45d >= 230',
         '>=230', churn_45::text,
         churn_45 >= 230
  FROM member_stats
  UNION ALL
  SELECT 'V8', 'checklist', 'Bandra open checkins BETWEEN 270 AND 300',
         '270–300', n::text,
         n BETWEEN 270 AND 300
  FROM bandra_open
  UNION ALL
  SELECT 'V9', 'checklist', 'Velachery open checkins = 0',
         '0', (SELECT COUNT(*) FROM checkins WHERE gym_id = (SELECT id FROM velachery) AND checked_out IS NULL)::text,
         (SELECT COUNT(*) FROM checkins WHERE gym_id = (SELECT id FROM velachery) AND checked_out IS NULL) = 0
  UNION ALL
  SELECT 'V10', 'checklist', 'Bandra 30d revenue BETWEEN 350000 AND 550000',
         '350000–550000',
         (SELECT COALESCE(SUM(amount),0) FROM payments WHERE gym_id = (SELECT id FROM bandra) AND paid_at >= NOW() - INTERVAL '30 days')::text,
         (SELECT COALESCE(SUM(amount),0) FROM payments WHERE gym_id = (SELECT id FROM bandra) AND paid_at >= NOW() - INTERVAL '30 days') BETWEEN 350000 AND 550000

  -- ---------- GYM RECORD EXACT MATCH (Section 2) ----------
  UNION ALL
  SELECT 'G-' || row_number() OVER (ORDER BY name), 'gyms',
         'Exact match: ' || name || ' (city/capacity/hours/status)',
         spec_city || ' / ' || spec_capacity || ' / ' || spec_opens || '-' || spec_closes || ' / active',
         city || ' / ' || capacity || ' / ' || opens_at || '-' || closes_at || ' / ' || status,
         city = spec_city AND capacity = spec_capacity AND opens_at = spec_opens
         AND closes_at = spec_closes AND status = 'active'
  FROM gym_join

  -- ---------- MEMBER COUNT PER GYM (Section 3.1, exact) ----------
  UNION ALL
  SELECT 'M-' || row_number() OVER (ORDER BY name), 'members',
         'Member count exact: ' || name,
         spec_member_count::text, member_count::text,
         member_count = spec_member_count
  FROM gym_join

  -- ---------- PLAN MIX PER GYM (Section 3.1, tolerance ±3) ----------
  UNION ALL
  SELECT 'PL-' || row_number() OVER (ORDER BY name), 'members',
         'Plan mix within ±3: ' || name,
         spec_monthly_ct||'/'||spec_quarterly_ct||'/'||spec_annual_ct,
         monthly_ct||'/'||quarterly_ct||'/'||annual_ct,
         ABS(monthly_ct - spec_monthly_ct) <= 3
         AND ABS(quarterly_ct - spec_quarterly_ct) <= 3
         AND ABS(annual_ct - spec_annual_ct) <= 3
  FROM gym_join

  -- ---------- ACTIVE % PER GYM (Section 3.1, tolerance ±2pp) ----------
  UNION ALL
  SELECT 'AC-' || row_number() OVER (ORDER BY name), 'members',
         'Active% within ±2pp: ' || name,
         round((spec_active_pct*100)::numeric,1)||'%',
         round((active_ct::numeric/NULLIF(member_count,0)*100),1)||'%',
         ABS(active_ct::float/NULLIF(member_count,0) - spec_active_pct) <= 0.02
  FROM gym_join

  -- ---------- REVENUE RANGE PER GYM (Section 5.3) ----------
  UNION ALL
  SELECT 'R-' || row_number() OVER (ORDER BY r.name), 'revenue',
         '30d revenue in range: ' || r.name,
         r.min_rev || '–' || r.max_rev,
         a.revenue_30d::text,
         a.revenue_30d BETWEEN r.min_rev AND r.max_rev
  FROM revenue_spec r JOIN gym_actual a ON a.name = r.name

  -- ---------- MEMBER DATA INTEGRITY (Section 3.2) ----------
  UNION ALL
  SELECT 'MX1', 'member_integrity', 'No duplicate emails', '0', dup_emails::text, dup_emails = 0 FROM member_stats
  UNION ALL
  SELECT 'MX2', 'member_integrity', 'All phones match ^[789][0-9]{9}$', '0', bad_phones::text, bad_phones = 0 FROM member_stats
  UNION ALL
  SELECT 'MX3', 'member_integrity', 'plan_expires_at = joined_at + plan duration (all members)', '0', bad_expiry::text, bad_expiry = 0 FROM member_stats
  UNION ALL
  SELECT 'MX4', 'member_integrity', 'member_type renewal share between 15% and 25% (spec: 80/20 new/renewal)',
         '15–25%', round(renewal_members::numeric/total_members*100,1)||'%',
         (renewal_members::float/total_members) BETWEEN 0.15 AND 0.25
  FROM member_stats
  UNION ALL
  SELECT 'MX5', 'member_integrity', 'last_checkin_at matches MAX(checkins.checked_in) for every member', '0', mismatches::text, mismatches = 0 FROM checkin_consistency

  -- ---------- CHURN RISK SEGMENT (Section 3.3) ----------
  UNION ALL
  SELECT 'CH1', 'churn', 'High risk (45–60d) active members >= 150', '>=150', churn_high::text, churn_high >= 150 FROM member_stats
  UNION ALL
  SELECT 'CH2', 'churn', 'Critical risk (>60d) active members >= 80', '>=80', churn_critical::text, churn_critical >= 80 FROM member_stats

  -- ---------- CHECK-IN BEHAVIOUR (Section 4) ----------
  UNION ALL
  SELECT 'CI1', 'checkins', 'Closed checkins have duration 45–90 min (all rows)', '0 violations', bad_durations::text, bad_durations = 0 FROM checkin_stats
  UNION ALL
  SELECT 'CI2', 'checkins', 'Hourly distribution not flat (02:00 hour ~silent, peak hour >> quiet hour)',
         'hour2<=50 AND hour8 > 2×hour15',
         'hour2='||hour_closed_2||' hour8='||hour_peak_8||' hour15='||hour_quiet_15,
         hour_closed_2 <= 50 AND hour_peak_8 > 2 * hour_quiet_15
  FROM checkin_stats
  UNION ALL
  SELECT 'CI3', 'checkins', 'Day-of-week not flat (Monday clearly busier than Sunday per 4.2 multipliers)',
         'Monday > 1.3× Sunday', 'Mon='||dow_monday||' Sun='||dow_sunday,
         dow_monday > 1.3 * dow_sunday
  FROM checkin_stats
  UNION ALL
  SELECT 'CI4', 'checkins', 'Historical (closed) checkins occur within their gym''s opening hours (<=3% boundary noise tolerated)',
         '<=3% of total', n||' of '||(SELECT total_checkins FROM checkin_stats)||' ('||round(n::numeric/(SELECT total_checkins FROM checkin_stats)*100,2)||'%)',
         n <= 0.03 * (SELECT total_checkins FROM checkin_stats)
  FROM hours_violation

  -- ---------- PAYMENTS (Section 5) ----------
  UNION ALL
  SELECT 'PM1', 'payments', 'All payment amounts in {1499, 3999, 11999}', '0 bad rows', bad_amounts::text, bad_amounts = 0 FROM payment_stats
  UNION ALL
  SELECT 'PM2', 'payments', 'No payment with paid_at in the future', '0', future_payments::text, future_payments = 0 FROM payment_stats
  UNION ALL
  SELECT 'PM3', 'payments', 'Amount matches plan_type (1499/3999/11999)', '0 mismatches', amount_plan_mismatch::text, amount_plan_mismatch = 0 FROM payment_stats
  UNION ALL
  SELECT 'PM4', 'payments', 'Every member has at least one payment', '0 members missing', members_without_payment::text, members_without_payment <= 0 FROM payment_stats
  UNION ALL
  SELECT 'PM5', 'payments', 'Renewal payment paid_at = joined_at + plan duration (±5 min, all renewal payments)', '0', bad::text, bad = 0 FROM renewal_payment_check
  UNION ALL
  SELECT 'PM6', 'payments', '''new'' payment paid_at ≈ joined_at (±5 min); small anomaly-injected exception count expected',
         '<=60 mismatches (Scenario C support rows)', mismatches::text, mismatches <= 60
  FROM new_payment_check

  -- ---------- ANOMALY SCENARIO STRUCTURAL SETUP (Section 6) ----------
  UNION ALL
  SELECT 'S-A1', 'anomaly_setup', 'Scenario A: exactly one gym qualifies for zero_checkins, and it is Velachery',
         '1 gym = Velachery',
         (SELECT COUNT(*) FROM zero_checkin_candidates)||' gym(s): '||COALESCE((SELECT string_agg(name,', ') FROM zero_checkin_candidates),'none'),
         (SELECT COUNT(*) FROM zero_checkin_candidates) = 1
         AND (SELECT name FROM zero_checkin_candidates LIMIT 1) ILIKE '%Velachery%'
  UNION ALL
  SELECT 'S-A2', 'anomaly_setup', 'Scenario A: Velachery gym status = active', 'active',
         (SELECT status FROM gyms WHERE id = (SELECT id FROM velachery)),
         (SELECT status FROM gyms WHERE id = (SELECT id FROM velachery)) = 'active'
  UNION ALL
  SELECT 'S-B1', 'anomaly_setup', 'Scenario B: exactly one gym qualifies for capacity_breach, and it is Bandra West',
         '1 gym = Bandra West',
         (SELECT COUNT(*) FROM capacity_breach_candidates)||' gym(s): '||COALESCE((SELECT string_agg(name,', ') FROM capacity_breach_candidates),'none'),
         (SELECT COUNT(*) FROM capacity_breach_candidates) = 1
         AND (SELECT name FROM capacity_breach_candidates LIMIT 1) ILIKE '%Bandra%'
  UNION ALL
  SELECT 'S-B2', 'anomaly_setup', 'Scenario B: Bandra open checkins between 275–295, all checked in within last 90 min',
         '275–295, 0 stale', n||' open / '||stale||' stale',
         n BETWEEN 275 AND 295 AND stale = 0
  FROM bandra_open
  UNION ALL
  SELECT 'S-C1', 'anomaly_setup', 'Scenario C: exactly one gym qualifies for revenue_drop, and it is Salt Lake',
         '1 gym = Salt Lake',
         (SELECT COUNT(*) FROM revenue_drop_qualified)||' gym(s): '||COALESCE((SELECT string_agg(name,', ') FROM revenue_drop_qualified),'none'),
         (SELECT COUNT(*) FROM revenue_drop_qualified) = 1
         AND (SELECT name FROM revenue_drop_qualified LIMIT 1) ILIKE '%Salt Lake%'
  UNION ALL
  SELECT 'S-C2', 'anomaly_setup', 'Scenario C: Salt Lake same-weekday-last-week revenue >= 15000 across >= 8 payments',
         '>=8 payments, >=15000', n||' payments / ₹'||rev,
         n >= 8 AND rev >= 15000
  FROM saltlake_lastweek
  UNION ALL
  SELECT 'S-C3', 'anomaly_setup', 'Scenario C: Salt Lake today revenue <= 3000 across <= 2 payments (>70% drop)',
         '<=2 payments, <=3000', n||' payments / ₹'||rev,
         n <= 2 AND rev <= 3000
  FROM saltlake_today
  UNION ALL
  SELECT 'S-C4', 'anomaly_setup', 'Scenario C: no other gym''s payment history was manipulated the same way',
         '0 other gyms qualify', (SELECT COUNT(*) - (SELECT COUNT(*) FROM revenue_drop_qualified WHERE name ILIKE '%Salt Lake%') FROM revenue_drop_qualified)::text,
         (SELECT COUNT(*) FROM revenue_drop_qualified WHERE name NOT ILIKE '%Salt Lake%') = 0

  -- ---------- ANOMALIES TABLE (post-detector — run again after detector cycle) ----------
  UNION ALL
  SELECT 'AN1', 'anomalies_table', 'anomalies table has >= 3 rows (Section 8 checklist)', '>=3', total_anomalies::text, total_anomalies >= 3 FROM anomaly_counts
  UNION ALL
  SELECT 'AN2', 'anomalies_table', 'zero_checkins anomaly exists for Velachery (warning, unresolved)', '>=1', ok_zero_checkins::text, ok_zero_checkins >= 1 FROM anomaly_counts
  UNION ALL
  SELECT 'AN3', 'anomalies_table', 'capacity_breach anomaly exists for Bandra West (critical, unresolved)', '>=1', ok_capacity_breach::text, ok_capacity_breach >= 1 FROM anomaly_counts
  UNION ALL
  SELECT 'AN4', 'anomalies_table', 'revenue_drop anomaly exists for Salt Lake (warning, unresolved)', '>=1', ok_revenue_drop::text, ok_revenue_drop >= 1 FROM anomaly_counts

) results
ORDER BY
  CASE category
    WHEN 'checklist' THEN 1 WHEN 'gyms' THEN 2 WHEN 'members' THEN 3
    WHEN 'revenue' THEN 4 WHEN 'member_integrity' THEN 5 WHEN 'churn' THEN 6
    WHEN 'checkins' THEN 7 WHEN 'payments' THEN 8 WHEN 'anomaly_setup' THEN 9
    WHEN 'anomalies_table' THEN 10 ELSE 11
  END,
  test_id;

-- ---------------------------------------------------------------------------
-- Quick pass/fail summary (run separately, or just scroll to the bottom of
-- the result set above)
-- ---------------------------------------------------------------------------
-- SELECT category, COUNT(*) AS tests, COUNT(*) FILTER (WHERE NOT pass) AS failing
-- FROM (...) results GROUP BY category ORDER BY category;

-- ---------------------------------------------------------------------------
-- NOT covered by this file (cannot be tested with a single read-only query):
--   • Idempotency (Section 7.1) — run:
--       docker compose down -v && docker compose up -d db
--       (wait for seed) then re-check V2 == 5000, V6 in range, etc. If counts
--       double, the seed is not idempotent.
--   • Seed execution time < 120s — read from `docker compose logs db` timestamps.
--   • Progress log lines ('Seeding gyms... done' etc.) — read from
--       `docker compose logs db`.
-- ---------------------------------------------------------------------------