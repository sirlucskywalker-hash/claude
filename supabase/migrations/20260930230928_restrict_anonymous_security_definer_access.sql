revoke execute on function public.can_manage_user(uuid), public.current_access(), public.has_org_role(uuid,text[]), public.is_org_member(uuid), public.handle_new_user() from public, anon;
grant execute on function public.can_manage_user(uuid), public.current_access(), public.has_org_role(uuid,text[]), public.is_org_member(uuid) to authenticated, service_role;
revoke execute on function public.handle_new_user() from authenticated;
