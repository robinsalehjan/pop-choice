create or replace function health_check()
returns int as $$
  select 1;
$$ language sql;
