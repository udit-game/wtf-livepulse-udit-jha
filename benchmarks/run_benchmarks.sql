docker exec -i wtf_livepulse_db psql -U wtf -d wtf_livepulse -P pager=off <<'EOF'
-- 1. Warm buffers & refresh statistics
VACUUM ANALYZE members;
VACUUM ANALYZE checkins;
VACUUM ANALYZE payments;
VACUUM ANALYZE gym_hourly_stats;
VACUUM ANALYZE anomalies;

\timing on

-- Grab a real active gym UUID
SELECT id AS gym_uuid FROM gyms WHERE status = 'active' LIMIT 1 \gset

-- Q1: Target < 0.5ms
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(*) FROM checkins WHERE gym_id = :'gym_uuid' AND checked_out IS NULL;

-- Q2: Target < 0.8ms
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT SUM(amount) FROM payments WHERE gym_id = :'gym_uuid' AND paid_at >= CURRENT_DATE;

-- Q3: Target < 1.0ms
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, name, last_checkin_at FROM members WHERE status = 'active' AND last_checkin_at < NOW() - INTERVAL '45 days';

-- Q4: Target < 0.3ms
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM gym_hourly_stats WHERE gym_id = :'gym_uuid';

-- Q5: Target < 2.0ms
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT gym_id, SUM(amount) FROM payments WHERE paid_at >= NOW() - INTERVAL '30 days' GROUP BY gym_id ORDER BY SUM(amount) DESC;

-- Q6: Target < 0.3ms
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM anomalies WHERE resolved = FALSE ORDER BY detected_at DESC;
EOF