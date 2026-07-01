CREATE POLICY "update_ledger_owner" ON public.psychometric_ledger FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
