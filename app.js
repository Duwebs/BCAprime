// app.js - BCAPrime app logic (extracted from index.html).
// Must load AFTER firebase-config.js and supabase-config.js.
console.info('[BCAPrime] app.js v39 loaded ✔');
const colleges=[['all','All Colleges'],['avviare','Avviare Educational Hub'],['glocal','Glocal University'],['ccsu','CCSU Meerut'],['du','Delhi University'],['ipu','GGSIPU Delhi'],['aktu','AKTU / UPTU'],['ignou','IGNOU'],['mdu','MDU Rohtak'],['bhu','BHU'],['pune','Pune University'],['bangalore','Bangalore University'],['other','Other University']];
    JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]').forEach(college=>{if(Array.isArray(college)&&college.length===2)colleges.push(college)});
    /* ---- Subject-wise finder ----
       Subjects ab sirf database se aate hain (admin-approved / public).
       Koi bhi hard-coded subject list nahi — college + semester ki
       subjects admin approval ke baad hi dikhti hai. */
    /* Cloud-approved subjects so the whole app shares them across devices.
       NOTE: student ke pending subjects screen par NAHI dikhte — sirf admin
       approve karne ke baad public ho kar sabko dikhta hai. */
    let cloudSubjects=[];
    async function loadCloudSubjects(){
      if(typeof supabaseClient==='undefined'||!supabaseClient)return;
      try{
        const {data,error}=await supabaseClient.from('subjects').select('*').eq('is_public',true);
        if(error)throw error;
        cloudSubjects=data||[];
        renderSubjectFilter();renderSubjectCards();
        try{updateUploadSubjects()}catch(e){}
      }catch(error){console.warn('Could not load cloud subjects.',error.message)}
    }
    function submitSubjectToCloud(sem,name){
      if(typeof supabaseClient==='undefined'||!supabaseClient)return false;
      const uid=accountSession&&accountSession.uid?accountSession.uid:'';
      const key=typeof state!=='undefined'&&state.college?String(state.college):'all';
      const exists=cloudSubjects.some(s=>String(s.semester)===String(sem)&&s.is_public&&normSubject(s.name)===normSubject(name));
      if(exists||!name)return false;
      const insertPromise=supabaseClient.from('subjects').insert({name:String(name).trim(),code:'',semester:Number(sem),college:key,status:'pending',is_public:false,created_by:uid});
      if(insertPromise&&insertPromise.then){insertPromise.then(()=>loadCloudSubjects(),()=>{})}
      return true;
    }
    function getCustomSubjects(sem){try{return [...new Set(cloudSubjects.filter(s=>sem==null||sem===''||sem==='all'||String(s.semester)===String(sem)).map(s=>s.name))]}catch(error){return[]}}
    function addCustomSubject(sem,name){
      const clean=String(name||'').trim().replace(/\s+/g,' ');
      if(!clean)return false;
      try{return submitSubjectToCloud(sem,clean)}catch(error){return false}
    }
    const normSubject=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
    /* ---- PrimeFinder robust matching — har user scenario cover karta hai ----
       - Multi-word query: har word title/subject/college mein AND-hotá hai (order irrelevant)
       - Subject: exact + normalized containment (partial/near subjects bhi milte hain)
       - Missing sem/college data: drop nahi karte, universal treat karte hain
       - '__add' (Add-subject UI state) ko filter nahi maante */
    function collegeMatchesFilter(c){return state.college==='all'||c==='all'||(!c&&state.college==='all')||c===state.college}
    function semMatchesFilter(v){if(state.sem==='all')return true;if(v==null||String(v)==='')return false;return Number(v)===Number(state.sem)}
    function queryTokens(q){return normSubject(q).split(' ').filter(Boolean)}
    function queryMatchesFilter(q,title,subject,collegeName,fileName,type){
      if(!q)return true;const tokens=queryTokens(q);if(!tokens.length)return true;
      const hay=normSubject(title)+' '+normSubject(subject)+' '+normSubject(collegeName)+' '+normSubject(fileName)+' '+normSubject(type);
      return tokens.every(t=>hay.includes(t));
    }
    function subjectMatchesFilter(resourceSubject,filter){
      if(!filter||filter==='all'||filter==='__add')return true;
      const r=normSubject(resourceSubject);if(!r)return true;
      const f=normSubject(filter);
      return r===f||r.includes(f)||f.includes(r);
    }
    let resources=[...JSON.parse(localStorage.getItem('bca-uploads')||'[]')].filter(resource=>(resource.type==='notes'||resource.type==='pyq')&&(!resource.status||resource.status==='approved'));
    const state={theme:localStorage.getItem('bca-theme')||'dark',college:localStorage.getItem('bca-college')||'all',type:'all',query:'',sem:localStorage.getItem('bca-sem')||'all',subject:'all',saved:JSON.parse(localStorage.getItem('bca-saved')||'[]'),savedOnly:false,onboardingCollege:'',onboardingSem:''};
    const $=id=>document.getElementById(id);
    /* ---- Analytics tracking (fire-and-forget, UI kabhi block nahi karta) ---- */
    const visitorId=(()=>{try{let v=localStorage.getItem('bca-vid');if(!v){v='v-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);localStorage.setItem('bca-vid',v)}return v}catch(e){return 'anon'}})();
    const analyticsSessionId=(()=>{try{let s=sessionStorage.getItem('bca-sid');if(!s){s='s-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);sessionStorage.setItem('bca-sid',s)}return s}catch(e){return 'sess'}})();
    const sessionStartTs=Date.now();
    function parseDeviceInfo(){const ua=navigator.userAgent;const os=/Android/i.test(ua)?'Android':/iPhone|iPad|iPod/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Mac OS/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'Unknown';const tablet=/iPad|Tablet/i.test(ua);const mobile=/Mobi|Android|iPhone/i.test(ua);const browser=/Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/SamsungBrowser/.test(ua)?'Samsung Internet':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'Other';return{device:tablet?'Tablet':mobile?'Mobile':'Desktop',os,browser}}
    function trackEvent(type,data){data=data||{};try{if(typeof supabaseClient==='undefined'||!supabaseClient)return;const dev=parseDeviceInfo();supabaseClient.from('analytics_events').insert({event_type:type,visitor_id:visitorId,session_id:analyticsSessionId,user_id:accountSession&&accountSession.uid?accountSession.uid:'',user_email:accountSession&&accountSession.email?accountSession.email:'',user_name:accountSession&&accountSession.displayName?accountSession.displayName:(data.uploader||''),resource_title:data.title||'',resource_type:data.type||'',subject:data.subject||'',semester:data.sem?Number(data.sem):null,duration_seconds:data.seconds!=null?Math.round(data.seconds):null,results_count:data.results!=null&&data.results!==''?Number(data.results):null,device:dev.device,os:dev.os,browser:dev.browser,page_path:location.pathname}).then(()=>{},()=>{})}catch(error){}}
    window.addEventListener('pagehide',()=>{try{trackEvent('session_end',{seconds:(Date.now()-sessionStartTs)/1000})}catch(error){}});
    window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')try{trackEvent('session_heartbeat',{seconds:(Date.now()-sessionStartTs)/1000})}catch(error){}});
    async function loadCloudResources(){if(!supabaseClient){console.info('Supabase resources unavailable until schema is added.');return;}try{const {data,error}=await supabaseClient.from('resources').select('*').eq('status','approved').order('created_at',{ascending:false});if(error)throw error;const cloud=(data||[]).map(item=>({title:item.title,type:item.type,sem:item.semester,year:item.year,subject:item.subject,college:item.college,fileName:item.file_name,fileUrl:item.file_url,downloads:item.downloads||0,upvotes:item.upvotes||0,status:item.status,uploader:item.uploader_name||(item.uploader_email?item.uploader_email.split('@')[0].split(/[._+\-]+/).filter(Boolean).map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join(' '):''),uploaderEmail:item.uploader_email||'',date:item.created_at?String(item.created_at).slice(0,10):''}));const keyOf=item=>`${String(item.title||'').trim().toLowerCase()}|${item.college||''}|${item.sem}`;const keys=new Set(resources.map(keyOf));resources=[...resources,...cloud.filter(item=>!keys.has(keyOf(item)))];try{const approvedKeys=new Set(cloud.filter(item=>item.status==='approved').map(keyOf));const remaining=JSON.parse(localStorage.getItem('bca-uploads')||'[]').filter(item=>!approvedKeys.has(keyOf(item)));localStorage.setItem('bca-uploads',JSON.stringify(remaining))}catch(error){}renderSubjectFilter();render()}catch(error){console.error('Failed to load cloud resources:',error);toast('Failed to load resources. Please refresh the page.');}}
    function init(){
      /* Time-based default theme (initial load only): 6AM-5:59PM light, baaki dark.
         User ki manual choice (bca-theme-manual) hamesha override karti hai. */
      try{
        if(!localStorage.getItem('bca-theme-manual')){
          const __h=new Date().getHours();
          state.theme=(__h>=6&&__h<18)?'light':'dark';
        }
      }catch(__e){}
      applyTheme(state.theme);
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
      bindCardViews();if(!resources.length)showSkeleton();
      loadCloudResources();
      try{loadCloudSubjects()}catch(e){}
      setTimeout(()=>{try{loadSeniorRequests()}catch(e){}},600);
      setTimeout(()=>$('splash').classList.add('hidden'),1100);
      bindUploadDropzone();
    }
    function applyTheme(theme){state.theme=theme;document.documentElement.dataset.theme=theme;localStorage.setItem('bca-theme',theme);$('themeIcon').className=theme==='dark'?'fa-solid fa-sun':'fa-solid fa-moon';const mc=document.querySelector('meta[name="theme-color"]');if(mc)mc.content=theme==='dark'?'#0a0a0a':'#fafafa'}
    function toggleTheme(){applyTheme(state.theme==='dark'?'light':'dark');try{localStorage.setItem('bca-theme-manual','1')}catch(e){}}
    function render(){const q=String(state.query||'');const match=r=>{
        if(state.savedOnly&&!state.saved.includes(r.title.replace(/\W/g,'')))return false;
        if(state.type!=='all'&&r.type!==state.type)return false;
        if(!collegeMatchesFilter(r.college))return false;
        if(!semMatchesFilter(r.sem))return false;
        if(!queryMatchesFilter(q,r.title,r.subject,(colleges.find(c=>c[0]===r.college)||['',''])[1],r.fileName,r.type))return false;
        if(!subjectMatchesFilter(r.subject,state.subject))return false;
        return true;};
      let list=resources.filter(match);
      /* Search fallback: query active ho aur filters ke saath 0 results aayein
         to college/semester/subject/type filters relax karke dobara dhoondo —
         warna user ko search broken lagta hai jab material exist karta hai. */
      let fallback=false;
      if(!list.length&&q.trim()){
        list=resources.filter(r=>queryMatchesFilter(q,r.title,r.subject,(colleges.find(c=>c[0]===r.college)||['',''])[1],r.fileName,r.type));
        fallback=list.length>0;
      }
      $('count').textContent=`${list.length} result${list.length===1?'':'s'}${fallback?' (from all semesters & colleges)':''}`;
      const notice=fallback?`<div class="search-fallback-note"><i class="fa-solid fa-circle-info"></i> No match in your current filters — showing results from <b>all semesters &amp; colleges</b>. <button class="secondary" onclick="clearSearchFilters()">Clear filters</button></div>`:'';
      $('resources').innerHTML=(fallback?notice:'')+(list.length?list.map(card).join(''):buildEmptyState())}
    /* ---- Empty state: upload it yourself or request from friends on WhatsApp ---- */
    function buildEmptyState(){
      const submitted=String(state.query||'').trim()!=='';const searching=submitted||state.sem!=='all'||(state.subject&&state.subject!=='all'&&state.subject!=='__add')||state.type!=='all';
      return `<div class="empty"><i class="fa-regular fa-folder-open"></i><br>
        <strong>${searching?'This material isn\'t in the library yet':'The library is quiet — be the first!'}</strong><br>
        <small>${searching?'No Notes/PYQs match your filters right now. Be the first to upload it, or request it from your friends:':'You could be the first to share material here.'}</small>
        <div class="empty-actions">
          <button class="primary" onclick="openUpload()"><i class="fa-solid fa-cloud-arrow-up"></i> Upload it yourself</button>
          <button class="wa-request" onclick="requestMaterialOnWhatsApp()"><i class="fa-brands fa-whatsapp"></i> Request from friends</button>
          ${canRequestSenior()?`<button class="sr-request" onclick="openSeniorRequest()"><i class="fa-solid fa-users"></i> Request senior</button>`:''}
          ${searching?`<button class="secondary" onclick="clearSearchFilters()"><i class="fa-solid fa-filter-circle-xmark"></i> Clear search &amp; filters</button>`:''}
        </div></div>`;
    }
    function requestMaterialOnWhatsApp(){
      const semText=state.sem==='all'?'any semester':('Semester '+state.sem);
      const subjText=(!state.subject||state.subject==='all')?'':(' for '+state.subject);
      const typeText=state.type==='all'?'Notes or PYQs':(state.type==='notes'?'Notes':'PYQs');
      const msg='📚 *BCAPrime* — Study Material Request 🙏\n\n'
        +'Hey! I need '+typeText+subjText+' for '+semText+', but it\'s not available in the library yet. 😅\n\n'
        +'If you have them, please take 2 minutes to upload here:\n'
        +'👉 https://bcaprime.vercel.app\n\n'
        +'You upload first, everyone studies next! 💪🚀';
      window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
    }
    function uploaderSmallAvatar(name){const n=(name||'Student').trim();const letter=n.charAt(0).toUpperCase()||'S';const hues=[142,200,280,320,40,170];let h=0;for(const ch of n)h=(h*31+ch.charCodeAt(0))%360;const hue=hues[h%hues.length];return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" rx="14" fill="hsl(${hue},55%,42%)"/><text x="14" y="19" font-family="Arial,sans-serif" font-size="14" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`)}`}
function card(r){const id=r.title.replace(/\W/g,'');const saved=state.saved.includes(id);const up=didUpvote(id);const sTitle=escHtml(r.title);const sSubject=escHtml(r.subject||'Community upload');const sCollege=r.college==='all'?'All colleges':escHtml((colleges.find(c=>c[0]===r.college)||['','College'])[1]);const sUploader=r.uploader?escHtml(r.uploader):'';const dlTitle=escJsStr(r.title);const isPending=r.status==='pending';const cnt=getCounts(id);const views=((cnt&&cnt.v)||0);const downloads=((typeof r.downloads==='number')?r.downloads:0)+((cnt&&cnt.d)||0);const isAdmin=(r.role==='admin'||r.uploaderRole==='admin');const avatar=isAdmin?(r.uploaderAvatar||'/assets/logo.png'):(r.uploaderAvatar||uploaderSmallAvatar(r.uploader||'S'));const saveBtn=`<button class="rc-icon ${saved?'on':''}" aria-label="Save resource" onclick="toggleSave('${id}')" title="Save"><i class="fa-${saved?'solid':'regular'} fa-bookmark"></i></button>`;const shareBtn=`<button class="rc-icon" aria-label="Share" onclick="shareResource('${dlTitle}')" title="Share"><i class="fa-solid fa-share-nodes"></i></button>`;const roleBadge=isAdmin?`<span class="rc-role rc-role-admin"><i class="fa-solid fa-circle-check"></i> Admin</span>`:`<span class="rc-role">Contributor</span>`;const fileExt=(r.fileName&&(r.fileName.match(/\.(\w+)$/)||[])[1])?escHtml(r.fileName.match(/\.(\w+)$/)[1].toUpperCase()):(r.type==='pyq'?'PYQ':'Notes');return `<article class="resource${isPending?' pending-resource':''}" data-id="${id}"><div class="rc-top"><div class="rc-top-left"><span class="badge">${r.type==='pyq'?'PYQ':'Notes'}</span><span class="rc-file">${fileExt}</span></div><div class="rc-top-actions">${saveBtn}${shareBtn}</div></div>${isPending?`<span class="rc-pending"><i class="fa-solid fa-clock"></i> Under review</span>`:''}<h3 class="rc-title">${sTitle}</h3><div class="rc-subject"><span class="rc-subject-badge"><i class="fa-solid fa-book-open"></i> ${sSubject}</span><span class="rc-sem-badge"><i class="fa-solid fa-layer-group"></i> Sem ${(r.sem!=null&&r.sem!=='')?escHtml(String(r.sem)):''}</span></div><div class="rc-meta"><span><i class="fa-solid fa-building-columns"></i>${sCollege}</span>${r.date?`<span><i class="fa-regular fa-clock"></i>${escHtml(r.date)}</span>`:''}</div><div class="rc-uploader"><img class="rc-uploader-avatar" src="${avatar}" alt="${sUploader||'BCAPrime'}" width="24" height="24">${sUploader?`<span class="rc-uploader-name">${sUploader}</span>`:''}${roleBadge}</div><div class="rc-stats"><button type="button" class="rc-stat rc-like${up?' on':''}" title="${up?'Unlike':'Like'}" onclick="toggleUpvote('${id}')"><i class="fa-${up?'solid':'regular'} fa-heart"></i><b>${upvoteDisplay(r)}</b> ${up?'Liked':'Likes'}</button><span class="rc-stat" title="Views"><i class="fa-regular fa-eye"></i><b id="rcv-${id}">${views}</b> Views</span><span class="rc-stat" title="Downloads"><i class="fa-solid fa-download"></i><b id="rcd-${id}">${downloads}</b> Downloads</span></div><div class="resource-actions"><button class="view read" onclick="readResource('${id}')"><i class="fa-solid fa-book-open"></i> Read</button><button class="download" onclick="download('${dlTitle}')"><i class="fa-solid fa-download"></i> Download</button></div></article>`}

    /* ================= Resource Card counters & helpers ================= */
        const RC_KEY='bca-rc-counts';
        function rcId(title){return String(title||'').replace(/\W/g,'')}
        function loadCounts(){try{return JSON.parse(localStorage.getItem(RC_KEY)||'{}')}catch(e){return{}}}
        function saveCounts(c){try{localStorage.setItem(RC_KEY,JSON.stringify(c))}catch(e){}}
        function getCounts(id){const c=loadCounts();return c[id]||{v:0,d:0}}
        function bumpView(id){if(!id)return;const c=loadCounts();const rec=c[id]||{v:0,d:0};rec.v=(rec.v||0)+1;c[id]=rec;saveCounts(c);const resource=resources.find(x=>rcId(x.title)===id);if(resource)resource.viewCount=rec.v;const el=document.getElementById('rcv-'+id);if(el)el.textContent=rec.v}
        function bumpDownload(id){if(!id)return;const c=loadCounts();const rec=c[id]||{v:0,d:0};rec.d=(rec.d||0)+1;c[id]=rec;saveCounts(c);const resource=resources.find(x=>rcId(x.title)===id);const total=((resource&&typeof resource.downloads==='number')?resource.downloads:0)+rec.d;if(resource)resource.downloadCount=total;const el=document.getElementById('rcd-'+id);if(el)el.textContent=total}
        function bindCardViews(){/* Views are counted STRICTLY on the "Read" button click (readResource) — never on card tap, page load, mount or hover. */}
        async function shareResource(title){try{if(navigator.share){await navigator.share({title:'BCAPrime',text:title||'Check this on BCAPrime',url:location.href})}else if(navigator.clipboard){await navigator.clipboard.writeText(location.href);toast('Link copied')}else{toast('Share is not supported here')}}catch(e){}}
        function readResource(id){const resource=resources.find(x=>rcId(x.title)===id);if(!resource)return;const src=resource.fileUrl||resource.fileData;if(!src){toast('Read is not available for this item');return}bumpView(id);openReader(resource)}
    function setType(type,button){state.type=type;document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));button.classList.add('active');renderSubjectFilter();render()}
    function applyFilters(){updateSemesterOptions();state.sem=$('semesterFilter').value;renderSubjectFilter();let subjectValue=$('subjectFilter')&&$('subjectFilter').value;if(subjectValue==='__add')subjectValue='all';state.subject=subjectValue;localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-subject',state.subject);const __ds=$('deskSemester');if(__ds)__ds.textContent=state.sem==='all'?'Explore your semester':`Semester ${state.sem} resources`;render()}
    /* Semester dropdown sabhi 6 semesters dikhata hai aur user ki
       onboarded/selected semester ko preserve karta hai. */
    function updateSemesterOptions(){
      const semSel=$('semesterFilter');
      if(!semSel)return;
      const current=semSel.value;
      const opts=['<option value="all">All semesters</option>'];
      for(let s=1;s<=6;s++)opts.push('<option value="'+s+'">Semester '+s+'</option>');
      semSel.disabled=false;
      semSel.innerHTML=opts.join('');
      const keep=(current&&current!=='all'&&Number(current)>=1&&Number(current)<=6)?current:(state.sem!=='all'?String(state.sem):'all');
      semSel.value=(Number(keep)>=1&&Number(keep)<=6)?keep:'all';
    }
    function resetFinder(){updateSemesterOptions();$('semesterFilter').value='all';state.sem='all';state.type='all';state.subject='all';localStorage.setItem('bca-sem','all');localStorage.setItem('bca-subject','all');const __far=$('finderAddSubjectRow');if(__far)__far.hidden=true;renderSubjectFilter();document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.textContent.trim()==='All'));const __rs=$('deskSemester');if(__rs)__rs.textContent='Explore your semester';render()}
    /* Search results aane ke baad filters reset (search query khud rehti hai) */
    function clearSearchFilters(){resetFinder();closeSuggestions()}
    let lastSearchTrack={query:'',ts:0};
    function searchResources(value){clearTimeout(__searchTimeout);__searchTimeout=setTimeout(()=>{state.query=value;showSuggestions();render();try{const q=String(value||'').trim().toLowerCase();const now=Date.now();if(q.length>=3&&(q!==lastSearchTrack.query||now-lastSearchTrack.ts>4000)){lastSearchTrack={query:q,ts:now};const count=resources.filter(r=>`${r.title} ${r.subject}`.toLowerCase().includes(q)).length;trackEvent('search',{title:q,results:count})}}catch(error){}},200)}
    /* ---- Subject filter engine ----
       Options = base subjects (per semester) + custom subjects the user added
       + subjects already present in uploads for the active college/semester.
       This is how unknown college-specific subjects discover themselves. */
    function getAvailableSubjects(){
      return [...new Set(resources.filter(r=>{
        const matchCollege=collegeMatchesFilter(r.college);
        const matchSem=semMatchesFilter(r.sem);
        const matchType=state.type==='all'||r.type===state.type;
        return matchCollege&&matchSem&&matchType;
      }).map(r=>String(r.subject||'').trim()).filter(Boolean))];
    }
    function renderSubjectFilter(){
      const sel=$('subjectFilter');if(!sel)return;
      const preferred=(typeof state.subject==='string'&&state.subject)||sel.value;
      const customs=getCustomSubjects(state.sem);
      const seen=new Map();
      [...getAvailableSubjects(),...customs].forEach(name=>{const key=normSubject(name);if(key&&!seen.has(key))seen.set(key,name)});
      const merged=[...seen.values()].sort((a,b)=>a.localeCompare(b));
      sel.innerHTML='<option value="all">All subjects</option>'+merged.map(s=>`<option value="${s.replace(/"/g,'&quot;')}">${escHtml(s)}</option>`).join('')+'<option value="__add">+ Add new subject&#8230;</option>';
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
      if(state.sem==='all'){toast('Select a semester first');$('subjectFilter').value='all';return}
      const addRow=$('finderAddSubjectRow');
      if(addRow){addRow.hidden=false}
      const input=$('finderNewSubjectInput');if(input)input.focus();
    }
    function confirmFinderAddSubject(){
      const input=$('finderNewSubjectInput');
      const name=(input&&input.value||'').trim().replace(/\s+/g,' ');
      if(!name){toast('Type a subject name');if(input)input.focus();return}
      if(name.length<2){toast('Enter a slightly longer name');return}
      if(state.sem==='all'){toast('Select a semester first');return}
      const ok=addCustomSubject(Number(state.sem),name);
      if(input)input.value='';
      state.subject='all';
      localStorage.setItem('bca-subject','all');
      renderSubjectFilter();
      $('subjectFilter').value='all';
      const addRow=$('finderAddSubjectRow');if(addRow)addRow.hidden=true;
      applyFilters();
      toast(ok?('"'+name+'" submitted ⏳ Admin approval ke baad dikhega'):('Could not submit "'+name+'". Please try again.'));
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
      [...resources.filter(r=>r.sem===sem).map(r=>String(r.subject||'').trim()).filter(Boolean),
       ...getCustomSubjects(sem)
      ].forEach(name=>{const key=normSubject(name);if(key&&!seen.has(key))seen.set(key,name)});
      const sorted=[...seen.values()].sort((a,b)=>a.localeCompare(b));
      sel.innerHTML=sorted.map(s=>`<option value="${s.replace(/"/g,'&quot;')}">${escHtml(s)}</option>`).join('')+'<option value="__other">+ Other / new subject…</option>';
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
      let subjects=[].concat(getCustomSubjects(state.sem));
      getAvailableSubjects().forEach(s=>{if(!subjects.some(x=>normSubject(x)===normSubject(s)))subjects.push(s)});
      if(!subjects.length){wrap.innerHTML='<div class="subject-empty"><i class="fa-solid fa-layer-group"></i><br>Pick your semester — all its subjects will show up here 📚</div>';return}
      const seen=new Map();subjects.forEach(s=>{const key=normSubject(s);if(key&&!seen.has(key))seen.set(key,s)});
      const countFor=s=>resources.filter(r=>subjectMatchesFilter(r.subject,s)&&collegeMatchesFilter(r.college)&&semMatchesFilter(r.sem)).length;
      /* Har subject ke semesters: cloud subject + uploaded resources */
      const semsOf=s=>{const n=normSubject(s);const set=new Set();cloudSubjects.forEach(c=>{if(c.semester!=null&&normSubject(c.name)===n)set.add(Number(c.semester))});resources.forEach(r=>{if(r.subject&&r.sem!=null&&subjectMatchesFilter(r.subject,s))set.add(Number(r.sem))});return [...set].sort((a,b)=>a-b)};
      wrap.innerHTML=[...seen.values()].map((s,i)=>{
        const hue=subjectHue(s);const count=countFor(s);const sems=semsOf(s);
        const semBadge=sems.length?`<span class="subject-badge-sem"><i class="fa-solid fa-layer-group"></i>Semester ${sems.join(' &amp; ')}</span>`:'';
        return `<button class="subject-card" style="--hue:${hue};animation-delay:${Math.min(i*45,450)}ms" onclick="openSubjectType('${escJsStr(s)}')">
          <span class="subject-card-icon"><i class="${subjectIcon(s)}"></i></span>
          <strong>${escHtml(s)}</strong>
          <span class="subject-card-meta">${semBadge}${count?`<small>${count} material${count>1?'s':''}</small>`:''}</span>
          <span class="subject-card-go"><i class="fa-solid fa-arrow-right"></i></span>
        </button>`}).join('');
    }
    /* ---- Add a new custom subject -> card appears instantly ---- */
    function addSubjectCard(){
      const input=$('newSubjectInput');
      const name=(input&&input.value||'').trim().replace(/\s+/g,' ');
      if(!name){toast('Type a subject name');if(input)input.focus();return}
      if(name.length<2){toast('Please use a slightly longer name');return}
      if(state.sem==='all'){toast('Select a semester first, then add subjects');return}
      const ok=addCustomSubject(Number(state.sem),name);
      if(input){input.value='';input.blur()}
      renderSubjectFilter();
      render();
      toast(ok?('"'+name+'" submitted ✉️ Admin approve karega tab ye yahan dikhega'):('Could not submit "'+name+'". Please try again.'));
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
      // Smooth content experience: skeleton first, then staggered results
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
      if(!supabaseClient){toast('Feedback is unavailable right now');return}
      if(!accountSession){requireAccount('Log in to send feedback or report a bug.', 'feedback');return}
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
        toast('Thanks! Your feedback is in 🙏 We\'ll review it soon');
      }catch(error){
        console.error('[BCAPrime] Feedback error:',error);
        toast('Feedback send failed: '+(error&&error.message||error));
      }finally{
        btn.disabled=false;btn.textContent='Send feedback';
      }
    }
    function showSuggestions(){const query=$('search').value.trim().toLowerCase();const matches=resources.filter(r=>`${r.title} ${r.subject}`.toLowerCase().includes(query)).slice(0,4);$('suggestions').innerHTML=(query?matches.map(r=>`<button class="suggestion" onclick="chooseSuggestion('${escJsStr(r.title)}')"><i class="fa-solid fa-magnifying-glass"></i> ${escHtml(r.title)}</button>`).join(''):'<small style="padding:5px 8px;color:var(--muted)">Search by subject, paper or resource type</small>');$('suggestions').classList.add('open')}
    function chooseSuggestion(title){$('search').value=title;state.query=title;closeSuggestions();render()}
    function closeSuggestions(){$('suggestions').classList.remove('open')}
    function focusFinder(){$('bca-prime-finder').scrollIntoView({behavior:'smooth'})}
    function scrollToLibrary(){const lib=$('library')||$('bca-prime-finder');if(lib)lib.scrollIntoView({behavior:'smooth',block:'start'});render()}
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
    function setAccessAuthMode(mode){accessAuthMode=mode;$('accessAuthTitle').textContent=mode==='signup'?'Sign up to continue':'Login to continue';$('accessAuthDescription').textContent=mode==='signup'?'Create a free account to upload and download study material.':'Login to continue with this action.';$('accessAuthSubmit').textContent=mode==='signup'?'Sign up':'Login';$('accessAuthSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('accessAuthMessage').textContent='';$('accessAuthNameLabel').hidden=mode!=='signup';$('accessAuthConfirmLabel').hidden=mode!=='signup';$('accessAuthEmailLabel').hidden=mode==='signup';if(mode==='signup'){$('accessAuthName').setAttribute('required','');$('accessAuthConfirm').setAttribute('required','');$('accessAuthEmail').removeAttribute('required')}else{$('accessAuthName').removeAttribute('required');$('accessAuthConfirm').removeAttribute('required');$('accessAuthEmail').setAttribute('required','')}}
    function requireAccount(message,action,title=''){if(accountSession)return true;restrictedAction={action,title};setAccessAuthMode('signup');$('accessAuthDescription').textContent=message;$('accessAuthMessage').textContent='';$('accessAuthModal').classList.add('open');return false}
    function resumeRestrictedAction(){if(!accountSession||!restrictedAction)return;const action=restrictedAction;restrictedAction=null;closeModals();if(action.action==='upload')openUpload();if(action.action==='download')download(action.title);if(action.action==='feedback')openFeedback()}
    async function submitAccessAuth(event){event.preventDefault();if(!firebaseApp){$('accessAuthMessage').textContent='Firebase is not configured.';return}const password=$('accessAuthPassword').value;const msgEl=$('accessAuthMessage');if(accessAuthMode==='signup'){const username=$('accessAuthName').value.trim().toLowerCase();if(!isValidUsername(username)){msgEl.textContent='Username must be 3\u201320 letters, numbers or _ (no spaces).';return}if(!checkPasswordMatch(password,$('accessAuthConfirm'),msgEl))return;pendingSignup={username,password};msgEl.textContent='Opening Google sign-in\u2026';await signInWithProvider('google','accessAuthMessage');return}const loginEmail=await resolveLoginEmail($('accessAuthEmail').value,msgEl);if(!loginEmail)return;msgEl.textContent='Working...';try{await firebase.auth().signInWithEmailAndPassword(loginEmail,password);accountSession=firebase.auth().currentUser;if(await ensureVerified(accountSession)){resumeRestrictedAction()}}catch(error){$('accessAuthMessage').textContent=error.message;return}}

    async function download(title){/* Strict auth guard: block the download completely and open the Login/Signup modal for guests. */if(!accountSession){requireAccount('Sign up or login to download this note.','download',title);return}bumpDownload(rcId(title));const resource=resources.find(item=>item.title===title);trackEvent('download',{title,type:resource&&resource.type,subject:resource&&resource.subject,sem:resource&&resource.sem});if(resource&&(resource.fileData||resource.fileUrl)){if(!await ensureFileAvailable(resource,'download'))return;const a=document.createElement('a');a.href=resource.fileData||resource.fileUrl;a.download=resource.fileName||title.replace(/\W+/g,'-');a.target='_blank';a.click();toast('Download started');return}const blob=new Blob([`BCAPrime resource\n${title}\n\nUse this as a study reference.`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=title.replace(/\W+/g,'-')+'.txt';a.click();URL.revokeObjectURL(a.href);toast('Demo download started')}
    let accountMode='signup';let accessAuthMode='signup';let accountSession=null;let authSuppress=false;
    /* ============ Strict Email Verification gate ============
       Email/password users MUST verify before entering the app.
       Google / Apple (OAuth) users are already verified -> they bypass.
       isEmailVerified status is also persisted to user_profiles. */
    let verifyPollTimer=null,verifyPollOn=false;
    function isFederatedUser(user){try{return !!(user&&user.providerData&&user.providerData.some(p=>p.providerId==='google.com'||p.providerId==='apple.com'))}catch(e){return false}}
    function isVerifiedUser(user){user=user||accountSession;if(!user)return false;if(isFederatedUser(user))return true;return !!(user.emailVerified)}
    function saveVerificationStatus(verified){
      if(!supabaseClient||!accountUid())return;
      try{supabaseClient.from('user_profiles').update({is_email_verified:!!verified,updated_at:new Date().toISOString()}).eq('uid',accountUid()).then(()=>{},()=>{})}catch(e){}
    }
    function stopVerifyPolling(){if(verifyPollTimer){clearInterval(verifyPollTimer);verifyPollTimer=null}verifyPollOn=false}
    function startVerifyPolling(){
      if(verifyPollOn||!firebaseApp||!firebaseApp.auth)return;verifyPollOn=true;
      verifyPollTimer=setInterval(async()=>{
        try{
          const u=firebase.auth().currentUser;if(!u){stopVerifyPolling();return}
          await u.reload();const fresh=firebase.auth().currentUser;
          if(fresh&&isVerifiedUser(fresh)){stopVerifyPolling();closeVerifyEmail();saveVerificationStatus(true);sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp();resumeRestrictedAction();if($('profileModal').classList.contains('open'))renderAccount();toast('Email verified ✓')}
        }catch(e){}
      },3000);
    }
    function showVerifyEmail(email='',msg=''){
      const addr=$('verifyEmailAddr');if(addr)addr.textContent=email;
      const m=$('verifyEmailMessage');if(m)m.textContent=msg||'';
      const modal=$('verifyEmailModal');if(modal){try{closeModals()}catch(e){}modal.classList.add('open')}
      startVerifyPolling();
    }
    function closeVerifyEmail(){stopVerifyPolling();const modal=$('verifyEmailModal');if(modal)modal.classList.remove('open')}
    async function resendVerificationEmail(event){if(event)event.preventDefault();const msg=$('verifyEmailMessage');if(!firebaseApp){if(msg)msg.textContent='Firebase is not configured.';return}try{const u=firebase.auth().currentUser;if(u)await u.sendEmailVerification();if(msg)msg.textContent='Verification email sent again. Check your inbox / spam.'}catch(error){if(msg)msg.textContent=(error&&error.message)||'Could not send verification email.'}}
    async function confirmEmailVerified(event){if(event)event.preventDefault();const msg=$('verifyEmailMessage');try{const u=firebase.auth().currentUser;if(!u){closeVerifyEmail();return}await u.reload();const fresh=firebase.auth().currentUser;if(fresh&&isVerifiedUser(fresh)){stopVerifyPolling();closeVerifyEmail();saveVerificationStatus(true);sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp();resumeRestrictedAction();if($('profileModal').classList.contains('open'))renderAccount();toast('Email verified ✓');return}if(msg)msg.textContent='Not verified yet. Click the verification link we emailed to '+(fresh&&fresh.email?escHtml(fresh.email):'your inbox')+', then try again.'}catch(error){if(msg)msg.textContent=(error&&error.message)||'Could not check verification status.'}}
    /* Gate helper used by every email/password login handler.
       Returns true (granted) or shows the Verify screen and returns false. */
    async function ensureVerified(user){
      if(isVerifiedUser(user)){saveVerificationStatus(true);return true}
      let sent=false,email='';
      if(user&&user.email){email=user.email;try{await user.sendEmailVerification();sent=true}catch(e){}}
      saveVerificationStatus(false);
      showVerifyEmail(email,sent?'':'We could not send a new verification email right now — use the Resend link.');
      return false;
    }
    /* ===== OTP verification (dual option: link OR 6-digit code) =====
       Modern auto-popup flow: after a password signup the user stays
       signed in and an OTP modal pops up instantly. The 6-digit code is
       issued + verified server-side only (api/send-otp, api/verify-otp). */
    let pendingOtpApproval=false,otpResendTimer=null,otpCountdownEnd=0,otpSubmitting=false;
    function getAuthApiUrl(name){try{return (typeof AUTH_API!=='undefined'&&AUTH_API&&AUTH_API[name])?AUTH_API[name]:''}catch(e){return''}}
    async function firebaseIdToken(){try{const u=firebase.auth().currentUser;return u?await u.getIdToken():''}catch(e){return''}}
    function checkPasswordMatch(password,confirmEl,msgEl){const value=confirmEl&&typeof confirmEl.value==='string'?confirmEl.value:'';if(!value){if(msgEl)msgEl.textContent='Please confirm your password.';return false}if(password!==value){if(msgEl)msgEl.textContent='Passwords do not match. Please re-enter your confirmation.';return false}return true}
    /* ==== Google-first username signup ====
       Signup = Username + Password + Confirm -> Sign Up dabate hi Google
       account-picker khulta hai. Google select karne par user ka chosen
       password Firebase par set hota hai (server-side) aur username/email/name
       Supabase me save hota hai. Password kabhi plaintext me store nahi hota —
       sirf Firebase (hashed) me rehta hai. */
    function setLabelText(labelEl,text){if(labelEl&&labelEl.childNodes&&labelEl.childNodes[0])labelEl.childNodes[0].nodeValue=text}
    let pendingSignup=null,usernameCheckTimer=null;
    function isValidUsername(u){return /^[a-z0-9_]{3,20}$/.test((u||'').trim().toLowerCase())}
    async function checkUsernameAvailable(u){if(!supabaseClient)return null;try{const{data}=await supabaseClient.from('user_profiles').select('uid').eq('username',(u||'').trim().toLowerCase()).maybeSingle();return !data}catch(e){return null}}
    async function liveUsernameCheck(input,hintId){const hint=$(hintId);if(!hint)return;const u=input.value.trim().toLowerCase();if(!u){hint.textContent='';return}if(!isValidUsername(u)){hint.textContent='3\u201320 letters, numbers or _';hint.className='field-hint bad';return}hint.textContent='Checking\u2026';hint.className='field-hint';clearTimeout(usernameCheckTimer);usernameCheckTimer=setTimeout(async()=>{const avail=await checkUsernameAvailable(u);if(avail===null){hint.textContent='';return}hint.textContent=avail?'\u2713 Available':'\u2717 Already taken';hint.className='field-hint '+(avail?'good':'bad')},350)}
    /* Login helper: "username" ya "email" dono chalein. Username diya ho to
       user_profiles se uska email nikaal kar Firebase login karo. */
    async function resolveLoginEmail(identifier,msgEl){const id=(identifier||'').trim();if(!id)return '';if(id.indexOf('@')!==-1)return id.toLowerCase();if(!supabaseClient)return id;try{const{data}=await supabaseClient.from('user_profiles').select('email,username').eq('username',id.toLowerCase()).maybeSingle();if(data&&data.email)return data.email;if(msgEl)msgEl.textContent='No account found with that username. Try your email, or use Continue with Google.';return ''}catch(e){return id}}
    /* Google select hone ke baad pending signup complete karo:
       displayName = username, chosen password Firebase par (server-side),
       username/email/name Supabase user_profiles me. */
    async function applyPendingSignup(user){const p=pendingSignup;pendingSignup=null;if(!p||!user)return;try{if(p.username)await user.updateProfile({displayName:p.username})}catch(e){}try{const token=await user.getIdToken();const url=getAuthApiUrl('googleWelcome');if(token&&url)await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token,email:user.email,name:p.username,username:p.username,password:p.password})})}catch(e){try{console.warn('[BCAPrime] signup finalize failed:',e)}catch(e2){}}try{localStorage.setItem('bca-username',p.username)}catch(e){}}
    async function startPasswordSignup({name,email,password,messageId}){pendingOtpApproval=true;stopVerifyPolling();let credential;try{credential=await firebase.auth().createUserWithEmailAndPassword(email,password)}catch(error){pendingOtpApproval=false;if(messageId)$(messageId).textContent=error.message;return}if(name)try{await credential.user.updateProfile({displayName:name})}catch(e){}const fresh=firebase.auth().currentUser;await sendOtpAndOpen((fresh&&fresh.email)||email,messageId)}
    async function sendOtpAndOpen(email,messageId){const url=getAuthApiUrl('sendOtp');const fallback=(reason)=>{pendingOtpApproval=false;try{console.error('[BCAPrime] send-otp failed:',reason)}catch(e){}const u=firebase.auth().currentUser;try{if(u)u.sendEmailVerification()}catch(e){}showVerifyEmail(email,'OTP service unavailable ('+(reason&&reason.message?reason.message:reason||'unknown')+'). We sent a verification link instead.')};if(!url){fallback('AUTH_API not configured');return}const token=await firebaseIdToken();if(!token){fallback('no id token');return}setOtpStatus('Sending your code…','');try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token,email})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error('HTTP '+res.status+(data.error?(' - '+data.error):''));openOtpModal(email);startOtpCountdown(12*60)}catch(error){fallback(error)}}
    function setOtpStatus(text,cls){const s=$('otpStatus');if(s){s.textContent=text||'';s.className='otp-status'+(cls?' '+cls:'')}}
    function openOtpModal(email){stopVerifyPolling();const addr=$('otpEmailAddr');if(addr)addr.textContent=email||'your inbox';setOtpStatus('','');clearOtpBoxes();try{closeModals()}catch(e){}const modal=$('otpModal');if(modal){modal.classList.add('open');focusOtp(0)}}
    function closeOtpModal(){pendingOtpApproval=false;stopOtpCountdown();const m=$('otpModal');if(m)m.classList.remove('open');showVerifyEmail(accountSession&&accountSession.email?accountSession.email:'')}
    function switchToOtpView(){const email=((accountSession&&accountSession.email)||($('verifyEmailAddr')&&$('verifyEmailAddr').textContent)||'');stopVerifyPolling();closeVerifyEmail();sendOtpAndOpen(email)}
    function switchToLinkView(){closeOtpModal()}
    function currentOtpCode(){let code='';document.querySelectorAll('.otp-digit').forEach(i=>{code+=i.value||''});return code}
    function clearOtpBoxes(){document.querySelectorAll('.otp-digit').forEach(i=>{i.value='';i.classList.remove('has-value')})}
    function focusOtp(index){const boxes=document.querySelectorAll('.otp-digit');const el=boxes[index];if(el)el.focus()}
    function stopOtpCountdown(){if(otpResendTimer){clearInterval(otpResendTimer);otpResendTimer=null}const c=$('otpCountdown');if(c)c.textContent='';const b=$('otpResendBtn');if(b)b.hidden=true}
    function startOtpCountdown(totalSeconds){stopOtpCountdown();otpCountdownEnd=Date.now()+totalSeconds*1000;const tick=()=>{const remain=Math.max(0,Math.round((otpCountdownEnd-Date.now())/1000));const c=$('otpCountdown');const b=$('otpResendBtn');if(remain<=0){if(c)c.textContent='';if(b){b.textContent='\u21ba Resend code';b.hidden=false}if(otpResendTimer){clearInterval(otpResendTimer);otpResendTimer=null}}else{if(c){const m=Math.floor(remain/60),s=remain%60;c.textContent='Resend code in '+m+':'+String(s).padStart(2,'0')}if(b)b.hidden=true}};tick();otpResendTimer=setInterval(tick,1000)}
    async function resendOtp(){const email=(accountSession&&accountSession.email?accountSession.email:'');const url=getAuthApiUrl('sendOtp');const btn=$('otpResendBtn');if(btn)btn.hidden=true;setOtpStatus('Sending a new code…','');try{const token=await firebaseIdToken();if(!url||!token)throw new Error('Unavailable');const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token,email})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Could not resend code.');clearOtpBoxes();setOtpStatus('A new code was sent.','is-ok');startOtpCountdown(12*60);focusOtp(0)}catch(error){setOtpStatus(error.message||'Could not resend code.','is-error');if(btn)btn.hidden=false}}
    async function submitOtp(){if(otpSubmitting)return;const code=currentOtpCode();const wrap=$('otpBoxes');if(wrap)wrap.classList.remove('is-error');if(code.length!==6){setOtpStatus('Please enter all 6 digits.','is-error');if(wrap)wrap.classList.add('is-error');document.querySelectorAll('.otp-digit').forEach(b=>{if(!b.value)b.classList.add('has-value')});return}const email=(accountSession&&accountSession.email?accountSession.email:'');const url=getAuthApiUrl('verifyOtp');if(!url){setOtpStatus('Verification is unavailable right now.','is-error');return}otpSubmitting=true;const btn=$('otpVerifyBtn');if(btn){btn.disabled=true;btn.textContent='Verifying…'}try{const token=await firebaseIdToken();const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token,email,code})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'That code did not match.');completeEmailVerification()}catch(error){otpSubmitting=false;if(btn){btn.disabled=false;btn.textContent='Verify & continue'}setOtpStatus(error.message||'That code did not match.','is-error');if(wrap){wrap.classList.add('is-error');setTimeout(()=>wrap.classList.remove('is-error'),600)}}}
    function completeEmailVerification(){stopOtpCountdown();pendingOtpApproval=false;otpSubmitting=false;(async()=>{const u=firebase.auth().currentUser;if(u)try{await u.reload()}catch(e){}saveVerificationStatus(true);stopVerifyPolling();const vm=$('verifyEmailModal');if(vm)vm.classList.remove('open');const om=$('otpModal');if(om)om.classList.remove('open');sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp();resumeRestrictedAction();if($('profileModal')&&$('profileModal').classList.contains('open'))renderAccount();toast('Email verified ✓')})()}
    function bindOtpInputs(){const boxes=[...document.querySelectorAll('.otp-digit')];boxes.forEach((box,i)=>{box.addEventListener('input',()=>{const val=box.value.replace(/\D/g,'');box.value=val.slice(0,1);box.classList.toggle('has-value',box.value.length>0);if(box.value.length===1&&i<boxes.length-1)boxes[i+1].focus();if(currentOtpCode().length===6&&!otpSubmitting)submitOtp()});box.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!box.value&&i>0){boxes[i-1].value='';boxes[i-1].classList.remove('has-value');boxes[i-1].focus()}else if(e.key==='ArrowLeft'&&i>0)boxes[i-1].focus();else if(e.key==='ArrowRight'&&i<boxes.length-1)boxes[i+1].focus()});box.addEventListener('paste',e=>{e.preventDefault();const text=(e.clipboardData&&e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,6);boxes.forEach((b,j)=>{b.value=text[j]||'';b.classList.toggle('has-value',!!text[j])});if(text.length>=6)submitOtp();else boxes[Math.min(text.length,boxes.length-1)].focus()})})}
    function sendGoogleWelcome(user){const url=getAuthApiUrl('googleWelcome');if(!url||!user)return;(async()=>{try{const token=await user.getIdToken();if(!token)return;await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token,email:user.email,name:user.displayName})})}catch(e){console.warn('[BCAPrime] Google welcome email not sent.',e)}})()}
    function getUserName(user){user=user||accountSession;if(user&&user.displayName&&user.displayName.trim())return user.displayName.trim();if(user&&user.email){const local=user.email.split('@')[0]||'';const parts=local.split(/[._+\-]+/).filter(Boolean).map(p=>p.charAt(0).toUpperCase()+p.slice(1));if(parts.length)return parts.join(' ')}return 'there'}
    function getTimeBasedGreeting(name='there'){const hour=new Date().getHours();let prefix;if(hour>=4&&hour<12)prefix='Good Morning';else if(hour>=12&&hour<17)prefix='Good Afternoon';else if(hour>=17&&hour<21)prefix='Good Evening';else prefix='Good Night';return `${prefix}, ${name}!`}let greetingTimerId=null;function scheduleGreetingUpdate(){if(greetingTimerId)return;const now=new Date();const next=new Date(now);next.setHours(next.getHours()+1,0,0,0);const delay=Math.max(0,next-now);greetingTimerId=setTimeout(()=>{greetingTimerId=null;renderGreeting()},delay)}function renderGreeting(){const greeting=$('heroGreeting');const title=$('heroDefaultTitle');if(!greeting||!title)return;const isAuthed=accountSession||sessionStorage.getItem('bca-guest-mode')==='true';greeting.hidden=!isAuthed;title.hidden=!!isAuthed;$('heroGreetName').textContent=getTimeBasedGreeting(getUserName(accountSession)||'there');if(isAuthed)scheduleGreetingUpdate()}
    function setAccountMode(mode){accountMode=mode;$('accountTitle').textContent=mode==='signup'?'Create your account':'Welcome back';$('accountDescription').textContent=mode==='signup'?'Sign in to keep your study activity connected across devices.':'Login to keep your study activity connected across devices.';$('accountSubmit').textContent=mode==='signup'?'Sign up':'Login';$('accountSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('accountMessage').textContent='';$('accountNameLabel').hidden=mode!=='signup';$('accountConfirmLabel').hidden=mode!=='signup';$('accountEmailLabel').hidden=mode==='signup';if(mode==='signup'){$('accountName').setAttribute('required','');$('accountConfirm').setAttribute('required','');$('accountEmail').removeAttribute('required')}else{$('accountName').removeAttribute('required');$('accountConfirm').removeAttribute('required');$('accountEmail').setAttribute('required','')}}
    function renderAccount(){const form=$('accountForm');if(accountSession){const name=escHtml(getUserName(accountSession));const identity=escHtml(accountSession.email||'Account connected');$('accountAuth').innerHTML=`<h3>Hi ${name}!</h3><p>Signed in as ${identity}</p><div class="account-user"><span>${identity}</span><button class="secondary" type="button" onclick="signOutAccount()">Log out</button></div>`;return}if(!form)return;setAccountMode(accountMode)}
    async function signInWithProvider(provider,messageId='accountMessage'){if(!firebaseApp){$(messageId).textContent='Firebase is not configured.';return}try{if(provider==='google'){await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());const user=firebase.auth().currentUser;if(pendingSignup)await applyPendingSignup(user);if(user)sendGoogleWelcome(user)}}catch(error){if(pendingSignup)pendingSignup=null;if(error.code==='auth/popup-closed-by-user'||error.code==='auth/cancelled-popup-request')return;$(messageId).textContent=error.message}}
    let gateMode='signup';
    function setGateMode(mode){gateMode=mode;$('gateAccountSubmit').textContent=mode==='signup'?'Sign up':'Login';$('gateAccountSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('gateAccountMessage').textContent='';$('gateNameLabel').hidden=mode!=='signup';$('gateConfirmLabel').hidden=mode!=='signup';$('gateEmailLabel').hidden=mode==='signup';if(mode==='signup'){$('gateAccountName').setAttribute('required','');$('gateAccountConfirm').setAttribute('required','');$('gateAccountEmail').removeAttribute('required')}else{$('gateAccountName').removeAttribute('required');$('gateAccountConfirm').removeAttribute('required');$('gateAccountEmail').setAttribute('required','')}}
    async function submitGateAccount(event){event.preventDefault();if(!firebaseApp){$('gateAccountMessage').textContent='Firebase is not configured.';return}const password=$('gateAccountPassword').value;const msgEl=$('gateAccountMessage');if(gateMode==='signup'){const username=$('gateAccountName').value.trim().toLowerCase();if(!isValidUsername(username)){msgEl.textContent='Username must be 3\u201320 letters, numbers or _ (no spaces).';return}if(!checkPasswordMatch(password,$('gateAccountConfirm'),msgEl))return;pendingSignup={username,password};msgEl.textContent='Opening Google sign-in\u2026';await signInWithProvider('google','gateAccountMessage');return}const loginEmail=await resolveLoginEmail($('gateAccountEmail').value,msgEl);if(!loginEmail)return;msgEl.textContent='Working...';try{await firebase.auth().signInWithEmailAndPassword(loginEmail,password);accountSession=firebase.auth().currentUser;if(await ensureVerified(accountSession)){sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp()}}catch(error){$('gateAccountMessage').textContent=error.message;return}}
    function showAuthenticatedApp(){try{localStorage.setItem('bca-auth-known','1')}catch(e){}$('authGate').hidden=true;$('appShell').hidden=false;$('appTabs').hidden=false;renderGreeting();cacheProfile();renderAvatar();afterAccountAuth();setTimeout(showOnboardingIfNeeded,180);setTimeout(function(){if(window.checkWhatsNew)window.checkWhatsNew()},900)}
    function continueAsGuest(){sessionStorage.setItem('bca-guest-mode','true');showAuthenticatedApp();toast('Guest mode enabled')}
    function hideAuthenticatedApp(){try{localStorage.removeItem('bca-auth-known')}catch(e){}$('authGate').hidden=false;$('appShell').hidden=true;$('appTabs').hidden=true;renderGreeting()}
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
          if(data.semester!=null){state.sem=String(data.semester);try{localStorage.setItem('bca-sem',String(data.semester))}catch(e){}changed=true}
          if(changed){
            const lbl=$('collegeLabel');if(lbl)lbl.textContent=(colleges.find(c=>c[0]===state.college)||colleges[0])[1];
            try{updateSemesterOptions();const ss=$('semesterFilter');if(ss&&state.sem!=='all')ss.value=state.sem;}catch(e){}
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
      const email=(accountSession&&accountSession.email)?accountSession.email:'';let storedUsername='';try{storedUsername=localStorage.getItem('bca-username')||''}catch(e){}const profileName=(accountSession&&accountSession.displayName)||storedUsername;
      try{await supabaseClient.from('user_profiles').upsert({uid,email,name:profileName,...(storedUsername?{username:storedUsername.toLowerCase()}:{}),college:state.college||'all',semester:sem,is_email_verified:!!(accountSession&&isVerifiedUser(accountSession)),updated_at:new Date().toISOString()},{onConflict:'uid'})}catch(e){}
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
      try{await saveProfileToAccount()}catch(e){}
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
      hideDeviceRequestBanner();currentRequestId=null;toast('Request denied');
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
      if(okLib&&window.QRCode&&box){try{new window.QRCode(box,{text:payload,width:188,height:188,colorDark:'#101216',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M})}catch(e){console.error('QRCode render error:',e);if(box)box.innerHTML='<small style="display:block;max-width:190px;color:#d32f2f;font-size:11px">QR code error — phone par ye link kholo: <a href="'+payload+'" target="_blank" style="color:#0070f3">Open link</a></small>'}}
      else if(box){box.innerHTML='<small style="display:block;max-width:190px;color:#d32f2f;font-size:11px">QR library load nahi hua — phone par ye link kholo: <a href="'+payload+'" target="_blank" style="color:#0070f3">Open link</a></small>'}
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
        sessionStorage.setItem('bca-qr-account',JSON.stringify({uid:row.uid,email:row.email||'',displayName:row.display_name||'',emailVerified:true}));
        accountSession={uid:row.uid,email:row.email||'',displayName:row.display_name||'',photoURL:null,emailVerified:true};
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
              try{localStorage.setItem('bca-sem',state.sem)}catch(e){}
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
    function restoreQrSession(){try{const raw=sessionStorage.getItem('bca-qr-account');if(!raw)return false;const a=JSON.parse(raw);if(a&&a.uid){accountSession={uid:a.uid,email:a.email||'',displayName:a.displayName||'',photoURL:null,emailVerified:true};return true}}catch(e){}return false}
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
    /* ================== In-app QR Scanner (mobile) ==================
       User ko alag scanner app kholne ki zaroorat nahi — web app ke andar hi
       camera se desktop ka QR scan karke approve/deny kar sakta hai.
       BarcodeDetector API (native, fast) + jsQR fallback (CDN lazy-load). */
    let qrScanStream=null,qrScanTimer=null;
    function loadJsQr(){
      if(window.jsQR)return Promise.resolve(true);
      if(loadJsQr._p)return loadJsQr._p;
      loadJsQr._p=new Promise(res=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';s.onload=()=>res(true);s.onerror=()=>{loadJsQr._p=null;res(false)};document.head.appendChild(s)});
      return loadJsQr._p;
    }
    function handleScannedQr(text){
      let id=null;
      try{
        const url=new URL(text);
        id=url.searchParams.get('qr');
      }catch(e){/* plain text QR */}
      if(!id){
        const m=/[?&]qr=([^&]+)/.exec(text||'');
        if(m)id=decodeURIComponent(m[1]);
      }
      return id;
    }
    function stopQrScannerCamera(){
      if(qrScanTimer){clearInterval(qrScanTimer);qrScanTimer=null}
      if(qrScanStream){try{qrScanStream.getTracks().forEach(t=>t.stop())}catch(e){}qrScanStream=null}
      const v=document.getElementById('qrScanVideo');
      if(v){try{v.srcObject=null}catch(e){}}
    }
    async function openQrScanner(){
      const modal=$('qrScanModal'),msg=$('qrScanMsg');
      if(!modal)return;
      hideProfileCard();
      closeModals();
      modal.classList.add('open');
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){if(msg)msg.textContent='Is browser me camera support nahi hai — phone ka default camera app use karo.';return}
      try{
        qrScanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}},audio:false});
      }catch(err){
        console.warn('[qr-scan] camera error:',err);
        if(msg)msg.textContent='Camera nahi khul paya — permission do ya phone ke camera app se scan karo.';
        return;
      }
      const video=document.getElementById('qrScanVideo');
      if(!video){stopQrScannerCamera();return}
      video.srcObject=qrScanStream;
      try{await video.play()}catch(e){}
      if(msg)msg.textContent='QR code camera me dikhao…';
      /* Native BarcodeDetector pehle (fast), warna jsQR canvas par */
      let detector=null;
      try{if('BarcodeDetector' in window){detector=new window.BarcodeDetector({formats:['qr_code']})}}catch(e){}
      if(!detector)await loadJsQr();
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      let done=false;
      const tick=async()=>{
        if(done||!qrScanStream||video.readyState<2)return;
        try{
          let text=null;
          if(detector){
            const codes=await detector.detect(video);
            if(codes&&codes.length&&codes[0].rawValue)text=codes[0].rawValue;
          }else if(window.jsQR){
            canvas.width=video.videoWidth;canvas.height=video.videoHeight;
            ctx.drawImage(video,0,0);
            const img=ctx.getImageData(0,0,canvas.width,canvas.height);
            const res=window.jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});
            if(res&&res.data)text=res.data;
          }
          if(text){
            const id=handleScannedQr(text);
            if(id){
              done=true;
              stopQrScannerCamera();
              modal.classList.remove('open');
              toast('QR scan ho gaya ✓');
              maybePromptQrApproval(id);
            }
          }
        }catch(e){}
      };
      qrScanTimer=setInterval(tick,250);
    }
    function closeQrScanner(){
      stopQrScannerCamera();
      const m=$('qrScanModal');if(m)m.classList.remove('open');
    }
    async function submitAccount(event){event.preventDefault();if(!firebaseApp){$('accountMessage').textContent='Firebase is not configured.';return}const password=$('accountPassword').value;const msgEl=$('accountMessage');if(accountMode==='signup'){const username=$('accountName').value.trim().toLowerCase();if(!isValidUsername(username)){msgEl.textContent='Username must be 3\u201320 letters, numbers or _ (no spaces).';return}if(!checkPasswordMatch(password,$('accountConfirm'),msgEl))return;pendingSignup={username,password};msgEl.textContent='Opening Google sign-in\u2026';await signInWithProvider('google','accountMessage');return}const loginEmail=await resolveLoginEmail($('accountEmail').value,msgEl);if(!loginEmail)return;msgEl.textContent='Working...';try{await firebase.auth().signInWithEmailAndPassword(loginEmail,password);accountSession=firebase.auth().currentUser;if(await ensureVerified(accountSession)){sessionStorage.removeItem('bca-guest-mode');renderGreeting();renderAccount();toast('Account connected')}else{renderAccount()}}catch(error){$('accountMessage').textContent=error.message;return}}
    async function signOutAccount(){await firebase.auth().signOut();accountSession=null;try{stopQrSession();sessionStorage.removeItem('bca-qr-linked');sessionStorage.removeItem('bca-qr-account')}catch(e){}hideAuthenticatedApp();$('accountAuth').innerHTML='<h3 id="accountTitle"></h3><p id="accountDescription"></p><form class="account-form" id="accountForm"><label id="accountNameLabel">Name<input id="accountName" type="text" autocomplete="name"></label><label>Email<input id="accountEmail" type="email" autocomplete="email" required></label><label>Password<input id="accountPassword" type="password" autocomplete="new-password" minlength="6" required></label><label id="accountConfirmLabel" hidden>Confirm Password<input id="accountConfirm" type="password" autocomplete="new-password" minlength="6"></label><button class="primary" id="accountSubmit" type="submit"></button></form><div class="oauth-actions"><button class="oauth-button" type="button" onclick="signInWithProvider(\'google\')"><i class="fa-brands fa-google"></i> Continue with Google</button></div><p class="account-message" id="accountMessage" aria-live="polite"></p><button class="account-switch" id="accountSwitch" type="button"></button>';bindAccountForm();renderAccount();toast('Logged out');setTimeout(maybeStartQrLogin,80)}
    function bindAccountForm(){$('accountForm').addEventListener('submit',submitAccount);$('accountSwitch').addEventListener('click',()=>setAccountMode(accountMode==='signup'?'login':'signup'))}
    function openCollege(){renderColleges();$('collegeModal').classList.add('open')};function openProfile(){$('profileCollege').textContent=(colleges.find(c=>c[0]===state.college)||colleges[0])[1];$('profileSaved').textContent=state.saved.length;$('profileUploads').textContent=JSON.parse(localStorage.getItem('bca-uploads')||'[]').length;renderAvatar();renderAccount();renderMyUploads();$('profileModal').classList.add('open')};function openUpload(){if(!requireAccount('Sign up or login to upload study material.','upload'))return;const fileBox=document.querySelector('.file-box');if(fileBox)fileBox.style.borderColor='var(--brand)';$('uploadModal').classList.add('open');updateUploadSubjects()};function closeModals(){stopQrScannerCamera();const dg=$('deviceGateModal');document.querySelectorAll('.modal').forEach(m=>{if(m!==dg)m.classList.remove('open')});closeSuggestions();const pb=$('previewBody');if(pb)pb.innerHTML='';const rf=$('readerFrame');if(rf)rf.src='about:blank';try{pendingHelpRequest=null}catch(e){}}
    function getAvatar(){const saved=localStorage.getItem('bca-avatar');if(saved)return saved;if(accountSession&&accountSession.photoURL)return accountSession.photoURL;return initialsAvatar(accountSession?getUserName(accountSession):'Guest')}
    function initialsAvatar(name){const letter=((name||'S').trim().charAt(0).toUpperCase()||'S');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="60" fill="#23808f"/><text x="60" y="79" font-family="Arial,sans-serif" font-size="54" font-weight="700" text-anchor="middle" fill="#ffffff">${letter}</text></svg>`;return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg)}
    function renderAvatar(){const img=$('avatarImg');if(!img)return;img.src=getAvatar();const nameEl=$('profileIdName');if(nameEl)nameEl.textContent=accountSession?getUserName(accountSession):'Guest';const mailEl=$('profileIdMail');if(mailEl)mailEl.textContent=accountSession&&accountSession.email?accountSession.email:'Browsing as guest';const tb=$('topbarAvatar');if(tb)tb.src=getAvatar()}
    function changeAvatar(input){const f=input.files&&input.files[0];if(!f)return;if(!/^image\//.test(f.type)){toast('Please choose an image file');input.value='';return}if(f.size>2*1024*1024){toast('Pick an image under 2 MB');input.value='';return}const reader=new FileReader();reader.onload=()=>{localStorage.setItem('bca-avatar',reader.result);renderAvatar();toast('Profile photo updated')};reader.readAsDataURL(f);input.value=''}
    function toggleProfileCard(event){if(event)event.stopPropagation();const pop=$('profilePop');if(!pop)return;const willShow=pop.hidden;if(willShow){const av=$('popAvatar');if(av)av.src=getAvatar();const n=$('popName');if(n)n.textContent=accountSession?getUserName(accountSession):'Guest';const m=$('popMail');if(m)m.textContent=accountSession&&accountSession.email?accountSession.email:'Browsing as guest';const c=$('popCollege');if(c)c.textContent=(colleges.find(cc=>cc[0]===state.college)||colleges[0])[1];const s=$('popSem');if(s)s.textContent=state.sem==='all'?'All semesters':'Semester '+state.sem;}const lo=$('popLogoutBtn');if(lo)lo.hidden=!accountSession;const lb=$('popLoginBtn');if(lb)lb.hidden=!!accountSession;pop.hidden=!willShow}
    function hideProfileCard(){const pop=$('profilePop');if(pop&&!pop.hidden)pop.hidden=true}
    function logoutFromPop(){hideProfileCard();if(firebaseApp&&accountSession){signOutAccount();return}sessionStorage.removeItem('bca-guest-mode');accountSession=null;hideAuthenticatedApp();toast('Logged out')}
    function renderColleges(query=''){const q=query.toLowerCase();const ranked=[...colleges].sort((a,b)=>{if(a[0]==='all')return -1;if(b[0]==='all')return 1;const order=['ccsu','du','ipu','aktu','ignou','mdu','bhu','pune','bangalore'];const aIndex=order.indexOf(a[0]);const bIndex=order.indexOf(b[0]);if(aIndex!==-1||bIndex!==-1){if(aIndex===-1)return 1;if(bIndex===-1)return -1;return aIndex-bIndex}return a[1].localeCompare(b[1])});$('collegeList').innerHTML=ranked.filter(c=>c[1].toLowerCase().includes(q)).map(c=>`<button class="college-option ${state.college===c[0]?'selected':''}" onclick="selectCollege('${c[0]}')"><span><b>${escHtml(c[1])}</b><small>BCA resources</small></span><i class="fa-solid ${state.college===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function selectCollege(id){state.college=id;localStorage.setItem('bca-college',id);$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||['',id])[1];closeModals();renderSubjectFilter();render();saveProfileToAccount()}
    function useCustomCollege(){const input=$('collegeCustom');const name=input.value.trim();if(!name){input.focus();return}const college=['custom-'+Date.now(),name];colleges.push(college);localStorage.setItem('bca-custom-colleges',JSON.stringify([...JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]'),college]));input.value='';selectCollege(college[0])}
    let uploadFiles=[]; /* client-side managed File list (enables reorder/delete) */
    function showFile(input){
      refreshUploadFiles(input&&input.files?input.files:null);
    }
    /* Rebuild uploadFiles from a FileList (or null to clear), then re-render UI */
    function refreshUploadFiles(fileList){
      if(!fileList||!fileList.length){uploadFiles=[];$('fileName').textContent='Choose files or drag & drop — PDF, DOCX, PPTX, images';$('uploadFileBadges').hidden=true;renderPhotoGrid();return}
      const files=Array.from(fileList);
      const MAX_BATCH_BYTES=15*1024*1024;let totalSize=0;for(let i=0;i<files.length;i++)totalSize+=files[i].size;
      if(totalSize>MAX_BATCH_BYTES){toast('Total batch too large ('+Math.round(totalSize/1024/1024)+'MB). Max 15MB per upload.');return}
      uploadFiles=files;
      let imgCount=0,docCount=0,otherCount=0;
      for(let i=0;i<files.length;i++){const n=files[i].name.toLowerCase();if(/\.(jpe?g|png|webp|heic)$/i.test(n))imgCount++;else if(/\.(pdf|docx?|pptx?)$/i.test(n))docCount++;else otherCount++}
      if(files.length===1){$('fileName').textContent=files[0].name}else{$('fileName').textContent=files.length+' files selected'}
      const badgesEl=$('uploadFileBadges');badgesEl.innerHTML='';badgesEl.hidden=false;
      if(imgCount>0)badgesEl.innerHTML+='<span class="upload-badge img"><i class="fa-solid fa-image"></i>📸 '+imgCount+' Photo'+(imgCount>1?'s':'')+' selected <span class="upt">→</span> Will be auto-merged into 1 clean PDF</span>';
      if(docCount>0)badgesEl.innerHTML+='<span class="upload-badge doc"><i class="fa-solid fa-file-lines"></i>'+docCount+' Document'+(docCount>1?'s':'')+'</span>';
      if(otherCount>0)badgesEl.innerHTML+='<span class="upload-badge other"><i class="fa-solid fa-file-zipper"></i>'+otherCount+' file'+(otherCount>1?'s':'')+'</span>';
      renderPhotoGrid();
    }
    /* Thumbnail grid of selected photos with reorder (page order) + delete */
    function renderPhotoGrid(){
      const wrap=$('uploadPhotoWrap');if(!wrap)return;
      const imgs=uploadFiles.filter(f=>window.isImageFile?window.isImageFile(f):/\.(jpe?g|png|webp|heic)$/i.test(f.name.toLowerCase()));
      if(!imgs.length){wrap.hidden=true;wrap.innerHTML='';return}
      wrap.hidden=false;
      const header='<div class="photo-grid-head"><span>📸 '+imgs.length+' photo'+(imgs.length>1?'s':'')+'</span><small>Reorder so Page 1, 2, 3 stays in order</small></div>';
      const cards=imgs.map((f,idx)=>`
        <div class="photo-card" data-idx="${idx}">
          <div class="photo-thumb"><img alt="photo ${idx+1}" data-fileidx="${uploadFiles.indexOf(f)}"></div>
          <span class="photo-num">${idx+1}</span>
          <div class="photo-actions">
            <button type="button" class="photo-btn" title="Move up" onclick="moveUploadPhoto(${idx},-1)" ${idx===0?'disabled':''}>&#9650;</button>
            <button type="button" class="photo-btn" title="Move down" onclick="moveUploadPhoto(${idx},1)" ${idx===imgs.length-1?'disabled':''}>&#9660;</button>
            <button type="button" class="photo-btn del" title="Remove" onclick="removeUploadPhoto(${idx})">&times;</button>
          </div>
        </div>`).join('');
      wrap.innerHTML=header+'<div class="photo-grid">'+cards+'</div>';
      /* lazy fill thumbnails */
      imgs.forEach((f,idx)=>{
        const fileIdx=uploadFiles.indexOf(f);
        const imgEl=wrap.querySelector('img[data-fileidx="'+fileIdx+'"]');
        if(imgEl){
          const url=URL.createObjectURL(f);
          imgEl.onload=()=>{try{URL.revokeObjectURL(url)}catch(e){}};
          imgEl.onerror=()=>{imgEl.onerror=null;imgEl.outerHTML='<div class="photo-thumb ph-fallback"><i class="fa-solid fa-image"></i></div>';try{URL.revokeObjectURL(url)}catch(e){}};
          imgEl.src=url;
        }
      });
    }
    function removeUploadPhoto(idx){
      const imgs=uploadFiles.filter(f=>window.isImageFile?window.isImageFile(f):/\.(jpe?g|png|webp|heic)$/i.test(f.name.toLowerCase()));
      const f=imgs[idx];if(!f)return;
      uploadFiles=uploadFiles.filter(x=>x!==f);
      refreshUploadFiles(uploadFiles);
    }
    function moveUploadPhoto(idx,dir){
      const imgs=uploadFiles.filter(f=>window.isImageFile?window.isImageFile(f):/\.(jpe?g|png|webp|heic)$/i.test(f.name.toLowerCase()));
      const to=idx+dir;
      if(!imgs[idx]||to<0||to>=imgs.length)return;
      const ordered=uploadFiles.slice();
      const srcIdxs=imgs.map(f=>ordered.indexOf(f));
      const a=srcIdxs[idx],b=srcIdxs[to];
      const tmp=ordered[a];ordered[a]=ordered[b];ordered[b]=tmp;
      uploadFiles=ordered;
      renderPhotoGrid();
    }
    function clearUploadFiles(){
      refreshUploadFiles(null);
      const input=document.getElementById('file');if(input)input.value='';
    }
    /* Expose for inline onclick handlers in the photo grid */
    window.removeUploadPhoto=removeUploadPhoto;
    window.moveUploadPhoto=moveUploadPhoto;
    window.clearUploadFiles=clearUploadFiles;
    /* ---- Drag & drop support for the upload dropzone ---- */
    function bindUploadDropzone(){
      const box=document.getElementById('fileBox');
      if(!box)return;
      ['dragenter','dragover'].forEach(ev=>box.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();box.classList.add('drag-over')}));
      ['dragleave','dragend','mouseout'].forEach(ev=>box.addEventListener(ev,function(e){e.preventDefault?e.preventDefault():0;box.classList.remove('drag-over')}));
      box.addEventListener('drop',function(e){
        e.preventDefault();e.stopPropagation();box.classList.remove('drag-over');
        const files=e.dataTransfer&&e.dataTransfer.files;
        if(files&&files.length){showFile({files:files})}
        else{toast('That doesn\'t look like a file — drag a PDF/photo here')}
      });
    }
    function previewResource(id){const resource=resources.find(item=>item.title.replace(/\W/g,'')===id);if(!resource)return;const src=resource.fileUrl||resource.fileData;if(!src){toast('Preview not available for this demo item');return}
      ensureFileAvailable(resource,'preview').then(ok=>{if(ok)showPreview(resource)});
    }
    function showPreview(resource){const src=resource.fileUrl||resource.fileData;
      $('previewTitle').textContent=resource.title;
      const kindLabel=resource.type==='pyq'?'Previous year paper':'Notes';
      $('previewMeta').textContent=`${kindLabel} · Semester ${resource.sem}${resource.fileName?' · '+resource.fileName:''}`;
      const body=$('previewBody');body.innerHTML='';
      const lower=((resource.fileName||'')+' '+src.split('?')[0].split('#')[0]).toLowerCase();
      const isDocx=/\.docx(\?|$)/.test(lower);
      const isPptx=/\.pptx(\?|$)/.test(lower);
      const isOffice=isDocx||isPptx;
      if(src.startsWith('data:image')||/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lower)){
        const img=document.createElement('img');img.className='preview-image';img.src=src;img.alt=resource.title;body.appendChild(img);
      }else if(src.startsWith('data:application/pdf')||/\.pdf(\?|$)/.test(lower)){
        const frame=document.createElement('iframe');frame.className='preview-embed';frame.src=src;frame.setAttribute('title',resource.title);body.appendChild(frame);
      }else if(isOffice&&!src.startsWith('data:')){
        /* Office docs: embed via Google Docs Viewer */
        const gurl='https://docs.google.com/gview?url='+encodeURIComponent(src)+'&embedded=true';
        const frame=document.createElement('iframe');frame.className='preview-embed';frame.src=gurl;frame.setAttribute('title',resource.title);frame.style.minHeight='500px';body.appendChild(frame);
      }else{
        body.innerHTML='<div class="preview-fallback"><i class="fa-solid fa-file-circle-question"></i><strong>Inline preview is not available for this format</strong><small>Use the Open full file button below to view or download it.</small></div>';
      }
      $('previewOpenLink').href=src;
      trackEvent('view',{title:resource.title,type:resource.type,subject:resource.subject,sem:resource.sem});bumpView(rcId(resource.title));
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
      const row={title:upload.title,type:upload.type,subject:upload.subject,college:upload.college,semester:upload.sem,year:upload.year,file_name:file.name,file_url:publicData.publicUrl,status:'pending',downloads:0,uploader_email:upload.uploaderEmail||'',uploader_name:upload.uploader||''};
      const {error:insertError}=await supabaseClient.from('resources').insert(row);
      if(insertError) throw insertError;
      // Fire-and-forget: admin ko naye upload ka push alert (role='admin' targeting)
      try{
        if(typeof SEND_PUSH_FUNCTION_URL!=='undefined'&&typeof SUPABASE_PUBLISHABLE_KEY!=='undefined'){
          const typeLabel=upload.type==='pyq'?'PYQ':'Notes';
          await fetch(SEND_PUSH_FUNCTION_URL,{
            method:'POST',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+SUPABASE_PUBLISHABLE_KEY},
            body:JSON.stringify({
              title:'New '+typeLabel+' uploaded 📥',
              body:(upload.title||'Untitled')+' — '+(upload.uploader||'Anonymous')+' | Sem '+upload.sem+' | waiting for review',
              url:'/admin/admin.html',
              tag:'admin-new-upload',
              alertType:'upload',
              role:'admin',
              secret:'F3g2qnkM18UWbVJUNHRD0-wCbr5IgHUz'
            })
          });
        }
      }catch(e){/* alert fail ho to upload fail na ho */}
      return {...row,title:row.title,type:row.type,sem:row.semester,fileUrl:row.file_url,downloads:0,status:row.status,fileName:file.name,subject:row.subject,college:row.college,uploader:row.uploader_name||''};
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
      setInterval(()=>{if(document.visibilityState==='visible'){loadCloudResources();try{loadSeniorRequests()}catch(e){}}},30000);
    }
    /* ---- Upload progress helpers ---- */
    function showUploadProgress(show,msg,pct){
      const wrap=$('uploadProgress');const fill=$('uploadProgressFill');const txt=$('uploadProgressText');
      if(wrap)wrap.hidden=!show;
      if(fill)fill.style.width=(pct||0)+'%';
      if(txt)txt.textContent=msg||'';
    }
    function hideUploadProgress(){showUploadProgress(false,'',0)}
    async function submitUpload(event){
      try{
      event.preventDefault();
      const form=event.target;
      /* Client-managed list is the source of truth (allows reorder/delete). Fall back to the native input. */
      const allFiles=uploadFiles.length?uploadFiles.slice():Array.from($('file').files||[]);
      if(!allFiles.length){toast('Choose a file first');return;}
      /* ---- 15MB batch size guard ---- */
      let totalSize=0;for(const f of allFiles)totalSize+=f.size;
      if(totalSize>15*1024*1024){toast('Total batch too large ('+Math.round(totalSize/1024/1024)+'MB). Max 15MB per upload.');return}
      const title=form.querySelector('input[name="title"]').value.trim();
      const sem=Number(form.querySelector('select[name="semester"]').value);
      const type=form.querySelector('select[name="type"]').value.toLowerCase();
      const subjectSel=form.querySelector('select[name="subjectSelect"]');
      let subject=subjectSel&&subjectSel.value&&subjectSel.value!=='__other'?subjectSel.value:'';
      if(subjectSel&&subjectSel.value==='__other'){
        const customInput=form.querySelector('input[name="customSubject"]');
        subject=customInput?customInput.value.trim():'';
        if(subject)addCustomSubject(sem,subject);
      }
      subject=subject||'Community upload';
      if(subject==='Community upload'){const linkInput=form.querySelector('input[name="link"]');if(linkInput&&linkInput.value.trim())subject=linkInput.value.trim();}
      const payload={title,type,sem,year:Math.ceil(sem/2),subject:subject || 'Community upload',college:state.college,status:'pending',uploader:accountSession?getUserName(accountSession):'Anonymous',uploaderEmail:accountSession&&accountSession.email?accountSession.email:''};
      let existing=null;
      try{existing=await findExistingUpload(payload)}catch(error){}
      if(existing){toast('Duplicate! Ye material pehle se upload ho chuka hai ('+existing.status+')');return}
      if(isLocalDuplicate(payload)){toast('Duplicate! Ye material aapne pehle hi submit kiya hai — review mein hai');return}
      /* ---- Classify files: images vs other ---- */
      const classified=window.classifyUploadFiles?window.classifyUploadFiles(allFiles):{images:[],others:allFiles};
      const imageFiles=classified.images;
      const otherFiles=classified.others;
      /* ---- Helper: upload a single file and record ---- */
      async function uploadSingleFile(file,opts){
        const reader2=new FileReader();
        const fileData=await new Promise((res,rej)=>{reader2.onload=()=>res(reader2.result);reader2.onerror=rej;reader2.readAsDataURL(file)});
        const cloudUp=await uploadResourceToSupabase(file,{...payload,fileData,...(opts||{})});
        const rec={...cloudUp,title:cloudUp.title,type:cloudUp.type,sem:cloudUp.sem,year:cloudUp.year,subject:cloudUp.subject,college:cloudUp.college,date:'Just now',downloads:0,fileName:file.name,fileData:fileData,status:'pending',uploader:payload.uploader};
        resources.unshift(rec);
        const uploads=JSON.parse(localStorage.getItem('bca-uploads')||'[]').filter(r=>r.type==='notes'||r.type==='pyq');
        uploads.unshift(rec);localStorage.setItem('bca-uploads',JSON.stringify(uploads));
        trackEvent('upload',{title:rec.title,type:rec.type,subject:rec.subject,sem:rec.sem});
        return rec;
      }
      showUploadProgress(true,'Preparing files…',0);
      const submitBtn=form.querySelector('button[type="submit"]');
      if(submitBtn)submitBtn.disabled=true;
      try{
        /* ---- If images present: auto-convert to single PDF ---- */
        if(imageFiles.length>0&&window.convertImagesToPdf){
          showUploadProgress(true,'Merging '+imageFiles.length+' photo'+(imageFiles.length>1?'s':'')+' into PDF…',5);
          let convResult;
          try{
            convResult=await window.convertImagesToPdf(imageFiles,(pct,msg)=>{showUploadProgress(true,msg,10+pct*0.5)},{subject:subject});
          }catch(convErr){
            console.error('[BCAPrime] Image conversion failed:',convErr);
            toast('Image conversion failed. Uploading images as-is…');
            for(const imgF of imageFiles){await uploadSingleFile(imgF)}
            convResult=null;
          }
          if(convResult&&convResult.blob){
            showUploadProgress(true,'Uploading notes to BCAPrime…',65);
            const convFile=new File([convResult.blob],convResult.filename,{type:'application/pdf'});
            await uploadSingleFile(convFile);
          }
        }
        /* ---- Upload non-image files ---- */
        if(otherFiles.length){
          showUploadProgress(true,'Uploading notes to BCAPrime…',80);
          for(const f of otherFiles){
            showUploadProgress(true,'Uploading '+f.name+'…',80);
            await uploadSingleFile(f);
          }
        }
        showUploadProgress(true,'Submitted successfully! Pending admin approval.',100);
        setTimeout(()=>{hideUploadProgress();closeModals();form.reset();clearUploadFiles();
          render();showUploadSuccess(type);renderMyUploads();
          if(pendingHelpRequest){fulfillJuniorRequest(pendingHelpRequest,'upload');pendingHelpRequest=null}
        },700);
      }catch(error){
        console.error('[BCAPrime] Upload error:',error);
        hideUploadProgress();
        toast('Upload problem: '+(error&&error.message||error));
      }finally{if(submitBtn)submitBtn.disabled=false}
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
      const keys=['bca-onboarded','bca-tour-seen','bca-college','bca-sem','bca-saved','bca-custom-colleges','bca-uploads','bca-theme','bca-theme-manual'];
      keys.forEach(key=>localStorage.removeItem(key));
      location.reload();
    }
    function toast(message){const node=document.createElement('div');node.className='toast';node.textContent=message;$('toastRoot').append(node);setTimeout(()=>node.remove(),2300)}
    /* HTML escaping — user-supplied strings (college/subject names etc.) ko
       innerHTML me daalne se pehle escape karo, warna XSS possible hai */
    /* ===== Founder credit config =====
       Jab Instagram link add karna ho bas yahan URL daal do — footer me
       button khud dikhne lagega. Khaali ('') rahega to link hidden rahega. */
    const FOUNDER_INSTAGRAM_URL='';
    try{
      const fi=document.getElementById('founderInsta');
      if(fi&&FOUNDER_INSTAGRAM_URL){fi.href=FOUNDER_INSTAGRAM_URL;fi.hidden=false}
    }catch(e){}
    function escHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m])}
    function escAttr(s){return escHtml(s).replace(/'/g,'&#39;').replace(/\\/g,'\\\\')}
    function escJsStr(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;')}
    let __searchTimeout=null;
    async function initAccount(){if(sessionStorage.getItem('bca-guest-mode')==='true'||(function(){try{return localStorage.getItem('bca-auth-known')==='1'}catch(e){return false}})())showAuthenticatedApp();let __pendQr=null;if(!firebaseApp){$('gateAccountMessage').textContent='Firebase is not configured.';}else{accountSession=firebase.auth().currentUser;if(!accountSession)restoreQrSession();if(accountSession){sessionStorage.removeItem('bca-guest-mode');if(isVerifiedUser(accountSession)){showAuthenticatedApp()}else{saveVerificationStatus(false);hideAuthenticatedApp();showVerifyEmail(accountSession.email||'')}}__pendQr=readQrParam();firebase.auth().onAuthStateChanged(user=>{const qrLinked=sessionStorage.getItem('bca-qr-linked')==='true';/* QR synthetic session ko Firebase ke null user se overwrite hone se bachao */accountSession=user||(qrLinked&&accountSession&&accountSession.uid?accountSession:null);if(authSuppress)return;if(user){sessionStorage.removeItem('bca-guest-mode');if(isVerifiedUser(user)){saveVerificationStatus(true);showAuthenticatedApp();resumeRestrictedAction();const pq=sessionStorage.getItem('bca-pending-qr');if(pq){sessionStorage.removeItem('bca-pending-qr');setTimeout(()=>maybePromptQrApproval(pq),400)}}else{saveVerificationStatus(false);if(sessionStorage.getItem('bca-guest-mode')!=='true'&&sessionStorage.getItem('bca-qr-linked')!=='true')hideAuthenticatedApp();if(!pendingOtpApproval)showVerifyEmail(user.email||'')}}else if(sessionStorage.getItem('bca-guest-mode')!=='true'&&sessionStorage.getItem('bca-qr-linked')!=='true')hideAuthenticatedApp();if($('profileModal').classList.contains('open'))renderAccount()})}if(__pendQr)setTimeout(()=>maybePromptQrApproval(__pendQr),400);maybeStartQrLogin()}
    document.addEventListener('click',e=>{if(e.target.classList.contains('modal'))closeModals(); if(!e.target.closest('.hero-search'))closeSuggestions(); if(!e.target.closest('.profile-pop')&&!e.target.closest('#topbarAvatarBtn'))hideProfileCard();});window.addEventListener('DOMContentLoaded',()=>{init();trackEvent('visit');bindAccountForm();startLibrarySync();setGateMode(gateMode);$('gateAccountForm').addEventListener('submit',submitGateAccount);$('gateAccountSwitch').addEventListener('click',()=>setGateMode(gateMode==='signup'?'login':'signup'));$('accessAuthForm').addEventListener('submit',submitAccessAuth);$('accessAuthSwitch').addEventListener('click',()=>setAccessAuthMode(accessAuthMode==='signup'?'login':'signup'));initAccount();bindOtpInputs();initOffline()});
    /* ================= Offline / online UX (offline-first PWA) =================
       Big-tech pattern (Google/Netflix ki tarah):
       - Jab user offline ho -> top par dismissible notification banner (ek baar)
       - Net wapas aaye -> ek hi baar "back online ✨" toast (bar-bar nag nahi)
       - Jo file pehle kholi/download ki -> cache-first, offline bhi khulti hai
       - Jo file cache nahi hai aur offline hai -> dialog + WiFi/data setting option
       ================================================================= */
    let __offlineEl=null, __wasOffline=false, __onlineToastAt=0, __pendingOfflineAction=null;

    function showOfflineBanner(){
      if(__offlineEl)return;
      __offlineEl=document.createElement('aside');
      __offlineEl.className='offline-banner';
      __offlineEl.setAttribute('aria-live','polite');
      __offlineEl.innerHTML='<i class="fa-solid fa-wifi"></i><span><strong>You\'re offline</strong>&nbsp;·&nbsp;showing your saved library — files you opened before still work.</span><button type="button" class="offline-dismiss" aria-label="Dismiss" onclick="dismissOfflineBanner()"><i class="fa-solid fa-xmark"></i></button>';
      document.body.appendChild(__offlineEl);
      requestAnimationFrame(()=>{if(__offlineEl)__offlineEl.classList.add('show')});
    }
    function dismissOfflineBanner(){
      if(!__offlineEl)return;
      const el=__offlineEl;__offlineEl=null;
      el.classList.add('hide');
      setTimeout(()=>{try{el.remove()}catch(e){}},350);
    }
    function updateOfflineUI(){
      const offline=!navigator.onLine;
      document.documentElement.setAttribute('data-offline',offline?'true':'false');
      if(offline){
        __wasOffline=true;
        showOfflineBanner();
      }else{
        const cameBack=__wasOffline;
        __wasOffline=false;
        dismissOfflineBanner();
        if(cameBack&&Date.now()-__onlineToastAt>5000){
          __onlineToastAt=Date.now();
          toast('You\'re back online ✨');
        }
      }
    }
    function initOffline(){
      updateOfflineUI();
      window.addEventListener('offline',updateOfflineUI);
      window.addEventListener('online',updateOfflineUI);
      /* Offline reload ki case mein direct library render — navigator.onLine par bharosa */
      if(!navigator.onLine)setTimeout(()=>{try{render()}catch(e){}},300);
    }

    /* ---- Offline dialog: file is remote + uncached + offline ---- */
    function isRemoteFile(src){return /^https?:\/\//i.test(src||'')}
    async function isFileCached(url){
      try{
        if(!('caches' in window))return false;
        const names=await caches.keys();
        for(const name of names){
          try{const cache=await caches.open(name);if(await cache.match(url,{ignoreSearch:true}))return true}catch(e){}
        }
      }catch(e){}
      return false;
    }
    async function ensureFileAvailable(resource,action){
      const src=resource&&(resource.fileUrl||resource.fileData);
      if(!isRemoteFile(src))return true;               // data: URLs hamesha offline available
      if(navigator.onLine)return true;                 // online hai to direct proceed
      if(await isFileCached(src))return true;          // pehle khola/download kiya hai
      __pendingOfflineAction={resource,action};        // nahi -> dialog + net ka option do
      const m=$('offlineModal');if(m)m.classList.add('open');
      return false;
    }
    function retryOfflineAction(){
      if(!__pendingOfflineAction)return;
      const {resource,action}=__pendingOfflineAction;__pendingOfflineAction=null;
      const m=$('offlineModal');if(m)m.classList.remove('open');
      if(navigator.onLine){try{if(action==='preview')previewResource(resource.title.replace(/\W/g,''));else download(resource.title)}catch(e){}}
      else toast('Still offline — turn on WiFi or mobile data, then Retry.');
    }
    function openNetworkSettings(){
      const m=$('offlineModal');if(m)m.classList.remove('open');
      toast('Turn on WiFi or mobile data from your device settings, then press Retry.');
    }
    function closeOfflineModal(){
      const m=$('offlineModal');if(m)m.classList.remove('open');
    }

    /* ---- User profile ko local cache karo taaki offline bhi dikhe ---- */
    function cacheProfile(){
      try{if(!accountSession)return;localStorage.setItem('bca-profile-cache',JSON.stringify({name:getUserName(accountSession),email:accountSession.email||'',photo:accountSession.photoURL||''}))}catch(e){}
    }
    function showOnboarding(){if(localStorage.getItem('bca-onboarded'))return;state.onboardingDone=false;state.onboardingSem='';renderOnboardingColleges();const track=$('obTrack');if(track)track.classList.remove('step2');$('onboarding').classList.add('open')}
    /* ===== NEW FEATURES =====
       1) Save for offline (Netflix-style) — files device pe cache
       2) Library skeleton loading — jaldi dikhe
       3) Upvotes / ratings — community vote
       4) In-app PDF reader — full-screen, zoom + offline */
    const OFFLINE_CACHE='bcaprime-files-v1';
    const OFFLINE_SAVED_KEY='bca-offline-saved';
    const MY_UPVOTES_KEY='bca-my-upvotes';
    function _jsonList(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return[]}}
    function _setJsonList(key,list){try{localStorage.setItem(key,JSON.stringify(list))}catch(e){}}
    /* 1) Save for offline */
    function isOfflineSaved(id){return _jsonList(OFFLINE_SAVED_KEY).includes(id)}
    async function saveOfflineResource(id){
      const resource=resources.find(item=>item.title.replace(/\W/g,'')===id);
      if(!resource)return;
      const src=resource.fileUrl||resource.fileData;
      const saved=_jsonList(OFFLINE_SAVED_KEY);
      if(saved.includes(id)){
        _setJsonList(OFFLINE_SAVED_KEY,saved.filter(x=>x!==id));
        toast('Removed from offline');render();
        return;
      }
      if(!src){toast('Nothing to save for this item');return}
      if(isRemoteFile(src)){
        if(!navigator.onLine){toast('Offline — connect once to save this file');return}
        try{
          const cache=await caches.open(OFFLINE_CACHE);
          const res=await fetch(src);
          if(!res.ok)throw new Error('bad');
          await cache.put(src,res.clone());
        }catch(e){toast('Could not save this file right now');return}
      }
      saved.push(id);
      _setJsonList(OFFLINE_SAVED_KEY,saved);
      toast('Saved for offline ✅');
      render();
    }
    /* 2) Skeleton loading */
    function showSkeleton(){
      const g=$('resources');if(!g)return;
      let s='';for(let i=0;i<6;i++){s+='<div class="resource skeleton-card"><div class="sk sk-line w55"></div><div class="sk sk-line w40"></div><div class="sk sk-line w75"></div><div class="sk sk-line w50"></div><div class="sk sk-line w90"></div></div>'}
      g.innerHTML=s;
      setTimeout(()=>{try{if(!resources.length)render()}catch(e){}},9000);
    }
    /* 3) Upvotes / ratings */
    function didUpvote(id){return _jsonList(MY_UPVOTES_KEY).includes(id)}
    function upvoteDisplay(r){const id=r.title.replace(/\W/g,'');const base=(typeof r.upvotes==='number')?r.upvotes:0;return base+(didUpvote(id)?1:0)}
    async function toggleUpvote(id){
      const list=_jsonList(MY_UPVOTES_KEY);
      const liked=list.includes(id);
      _setJsonList(MY_UPVOTES_KEY,liked?list.filter(x=>x!==id):[...list,id]);
      render();
      toast(liked?'Upvote removed':'Upvoted 👍');
      try{if(supabaseClient){const resource=resources.find(item=>item.title.replace(/\W/g,'')===id);if(resource){const delta=liked?-1:1;const newCount=(typeof resource.upvotes==='number'?resource.upvotes:0)+delta;resource.upvotes=newCount;await supabaseClient.from('resources').update({upvotes:newCount}).eq('title',resource.title)}}}catch(e){}
    }
    /* 4) In-app PDF reader */
    let readerZoom=1;
    function openReader(resource){
      const src=resource.fileUrl||resource.fileData;if(!src)return;
      /* Inline-only rendering: PDF fragment params force desktop browsers to render
         the PDF in-page instead of prompting a download dialog. data: URLs cannot
         carry fragment params, so they are used as-is. */
      const inlineSrc=src.startsWith('data:')?src:src+'#toolbar=0&navpanes=0&view=FitH';
      const name=resource.fileName||'';
      const isDocx=/\.docx$/i.test(name)||/\.docx(\?|#|$)/i.test(src);
      const isOldDoc=/\.doc(\?|#|$)/i.test(name)||/\.doc(\?|#|$)/i.test(src);
      const isPptx=/\.pptx$/i.test(name)||/\.pptx(\?|#|$)/i.test(src);
      const docxPane=$('readerDocx');const frm=$('readerFrame');
      readerZoom=1;
      $('readerTitle').textContent=resource.title;
      $('readerOpen').href=src;
      $('readerOpen').setAttribute('download',resource.fileName||resource.title.replace(/\W+/g,'-')+'.pdf');
      if(isPptx&&!src.startsWith('data:')){
        /* PPTX: use Google Docs Viewer for inline preview */
        if(frm){frm.hidden=true;frm.src='about:blank'}
        if(docxPane){
          docxPane.hidden=false;
          var gurl='https://docs.google.com/gview?url='+encodeURIComponent(src)+'&embedded=true';
          docxPane.innerHTML='<iframe class="gdocs-embed" src="'+gurl+'" title="'+resource.title+'" style="width:100%;height:100%;min-height:500px;border:none"></iframe>';
        }
      }else if(isDocx&&window.mammoth){
        /* DOCX: browsers can't render Word files inline, so convert to HTML
           in-app with Mammoth and show it in the reader pane (no download). */
        if(frm){frm.hidden=true;frm.src='about:blank'}
        if(docxPane){
          docxPane.hidden=false;
          docxPane.innerHTML='<p class="docx-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading document…</p>';
          fetch(src).then(r=>{if(!r.ok)throw new Error('fetch failed');return r.arrayBuffer()})
            .then(buf=>window.mammoth.convertToHtml({arrayBuffer:buf}))
            .then(res=>{docxPane.innerHTML=res.value||'<p class="docx-error">This document appears to be empty.</p>';applyReaderZoom()})
            .catch(()=>{docxPane.innerHTML='<p class="docx-error"><i class="fa-solid fa-triangle-exclamation"></i> Is document ko app ke andar khol nahi paye. Download karke dekhein.</p>'});
        }
      }else if(isOldDoc||isDocx){
        /* Legacy .doc (or Mammoth unavailable): cannot render inline — guide to download. */
        if(frm){frm.hidden=true;frm.src='about:blank'}
        if(docxPane){docxPane.hidden=false;docxPane.innerHTML='<p class="docx-error"><i class="fa-solid fa-file-word"></i> Purane .doc format ki file app ke andar nahi khulti. Download karke MS Word me dekhein.</p>'}
      }else{
        if(docxPane){docxPane.hidden=true;docxPane.innerHTML=''}
        if(frm){frm.hidden=false;frm.src=inlineSrc}
      }
      $('readerModal').classList.add('open');
      applyReaderZoom();
    }
    function closeReader(){const m=$('readerModal');if(m)m.classList.remove('open');const f=$('readerFrame');if(f){f.src='about:blank';f.hidden=false}const d=$('readerDocx');if(d){d.hidden=true;d.innerHTML=''}}
    function applyReaderZoom(){const f=$('readerFrame');if(f&&!f.hidden)f.style.transform='scale('+readerZoom+')';const v=$('readerZoomVal');if(v)v.textContent=Math.round(readerZoom*100)+'%';const d=$('readerDocx');if(d&&!d.hidden)d.style.fontSize=Math.round(16*readerZoom)+'px'}
    function readerZoomIn(){readerZoom=Math.min(3,+(readerZoom+0.25).toFixed(2));applyReaderZoom()}
    function readerZoomOut(){readerZoom=Math.max(0.5,+(readerZoom-0.25).toFixed(2));applyReaderZoom()}

    /* ================= SENIOR HELP REQUESTS =================
       Juniors (sem N) apne seniors (sem N+1..6) se notes/PYQ maangte hain.
       Sem 6 = koi senior nahi -> option hidden.
       ------------------------------------------------------ */
    const SENIOR_TABLE='senior_requests';
    const NOTIFY_SENIORS_URL=SUPABASE_URL+'/functions/v1/notify-seniors';
    function mySemNumber(){const v=Number(state.sem);return(v>=1&&v<=6)?v:0}
    function myCollegeKey(){return state.college||'all'}
    function canRequestSenior(){return mySemNumber()>=1&&mySemNumber()<=5}
    function openSeniorRequest(){
      if(!accountSession){requireAccount('Log in to ask your seniors for notes/PYQs.','feedback');return}
      if(!canRequestSenior()){toast('You\'re in the final semester — koi senior nahi. Aap juniors ko help kar sakte hain!');return}
      const rg=$('srRange');if(rg)rg.textContent=String(mySemNumber()+1)+'–6';
      $('srSubject').value='';$('srMessage').value='';
      const t=document.querySelector('.sr-type.active');if(t){t.classList.remove('active')}
      const def=document.querySelector('.sr-type[data-type="notes"]');if(def)def.classList.add('active');
      $('seniorReqModal').classList.add('open');
    }
    function closeSeniorRequest(){const m=$('seniorReqModal');if(m)m.classList.remove('open')}
    function setSrType(btn){document.querySelectorAll('.sr-type').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')}
    async function submitSeniorRequest(event){
      event.preventDefault();
      if(!accountSession){requireAccount('Log in to ask your seniors.','feedback');return}
      const sem=mySemNumber();if(!canRequestSenior()){toast('Semester 6 wale senior nahi maang sakte');return}
      const subject=$('srSubject').value.trim();
      const message=$('srMessage').value.trim();
      if(!subject){toast('Subject/notes name likho');return}
      const typeBtn=document.querySelector('.sr-type.active')||document.querySelector('.sr-type');
      const type=typeBtn?typeBtn.dataset.type:'notes';
      const btn=$('srSubmit');if(btn){btn.disabled=true;btn.textContent='Sending…'}
      try{
        if(!supabaseClient)throw new Error('no-db');
        const {data:inserted,error}=await supabaseClient.from(SENIOR_TABLE).insert({
          requester_uid:accountUid(),requester_name:getUserName(accountSession)||'A student',
          college:myCollegeKey(),semester:sem,subject:subject,type:type,message:message,status:'pending'
        }).select('id').single();
        if(error)throw error;
        const rid=inserted&&inserted.id;
        closeSeniorRequest();
        toast('Request sent to your seniors 🔔');
        if(rid){try{fetch(NOTIFY_SENIORS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:rid})}).catch(()=>{})}catch(e){}}
        loadSeniorHelpDelayed();
      }catch(e){toast('Could not send request right now')}
      finally{if(btn){btn.disabled=false;btn.textContent='Send to seniors'}}
    }





    /* ---- Senior side: help juniors ---- */
    let seniorHelpTimer=null;
    function seniorHelpVisible(){return mySemNumber()>=2}
    async function loadSeniorRequests(){
      const host=$('helpJuniors');if(!host)return;
      const mySem=mySemNumber();
      if(!seniorHelpVisible()){host.hidden=true;return}
      host.hidden=false;
      const listEl=$('helpJuniorsList');if(!listEl)return;
      listEl.innerHTML='<p class="help-loading">Checking for junior requests…</p>';
      try{
        if(!supabaseClient){listEl.innerHTML='<p class="help-empty">Setup needed.</p>';return}
        const {data,error}=await supabaseClient.from(SENIOR_TABLE)
          .select('*').lt('semester',mySem).in('status',['pending','notified'])
          .order('created_at',{ascending:false}).limit(20);
        if(error)throw error;
        const mine=(data||[]).filter(r=>myCollegeKey()==='all'||r.college==='all'||r.college===myCollegeKey());
        const countEl=$('helpJuniorsCount');
        if(countEl)countEl.textContent=mine.length?`${mine.length} junior${mine.length===1?'':'s'}`:'';
        if(!mine.length){listEl.innerHTML='<p class="help-empty">🎉 No junior requests right now. Jab koi junior material maangega to yahan aayega.</p>';return}
        listEl.innerHTML=mine.map(r=>{
          helpJuniorCache[r.id]=r;
          const semLabel='Semester '+r.semester;
          const subject=String(r.subject||'notes/PYQ').replace(/[<>&"]/g,'');
          const msg=String(r.message||'').replace(/[<>&"]/g,'');
          const typeLabel=r.type==='pyq'?'PYQ':'Notes';
          const rName=String(r.requester_name||'A student').replace(/[<>&"]/g,'');
          return `<div class="help-item">
            <div class="help-item-head"><span class="badge">${typeLabel}</span><span class="help-sem">${semLabel}</span><span class="help-by"><i class="fa-solid fa-user-graduate"></i> ${rName}</span><span class="help-time">${timeAgo(r.created_at)}</span></div>
            <strong class="help-subject">${subject}</strong>
            ${msg?`<p class="help-msg">${msg}</p>`:''}
            <div class="help-actions">
              <button class="primary" onclick="openUploadForJunior(${r.id})"><i class="fa-solid fa-cloud-arrow-up"></i> Upload</button>
              <button class="secondary" onclick="markSeniorDone(${r.id},this)"><i class="fa-solid fa-check"></i> Done</button>
            </div>
          </div>`;
        }).join('');
      }catch(e){listEl.innerHTML='<p class="help-empty">Could not load requests.</p>'}
    }
    function loadSeniorHelpDelayed(){if(seniorHelpTimer)clearTimeout(seniorHelpTimer);seniorHelpTimer=setTimeout(loadSeniorRequests,900)}
    function timeAgo(iso){try{const s=(Date.now()-new Date(iso).getTime())/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}catch(e){return ''}}
    async function markSeniorDone(id,btn){
      if(btn){btn.disabled=true;btn.textContent='Saving…'}
      try{if(supabaseClient)await supabaseClient.from(SENIOR_TABLE).update({status:'done'}).eq('id',id)}catch(e){}
      fulfillJuniorRequest(helpJuniorCache[id],'done');
      toast('Marked done — junior ko notification chali 🔔');
      setTimeout(loadSeniorRequests,600);
    }
    /* Junior ko fulfillment push bhejo (best-effort — fail ho to chup rehna) */
    function fulfillJuniorRequest(r,kind){
      try{
        if(!r||!r.id)return;
        fetch(NOTIFY_SENIORS_URL,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({mode:'fulfilled',request_id:r.id,kind:kind})}).catch(()=>{});
      }catch(e){}
    }
    /* Junior ki request se direct upload modal pre-fill karke khulta hai */
    const helpJuniorCache={};
    let pendingHelpRequest=null; /* jab is flow se upload hoga to junior ko notification jayegi */
    function openUploadForJunior(id){
      const r=helpJuniorCache[id];if(!r)return;
      pendingHelpRequest=r;
      openUpload();
      if(!$('uploadModal')||!$('uploadModal').classList.contains('open'))return; /* login needed */
      try{
        const subj=String(r.subject||'').trim();
        const semSel=document.querySelector('#uploadModal select[name="semester"]');if(semSel)semSel.value=String(r.semester);
        const typeSel=document.querySelector('#uploadModal select[name="type"]');if(typeSel)typeSel.value=(r.type==='pyq'?'pyq':'notes');
        updateUploadSubjects();
        const sub=$('uploadSubjectSelect');
        if(sub){
          let matched=false;
          if(subj){[...sub.options].forEach(o=>{if(!matched&&o.value!=='__other'&&o.value.toLowerCase()===subj.toLowerCase()){sub.value=o.value;matched=true}});}
          if(!matched)sub.value='__other';
          onUploadSubjectChange(sub);
          if(!matched){const custom=document.querySelector('#uploadModal input[name="customSubject"]');if(custom)custom.value=subj;}
        }
        const titleInput=document.querySelector('#uploadModal input[name="title"]');
        if(titleInput&&!titleInput.value.trim())titleInput.value=subj?`${subj} — ${r.type==='pyq'?'PYQ':'Notes'} (Sem ${r.semester})`:'';
      }catch(e){}
    }

    function showOnboardingIfNeeded(){if(localStorage.getItem('bca-onboarded')){if(localStorage.getItem('bca-tour-seen')!=='true')setTimeout(startTour,200);return}if(accountSession||sessionStorage.getItem('bca-guest-mode')==='true')showOnboarding()}
    function renderOnboardingColleges(){const options=colleges.filter(c=>c[0]!=='other');$('onboardingList').innerHTML=options.map(c=>`<button class="onboarding-option ${state.onboardingCollege===c[0]?'selected':''}" onclick="chooseOnboardingCollege('${c[0]}')"><span><b>${c[1]}</b><small>BCA resources</small></span><i class="fa-solid ${state.onboardingCollege===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function chooseOnboardingCollege(id){state.onboardingCollege=id;renderOnboardingColleges();state.onboardingSem='';document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));const track=$('obTrack');if(track)track.classList.add('step2')}
    function backToOnboardingCollege(){state.onboardingSem='';document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));renderOnboardingColleges();const track=$('obTrack');if(track)track.classList.remove('step2')}
    function chooseOnboardingSemester(sem,button){state.onboardingSem=String(sem);document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');if(state.onboardingCollege&&!state.onboardingDone)setTimeout(()=>finishOnboarding(),400)}
    function ensureCollegeOption(id){const college=colleges.find(c=>c[0]===id);const cf=$('collegeFilter');if(!college||!cf||cf.querySelector(`option[value="${id}"]`))return;const option=document.createElement('option');option.value=college[0];option.textContent=college[1];cf.append(option)}
    function completeOnboarding(id){if(state.onboardingDone)return;state.onboardingDone=true;state.college=id;state.sem=state.onboardingSem||'1';try{localStorage.setItem('bca-college',id);localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-onboarded','true')}catch(error){console.warn('Could not save preferences.',error)}try{$('onboarding').classList.remove('open')}catch(error){}try{updateSemesterOptions();$('semesterFilter').value=state.sem;$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||colleges[0])[1];$('deskSemester').textContent=`Semester ${state.sem} resources`;renderSubjectFilter();render()}catch(error){console.warn('Library refresh skipped.',error)}saveProfileToAccount();setTimeout(startTour,200)}
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
      const fib=document.getElementById('footerInstallButton');if(fib)fib.hidden=false;
      setTimeout(() => {
        if (deferredInstallPrompt) $('installBanner').classList.add('show');
      }, 3000);
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      $('installButton').hidden = true;
      const fib2=document.getElementById('footerInstallButton');if(fib2)fib2.hidden=true;
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
      const fib3=document.getElementById('footerInstallButton');if(fib3)fib3.hidden=true;
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
        navigator.serviceWorker.register('./sw.js?v=22').then(reg=>{
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
