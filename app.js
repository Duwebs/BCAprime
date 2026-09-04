// app.js - BCAPrime app logic (extracted from index.html).
// Must load AFTER firebase-config.js and supabase-config.js.
const colleges=[['all','All Colleges'],['ccsu','CCSU Meerut'],['du','Delhi University'],['ipu','GGSIPU Delhi'],['aktu','AKTU / UPTU'],['ignou','IGNOU'],['mdu','MDU Rohtak'],['bhu','BHU'],['pune','Pune University'],['bangalore','Bangalore University'],['other','Other University']];
    JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]').forEach(college=>{if(Array.isArray(college)&&college.length===2)colleges.push(college)});
    let resources=[
      {title:'C Programming Complete Notes',type:'notes',sem:1,year:1,subject:'Programming Principles & C',college:'all'},
      {title:'Data Structures PYQ Paper 2024',type:'pyq',sem:2,year:1,subject:'Data Structures Using C',college:'ccsu'},
      {title:'DBMS and SQL Revision Guide',type:'notes',sem:3,year:2,subject:'Database Management Systems',college:'du'},
      {title:'Python Programming PYQ Papers',type:'pyq',sem:5,year:3,subject:'Python Programming',college:'ipu'},
      {title:'Operating Systems PYQ Paper',type:'pyq',sem:6,year:3,subject:'Operating Systems',college:'all'}
    ];
    resources=[...resources,...JSON.parse(localStorage.getItem('bca-uploads')||'[]')].filter(resource=>(resource.type==='notes'||resource.type==='pyq')&&(!resource.status||resource.status==='approved'));
    const state={theme:localStorage.getItem('bca-theme')||'dark',college:localStorage.getItem('bca-college')||'all',type:'all',query:'',year:localStorage.getItem('bca-year')||'all',sem:localStorage.getItem('bca-sem')||'all',saved:JSON.parse(localStorage.getItem('bca-saved')||'[]'),savedOnly:false,onboardingCollege:'',onboardingSem:''};
    const $=id=>document.getElementById(id);
    async function loadCloudResources(){if(!supabaseClient){console.info('Supabase resources unavailable until schema is added.');return;}try{const {data,error}=await supabaseClient.from('resources').select('*').eq('status','approved').order('created_at',{ascending:false});if(error)throw error;const cloud=(data||[]).map(item=>({title:item.title,type:item.type,sem:item.semester,year:item.year,subject:item.subject,college:item.college,fileName:item.file_name,fileUrl:item.file_url,downloads:item.downloads||0,status:item.status}));const existing=new Set(resources.map(item=>item.title));resources=[...resources,...cloud.filter(item=>!existing.has(item.title))];render()}catch(error){console.info('Supabase resources unavailable until schema is added.',error.message)}}
    function init(){
      applyTheme(state.theme);
      $('yearFilter').value=state.year==='all'?'all':state.year;
      $('semesterFilter').value=state.sem;
      const collegeName = (colleges.find(c=>c[0]===state.college)||colleges[0])[1];
      $('collegeLabel').textContent = collegeName;
      const semText = state.sem==='all' ? 'All Semesters' : `Sem ${state.sem}`;
      $('navSemBadge').textContent = `· ${semText}`;
      $('savedSummary').textContent=state.saved.length?`${state.saved.length} resource${state.saved.length===1?'':'s'} saved for later`:'Keep important notes close';
      renderColleges();
      render();
      loadCloudResources();
      setTimeout(()=>$('splash').classList.add('hidden'),1100);
    }
    function applyTheme(theme){state.theme=theme;document.documentElement.dataset.theme=theme;localStorage.setItem('bca-theme',theme);$('themeIcon').className=theme==='dark'?'fa-solid fa-sun':'fa-solid fa-moon'}
    function toggleTheme(){applyTheme(state.theme==='dark'?'light':'dark')}
    function render(){const q=state.query.toLowerCase();const list=resources.filter(r=>{
        const matchSaved = !state.savedOnly || state.saved.includes(r.title.replace(/\W/g,''));
        const matchType = state.type === 'all' || r.type === state.type;
        const matchCollege = state.college === 'all' || r.college === 'all' || r.college === state.college;
        const matchSem = state.sem === 'all' || r.sem === Number(state.sem);
        const matchYear = state.year === 'all' || r.year === Number(state.year);
        const matchQuery = `${r.title} ${r.subject}`.toLowerCase().includes(q);
        return matchSaved && matchType && matchCollege && matchSem && matchYear && matchQuery;
      });
      $('count').textContent=`${list.length} result${list.length===1?'':'s'}`;
      $('resources').innerHTML=list.length?list.map(card).join(''):state.savedOnly?'<div class="empty"><i class="fa-regular fa-bookmark"></i><br><br>No saved resources yet.<br><button class="secondary" style="margin-top:12px" onclick="selectTab(\'library\',document.querySelector(\'.bottom-tab\'))">Browse the library</button></div>':'<div class="empty"><i class="fa-regular fa-folder-open"></i><br><br>No resources match these filters.<br><button class="secondary" style="margin-top:12px" onclick="openUpload()">Share the first one</button></div>'}
    function card(r){const id=r.title.replace(/\W/g,'');const saved=state.saved.includes(id);return `<article class="resource"><div class="resource-top"><span class="badge">${r.type}</span><button class="save ${saved?'saved':''}" aria-label="Save resource" onclick="toggleSave('${id}')"><i class="fa-${saved?'solid':'regular'} fa-bookmark"></i></button></div><h3>${r.title}</h3><p>${r.subject}</p><div class="resource-meta"><span><i class="fa-solid fa-layer-group"></i>Semester ${r.sem}</span><span><i class="fa-solid fa-building-columns"></i>${r.college==='all'?'All colleges':(colleges.find(c=>c[0]===r.college)||['','College'])[1]}</span></div><div class="resource-submeta"><span><i class="fa-regular fa-clock"></i>${r.date||'Updated recently'}</span><span><i class="fa-solid fa-download"></i>${r.downloads||'New'} downloads</span></div><div class="resource-actions"><button class="view" onclick="previewResource('${id}')"><i class="fa-regular fa-eye"></i> Preview</button><button class="download" onclick="download('${r.title}')"><i class="fa-solid fa-download"></i> Download</button></div></article>`}
    function setType(type,button){state.type=type;document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));button.classList.add('active');render()}
    function applyFilters(){state.year=$('yearFilter').value;state.sem=$('semesterFilter').value;localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-sem',state.sem);$('deskSemester').textContent=state.sem==='all'?'Explore your semester':`Semester ${state.sem} resources`;render()}
    function resetFinder(){$('yearFilter').value='all';$('semesterFilter').value='all';state.year='all';state.sem='all';state.type='all';document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.textContent.trim()==='All'));localStorage.setItem('bca-year','all');localStorage.setItem('bca-sem','all');$('deskSemester').textContent='Explore your semester';render()}
    function chooseSemester(sem,button){$('semesterFilter').value=sem;document.querySelectorAll('.semester').forEach(x=>x.classList.remove('active'));button.classList.add('active');state.sem=String(sem);localStorage.setItem('bca-sem',state.sem);$('deskSemester').textContent=`Semester ${sem} resources`;render();$('library').scrollIntoView({behavior:'smooth'})}
    function searchResources(value){state.query=value;showSuggestions();render()}
    function showSuggestions(){const query=$('search').value.trim().toLowerCase();const matches=resources.filter(r=>`${r.title} ${r.subject}`.toLowerCase().includes(query)).slice(0,4);$('suggestions').innerHTML=(query?matches.map(r=>`<button class="suggestion" onclick="chooseSuggestion('${r.title.replace(/'/g,"\\'")}')"><i class="fa-solid fa-magnifying-glass"></i> ${r.title}</button>`).join(''):'<small style="padding:5px 8px;color:var(--muted)">Search by subject, paper or resource type</small>');$('suggestions').classList.add('open')}
    function chooseSuggestion(title){$('search').value=title;state.query=title;closeSuggestions();render()}
    function closeSuggestions(){$('suggestions').classList.remove('open')}
    function focusFinder(){$('finder').scrollIntoView({behavior:'smooth'});$('collegeFilter').focus()}
    function selectTab(tab,button){
      document.querySelectorAll('.bottom-tab').forEach(item=>item.classList.remove('active'));
      if(button) button.classList.add('active');
      if(tab==='profile'){state.savedOnly=false;openProfile();return}
      state.savedOnly=tab==='saved';
      if(tab==='semesters')$('semesterGrid').scrollIntoView({behavior:'smooth',block:'start'});
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
    function showAuthenticatedApp(){$('authGate').hidden=true;$('appShell').hidden=false;$('appTabs').hidden=false;renderGreeting();setTimeout(showOnboardingIfNeeded,180)}
    function continueAsGuest(){sessionStorage.setItem('bca-guest-mode','true');showAuthenticatedApp();toast('Guest mode enabled')}
    function hideAuthenticatedApp(){$('authGate').hidden=false;$('appShell').hidden=true;$('appTabs').hidden=true;renderGreeting()}
    async function submitAccount(event){event.preventDefault();if(!firebaseApp){$('accountMessage').textContent='Firebase is not configured.';return}const email=$('accountEmail').value.trim();const password=$('accountPassword').value;try{if(accountMode==='signup'){authSuppress=true;const credential=await firebase.auth().createUserWithEmailAndPassword(email,password);const name=$('accountName').value.trim();if(name)await credential.user.updateProfile({displayName:name});await credential.user.sendEmailVerification();await firebase.auth().signOut();authSuppress=false;setAccountMode('login');$('accountMessage').textContent='Account created. Check your email to verify, then login.';return}await firebase.auth().signInWithEmailAndPassword(email,password);accountSession=firebase.auth().currentUser;sessionStorage.removeItem('bca-guest-mode');renderGreeting();renderAccount();toast('Account connected')}catch(error){authSuppress=false;$('accountMessage').textContent=error.message;return}}
    async function signOutAccount(){await firebase.auth().signOut();accountSession=null;hideAuthenticatedApp();$('accountAuth').innerHTML='<h3 id="accountTitle"></h3><p id="accountDescription"></p><form class="account-form" id="accountForm"><label id="accountNameLabel">Name<input id="accountName" type="text" autocomplete="name"></label><label>Email<input id="accountEmail" type="email" autocomplete="email" required></label><label>Password<input id="accountPassword" type="password" autocomplete="current-password" minlength="6" required></label><button class="primary" id="accountSubmit" type="submit"></button></form><div class="oauth-actions"><button class="oauth-button" type="button" onclick="signInWithProvider(\'google\')"><i class="fa-brands fa-google"></i> Continue with Google</button><button class="oauth-button" type="button" onclick="signInWithProvider(\'apple\')"><i class="fa-brands fa-apple"></i> Continue with Apple</button></div><p class="account-message" id="accountMessage" aria-live="polite"></p><button class="account-switch" id="accountSwitch" type="button"></button>';bindAccountForm();renderAccount();toast('Logged out')}
    function bindAccountForm(){$('accountForm').addEventListener('submit',submitAccount);$('accountSwitch').addEventListener('click',()=>setAccountMode(accountMode==='signup'?'login':'signup'))}
    function openCollege(){renderColleges();$('collegeModal').classList.add('open')};function openProfile(){$('profileCollege').textContent=(colleges.find(c=>c[0]===state.college)||colleges[0])[1];$('profileSaved').textContent=state.saved.length;$('profileUploads').textContent=JSON.parse(localStorage.getItem('bca-uploads')||'[]').length;renderAccount();$('profileModal').classList.add('open')};function openUpload(){if(!requireAccount('Sign up or login to upload study material.','upload'))return;const fileBox=document.querySelector('.file-box');if(fileBox)fileBox.style.borderColor='var(--brand)';$('uploadModal').classList.add('open')};function closeModals(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('open'));closeSuggestions()}
    function renderColleges(query=''){const q=query.toLowerCase();const ranked=[...colleges].sort((a,b)=>{if(a[0]==='all')return -1;if(b[0]==='all')return 1;const order=['ccsu','du','ipu','aktu','ignou','mdu','bhu','pune','bangalore'];const aIndex=order.indexOf(a[0]);const bIndex=order.indexOf(b[0]);if(aIndex!==-1||bIndex!==-1){if(aIndex===-1)return 1;if(bIndex===-1)return -1;return aIndex-bIndex}return a[1].localeCompare(b[1])});$('collegeList').innerHTML=ranked.filter(c=>c[1].toLowerCase().includes(q)).map(c=>`<button class="college-option ${state.college===c[0]?'selected':''}" onclick="selectCollege('${c[0]}')"><span><b>${c[1]}</b><small>BCA resources</small></span><i class="fa-solid ${state.college===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function selectCollege(id){state.college=id;localStorage.setItem('bca-college',id);$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||['',id])[1];closeModals();render()}
    function useCustomCollege(){const input=$('collegeCustom');const name=input.value.trim();if(!name){input.focus();return}const college=['custom-'+Date.now(),name];colleges.push(college);localStorage.setItem('bca-custom-colleges',JSON.stringify([...JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]'),college]));input.value='';selectCollege(college[0])}
    function showFile(input){if(input.files[0])$('fileName').textContent=input.files[0].name}
    function previewResource(id){const resource=resources.find(item=>item.title.replace(/\W/g,'')===id);if(!resource) return;
      if(resource.fileUrl || resource.fileData){
        window.open(resource.fileUrl || resource.fileData, '_blank');
      } else {
        toast('Preview not available for this demo item');
      }
    }
    function createLocalUploadRecord(file, upload){return {title:upload.title,type:upload.type,sem:upload.sem,year:upload.year,subject:upload.subject,college:upload.college,date:'Just now',downloads:0,fileName:file.name,fileData:upload.fileData||'',status:upload.status||'pending'}}
    async function uploadResourceToSupabase(file, upload){
      if(!supabaseClient){throw new Error('Supabase client is not available');}
      const safeTitle=(upload.title||'resource').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'resource';
      const filePath=`${upload.type}/${upload.sem}/${Date.now()}-${safeTitle}-${file.name.replace(/\s+/g,'-')}`;
      const {data:storageData,error:storageError}=await supabaseClient.storage.from('resources').upload(filePath,file,{cacheControl:'3600',upsert:false,contentType:file.type || 'application/octet-stream'});
      if(storageError) throw storageError;
      const {data:publicData}=supabaseClient.storage.from('resources').getPublicUrl(storageData.path);
      const row={title:upload.title,type:upload.type,subject:upload.subject,college:upload.college,semester:upload.sem,year:upload.year,file_name:file.name,file_url:publicData.publicUrl,status:'pending',downloads:0};
      const {error:insertError}=await supabaseClient.from('resources').insert(row);
      if(insertError) throw insertError;
      return {...row,title:row.title,type:row.type,sem:row.semester,fileUrl:row.file_url,downloads:0,status:row.status,fileName:file.name,subject:row.subject,college:row.college};
    }
    async function submitUpload(event){
      event.preventDefault();
      const form=event.target;
      const file=$('file').files[0];
      if(!file){toast('Choose a file first');return;}
      const title=form.querySelector('input[name="title"]').value.trim();
      const sem=Number(form.querySelector('select[name="semester"]').value);
      const type=form.querySelector('select[name="type"]').value.toLowerCase();
      const subject=form.querySelector('input[name="link"]').value.trim() || 'Community upload';
      const payload={title,type,sem,year:Math.ceil(sem/2),subject:subject || 'Community upload',college:state.college,status:'pending'};
      const reader=new FileReader();
      reader.onload=async ()=>{
        try {
          const fileData = reader.result;
          const cloudUpload=await uploadResourceToSupabase(file,{...payload,fileData});
          const uploadRecord={...cloudUpload,title:cloudUpload.title,type:cloudUpload.type,sem:cloudUpload.sem,year:cloudUpload.year,subject:cloudUpload.subject,college:cloudUpload.college,date:'Just now',downloads:0,fileName:file.name,fileData:fileData,status:'pending'};
          resources.unshift(uploadRecord);
          const uploads=JSON.parse(localStorage.getItem('bca-uploads')||'[]').filter(resource=>resource.type==='notes'||resource.type==='pyq');
          uploads.unshift(uploadRecord);
          localStorage.setItem('bca-uploads',JSON.stringify(uploads));
          closeModals();
          form.reset();
          $('fileName').textContent='Choose a PDF, DOCX or ZIP file';
          render();
          toast('File uploaded and waiting for approval');
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
          toast('Upload submitted for admin review');
        }
      };
      reader.readAsDataURL(file);
    }
    function resetPreferences(){
      const keys=['bca-onboarded','bca-tour-seen','bca-college','bca-sem','bca-year','bca-saved','bca-custom-colleges','bca-uploads','bca-theme'];
      keys.forEach(key=>localStorage.removeItem(key));
      location.reload();
    }
    function toast(message){const node=document.createElement('div');node.className='toast';node.textContent=message;$('toastRoot').append(node);setTimeout(()=>node.remove(),2300)}
    async function initAccount(){if(sessionStorage.getItem('bca-guest-mode')==='true')showAuthenticatedApp();if(!firebaseApp){$('gateAccountMessage').textContent='Firebase is not configured.';return}accountSession=firebase.auth().currentUser;if(accountSession){sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp()}firebase.auth().onAuthStateChanged(user=>{accountSession=user;if(authSuppress)return;if(user){sessionStorage.removeItem('bca-guest-mode');showAuthenticatedApp();resumeRestrictedAction()}else if(sessionStorage.getItem('bca-guest-mode')!=='true')hideAuthenticatedApp();if($('profileModal').classList.contains('open'))renderAccount()})}
    document.addEventListener('click',e=>{if(e.target.classList.contains('modal'))closeModals(); if(!e.target.closest('.hero-search'))closeSuggestions();});window.addEventListener('DOMContentLoaded',()=>{init();bindAccountForm();setGateMode(gateMode);$('gateAccountForm').addEventListener('submit',submitGateAccount);$('gateAccountSwitch').addEventListener('click',()=>setGateMode(gateMode==='signup'?'login':'signup'));$('accessAuthForm').addEventListener('submit',submitAccessAuth);$('accessAuthSwitch').addEventListener('click',()=>setAccessAuthMode(accessAuthMode==='signup'?'login':'signup'));initAccount()});
    function showOnboarding(){if(localStorage.getItem('bca-onboarded'))return;renderOnboardingColleges();$('onboarding').classList.add('open')}
    function showOnboardingIfNeeded(){if(localStorage.getItem('bca-onboarded')){if(localStorage.getItem('bca-tour-seen')!=='true')setTimeout(startTour,200);return}if(accountSession||sessionStorage.getItem('bca-guest-mode')==='true')showOnboarding()}
    function renderOnboardingColleges(){const options=colleges.filter(c=>c[0]!=='other');$('onboardingList').innerHTML=options.map(c=>`<button class="onboarding-option ${state.onboardingCollege===c[0]?'selected':''}" onclick="chooseOnboardingCollege('${c[0]}')"><span><b>${c[1]}</b><small>BCA resources</small></span><i class="fa-solid ${state.onboardingCollege===c[0]?'fa-circle-check':'fa-chevron-right'}"></i></button>`).join('')}
    function chooseOnboardingCollege(id){state.onboardingCollege=id;renderOnboardingColleges();$('onboardingSemesters').classList.add('open')}
    function chooseOnboardingSemester(sem,button){state.onboardingSem=String(sem);document.querySelectorAll('#onboardingSemesters button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected')}
    function ensureCollegeOption(id){const college=colleges.find(c=>c[0]===id);if(!college||$('collegeFilter').querySelector(`option[value="${id}"]`))return;const option=document.createElement('option');option.value=college[0];option.textContent=college[1];$('collegeFilter').append(option)}
    function completeOnboarding(id){state.college=id;state.sem=state.onboardingSem;state.year=String(Math.ceil(Number(state.onboardingSem)/2));localStorage.setItem('bca-college',id);localStorage.setItem('bca-sem',state.sem);localStorage.setItem('bca-year',state.year);localStorage.setItem('bca-onboarded','true');$('semesterFilter').value=state.sem;$('yearFilter').value=state.year;$('collegeLabel').textContent=(colleges.find(c=>c[0]===id)||colleges[0])[1];$('deskSemester').textContent=`Semester ${state.sem} resources`;$('onboarding').classList.remove('open');render();setTimeout(startTour,200)}
    function finishOnboarding(){if(!state.onboardingCollege){toast('Choose your college first');return}if(!state.onboardingSem){toast('Choose your semester first');return}completeOnboarding(state.onboardingCollege)}
    function addOnboardingCollege(){const input=$('onboardingCustom');const name=input.value.trim();if(!name){input.focus();return}const id='custom-'+Date.now();const college=[id,name];colleges.push(college);localStorage.setItem('bca-custom-colleges',JSON.stringify([...JSON.parse(localStorage.getItem('bca-custom-colleges')||'[]'),college]));input.value='';chooseOnboardingCollege(id)}
    const tourSteps=[
      {selector:'.hero-search',title:'Search bar',text:'This is where you can search subjects, notes, or previous year papers in one quick step.'},
      {selector:'#finder',title:'Filter your library',text:'Choose your college, year, semester, and resource type to narrow results to exactly what you need.'},
      {selector:'#semesterGrid',title:'Semester cards',text:'Tap any semester to jump straight into that section and find material for your current level.'},
      {selector:'#resources',title:'Latest resources',text:'This panel shows your filtered study files. Preview, save, or download anything useful.'},
      {selector:'.bottom-tabs',title:'Quick navigation',text:'Use the bottom menu to move between the library, semesters, saved items, and your profile whenever you need.'}
    ];
    let tourIndex=0;
    function startTour(){
      if (localStorage.getItem('bca-tour-seen') === 'true') return;
      if ($('onboarding').classList.contains('open')) return;
      tourIndex = 0;
      renderTourStep();
      $('tour').hidden = false;
    }
    function renderTourStep(){
      const step = tourSteps[tourIndex];
      const target = document.querySelector(step.selector);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      $('tourHole').style.left = `${Math.max(8, rect.left - 6)}px`;
      $('tourHole').style.top = `${Math.max(8, rect.top - 6)}px`;
      $('tourHole').style.width = `${rect.width + 12}px`;
      $('tourHole').style.height = `${rect.height + 12}px`;
      $('tourStep').textContent = `${tourIndex + 1} of ${tourSteps.length}`;
      $('tourTitle').textContent = step.title;
      $('tourText').textContent = step.text;
      $('tourBack').style.visibility = tourIndex === 0 ? 'hidden' : 'visible';
      $('tourNext').innerHTML = tourIndex === tourSteps.length - 1 ? 'Finish <i class="fa-solid fa-check"></i>' : 'Next <i class="fa-solid fa-arrow-right"></i>';
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function nextTourStep(){
      if (tourIndex >= tourSteps.length - 1) {
        finishTour();
        return;
      }
      tourIndex += 1;
      renderTourStep();
    }
    function previousTourStep(){
      if (tourIndex === 0) return;
      tourIndex -= 1;
      renderTourStep();
    }
    function finishTour(){
      localStorage.setItem('bca-tour-seen', 'true');
      $('tour').hidden = true;
    }
    function skipTour(){
      finishTour();
    }
    window.addEventListener('resize', () => {
      if ($('tour') && $('tour').hidden === false) renderTourStep();
    });
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
