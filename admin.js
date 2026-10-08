(()=>{
const sb=window.supabase.createClient("https://oyrtpvtzaoftinqoossn.supabase.co","sb_publishable_O4RTSpXiy-wpOkpjo8a5tg_pfjw4VBc");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let members=[],org,coaches=[],accountUser,detailVersion=0;
function renderMembers(){
  const q=document.getElementById("memberSearch").value.toLowerCase();
  document.getElementById("membersBody").innerHTML=members.filter(m=>(m.full_name+" "+m.email).toLowerCase().includes(q)).map(m=>`<tr><td><button data-member="${esc(m.user_id)}">${esc(m.full_name||m.email)}</button><small>${esc(m.email)}</small></td><td>${esc(m.subscription_status||m.access_source||"No access")}</td><td>${esc(m.last_cloud_sync||"—")}</td><td>${esc(m.last_checkin_date||"—")}</td><td>${m.adherence_pct==null?"—":esc(m.adherence_pct)+"%"}</td></tr>`).join("")||'<tr><td colspan="5">No matching members.</td></tr>';
  document.querySelectorAll("[data-member]").forEach(b=>b.onclick=()=>memberDetail(b.dataset.member));
}
async function memberDetail(userId){
 const version=++detailVersion,d=document.getElementById("memberDetail");d.textContent="Loading member…";
 const [snapshot,checkins,notes,assignments]=await Promise.all([
  sb.from("user_state_snapshots").select("state,updated_at").eq("user_id",userId).maybeSingle(),
  sb.from("daily_checkins").select("*").eq("user_id",userId).eq("organization_id",org).order("checkin_date",{ascending:false}).limit(7),
  sb.from("coach_notes").select("*").eq("client_user_id",userId).eq("organization_id",org).order("created_at",{ascending:false}).limit(20),
  sb.from("coach_client_assignments").select("coach_user_id,active").eq("client_user_id",userId).eq("organization_id",org).eq("active",true)
 ]);
 if(version!==detailVersion)return;
 if([snapshot,checkins,notes,assignments].some(r=>r.error)){d.textContent="Member details unavailable. Please retry.";return;}
 const member=members.find(m=>m.user_id===userId),active=(assignments.data||[]).map(a=>a.coach_user_id);
 d.innerHTML=`<h3>${esc(member?.full_name||member?.email||"Member")}</h3><p>Active coaching assignments: ${esc(active.map(id=>coaches.find(c=>c.user_id===id)?.full_name||id).join(", ")||"None")}</p>
 <form id="coachAssignmentForm"><label>Coach<select name="coach" required><option value="">Select active coach</option>${coaches.map(c=>`<option value="${esc(c.user_id)}">${esc(c.full_name||c.user_id)}</option>`).join("")}</select></label><label>Action<select name="action"><option value="assign">Assign access</option><option value="remove">Remove access</option></select></label><button ${coaches.length?"":"disabled"}>Save assignment</button></form><p id="assignmentStatus" role="status">Only an active coach and client in this organization can be assigned.</p>
 <h4>Recent check-ins</h4><div class="tableScroll"><table><thead><tr><th>Date</th><th>Weight (kg)</th><th>Steps</th><th>Adherence</th></tr></thead><tbody>${(checkins.data||[]).map(c=>`<tr><td>${esc(c.checkin_date)}</td><td>${esc(c.weight_kg??"—")}</td><td>${esc(c.steps??"—")}</td><td>${esc(c.adherence_pct??"—")}</td></tr>`).join("")||'<tr><td colspan="4">No check-ins yet.</td></tr>'}</tbody></table></div>
 <h4>Coach notes</h4>${(notes.data||[]).map(n=>`<article class="tierCard"><small>${esc(n.visibility)} • ${esc(n.created_at)}</small><p>${esc(n.body)}</p></article>`).join("")||"<p>No notes.</p>"}
 <form id="coachNoteForm"><label>New note<textarea name="body" required maxlength="10000" rows="3"></textarea></label><label>Visibility<select name="visibility"><option value="staff">Staff only</option><option value="client">Visible to client</option></select></label><button>Save note</button></form><p id="noteStatus" role="status"></p><details><summary>Saved account data</summary><pre id="snapshotData"></pre></details>`;
 d.querySelector("#snapshotData").textContent=JSON.stringify(snapshot.data?.state||{},null,2);
 d.querySelector("#coachAssignmentForm").onsubmit=async(e)=>{
  e.preventDefault();const form=e.target,button=form.querySelector("button");button.disabled=true;
  const {error}=await sb.rpc("set_coach_assignment",{org,coach:form.elements.coach.value,client:userId,grant_access:form.elements.action.value==="assign"});
  if(version!==detailVersion)return;
  if(error){d.querySelector("#assignmentStatus").textContent=error.message;button.disabled=false;return;}await memberDetail(userId);
 };
 d.querySelector("#coachNoteForm").onsubmit=async(e)=>{
  e.preventDefault();const form=e.target,button=form.querySelector("button");button.disabled=true;
  const {error}=await sb.from("coach_notes").insert({organization_id:org,client_user_id:userId,author_user_id:accountUser.id,body:form.elements.body.value,visibility:form.elements.visibility.value});
  if(version!==detailVersion)return;
  if(error){d.querySelector("#noteStatus").textContent=error.message;button.disabled=false;return;}await memberDetail(userId);
 };
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
  const {data:{user}}=await sb.auth.getUser();if(!user)throw new Error("Sign in through the app first.");accountUser=user;
  const {data:roles,error}=await sb.from("memberships").select("role,organization_id").eq("user_id",user.id).eq("status","active");
  if(error)throw error;org=(roles||[]).find(r=>["owner","admin"].includes(r.role))?.organization_id;
  if(!org)throw new Error("This account does not have owner or admin access.");
  const {data:coachMemberships,error:coachError}=await sb.from("memberships").select("user_id").eq("organization_id",org).eq("role","coach").eq("status","active");
  if(coachError)throw coachError;
  if(coachMemberships?.length){const {data:coachProfiles,error:profileError}=await sb.from("profiles").select("user_id,full_name").in("user_id",coachMemberships.map(c=>c.user_id));if(profileError)throw profileError;coaches=coachProfiles||[];}
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
