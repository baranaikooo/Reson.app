CREATE POLICY write_ledger_owner ON public.psychometric_ledger FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
