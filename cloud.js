(()=>{
const SUPABASE_URL="https://oyrtpvtzaoftinqoossn.supabase.co";
const SUPABASE_KEY="sb_publishable_O4RTSpXiy-wpOkpjo8a5tg_pfjw4VBc";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
window.physiqueCloud={client:sb,user:null,plan:"none",features:new Set(),syncTimer:null};

function injectAuth(){
  if(document.getElementById("cloudAuth")) return;
  const wrap=document.createElement("div");
  wrap.id="cloudAuth";
  wrap.innerHTML=`
  <div id="authGate" class="authGate hidden">
    <div class="authCard">
      <div class="brandMark authBrand"><span>P</span></div>
      <span class="kicker">PHYSIQUEOS ACCOUNT</span>
      <h2 id="authTitle">Sign in</h2>
      <p id="authCopy">Your account keeps your plan, progress and coaching data synced securely across devices.</p>
      <label>Email<input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></label>
      <label>Password<input id="authPassword" type="password" autocomplete="current-password" placeholder="••••••••"></label>
      <label id="authNameRow" class="hidden">Name<input id="authName" autocomplete="name" placeholder="Your name"></label>
      <label id="inviteRow" class="hidden">Invite code<input id="inviteCode" autocomplete="off" placeholder="Optional beta invite code"></label>
      <div id="authMessage" class="authMessage"></div>
      <button id="authPrimary" class="primary fullBtn" type="button">Sign in</button>
      <button id="authToggle" class="ghostBtn fullBtn" type="button">Create account</button>
      <button id="authReset" class="textLink authTextBtn" type="button">Forgot password?</button>
      <small>By continuing, you agree to the current PhysiqueOS Terms and Privacy Policy.</small>
    </div>
  </div>
  <div id="accountPill" class="accountPill hidden">
    <span><strong id="accountName">Account</strong><small id="accountPlan">SYNCED</small></span>
    <button id="accountMenuBtn" aria-label="Account menu">•••</button>
    <div id="accountMenu" class="accountMenu hidden">
      <button id="syncNowBtn">Sync now</button>
      <button id="billingBtn">Manage billing</button>
      <a href="admin.html" id="adminLink" class="hidden">Owner dashboard</a>
      <button id="signOutBtn">Sign out</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
}
function msg(t,err=false){const e=document.getElementById("authMessage"); if(e){e.textContent=t||"";e.classList.toggle("error",!!err)}}
function authMode(signup){
  const gate=document.getElementById("authGate");
  gate.dataset.mode=signup?"signup":"signin";
  document.getElementById("authTitle").textContent=signup?"Create your account":"Sign in";
  document.getElementById("authCopy").textContent=signup?"Create your secure PhysiqueOS account. Beta users can enter an invite code after signup.":"Your account keeps your plan, progress and coaching data synced securely across devices.";
  document.getElementById("authNameRow").classList.toggle("hidden",!signup);
  document.getElementById("inviteRow").classList.toggle("hidden",!signup);
  document.getElementById("authPrimary").textContent=signup?"Create account":"Sign in";
  document.getElementById("authToggle").textContent=signup?"I already have an account":"Create account";
  msg("");
}
async function loadAccess(){
  const {data:plan}=await sb.rpc("current_plan_code");
  physiqueCloud.plan=plan||"none";
  const {data:rows}=await sb.from("plan_features").select("feature_code").eq("plan_code",physiqueCloud.plan).eq("enabled",true);
  physiqueCloud.features=new Set((rows||[]).map(x=>x.feature_code));
  applyFeatureAccess();
}
function applyFeatureAccess(){
  const plan=physiqueCloud.plan;
  const p=document.getElementById("accountPlan"); if(p)p.textContent=(plan==="none"?"NO ACCESS":plan.toUpperCase())+" • SYNCED";
  document.documentElement.dataset.plan=plan;
  document.querySelectorAll("[data-feature]").forEach(node=>{
    const ok=physiqueCloud.features.has(node.dataset.feature);
    node.classList.toggle("featureLocked",!ok);
  });
}
window.hasPhysiqueFeature=code=>physiqueCloud.features.has(code);

async function loadMembership(){
  const {data}=await sb.from("memberships").select("role,organization_id").eq("user_id",physiqueCloud.user.id).eq("status","active");
  const elevated=(data||[]).some(x=>["owner","admin","coach"].includes(x.role));
  document.getElementById("adminLink")?.classList.toggle("hidden",!elevated);
}
function snapshotHash(obj){try{return JSON.stringify(obj).length}catch{return 0}}
async function pullCloudState(){
  if(!physiqueCloud.user || typeof state==="undefined")return false;
  const {data,error}=await sb.from("user_state_snapshots").select("state,updated_at").eq("user_id",physiqueCloud.user.id).maybeSingle();
  if(error) {console.warn("cloud pull",error);return false}
  if(!data?.state)return false;
  const localRaw=localStorage.getItem("physiqueOS");
  const local=localRaw?JSON.parse(localRaw):{};
  const localStamp=local.__cloudUpdatedAt?new Date(local.__cloudUpdatedAt).getTime():0;
  const cloudStamp=new Date(data.updated_at).getTime();
  if(cloudStamp>localStamp && snapshotHash(data.state)>2){
    state=Object.assign({},state,data.state,{__cloudUpdatedAt:data.updated_at});
    localStorage.setItem("physiqueOS",JSON.stringify(state));
    if(typeof renderAll==="function")renderAll();
    return true;
  }
  return false;
}
async function pushCloudState(){
  if(!physiqueCloud.user || typeof state==="undefined")return;
  const payload=JSON.parse(JSON.stringify(state));
  delete payload.__cloudUpdatedAt;
  const now=new Date().toISOString();
  const {error}=await sb.from("user_state_snapshots").upsert({
    user_id:physiqueCloud.user.id,state:payload,client_version:"web-beta-2",device_id:getDeviceId(),updated_at:now
  });
  if(!error){state.__cloudUpdatedAt=now;localStorage.setItem("physiqueOS",JSON.stringify(state))}
  else console.warn("cloud push",error);
}
function scheduleSync(){clearTimeout(physiqueCloud.syncTimer);physiqueCloud.syncTimer=setTimeout(pushCloudState,900)}
window.scheduleCloudSync=scheduleSync;
function getDeviceId(){let x=localStorage.getItem("physiqueOS_device");if(!x){x=crypto.randomUUID();localStorage.setItem("physiqueOS_device",x)}return x}

async function claimInvite(raw){
  if(!raw)return;
  const {data,error}=await sb.functions.invoke("claim-invite",{body:{token:raw}});
  if(error) throw error;
  return data;
}
async function afterAuth(user){
  physiqueCloud.user=user;
  document.getElementById("authGate").classList.add("hidden");
  document.getElementById("accountPill").classList.remove("hidden");
  const name=user.user_metadata?.full_name||user.email?.split("@")[0]||"Account";
  document.getElementById("accountName").textContent=name;
  await Promise.all([loadAccess(),loadMembership()]);
  await pullCloudState();
  await pushCloudState();
}
async function init(){
  injectAuth();
  const gate=document.getElementById("authGate");
  let signup=false;
  document.getElementById("authToggle").onclick=()=>{signup=!signup;authMode(signup)};
  document.getElementById("authPrimary").onclick=async()=>{
    msg("Working…");
    const email=document.getElementById("authEmail").value.trim();
    const password=document.getElementById("authPassword").value;
    try{
      if(signup){
        const full_name=document.getElementById("authName").value.trim();
        const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name}}});
        if(error)throw error;
        const raw=document.getElementById("inviteCode").value.trim();
        if(data.session && raw)await claimInvite(raw);
        if(data.session)await afterAuth(data.user);
        else msg("Check your email to confirm your account, then sign in.");
      }else{
        const {data,error}=await sb.auth.signInWithPassword({email,password});
        if(error)throw error;
        await afterAuth(data.user);
      }
    }catch(e){msg(e.message||String(e),true)}
  };
  document.getElementById("authReset").onclick=async()=>{
    const email=document.getElementById("authEmail").value.trim();
    if(!email)return msg("Enter your email first.",true);
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    msg(error?error.message:"Password reset email sent.",!!error);
  };
  document.getElementById("accountMenuBtn").onclick=()=>document.getElementById("accountMenu").classList.toggle("hidden");
  document.getElementById("syncNowBtn").onclick=async()=>{await pushCloudState();alert("PhysiqueOS synced.")};
  document.getElementById("billingBtn").onclick=async()=>{
    try{
      const {data,error}=await sb.functions.invoke("create-customer-portal",{body:{returnUrl:location.href}});
      if(error)throw error;if(data?.url)location.href=data.url;else alert("Billing portal is not available for this account yet.");
    }catch(e){alert(e.message||"Billing portal unavailable.")}
  };
  document.getElementById("signOutBtn").onclick=async()=>{await sb.auth.signOut();location.reload()};
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user) await afterAuth(session.user); else gate.classList.remove("hidden");
  sb.auth.onAuthStateChange((_event,session)=>{if(!session)gate.classList.remove("hidden")});
  window.addEventListener("online",pushCloudState);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")pushCloudState()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();