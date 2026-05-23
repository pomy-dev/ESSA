create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_school_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

drop policy if exists "ESSA admins can view all profiles" on public.profiles;
drop policy if exists "ESSA admins can insert profiles" on public.profiles;
drop policy if exists "ESSA admins can update all profiles" on public.profiles;
drop policy if exists "School admins can view teachers in their school" on public.profiles;
drop policy if exists "School admins can insert teachers in their school" on public.profiles;
drop policy if exists "School admins can update teachers in their school" on public.profiles;

create policy "ESSA admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() = 'essa_admin');

create policy "ESSA admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.current_user_role() = 'essa_admin');

create policy "ESSA admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() = 'essa_admin')
  with check (public.current_user_role() = 'essa_admin');

create policy "School admins can view teachers in their school"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() = 'school_admin'
    and public.current_user_school_id() = school_id
  );

create policy "School admins can insert teachers in their school"
  on public.profiles for insert
  to authenticated
  with check (
    public.current_user_role() = 'school_admin'
    and public.current_user_school_id() = school_id
    and role = 'teacher'
  );

create policy "School admins can update teachers in their school"
  on public.profiles for update
  to authenticated
  using (
    public.current_user_role() = 'school_admin'
    and public.current_user_school_id() = school_id
  )
  with check (
    public.current_user_role() = 'school_admin'
    and public.current_user_school_id() = school_id
    and role = 'teacher'
  );
