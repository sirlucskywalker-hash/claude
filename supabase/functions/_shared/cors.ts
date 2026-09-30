export function corsHeaders(_req: Request) {
  const site=Deno.env.get("SITE_URL");
  return {"Access-Control-Allow-Origin":site?new URL(site).origin:"",
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
}
export function json(req: Request,value: unknown,status=200) {
  return Response.json(value,{status,headers:corsHeaders(req)});
}
export function configured() {
  return ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","STRIPE_SECRET_KEY","SITE_URL"].every(key=>!!Deno.env.get(key));
}
