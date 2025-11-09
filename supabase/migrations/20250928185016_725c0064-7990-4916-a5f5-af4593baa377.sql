-- Storage policies for 'notas' bucket
-- Allow public read of files in 'notas'
create policy "Public read notas"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'notas');

-- Allow public upload (insert) into 'notas'
create policy "Public upload notas"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'notas');

-- Allow public delete in 'notas' (used when user removes/reenviates a note)
create policy "Public delete notas"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'notas');