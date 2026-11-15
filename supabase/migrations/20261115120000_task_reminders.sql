-- Optional due time (no time means 9:00 AM) and a reminder that fires this many minutes before the due moment.
alter table public.tasks
  add column if not exists due_time time,
  add column if not exists remind_before_minutes integer
    check (remind_before_minutes is null or remind_before_minutes >= 0);
