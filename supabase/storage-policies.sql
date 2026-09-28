-- Create private buckets in the Supabase dashboard first:
-- career-documents and generated-resumes.
-- Paths are always: <auth.uid()>/<entity-id>/...

create policy "Users read own career documents"
on storage.objects for select to authenticated
using (bucket_id = 'career-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload own career documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'career-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own career documents"
on storage.objects for update to authenticated
using (bucket_id = 'career-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own career documents"
on storage.objects for delete to authenticated
using (bucket_id = 'career-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own generated resumes"
on storage.objects for select to authenticated
using (bucket_id = 'generated-resumes' and (storage.foldername(name))[1] = auth.uid()::text);

