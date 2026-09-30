
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema extensions;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon,service_role;
grant execute on function auth.uid() to authenticated,anon,service_role;
-- PGlite has core SHA256 but no pgcrypto extension. These test-only adapters preserve digest semantics.
create function public.digest(value text,algorithm text) returns bytea language sql immutable as $$select sha256(convert_to(value,'UTF8'))$$;
create function public.gen_random_bytes(size int) returns bytea language sql volatile as $$select substring(decode(repeat(replace(gen_random_uuid()::text,'-',''),3),'hex') from 1 for size)$$;
