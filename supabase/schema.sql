create table if not exists groups (
  id            text primary key,
  name          text not null,
  color         text not null,
  works_saturday boolean not null default false,
  order_index   integer not null default 0
);

create table if not exists priorities (
  id            text primary key,
  name          text not null,
  color         text not null,
  description   text not null default '',
  order_index   integer not null default 0
);

create table if not exists tasks (
  id            text primary key,
  title         text not null,
  description   text not null default '',
  start_date    date not null,
  end_date      date not null,
  status        text not null check (status in ('pendiente','en_progreso','pausada','bloqueada','completada')),
  priority_id   text not null,
  group_ids     text[] not null default '{}',
  progress      integer not null default 0 check (progress between 0 and 100),
  notes         text not null default '',
  off_days      date[] not null default '{}',
  depends_on    text[] not null default '{}'
);

create table if not exists settings (
  id         text primary key default 'singleton',
  color_by   text not null default 'priority' check (color_by in ('priority','status')),
  holidays   date[] not null default '{}',
  constraint settings_singleton check (id = 'singleton')
);
insert into settings (id) values ('singleton') on conflict (id) do nothing;

alter table groups     enable row level security;
alter table priorities enable row level security;
alter table tasks      enable row level security;
alter table settings   enable row level security;

create policy "authenticated full access" on groups     for all to authenticated using (true) with check (true);
create policy "authenticated full access" on priorities for all to authenticated using (true) with check (true);
create policy "authenticated full access" on tasks      for all to authenticated using (true) with check (true);
create policy "authenticated full access" on settings   for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table groups, priorities, tasks, settings;
