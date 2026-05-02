-- 048: Let any authenticated user create an OTP session targeting any other
-- user. The OTP flow has the *cashier* (auth.uid()) insert a session whose
-- user_id is the *manager* who will receive the OTP — by design two
-- different users — but the previous INSERT policy demanded
-- `user_id = auth.uid()` so every send-otp request died with
-- "new row violates row-level security policy for table otp_sessions".
--
-- SELECT and UPDATE remain locked to `user_id = auth.uid()` so only the
-- manager (the OTP recipient) can read or consume the session — the
-- cashier still cannot peek at the OTP value.
--
-- The /api/telegram/send-otp endpoint authenticates the caller before
-- inserting, so allowing any authenticated user is acceptable.

DROP POLICY IF EXISTS otp_sessions_insert ON public.otp_sessions;
CREATE POLICY otp_sessions_insert
  ON public.otp_sessions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
