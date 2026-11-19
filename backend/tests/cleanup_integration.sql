-- Run with psql -v ON_ERROR_STOP=1 on a disposable database AFTER applying all migrations.
-- Uses actual PostgreSQL functions, grants, RLS and triggers. Every fixture is rolled back.
begin;
insert into auth.users(id) values
 ('11000000-0000-4000-8000-000000000001'),
 ('11000000-0000-4000-8000-000000000002'),
 ('11000000-0000-4000-8000-000000000003');
insert into public.workspaces(id,name) values
 ('22000000-0000-4000-8000-000000000001','Cleanup A'),
 ('22000000-0000-4000-8000-000000000002','Cleanup B');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','admin'),
 ('22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','member'),
 ('22000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000003','admin');
insert into public.meetings(id,workspace_id,title,organiser_id,starts_at,ai_processing) values
 ('33000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','First','11000000-0000-4000-8000-000000000001',now(),false),
 ('33000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','Next','11000000-0000-4000-8000-000000000001',now()+interval '7 days',false);
insert into public.transcripts(meeting_id,source,canonical_text) values
 ('33000000-0000-4000-8000-000000000001','paste','Fix login. Review login.');
insert into public.extracted_items(id,meeting_id,type,task,source_excerpt) values
 ('44000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','action','Fix login','Fix login.'),
 ('44000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000001','action','Review login','Review login.');

create function private.fail_cleanup_assignment() returns trigger language plpgsql as $$
begin raise exception 'Injected assignment failure' using errcode='23514'; end;
$$;
create trigger fail_cleanup_assignment before insert on public.task_assignees for each row execute function private.fail_cleanup_assignment();
do $$
declare
 m uuid := '33000000-0000-4000-8000-000000000001';
 actor uuid := '11000000-0000-4000-8000-000000000001';
 changes jsonb := '[{"id":"44000000-0000-4000-8000-000000000001","owner_user_id":"11000000-0000-4000-8000-000000000002"}]';
begin
 begin
   perform public.review_meeting_items(m,actor,changes);
   raise exception 'Expected assignment failure';
 exception when check_violation then null; end;
 assert (select review_status = 'needs_review' from public.extracted_items where id='44000000-0000-4000-8000-000000000001');
 assert not exists(select 1 from public.tasks where meeting_id=m), 'Task survived failed approval';
 begin
   perform public.review_meeting_items(m,'11000000-0000-4000-8000-000000000002',changes);
   raise exception 'Member approved an item';
 exception when insufficient_privilege then null; end;
 begin
   perform public.review_meeting_items(m,actor,'[{"id":"44000000-0000-4000-8000-000000000001","owner_user_id":"11000000-0000-4000-8000-000000000003"}]');
   raise exception 'Cross-workspace owner accepted';
 exception when invalid_parameter_value then null; end;
 assert not has_table_privilege('authenticated','public.calendar_connections','SELECT'), 'Browser can read calendar tokens';
 assert not has_function_privilege('authenticated','public.review_meeting_items(uuid,uuid,jsonb,text,text)','EXECUTE');
 assert not has_function_privilege('anon','public.review_meeting_items(uuid,uuid,jsonb,text,text)','EXECUTE');
end;
$$;
drop trigger fail_cleanup_assignment on public.task_assignees;
drop function private.fail_cleanup_assignment();

do $$
declare
 m uuid := '33000000-0000-4000-8000-000000000001';
 actor uuid := '11000000-0000-4000-8000-000000000001';
 changes jsonb := '[{"id":"44000000-0000-4000-8000-000000000001","owner_user_id":"11000000-0000-4000-8000-000000000002"}]';
 first_task uuid;
 second_task uuid;
begin
 first_task := (public.review_meeting_items(m,actor,changes)->'task_ids'->>0)::uuid;
 begin
   perform public.review_meeting_items(m,actor,changes);
   raise exception 'Repeated approval succeeded';
 exception when serialization_failure then null; end;
 assert (select count(*)=1 from public.tasks where meeting_id=m);
 second_task := (public.review_meeting_items(m,actor,jsonb_build_array(jsonb_build_object('id','44000000-0000-4000-8000-000000000002','blocked_by_id',first_task)))->'task_ids'->>0)::uuid;
 assert (select status='blocked' from public.tasks where id=second_task);
 begin
   update public.tasks set blocked_by=second_task,status='blocked' where id=first_task;
   raise exception 'Cycle accepted';
 exception when invalid_parameter_value then null; end;
 update public.tasks set status='done' where id=first_task;
 assert (select status='todo' from public.tasks where id=second_task), 'Dependency was not unblocked';
 update public.tasks set status='todo' where id=first_task;
 assert (select status='blocked' from public.tasks where id=second_task), 'Dependency was not reblocked';
 assert (select completed_at is null from public.tasks where id=first_task);
 insert into public.task_carryovers(task_id,target_meeting_id,workspace_id,created_by)
 values(first_task,'33000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001',actor);
 assert (select meeting_id=m from public.tasks where id=first_task), 'Carryover changed source meeting';
end;
$$;
rollback;
