(()=>{
const sb=window.supabase.createClient("https://oyrtpvtzaoftinqoossn.supabase.co","sb_publishable_O4RTSpXiy-wpOkpjo8a5tg_pfjw4VBc");
const cloud=window.physiqueCloud={client:sb,user:null,plan:"none",features:new Set(),limits:{},revision:0,syncTimer:null,ready:false,busy:false,dirty:false,pendingPersist:false};
let recoveryMode=false,recoveryUser=null;
function recoveryUI(active){
  recoveryMode=active;
  for(const id of ["authEmail","inviteCode","authToggle","authReset","authResend","confirmationHelp"]){
    const node=document.getElementById(id);(node.closest("label")||node).classList.toggle("hidden",active);
  }
  document.getElementById("authNameRow").classList.add("hidden");
  document.getElementById("authTitle").textContent=active?"Set new password":"Sign in";
  document.getElementById("authPrimary").textContent=active?"Update password":"Sign in";
  document.getElementById("authPassword").autocomplete=active?"new-password":"current-password";
  document.getElementById("authPassword").value="";
  if(active){
    cloud.ready=false;clearTimeout(cloud.syncTimer);
    for(const id of ["membershipDialog","supportDialog"])document.getElementById(id)?.close();
    document.getElementById("authGate").classList.remove("hidden");
    message("Choose a new password to finish recovering your account.");
  }
}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(t,error=false){const e=document.getElementById("authMessage");e.textContent=t;e.classList.toggle("error",error)}
function status(t){document.getElementById("accountPlan").textContent=cloud.plan.toUpperCase()+" • "+t}
function cacheKey(){return "physiqueOS_account_"+cloud.user.id}
function cache(){state.__cloudRevision=cloud.revision;state.__localDirty=cloud.dirty||cloud.pendingPersist;localStorage.setItem(cacheKey(),JSON.stringify(state));localStorage.setItem("physiqueOS",JSON.stringify(state));localStorage.setItem("physiqueOS_owner",cloud.user.id)}
function clearMirror(){localStorage.removeItem("physiqueOS");localStorage.removeItem("physiqueOS_owner")}
function freshState(){
  const out={profile:{},macro:null,pendingAdjustment:null,mealPrefs:{meals:4,snacks:1,distribution:"balanced"},
    macroAutomation:{enabled:true,lastReview:null,lastAdjustment:null,history:[]},
    schedule:{wake:"07:00",checkin:"07:15",meal:"08:00",workout:"17:30",bed:"23:00",mealGap:4,mode:"lifestyle",reminder:15},
    driftControls:{sensitivity:"balanced",adherence:85,gap:2,stall:21},
    notificationSettings:{checkin:true,meals:true,workout:true,steps:true,hydration:true,drift:true,recovery:true,quietStart:"22:30",quietEnd:"07:00",escalation:"balanced"},
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Local time"};
  for(const k of ["logs","mealPlan","trainingPlan","workoutLogs","coachMessages","foodLogs","activityLogs","recoveryLogs","trainingFlags","favoriteFoods","foodDayTemplates","foodWeekTemplates","workoutFavorites","notifications"])out[k]=[];
  for(const k of ["dayMealPrefs","tacticalResults","trainingDrafts","notificationSent"])out[k]={};
  return out;
}
function inject(){
  const wrap=document.createElement("div");
  wrap.innerHTML=`<div id="authGate" class="authGate"><div class="authCard"><span class="kicker">PHYSIQUEOS ACCOUNT</span><h2 id="authTitle">Sign in</h2><p>One account for your plan, progress, and membership.</p>
  <label>Email<input id="authEmail" type="email" autocomplete="email"></label>
  <label>Password<input id="authPassword" type="password" autocomplete="current-password"></label>
  <label id="authNameRow" class="hidden">Name<input id="authName" autocomplete="name"></label>
  <label>Beta invite code (optional)<input id="inviteCode" autocomplete="off"></label><p id="authMessage" role="status" class="authMessage"></p>
  <button id="authPrimary" class="primary fullBtn">Sign in</button><button id="authToggle" class="ghostBtn fullBtn">Create account</button><button id="authReset" class="textLink authTextBtn">Forgot password?</button><button id="authResend" class="textLink authTextBtn">Resend confirmation email</button>
  <details id="confirmationHelp"><summary>Confirmation link didn’t open?</summary><p>If you already opened the email link, return here and try signing in. If your email still needs confirmation, enter your email above, copy the original confirmation link from the email, and paste it below. Keep this link private.</p><label>Original email confirmation link<input id="authConfirmationLink" type="password" autocomplete="off" spellcheck="false"></label><button id="authConfirmLink" class="ghostBtn fullBtn">Confirm email in the app</button><p>Owner accounts receive access automatically after verification. No beta code is needed.</p></details></div></div>
  <div id="accountPill" class="accountPill hidden"><span><strong id="accountName">Account</strong><small id="accountPlan">LOADING</small></span><button id="accountMenuBtn" aria-label="Account menu">•••</button>
  <div id="accountMenu" class="accountMenu hidden"><button id="syncNowBtn">Sync now</button><button id="plansBtn">Membership & tiers</button><button id="supportBtn">Get support</button><button id="billingBtn">Manage billing / change plan</button><button id="accountNotificationsBtn">Account notifications</button><a id="adminLink" href="admin.html" class="hidden">Owner dashboard</a><button id="signOutBtn">Sign out</button></div></div>
  <dialog id="membershipDialog" class="membershipDialog"><div class="sectionHead"><h2>Find your level</h2><button id="closePlans" aria-label="Close membership comparison">✕</button></div><p id="membershipMessage" role="status"></p><div id="membershipBody"></div><div class="buttons"><button id="claimInviteBtn">Claim beta invite</button><button id="refreshAccessBtn">Refresh access</button></div></dialog>
  <dialog id="supportDialog" class="membershipDialog"><div class="sectionHead"><h2>Your support</h2><button id="closeSupport" aria-label="Close support">✕</button></div><form id="supportForm"><label>Subject<input name="subject" required maxlength="160"></label><label>How can we help?<textarea name="body" required maxlength="10000" rows="4"></textarea></label><button class="primary">Send request</button></form><p id="supportMessage" role="status"></p><div id="supportHistory"></div></dialog>`;
  document.body.appendChild(wrap);document.getElementById("cloudBootNotice")?.remove();
}
async function loadAccess(){
  const {data:plan,error}=await sb.rpc("current_plan_code");
  if(error)throw error;
  cloud.plan=plan||"none";
  const {data:rows,error:featuresError}=await sb.from("plan_features").select("feature_code,limits").eq("plan_code",cloud.plan).eq("enabled",true);
  if(featuresError)throw featuresError;
  cloud.features=new Set((rows||[]).map(x=>x.feature_code));
  cloud.limits=Object.fromEntries((rows||[]).map(x=>[x.feature_code,x.limits]));
  document.documentElement.dataset.plan=cloud.plan;
  status("READY");
  document.querySelectorAll("[data-feature]").forEach(node=>node.classList.toggle("featureLocked",!cloud.features.has(node.dataset.feature)));
  if(cloud.plan==="none")await showPlans();
}
window.hasPhysiqueFeature=code=>cloud.ready&&cloud.features.has(code);
window.physiqueReviewInterval=()=>cloud.limits.nutrition_targets?.review_interval_days||7;
window.requirePhysiqueFeature=code=>{
  if(window.hasPhysiqueFeature(code))return true;
  showPlans();return false;
};
async function invoke(name,body){
  const {data,error}=await sb.functions.invoke(name,{body});
  if(error)throw error;if(data?.error)throw new Error(data.error);return data;
}
async function showPlans(){
  const dialog=document.getElementById("membershipDialog");if(!dialog.open)dialog.showModal();
  const {data:plans,error}=await sb.from("plan_catalog").select("*").order("sort_order");
  if(error){document.getElementById("membershipMessage").textContent="Membership details are unavailable. Please retry.";return;}
  document.getElementById("membershipMessage").textContent=cloud.plan==="none"?"Claim a beta invitation to begin. Paid enrollment opens after launch checks.":"Your membership: "+cloud.plan+". Founding pricing stays locked while continuously active.";
  const rows=[
    ["Training, nutrition & tracking","Included","Included","Included","Included"],
    ["Adaptive macro recommendations","Monthly","Weekly","Weekly + deeper trends","Weekly + coach review"],
    ["Meal swaps & grocery budget","Basic","Advanced","Advanced","Advanced"],
    ["Progress analysis","Monthly","Weekly","Advanced","Advanced + review"],
    ["Support","Standard","Priority","Priority","Direct touchpoint"],
    ["Lucas oversight","—","—","—","Included"],
    ["Automated form / vision analysis","—","Planned add-on","Planned","Planned"],
    ["Wearable sync","Planned","Planned","Planned","Planned"]
  ];
  document.getElementById("membershipBody").innerHTML=`<div class="tierCards">${plans.map(p=>`<article class="tierCard ${p.code===cloud.plan?"selected":""}"><span class="kicker">${esc(p.name)}</span><h3>$${p.monthly_cents/100}<small>/month</small></h3>${p.annual_cents?`<p>$${p.annual_cents/100} billed yearly</p>`:""}<ul>${(p.features||[]).map(f=>`<li>${esc(f)}</li>`).join("")}</ul><button data-buy="${esc(p.code)}_monthly" ${p.public?"":"disabled"}>${p.public?"Choose monthly":"Enrollment closed"}</button>${p.annual_cents&&p.public?`<button data-buy="${esc(p.code)}_annual">Choose annual</button>`:""}</article>`).join("")}</div><p>Paid members can upgrade, downgrade, or cancel in Manage billing. Upgrades use prorated billing; downgrades and cancellations take effect at the end of the paid period. Stripe shows the charge and date before confirmation. Leaving Founding ends its locked rate.</p><p>Founding 100 includes the current Pro bundle at $39 monthly while continuously active. Future services with material costs may be add-ons.</p><div class="tableScroll"><table><thead><tr><th>Capability</th><th>Core</th><th>Pro</th><th>Elite</th><th>Concierge</th></tr></thead><tbody>${rows.map(r=>"<tr>"+r.map(v=>"<td>"+esc(v)+"</td>").join("")+"</tr>").join("")}</tbody></table></div>`;
  dialog.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async()=>{
    b.disabled=true;try{
      const url=new URL(location.href);url.searchParams.set("billing","pending");
      const result=await invoke("create-checkout-session",{planCode:b.dataset.buy,successUrl:url.href,cancelUrl:location.href});
      location.assign(result.url);
    }catch(e){document.getElementById("membershipMessage").textContent=e.message;b.disabled=false;}
  });
}
async function claimInvite(raw){
  const {data,error}=await sb.rpc("claim_invite",{raw_token:raw});if(error)throw error;return data;
}
async function push(){
  if(recoveryMode||!cloud.ready||!cloud.user||cloud.plan==="none")return;
  cloud.dirty=true;if(cloud.busy)return;
  cloud.busy=true;
  try{
    do{
      cloud.dirty=false;
      const payload=JSON.parse(JSON.stringify(state));delete payload.__cloudUpdatedAt;delete payload.__cloudRevision;delete payload.__localDirty;cloud.pendingPersist=true;
      cache();status("SYNCING");
      const {data,error}=await sb.rpc("sync_app_state",{payload,expected_revision:cloud.revision});
      if(error)throw error;
      if(data.conflict){
        // Keep this device's work for explicit recovery; never silently overwrite remote data.
        localStorage.setItem(cacheKey()+"_conflict",JSON.stringify(payload));
        cloud.pendingPersist=false;cloud.revision=data.revision;state=Object.assign(freshState(),data.state);
        cache();renderAll();cloud.dirty=false;
        status("CONFLICT BACKUP SAVED");
        alert("Another device updated your account. Its saved version is now loaded; this device's edits are retained in your backup export.");
        break;
      }
      cloud.pendingPersist=false;cloud.revision=data.revision;state.__cloudUpdatedAt=data.updated_at;cache();status("SYNCED");
    }while(cloud.dirty);
  }catch{cache();status("SAVED ON DEVICE • RETRY");}
  finally{cloud.busy=false;}
}
window.scheduleCloudSync=()=>{if(!cloud.ready)return;cloud.dirty=true;cache();clearTimeout(cloud.syncTimer);cloud.syncTimer=setTimeout(push,900);};
async function afterAuth(user){
  if(recoveryMode)return;
  if(cloud.user?.id===user.id&&cloud.ready)return;
  cloud.ready=false;cloud.user=user;
  const owner=localStorage.getItem("physiqueOS_owner");
  const legacy=!owner?localStorage.getItem("physiqueOS"):null;
  const cached=localStorage.getItem(cacheKey());
  const {data:saved,error}=await sb.from("user_state_snapshots").select("state,updated_at,revision").eq("user_id",user.id).maybeSingle();
  if(error)throw error;
  cloud.revision=saved?.revision||0;
  const local=cached?JSON.parse(cached):null;
  const resume=local?.__localDirty&&local.__cloudRevision===(saved?.revision||0);
  state=Object.assign(freshState(),resume?local:(saved?.state||local||{}));
  cloud.dirty=!!resume;
  if(!saved&&!cached&&legacy&&JSON.parse(legacy)?.profile?.age&&confirm("Import the existing fitness data on this device into this account? Only continue if this is your data.")){
    state=Object.assign(freshState(),JSON.parse(legacy));
  }else if(saved&&local?.__localDirty&&!resume){
    localStorage.setItem(cacheKey()+"_recovery",cached);
  }
  cache();renderAll();
  document.getElementById("accountName").textContent=user.user_metadata?.full_name||user.email||"Account";
  document.getElementById("accountPill").classList.remove("hidden");
  cloud.ready=true;
  const {error:ownerError}=await sb.rpc("claim_owner_access");
  if(ownerError)throw ownerError;
  // Confirmation redirects can create a new session after the original sign-up.
  // Claim a pending invitation after verified authentication, not only on the sign-up click.
  const pendingInvite=sessionStorage.getItem("physiqueOS_invite");
  if(pendingInvite){
    try{
      await claimInvite(pendingInvite);
      sessionStorage.removeItem("physiqueOS_invite");
    }catch(error){
      message("Account ready, but your beta invitation was not claimed: "+(error?.message||"Please try again."),true);
    }
  }
  await loadAccess();
  const {data:members,error:memberError}=await sb.from("memberships").select("role").eq("user_id",user.id).eq("status","active");
  if(memberError)throw memberError;
  document.getElementById("adminLink").classList.toggle("hidden",!(members||[]).some(m=>["owner","admin"].includes(m.role)));
  if(!recoveryMode)document.getElementById("authGate").classList.add("hidden");
  document.dispatchEvent(new Event("physique:account-ready"));
  if(cloud.dirty)await push();
}
async function support(){
  const d=document.getElementById("supportDialog");if(!d.open)d.showModal();
  const {data:tickets,error}=await sb.from("support_tickets").select("*").order("created_at",{ascending:false});
  if(error){document.getElementById("supportMessage").textContent="Support is not available yet.";return;}
  const {data:replies}=await sb.from("support_replies").select("*").order("created_at");
  document.getElementById("supportHistory").innerHTML=(tickets||[]).map(t=>`<article class="tierCard"><strong>${esc(t.subject)}</strong><small> • ${esc(t.status)} • ${esc(t.priority)}</small><p>${esc(t.body)}</p>${(replies||[]).filter(r=>r.ticket_id===t.id).map(r=>"<blockquote>"+esc(r.body)+"</blockquote>").join("")}</article>`).join("")||"<p>No requests yet.</p>";
}
async function init(){
  inject();let signup=false;
  const url=new URL(location.href),invite=url.searchParams.get("invite");
  const authError=new URLSearchParams(location.hash.slice(1)).get("error_description");
  if(authError){message(authError+". Request a fresh confirmation below.",true);history.replaceState(null,"",url.pathname+url.search);}

  if(invite){sessionStorage.setItem("physiqueOS_invite",invite);url.searchParams.delete("invite");history.replaceState(null,"",url);}
  document.getElementById("inviteCode").value=sessionStorage.getItem("physiqueOS_invite")||"";
  document.getElementById("authToggle").onclick=()=>{signup=!signup;document.getElementById("authNameRow").classList.toggle("hidden",!signup);document.getElementById("authTitle").textContent=signup?"Create account":"Sign in";document.getElementById("authPrimary").textContent=signup?"Create account":"Sign in";document.getElementById("authToggle").textContent=signup?"I already have an account":"Create account";};
  document.getElementById("authPrimary").onclick=async()=>{
    const b=document.getElementById("authPrimary");b.disabled=true;message("Working…");
    try{
      const email=document.getElementById("authEmail").value.trim(),password=document.getElementById("authPassword").value;
      if(recoveryMode){
        if(!recoveryUser)throw new Error("Recovery session unavailable. Request a fresh password reset.");
        const {error}=await sb.auth.updateUser({password});if(error)throw error;
        const recovered=recoveryUser;recoveryUser=null;recoveryUI(false);signup=false;
        await afterAuth(recovered);message("Password updated.");return;
      }
      const raw=document.getElementById("inviteCode").value.trim();if(raw)sessionStorage.setItem("physiqueOS_invite",raw);
      const result=signup?await sb.auth.signUp({email,password,options:{data:{full_name:document.getElementById("authName").value.trim()},emailRedirectTo:location.origin+location.pathname}}):await sb.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      if(!result.data.session){message("Check your email to confirm your account, then return here and sign in. If the link doesn't open, use the confirmation help below.");return;}
      if(raw){await claimInvite(raw);sessionStorage.removeItem("physiqueOS_invite");}
      await afterAuth(result.data.user);
    }catch(e){cloud.ready=false;message(e.message||"Sign in failed",true);}finally{b.disabled=false;}
  };
  document.getElementById("authConfirmLink").onclick=async()=>{
    const b=document.getElementById("authConfirmLink"),input=document.getElementById("authConfirmationLink");b.disabled=true;
    try{
      const email=document.getElementById("authEmail").value.trim().toLowerCase();if(!email)throw new Error("Enter the email you are confirming above.");
      let link;try{link=new URL(input.value.trim());}catch{throw new Error("Paste the original confirmation link from your email.");}
      if(link.origin!=="https://oyrtpvtzaoftinqoossn.supabase.co"||link.pathname!=="/auth/v1/verify"||link.username||link.password)throw new Error("Use the original PhysiqueOS confirmation link from your email.");
      const type=link.searchParams.get("type"),token=link.searchParams.get("token_hash")||link.searchParams.get("token");
      if(!["signup","email"].includes(type)||!token||!/^[A-Za-z0-9_-]{32,256}$/.test(token))throw new Error("This isn't a signup confirmation link. Use the original confirmation email.");
      input.value="";
      const {data,error}=await sb.auth.verifyOtp({token_hash:token,type});
      if(error||!data?.session||!data.user)throw new Error("This link may be expired or already used. Try signing in if you already opened it, or request a fresh confirmation email.");
      if(data.user.email?.toLowerCase()!==email){await sb.auth.signOut();throw new Error("That link belongs to a different email. Use the confirmation email for the address above.");}
      document.getElementById("authPassword").value="";await afterAuth(data.user);message("Email confirmed. Your account is ready.");
    }catch(e){cloud.ready=false;message(e.message||"Confirmation unavailable. Please try again.",true);}finally{input.value="";b.disabled=false;}
  };
  document.getElementById("authResend").onclick=async()=>{
    const email=document.getElementById("authEmail").value.trim();if(!email)return message("Enter your email first",true);
    const button=document.getElementById("authResend");button.disabled=true;
    try{const {error}=await sb.auth.resend({type:"signup",email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;message("If this account needs confirmation, a new link has been requested. After verifying, return here and sign in.");}
    catch(e){message(e.message,true);}finally{button.disabled=false;}
  };
  document.getElementById("authReset").onclick=async()=>{
    const email=document.getElementById("authEmail").value.trim();if(!email)return message("Enter your email first",true);
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    message(error?error.message:"Password reset email sent.",!!error);
  };
  document.getElementById("accountMenuBtn").onclick=()=>document.getElementById("accountMenu").classList.toggle("hidden");
  document.getElementById("plansBtn").onclick=showPlans;
  document.getElementById("closePlans").onclick=()=>document.getElementById("membershipDialog").close();
  document.getElementById("refreshAccessBtn").onclick=loadAccess;
  document.getElementById("claimInviteBtn").onclick=async()=>{
    const raw=prompt("Enter your beta invite code",sessionStorage.getItem("physiqueOS_invite")||"");if(!raw)return;
    try{await claimInvite(raw.trim());await loadAccess();document.getElementById("membershipDialog").close();await push();}
    catch(e){document.getElementById("membershipMessage").textContent=e.message;}
  };
  document.getElementById("syncNowBtn").onclick=push;
  document.getElementById("supportBtn").onclick=support;
  document.getElementById("closeSupport").onclick=()=>document.getElementById("supportDialog").close();
  document.getElementById("supportForm").onsubmit=async(e)=>{
    e.preventDefault();const form=e.target,b=form.querySelector("button");b.disabled=true;
    try{
      const {error}=await sb.rpc("open_support_ticket",{subject:form.subject.value,body:form.body.value});
      if(error)throw error;form.reset();document.getElementById("supportMessage").textContent="Your request is saved.";await support();
    }catch(e){document.getElementById("supportMessage").textContent=e.message;}finally{b.disabled=false;}
  };
  document.getElementById("billingBtn").onclick=async()=>{try{const r=await invoke("create-customer-portal",{returnUrl:location.href});location.assign(r.url);}catch(e){alert(e.message);}};
  document.getElementById("signOutBtn").onclick=async()=>{
    if(cloud.busy){alert("Please wait for sync to finish.");return;}
    cache();cloud.ready=false;clearTimeout(cloud.syncTimer);await sb.auth.signOut();clearMirror();location.reload();
  };
  document.addEventListener("click",e=>{
    const locked=e.target.closest("[data-feature]");if(locked&&!window.hasPhysiqueFeature(locked.dataset.feature)){e.preventDefault();e.stopImmediatePropagation();showPlans();}
    if(cloud.plan==="none"&&!e.target.closest("[data-account-service]")&&e.target.closest("main,nav,section")){e.preventDefault();e.stopImmediatePropagation();showPlans();}
  },true);
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY"){recoveryUser=session?.user||null;recoveryUI(true);}
    if(event==="SIGNED_OUT"){recoveryUser=null;recoveryUI(false);cloud.ready=false;cloud.user=null;cloud.features.clear();clearMirror();document.getElementById("authGate").classList.remove("hidden");}
  });
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user)try{await afterAuth(session.user);}catch(e){cloud.ready=false;message("Account could not load: "+e.message,true);}
  window.addEventListener("online",push);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")push();});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
