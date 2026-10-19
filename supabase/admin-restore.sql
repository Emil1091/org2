-- Restaurar un backup, restringido a administradores. Requiere backups.sql ya corrido.

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table admins enable row level security;

drop policy if exists "ver propia membresía" on admins;
create policy "ver propia membresía" on admins
  for select to authenticated using (user_id = auth.uid());
-- Sin policy de insert/update/delete: la tabla de admins solo se edita a mano desde el SQL Editor.

-- Admin inicial. Para sumar a alguien más, correr este mismo insert con su email.
insert into admins (user_id)
select id from auth.users where email = 'emi.l16@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.restore_backup(p_backup_id text) returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_data jsonb;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select data into v_data from public.backups where id = p_backup_id;
  if v_data is null then
    raise exception 'Backup no encontrado';
  end if;

  -- Respaldo de seguridad del estado actual antes de pisarlo.
  perform public.rotate_interval_backup();

  delete from public.tasks;
  delete from public.groups;
  delete from public.priorities;

  insert into public.priorities
    select * from jsonb_populate_recordset(null::public.priorities, v_data->'priorities');
  insert into public.groups
    select * from jsonb_populate_recordset(null::public.groups, v_data->'groups');
  insert into public.tasks
    select * from jsonb_populate_recordset(null::public.tasks, v_data->'tasks');

  update public.settings s set
    color_by = x.color_by,
    holidays = x.holidays
  from jsonb_populate_record(null::public.settings, v_data->'settings') x
  where s.id = 'singleton';
end;
$$;

grant execute on function public.restore_backup(text) to authenticated;
