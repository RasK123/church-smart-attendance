const LOGO="logo.png";
const ADMIN_USER="Sol@321",ADMIN_PASS="202020";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let db=null,S={members:[],users:[],att:{},settings:{start:"09:00",grace:10}},me=null,tab="dash",viewDate=today(),q="",loaded=false;
const KEYS={members:"list",users:"list",att:"records",settings:"cfg"};
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
async function hash(e,p){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e.toLowerCase()+"|"+p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function lsGet(k){try{return JSON.parse(localStorage.getItem("church_"+k))}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem("church_"+k,JSON.stringify(v))}catch(e){}}
async function load(){
  try{const c=await window.claude.use("db");db=c}catch(e){db=null}
  for(const k of Object.keys(KEYS)){
    let v=null;
    if(db){try{const s=await db.doc("church/"+k).get();if(s.exists)v=s.data()[KEYS[k]]}catch(e){}}
    else v=lsGet(k);
    if(v!=null)S[k]=v;
  }
  if(!db){const n=$("#note");n.style.display="block";n.textContent="Cloud storage is unavailable in this view — data is saved in this browser only."}
  loaded=true;render();
}
async function save(k){
  if(db){try{await db.doc("church/"+k).set({[KEYS[k]]:S[k]})}catch(e){alert("Could not save to storage: "+(e.message||e.code));}}
  else lsSet(k,S[k]);
}
function timeStr(iso){return new Date(iso).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function status(iso,date){
  const [h,m]=S.settings.start.split(":").map(Number);
  const lim=new Date(date+"T00:00:00");lim.setHours(h,m+Number(S.settings.grace||0),0,0);
  return new Date(iso)>lim?"late":"attended";
}
function isAdmin(){return me&&me.role==="admin"}
function render(){
  if(!loaded){$("#app").innerHTML='<div class="login"><p class="empty">Loading…</p></div>';return}
  if(!me){return renderLogin()}
  const tabs=[["dash","Attendance Report"]];
  if(isAdmin())tabs.push(["mark","Mark Attendance"],["members","Members"],["users","Users & Settings"]);
  if(!tabs.find(t=>t[0]===tab))tab="dash";
  $("#app").innerHTML=`<header><img src="${LOGO}" alt="Logo"><div><h1>Church Attendance System</h1><small>${esc(me.label)} · ${isAdmin()?"Administrator":"Viewer"}</small></div><div class="sp"></div><button class="g" id="out">Sign out</button></header>
  <main><div class="tabs">${tabs.map(t=>`<button class="${tab===t[0]?"on":""}" data-t="${t[0]}">${t[1]}</button>`).join("")}</div><div id="view"></div></main>`;
  $("#out").onclick=()=>{me=null;try{sessionStorage.removeItem("church_me")}catch(e){}render()};
  document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{tab=b.dataset.t;render()});
  ({dash:vDash,mark:vMark,members:vMembers,users:vUsers})[tab]();
}
function renderLogin(){
  $("#app").innerHTML=`<div class="card login"><img src="${LOGO}" alt="Logo"><h1 style="font-size:20px">Church Attendance System</h1><p class="empty">Sign in to continue</p>
  <form id="f"><div><label>Username or email</label><input id="u" autocomplete="username" required></div><div><label>Password</label><input id="p" type="password" autocomplete="current-password" required></div><div class="err" id="e"></div><button>Sign in</button></form></div>`;
  $("#f").onsubmit=async ev=>{
    ev.preventDefault();const u=$("#u").value.trim(),p=$("#p").value;
    if(u===ADMIN_USER&&p===ADMIN_PASS){me={role:"admin",label:u}}
    else{const h=await hash(u,p);const x=S.users.find(x=>x.email.toLowerCase()===u.toLowerCase()&&x.hash===h);if(x)me={role:"viewer",label:x.name||x.email}}
    if(!me){$("#e").textContent="Incorrect username or password.";return}
    try{sessionStorage.setItem("church_me",JSON.stringify(me))}catch(e){}
    render();
  };
}
function vDash(){
  const recs=S.att[viewDate]||{};
  const A=[],L=[],N=[];
  S.members.forEach(m=>{const t=recs[m.id];if(!t)N.push(m);else (status(t,viewDate)==="late"?L:A).push({m,t})});
  const li=(m,t,cls)=>`<div class="item"><div class="n">${esc(m.name)}<small>${esc(m.group||"")}</small></div>${t?`<span class="pill ${cls}">${timeStr(t)}</span>`:""}</div>`;
  $("#view").innerHTML=`<div class="card"><div class="row"><div><label>Service date</label><input type="date" id="d" value="${viewDate}"></div><div><button class="g" id="td">Today</button></div></div><p class="empty" style="margin:10px 0 0">Service starts ${S.settings.start}; arrivals after ${S.settings.grace} min grace are marked late.</p></div>
  <div class="stats"><div class="stat"><b>${S.members.length}</b><span>Total members</span></div><div class="stat"><b class="ok">${A.length}</b><span>Attended (on time)</span></div><div class="stat"><b class="late">${L.length}</b><span>Late</span></div><div class="stat"><b class="bad">${N.length}</b><span>Not attended</span></div></div>
  <div class="cols"><div class="card"><h2 class="ok">Attended</h2><div class="list">${A.map(x=>li(x.m,x.t,"ok")).join("")||'<div class="empty">No one yet.</div>'}</div></div>
  <div class="card"><h2 class="late">Late</h2><div class="list">${L.map(x=>li(x.m,x.t,"late")).join("")||'<div class="empty">No one.</div>'}</div></div>
  <div class="card"><h2 class="bad">Not attended</h2><div class="list">${N.map(m=>li(m)).join("")||'<div class="empty">No one.</div>'}</div></div></div>`;
  $("#d").onchange=e=>{viewDate=e.target.value||today();render()};$("#td").onclick=()=>{viewDate=today();render()};
}
function vMark(){
  const d=today(),recs=S.att[d]||{};
  const list=S.members.filter(m=>m.name.toLowerCase().includes(q.toLowerCase()));
  $("#view").innerHTML=`<div class="card"><h2>Mark attendance — ${d}</h2><p class="empty" style="margin-top:-6px">Date and time are recorded automatically when you tap Mark present.</p><input id="q" placeholder="Search member…" value="${esc(q)}"><div class="list" style="margin-top:12px">${list.map(m=>{const t=recs[m.id];return `<div class="item"><div class="n">${esc(m.name)}<small>${esc(m.group||"")}</small></div>${t?`<span class="pill ${status(t,d)==="late"?"late":"ok"}">${status(t,d)==="late"?"Late":"Present"} · ${timeStr(t)}</span><button class="g" data-u="${m.id}">Undo</button>`:`<button data-m="${m.id}">Mark present</button>`}</div>`}).join("")||'<div class="empty">No members found. Add members first.</div>'}</div></div>`;
  $("#q").oninput=e=>{q=e.target.value;const p=e.target.selectionStart;vMark();const i=$("#q");i.focus();i.setSelectionRange(p,p)};
  document.querySelectorAll("[data-m]").forEach(b=>b.onclick=async()=>{b.disabled=true;const d2=today();(S.att[d2]=S.att[d2]||{})[b.dataset.m]=new Date().toISOString();await save("att");vMark()});
  document.querySelectorAll("[data-u]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this attendance record?"))return;delete S.att[d][b.dataset.u];await save("att");vMark()});
}
function vMembers(){
  $("#view").innerHTML=`<div class="card"><h2>Register member</h2><form id="f" class="row"><div><label>Full name</label><input id="n" required></div><div><label>Phone (optional)</label><input id="ph"></div><div><label>Group / role (optional)</label><input id="g"></div><button>Add member</button></form></div>
  <div class="card"><h2>Members (${S.members.length})</h2><div class="list">${S.members.map(m=>`<div class="item"><div class="n">${esc(m.name)}<small>${esc([m.group,m.phone].filter(Boolean).join(" · "))}</small></div><button class="g" data-e="${m.id}">Edit</button><button class="d" data-x="${m.id}">Delete</button></div>`).join("")||'<div class="empty">No members yet.</div>'}</div></div>`;
  $("#f").onsubmit=async e=>{e.preventDefault();S.members.push({id:uid(),name:$("#n").value.trim(),phone:$("#ph").value.trim(),group:$("#g").value.trim(),added:new Date().toISOString()});await save("members");vMembers()};
  document.querySelectorAll("[data-e]").forEach(b=>b.onclick=async()=>{const m=S.members.find(x=>x.id===b.dataset.e);const n=prompt("Full name",m.name);if(n===null)return;m.name=n.trim()||m.name;m.group=prompt("Group / role",m.group||"")??m.group;m.phone=prompt("Phone",m.phone||"")??m.phone;await save("members");vMembers()});
  document.querySelectorAll("[data-x]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this member? Their past attendance records are kept in the database but will no longer be listed."))return;S.members=S.members.filter(x=>x.id!==b.dataset.x);await save("members");vMembers()});
}
function vUsers(){
  $("#view").innerHTML=`<div class="card"><h2>Create user account (view reports only)</h2><form id="f" class="row"><div><label>Name</label><input id="n"></div><div><label>Email</label><input id="em" type="email" required></div><div><label>Password</label><input id="pw" type="text" minlength="4" required></div><button>Create user</button></form><div class="err" id="e"></div></div>
  <div class="card"><h2>Users (${S.users.length})</h2><div class="list">${S.users.map(u=>`<div class="item"><div class="n">${esc(u.name||u.email)}<small>${esc(u.email)}</small></div><button class="d" data-x="${esc(u.email)}">Delete</button></div>`).join("")||'<div class="empty">No users yet.</div>'}</div></div>
  <div class="card"><h2>Service time settings</h2><div class="row"><div><label>Service start time</label><input type="time" id="st" value="${S.settings.start}"></div><div><label>Late after (minutes)</label><input type="number" id="gr" min="0" value="${S.settings.grace}"></div><button id="sv">Save settings</button></div></div>`;
  $("#f").onsubmit=async e=>{e.preventDefault();const em=$("#em").value.trim();if(S.users.some(u=>u.email.toLowerCase()===em.toLowerCase())){$("#e").textContent="That email already exists.";return}
    S.users.push({email:em,name:$("#n").value.trim(),hash:await hash(em,$("#pw").value),created:new Date().toISOString()});await save("users");vUsers()};
  document.querySelectorAll("[data-x]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this user?"))return;S.users=S.users.filter(u=>u.email!==b.dataset.x);await save("users");vUsers()});
  $("#sv").onclick=async()=>{S.settings={start:$("#st").value||"09:00",grace:Number($("#gr").value)||0};await save("settings");alert("Saved.")};
}
try{const m=sessionStorage.getItem("church_me");if(m)me=JSON.parse(m)}catch(e){}
render();load();
