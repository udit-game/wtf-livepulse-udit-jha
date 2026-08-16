-- ============================================================
-- MEMBERS
-- ============================================================

-- Required: active members only for churn-risk detection
CREATE INDEX idx_members_churn_risk
    ON members (last_checkin_at)
    WHERE status = 'active';

-- Supporting index for gym-level member queries
CREATE INDEX idx_members_gym_id
    ON members (gym_id);



-- ============================================================
-- CHECKINS
-- ============================================================

-- Required: BRIN index for time-series queries
CREATE INDEX idx_checkins_time_brin
    ON checkins USING BRIN (checked_in);

-- Required: partial index for live occupancy
CREATE INDEX idx_checkins_live_occupancy
    ON checkins (gym_id, checked_out)
    WHERE checked_out IS NULL;

-- Supporting index for member check-in history
CREATE INDEX idx_checkins_member
    ON checkins (member_id, checked_in DESC);




-- ============================================================
-- PAYMENTS
-- ============================================================

-- Required: gym-level revenue queries
CREATE INDEX idx_payments_gym_date
    ON payments (gym_id, paid_at DESC);

-- Supporting index for cross-gym date-based revenue queries
CREATE INDEX idx_payments_date
    ON payments (paid_at DESC);


-- ============================================================
-- ANOMALIES
-- ============================================================

-- Required: active anomalies only
CREATE INDEX idx_anomalies_active
    ON anomalies (detected_at DESC, gym_id)
    WHERE resolved = FALSE;



 -- additional query to make live query recent event faster retrival
 -- For Recent Check-ins Event Stream
CREATE INDEX idx_checkins_gym_checked_in
  ON checkins (gym_id, checked_in DESC);

-- For Recent Check-outs Event Stream
CREATE INDEX idx_checkins_gym_checked_out
  ON checkins (gym_id, checked_out DESC)
  WHERE checked_out IS NOT NULL;