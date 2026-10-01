(()=>{
const sb=window.supabase.createClient("https://oyrtpvtzaoftinqoossn.supabase.co","sb_publishable_O4RTSpXiy-wpOkpjo8a5tg_pfjw4VBc");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let members=[],org;
function renderMembers(){
  const q=document.getElementById("memberSearch").value.toLowerCase();
  document.getElementById("membersBody").innerHTML=members.filter(m=>(m.full_name+" "+m.email).toLowerCase().includes(q)).map(m=>`<tr><td><button data-member="${esc(m.user_id)}">${esc(m.full_name||m.email)}</button><small>${esc(m.email)}</small></td><td>${esc(m.subscription_status||m.access_source||"No access")}</td><td>${esc(m.last_cloud_sync||"—")}</td><td>${esc(m.last_checkin_date||"—")}</td><td>${m.adherence_pct==null?"—":esc(m.adherence_pct)+"%"}</td></tr>`).join("")||'<tr><td colspan="5">No matching members.</td></tr>';
  document.querySelectorAll("[data-member]").forEach(b=>b.onclick=async()=>{
    const {data,error}=await sb.from("user_state_snapshots").select("state,updated_at").eq("user_id",b.dataset.member).maybeSingle();
    const d=document.getElementById("memberDetail");d.replaceChildren();
    if(error){d.textContent="Member data unavailable";return;}
    const heading=document.createElement("h3");heading.textContent="Member data";
    const pre=document.createElement("pre");pre.textContent=JSON.stringify(data?.state||{},null,2);d.append(heading,pre);
  });
}
async function deletionQueue(){
  const {data,error}=await sb.from("account_deletion_requests").select("*").in("status",["pending","in_progress"]).order("requested_at");
  if(error)throw error;
  document.getElementById("deletionQueue").innerHTML=(data||[]).map(r=>{
    const member=members.find(m=>m.user_id===r.user_id);
    return `<article class="tierCard"><strong>${esc(member?.email||r.user_id)}</strong><p>${esc(r.status)} • requested ${esc(r.requested_at)}</p><small>Request ${esc(r.id)}</small></article>`;
  }).join("")||"<p>No open deletion requests.</p>";
}
async function queue(){
  const {data,error}=await sb.from("support_tickets").select("*").order("created_at");
  if(error)throw error;
  document.getElementById("supportQueue").innerHTML=(data||[]).map(t=>`<article class="tierCard"><strong>${esc(t.subject)}</strong> <span>${esc(t.priority)} • ${esc(t.status)}</span><p>${esc(t.body)}</p><form data-ticket="${esc(t.id)}"><textarea name="message" required maxlength="10000" placeholder="Reply to this member"></textarea><select name="status"><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><button>Save reply</button></form></article>`).join("")||"<p>No support requests.</p>";
  document.querySelectorAll("[data-ticket]").forEach(f=>f.onsubmit=async(e)=>{
    e.preventDefault();const b=f.querySelector("button");b.disabled=true;
    const {error}=await sb.rpc("reply_support_ticket",{ticket:f.dataset.ticket,message:f.message.value,new_status:f.status.value});
    if(error){document.getElementById("adminStatus").textContent=error.message;b.disabled=false;return;}await queue();
  });
}
async function init(){
 try{
  const {data:{user}}=await sb.auth.getUser();if(!user)throw new Error("Sign in through the app first.");
  const {data:roles,error}=await sb.from("memberships").select("role,organization_id").eq("user_id",user.id).eq("status","active");
  if(error)throw error;org=(roles||[]).find(r=>["owner","admin"].includes(r.role))?.organization_id;
  if(!org)throw new Error("This account does not have owner or admin access.");
  const {data,error:memberError}=await sb.from("admin_client_overview_v2").select("*");
  if(memberError)throw memberError;members=data||[];
  document.getElementById("adminStats").innerHTML=[["Members",members.length],["Paid",members.filter(m=>m.access_source==="stripe"&&m.has_app_access).length],["Beta",members.filter(m=>m.access_source==="beta"&&m.has_app_access).length],["Needs check-in",members.filter(m=>!m.last_checkin_date||Date.now()-Date.parse(m.last_checkin_date)>7*86400000).length]].map(([label,value])=>`<article class="tierCard"><span>${label}</span><h2>${value}</h2></article>`).join("");
  const {data:health,error:healthError}=await sb.rpc("operations_health",{org});if(healthError)throw healthError;
  document.getElementById("operationsHealth").innerHTML=Object.entries(health).map(([key,value])=>`<article class="tierCard"><span>${esc(key.replaceAll("_"," "))}</span><h2>${esc(value)}</h2></article>`).join("");
  renderMembers();await queue();await deletionQueue();document.getElementById("adminContent").classList.remove("hidden");document.getElementById("adminStatus").textContent="Only members you are authorized to manage appear here.";
  document.getElementById("memberSearch").oninput=renderMembers;
  document.getElementById("inviteForm").onsubmit=async(e)=>{
    e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;
    const {data:token,error}=await sb.rpc("create_beta_invite",{org,invite_email:document.getElementById("inviteEmail").value||null});
    const result=document.getElementById("inviteResult");result.replaceChildren();
    if(error)result.textContent=error.message;else{
      const link=document.createElement("a"),url=new URL("index.html",location.href);url.searchParams.set("invite",token);
      link.href=url.href;link.textContent=url.href;result.append("Expires in 14 days. Share this invitation: ",link);
    }b.disabled=false;
  };
 }catch(e){document.getElementById("adminStatus").textContent=e.message;}
}
init();
})();
