-- Super Admin Profile Analytics RPC, Performance Indexes & Security Hardening for Nimmi Matrimony
-- Run this idempotent script in the Supabase SQL Editor for your existing project.
-- Notes:
--   1. Does NOT create duplicate tables or modify existing user records.
--   2. Enforces `super_admin` authorization inside `is_super_admin()` and `get_profile_analytics_dashboard()`.
--   3. Uses `SECURITY DEFINER` with `SET search_path = ''` and explicit `is_super_admin()` checks.
--   4. Supports 100,000+ profiles via server-side aggregation and targeted B-tree indexes.

-- 1. Hardened `public.is_super_admin()` helper (`search_path = ''`)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND lower(coalesce(au.role, '')) = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 2. Performance Indexes for 100,000+ profiles & subscriptions
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc
  ON public.profiles (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_profile_status
  ON public.profiles (profile_status);

CREATE INDEX IF NOT EXISTS idx_profiles_gender
  ON public.profiles (gender);

CREATE INDEX IF NOT EXISTS idx_profiles_religion_community
  ON public.profiles (religion_id, community_id);

CREATE INDEX IF NOT EXISTS idx_profiles_state_city
  ON public.profiles (state, city);

CREATE INDEX IF NOT EXISTS idx_profiles_created_status
  ON public.profiles (created_at, profile_status);

DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subscriptions_status_plan ON public.subscriptions (status, plan_id, profile_id);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON public.subscriptions (end_date);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON public.subscriptions (created_at DESC);';
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments (status, created_at DESC);';
  END IF;
END $$;

-- 3. Server-Side Profile Analytics Aggregation RPC (Super Admin Exclusive, Zero PII)
CREATE OR REPLACE FUNCTION public.get_profile_analytics_dashboard(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_religion_id uuid DEFAULT NULL,
  p_community_id uuid DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_profile_status text DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_approved_at boolean := false;
  v_has_payments boolean := false;
  v_has_subscriptions boolean := false;
  v_has_plans boolean := false;

  v_summary jsonb := '{}'::jsonb;
  v_daily jsonb := '[]'::jsonb;
  v_monthly jsonb := '[]'::jsonb;
  v_yearly jsonb := '[]'::jsonb;
  v_gender jsonb := '[]'::jsonb;
  v_religion jsonb := '[]'::jsonb;
  v_community jsonb := '[]'::jsonb;
  v_states jsonb := '[]'::jsonb;
  v_cities jsonb := '[]'::jsonb;
  v_approval jsonb := '{}'::jsonb;
  v_daily_approvals jsonb := '[]'::jsonb;
  v_monthly_approvals jsonb := '[]'::jsonb;
  v_membership jsonb := '{}'::jsonb;
  v_payments jsonb := jsonb_build_object('available', false, 'reason', 'No payments table exists in the connected database.');

  -- Dynamic payment metadata
  v_pay_status_col text;
  v_pay_amount_col text;
  v_pay_refund_col text;
  v_pay_date_col text;
  v_pay_plan_col text;
  v_pay_sub_col text;
  v_pay_prof_col text;
  v_pay_sql text;
  v_plan_name_col text := 'name';
BEGIN
  -- Enforce Super Admin role strictly inside the SECURITY DEFINER RPC
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: super_admin role is required to query Profile Analytics.'
      USING ERRCODE = '42501';
  END IF;

  v_has_subscriptions := to_regclass('public.subscriptions') IS NOT NULL;
  v_has_plans := to_regclass('public.membership_plans') IS NOT NULL;
  v_has_payments := to_regclass('public.payments') IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name = 'approved_at'
  ) INTO v_has_approved_at;

  IF v_has_plans THEN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'membership_plans' AND c.column_name = 'name'
      ) THEN 'name'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'membership_plans' AND c.column_name = 'plan_name'
      ) THEN 'plan_name'
      ELSE 'title'
    END INTO v_plan_name_col;
  END IF;

  -- Materialize filtered profile IDs and key attributes into a temp table for single-pass aggregation
  CREATE TEMP TABLE IF NOT EXISTS _tmp_filtered_profiles (
    id uuid,
    gender_norm text,
    religion_id uuid,
    community_id uuid,
    state_clean text,
    city_clean text,
    status_norm text,
    created_at timestamptz
  ) ON COMMIT DROP;

  TRUNCATE TABLE _tmp_filtered_profiles;

  INSERT INTO _tmp_filtered_profiles (
    id,
    gender_norm,
    religion_id,
    community_id,
    state_clean,
    city_clean,
    status_norm,
    created_at
  )
  SELECT
    p.id,
    CASE
      WHEN lower(coalesce(p.gender, '')) IN ('male', 'groom', 'm') THEN 'Male'
      WHEN lower(coalesce(p.gender, '')) IN ('female', 'bride', 'f') THEN 'Female'
      WHEN trim(coalesce(p.gender, '')) <> '' THEN 'Other'
      ELSE 'Unspecified'
    END AS gender_norm,
    p.religion_id,
    p.community_id,
    coalesce(nullif(trim(p.state), ''), 'Not Specified') AS state_clean,
    coalesce(nullif(trim(p.city), ''), 'Not Specified') AS city_clean,
    CASE
      WHEN lower(coalesce(p.profile_status, 'pending')) = 'approved' THEN 'Approved'
      WHEN lower(coalesce(p.profile_status, 'pending')) = 'rejected' THEN 'Rejected'
      WHEN lower(coalesce(p.profile_status, 'pending')) = 'blocked' THEN 'Blocked'
      ELSE 'Pending'
    END AS status_norm,
    p.created_at
  FROM public.profiles p
  WHERE (p_date_from IS NULL OR p.created_at >= p_date_from)
    AND (p_date_to IS NULL OR p.created_at <= p_date_to)
    AND (
      p_gender IS NULL OR p_gender = '' OR lower(p_gender) = 'all'
      OR (
        lower(p_gender) = 'male' AND lower(coalesce(p.gender, '')) IN ('male', 'groom', 'm')
      )
      OR (
        lower(p_gender) = 'female' AND lower(coalesce(p.gender, '')) IN ('female', 'bride', 'f')
      )
      OR (
        lower(p_gender) = 'other' AND lower(coalesce(p.gender, '')) NOT IN ('male', 'groom', 'm', 'female', 'bride', 'f', '')
      )
    )
    AND (p_religion_id IS NULL OR p.religion_id = p_religion_id)
    AND (p_community_id IS NULL OR p.community_id = p_community_id)
    AND (
      p_state IS NULL OR trim(p_state) = ''
      OR lower(coalesce(p.state, '')) = lower(trim(p_state))
    )
    AND (
      p_profile_status IS NULL OR p_profile_status = '' OR lower(p_profile_status) = 'all'
      OR lower(coalesce(p.profile_status, 'pending')) = lower(trim(p_profile_status))
    )
    AND (
      p_plan_id IS NULL
      OR (
        v_has_subscriptions AND EXISTS (
          SELECT 1
          FROM public.subscriptions s
          WHERE s.profile_id = p.id
            AND s.plan_id = p_plan_id
        )
      )
    );

  -- 1. Summary KPIs
  SELECT jsonb_build_object(
    'totalProfiles', COUNT(*),
    'newToday', COUNT(*) FILTER (WHERE fp.created_at >= date_trunc('day', now())),
    'thisMonth', COUNT(*) FILTER (WHERE fp.created_at >= date_trunc('month', now())),
    'approvedProfiles', COUNT(*) FILTER (WHERE fp.status_norm = 'Approved'),
    'pendingProfiles', COUNT(*) FILTER (WHERE fp.status_norm = 'Pending'),
    'rejectedProfiles', COUNT(*) FILTER (WHERE fp.status_norm = 'Rejected'),
    'blockedProfiles', COUNT(*) FILTER (WHERE fp.status_norm = 'Blocked'),
    'activeMembers', CASE
      WHEN v_has_subscriptions THEN (
        SELECT COUNT(DISTINCT fp2.id)
        FROM _tmp_filtered_profiles fp2
        INNER JOIN public.subscriptions s ON s.profile_id = fp2.id
        WHERE fp2.status_norm = 'Approved'
          AND lower(coalesce(s.status, '')) = 'active'
          AND (s.end_date IS NULL OR s.end_date >= now())
          AND (p_plan_id IS NULL OR s.plan_id = p_plan_id)
      )
      ELSE 0
    END
  )
  INTO v_summary
  FROM _tmp_filtered_profiles fp;

  -- 2A. Daily registrations
  SELECT coalesce(jsonb_agg(jsonb_build_object('date', d.day_str, 'count', d.cnt) ORDER BY d.day_str), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT to_char(fp.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_str, COUNT(*) AS cnt
    FROM _tmp_filtered_profiles fp
    WHERE fp.created_at IS NOT NULL
    GROUP BY 1
  ) d;

  -- 2B. Monthly registrations
  SELECT coalesce(jsonb_agg(jsonb_build_object('month', m.month_str, 'count', m.cnt) ORDER BY m.month_str), '[]'::jsonb)
  INTO v_monthly
  FROM (
    SELECT to_char(date_trunc('month', fp.created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_str, COUNT(*) AS cnt
    FROM _tmp_filtered_profiles fp
    WHERE fp.created_at IS NOT NULL
    GROUP BY 1
  ) m;

  -- 2C. Yearly registrations
  SELECT coalesce(jsonb_agg(jsonb_build_object('year', y.yr, 'count', y.cnt) ORDER BY y.yr), '[]'::jsonb)
  INTO v_yearly
  FROM (
    SELECT EXTRACT(YEAR FROM (fp.created_at AT TIME ZONE 'UTC'))::int AS yr, COUNT(*) AS cnt
    FROM _tmp_filtered_profiles fp
    WHERE fp.created_at IS NOT NULL
    GROUP BY 1
  ) y;

  -- 3. Gender Distribution
  SELECT coalesce(jsonb_agg(jsonb_build_object('gender', g.gender_norm, 'count', g.cnt) ORDER BY g.cnt DESC), '[]'::jsonb)
  INTO v_gender
  FROM (
    SELECT fp.gender_norm, COUNT(*) AS cnt
    FROM _tmp_filtered_profiles fp
    GROUP BY fp.gender_norm
  ) g;

  -- 4A. Religion Distribution
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'religionId', r.religion_id,
    'religionName', r.religion_name,
    'count', r.cnt
  ) ORDER BY r.cnt DESC, r.religion_name ASC), '[]'::jsonb)
  INTO v_religion
  FROM (
    SELECT
      fp.religion_id::text AS religion_id,
      coalesce(rel.name, 'Not Specified') AS religion_name,
      COUNT(*) AS cnt
    FROM _tmp_filtered_profiles fp
    LEFT JOIN public.religions rel ON rel.id = fp.religion_id
    GROUP BY fp.religion_id, rel.name
  ) r;

  -- 4B. Community Distribution
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'communityId', c.community_id,
    'communityName', c.community_name,
    'religionId', c.religion_id,
    'religionName', c.religion_name,
    'count', c.cnt
  ) ORDER BY c.cnt DESC, c.community_name ASC), '[]'::jsonb)
  INTO v_community
  FROM (
    SELECT
      fp.community_id::text AS community_id,
      coalesce(comm.community_name, 'Not Specified') AS community_name,
      fp.religion_id::text AS religion_id,
      coalesce(rel.name, 'Not Specified') AS religion_name,
      COUNT(*) AS cnt
    FROM _tmp_filtered_profiles fp
    LEFT JOIN public.communities comm ON comm.id = fp.community_id
    LEFT JOIN public.religions rel ON rel.id = fp.religion_id
    GROUP BY fp.community_id, comm.community_name, fp.religion_id, rel.name
  ) c;

  -- 5A. State-wise Statistics
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'state', s.state_clean,
    'total', s.total_cnt,
    'maleCount', s.male_cnt,
    'femaleCount', s.female_cnt
  ) ORDER BY s.total_cnt DESC, s.state_clean ASC), '[]'::jsonb)
  INTO v_states
  FROM (
    SELECT
      fp.state_clean,
      COUNT(*) AS total_cnt,
      COUNT(*) FILTER (WHERE fp.gender_norm = 'Male') AS male_cnt,
      COUNT(*) FILTER (WHERE fp.gender_norm = 'Female') AS female_cnt
    FROM _tmp_filtered_profiles fp
    GROUP BY fp.state_clean
  ) s;

  -- 5B. City-wise Statistics
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'city', ct.city_clean,
    'state', ct.state_clean,
    'total', ct.total_cnt
  ) ORDER BY ct.total_cnt DESC, ct.city_clean ASC), '[]'::jsonb)
  INTO v_cities
  FROM (
    SELECT
      fp.city_clean,
      fp.state_clean,
      COUNT(*) AS total_cnt
    FROM _tmp_filtered_profiles fp
    GROUP BY fp.city_clean, fp.state_clean
  ) ct;

  -- 6. Profile Approval Analytics (+ approval trends ONLY if `approved_at` column exists)
  IF v_has_approved_at THEN
    EXECUTE $sql$
      SELECT coalesce(jsonb_agg(jsonb_build_object('date', t.d, 'count', t.cnt) ORDER BY t.d), '[]'::jsonb)
      FROM (
        SELECT to_char(p.approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, COUNT(*) AS cnt
        FROM _tmp_filtered_profiles fp
        INNER JOIN public.profiles p ON p.id = fp.id
        WHERE p.approved_at IS NOT NULL AND fp.status_norm = 'Approved'
        GROUP BY 1
      ) t
    $sql$ INTO v_daily_approvals;

    EXECUTE $sql$
      SELECT coalesce(jsonb_agg(jsonb_build_object('month', t.m, 'count', t.cnt) ORDER BY t.m), '[]'::jsonb)
      FROM (
        SELECT to_char(date_trunc('month', p.approved_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS m, COUNT(*) AS cnt
        FROM _tmp_filtered_profiles fp
        INNER JOIN public.profiles p ON p.id = fp.id
        WHERE p.approved_at IS NOT NULL AND fp.status_norm = 'Approved'
        GROUP BY 1
      ) t
    $sql$ INTO v_monthly_approvals;
  END IF;

  v_approval := jsonb_build_object(
    'hasApprovalHistory', v_has_approved_at,
    'dailyApprovals', v_daily_approvals,
    'monthlyApprovals', v_monthly_approvals
  );

  -- 7. Membership & Subscription Analytics
  IF v_has_subscriptions THEN
    EXECUTE format($sql$
      WITH scoped_subs AS (
        SELECT
          s.id,
          s.profile_id,
          s.plan_id,
          CASE
            WHEN lower(coalesce(s.status, 'pending')) = 'cancelled' OR lower(coalesce(s.status, 'pending')) = 'canceled' THEN 'Cancelled'
            WHEN lower(coalesce(s.status, 'pending')) = 'expired' THEN 'Expired'
            WHEN lower(coalesce(s.status, 'pending')) = 'active' AND s.end_date IS NOT NULL AND s.end_date < now() THEN 'Expired'
            WHEN lower(coalesce(s.status, 'pending')) = 'active' THEN 'Active'
            ELSE 'Pending'
          END AS effective_status
        FROM public.subscriptions s
        INNER JOIN _tmp_filtered_profiles fp ON fp.id = s.profile_id
        WHERE ($1 IS NULL OR s.plan_id = $1)
      ),
      plan_rows AS (
        SELECT
          mp.id::text AS plan_id,
          coalesce(mp.%I, 'Membership Plan') AS plan_name,
          COUNT(ss.id) AS total_count,
          COUNT(ss.id) FILTER (WHERE ss.effective_status = 'Active') AS active_count,
          COUNT(ss.id) FILTER (WHERE ss.effective_status = 'Pending') AS pending_count,
          COUNT(ss.id) FILTER (WHERE ss.effective_status = 'Expired') AS expired_count,
          COUNT(ss.id) FILTER (WHERE ss.effective_status = 'Cancelled') AS cancelled_count
        FROM public.membership_plans mp
        LEFT JOIN scoped_subs ss ON ss.plan_id = mp.id
        WHERE ($1 IS NULL OR mp.id = $1)
        GROUP BY mp.id, mp.%I
        ORDER BY total_count DESC, plan_name ASC
      )
      SELECT jsonb_build_object(
        'available', true,
        'totalSubscriptions', (SELECT COUNT(*) FROM scoped_subs),
        'activeSubscriptions', (SELECT COUNT(*) FROM scoped_subs WHERE effective_status = 'Active'),
        'pendingSubscriptions', (SELECT COUNT(*) FROM scoped_subs WHERE effective_status = 'Pending'),
        'expiredSubscriptions', (SELECT COUNT(*) FROM scoped_subs WHERE effective_status = 'Expired'),
        'cancelledSubscriptions', (SELECT COUNT(*) FROM scoped_subs WHERE effective_status = 'Cancelled'),
        'planDistribution', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'planId', pr.plan_id,
            'planName', pr.plan_name,
            'totalCount', pr.total_count,
            'activeCount', pr.active_count,
            'pendingCount', pr.pending_count,
            'expiredCount', pr.expired_count,
            'cancelledCount', pr.cancelled_count
          )) FROM plan_rows pr
        ), '[]'::jsonb)
      )
    $sql$, v_plan_name_col, v_plan_name_col)
    INTO v_membership
    USING p_plan_id;
  ELSE
    v_membership := jsonb_build_object(
      'available', false,
      'totalSubscriptions', 0,
      'activeSubscriptions', 0,
      'pendingSubscriptions', 0,
      'expiredSubscriptions', 0,
      'cancelledSubscriptions', 0,
      'planDistribution', '[]'::jsonb
    );
  END IF;

  -- 8. Payment & Revenue Analytics (dynamically inspected; never fabricates payments)
  IF v_has_payments THEN
    SELECT c.column_name INTO v_pay_status_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments'
      AND c.column_name IN ('status', 'payment_status')
    ORDER BY CASE c.column_name WHEN 'status' THEN 1 ELSE 2 END
    LIMIT 1;

    SELECT c.column_name INTO v_pay_amount_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments'
      AND c.column_name IN ('amount', 'amount_inr', 'total_amount', 'paid_amount')
    ORDER BY CASE c.column_name WHEN 'amount' THEN 1 WHEN 'amount_inr' THEN 2 WHEN 'total_amount' THEN 3 ELSE 4 END
    LIMIT 1;

    SELECT c.column_name INTO v_pay_refund_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments'
      AND c.column_name IN ('refunded_amount', 'refund_amount')
    LIMIT 1;

    SELECT c.column_name INTO v_pay_date_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments'
      AND c.column_name IN ('paid_at', 'created_at')
    ORDER BY CASE c.column_name WHEN 'paid_at' THEN 1 ELSE 2 END
    LIMIT 1;

    SELECT c.column_name INTO v_pay_plan_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments'
      AND c.column_name IN ('plan_id', 'membership_plan_id')
    LIMIT 1;

    SELECT c.column_name INTO v_pay_sub_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments'
      AND c.column_name = 'subscription_id'
    LIMIT 1;

    SELECT c.column_name INTO v_pay_prof_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments'
      AND c.column_name IN ('profile_id', 'user_id')
    ORDER BY CASE c.column_name WHEN 'profile_id' THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_pay_status_col IS NOT NULL AND v_pay_amount_col IS NOT NULL THEN
      v_pay_sql := format($pay$
        WITH base_pay AS (
          SELECT
            lower(coalesce(pay.%I::text, '')) AS raw_status,
            coalesce(pay.%I, 0)::numeric AS gross_amt,
            %s AS refund_amt,
            %s AS pay_dt,
            %s AS resolved_plan_id
          FROM public.payments pay
          %s
          WHERE ($1 IS NULL OR %s >= $1)
            AND ($2 IS NULL OR %s <= $2)
            AND ($3 IS NULL OR %s = $3)
            %s
        ),
        classified AS (
          SELECT
            *,
            CASE
              WHEN raw_status IN ('refunded', 'refund', 'partially_refunded', 'reversed', 'chargeback') THEN 'refunded'
              WHEN raw_status IN ('failed', 'failure', 'declined', 'error', 'cancelled', 'canceled') THEN 'failed'
              WHEN raw_status IN ('pending', 'initiated', 'created', 'processing', 'authorized') THEN 'pending'
              WHEN raw_status IN ('success', 'succeeded', 'paid', 'captured', 'completed', 'verified') AND refund_amt < gross_amt THEN 'successful'
              WHEN raw_status IN ('success', 'succeeded', 'paid', 'captured', 'completed', 'verified') AND refund_amt >= gross_amt AND gross_amt > 0 THEN 'refunded'
              ELSE 'pending'
            END AS pay_class,
            GREATEST(0, gross_amt - refund_amt) AS net_amt
          FROM base_pay
        )
        SELECT jsonb_build_object(
          'available', true,
          'successfulCount', COUNT(*) FILTER (WHERE pay_class = 'successful'),
          'pendingCount', COUNT(*) FILTER (WHERE pay_class = 'pending'),
          'failedCount', COUNT(*) FILTER (WHERE pay_class = 'failed'),
          'refundedCount', COUNT(*) FILTER (WHERE pay_class = 'refunded'),
          'totalSuccessfulAmount', coalesce(SUM(net_amt) FILTER (WHERE pay_class = 'successful'), 0),
          'monthlyRevenue', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'month', mr.m,
              'amount', mr.amt,
              'count', mr.cnt
            ) ORDER BY mr.m)
            FROM (
              SELECT
                to_char(date_trunc('month', pay_dt AT TIME ZONE 'UTC'), 'YYYY-MM') AS m,
                coalesce(SUM(net_amt), 0) AS amt,
                COUNT(*) AS cnt
              FROM classified
              WHERE pay_class = 'successful' AND pay_dt IS NOT NULL
              GROUP BY 1
            ) mr
          ), '[]'::jsonb),
          'revenueByPlan', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'planId', rp.pid,
              'planName', rp.pname,
              'amount', rp.amt,
              'count', rp.cnt
            ) ORDER BY rp.amt DESC)
            FROM (
              SELECT
                coalesce(cl.resolved_plan_id::text, 'unlinked') AS pid,
                coalesce(mp.%I, 'Unlinked Plan') AS pname,
                coalesce(SUM(cl.net_amt), 0) AS amt,
                COUNT(*) AS cnt
              FROM classified cl
              LEFT JOIN public.membership_plans mp ON mp.id = cl.resolved_plan_id
              WHERE cl.pay_class = 'successful'
              GROUP BY cl.resolved_plan_id, mp.%I
            ) rp
          ), '[]'::jsonb)
        )
        FROM classified
      $pay$,
      v_pay_status_col,
      v_pay_amount_col,
      CASE WHEN v_pay_refund_col IS NOT NULL THEN format('coalesce(pay.%I, 0)::numeric', v_pay_refund_col) ELSE '0::numeric' END,
      CASE WHEN v_pay_date_col IS NOT NULL THEN format('pay.%I', v_pay_date_col) ELSE 'NULL::timestamptz' END,
      CASE
        WHEN v_pay_plan_col IS NOT NULL THEN format('pay.%I', v_pay_plan_col)
        WHEN v_pay_sub_col IS NOT NULL AND v_has_subscriptions THEN 'sub.plan_id'
        ELSE 'NULL::uuid'
      END,
      CASE
        WHEN v_pay_sub_col IS NOT NULL AND v_has_subscriptions THEN format('LEFT JOIN public.subscriptions sub ON sub.id = pay.%I', v_pay_sub_col)
        ELSE ''
      END,
      CASE WHEN v_pay_date_col IS NOT NULL THEN format('pay.%I', v_pay_date_col) ELSE 'now()' END,
      CASE WHEN v_pay_date_col IS NOT NULL THEN format('pay.%I', v_pay_date_col) ELSE 'now()' END,
      CASE
        WHEN v_pay_plan_col IS NOT NULL THEN format('pay.%I', v_pay_plan_col)
        WHEN v_pay_sub_col IS NOT NULL AND v_has_subscriptions THEN 'sub.plan_id'
        ELSE 'NULL::uuid'
      END,
      CASE
        WHEN v_pay_prof_col IS NOT NULL THEN format('AND EXISTS (SELECT 1 FROM _tmp_filtered_profiles fp WHERE fp.id = pay.%I)', v_pay_prof_col)
        WHEN v_pay_sub_col IS NOT NULL AND v_has_subscriptions THEN 'AND (sub.profile_id IS NULL OR EXISTS (SELECT 1 FROM _tmp_filtered_profiles fp WHERE fp.id = sub.profile_id))'
        ELSE ''
      END,
      v_plan_name_col,
      v_plan_name_col
      );

      EXECUTE v_pay_sql INTO v_payments USING p_date_from, p_date_to, p_plan_id;
    ELSE
      v_payments := jsonb_build_object(
        'available', false,
        'reason', 'The payments table exists, but required status/amount columns could not be matched.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'dailyRegistrations', v_daily,
    'monthlyRegistrations', v_monthly,
    'yearlyRegistrations', v_yearly,
    'genderDistribution', v_gender,
    'religionDistribution', v_religion,
    'communityDistribution', v_community,
    'stateStats', v_states,
    'cityStats', v_cities,
    'approvalAnalytics', v_approval,
    'membershipAnalytics', v_membership,
    'paymentAnalytics', v_payments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_analytics_dashboard(timestamptz, timestamptz, text, uuid, uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_analytics_dashboard(timestamptz, timestamptz, text, uuid, uuid, text, text, uuid) TO authenticated;
