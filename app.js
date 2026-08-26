// app.js - BCAPrime app logic (extracted from index.html).
// Must load AFTER firebase-config.js and supabase-config.js.
console.info('[BCAPrime] app.js v20 loaded ✔');
const colleges=[['all','All Colleges'],['avviare','Avviare Educational Hub'],['glocal','Glocal University'],['ccsu','CCSU Meerut'],['du','Delhi University'],['ipu','GGSIPU Delhi'],['aktu','AKTU / UPTU'],['ignou','IGNOU'],['mdu','MDU Rohtak'],['bhu','BHU'],['pune','Pune University'],['bangalore','Bangalore University'],['other','Other University']];
    JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]').forEach(college=>{if(Array.isArray(college)&&college.length===2)colleges.push(college)});
    /* ---- Subject-wise finder ----
       Base subjects per semester (common BCA syllabus). Colleges with extra
       subjects are handled dynamically: any subject uploaded by users shows up
       in the subject filter automatically once approved. */
    const BASE_SUBJECTS={
      1:['Programming Principles & C','Mathematics-I','Computer Fundamentals & Office Automation','PC Software','Communication Skills'],
      2:['Data Structures Using C','Mathematics-II','Digital Electronics','Computer Architecture','Environmental Studies'],
      3:['Database Management Systems','Operating Systems','Web Technologies','Object Oriented Programming using C++','Python Programming'],
      4:['Java Programming','Computer Networks','Software Engineering','Design & Analysis of Algorithms','Data Communication'],
      5:['Artificial Intelligence','Cloud Computing','Computer Graphics','Mobile Application Development','Elective-I'],
      6:['Cyber Security & Ethical Hacking','Machine Learning','Big Data Analytics','E-Commerce','Major Project / Elective-II']
    };
    function getCustomSubjects(sem){try{return JSON.parse(localStorage.getItem('bca-custom-subjects')||'{}')[String(sem)]||[]}catch(error){return[]}}
    function addCustomSubject(sem,name){try{const all=JSON.parse(localStorage.getItem('bca-custom-subjects')||'{}');const key=String(sem);all[key]=[...new Set([...(all[key]||[]),name])];localStorage.setItem('bca-custom-subjects',JSON.stringify(all))}catch(error){}}
    const normSubject=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
    /* ---- PrimeFinder robust matching — har user scenario cover karta hai ----
       - Multi-word query: har word title/subject/college mein AND-hotá hai (order irrelevant)
       - Subject: exact + normalized containment (partial/near subjects bhi milte hain)
       - Missing sem/year/college data: drop nahi karte, universal treat karte hain
       - '__add' (Add-subject UI state) ko filter nahi maante */
    function collegeMatchesFilter(c){return state.college==='all'||!c||c==='all'||c===state.college}
    function semMatchesFilter(v){return state.sem==='all'||v==null||String(v)===''||Number(v)===Number(state.sem)}
    function yearMatchesFilter(v){return state.year==='all'||v==null||String(v)===''||Number(v)===Number(state.year)}
    function queryTokens(q){return normSubject(q).split(' ').filter(Boolean)}
    function queryMatchesFilter(q,title,subject,collegeName){
      if(!q)return true;const tokens=queryTokens(q);if(!tokens.length)return true;
      const hay=normSubject(title)+' '+normSubject(subject)+' '+normSubject(collegeName);
      return tokens.every(t=>hay.includes(t));
    }
    function subjectMatchesFilter(resourceSubject,filter){
      if(!filter||filter==='all'||filter==='__add')return true;
      const r=normSubject(resourceSubject);if(!r)return true;
      const f=normSubject(filter);
      return r===f||r.includes(f)||f.includes(r);
    }
    let resources=[...JSON.parse(localStorage.getItem('bca-uploads')||'[]')].filter(resource=>(resource.type==='notes'||resource.type==='pyq')&&(!resource.status||resource.status==='approved'));
    const state={theme:localStorage.getItem('bca-theme')||'dark',college:localStorage.getItem('bca-college')||'all',type:'all',query:'',year:localStorage.getItem('bca-year')||'all',sem:localStorage.getItem('bca-sem')||'all',subject:localStorage.getItem('bca-subject')||'all',saved:JSON.parse(localStorage.getItem('bca-saved')||'[]'),savedOnly:false,onboardingCollege:'',onboardingSem:''};
    const $=id=>document.getElementById(id);
    /* ---- Analytics tracking (fire-and-forget, UI kabhi block nahi karta) ---- */
    const visitorId=(()=>{try{let v=localStorage.getItem('bca-vid');if(!v){v='v-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);localStorage.setItem('bca-vid',v)}return v}catch(e){return 'anon'}})();
    const analyticsSessionId=(()=>{try{let s=sessionStorage.getItem('bca-sid');if(!s){s='s-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);sessionStorage.setItem('bca-sid',s)}return s}catch(e){return 'sess'}})();
    const sessionStartTs=Date.now();
    function parseDeviceInfo(){const ua=navigator.userAgent;const os=/Android/i.test(ua)?'Android':/iPhone|iPad|iPod/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Mac OS/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'Unknown';const tablet=/iPad|Tablet/i.test(ua);const mobile=/Mobi|Android|iPhone/i.test(ua);const browser=/Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/SamsungBrowser/.test(ua)?'Samsung Internet':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'Other';return{device:tablet?'Tablet':mobile?'Mobile':'Desktop',os,browser}}
    function trackEvent(type,data){data=data||{};try{if(typeof supabaseClient==='undefined'||!supabaseClient)return;const dev=parseDeviceInfo();supabaseClient.from('analytics_events').insert({event_type:type,visitor_id:visitorId,session_id:analyticsSessionId,user_id:accountSession&&accountSession.uid?accountSession.uid:'',user_email:accountSession&&accountSession.email?accountSession.email:'',user_name:accountSession&&accountSession.displayName?accountSession.displayName:(data.uploader||''),resource_title:data.title||'',resource_type:data.type||'',subject:data.subject||'',semester:data.sem?Number(data.sem):null,duration_seconds:data.seconds!=null?Math.round(data.seconds):null,results_count:data.results!=null&&data.results!==''?Number(data.results):null,device:dev.device,os:dev.os,browser:dev.browser,page_path:location.pathname}).then(()=>{},()=>{})}catch(error){}}
    window.addEventListener('pagehide',()=>{try{trackEvent('session_end',{seconds:(Date.now()-sessionStartTs)/1000})}catch(error){}});
    window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')try{trackEvent('session_heartbeat',{seconds:(Date.now()-sessionStartTs)/1000})}catch(error){}});
    async function loadCloudResources(){if(!supabaseClient){console.info('Supabase resources unavailable until schema is added.');return;}try{const {data,error}=await supabaseClient.from('resources').select('*').eq('status','approved').order('created_at',{ascending:false});if(error)throw error;const cloud=(data||[]).map(item=>({title:item.title,type:item.type,sem:item.semester,year:item.year,subject:item.subject,college:item.college,fileName:item.file_name,fileUrl:item.file_url,downloads:item.downloads||0,status:item.status}));const existing=new Set(resources.map(item=>item.title));const keyOf=item=>`${String(item.title||'').trim().toLowerCase()}|${item.college||''}|${item.sem}`;const keys=new Set(resources.map(keyOf));resources=[...resources,...cloud.filter(item=>!keys.has(keyOf(item)))];try{const approvedKeys=new Set(cloud.filter(item=>item.status==='approved').map(keyOf));const remaining=JSON.parse(localStorage.getItem('bca-uploads')||'[]').filter(item=>!approvedKeys.has(keyOf(item)));localStorage.setItem('bca-uploads',JSON.stringify(remaining))}catch(error){}renderSubjectFilter();render()}catch(error){console.info('Supabase resources unavailable until schema is added.',error.message)}}
    function init(){
      applyTheme(state.theme);
      $('yearFilter').value=state.year==='all'?'all':state.year;
      updateSemesterOptions();
      if(state.sem!=='all')$('semesterFilter').value=state.sem;
      const collegeName = (colleges.find(c=>c[0]===state.college)||colleges[0])[1];
      $('collegeLabel').textContent = collegeName;
      const semText = state.sem==='all' ? 'All Semesters' : `Sem ${state.sem}`;
      $('navSemBadge').textContent = `· ${semText}`;
      $('savedSummary').textContent=state.saved.length?`${state.saved.length} resource${state.saved.length===1?'':'s'} saved for later`:'Keep important notes close';
      renderColleges();
      renderSubjectFilter();
      render();
      loadCloudResources();
      setTimeout(()=>$('splash').classList.add('hidden'),1100);
    }
    function applyTheme(theme){state.theme=theme;document.documentElement.dataset.theme=theme;localStorage.setItem('bca-theme',theme);$('themeIcon').className=theme==='dark'?'fa-solid fa-sun':'fa-solid fa-moon';const mc=document.querySelector('meta[name="theme-color"]');if(mc)mc.content=theme==='dark'?'#0a0a0a':'#fafafa'}
    function toggleTheme(){applyTheme(state.theme==='dark'?'light':'dark')}
    function render(){const list=resources.filter(r=>{
        if(state.savedOnly&&!state.saved.includes(r.title.replace(/\W/g,'')))return false;
        if(state.type!=='all'&&r.type!==state.type)return false;
        if(!collegeMatchesFilter(r.college))return false;
        if(!semMatchesFilter(r.sem))return false;
        if(!yearMatchesFilter(r.year))return false;
        if(!queryMatchesFilter(state.query,r.title,r.subject,(colleges.find(c=>c[0]===r.college)||['',''])[1]))return false;
        if(!subjectMatchesFilter(r.subject,state.subject))return false;
        return true;
      });
      $('count').textContent=`${list.length} result${list.length===1?'':'s'}`;
      $('resources').innerHTML=list.length?list.map(card).join(''):state.savedOnly?'<div class="empty"><i class="fa-regular fa-bookmark"></i><br><br>No saved resources yet.<br><button class="secondary" style="margin-top:12px" onclick="selectTab(\'library\',document.querySelector(\'.bottom-tab\'))">Browse the library</button></div>':buildEmptyState()}
    /* ---- Empty state: upload karo ya WhatsApp pe friends se request bhejo ---- */
    function buildEmptyState(){
      const submitted=String(state.query||'').trim()!=='';const searching=submitted||state.year!=='all'||state.sem!=='all'||(state.subject&&state.subject!=='all'&&state.subject!=='__add')||state.type!=='all';
      return `<div class="empty"><i class="fa-regular fa-folder-open"></i><br>
        <strong>${searching?'Ye material abhi library mein nahi mila':'Library is quiet — be the first!'}</strong><br>
        <small>${searching?'Aapke filters ka koi Notes/PYQ available nahi hai. Pehle aap upload kar do, ya apne doston se request bhejo:':'Yahan sabse pehla material aap share kar sakte ho.'}</small>
        <div class="empty-actions">
          <button class="primary" onclick="openUpload()"><i class="fa-solid fa-cloud-arrow-up"></i> Khud upload karo</button>
          <button class="wa-request" onclick="requestMaterialOnWhatsApp()"><i class="fa-brands fa-whatsapp"></i> Friends se request karo</button>
        </div></div>`;
    }
    function requestMaterialOnWhatsApp(){
      const semText=state.sem==='all'?'kisi bhi semester':('Semester '+state.sem);
      let yearText='';
      if(state.year!=='all')yearText=' ('+(state.year==='1'?'1st':state.year==='2'?'2nd':'3rd')+' year)';
      const subjText=(!state.subject||state.subject==='all')?'':(' — '+state.subject);
      const typeText=state.type==='all'?'Notes ya PYQ':(state.type==='notes'?'Notes':'PYQ');
      const msg='📚 *BCAPrime* — Study Material Request 🙏\n\n'
        +'Yaar mujhe '+semText+yearText+subjText+' ka '+typeText+' chahiye, aur library mein abhi nahi mil raha. 😅\n\n'
        +'Agar tumhare paas hai to please 2 minute nikaal ke yahan upload kar do:\n'
        +'👉 https://bcaprime.vercel.app\n\n'
        +'Pehle tu upload karega, phir sab padhenge! 💪🚀';
      window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
    }
    function card(r){const id=r.title.replace(/\W/g,'');const saved=state.saved.includes(id);return `<article class="resource"><div class="resource-top"><span class="badge">${r.type}</span><button class="save ${saved?'saved':''}" aria-label="Save resource" onclick="toggleSave('${id}')"><i class="fa-${saved?'solid':'regular'} fa-bookmark"></i></button></div><h3>${r.title}</h3><p>${r.subject}</p><div class="resource-meta"><span><i class="fa-solid fa-layer-group"></i>Semester ${r.sem}</span><span><i class="fa-solid fa-building-columns"></i>${r.college==='all'?'All colleges':(colleges.find(c=>c[0]===r.college)||['','College'])[1]}</span></div><div class="resource-submeta"><span><i class="fa-regular fa-clock"></i>${r.date||'Updated recently'}</span><span><i class="fa-solid fa-download"></i>${r.downloads||'New'} downloads</span>${r.uploader?`<span><i class="fa-solid fa-user"></i>${r.uploader}</span>`:''}</div><div class="resource-actions"><button class="view" onclick="previewResource('${id}')"><i class="fa-regular fa-eye"></i> Preview</button><button class="download" onclick="download('${r.title}')"><i class="fa-solid fa-download"></i> Download</button></div></article>`}
    function setType(type,button){state.type=type;document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));button.classList.add('active');render()}
    function applyFilters(){updateSemesterOptions();state.year=$('yearFilter').value;state.sem=$('semesterFilter').value;renderSubjectFilter();let subjectValue=$('subjectFilter')&&$('subjectFilter').value;if(subjectValue==='__add')subjectValue='all';state.subject=subjectValue;localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-subject',state.subject);const __ds=$('deskSemester');if(__ds)__ds.textContent=state.sem==='all'?'Explore your semester':`Semester ${state.sem} resources`;render()}
    /* Year select hone par semester dropdown usi year ke sems tak simit hota hai */
    function updateSemesterOptions(){
      const yearSel=$('yearFilter'),semSel=$('semesterFilter');
      if(!yearSel||!semSel)return;
      const year=yearSel.value;
      /* Fix: user ki current selection ko preserve karo — warna har
         applyFilters() par dropdown 'all' par reset ho jata tha */
      const current=semSel.value;
      if(year==='all'){
        /* Fix: year "all" par semester dropdown disable mat karo —
           saare 6 semesters available rakho taaki finder directly sem-wise kaam kare */
        semSel.disabled=false;
        const allOpts=['<option value="all">All semesters</option>'];
        for(let s=1;s<=6;s++)allOpts.push('<option value="'+s+'">Semester '+s+'</option>');
        semSel.innerHTML=allOpts.join('');
        const keep=(current&&current!=='all'&&Number(current)>=1&&Number(current)<=6)?current:(state.sem!=='all'?String(state.sem):'all');
        semSel.value=(Number(keep)>=1&&Number(keep)<=6)?keep:'all';
        return;
      }
      const start=(Number(year)-1)*2+1;
      semSel.disabled=false;
      semSel.innerHTML='<option value="all">All semesters</option><option value="'+start+'">Semester '+start+'</option><option value="'+(start+1)+'">Semester '+(start+1)+'</option>';
      const candidate=(current&&current!=='all')?current:String(state.sem);
      if(candidate!=='all'&&Number(candidate)>=start&&Number(candidate)<=start+1){
        semSel.value=candidate;
      }else{
        semSel.value='all';
        if(state.sem!=='all'&&(!current||current==='all')){state.sem='all';localStorage.setItem('bca-sem','all')}
      }
    }
    function resetFinder(){$('yearFilter').value='all';updateSemesterOptions();$('semesterFilter').value='all';state.year='all';state.sem='all';state.type='all';state.subject='all';localStorage.setItem('bca-year','all');localStorage.setItem('bca-sem','all');localStorage.setItem('bca-subject','all');const __far=$('finderAddSubjectRow');if(__far)__far.hidden=true;renderSubjectFilter();document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.textContent.trim()==='All'));const __rs=$('deskSemester');if(__rs)__rs.textContent='Explore your semester';render()}
    function chooseSemester(sem,button){const year=String(Math.ceil(Number(sem)/2)||1);state.year=year;$('yearFilter').value=year;updateSemesterOptions();$('semesterFilter').value=String(sem);document.querySelectorAll('.semester').forEach(x=>x.classList.remove('active'));button.classList.add('active');state.sem=String(sem);localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-sem',state.sem);const __cs=$('deskSemester');if(__cs)__cs.textContent=`Semester ${sem} resources`;render();saveProfileToAccount();$('library').scrollIntoView({behavior:'smooth'})}
    let lastSearchTrack={query:'',ts:0};
    function searchResources(value){state.query=value;showSuggestions();render();try{const q=String(value||'').trim().toLowerCase();const now=Date.now();if(q.length>=3&&(q!==lastSearchTrack.query||now-lastSearchTrack.ts>4000)){lastSearchTrack={query:q,ts:now};const count=resources.filter(r=>`${r.title} ${r.subject}`.toLowerCase().includes(q)).length;trackEvent('search',{title:q,results:count})}}catch(error){}}
    /* ---- Subject filter engine ----
       Options = base subjects (per semester) + custom subjects the user added
       + subjects already present in uploads for the active college/semester.
       This is how unknown college-specific subjects discover themselves. */
    function getAvailableSubjects(){
      return [...new Set(resources.filter(r=>{
        const matchCollege=collegeMatchesFilter(r.college);
        const matchSem=semMatchesFilter(r.sem);
        const matchYear=yearMatchesFilter(r.year);
        const matchType=state.type==='all'||r.type===state.type;
        return matchCollege&&matchSem&&matchYear&&matchType;
      }).map(r=>String(r.subject||'').trim()).filter(Boolean))];
    }
    function renderSubjectFilter(){
      const sel=$('subjectFilter');if(!sel)return;
      const preferred=(typeof state.subject==='string'&&state.subject)||sel.value;
      const semNumber=Number(state.sem);
      const base=state.sem!=='all'&&BASE_SUBJECTS[semNumber]?BASE_SUBJECTS[semNumber]:[];
      const customs=state.sem!=='all'?getCustomSubjects(state.sem):[];
      const seen=new Map();
      [...base,...getAvailableSubjects(),...customs].forEach(name=>{const key=normSubject(name);if(key&&!seen.has(key))seen.set(key,name)});
      const merged=[...seen.values()].sort((a,b)=>a.localeCompare(b));
      sel.innerHTML='<option value="all">All subjects</option>'+merged.map(s=>`<option value="${s.replace(/"/g,'&quot;')}">${s}</option>`).join('')+'<option value="__add">+ Add new subject&#8230;</option>';
      const values=[...sel.options].map(option=>option.value);
      sel.value=values.includes(preferred)?preferred:'all';
      const addRow=$('finderAddSubjectRow');if(addRow)addRow.hidden=sel.value!=='__add';
      renderSubjectCards();
    }
    /* Subject dropdown se naya subject add karne ka flow */
    function onSubjectFilterChange(sel){
      if(sel.value==='__add'){openFinderAddSubject();return}
      const addRow=$('finderAddSubjectRow');if(addRow)addRow.hidden=true;
      applyFilters();
    }
    function openFinderAddSubject(){
      if(state.sem==='all'){toast('Pehle year + semester select karo');$('subjectFilter').value='all';return}
      const addRow=$('finderAddSubjectRow');
      if(addRow){addRow.hidden=false}
      const input=$('finderNewSubjectInput');if(input)input.focus();
    }
    function confirmFinderAddSubject(){
      const input=$('finderNewSubjectInput');
      const name=(input&&input.value||'').trim().replace(/\s+/g,' ');
      if(!name){toast('Subject ka naam likho');if(input)input.focus();return}
      if(name.length<2){toast('Thoda bada naam likho');return}
      if(state.sem==='all'){toast('Pehle semester select karo');return}
      addCustomSubject(Number(state.sem),name);
      if(input)input.value='';
      state.subject=name;
      localStorage.setItem('bca-subject',name);
      renderSubjectFilter();
      $('subjectFilter').value=name;
      const addRow=$('finderAddSubjectRow');if(addRow)addRow.hidden=true;
      applyFilters();
      toast('"'+name+'" add ho gaya ✅ Ab isme material upload kar sakte ho');
    }
    function cancelFinderAddSubject(){
      const addRow=$('finderAddSubjectRow');if(addRow)addRow.hidden=true;
      $('subjectFilter').value='all';state.subject='all';localStorage.setItem('bca-subject','all');renderSubjectFilter();render();
    }
    /* ---- Upload form subject picker (semester ke hisaab se bharta hai) ---- */
    function updateUploadSubjects(){
      const sel=$('uploadSubjectSelect');if(!sel)return;
      const semSel=document.querySelector('#uploadModal select[name="semester"]');
      const sem=semSel&&semSel.value?Number(semSel.value):(Number(state.sem)||1);
      const seen=new Map();
      [...(BASE_SUBJECTS[sem]||[]),
       ...resources.filter(r=>r.sem===sem).map(r=>String(r.subject||'').trim()).filter(Boolean),
       ...getCustomSubjects(sem)
      ].forEach(name=>{const key=normSubject(name);if(key&&!seen.has(key))seen.set(key,name)});
      const sorted=[...seen.values()].sort((a,b)=>a.localeCompare(b));
      sel.innerHTML=sorted.map(s=>`<option value="${s.replace(/"/g,'&quot;')}">${s}</option>`).join('')+'<option value="__other">+ Other / new subject…</option>';
      onUploadSubjectChange(sel);
    }
    function onUploadSubjectChange(sel){const custom=$('customSubjectField');if(custom)custom.hidden=sel.value!=='__other'}
    /* ---- Subject cards (semester ke hisaab se, click par Notes/PYQ choice) ---- */
    function subjectIcon(name){
      const n=name.toLowerCase();
      if(/data\s*structure|algorithm/.test(n))return'fa-solid fa-sitemap';
      if(/dbms|database|sql/.test(n))return'fa-solid fa-database';
      if(/python/.test(n))return'fa-brands fa-python';
      if(/java/.test(n))return'fa-brands fa-java';
      if(/web|html|css|script/.test(n))return'fa-solid fa-code';
      if(/network|communication/.test(n))return'fa-solid fa-network-wired';
      if(/operating|^os$/.test(n))return'fa-solid fa-gears';
      if(/secur|cyber|hack/.test(n))return'fa-solid fa-shield-halved';
      if(/artificial|machine|learning|\bai\b/.test(n))return'fa-solid fa-brain';
      if(/cloud/.test(n))return'fa-solid fa-cloud';
      if(/math/.test(n))return'fa-solid fa-square-root-variable';
      if(/electron|archit|processor/.test(n))return'fa-solid fa-microchip';
      if(/software/.test(n))return'fa-solid fa-diagram-project';
      if(/graphic/.test(n))return'fa-solid fa-palette';
      if(/commerce|business/.test(n))return'fa-solid fa-cart-shopping';
      if(/mobile|app\b/.test(n))return'fa-solid fa-mobile-screen';
      if(/project/.test(n))return'fa-solid fa-rocket';
      if(/english/.test(n))return'fa-solid fa-comments';
      if(/environment/.test(n))return'fa-solid fa-leaf';
      return'fa-solid fa-book-open';
    }
    function subjectHue(name){let h=0;for(const ch of String(name))h=(h*31+ch.charCodeAt(0))%360;return h}
    function renderSubjectCards(){
      const wrap=$('subjectCards');if(!wrap)return;
      let subjects=[];
      if(state.sem!=='all'&&BASE_SUBJECTS[Number(state.sem)])subjects=[...BASE_SUBJECTS[Number(state.sem)],...getCustomSubjects(state.sem)];
      getAvailableSubjects().forEach(s=>{if(!subjects.some(x=>normSubject(x)===normSubject(s)))subjects.push(s)});
      if(!subjects.length){wrap.innerHTML='<div class="subject-empty"><i class="fa-solid fa-layer-group"></i><br>Apna semester chuno — yahan uske saare subjects dikhenge 📚</div>';return}
      const seen=new Map();subjects.forEach(s=>{const key=normSubject(s);if(key&&!seen.has(key))seen.set(key,s)});
      const countFor=s=>resources.filter(r=>subjectMatchesFilter(r.subject,s)&&collegeMatchesFilter(r.college)&&semMatchesFilter(r.sem)).length;
      /* Har subject ke semesters nikaalo: syllabus (BASE_SUBJECTS) + uploaded resources */
      const semsOf=s=>{const n=normSubject(s);const set=new Set();Object.keys(BASE_SUBJECTS).forEach(sem=>{if(BASE_SUBJECTS[sem].some(x=>normSubject(x)===n))set.add(Number(sem))});resources.forEach(r=>{if(r.subject&&r.sem!=null&&subjectMatchesFilter(r.subject,s))set.add(Number(r.sem))});return [...set].sort((a,b)=>a-b)};
      wrap.innerHTML=[...seen.values()].map((s,i)=>{
        const hue=subjectHue(s);const count=countFor(s);const sems=semsOf(s);
        const semBadge=sems.length?`<span class="subject-badge-sem"><i class="fa-solid fa-layer-group"></i>Semester ${sems.join(' &amp; ')}</span>`:'';
        return `<button class="subject-card" style="--hue:${hue};animation-delay:${Math.min(i*45,450)}ms" onclick="openSubjectType('${s.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">
          <span class="subject-card-icon"><i class="${subjectIcon(s)}"></i></span>
          <strong>${s}</strong>
          <span class="subject-card-meta">${semBadge}${count?`<small>${count} material${count>1?'s':''}</small>`:''}</span>
          <span class="subject-card-go"><i class="fa-solid fa-arrow-right"></i></span>
        </button>`}).join('');
    }
    /* ---- Naya custom subject add karo -> turant card ban jata hai ---- */
    function addSubjectCard(){
      const input=$('newSubjectInput');
      const name=(input&&input.value||'').trim().replace(/\s+/g,' ');
      if(!name){toast('Subject ka naam likho');if(input)input.focus();return}
      if(name.length<2){toast('Thoda bada naam likho');return}
      if(state.sem==='all'){toast('Pehle semester select karo, phir subject add hoga');return}
      addCustomSubject(Number(state.sem),name);
      if(input){input.value='';input.blur()}
      renderSubjectFilter();
      render();
      toast('"'+name+'" add ho gaya — Semester '+state.sem+' ✅');
    }
    let pendingSubject='';
    function openSubjectType(subject){pendingSubject=subject;const title=$('subjectTypeTitle');if(title)title.textContent=subject;const icon=$('subjectTypeIcon');if(icon)icon.innerHTML='<i class="'+subjectIcon(subject)+'"></i>';const modal=$('subjectTypeModal');if(modal)modal.classList.add('open')}
    function closeSubjectType(){const modal=$('subjectTypeModal');if(modal)modal.classList.remove('open')}
    function browseSubjectAs(kind){
      const subject=pendingSubject;if(!subject)return;
      state.subject=subject;localStorage.setItem('bca-subject',state.subject);
      state.type=kind;
      document.querySelectorAll('#typeChips .chip').forEach(chip=>chip.classList.toggle('active',chip.textContent.trim()===(kind==='pyq'?'PYQs':'Notes')));
      closeSubjectType();
      // Smooth content experience: pehle skeleton, phir results stagger-reveal
      showResourceSkeletons(6);
      $('resources').scrollIntoView({behavior:'smooth',block:'start'});
      setTimeout(()=>{
        const grid=$('resources');
        if(grid)grid.classList.add('reveal');
        render();
        toast((kind==='pyq'?'PYQs':'Notes')+': '+subject);
        setTimeout(()=>{if(grid)grid.classList.remove('reveal')},900);
      },520);
    }
    function showResourceSkeletons(count){
      const grid=$('resources');if(!grid)return;
      let html='';
      for(let i=0;i<count;i++)html+='<article class="resource skel"><span class="sk-title"></span><span class="sk-line"></span><span class="sk-line short"></span><span class="sk-line"></span><span class="sk-line short"></span></article>';
      grid.innerHTML=html;
    }
    /* ---- Feedback / bug report ---- */
    let feedbackKind='bug';
    function openFeedback(){
      if(!supabaseClient){toast('Feedback abhi unavailable hai');return}
      if(!accountSession){requireAccount('Feedback ya bug report bhejne ke liye login karo.', 'feedback');return}
      setFeedbackKind(document.querySelector('.fb-kind.active')||document.querySelector('.fb-kind'));
      $('feedbackModal').classList.add('open');
    }
    function setFeedbackKind(btn){
      if(!btn)return;
      document.querySelectorAll('.fb-kind').forEach(k=>k.classList.remove('active'));
      btn.classList.add('active');
      feedbackKind=btn.dataset.kind||'idea';
    }
    function showFeedbackFile(input){
      const file=input.files[0];
      const label=$('feedbackFileName');
      if(label)label.textContent=file?file.name:'Attach screenshot';
      const wrap=$('fbThumbWrap'),thumb=$('fbThumb');
      if(file&&wrap&&thumb){
        const reader=new FileReader();
        reader.onload=e=>{thumb.src=e.target.result;wrap.hidden=false};
        reader.readAsDataURL(file);
      }else if(wrap){wrap.hidden=true}
    }
    function removeFeedbackFile(e){
      if(e)e.preventDefault();
      const input=$('feedbackFile');if(input)input.value='';
      const wrap=$('fbThumbWrap');if(wrap)wrap.hidden=true;
      if($('feedbackFileName'))$('feedbackFileName').textContent='Attach screenshot';
    }
    function updateFbCount(value){const counter=$('fbCount');if(counter)counter.textContent=String(value.length)+'/1000'}
    async function submitFeedback(event){
      event.preventDefault();
      if(!accountSession){toast('Feedback bhejne ke liye login karo');return}
      const form=event.target;
      const message=form.querySelector('textarea[name="message"]').value.trim();
      if(message.length<5){toast('Thoda detail likho please');return}
      const btn=form.querySelector('button[type="submit"]');
      btn.disabled=true;btn.textContent='Sending…';
      try{
        let screenshotUrl=null;
        const file=$('feedbackFile').files[0];
        if(file){
          if(file.size>5*1024*1024)throw new Error('Screenshot 5MB se chota hona chahiye');
          const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png';
          const path='fb-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
          const {error:upErr}=await supabaseClient.storage.from('feedback').upload(path,file);
          if(upErr)throw upErr;
          const {data:pub}=supabaseClient.storage.from('feedback').getPublicUrl(path);
          screenshotUrl=pub.publicUrl;
        }
        const sessionName=(accountSession&&(accountSession.displayName||(accountSession.user_metadata&&accountSession.user_metadata.name)))||'';
        const row={
          kind:feedbackKind,
          message:message.slice(0,1000),
          user_email:getUploaderEmail(),
          user_name:String(sessionName||'').slice(0,120),
          screenshot_url:screenshotUrl,
          page_url:location.href.slice(0,300),
          user_agent:navigator.userAgent.slice(0,300)
        };
        const {error}=await supabaseClient.from('feedback').insert(row);
        if(error)throw error;
        closeModals();
        form.reset();
        if($('feedbackFileName'))$('feedbackFileName').textContent='Attach screenshot';
        const thumbWrap=$('fbThumbWrap');if(thumbWrap)thumbWrap.hidden=true;
        if($('fbCount'))$('fbCount').textContent='0/1000';
        toast('Thanks! Feedback mil gaya 🙏 Hum jaldi dekhenge');
      }catch(error){
        console.error('[BCAPrime] Feedback error:',error);
        toast('Feedback send failed: '+(error&&error.message||error));
      }finally{
        btn.disabled=false;btn.textContent='Send feedback';
      }
    }
    function showSuggestions(){const query=$('search').value.trim().toLowerCase();const matches=resources.filter(r=>`${r.title} ${r.subject}`.toLowerCase().includes(query)).slice(0,4);$('suggestions').innerHTML=(query?matches.map(r=>`<button class="suggestion" onclick="chooseSuggestion('${r.title.replace(/'/g,"\\'")}')"><i class="fa-solid fa-magnifying-glass"></i> ${r.title}</button>`).join(''):'<small style="padding:5px 8px;color:var(--muted)">Search by subject, paper or resource type</small>');$('suggestions').classList.add('open')}
    function chooseSuggestion(title){$('search').value=title;state.query=title;closeSuggestions();render()}
    function closeSuggestions(){$('suggestions').classList.remove('open')}
    function focusFinder(){$('bca-prime-finder').scrollIntoView({behavior:'smooth'})}
    function selectTab(tab,button){
      document.querySelectorAll('.bottom-tab').forEach(item=>item.classList.remove('active'));
      if(button) button.classList.add('active');
      if(tab==='profile'){state.savedOnly=false;openProfile();return}
      state.savedOnly=tab==='saved';
      if(tab==='semesters'){const grid=$('semesterGrid');if(grid)grid.scrollIntoView({behavior:'smooth',block:'start'});else $('library').scrollIntoView({behavior:'smooth',block:'start'});}
      else if(tab==='saved')$('resources').scrollIntoView({behavior:'smooth',block:'start'});
      else $('library').scrollIntoView({behavior:'smooth',block:'start'});
      render();
    }
    function toggleSave(id){state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];localStorage.setItem('bca-saved',JSON.stringify(state.saved));setTimeout(render,90)}
    let restrictedAction=null;
    function isGuestMode(){return !accountSession&&sessionStorage.getItem('bca-guest-mode')==='true'}
    function setAccessAuthMode(mode){accessAuthMode=mode;$('accessAuthTitle').textContent=mode==='signup'?'Sign up to continue':'Login to continue';$('accessAuthDescription').textContent=mode==='signup'?'Create a free account to upload and download study material.':'Login to continue with this action.';$('accessAuthSubmit').textContent=mode==='signup'?'Sign up':'Login';$('accessAuthSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('accessAuthMessage').textContent='';$('accessAuthNameLabel').hidden=mode!=='signup';if(mode==='signup')$('accessAuthName').setAttribute('required','');else $('accessAuthName').removeAttribute('required')}
    function requireAccount(message,action,title=''){if(accountSession)return true;restrictedAction={action,title};setAccessAuthMode('signup');$('accessAuthDescription').textContent=message;$('accessAuthMessage').textContent='';$('accessAuthModal').classList.add('open');return false}
    function resumeRestrictedAction(){if(!accountSession||!restrictedAction)return;const action=restrictedAction;restrictedAction=null;closeModals();if(action.action==='upload')openUpload();if(action.action==='download')download(action.title);if(action.action==='feedback')openFeedback()}
    async function submitAccessAuth(event){event.preventDefault();if(!firebaseApp){$('accessAuthMessage').textContent='Firebase is not configured.';return}$('accessAuthMessage').textContent='Working...';const email=$('accessAuthEmail').value.trim();const password=$('accessAuthPassword').value;try{if(accessAuthMode==='signup'){authSuppress=true;const credential=await firebase.auth().createUserWithEmailAndPassword(email,password);const name=$('accessAuthName').value.trim();if(name)await credential.user.updateProfile({displayName:name});await credential.user.sendEmailVerification();await firebase.auth().signOut();authSuppress=false;setAccessAuthMode('login');$('accessAuthMessage').textContent='Account created. Check your email to verify, then login.';return}await firebase.auth().signInWithEmailAndPassword(email,password);accountSession=firebase.auth().currentUser;sessionStorage.removeItem('bca-guest-mode');renderGreeting();resumeRestrictedAction()}catch(error){authSuppress=false;$('accessAuthMessage').textContent=error.message;return}}
    function download(title){if(!requireAccount('Sign up or login to download this note.','download',title))return;const resource=resources.find(item=>item.title===title);trackEvent('download',{title,type:resource&&resource.type,subject:resource&&resource.subject,sem:resource&&resource.sem});if(resource&&(resource.fileData||resource.fileUrl)){const a=document.createElement('a');a.href=resource.fileData||resource.fileUrl;a.download=resource.fileName||title.replace(/\W+/g,'-');a.target='_blank';a.click();toast('Download started');return}const blob=new Blob([`BCAPrime resource\n${title}\n\nUse this as a study reference.`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=title.replace(/\W+/g,'-')+'.txt';a.click();URL.revokeObjectURL(a.href);toast('Demo download started')}
    let accountMode='signup';let accessAuthMode='signup';let accountSession=null;let authSuppress=false;
    function getUserName(user){user=user||accountSession;if(user&&user.displayName&&user.displayName.trim())return user.displayName.trim();if(user&&user.email){const local=user.email.split('@')[0]||'';const parts=local.split(/[._+\-]+/).filter(Boolean).map(p=>p.charAt(0).toUpperCase()+p.slice(1));if(parts.length)return parts.join(' ')}return 'there'}
    function getTimeBasedGreeting(name='there'){const hour=new Date().getHours();let prefix;if(hour>=4&&hour<12)prefix='Good Morning';else if(hour>=12&&hour<17)prefix='Good Afternoon';else if(hour>=17&&hour<21)prefix='Good Evening';else prefix='Good Night';return `${prefix}, ${name}!`}let greetingTimerId=null;function scheduleGreetingUpdate(){if(greetingTimerId)return;const now=new Date();const next=new Date(now);next.setHours(next.getHours()+1,0,0,0);const delay=Math.max(0,next-now);greetingTimerId=setTimeout(()=>{greetingTimerId=null;renderGreeting()},delay)}function renderGreeting(){const greeting=$('heroGreeting');const title=$('heroDefaultTitle');if(!greeting||!title)return;const isAuthed=accountSession||sessionStorage.getItem('bca-guest-mode')==='true';greeting.hidden=!isAuthed;title.hidden=!!isAuthed;$('heroGreetName').textContent=getTimeBasedGreeting(getUserName(accountSession)||'there');if(isAuthed)scheduleGreetingUpdate()}
    function setAccountMode(mode){accountMode=mode;$('accountTitle').textContent=mode==='signup'?'Create your account':'Welcome back';$('accountDescription').textContent=mode==='signup'?'Sign in to keep your study activity connected across devices.':'Login to keep your study activity connected across devices.';$('accountSubmit').textContent=mode==='signup'?'Sign up':'Login';$('accountSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('accountMessage').textContent='';$('accountNameLabel').hidden=mode!=='signup';if(mode==='signup')$('accountName').setAttribute('required','');else $('accountName').removeAttribute('required')}
    function renderAccount(){const form=$('accountForm');if(accountSession){const name=getUserName(accountSession).replace(/</g,'&lt;');const identity=(accountSession.email||'Account connected').replace(/</g,'&lt;');$('accountAuth').innerHTML=`<h3>Hi ${name}!</h3><p>Signed in as ${identity}</p><div class="account-user"><span>${identity}</span><button class="secondary" type="button" onclick="signOutAccount()">Log out</button></div>`;return}if(!form)return;setAccountMode(accountMode)}
    async function signInWithProvider(provider,messageId='accountMessage'){if(!firebaseApp){$(messageId).textContent='Firebase is not configured.';return}try{if(provider==='google'){await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())}else if(provider==='apple'){const appleProvider=new firebase.auth.OAuthProvider('apple.com');appleProvider.addScope('email');appleProvider.addScope('name');await firebase.auth().signInWithPopup(appleProvider)}}catch(error){if(error.code==='auth/popup-closed-by-user'||error.code==='auth/cancelled-popup-request')return;$(messageId).textContent=error.message}}
    let gateMode='signup';
    function setGateMode(mode){gateMode=mode;$('gateAccountSubmit').textContent=mode==='signup'?'Sign up':'Login';$('gateAccountSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('gateAccountMessage').textContent='';$('gateNameLabel').hidden=mode!=='signup';if(mode==='signup')$('gateAccountName').setAttribute('required','');else $('gateAccountName').removeAttribute('required')}
    async function submitGateAccount(event){event.preventDefault();if(!firebaseApp){$('gateAccountMessage').textContent='Firebase is not configured.';return}$('gateAccountMessage').textContent='Working...';const email=$('gateAccountEmail').value.trim();const password=$('gateAccountPassword').value;try{if(gateMode==='signup'){authSuppress=true;const credential=await firebase.auth().createUserWithEmailAndPassword(email,password);const name=$('gateAccountName').value.trim();if(name)await credential.user.updateProfile({displayName:name});await credential.user.sendEmailVerification();await firebase.auth().signOut();authSuppress=false;setGateMode('login');$('gateAccountMessage').textContent='Account created. Check your email to verify, then login.';return}await firebase.auth().signInWithEmailAndPassword(email,password);accountSession=firebase.auth().currentUser;sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp()}catch(error){authSuppress=false;$('gateAccountMessage').textContent=error.message;return}}
    function showAuthenticatedApp(){$('authGate').hidden=true;$('appShell').hidden=false;$('appTabs').hidden=false;renderGreeting();renderAvatar();afterAccountAuth();setTimeout(showOnboardingIfNeeded,180)}
    function continueAsGuest(){sessionStorage.setItem('bca-guest-mode','true');showAuthenticatedApp();toast('Guest mode enabled')}
    function hideAuthenticatedApp(){$('authGate').hidden=false;$('appShell').hidden=true;$('appTabs').hidden=true;renderGreeting()}
    /* ================== Account-bound college & semester ==================
       Ab account (Firebase uid) ki ek server-side profile hoti hai (college +
       semester). Login par is profile se sync hota hai, taaki SAME account har
       device par SAME college + semester rakhe — 'DU laptop / Glocal phone'
       wala data-conflict ab possible nahi hai. Server = source of truth. */
    function accountUid(){return(accountSession&&accountSession.uid)?accountSession.uid:''}
    window.__bcaSessionUid=accountUid;
    async function syncProfileToAccount(){
      if(!supabaseClient||!accountUid())return;
      try{
        const {data}=await supabaseClient.from('user_profiles').select('college,semester').eq('uid',accountUid()).maybeSingle();
        if(data){
          let changed=false;
          if(data.college&&data.college!=='all'){state.college=data.college;try{localStorage.setItem('bca-college',data.college)}catch(e){}changed=true}
          if(data.semester!=null){state.sem=String(data.semester);state.year=data.semester>4?'3':(data.semester>2?'2':'1');try{localStorage.setItem('bca-sem',String(data.semester));localStorage.setItem('bca-year',state.year)}catch(e){}changed=true}
          if(changed){
            const lbl=$('collegeLabel');if(lbl)lbl.textContent=(colleges.find(c=>c[0]===state.college)||colleges[0])[1];
            try{$('yearFilter').value=state.year;updateSemesterOptions();const ss=$('semesterFilter');if(ss&&state.sem!=='all')ss.value=state.sem;}catch(e){}
            const ds=$('deskSemester');if(ds)ds.textContent=state.sem==='all'?'Explore your semester':`Semester ${state.sem} resources`;
            renderSubjectFilter();render();
          }
        }
      }catch(e){}
    }
    async function saveProfileToAccount(){
      if(!supabaseClient||!accountUid())return;
      const uid=accountUid();
      const sem=(state.sem&&state.sem!=='all')?Number(state.sem):null;
      const email=(accountSession&&accountSession.email)?accountSession.email:'';
      try{await supabaseClient.from('user_profiles').upsert({uid,email,college:state.college||'all',semester:sem,updated_at:new Date().toISOString()},{onConflict:'uid'})}catch(e){}
    }
    /* ================== WhatsApp-style new-device approval ==================
       Har device ka ek stable device_id (localStorage). Pehla device auto-
       approved (lockout na ho). Naye device par login -> pending -> kisi
       already-approved device par banner aata hai (Approve/Deny) -> approve
       hone par naya device unlock ho jata hai. */
    const getDeviceId=(()=>{let d='';try{d=localStorage.getItem('bca-device-id')}catch(e){}if(!d){d='dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);try{localStorage.setItem('bca-device-id',d)}catch(e){}}return d})();
    function getDeviceName(){const ua=navigator.userAgent;if(/iPhone|iPad|iPod/i.test(ua))return'iPhone/iPad';if(/Android/i.test(ua))return'Android phone';if(/Windows/i.test(ua))return'Windows laptop/PC';if(/Macintosh/i.test(ua))return'Mac';return'Browser device'}
    async function afterAccountAuth(){
      if(!supabaseClient||!accountUid())return;
      try{await syncProfileToAccount()}catch(e){}
      try{saveProfileToAccount()}catch(e){}
      try{await ensureDeviceApproved()}catch(e){}
      startDeviceRequestWatch();
    }
    async function ensureDeviceApproved(){
      if(!accountUid()||!supabaseClient)return true;
      const uid=accountUid(),devId=getDeviceId();
      try{
        const r1=await supabaseClient.from('device_sessions').select('status').eq('uid',uid).eq('device_id',devId).maybeSingle();
        const mine=r1.data;
        if(mine&&mine.status==='approved')return true;
        const r2=await supabaseClient.from('device_sessions').select('id').eq('uid',uid).eq('status','approved').limit(1);
        const anyApproved=r2.data;
        if(!anyApproved||!anyApproved.length){
          await supabaseClient.from('device_sessions').upsert({uid,device_id:devId,device_name:getDeviceName(),status:'approved',approved_at:new Date().toISOString()},{onConflict:'uid,device_id'});
          return true;
        }
        showDeviceGate(uid,devId);
        return false;
      }catch(e){return true} /* fail open: user ko kabhi lock-out mat karo */
    }
    let devicePollTimer=null;
    async function showDeviceGate(uid,devId){
      const modal=$('deviceGateModal');if(!modal)return;
      const code=('000000'+Math.floor(100000+Math.random()*900000)).slice(-6);
      modal.dataset.code=code;
      try{await supabaseClient.from('device_sessions').upsert({uid,device_id:devId,device_name:getDeviceName(),link_code:code,status:'pending'},{onConflict:'uid,device_id'})}catch(e){}
      const cEl=$('deviceCode');if(cEl)cEl.textContent=code;
      modal.classList.add('open');
      stopDevicePolling();
      devicePollTimer=setInterval(async()=>{
        try{
          const {data}=await supabaseClient.from('device_sessions').select('status').eq('uid',uid).eq('device_id',devId).maybeSingle();
          if(data&&data.status==='approved'){stopDevicePolling();modal.classList.remove('open');toast('Is device ka login approve ho gaya ✓')}
          else if(data&&data.status==='denied'){stopDevicePolling();modal.classList.remove('open');toast('Device request deny ho gaya')}
        }catch(e){}
      },3000);
    }
    function stopDevicePolling(){if(devicePollTimer){clearInterval(devicePollTimer);devicePollTimer=null}}
    function leaveDeviceGate(){stopDevicePolling();if(accountSession&&firebaseApp)signOutAccount()}
    /* Existing (approved) device: pending naye-device requests check karo + banner dikhao */
    let requestWatchTimer=null,currentRequestId=null;
    function startDeviceRequestWatch(){
      stopDeviceRequestWatch();
      if(!accountUid()||!supabaseClient)return;
      requestWatchTimer=setInterval(checkDeviceRequests,5000);
      checkDeviceRequests();
    }
    function stopDeviceRequestWatch(){if(requestWatchTimer){clearInterval(requestWatchTimer);requestWatchTimer=null}hideDeviceRequestBanner()}
    async function checkDeviceRequests(){
      if(!accountUid()||!supabaseClient)return;
      const uid=accountUid(),devId=getDeviceId();
      try{
        const {data}=await supabaseClient.from('device_sessions').select('id,device_name,link_code').eq('uid',uid).eq('status','pending').neq('device_id',devId).limit(1);
        if(data&&data.length){
          const req=data[0];
          if(currentRequestId!==String(req.id)){
            currentRequestId=String(req.id);
            const nm=$('deviceReqName');if(nm)nm.textContent=req.device_name||'naya device';
            const cd=$('deviceReqCode');if(cd)cd.textContent=req.link_code||'----';
            const bd=$('deviceReqId');if(bd)bd.value=String(req.id);
            const b=$('deviceRequestBanner');if(b)b.classList.add('show');
          }
        }else{hideDeviceRequestBanner();currentRequestId=null}
      }catch(e){}
    }
    function hideDeviceRequestBanner(){const b=$('deviceRequestBanner');if(b)b.classList.remove('show')}
    async function approveDeviceReq(){
      const id=$('deviceReqId');if(!id||!id.value)return;
      try{await supabaseClient.from('device_sessions').update({status:'approved',approved_at:new Date().toISOString()}).eq('id',id.value)}catch(e){}
      hideDeviceRequestBanner();currentRequestId=null;toast('Naya device approve ho gaya ✅');
    }
    async function denyDeviceReq(){
      const id=$('deviceReqId');if(!id||!id.value)return;
      try{await supabaseClient.from('device_sessions').update({status:'denied'}).eq('id',id.value)}catch(e){}
      hideDeviceRequestBanner();currentRequestId=null;toast('Request deny kar diya');
    }
    /* ================== WhatsApp-style QR login (desktop) ==================
       Desktop ek qr_login_sessions row banata hai (3 min expiry) aur approval
       ko Supabase Realtime broadcast + polling (fallback) dono se sunta hai.
       Logged-in phone QR ke URL (?qr=<id>) se approve karta hai — desktop
       automatic login + device approved. Single-use + expiry enforced. */
    const QR_TTL_MS=300000;
    let qrSession=null;
    function isDesktopViewport(){return window.matchMedia('(min-width:1024px)').matches}
    function newQrId(){try{if(crypto.randomUUID)return crypto.randomUUID()}catch(e){}return 'qr-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
    function setAuthMode(mode){
      const main=document.querySelector('.auth-main');if(!main)return;
      main.classList.toggle('mode-qr',mode==='qr');
      main.classList.toggle('mode-form',mode==='form');
      if(mode==='qr'&&isDesktopViewport())startQrSession();else stopQrSession();
    }
    function loadQrLib(){
      if(window.QRCode)return Promise.resolve(true);
      if(loadQrLib._p)return loadQrLib._p;
      loadQrLib._p=new Promise(res=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';s.onload=()=>res(true);s.onerror=()=>{loadQrLib._p=null;res(false)};document.head.appendChild(s)});
      return loadQrLib._p;
    }
    async function startQrSession(){
      stopQrSession();
      if(!supabaseClient){const st0=$('qrStatus');if(st0)st0.textContent='QR login ke liye connection nahi ban paya.';return}
      try{supabaseClient.from('qr_login_sessions').delete().lt('expires_at',new Date().toISOString()).then(()=>{},()=>{})}catch(e){}
      const id=newQrId();
      try{await supabaseClient.from('qr_login_sessions').insert({session_id:id,status:'pending',expires_at:new Date(Date.now()+QR_TTL_MS).toISOString()})}catch(e){}
      const exp=Math.floor((Date.now()+QR_TTL_MS)/1000);
      const payload=location.origin+location.pathname+'?qr='+encodeURIComponent(id)+'&e='+exp;
      qrSession={id,deadline:Date.now()+QR_TTL_MS};
      const box=$('qrBox');if(box)box.innerHTML='';
      const okLib=await loadQrLib();
      if(okLib&&window.QRCode&&box){try{new window.QRCode(box,{text:payload,width:188,height:188,colorDark:'#101216',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M})}catch(e){}}
      else if(box){box.innerHTML='<small style="display:block;max-width:190px;color:#333;font-size:11px">QR render nahi hua — phone par ye link kholo: '+payload+'</small>'}
      setQrUi('waiting');
      try{
        const ch=supabaseClient.channel('qr-'+id,{config:{broadcast:{self:false}}});
        ch.on('broadcast',{event:'LOGIN_SUCCESS'},msg=>qrHandleApproved(msg&&msg.payload));
        ch.on('broadcast',{event:'LOGIN_DENIED'},()=>qrHandleDenied());
        ch.subscribe(()=>{});
        qrSession.channel=ch;
      }catch(e){}
      qrSession.poll=setInterval(async()=>{
        try{
          const {data}=await supabaseClient.from('qr_login_sessions').select('status').eq('session_id',id).maybeSingle();
          if(!data)return;
          if(data.status==='approved')qrHandleApproved();
          else if(data.status==='denied')qrHandleDenied();
        }catch(e){}
      },2000);
      qrSession.tick=setInterval(()=>{
        if(!qrSession)return;
        const left=qrSession.deadline-Date.now();
        const tEl=$('qrTimer');
        if(tEl)tEl.textContent=(left>0?('0'+Math.floor(left/60000)).slice(-2)+':'+('0'+Math.floor(left%60000/1000)).slice(-2):'00:00');
        /* Auto-regenerate (WhatsApp Web style): expire hone par naya QR ban jata
           hai, taaki phone par late approval "code expired" dead-end na de. */
        if(left<=0){
          if(document.querySelector('.auth-main.mode-qr')&&isDesktopViewport()){
            const prev=qrSession?qrSession.id:null;
            startQrSession();
            if(prev)watchLegacyQr(prev);
          }
          else qrExpire();
        }
      },1000);
    }
    function setQrUi(state){
      const p=document.querySelector('.auth-qr-panel');
      if(p){p.classList.remove('is-waiting','is-expired','is-success','is-denied');p.classList.add('is-'+state)}
      const st=$('qrStatus');
      if(st)st.textContent=state==='waiting'?'Phone se scan karo — login turant ho jayega':state==='success'?'Login approved! Desk khul raha hai…':state==='expired'?'Code expire ho gaya — Refresh dabao':state==='denied'?'Request deny ho gayi':'';
      const rf=$('qrRefresh');if(rf)rf.hidden=state!=='expired';
    }
    function qrExpire(){setQrUi('expired')}
    function stopQrSession(){
      if(!qrSession)return;
      if(qrSession.poll)clearInterval(qrSession.poll);
      if(qrSession.tick)clearInterval(qrSession.tick);
      try{if(qrSession.channel)supabaseClient.removeChannel(qrSession.channel)}catch(e){}
      qrSession=null;
    }
    /* Purane (auto-refresh hue) session id ke liye chhota watcher — taaki
       agar phone ne abhi-abhi replace hue code ko approve kiya ho to wo
       approval bhi login me convert ho jaye, ignore na ho. */
    function watchLegacyQr(id){
      if(!supabaseClient||!id)return;
      const iv=setInterval(async()=>{
        try{
          const {data}=await supabaseClient.from('qr_login_sessions').select('status,expires_at,consumed_at,uid,email,display_name').eq('session_id',id).maybeSingle();
          if(data&&data.status==='approved'){
            clearInterval(iv);
            if(qrSession){qrSession.id=id;/* current session isi id ko adopt karo */}
            qrHandleApproved(data);
          }
        }catch(e){}
      },2000);
      setTimeout(()=>clearInterval(iv),60000);
    }
    async function qrHandleApproved(preRow){
      if(!qrSession||!supabaseClient)return;
      const id=qrSession.id;
      const stEl=$('qrStatus');
      const dbg=t=>{if(stEl)stEl.textContent='[QR] '+t};
      stopQrSession();
      try{
        dbg('approval mili, verify kar rahe hain…');
        /* Broadcast payload me status/expires_at nahi hote — sirf account
           info hoti hai. Isliye pehle DB se full row lene ki koshish karo,
           aur na mile (SELECT policy block) to payload se hi approve maano. */
        let dbRow=null;
        try{dbRow=(await supabaseClient.from('qr_login_sessions').select('status,expires_at,consumed_at,uid,email,display_name').eq('session_id',id).maybeSingle()).data}catch(e){}
        let row=dbRow;
        if(!row&&preRow&&(preRow.uid||preRow.display_name)){
          console.warn('[qr-login] row select nahi hui (SELECT policy missing?) — broadcast payload se login kar rahe hain');
          row={status:'approved',uid:preRow.uid||'',email:preRow.email||'',display_name:preRow.display_name||preRow.displayName||'',expires_at:null,consumed_at:null,__fromPayload:true,profile:preRow.profile,avatar:preRow.avatar};
        }
        if(!row&&preRow&&preRow.sessionId===id){
          /* Purana-style broadcast bina account info ke — DB row hi sach hai */
          row=dbRow;
        }
        /* 30s ka grace — sirf minor clock-skew/delay tolerate karo */
        const expired=row&&row.expires_at&&(Date.now()-new Date(row.expires_at).getTime()>30000);
        if(!row||row.status!=='approved'||row.consumed_at||expired){
          console.warn('[qr-login] approval verify fail:',{found:!!row,status:row&&row.status,consumed:!!(row&&row.consumed_at),expired});
          dbg('verify fail: '+(row?('status='+(row.status||'?')+(row.consumed_at?' (already used)':'')+(expired?' (expired)':'')):'row DB me nahi mili'));
          setQrUi('expired');return
        }
        dbg('verify OK, session set kar rahe hain…');
        await supabaseClient.from('qr_login_sessions').update({consumed_at:new Date().toISOString()}).eq('session_id',id);
        try{await supabaseClient.from('device_sessions').upsert({uid:row.uid,device_id:getDeviceId(),device_name:getDeviceName(),status:'approved',approved_at:new Date().toISOString()},{onConflict:'uid,device_id'})}catch(e){}
        sessionStorage.setItem('bca-qr-linked','true');
        sessionStorage.setItem('bca-qr-account',JSON.stringify({uid:row.uid,email:row.email||'',displayName:row.display_name||''}));
        accountSession={uid:row.uid,email:row.email||'',displayName:row.display_name||'',photoURL:null};
        /* Dusre device wala pura data apply karo — college, semester, avatar.
           (Server user_profiles bhi afterAccountAuth me sync hoti hai, ye
           instant local sync hai taaki dashboard turant personalized dikhe.) */
        try{
          if(row.profile){
            if(row.profile.college&&row.profile.college!=='all'){
              state.college=row.profile.college;
              try{localStorage.setItem('bca-college',row.profile.college)}catch(e){}
              const lbl=$('collegeLabel');if(lbl)lbl.textContent=(colleges.find(c=>c[0]===row.profile.college)||['',row.profile.college])[1];
            }
            if(row.profile.semester&&row.profile.semester!=='all'&&row.profile.semester!==''){
              state.sem=String(row.profile.semester);
              state.year=Number(row.profile.semester)>4?'3':(Number(row.profile.semester)>2?'2':'1');
              try{localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-year',state.year)}catch(e){}
            }
          }
          if(row.avatar){try{localStorage.setItem('bca-avatar',row.avatar)}catch(e){}}
        }catch(e){}
        setQrUi('success');
        setTimeout(()=>{
          try{
            sessionStorage.removeItem('bca-guest-mode');
            showAuthenticatedApp();
            /* Verify: dashboard sach me khula? */
            setTimeout(()=>{
              const shell=document.getElementById('appShell');
              if(!shell||shell.hidden){dbg('Dashboard nahi khula — appShell hidden hai. Console check karo.');console.error('[qr-login] appShell still hidden after showAuthenticatedApp')}
            },400);
          }catch(err){
            console.error('[qr-login] showAuthenticatedApp error:',err);
            dbg('Dashboard open error: '+err.message);
          }
        },900);
      }catch(e){console.error('[qr-login] handshake error:',e);setQrUi('expired');const s=$('qrStatus');if(s)s.textContent='[QR] Error: '+((e&&e.message)||'unknown')}
    }
    function qrHandleDenied(){stopQrSession();setQrUi('denied')}
    function restoreQrSession(){try{const raw=sessionStorage.getItem('bca-qr-account');if(!raw)return false;const a=JSON.parse(raw);if(a&&a.uid){accountSession={uid:a.uid,email:a.email||'',displayName:a.displayName||'',photoURL:null};return true}}catch(e){}return false}
    /* ---- Phone side: QR scan ke baad ?qr= param se approval ---- */
    function readQrParam(){
      let id=null;
      try{const p=new URLSearchParams(location.search);id=p.get('qr');if(id)history.replaceState({},'',location.pathname)}catch(e){}
      return id;
    }
    function maybePromptQrApproval(id){
      if(!supabaseClient||!id)return;
      if(accountUid()){
        sessionStorage.setItem('bca-active-qr',id);
        const m=$('qrApproveModal');if(m)m.classList.add('open');
      }else{
        sessionStorage.setItem('bca-pending-qr',id);
        const g=$('gateAccountMessage');if(g)g.textContent='Computer login approve karne ke liye pehle is phone par login karo.';
      }
    }
    async function confirmQrLogin(){
      const id=sessionStorage.getItem('bca-active-qr');
      if(!id||!accountUid()||!supabaseClient)return;
      const msg=$('qrApproveMsg');
      /* Pehle row verify karo — expired/consumed/denied session ko approve
         karne se desktop par fake "expired" nahi dikhega, phone ko seedha
         sahi message milega. */
      let row=null,rowErr=null;
      try{const r=await supabaseClient.from('qr_login_sessions').select('status,expires_at,consumed_at').eq('session_id',id).maybeSingle();row=r.data;rowErr=r.error}catch(e){rowErr=e}
      /* NOTE: agar live DB me SELECT policy missing hai to row null ayega —
         hum yahin rukte nahi, approve + broadcast aage karte hain (fallback). */
      if(!rowErr&&row){
        if(row.status==='denied'){if(msg)msg.textContent='Ye request deny ho chuki hai — computer par naya code generate karo.';return}
        if(row.consumed_at){if(msg)msg.textContent='Ye code already use ho chuka hai — computer par naya code scan karo.';return}
        if(row.expires_at&&new Date(row.expires_at)<new Date()){if(msg)msg.textContent='Code expire ho gaya — computer par naya QR aya hai, usse dobara scan karo.';return}
      }else if(rowErr){
        console.warn('[qr-login] phone-side select fail (SELECT policy?), fallback to broadcast:',rowErr);
      }
      /* Approve karte waqt expires_at thoda aage badha do taaki desktop ko
         poll/broadcast pakadne ka buffer mil jaye.
         IMPORTANT: DB update me sirf table ke asli columns — profile/avatar
         sirf broadcast payload me jaate hain (DB me unke columns nahi hain). */
      const acct={uid:accountUid(),email:(accountSession&&accountSession.email)||'',display_name:getUserName(accountSession),device_name:getDeviceName()};
      const dbUpdate=Object.assign({status:'approved'},acct,{expires_at:new Date(Date.now()+120000).toISOString()});
      try{
        acct.profile={college:localStorage.getItem('bca-college')||'all',semester:localStorage.getItem('bca-sem')||''};
        const av=localStorage.getItem('bca-avatar')||'';
        if(av&&av.length<=150000)acct.avatar=av; /* chhota avatar hi bhejo (payload limit) */
      }catch(e){}
      const {error}=await supabaseClient.from('qr_login_sessions').update(dbUpdate).eq('session_id',id);
      if(error){console.error('[qr-login] approve update fail:',error);if(msg)msg.textContent='Approve nahi ho paya — shayad computer band ho gaya.';return}
      sendQrBroadcast(id,'LOGIN_SUCCESS',acct);
      if(msg)msg.textContent='Approved ✅ Computer me login ho gaya.';
      setTimeout(()=>{const m=$('qrApproveModal');if(m)m.classList.remove('open');sessionStorage.removeItem('bca-active-qr')},1600);
    }
    async function denyQrLogin(){
      const id=sessionStorage.getItem('bca-active-qr');
      if(id&&supabaseClient){try{await supabaseClient.from('qr_login_sessions').update({status:'denied'}).eq('session_id',id)}catch(e){}sendQrBroadcast(id,'LOGIN_DENIED')}
      const m=$('qrApproveModal');if(m)m.classList.remove('open');
      sessionStorage.removeItem('bca-active-qr');
    }
    function sendQrBroadcast(id,event,payload){
      payload=payload||{};
      return new Promise(res=>{try{
        const ch=supabaseClient.channel('qr-'+id);
        const to=setTimeout(()=>{try{supabaseClient.removeChannel(ch)}catch(e){}res(false)},4000);
        ch.subscribe(status=>{if(status==='SUBSCRIBED'){ch.send({type:'broadcast',event,payload:Object.assign({sessionId:id},payload)}).then(()=>{clearTimeout(to);try{supabaseClient.removeChannel(ch)}catch(e){}res(true)}).catch(()=>{clearTimeout(to);try{supabaseClient.removeChannel(ch)}catch(e){}res(false)})}});
      }catch(e){res(false)}});
    }
    function maybeStartQrLogin(){if(isDesktopViewport()&&!accountUid()&&sessionStorage.getItem('bca-guest-mode')!=='true'&&sessionStorage.getItem('bca-qr-linked')!=='true')setAuthMode('qr')}
    async function submitAccount(event){event.preventDefault();if(!firebaseApp){$('accountMessage').textContent='Firebase is not configured.';return}const email=$('accountEmail').value.trim();const password=$('accountPassword').value;try{if(accountMode==='signup'){authSuppress=true;const credential=await firebase.auth().createUserWithEmailAndPassword(email,password);const name=$('accountName').value.trim();if(name)await credential.user.updateProfile({displayName:name});await credential.user.sendEmailVerification();await firebase.auth().signOut();authSuppress=false;setAccountMode('login');$('accountMessage').textContent='Account created. Check your email to verify, then login.';return}await firebase.auth().signInWithEmailAndPassword(email,password);accountSession=firebase.auth().currentUser;sessionStorage.removeItem('bca-guest-mode');renderGreeting();renderAccount();toast('Account connected')}catch(error){authSuppress=false;$('accountMessage').textContent=error.message;return}}
    async function signOutAccount(){await firebase.auth().signOut();accountSession=null;try{stopQrSession();sessionStorage.removeItem('bca-qr-linked');sessionStorage.removeItem('bca-qr-account')}catch(e){}hideAuthenticatedApp();$('accountAuth').innerHTML='<h3 id="accountTitle"></h3><p id="accountDescription"></p><form class="account-form" id="accountForm"><label id="accountNameLabel">Name<input id="accountName" type="text" autocomplete="name"></label><label>Email<input id="accountEmail" type="email" autocomplete="email" required></label><label>Password<input id="accountPassword" type="password" autocomplete="current-password" minlength="6" required></label><button class="primary" id="accountSubmit" type="submit"></button></form><div class="oauth-actions"><button class="oauth-button" type="button" onclick="signInWithProvider(\'google\')"><i class="fa-brands fa-google"></i> Continue with Google</button><button class="oauth-button" type="button" onclick="signInWithProvider(\'apple\')"><i class="fa-brands fa-apple"></i> Continue with Apple</button></div><p class="account-message" id="accountMessage" aria-live="polite"></p><button class="account-switch" id="accountSwitch" type="button"></button>';bindAccountForm();renderAccount();toast('Logged out');setTimeout(maybeStartQrLogin,80)}
    function bindAccountForm(){$('accountForm').addEventListener('submit',submitAccount);$('accountSwitch').addEventListener('click',()=>setAccountMode(accountMode==='signup'?'login':'signup'))}
    function openCollege(){renderColleges();$('collegeModal').classList.add('open')};function openProfile(){$('profileCollege').textContent=(colleges.find(c=>c[0]===state.college)||colleges[0])[1];$('profileSaved').textContent=state.saved.length;$('profileUploads').textContent=JSON.parse(localStorage.getItem('bca-uploads')||'[]').length;renderAvatar();renderAccount();renderMyUploads();$('profileModal').classList.add('open')};function openUpload(){if(!requireAccount('Sign up or login to upload study material.','upload'))return;const fileBox=document.querySelector('.file-box');if(fileBox)fileBox.style.borderColor='var(--brand)';$('uploadModal').classList.add('open');updateUploadSubjects()};function closeModals(){const dg=$('deviceGateModal');document.querySelectorAll('.modal').forEach(m=>{if(m!==dg)m.classList.remove('open')});closeSuggestions();const pb=$('previewBody');if(pb)pb.innerHTML=''}
    function getAvatar(){const saved=localStorage.getItem('bca-avatar');if(saved)return saved;if(accountSession&&accountSession.photoURL)return accountSession.photoURL;return initialsAvatar(accountSession?getUserName(accountSession):'Guest')}
    function initialsAvatar(name){const letter=((name||'S').trim().charAt(0).toUpperCase()||'S');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="60" fill="#23808f"/><text x="60" y="79" font-family="Arial,sans-serif" font-size="54" font-weight="700" text-anchor="middle" fill="#ffffff">${letter}</text></svg>`;return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg)}
    function renderAvatar(){const img=$('avatarImg');if(!img)return;img.src=getAvatar();const nameEl=$('profileIdName');if(nameEl)nameEl.textContent=accountSession?getUserName(accountSession):'Guest';const mailEl=$('profileIdMail');if(mailEl)mailEl.textContent=accountSession&&accountSession.email?accountSession.email:'Browsing as guest';const tb=$('topbarAvatar');if(tb)tb.src=getAvatar()}
    function changeAvatar(input){const f=input.files&&input.files[0];if(!f)return;if(!/^image\//.test(f.type)){toast('Please choose an image file');input.value='';return}if(f.size>2*1024*1024){toast('Pick an image under 2 MB');input.value='';return}const reader=new FileReader();reader.onload=()=>{localStorage.setItem('bca-avatar',reader.result);renderAvatar();toast('Profile photo updated')};reader.readAsDataURL(f);input.value=''}
    function toggleProfileCard(event){if(event)event.stopPropagation();const pop=$('profilePop');if(!pop)return;const willShow=pop.hidden;if(willShow){const av=$('popAvatar');if(av)av.src=getAvatar();const n=$('popName');if(n)n.textContent=accountSession?getUserName(accountSession):'Guest';const m=$('popMail');if(m)m.textContent=accountSession&&accountSession.email?accountSession.email:'Browsing as guest';const c=$('popCollege');if(c)c.textContent=(colleges.find(cc=>cc[0]===state.college)||colleges[0])[1];const s=$('popSem');if(s)s.textContent=state.sem==='all'?'All semesters':'Semester '+state.sem;}pop.hidden=!willShow}
    function hideProfileCard(){const pop=$('profilePop');if(pop&&!pop.hidden)pop.hidden=true}
    function logoutFromPop(){hideProfileCard();if(firebaseApp&&accountSession){signOutAccount();return}sessionStorage.removeItem('bca-guest-mode');accountSession=null;hideAuthenticatedApp();toast('Logged out')}
    function renderColleges(query=''){const q=query.toLowerCase();const ranked=[...colleges].sort((a,b)=>{if(a[0]==='all')return -1;if(b[0]==='all')return 1;const order=['ccsu','du','ipu','aktu','ignou','mdu','bhu','pune','bangalore'];const aIndex=order.indexOf(a[0]);const bIndex=order.indexOf(b[0]);if(aIndex!==-1||bIndex!==-1){if(aIndex===-1)return 1;if(bIndex===-1)return -1;return aIndex-bIndex}return a[1].localeCompare(b[1])});$('collegeList').innerHTML=ranked.filter(c=>c[1].toLowerCase().includes(q)).map(c=>`<button class="college-option ${state.college===c[0]?'selected':''}" onclick="selectCollege('${c[0]}')"><span><b>${c[1]}</b><small>BCA resources</small></span><i class="fa-solid ${state.college===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function selectCollege(id){state.college=id;localStorage.setItem('bca-college',id);$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||['',id])[1];closeModals();renderSubjectFilter();render();saveProfileToAccount()}
    function useCustomCollege(){const input=$('collegeCustom');const name=input.value.trim();if(!name){input.focus();return}const college=['custom-'+Date.now(),name];colleges.push(college);localStorage.setItem('bca-custom-colleges',JSON.stringify([...JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]'),college]));input.value='';selectCollege(college[0])}
    function showFile(input){if(input.files[0])$('fileName').textContent=input.files[0].name}
    function previewResource(id){const resource=resources.find(item=>item.title.replace(/\W/g,'')===id);if(!resource)return;const src=resource.fileUrl||resource.fileData;if(!src){toast('Preview not available for this demo item');return}
      $('previewTitle').textContent=resource.title;
      const kindLabel=resource.type==='pyq'?'Previous year paper':'Notes';
      $('previewMeta').textContent=`${kindLabel} · Semester ${resource.sem}${resource.fileName?' · '+resource.fileName:''}`;
      const body=$('previewBody');body.innerHTML='';
      const lower=((resource.fileName||'')+' '+src.split('?')[0].split('#')[0]).toLowerCase();
      if(src.startsWith('data:image')||/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lower)){
        const img=document.createElement('img');img.className='preview-image';img.src=src;img.alt=resource.title;body.appendChild(img);
      }else if(src.startsWith('data:application/pdf')||/\.pdf(\?|$)/.test(lower)){
        const frame=document.createElement('iframe');frame.className='preview-embed';frame.src=src;frame.setAttribute('title',resource.title);body.appendChild(frame);
      }else{
        body.innerHTML='<div class="preview-fallback"><i class="fa-solid fa-file-circle-question"></i><strong>Inline preview is not available for this format</strong><small>Use the Open full file button below to view or download it.</small></div>';
      }
      $('previewOpenLink').href=src;
      trackEvent('view',{title:resource.title,type:resource.type,subject:resource.subject,sem:resource.sem});
      $('previewModal').classList.add('open');
    }
    function createLocalUploadRecord(file, upload){return {title:upload.title,type:upload.type,sem:upload.sem,year:upload.year,subject:upload.subject,college:upload.college,uploader:upload.uploader||'Anonymous',date:'Just now',downloads:0,fileName:file.name,fileData:upload.fileData||'',status:upload.status||'pending'}}
    async function uploadResourceToSupabase(file, upload){
      if(!supabaseClient){throw new Error('Supabase client is not available');}
      const safeTitle=(upload.title||'resource').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'resource';
      const filePath=`${upload.type}/${upload.sem}/${Date.now()}-${safeTitle}-${file.name.replace(/\s+/g,'-')}`;
      const {data:storageData,error:storageError}=await supabaseClient.storage.from('resources').upload(filePath,file,{cacheControl:'3600',upsert:false,contentType:file.type || 'application/octet-stream'});
      if(storageError) throw storageError;
      const {data:publicData}=supabaseClient.storage.from('resources').getPublicUrl(storageData.path);
      const row={title:upload.title,type:upload.type,subject:upload.subject,college:upload.college,semester:upload.sem,year:upload.year,file_name:file.name,file_url:publicData.publicUrl,status:'pending',downloads:0,uploader_email:upload.uploaderEmail||''};
      const {error:insertError}=await supabaseClient.from('resources').insert(row);
      if(insertError) throw insertError;
      return {...row,title:row.title,type:row.type,sem:row.semester,fileUrl:row.file_url,downloads:0,status:row.status,fileName:file.name,subject:row.subject,college:row.college};
    }
    function getUploaderEmail(){return accountSession&&accountSession.email?accountSession.email:''}
    /* ---- Duplicate upload guard ----
       Same title + semester + college combination pehle se ho (pending ya
       approved) to naya upload rok deta hai. */
    async function findExistingUpload(payload){
      if(!supabaseClient)return null;
      try{
        const {data,error}=await supabaseClient.from('resources')
          .select('id,title,status')
          .eq('title',payload.title)
          .eq('semester',payload.sem)
          .eq('college',payload.college)
          .limit(1);
        if(error)return null;
        return data&&data.length?data[0]:null;
      }catch(error){return null}
    }
    function isLocalDuplicate(payload){
      const uploads=JSON.parse(localStorage.getItem('bca-uploads')||'[]');
      return uploads.some(item=>
        normSubject(item.title)===normSubject(payload.title)&&
        Number(item.sem)===payload.sem&&
        item.college===payload.college&&
        (item.status||'pending')!=='rejected'
      );
    }
    async function loadMyUploads(){try{const email=getUploaderEmail();if(!supabaseClient||!email)return[];const {data,error}=await supabaseClient.from('resources').select('id,title,type,status,semester,file_name,created_at,downloads').eq('uploader_email',email).order('created_at',{ascending:false});if(error)return[];return data||[]}catch(error){return[]}}
    async function renderMyUploads(){
      const listEl=$('myUploadsList');const summaryEl=$('myUploadsSummary');if(!listEl)return;
      if(!getUploaderEmail()){summaryEl.textContent='';listEl.innerHTML='<p class="my-uploads-empty">Login to track your uploads and review status.</p>';return}
      const items=await loadMyUploads();
      const pending=items.filter(item=>item.status==='pending').length;
      const approved=items.filter(item=>item.status==='approved').length;
      summaryEl.textContent=`${items.length} total · ${pending} in review · ${approved} live`;
      if(!items.length){listEl.innerHTML='<p class="my-uploads-empty">No uploads yet. Share your first note or PYQ!</p>';return}
      const labels={pending:'In review',approved:'Live',rejected:'Rejected',archived:'Archived'};
      listEl.innerHTML=items.map(item=>`<div class="my-upload-item"><div><strong>${String(item.title).replace(/[<>&"]/g,'')}</strong><small>Semester ${item.semester} · ${item.type==='pyq'?'PYQ':'Notes'} · ${new Date(item.created_at).toLocaleDateString()}</small></div><span class="my-upload-badge ${item.status}">${labels[item.status]||item.status}</span></div>`).join('');
    }
    function startLibrarySync(){
      if(!supabaseClient)return;
      try{const channel=supabaseClient.channel('resources-live').on('postgres_changes',{event:'*',schema:'public',table:'resources'},()=>loadCloudResources());channel.subscribe()}catch(error){}
      setInterval(()=>{if(document.visibilityState==='visible')loadCloudResources()},30000);
    }
    async function submitUpload(event){
      try{
      event.preventDefault();
      const form=event.target;
      const file=$('file').files[0];
      if(!file){toast('Choose a file first');return;}
      const title=form.querySelector('input[name="title"]').value.trim();
      const sem=Number(form.querySelector('select[name="semester"]').value);
      const type=form.querySelector('select[name="type"]').value.toLowerCase();
      // Subject: pick from list, or take the custom name when "__other" is chosen
      const subjectSel=form.querySelector('select[name="subjectSelect"]');
      let subject=subjectSel&&subjectSel.value&&subjectSel.value!=='__other'?subjectSel.value:'';
      if(subjectSel&&subjectSel.value==='__other'){
        const customInput=form.querySelector('input[name="customSubject"]');
        subject=customInput?customInput.value.trim():'';
        if(subject)addCustomSubject(sem,subject);
      }
      subject=subject||'Community upload';
      // Backwards compatibility: purane cached HTML mein link field ho sakta hai
      if(subject==='Community upload'){const linkInput=form.querySelector('input[name="link"]');if(linkInput&&linkInput.value.trim())subject=linkInput.value.trim();}
      const payload={title,type,sem,year:Math.ceil(sem/2),subject:subject || 'Community upload',college:state.college,status:'pending',uploader:accountSession?getUserName(accountSession):'Anonymous',uploaderEmail:accountSession&&accountSession.email?accountSession.email:''};
      // Duplicate guard: same title + semester + college pehle se hai to rok do
      let existing=null;
      try{existing=await findExistingUpload(payload)}catch(error){}
      if(existing){toast('Duplicate! Ye material pehle se upload ho chuka hai ('+existing.status+')');return}
      if(isLocalDuplicate(payload)){toast('Duplicate! Ye material aapne pehle hi submit kiya hai — review mein hai');return}
      const reader=new FileReader();
      reader.onload=async ()=>{
        try {
          const fileData = reader.result;
          const cloudUpload=await uploadResourceToSupabase(file,{...payload,fileData});
          const uploadRecord={...cloudUpload,title:cloudUpload.title,type:cloudUpload.type,sem:cloudUpload.sem,year:cloudUpload.year,subject:cloudUpload.subject,college:cloudUpload.college,date:'Just now',downloads:0,fileName:file.name,fileData:fileData,status:'pending',uploader:payload.uploader};
          resources.unshift(uploadRecord);
          trackEvent('upload',{title:uploadRecord.title,type:uploadRecord.type,subject:uploadRecord.subject,sem:uploadRecord.sem});
          const uploads=JSON.parse(localStorage.getItem('bca-uploads')||'[]').filter(resource=>resource.type==='notes'||resource.type==='pyq');
          uploads.unshift(uploadRecord);
          localStorage.setItem('bca-uploads',JSON.stringify(uploads));
          closeModals();
          form.reset();
          $('fileName').textContent='Choose a PDF, DOCX or ZIP file';
          render();
          showUploadSuccess(type);
          renderMyUploads();
        } catch (error) {
          const localUpload=createLocalUploadRecord(file,{...payload,fileData:reader.result,status:'pending'});
          resources.unshift(localUpload);
          const uploads=JSON.parse(localStorage.getItem('bca-uploads')||'[]').filter(resource=>resource.type==='notes'||resource.type==='pyq');
          uploads.unshift(localUpload);
          localStorage.setItem('bca-uploads',JSON.stringify(uploads));
          closeModals();
          form.reset();
          $('fileName').textContent='Choose a PDF, DOCX or ZIP file';
          render();
          showUploadSuccess(type);
        }
      };
      reader.readAsDataURL(file);
      }catch(error){
        console.error('[BCAPrime] Upload error:',error);
        toast('Upload problem: '+(error&&error.message||error));
      }
    }
    /* ---- Upload success celebration ---- */
    function showUploadSuccess(kind){
      const overlay=$('uploadSuccess');
      if(!overlay){toast('Uploaded for review');return}
      const text=$('uploadSuccessText');
      if(text)text.textContent=(kind==='pyq'?'Aapka PYQ':'Aapke notes')+' successfully upload ho gaye hain!';
      // Restart animations on every upload
      overlay.classList.remove('open');
      void overlay.offsetWidth;
      overlay.classList.add('open');
    }
    function closeUploadSuccess(){const overlay=$('uploadSuccess');if(overlay)overlay.classList.remove('open')}
    window.closeUploadSuccess=closeUploadSuccess;
    function resetPreferences(){
      if(!confirm('Reset all preferences? This clears saved items, your uploads list, college and theme on this device.'))return;
      const keys=['bca-onboarded','bca-tour-seen','bca-college','bca-sem','bca-year','bca-saved','bca-custom-colleges','bca-uploads','bca-theme'];
      keys.forEach(key=>localStorage.removeItem(key));
      location.reload();
    }
    function toast(message){const node=document.createElement('div');node.className='toast';node.textContent=message;$('toastRoot').append(node);setTimeout(()=>node.remove(),2300)}
    async function initAccount(){if(sessionStorage.getItem('bca-guest-mode')==='true')showAuthenticatedApp();let __pendQr=null;if(!firebaseApp){$('gateAccountMessage').textContent='Firebase is not configured.';}else{accountSession=firebase.auth().currentUser;if(!accountSession)restoreQrSession();if(accountSession){sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp()}__pendQr=readQrParam();firebase.auth().onAuthStateChanged(user=>{const qrLinked=sessionStorage.getItem('bca-qr-linked')==='true';/* QR synthetic session ko Firebase ke null user se overwrite hone se bachao */accountSession=user||(qrLinked&&accountSession&&accountSession.uid?accountSession:null);if(authSuppress)return;if(user){sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp();resumeRestrictedAction();const pq=sessionStorage.getItem('bca-pending-qr');if(pq){sessionStorage.removeItem('bca-pending-qr');setTimeout(()=>maybePromptQrApproval(pq),400)}}else if(sessionStorage.getItem('bca-guest-mode')!=='true'&&sessionStorage.getItem('bca-qr-linked')!=='true')hideAuthenticatedApp();if($('profileModal').classList.contains('open'))renderAccount()})}if(__pendQr)setTimeout(()=>maybePromptQrApproval(__pendQr),400);maybeStartQrLogin()}
    document.addEventListener('click',e=>{if(e.target.classList.contains('modal'))closeModals(); if(!e.target.closest('.hero-search'))closeSuggestions(); if(!e.target.closest('.profile-pop')&&!e.target.closest('#topbarAvatarBtn'))hideProfileCard();});window.addEventListener('DOMContentLoaded',()=>{init();trackEvent('visit');bindAccountForm();startLibrarySync();setGateMode(gateMode);$('gateAccountForm').addEventListener('submit',submitGateAccount);$('gateAccountSwitch').addEventListener('click',()=>setGateMode(gateMode==='signup'?'login':'signup'));$('accessAuthForm').addEventListener('submit',submitAccessAuth);$('accessAuthSwitch').addEventListener('click',()=>setAccessAuthMode(accessAuthMode==='signup'?'login':'signup'));initAccount()});
    function showOnboarding(){if(localStorage.getItem('bca-onboarded'))return;state.onboardingDone=false;state.onboardingSem='';renderOnboardingColleges();const track=$('obTrack');if(track)track.classList.remove('step2');$('onboarding').classList.add('open')}
    function showOnboardingIfNeeded(){if(localStorage.getItem('bca-onboarded')){if(localStorage.getItem('bca-tour-seen')!=='true')setTimeout(startTour,200);return}if(accountSession||sessionStorage.getItem('bca-guest-mode')==='true')showOnboarding()}
    function renderOnboardingColleges(){const options=colleges.filter(c=>c[0]!=='other');$('onboardingList').innerHTML=options.map(c=>`<button class="onboarding-option ${state.onboardingCollege===c[0]?'selected':''}" onclick="chooseOnboardingCollege('${c[0]}')"><span><b>${c[1]}</b><small>BCA resources</small></span><i class="fa-solid ${state.onboardingCollege===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function chooseOnboardingCollege(id){state.onboardingCollege=id;renderOnboardingColleges();state.onboardingSem='';document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));const track=$('obTrack');if(track)track.classList.add('step2')}
    function backToOnboardingCollege(){state.onboardingSem='';document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));renderOnboardingColleges();const track=$('obTrack');if(track)track.classList.remove('step2')}
    function chooseOnboardingSemester(sem,button){state.onboardingSem=String(sem);document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');if(state.onboardingCollege&&!state.onboardingDone)setTimeout(()=>finishOnboarding(),400)}
    function ensureCollegeOption(id){const college=colleges.find(c=>c[0]===id);const cf=$('collegeFilter');if(!college||!cf||cf.querySelector(`option[value="${id}"]`))return;const option=document.createElement('option');option.value=college[0];option.textContent=college[1];cf.append(option)}
    function completeOnboarding(id){if(state.onboardingDone)return;state.onboardingDone=true;state.college=id;state.sem=state.onboardingSem||'1';state.year=String(Math.ceil(Number(state.sem)/2)||1);try{localStorage.setItem('bca-college',id);localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-onboarded','true')}catch(error){console.warn('Could not save preferences.',error)}try{$('onboarding').classList.remove('open')}catch(error){}try{$('yearFilter').value=state.year;updateSemesterOptions();$('semesterFilter').value=state.sem;$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||colleges[0])[1];$('deskSemester').textContent=`Semester ${state.sem} resources`;renderSubjectFilter();render()}catch(error){console.warn('Library refresh skipped.',error)}saveProfileToAccount();setTimeout(startTour,200)}
    function finishOnboarding(){if(state.onboardingDone)return;if(!state.onboardingCollege){toast('Choose your college first');return}if(!state.onboardingSem){toast('Choose your semester first');return}completeOnboarding(state.onboardingCollege)}
    function addOnboardingCollege(){const input=$('onboardingCustom');const name=input.value.trim();if(!name){input.focus();return}const id='custom-'+Date.now();const college=[id,name];colleges.push(college);localStorage.setItem('bca-custom-colleges',JSON.stringify([...JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]'),college]));input.value='';chooseOnboardingCollege(id)}
    const tourSteps=[
      {icon:'fa-magnifying-glass',title:'Search anything',text:'Find notes, question papers and study material for any subject with one quick search.'},
      {icon:'fa-sliders',title:'Smart filters',text:'Narrow results by your college, year, semester and material type in seconds.'},
      {icon:'fa-layer-group',title:'Semester shelf',text:'Tap your semester to jump straight into the material your syllabus needs.'},
      {icon:'fa-bookmark',title:'Save & download',text:'Bookmark favourites and download files to study anytime, even offline.'}
    ];
    let tourIndex=0;
    function startTour(){
      try{if(localStorage.getItem('bca-tour-seen')==='true')return}catch(error){}
      try{if($('onboarding').classList.contains('open'))return}catch(error){}
      try{$('tour').hidden=false;document.body.style.overflow='hidden'}catch(error){try{localStorage.setItem('bca-tour-seen','true')}catch(ignored){}return}
      tourIndex=0;renderTourStep()
    }
    function renderTourStep(){
      const step=tourSteps[tourIndex]||tourSteps[0];
      try{
        $('tourIcon').className=`fa-solid ${step.icon}`;
        $('tourTitle').textContent=step.title;
        $('tourText').textContent=step.text;
        $('tourBack').hidden=tourIndex===0;
        $('tourNext').innerHTML=tourIndex===tourSteps.length-1?'Get started <i class="fa-solid fa-check"></i>':'Next <i class="fa-solid fa-arrow-right"></i>';
        $('tourDots').innerHTML=tourSteps.map((item,index)=>`<span class="${index===tourIndex?'active':''}"></span>`).join('');
        const stage=$('tourStage');if(stage){stage.classList.remove('slide-in');void stage.offsetWidth;stage.classList.add('slide-in')}
      }catch(error){console.warn('Tour step skipped.',error)}
    }
    function nextTourStep(){if(tourIndex>=tourSteps.length-1){finishTour();return}tourIndex+=1;renderTourStep()}
    function previousTourStep(){if(tourIndex<=0)return;tourIndex-=1;renderTourStep()}
    function finishTour(){try{localStorage.setItem('bca-tour-seen','true')}catch(error){}try{$('tour').hidden=true}catch(error){}try{document.body.style.overflow=''}catch(error){}}
    function skipTour(){finishTour()}
    (function bindTourGestures(){
      let startX=0;
      const active=()=>{const t=$('tour');return t&&!t.hidden};
      document.addEventListener('touchstart',event=>{if(active())startX=event.touches[0].clientX},{passive:true});
      document.addEventListener('touchend',event=>{if(!active())return;const delta=event.changedTouches[0].clientX-startX;if(Math.abs(delta)<50)return;if(delta<0)nextTourStep();else previousTourStep()},{passive:true});
      document.addEventListener('keydown',event=>{if(!active())return;if(event.key==='ArrowRight')nextTourStep();else if(event.key==='ArrowLeft')previousTourStep();else if(event.key==='Escape')skipTour()});
    })();
    new MutationObserver(() => {
      if (!$('onboarding').classList.contains('open') && localStorage.getItem('bca-onboarded') === 'true' && localStorage.getItem('bca-tour-seen') !== 'true') {
        setTimeout(startTour, 200);
      }
    }).observe($('onboarding'), { attributes: true, attributeFilter: ['class'] });
    let deferredInstallPrompt;
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $('installButton').hidden = false;
      $('footerInstallButton').hidden = false;
      setTimeout(() => {
        if (deferredInstallPrompt) $('installBanner').classList.add('show');
      }, 3000);
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      $('installButton').hidden = true;
      $('footerInstallButton').hidden = true;
      $('installBanner').classList.remove('show');
      toast('BCAPrime installed');
    });
    async function installApp(){
      if (!deferredInstallPrompt) return;
      $('installBanner').classList.remove('show');
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $('installButton').hidden = true;
      $('footerInstallButton').hidden = true;
    }
    function dismissInstallBanner(){
      $('installBanner').classList.remove('show');
    }
    if ('serviceWorker' in navigator) {
      /* ===== PWA Auto-update =====
         Har load par + har ghante + tab wapas khulne par update check hota hai.
         Naya SW install hote hi (skipWaiting) controller badal jata hai aur page
         ek baar khud reload ho jata hai — installed PWA users ko naya code milta
         rehta hai bina manual kuch kiye. */
      let __bcaReloading=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(__bcaReloading)return;
        __bcaReloading=true;
        try{sessionStorage.setItem('bca-auto-updated','true')}catch(e){}
        location.reload();
      });
      window.addEventListener('load',()=>{
        navigator.serviceWorker.register('./sw.js').then(reg=>{
          const check=()=>{try{reg.update().catch(()=>{})}catch(e){}};
          check();
          setInterval(check,3600000); /* har 1 ghante */
          document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
          reg.addEventListener('updatefound',()=>{
            const nw=reg.installing;if(!nw)return;
            nw.addEventListener('statechange',()=>{
              if(nw.state==='installed'&&navigator.serviceWorker.controller)console.info('[BCAPrime] naya version install ho raha hai…');
            });
          });
        }).catch(error => console.info('PWA service worker unavailable.', error.message));
      });
      try{if(sessionStorage.getItem('bca-auto-updated')==='true'){sessionStorage.removeItem('bca-auto-updated');setTimeout(()=>toast('App updated ✅'),1200)}}catch(e){}
    }
    setTimeout(() => {
      showOnboardingIfNeeded();
    }, 1200);
