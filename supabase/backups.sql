-- Respaldos automáticos. Requiere que antes esté corrido schema.sql.
-- Antes de pegar esto: Database -> Extensions -> activar "pg_cron".

create table if not exists backups (
  id         text primary key,
  kind       text not null check (kind in ('live', 'interval')),
  data       jsonb not null,
  created_at timestamptz not null default now()
);

alter table backups enable row level security;

drop policy if exists "authenticated read" on backups;
create policy "authenticated read" on backups
  for select to authenticated using (true);
-- No hay policy de insert/update/delete: solo escriben las funciones de abajo
-- (son security definer, dueñas de la tabla, no dependen de quién esté logueado).

create or replace function public.snapshot_data() returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'groups', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from public.groups g),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tasks t),
    'priorities', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.priorities p),
    'settings', (select coalesce(to_jsonb(s), '{}'::jsonb) from public.settings s where s.id = 'singleton')
  )
$$;

-- Backup "live": una sola fila (id='live') que se pisa en cada cambio.
create or replace function public.update_live_backup() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.backups (id, kind, data, created_at)
  values ('live', 'live', public.snapshot_data(), now())
  on conflict (id) do update set data = excluded.data, created_at = excluded.created_at;
  return null;
end;
$$;

drop trigger if exists trg_backup_tasks on tasks;
drop trigger if exists trg_backup_groups on groups;
drop trigger if exists trg_backup_priorities on priorities;
drop trigger if exists trg_backup_settings on settings;

create trigger trg_backup_tasks after insert or update or delete on tasks
  for each statement execute function public.update_live_backup();
create trigger trg_backup_groups after insert or update or delete on groups
  for each statement execute function public.update_live_backup();
create trigger trg_backup_priorities after insert or update or delete on priorities
  for each statement execute function public.update_live_backup();
create trigger trg_backup_settings after insert or update or delete on settings
  for each statement execute function public.update_live_backup();

-- Backup cada 30 min: agrega una fila nueva y borra las que sobran, dejando las últimas 4.
create or replace function public.rotate_interval_backup() returns void
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.backups (id, kind, data, created_at)
  values (gen_random_uuid()::text, 'interval', public.snapshot_data(), now());

  delete from public.backups
  where kind = 'interval'
    and id not in (
      select id from public.backups where kind = 'interval' order by created_at desc limit 4
    );
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'rotate-interval-backup') then
    perform cron.unschedule('rotate-interval-backup');
  end if;
end $$;

select cron.schedule('rotate-interval-backup', '*/30 * * * *', $$select public.rotate_interval_backup();$$);

-- Prueba manual (opcional): corré esta línea sola 2 o 3 veces y fijate que
-- `select count(*) from backups where kind = 'interval'` nunca pase de 4.
-- select public.rotate_interval_backup();
