-- 1. Extend app_role enum to include 'owner'
alter type public.app_role add value if not exists 'owner';
