begin;

select plan(8);

select has_table('public', 'profiles');
select has_table('public', 'runs');
select has_table('public', 'run_solutions');
select has_function('public', 'start_daily_run');
select has_function('public', 'restart_daily_run');
select has_function('public', 'submit_solution');

select is(
  public.validate_24_solution(
    array[1, 3, 4, 6],
    '[
      {"left_id":"n1","right_id":"n2","operator_code":"/","result_id":"r0"},
      {"left_id":"n0","right_id":"r0","operator_code":"-","result_id":"r1"},
      {"left_id":"n3","right_id":"r1","operator_code":"/","result_id":"r2"}
    ]'::jsonb
  ),
  true,
  'valid rational solution is accepted'
);

select is(
  public.validate_24_solution(
    array[1, 3, 4, 6],
    '[
      {"left_id":"n0","right_id":"n1","operator_code":"+","result_id":"r0"},
      {"left_id":"r0","right_id":"n2","operator_code":"+","result_id":"r1"},
      {"left_id":"r1","right_id":"n3","operator_code":"+","result_id":"r2"}
    ]'::jsonb
  ),
  false,
  'wrong solution is rejected'
);

select * from finish();

rollback;
