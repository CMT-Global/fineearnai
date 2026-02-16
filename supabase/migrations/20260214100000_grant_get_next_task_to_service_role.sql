-- Edge function get-next-task uses the service role client to call get_next_task_optimized.
-- Grant execute to service_role so the RPC can be invoked from the edge function.
GRANT EXECUTE ON FUNCTION public.get_next_task_optimized(UUID) TO service_role;
