-- Create public bucket for student photos
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

-- Public read access for photos
create policy if not exists "Public read access for student photos"
on storage.objects
for select
using (bucket_id = 'student-photos');

-- Organizers can upload photos
create policy if not exists "Organizers can upload student photos"
on storage.objects
for insert
with check (
  bucket_id = 'student-photos'
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.user_type = 'organizer'
  )
);

-- Organizers can update photos
create policy if not exists "Organizers can update student photos"
on storage.objects
for update
using (
  bucket_id = 'student-photos'
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.user_type = 'organizer'
  )
)
with check (
  bucket_id = 'student-photos'
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.user_type = 'organizer'
  )
);

-- Organizers can delete photos
create policy if not exists "Organizers can delete student photos"
on storage.objects
for delete
using (
  bucket_id = 'student-photos'
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.user_type = 'organizer'
  )
);
