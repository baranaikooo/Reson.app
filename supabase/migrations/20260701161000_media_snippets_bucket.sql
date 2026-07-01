-- Create the public storage bucket for media snippets
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-snippets', 'media-snippets', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Allow users to upload media snippets to their own directory
CREATE POLICY "Users upload media snippets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'media-snippets' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to read media snippets (required since they are shown to matches)
CREATE POLICY "Anyone can read media snippets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'media-snippets');

-- Allow users to update their own media snippets
CREATE POLICY "Users update own media snippets"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'media-snippets' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own media snippets
CREATE POLICY "Users delete own media snippets"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'media-snippets' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
