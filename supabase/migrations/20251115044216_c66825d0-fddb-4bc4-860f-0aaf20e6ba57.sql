-- Create a simple RPC to return server time for clock offset calibration
create or replace function public.get_server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;