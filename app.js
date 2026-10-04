const {createClient}=window.supabase;
const sb=createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
let S={laws:[],favs:JSON.parse(localStorage.getItem("ps_favs")||"[]"),user:null,admin:false,cat:"",authRegister:false,selected:null};

const app={
 async init(){
   if(window.SUPABASE_URL.includes("YOUR-PROJECT")){alert("Сначала настройте config.js по инструкции.");return}
   document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>this.go(b.dataset.go));
   document.querySelector("#search").oninput=()=>this.render();
   document.querySelector("#type").onchange=()=>this.render();
   document.querySelector("#status").onchange=()=>this.render();
   document.querySelectorAll(".cat").forEach(b=>b.onclick=()=>{S.cat=b.dataset.cat;document.querySelectorAll(".cat").forEach(x=>x.classList.toggle("active",x===b));this.render()});
   document.querySelector("#authBtn").onclick=()=>S.user?this.logout():this.openAuth();
   document.querySelector("#authForm").onsubmit=e=>this.auth(e);
   sb.auth.onAuthStateChange((_e,s)=>this.session(s));
   const {data}=await sb.auth.getSession(); await this.session(data.session);
 },
 async session(session){
   S.user=session?.user||null;S.admin=false;
   if(S.user){const {data}=await sb.from("profiles").select("role").eq("id",S.user.id).maybeSingle();S.admin=data?.role==="admin";}
   document.querySelector("#userLabel").textContent=S.user?(S.admin?"Администратор":S.user.email):"Гость";
   document.querySelector("#authBtn").textContent=S.user?"Выйти":"Войти";
   document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",!S.admin));
   await this.load();
 },
 async load(){
   const {data,error}=await sb.from("laws").select("*").order("title");
   if(error){
    console.error("Supabase error:", error);
    S.laws = [];
    this.fillTypes();
    this.render();
    return;
}
   S.laws=data||[];this.fillTypes();this.render();this.renderFav();if(S.admin)this.renderAdmin();
 },
 fillTypes(){const a=[...new Set(S.laws.map(x=>x.type))].sort();document.querySelector("#type").innerHTML='<option value="">Все виды</option>'+a.map(x=>`<option>${esc(x)}</option>`).join("")},
 go(id){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));document.querySelector("#"+id).classList.remove("hidden");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.go===id));if(id==="favorites")this.renderFav();if(id==="admin"&&S.admin)this.renderAdmin();scrollTo(0,0)},
 render(){
   const q=document.querySelector("#search").value.toLowerCase().trim(),t=document.querySelector("#type").value,st=document.querySelector("#status").value;
   const a=S.laws.filter(l=>(!q||[l.title,l.number,l.description,l.current_text,(l.tags||[]).join(" ")].join(" ").toLowerCase().includes(q))&&(!t||l.type===t)&&(!st||l.status===st)&&(!S.cat||l.type===S.cat));
   document.querySelector("#docCount").textContent=S.laws.length;document.querySelector("#results").textContent=`Найдено: ${a.length}`;document.querySelector("#list").innerHTML=a.map(card).join("");
 },
 renderFav(){const a=S.laws.filter(l=>S.favs.includes(l.id));document.querySelector("#favList").innerHTML=a.length?a.map(card).join(""):'<div class="law-card">В избранном пока ничего нет.</div>'},
 open(id){const l=S.laws.find(x=>x.id===id);if(!l)return;S.selected=id;this.go("document");document.querySelector("#doc").innerHTML=`<div class="doc-header"><div class="law-meta"><span class="badge">${esc(l.type)}</span><span class="badge green">${esc(l.status)}</span></div><h1>${esc(l.title)}</h1><p>${esc(l.description||"")}</p><div class="law-number">${esc(l.number||"")} · ${esc(l.date||"—")} · редакция №${l.version}</div></div><div class="doc-body">${esc(l.current_text)}</div>`;
   document.querySelector("#favDoc").textContent=S.favs.includes(id)?"★ В избранном":"☆ В избранное";document.querySelector("#favDoc").onclick=()=>this.fav(id);document.querySelector("#editDoc").onclick=()=>this.edit(l);
 },
 fav(id){S.favs=S.favs.includes(id)?S.favs.filter(x=>x!==id):[...S.favs,id];localStorage.setItem("ps_favs",JSON.stringify(S.favs));this.open(id)},
 openAuth(){document.querySelector("#authModal").classList.remove("hidden");document.querySelector("#authError").textContent="";document.querySelector("#authTitle").textContent=S.authRegister?"Регистрация":"Вход"},
 closeAuth(){document.querySelector("#authModal").classList.add("hidden")},
 toggleAuth(){S.authRegister=!S.authRegister;this.openAuth()},
 async auth(e){e.preventDefault();const email=document.querySelector("#email").value,password=document.querySelector("#password").value;let r=S.authRegister?await sb.auth.signUp({email,password}):await sb.auth.signInWithPassword({email,password});if(r.error)return document.querySelector("#authError").textContent=r.error.message;if(S.authRegister){document.querySelector("#authError").textContent="Регистрация выполнена. Если включено подтверждение email, подтвердите адрес и войдите.";S.authRegister=false}else this.closeAuth()},
 async logout(){await sb.auth.signOut()},
 edit(l={id:"",title:"",type:"Федеральный закон",number:"",date:"",status:"Действует",tags:[],description:"",current_text:""}){
   if(!S.admin)return alert("Требуются права администратора.");
   document.querySelector("#lawModalTitle").textContent=l.id?"Редактирование":"Новый документ";
   document.querySelector("#lawForm").innerHTML=`<div class="grid"><label class="full">Название<input name="title" required value="${attr(l.title)}"></label><label>Вид<select name="type"><option>Конституция</option><option>Кодекс</option><option>Федеральный закон</option><option>Подзаконный акт</option><option>Иной документ</option></select></label><label>Номер<input name="number" value="${attr(l.number||"")}"></label><label>Дата<input name="date" type="date" value="${attr(l.date||"")}"></label><label>Статус<select name="status"><option>Действует</option><option>Утратил силу</option></select></label><label class="full">Теги<input name="tags" value="${attr((l.tags||[]).join(", "))}"></label><label class="full">Описание<input name="description" value="${attr(l.description||"")}"></label><label class="full">Текст документа<textarea name="text" required>${esc(l.current_text||"")}</textarea></label></div><div class="form-actions"><button type="button" class="secondary-btn" onclick="app.closeLaw()">Отмена</button><button class="primary-btn">Опубликовать</button></div>`;
   const f=document.querySelector("#lawForm");f.type.value=l.type;f.status.value=l.status;f.onsubmit=e=>{e.preventDefault();this.saveLaw(l.id,new FormData(f))};document.querySelector("#lawModal").classList.remove("hidden");
 },
 closeLaw(){document.querySelector("#lawModal").classList.add("hidden")},
 async saveLaw(id,f){
   const x={title:f.get("title").trim(),type:f.get("type"),number:f.get("number").trim(),date:f.get("date")||null,status:f.get("status"),tags:f.get("tags").split(",").map(x=>x.trim()).filter(Boolean),description:f.get("description").trim(),current_text:f.get("text")};
   let r=id?await sb.from("laws").update(x).eq("id",id):await sb.from("laws").insert(x);
   if(r.error)return alert("Ошибка публикации: "+r.error.message);
   this.closeLaw();await this.load();alert(id?"Новая редакция опубликована.":"Документ опубликован.");
 },
 renderAdmin(){document.querySelector("#adminTable").innerHTML='<div class="admin-row header"><div>Документ</div><div>Вид</div><div>Статус</div><div>Действия</div></div>'+S.laws.map(l=>`<div class="admin-row"><div><b>${esc(l.title)}</b><div class="law-number">редакция ${l.version}</div></div><div>${esc(l.type)}</div><div><span class="badge green">${esc(l.status)}</span></div><div class="admin-actions"><button class="small-btn" onclick="app.open('${l.id}')">Открыть</button><button class="small-btn" onclick='app.edit(${JSON.stringify(l).replace(/'/g,"&#39;")})'>Изменить</button><button class="small-btn danger" onclick="app.del('${l.id}')">Удалить</button></div></div>`).join("")},
 async del(id){if(!confirm("Удалить документ?"))return;const r=await sb.from("laws").delete().eq("id",id);if(r.error)alert(r.error.message);else await this.load()}
};
function card(l){return `<div class="law-card" onclick="app.open('${l.id}')"><div class="law-meta"><span class="badge">${esc(l.type)}</span><span class="badge green">${esc(l.status)}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.description||"")}</p><div class="law-number">${esc(l.number||"")} · ${esc(l.date||"")} · ред. ${l.version}</div></div>`}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function attr(s){return esc(s)}
window.app=app;document.addEventListener("DOMContentLoaded",()=>app.init());
