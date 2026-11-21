-- Create the first owner after creating the user in Supabase Auth.
-- Replace the UUID and display name before running.
insert into public.admin_users (user_id, display_name, role, is_active)
values ('PASTE_AUTH_USER_UUID_HERE', 'Event Owner', 'owner', true);
