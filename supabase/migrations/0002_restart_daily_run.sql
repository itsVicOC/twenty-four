create or replace function public.restart_daily_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_run_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, nickname)
  values (v_user_id, 'Player ' || left(v_user_id::text, 4))
  on conflict (id) do nothing;

  v_event_id := public.ensure_daily_event(public.today_in_shanghai());

  select id
  into v_run_id
  from public.runs
  where user_id = v_user_id
    and event_id = v_event_id
  for update;

  if v_run_id is null then
    insert into public.runs (user_id, event_id)
    values (v_user_id, v_event_id)
    returning id into v_run_id;
  else
    delete from public.run_solutions
    where run_id = v_run_id;

    update public.runs
    set started_at = now(),
        completed_at = null,
        score_ms = null,
        run_status = 'active'
    where id = v_run_id;
  end if;

  return public.build_run_state(v_run_id);
end;
$$;

grant execute on function public.restart_daily_run() to authenticated;
