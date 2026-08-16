BEGIN;

-- Anchor all NOW()/date_trunc()/EXTRACT() calls in this transaction to India Standard Time,
-- so the hourly traffic pattern lines up with real Indian gym hours regardless of the
-- container's default timezone (commonly UTC on stock Docker images).
SET LOCAL timezone = 'Asia/Kolkata';
SELECT setseed(0.42);

DO $$
DECLARE
    -- Gym IDs
    v_lajpat_id     UUID := gen_random_uuid();
    v_cp_id         UUID := gen_random_uuid();
    v_bandra_id     UUID := gen_random_uuid();
    v_powai_id      UUID := gen_random_uuid();
    v_indira_id     UUID := gen_random_uuid();
    v_kora_id       UUID := gen_random_uuid();
    v_banjara_id    UUID := gen_random_uuid();
    v_noida_id      UUID := gen_random_uuid();
    v_saltlake_id   UUID := gen_random_uuid();
    v_velachery_id  UUID := gen_random_uuid();

    v_now           TIMESTAMPTZ := NOW();
    v_start_date    TIMESTAMPTZ := date_trunc('day', NOW()) - INTERVAL '90 days';
    v_already_seeded BOOLEAN;

    -- Base daily visit probability for an active member (before day-of-week weighting).
    -- Calibrated so total checkins land in the 250k-300k target band.
    v_p_base        FLOAT := 0.93;

    -- Names array for realistic Indian names
    v_first_names TEXT[] := ARRAY['Rahul', 'Priya', 'Ankit', 'Neha', 'Arjun', 'Siddharth', 'Pooja', 'Rohan', 'Sneha', 'Vikas', 'Kavya', 'Aditya', 'Riya', 'Amit', 'Ananya', 'Karan', 'Shreya', 'Gaurav', 'Divya', 'Manish'];
    v_last_names  TEXT[] := ARRAY['Sharma', 'Mehta', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Joshi', 'Shah', 'Nair', 'Iyer', 'Reddy', 'Rao', 'Chopra', 'Malhotra', 'Deshmukh', 'Banerjee', 'Das', 'Kulkarni', 'Bhat'];

    v_dow_mult FLOAT[] := ARRAY[
        0.45, -- 0 = Sunday
        1.00, -- 1 = Monday
        0.95, -- 2 = Tuesday
        0.90, -- 3 = Wednesday
        0.95, -- 4 = Thursday
        0.85, -- 5 = Friday
        0.70  -- 6 = Saturday
    ];

BEGIN
    -- Idempotency guard: if gyms already has rows, this DB has already been seeded.
    SELECT EXISTS(SELECT 1 FROM gyms LIMIT 1) INTO v_already_seeded;
    IF v_already_seeded THEN
        RAISE NOTICE 'Gyms table is not empty -- seed already applied. Skipping (idempotent no-op).';
        RETURN;
    END IF;

    RAISE NOTICE 'Seeding Gyms... done';

    --------------------------------------------------------------------------------
    -- 1. SEED GYMS (Exact 10 locations)
    --------------------------------------------------------------------------------
    INSERT INTO gyms (id, name, city, capacity, opens_at, closes_at, status) VALUES
    (v_lajpat_id,    'WTF Gyms — Lajpat Nagar',    'New Delhi', 220, '05:30', '22:30', 'active'),
    (v_cp_id,        'WTF Gyms — Connaught Place', 'New Delhi', 180, '06:00', '22:00', 'active'),
    (v_bandra_id,    'WTF Gyms — Bandra West',     'Mumbai',    300, '05:00', '23:00', 'active'),
    (v_powai_id,     'WTF Gyms — Powai',           'Mumbai',    250, '05:30', '22:30', 'active'),
    (v_indira_id,    'WTF Gyms — Indiranagar',     'Bengaluru', 200, '05:30', '22:00', 'active'),
    (v_kora_id,      'WTF Gyms — Koramangala',     'Bengaluru', 180, '06:00', '22:00', 'active'),
    (v_banjara_id,   'WTF Gyms — Banjara Hills',   'Hyderabad', 160, '06:00', '22:00', 'active'),
    (v_noida_id,     'WTF Gyms — Sector 18 Noida', 'Noida',     140, '06:00', '21:30', 'active'),
    (v_saltlake_id,  'WTF Gyms — Salt Lake',       'Kolkata',   120, '06:00', '21:00', 'active'),
    (v_velachery_id, 'WTF Gyms — Velachery',       'Chennai',   110, '06:00', '21:00', 'active');

    RAISE NOTICE 'Seeding 5000 Members... in progress';

    --------------------------------------------------------------------------------
    -- 2. SEED MEMBERS (5,000 Volume with specific distribution)
    --------------------------------------------------------------------------------
    CREATE TEMP TABLE tmp_gym_config (
        gym_id UUID, capacity INT, m_count INT, active_pct FLOAT,
        m_pct FLOAT, q_pct FLOAT, a_pct FLOAT, renewal_b INT   -- NEW
    ) ON COMMIT DROP;

    INSERT INTO tmp_gym_config VALUES
    (v_lajpat_id,    220, 650, 0.88, 0.50, 0.30, 0.20, 250),
    (v_cp_id,        180, 550, 0.85, 0.40, 0.40, 0.20, 300),
    (v_bandra_id,    300, 750, 0.90, 0.40, 0.40, 0.20, 100),
    (v_powai_id,     250, 600, 0.87, 0.40, 0.40, 0.20, 150),
    (v_indira_id,    200, 550, 0.89, 0.40, 0.40, 0.20, 400),
    (v_kora_id,      180, 500, 0.86, 0.40, 0.40, 0.20, 250),
    (v_banjara_id,   160, 450, 0.84, 0.50, 0.30, 0.20, 250),
    (v_noida_id,     140, 400, 0.82, 0.60, 0.25, 0.15, 400),
    (v_saltlake_id,  120, 300, 0.80, 0.60, 0.30, 0.10, 1500),
    (v_velachery_id, 110, 250, 0.78, 0.60, 0.30, 0.10, 50);

    INSERT INTO members (id, gym_id, name, email, phone, plan_type, member_type, status, joined_at, plan_expires_at)
    SELECT
        gen_random_uuid(),
        cfg.gym_id,
        m.full_name,
        LOWER(m.first_name || '.' || m.last_name || '.' || ROW_NUMBER() OVER (ORDER BY cfg.gym_id, m.seq) || '@gmail.com'),
        (CASE floor(random() * 3)::int WHEN 0 THEN '7' WHEN 1 THEN '8' ELSE '9' END)
            || LPAD(CAST(FLOOR(random() * 999999999) AS TEXT), 9, '0'),
        m.plan_type,
        m.member_type,
        m.status,
        j.joined_at,
        j.joined_at + (CASE m.plan_type WHEN 'monthly' THEN INTERVAL '30 days' WHEN 'quarterly' THEN INTERVAL '90 days' ELSE INTERVAL '365 days' END)
    FROM tmp_gym_config cfg
    CROSS JOIN LATERAL (
        SELECT
            gs.seq,
            v_first_names[1 + (gs.seq % array_length(v_first_names, 1))] AS first_name,
            v_last_names[1 + ((gs.seq * 3) % array_length(v_last_names, 1))] AS last_name,
            (v_first_names[1 + (gs.seq % array_length(v_first_names, 1))] || ' ' || v_last_names[1 + ((gs.seq * 3) % array_length(v_last_names, 1))]) AS full_name,

            CASE
                WHEN (gs.seq::float / cfg.m_count) <= cfg.m_pct THEN 'monthly'
                WHEN (gs.seq::float / cfg.m_count) <= (cfg.m_pct + cfg.q_pct) THEN 'quarterly'
                ELSE 'annual'
            END AS plan_type,

            -- inactive:frozen kept at the spec's intended 2:1 ratio of whatever the
            -- remainder is for this gym's active%, rather than fixed absolute points
            -- (fixed points only sum correctly to 100% for one specific active% value).
            CASE
                WHEN (gs.seq::float / cfg.m_count) <= cfg.active_pct THEN 'active'
                WHEN (gs.seq::float / cfg.m_count) <= (cfg.active_pct + (1 - cfg.active_pct) * (8.0/12.0)) THEN 'inactive'
                ELSE 'frozen'
            END AS status,

            -- Renewal share kept just under the spec's stated 20% (18.5%) to leave
            -- safety margin under V6's hard 6,000-payment ceiling: every renewal
            -- member deterministically produces a second payment by design (see
            -- below), so 5,000 members x 20% renewal already averages exactly
            -- 6,000 payments before the Salt Lake anomaly rows are even added --
            -- essentially zero margin. 18.5% keeps us comfortably under while
            -- still reading as "~20%" per spec.
            CASE WHEN random() < 0.83 THEN 'new' ELSE 'renewal' END AS member_type
        FROM generate_series(1, cfg.m_count) AS gs(seq)
    ) m
    CROSS JOIN LATERAL (
        -- 'new' members: joined within the last 90 days (spec 3.2 baseline rule).
        -- Skewed toward the older end of the window (not uniform) so that only
        -- a realistic slice of the base looks like a "brand new signup" inside
        -- any rolling 30-day window -- otherwise ~1/3 of the entire member base
        -- would show a full-price new payment every 30 days, which is what blew
        -- out the original script's 30-day revenue figures (V10).
        -- 'renewal' members: must have already completed at least one full plan
        -- cycle for their (later) renewal payment to be legitimately in the past,
        -- so their original join reaches back at least one cycle + a buffer
        -- (spec 5.2 explicitly allows a renewal member's original join to be
        -- 91-180 days ago).
        SELECT CASE
            WHEN m.member_type = 'new' THEN v_now - (INTERVAL '1 day' * (90 - floor(89 * power(random(), 3.5))))
            ELSE v_now - (
                (CASE m.plan_type WHEN 'monthly' THEN INTERVAL '30 days' WHEN 'quarterly' THEN INTERVAL '90 days' ELSE INTERVAL '365 days' END)
                + INTERVAL '1 day' * (1 + floor(random() * cfg.renewal_b))
            )
        END AS joined_at
    ) j;

    RAISE NOTICE 'Seeding 5000 Members... done';
    RAISE NOTICE 'Seeding Payments... in progress';

    --------------------------------------------------------------------------------
    -- 3. SEED PAYMENTS
    --------------------------------------------------------------------------------
    -- Initial payments for all members
    INSERT INTO payments (id, member_id, gym_id, amount, plan_type, payment_type, paid_at)
    SELECT
        gen_random_uuid(),
        m.id,
        m.gym_id,
        CASE m.plan_type
            WHEN 'monthly' THEN 1499.00
            WHEN 'quarterly' THEN 3999.00
            WHEN 'annual' THEN 11999.00
        END,
        m.plan_type,
        'new',
        m.joined_at + (random() * INTERVAL '10 minutes' - INTERVAL '5 minutes')
    FROM members m;

    -- Renewal payments for renewal members. Gate uses the ACTUAL per-plan duration
    -- (not a hardcoded 30 days), so a renewal payment can never land in the future --
    -- the member's joined_at is already guaranteed old enough by construction above,
    -- but this condition is kept as a defensive, always-true-by-design safeguard.
    INSERT INTO payments (id, member_id, gym_id, amount, plan_type, payment_type, paid_at)
    SELECT
        gen_random_uuid(),
        m.id,
        m.gym_id,
        CASE m.plan_type
            WHEN 'monthly' THEN 1499.00
            WHEN 'quarterly' THEN 3999.00
            WHEN 'annual' THEN 11999.00
        END,
        m.plan_type,
        'renewal',
        m.joined_at + (CASE m.plan_type WHEN 'monthly' THEN INTERVAL '30 days' WHEN 'quarterly' THEN INTERVAL '90 days' ELSE INTERVAL '365 days' END)
    FROM members m
    WHERE m.member_type = 'renewal'
      AND (m.joined_at + (CASE m.plan_type WHEN 'monthly' THEN INTERVAL '30 days' WHEN 'quarterly' THEN INTERVAL '90 days' ELSE INTERVAL '365 days' END)) <= v_now;

    --------------------------------------------------------------------------------
    -- 3.1 ANOMALY SCENARIO C SETUP: Salt Lake Revenue Drop
    --------------------------------------------------------------------------------
    -- Gives the other 9 gyms ~3-4 payments today (~₹12k - ₹20k) so only Salt Lake drops
    INSERT INTO payments (id, member_id, gym_id, amount, plan_type, payment_type, paid_at)
    SELECT
        gen_random_uuid(),
        m.id,
        m.gym_id,
        CASE m.plan_type
            WHEN 'monthly' THEN 1499.00
            WHEN 'quarterly' THEN 3999.00
            WHEN 'annual' THEN 11999.00
        END,
        m.plan_type,
        'new',
        date_trunc('day', v_now) + (random() * (v_now - date_trunc('day', v_now)))
    FROM (
        SELECT id, gym_id, plan_type,
               ROW_NUMBER() OVER (PARTITION BY gym_id ORDER BY random()) as rn
        FROM members
        WHERE gym_id != v_saltlake_id AND status = 'active'
    ) m
    WHERE m.rn <= 4; -- 4 payments x 9 gyms = 36 payments total
    DELETE FROM payments
    WHERE gym_id = v_saltlake_id
      AND paid_at >= date_trunc('day', v_now);

    -- Today's revenue: 0 payments (within spec's "0 to 2"; 0 also makes the
    -- >70% drop unambiguous and keeps total payment volume away from V6's ceiling)

    -- Same weekday last week: 8 payments (spec's stated 8-10 minimum), totalling >= ₹15,000
    INSERT INTO payments (id, member_id, gym_id, amount, plan_type, payment_type, paid_at)
    SELECT
        gen_random_uuid(),
        m.id,
        m.gym_id,
        3999.00,
        'quarterly',
        'new',
        (date_trunc('day', v_now) - INTERVAL '7 days' + INTERVAL '10 hours' + (n || ' minutes')::interval)
    FROM members m
    CROSS JOIN generate_series(1, 8) AS n
    WHERE m.gym_id = v_saltlake_id
    ORDER BY random()
    LIMIT 8; -- 8 * 3999 = ₹31,992 total (> ₹15,000)

    RAISE NOTICE 'Seeding Payments... done';
    RAISE NOTICE 'Seeding 90 days of Check-ins... in progress';

    --------------------------------------------------------------------------------
    -- 4. SEED HISTORICAL CHECK-INS (With Realistic Distributions)
    --------------------------------------------------------------------------------
    -- 4.0 Per-gym weighted hour pools. The hourly shape follows the spec's
    -- multiplier table, but each gym's pool only contains hours that gym is
    -- actually open (its own opens_at/closes_at), so traffic is never generated
    -- outside real operating hours.
    CREATE TEMP TABLE tmp_hour_weights (hour_num INT, weight FLOAT) ON COMMIT DROP;
    INSERT INTO tmp_hour_weights VALUES
        (0,0.00),(1,0.00),(2,0.00),(3,0.00),(4,0.00),(5,0.30),
        (6,0.60),(7,1.00),(8,1.00),(9,1.00),
        (10,0.40),(11,0.40),
        (12,0.30),(13,0.30),
        (14,0.20),(15,0.20),(16,0.20),
        (17,0.90),(18,0.90),(19,0.90),(20,0.90),
        (21,0.35),(22,0.35),
        (23,0.00);

    CREATE TEMP TABLE tmp_gym_hour_pool (gym_id UUID, hour_pool INT[]) ON COMMIT DROP;
    INSERT INTO tmp_gym_hour_pool
    SELECT
        g.id,
        array_agg(hw.hour_num)
    FROM gyms g
    JOIN tmp_hour_weights hw
      ON hw.weight > 0
     AND (hw.hour_num * 60) < (EXTRACT(HOUR FROM g.closes_at)::int * 60 + EXTRACT(MINUTE FROM g.closes_at)::int)
     AND ((hw.hour_num + 1) * 60) > (EXTRACT(HOUR FROM g.opens_at)::int * 60 + EXTRACT(MINUTE FROM g.opens_at)::int)
    CROSS JOIN LATERAL generate_series(1, ROUND(hw.weight * 100)::int) AS rep
    GROUP BY g.id;

    -- 4.1 Active members: decide per (member, day) whether a visit happens
    -- (base rate weighted by day-of-week), and if so, pick ONE hour from that
    -- gym's weighted pool. This replaces per-hour independent trials, which
    -- let one member log multiple "visits" on the same day and inflated volume.
    INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
    SELECT
        m.id,
        m.gym_id,
        t.checkin_time,
        t.checkin_time + (INTERVAL '45 minutes' + (random() * INTERVAL '45 minutes'))
    FROM members m
    JOIN tmp_gym_hour_pool ghp ON ghp.gym_id = m.gym_id
    CROSS JOIN generate_series(v_start_date, v_now - INTERVAL '1 day', INTERVAL '1 day') AS d(day_ts)
    CROSS JOIN LATERAL (
        SELECT d.day_ts
             + (ghp.hour_pool[1 + floor(random() * array_length(ghp.hour_pool, 1))::int] || ' hours')::interval
             + (floor(random() * 60) || ' minutes')::interval AS checkin_time
    ) t
    WHERE m.status = 'active'
      AND random() < (v_p_base * v_dow_mult[EXTRACT(DOW FROM d.day_ts)::int + 1]);

    -- 4.2 Inactive / frozen members: give every one of them exactly one old,
    -- closed check-in (20-90 days ago) so last_checkin_at is never NULL for
    -- them, per spec 3.2's "must have old timestamps" rule.
    INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
    SELECT
        m.id, m.gym_id,
        t.checkin_time,
        t.checkin_time + (INTERVAL '45 minutes' + (random() * INTERVAL '45 minutes'))
    FROM members m
    CROSS JOIN LATERAL (
        SELECT v_now - (INTERVAL '1 day' * (20 + floor(random() * 70))) AS checkin_time
    ) t
    WHERE m.status IN ('inactive', 'frozen');

    RAISE NOTICE 'Seeding 90 days of Check-ins... done';

    --------------------------------------------------------------------------------
    -- 4.3 CHURN RISK POPULATION SETUP (Mandatory >= 230 Members)
    --------------------------------------------------------------------------------
    -- Fix vs. the old version: pick the member sets ONCE into temp tables and
    -- reuse the SAME sets for both the DELETE and the INSERT. Previously each
    -- statement re-ran ORDER BY random() independently, so the delete target
    -- and insert target were two different random samples.
    -- This block also now runs BEFORE the "currently checked in" open-checkin
    -- block below, and that block explicitly excludes these members -- otherwise
    -- a churn-risk member could be independently re-picked for a fresh "open"
    -- checkin a few steps later, silently overwriting their old last_checkin_at
    -- with a recent one and quietly shrinking the churn-risk population.
    CREATE TEMP TABLE tmp_high_risk AS
    SELECT id, gym_id FROM members WHERE status = 'active' ORDER BY random() LIMIT 150;

    DELETE FROM checkins WHERE member_id IN (SELECT id FROM tmp_high_risk);

    INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
    SELECT
        id, gym_id,
        t.checkin_time,
        t.checkin_time + (INTERVAL '45 minutes' + (random() * INTERVAL '45 minutes'))
    FROM tmp_high_risk
    CROSS JOIN LATERAL (
        SELECT v_now - (INTERVAL '46 days' + (random() * INTERVAL '12 days')) AS checkin_time
    ) t;

    CREATE TEMP TABLE tmp_critical_risk AS
    SELECT id, gym_id FROM members
    WHERE status = 'active' AND id NOT IN (SELECT id FROM tmp_high_risk)
    ORDER BY random() LIMIT 80;

    DELETE FROM checkins WHERE member_id IN (SELECT id FROM tmp_critical_risk);

    INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
    SELECT
        id, gym_id,
        t.checkin_time,
        t.checkin_time + (INTERVAL '45 minutes' + (random() * INTERVAL '45 minutes'))
    FROM tmp_critical_risk
    CROSS JOIN LATERAL (
        SELECT v_now - (INTERVAL '61 days' + (random() * INTERVAL '20 days')) AS checkin_time
    ) t;

    CREATE TEMP TABLE tmp_churn_risk_ids AS
    SELECT id FROM tmp_high_risk UNION SELECT id FROM tmp_critical_risk;

    RAISE NOTICE 'Seeding Pre-populated Open Check-ins & Anomaly Scenarios... in progress';

    --------------------------------------------------------------------------------
    -- 5. LIVE OPEN CHECK-INS & ANOMALY SCENARIO A & B SETUP
    --------------------------------------------------------------------------------
    -- Standard Open Check-ins for gyms other than Velachery/Bandra (handled below
    -- as dedicated anomaly scenarios). Tier is based on CAPACITY (per spec 4.4),
    -- not member count, and the count is randomised within the spec's range
    -- (biased toward the low end) rather than a single fixed constant, so the
    -- platform-wide open-checkin total (V5) stays as close as mathematically
    -- possible to spec's ceiling once combined with the mandatory Bandra breach
    -- (see note at the end of this script). Churn-risk members are excluded so
    -- their deliberately-old last_checkin_at is never overwritten.
    INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
    SELECT
        m.id,
        m.gym_id,
        v_now - (random() * INTERVAL '60 minutes'),
        NULL
    FROM (
        SELECT id, gym_id, ROW_NUMBER() OVER (PARTITION BY gym_id ORDER BY random()) AS rn
        FROM members
        WHERE status = 'active'
          AND gym_id NOT IN (v_velachery_id, v_bandra_id)
          AND id NOT IN (SELECT id FROM tmp_churn_risk_ids)
    ) m
    JOIN tmp_gym_config cfg ON m.gym_id = cfg.gym_id
    WHERE m.rn <= (
        CASE
            WHEN cfg.capacity >= 250 THEN 8 + floor(random() * 2)::int  -- Large: 25-26 (of 25-35 range) -> made 8 to 9 to accomodate for annomaly scenario B's 275-295 checkins at Bandra West
            WHEN cfg.capacity >= 160 THEN 5 + floor(random() * 2)::int  -- Medium: 15-16 (of 15-25 range)
            ELSE 3 + floor(random() * 2)::int                           -- Small: 8-9 (of 8-15 range)
        END
    );

    -- 5.1 SCENARIO A SETUP: Velachery Zero Check-in Anomaly
    DELETE FROM checkins WHERE gym_id = v_velachery_id AND checked_in >= v_now - INTERVAL '3 hours';

    INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
    SELECT
        id, gym_id, v_now - INTERVAL '2 hours 15 minutes', v_now - INTERVAL '1 hour 30 minutes'
    FROM members WHERE gym_id = v_velachery_id ORDER BY random() LIMIT 1;

    -- 5.2 SCENARIO B SETUP: Bandra West Capacity Breach Anomaly
    INSERT INTO checkins (member_id, gym_id, checked_in, checked_out)
    SELECT
        id, gym_id, v_now - (random() * INTERVAL '90 minutes'), NULL
    FROM members
    WHERE gym_id = v_bandra_id AND status = 'active'
      AND id NOT IN (SELECT id FROM tmp_churn_risk_ids)
    ORDER BY random()
    LIMIT 275; -- comfortably inside spec's 275-295, and 91.7% occupancy still clears the 90% breach threshold

    RAISE NOTICE 'Seeding Pre-populated Open Check-ins & Anomaly Scenarios... done';
    RAISE NOTICE 'Syncing members.last_checkin_at with checkins table... in progress';

    --------------------------------------------------------------------------------
    -- 6. STRICT CONSISTENCY RULE: UPDATE members.last_checkin_at
    --------------------------------------------------------------------------------
    UPDATE members m
    SET last_checkin_at = c.max_checkin
    FROM (
        SELECT member_id, MAX(checked_in) AS max_checkin
        FROM checkins
        GROUP BY member_id
    ) c
    WHERE m.id = c.member_id;

    RAISE NOTICE 'Syncing members.last_checkin_at with checkins table... done';

    --------------------------------------------------------------------------------
    -- 7. REFRESH MATERIALIZED VIEW
    --------------------------------------------------------------------------------
    RAISE NOTICE 'Refreshing gym_hourly_stats materialized view... in progress';
    REFRESH MATERIALIZED VIEW gym_hourly_stats;
    RAISE NOTICE 'Refreshing gym_hourly_stats materialized view... done';

    RAISE NOTICE 'Seed Script Completed Successfully!';
END $$;

COMMIT;