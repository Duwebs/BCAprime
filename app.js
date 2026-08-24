// app.js - BCAPrime app logic (extracted from index.html).
// Must load AFTER firebase-config.js and supabase-config.js.
console.info('[BCAPrime] app.js v3 loaded ✔');
const colleges=[['all','All Colleges'],['ccsu','CCSU Meerut'],['du','Delhi University'],['ipu','GGSIPU Delhi'],['aktu','AKTU / UPTU'],['ignou','IGNOU'],['mdu','MDU Rohtak'],['bhu','BHU'],['pune','Pune University'],['bangalore','Bangalore University'],['other','Other University']];
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
    let resources=[
      {title:'C Programming Complete Notes',type:'notes',sem:1,year:1,subject:'Programming Principles & C',college:'all'},
      {title:'Data Structures PYQ Paper 2024',type:'pyq',sem:2,year:1,subject:'Data Structures Using C',college:'ccsu'},
      {title:'DBMS and SQL Revision Guide',type:'notes',sem:3,year:2,subject:'Database Management Systems',college:'du'},
      {title:'Python Programming PYQ Papers',type:'pyq',sem:5,year:3,subject:'Python Programming',college:'ipu'},
      {title:'Operating Systems PYQ Paper',type:'pyq',sem:6,year:3,subject:'Operating Systems',college:'all'}
    ];
    resources=[...resources,...JSON.parse(localStorage.getItem('bca-uploads')||'[]')].filter(resource=>(resource.type==='notes'||resource.type==='pyq')&&(!resource.status||resource.status==='approved'));
    const state={theme:localStorage.getItem('bca-theme')||'dark',college:localStorage.getItem('bca-college')||'all',type:'all',query:'',year:localStorage.getItem('bca-year')||'all',sem:localStorage.getItem('bca-sem')||'all',subject:localStorage.getItem('bca-subject')||'all',saved:JSON.parse(localStorage.getItem('bca-saved')||'[]'),savedOnly:false,onboardingCollege:'',onboardingSem:''};
    const $=id=>document.getElementById(id);
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
    function render(){const q=state.query.toLowerCase();const list=resources.filter(r=>{
        const matchSaved = !state.savedOnly || state.saved.includes(r.title.replace(/\W/g,''));
        const matchType = state.type === 'all' || r.type === state.type;
        const matchCollege = state.college === 'all' || r.college === 'all' || r.college === state.college;
        const matchSem = state.sem === 'all' || r.sem === Number(state.sem);
        const matchYear = state.year === 'all' || r.year === Number(state.year);
        const matchQuery = `${r.title} ${r.subject}`.toLowerCase().includes(q);
        const matchSubject = !state.subject || state.subject === 'all' || normSubject(r.subject) === normSubject(state.subject);
        return matchSaved && matchType && matchCollege && matchSem && matchYear && matchQuery && matchSubject;
      });
      $('count').textContent=`${list.length} result${list.length===1?'':'s'}`;
      $('resources').innerHTML=list.length?list.map(card).join(''):state.savedOnly?'<div class="empty"><i class="fa-regular fa-bookmark"></i><br><br>No saved resources yet.<br><button class="secondary" style="margin-top:12px" onclick="selectTab(\'library\',document.querySelector(\'.bottom-tab\'))">Browse the library</button></div>':'<div class="empty"><i class="fa-regular fa-folder-open"></i><br><br>No resources match these filters.<br><button class="secondary" style="margin-top:12px" onclick="openUpload()">Share the first one</button></div>'}
    function card(r){const id=r.title.replace(/\W/g,'');const saved=state.saved.includes(id);return `<article class="resource"><div class="resource-top"><span class="badge">${r.type}</span><button class="save ${saved?'saved':''}" aria-label="Save resource" onclick="toggleSave('${id}')"><i class="fa-${saved?'solid':'regular'} fa-bookmark"></i></button></div><h3>${r.title}</h3><p>${r.subject}</p><div class="resource-meta"><span><i class="fa-solid fa-layer-group"></i>Semester ${r.sem}</span><span><i class="fa-solid fa-building-columns"></i>${r.college==='all'?'All colleges':(colleges.find(c=>c[0]===r.college)||['','College'])[1]}</span></div><div class="resource-submeta"><span><i class="fa-regular fa-clock"></i>${r.date||'Updated recently'}</span><span><i class="fa-solid fa-download"></i>${r.downloads||'New'} downloads</span>${r.uploader?`<span><i class="fa-solid fa-user"></i>${r.uploader}</span>`:''}</div><div class="resource-actions"><button class="view" onclick="previewResource('${id}')"><i class="fa-regular fa-eye"></i> Preview</button><button class="download" onclick="download('${r.title}')"><i class="fa-solid fa-download"></i> Download</button></div></article>`}
    function setType(type,button){state.type=type;document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));button.classList.add('active');render()}
    function applyFilters(){updateSemesterOptions();state.year=$('yearFilter').value;state.sem=$('semesterFilter').value;renderSubjectFilter();if($('subjectFilter'))state.subject=$('subjectFilter').value;localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-subject',state.subject);$('deskSemester').textContent=state.sem==='all'?'Explore your semester':`Semester ${state.sem} resources`;render()}
    /* Year select hone par semester dropdown usi year ke sems tak simit hota hai */
    function updateSemesterOptions(){
      const yearSel=$('yearFilter'),semSel=$('semesterFilter');
      if(!yearSel||!semSel)return;
      const year=yearSel.value;
      if(year==='all'){
        semSel.disabled=true;
        semSel.innerHTML='<option value="all">Pehle year select karo</option>';
        if(state.sem!=='all'){state.sem='all';localStorage.setItem('bca-sem','all')}
        return;
      }
      const start=(Number(year)-1)*2+1;
      semSel.disabled=false;
      semSel.innerHTML='<option value="all">All semesters</option><option value="'+start+'">Semester '+start+'</option><option value="'+(start+1)+'">Semester '+(start+1)+'</option>';
      if(state.sem!=='all'&&Number(state.sem)>=start&&Number(state.sem)<=start+1){
        semSel.value=String(state.sem);
      }else{
        semSel.value='all';
        if(state.sem!=='all'){state.sem='all';localStorage.setItem('bca-sem','all')}
      }
    }
    function resetFinder(){$('yearFilter').value='all';updateSemesterOptions();$('semesterFilter').value='all';state.year='all';state.sem='all';state.type='all';state.subject='all';localStorage.setItem('bca-year','all');localStorage.setItem('bca-sem','all');localStorage.setItem('bca-subject','all');renderSubjectFilter();document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.textContent.trim()==='All'));$('deskSemester').textContent='Explore your semester';render()}
    function chooseSemester(sem,button){const year=String(Math.ceil(Number(sem)/2)||1);state.year=year;$('yearFilter').value=year;updateSemesterOptions();$('semesterFilter').value=String(sem);document.querySelectorAll('.semester').forEach(x=>x.classList.remove('active'));button.classList.add('active');state.sem=String(sem);localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-sem',state.sem);$('deskSemester').textContent=`Semester ${sem} resources`;render();$('library').scrollIntoView({behavior:'smooth'})}
    function searchResources(value){state.query=value;showSuggestions();render()}
    /* ---- Subject filter engine ----
       Options = base subjects (per semester) + custom subjects the user added
       + subjects already present in uploads for the active college/semester.
       This is how unknown college-specific subjects discover themselves. */
    function getAvailableSubjects(){
      return [...new Set(resources.filter(r=>{
        const matchCollege=state.college==='all'||r.college==='all'||r.college===state.college;
        const matchSem=state.sem==='all'||r.sem===Number(state.sem);
        const matchYear=state.year==='all'||r.year===Number(state.year);
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
      sel.innerHTML='<option value="all">All subjects</option>'+merged.map(s=>`<option value="${s.replace(/"/g,'&quot;')}">${s}</option>`).join('');
      const values=[...sel.options].map(option=>option.value);
      sel.value=values.includes(preferred)?preferred:'all';
      renderSubjectCards();
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
      const countFor=s=>resources.filter(r=>normSubject(r.subject)===normSubject(s)&&(state.college==='all'||r.college==='all'||r.college===state.college)&&(!state.sem||state.sem==='all'||r.sem===Number(state.sem))).length;
      wrap.innerHTML=[...seen.values()].map((s,i)=>{
        const hue=subjectHue(s);const count=countFor(s);
        return `<button class="subject-card" style="--hue:${hue};animation-delay:${Math.min(i*45,450)}ms" onclick="openSubjectType('${s.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">
          <span class="subject-card-icon"><i class="${subjectIcon(s)}"></i></span>
          <strong>${s}</strong>
          <small>${count?count+' material'+(count>1?'s':''):state.sem==='all'?'Explore':'Semester '+state.sem}</small>
          <span class="subject-card-go"><i class="fa-solid fa-arrow-right"></i></span>
        </button>`}).join('');
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
        const contactInput=form.querySelector('input[name="contact"]');
        const row={
          kind:feedbackKind,
          message:message.slice(0,1000),
          contact:contactInput?contactInput.value.trim().slice(0,120):'',
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
    function resumeRestrictedAction(){if(!accountSession||!restrictedAction)return;const action=restrictedAction;restrictedAction=null;closeModals();if(action.action==='upload')openUpload();if(action.action==='download')download(action.title)}
    async function submitAccessAuth(event){event.preventDefault();if(!firebaseApp){$('accessAuthMessage').textContent='Firebase is not configured.';return}$('accessAuthMessage').textContent='Working...';const email=$('accessAuthEmail').value.trim();const password=$('accessAuthPassword').value;try{if(accessAuthMode==='signup'){authSuppress=true;const credential=await firebase.auth().createUserWithEmailAndPassword(email,password);const name=$('accessAuthName').value.trim();if(name)await credential.user.updateProfile({displayName:name});await credential.user.sendEmailVerification();await firebase.auth().signOut();authSuppress=false;setAccessAuthMode('login');$('accessAuthMessage').textContent='Account created. Check your email to verify, then login.';return}await firebase.auth().signInWithEmailAndPassword(email,password);accountSession=firebase.auth().currentUser;sessionStorage.removeItem('bca-guest-mode');renderGreeting();resumeRestrictedAction()}catch(error){authSuppress=false;$('accessAuthMessage').textContent=error.message;return}}
    function download(title){if(!requireAccount('Sign up or login to download this note.','download',title))return;const resource=resources.find(item=>item.title===title);if(resource&&(resource.fileData||resource.fileUrl)){const a=document.createElement('a');a.href=resource.fileData||resource.fileUrl;a.download=resource.fileName||title.replace(/\W+/g,'-');a.target='_blank';a.click();toast('Download started');return}const blob=new Blob([`BCAPrime resource\n${title}\n\nUse this as a study reference.`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=title.replace(/\W+/g,'-')+'.txt';a.click();URL.revokeObjectURL(a.href);toast('Demo download started')}
    let accountMode='signup';let accessAuthMode='signup';let accountSession=null;let authSuppress=false;
    function getUserName(user){user=user||accountSession;if(user&&user.displayName&&user.displayName.trim())return user.displayName.trim();if(user&&user.email){const local=user.email.split('@')[0]||'';const parts=local.split(/[._+\-]+/).filter(Boolean).map(p=>p.charAt(0).toUpperCase()+p.slice(1));if(parts.length)return parts.join(' ')}return 'there'}
    function getTimeBasedGreeting(name='there'){const hour=new Date().getHours();let prefix;if(hour>=4&&hour<12)prefix='Good Morning';else if(hour>=12&&hour<17)prefix='Good Afternoon';else if(hour>=17&&hour<21)prefix='Good Evening';else prefix='Good Night';return `${prefix}, ${name}!`}let greetingTimerId=null;function scheduleGreetingUpdate(){if(greetingTimerId)return;const now=new Date();const next=new Date(now);next.setHours(next.getHours()+1,0,0,0);const delay=Math.max(0,next-now);greetingTimerId=setTimeout(()=>{greetingTimerId=null;renderGreeting()},delay)}function renderGreeting(){const greeting=$('heroGreeting');const title=$('heroDefaultTitle');if(!greeting||!title)return;const isAuthed=accountSession||sessionStorage.getItem('bca-guest-mode')==='true';greeting.hidden=!isAuthed;title.hidden=!!isAuthed;$('heroGreetName').textContent=getTimeBasedGreeting(getUserName(accountSession)||'there');if(isAuthed)scheduleGreetingUpdate()}
    function setAccountMode(mode){accountMode=mode;$('accountTitle').textContent=mode==='signup'?'Create your account':'Welcome back';$('accountDescription').textContent=mode==='signup'?'Sign in to keep your study activity connected across devices.':'Login to keep your study activity connected across devices.';$('accountSubmit').textContent=mode==='signup'?'Sign up':'Login';$('accountSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('accountMessage').textContent='';$('accountNameLabel').hidden=mode!=='signup';if(mode==='signup')$('accountName').setAttribute('required','');else $('accountName').removeAttribute('required')}
    function renderAccount(){const form=$('accountForm');if(accountSession){const name=getUserName(accountSession).replace(/</g,'&lt;');const identity=(accountSession.email||'Account connected').replace(/</g,'&lt;');$('accountAuth').innerHTML=`<h3>Hi ${name}!</h3><p>Signed in as ${identity}</p><div class="account-user"><span>${identity}</span><button class="secondary" type="button" onclick="signOutAccount()">Log out</button></div>`;return}if(!form)return;setAccountMode(accountMode)}
    async function signInWithProvider(provider,messageId='accountMessage'){if(!firebaseApp){$(messageId).textContent='Firebase is not configured.';return}try{if(provider==='google'){await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())}else if(provider==='apple'){const appleProvider=new firebase.auth.OAuthProvider('apple.com');appleProvider.addScope('email');appleProvider.addScope('name');await firebase.auth().signInWithPopup(appleProvider)}}catch(error){if(error.code==='auth/popup-closed-by-user'||error.code==='auth/cancelled-popup-request')return;$(messageId).textContent=error.message}}
    let gateMode='signup';
    function setGateMode(mode){gateMode=mode;$('gateAccountSubmit').textContent=mode==='signup'?'Sign up':'Login';$('gateAccountSwitch').textContent=mode==='signup'?'Already have an account? Login':'Need an account? Sign up';$('gateAccountMessage').textContent='';$('gateNameLabel').hidden=mode!=='signup';if(mode==='signup')$('gateAccountName').setAttribute('required','');else $('gateAccountName').removeAttribute('required')}
    async function submitGateAccount(event){event.preventDefault();if(!firebaseApp){$('gateAccountMessage').textContent='Firebase is not configured.';return}$('gateAccountMessage').textContent='Working...';const email=$('gateAccountEmail').value.trim();const password=$('gateAccountPassword').value;try{if(gateMode==='signup'){authSuppress=true;const credential=await firebase.auth().createUserWithEmailAndPassword(email,password);const name=$('gateAccountName').value.trim();if(name)await credential.user.updateProfile({displayName:name});await credential.user.sendEmailVerification();await firebase.auth().signOut();authSuppress=false;setGateMode('login');$('gateAccountMessage').textContent='Account created. Check your email to verify, then login.';return}await firebase.auth().signInWithEmailAndPassword(email,password);accountSession=firebase.auth().currentUser;sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp()}catch(error){authSuppress=false;$('gateAccountMessage').textContent=error.message;return}}
    function showAuthenticatedApp(){$('authGate').hidden=true;$('appShell').hidden=false;$('appTabs').hidden=false;renderGreeting();renderAvatar();setTimeout(showOnboardingIfNeeded,180)}
    function continueAsGuest(){sessionStorage.setItem('bca-guest-mode','true');showAuthenticatedApp();toast('Guest mode enabled')}
    function hideAuthenticatedApp(){$('authGate').hidden=false;$('appShell').hidden=true;$('appTabs').hidden=true;renderGreeting()}
    async function submitAccount(event){event.preventDefault();if(!firebaseApp){$('accountMessage').textContent='Firebase is not configured.';return}const email=$('accountEmail').value.trim();const password=$('accountPassword').value;try{if(accountMode==='signup'){authSuppress=true;const credential=await firebase.auth().createUserWithEmailAndPassword(email,password);const name=$('accountName').value.trim();if(name)await credential.user.updateProfile({displayName:name});await credential.user.sendEmailVerification();await firebase.auth().signOut();authSuppress=false;setAccountMode('login');$('accountMessage').textContent='Account created. Check your email to verify, then login.';return}await firebase.auth().signInWithEmailAndPassword(email,password);accountSession=firebase.auth().currentUser;sessionStorage.removeItem('bca-guest-mode');renderGreeting();renderAccount();toast('Account connected')}catch(error){authSuppress=false;$('accountMessage').textContent=error.message;return}}
    async function signOutAccount(){await firebase.auth().signOut();accountSession=null;hideAuthenticatedApp();$('accountAuth').innerHTML='<h3 id="accountTitle"></h3><p id="accountDescription"></p><form class="account-form" id="accountForm"><label id="accountNameLabel">Name<input id="accountName" type="text" autocomplete="name"></label><label>Email<input id="accountEmail" type="email" autocomplete="email" required></label><label>Password<input id="accountPassword" type="password" autocomplete="current-password" minlength="6" required></label><button class="primary" id="accountSubmit" type="submit"></button></form><div class="oauth-actions"><button class="oauth-button" type="button" onclick="signInWithProvider(\'google\')"><i class="fa-brands fa-google"></i> Continue with Google</button><button class="oauth-button" type="button" onclick="signInWithProvider(\'apple\')"><i class="fa-brands fa-apple"></i> Continue with Apple</button></div><p class="account-message" id="accountMessage" aria-live="polite"></p><button class="account-switch" id="accountSwitch" type="button"></button>';bindAccountForm();renderAccount();toast('Logged out')}
    function bindAccountForm(){$('accountForm').addEventListener('submit',submitAccount);$('accountSwitch').addEventListener('click',()=>setAccountMode(accountMode==='signup'?'login':'signup'))}
    function openCollege(){renderColleges();$('collegeModal').classList.add('open')};function openProfile(){$('profileCollege').textContent=(colleges.find(c=>c[0]===state.college)||colleges[0])[1];$('profileSaved').textContent=state.saved.length;$('profileUploads').textContent=JSON.parse(localStorage.getItem('bca-uploads')||'[]').length;renderAvatar();renderAccount();renderMyUploads();$('profileModal').classList.add('open')};function openUpload(){if(!requireAccount('Sign up or login to upload study material.','upload'))return;const fileBox=document.querySelector('.file-box');if(fileBox)fileBox.style.borderColor='var(--brand)';$('uploadModal').classList.add('open');updateUploadSubjects()};function closeModals(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('open'));closeSuggestions();const pb=$('previewBody');if(pb)pb.innerHTML=''}
    function getAvatar(){const saved=localStorage.getItem('bca-avatar');if(saved)return saved;if(accountSession&&accountSession.photoURL)return accountSession.photoURL;return initialsAvatar(accountSession?getUserName(accountSession):'Guest')}
    function initialsAvatar(name){const letter=((name||'S').trim().charAt(0).toUpperCase()||'S');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="60" fill="#23808f"/><text x="60" y="79" font-family="Arial,sans-serif" font-size="54" font-weight="700" text-anchor="middle" fill="#ffffff">${letter}</text></svg>`;return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg)}
    function renderAvatar(){const img=$('avatarImg');if(!img)return;img.src=getAvatar();const nameEl=$('profileIdName');if(nameEl)nameEl.textContent=accountSession?getUserName(accountSession):'Guest';const mailEl=$('profileIdMail');if(mailEl)mailEl.textContent=accountSession&&accountSession.email?accountSession.email:'Browsing as guest';const tb=$('topbarAvatar');if(tb)tb.src=getAvatar()}
    function changeAvatar(input){const f=input.files&&input.files[0];if(!f)return;if(!/^image\//.test(f.type)){toast('Please choose an image file');input.value='';return}if(f.size>2*1024*1024){toast('Pick an image under 2 MB');input.value='';return}const reader=new FileReader();reader.onload=()=>{localStorage.setItem('bca-avatar',reader.result);renderAvatar();toast('Profile photo updated')};reader.readAsDataURL(f);input.value=''}
    function toggleProfileCard(event){if(event)event.stopPropagation();const pop=$('profilePop');if(!pop)return;const willShow=pop.hidden;if(willShow){const av=$('popAvatar');if(av)av.src=getAvatar();const n=$('popName');if(n)n.textContent=accountSession?getUserName(accountSession):'Guest';const m=$('popMail');if(m)m.textContent=accountSession&&accountSession.email?accountSession.email:'Browsing as guest';const c=$('popCollege');if(c)c.textContent=(colleges.find(cc=>cc[0]===state.college)||colleges[0])[1];const s=$('popSem');if(s)s.textContent=state.sem==='all'?'All semesters':'Semester '+state.sem;}pop.hidden=!willShow}
    function hideProfileCard(){const pop=$('profilePop');if(pop&&!pop.hidden)pop.hidden=true}
    function logoutFromPop(){hideProfileCard();if(firebaseApp&&accountSession){signOutAccount();return}sessionStorage.removeItem('bca-guest-mode');accountSession=null;hideAuthenticatedApp();toast('Logged out')}
    function renderColleges(query=''){const q=query.toLowerCase();const ranked=[...colleges].sort((a,b)=>{if(a[0]==='all')return -1;if(b[0]==='all')return 1;const order=['ccsu','du','ipu','aktu','ignou','mdu','bhu','pune','bangalore'];const aIndex=order.indexOf(a[0]);const bIndex=order.indexOf(b[0]);if(aIndex!==-1||bIndex!==-1){if(aIndex===-1)return 1;if(bIndex===-1)return -1;return aIndex-bIndex}return a[1].localeCompare(b[1])});$('collegeList').innerHTML=ranked.filter(c=>c[1].toLowerCase().includes(q)).map(c=>`<button class="college-option ${state.college===c[0]?'selected':''}" onclick="selectCollege('${c[0]}')"><span><b>${c[1]}</b><small>BCA resources</small></span><i class="fa-solid ${state.college===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function selectCollege(id){state.college=id;localStorage.setItem('bca-college',id);$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||['',id])[1];closeModals();render()}
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
    async function initAccount(){if(sessionStorage.getItem('bca-guest-mode')==='true')showAuthenticatedApp();if(!firebaseApp){$('gateAccountMessage').textContent='Firebase is not configured.';return}accountSession=firebase.auth().currentUser;if(accountSession){sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp()}firebase.auth().onAuthStateChanged(user=>{accountSession=user;if(authSuppress)return;if(user){sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp();resumeRestrictedAction()}else if(sessionStorage.getItem('bca-guest-mode')!=='true')hideAuthenticatedApp();if($('profileModal').classList.contains('open'))renderAccount()})}
    document.addEventListener('click',e=>{if(e.target.classList.contains('modal'))closeModals(); if(!e.target.closest('.hero-search'))closeSuggestions(); if(!e.target.closest('.profile-pop')&&!e.target.closest('#topbarAvatarBtn'))hideProfileCard();});window.addEventListener('DOMContentLoaded',()=>{init();bindAccountForm();startLibrarySync();setGateMode(gateMode);$('gateAccountForm').addEventListener('submit',submitGateAccount);$('gateAccountSwitch').addEventListener('click',()=>setGateMode(gateMode==='signup'?'login':'signup'));$('accessAuthForm').addEventListener('submit',submitAccessAuth);$('accessAuthSwitch').addEventListener('click',()=>setAccessAuthMode(accessAuthMode==='signup'?'login':'signup'));initAccount()});
    function showOnboarding(){if(localStorage.getItem('bca-onboarded'))return;state.onboardingDone=false;renderOnboardingColleges();$('onboarding').classList.add('open')}
    function showOnboardingIfNeeded(){if(localStorage.getItem('bca-onboarded')){if(localStorage.getItem('bca-tour-seen')!=='true')setTimeout(startTour,200);return}if(accountSession||sessionStorage.getItem('bca-guest-mode')==='true')showOnboarding()}
    function renderOnboardingColleges(){const options=colleges.filter(c=>c[0]!=='other');$('onboardingList').innerHTML=options.map(c=>`<button class="onboarding-option ${state.onboardingCollege===c[0]?'selected':''}" onclick="chooseOnboardingCollege('${c[0]}')"><span><b>${c[1]}</b><small>BCA resources</small></span><i class="fa-solid ${state.onboardingCollege===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function chooseOnboardingCollege(id){state.onboardingCollege=id;renderOnboardingColleges();$('onboardingSemesters').classList.add('open')}
    function chooseOnboardingSemester(sem,button){state.onboardingSem=String(sem);document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');if(state.onboardingCollege&&!state.onboardingDone)setTimeout(()=>finishOnboarding(),400)}
    function ensureCollegeOption(id){const college=colleges.find(c=>c[0]===id);if(!college||$('collegeFilter').querySelector(`option[value="${id}"]`))return;const option=document.createElement('option');option.value=college[0];option.textContent=college[1];$('collegeFilter').append(option)}
    function completeOnboarding(id){if(state.onboardingDone)return;state.onboardingDone=true;state.college=id;state.sem=state.onboardingSem||'1';state.year=String(Math.ceil(Number(state.sem)/2)||1);try{localStorage.setItem('bca-college',id);localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-onboarded','true')}catch(error){console.warn('Could not save preferences.',error)}try{$('onboarding').classList.remove('open')}catch(error){}try{$('yearFilter').value=state.year;updateSemesterOptions();$('semesterFilter').value=state.sem;$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||colleges[0])[1];$('deskSemester').textContent=`Semester ${state.sem} resources`;renderSubjectFilter();render()}catch(error){console.warn('Library refresh skipped.',error)}setTimeout(startTour,200)}
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
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.info('PWA service worker unavailable.', error.message)));
    }
    setTimeout(() => {
      showOnboardingIfNeeded();
    }, 1200);
