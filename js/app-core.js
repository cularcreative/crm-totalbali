// ============================================================
// Total Bali CRM — Core App Logic (Part 1)
// ============================================================

let enquiries = [];
let stays = {};
let activities = [];
let emails = [];
let emailSchedule = [];
let currentEnqId = null, currentStayId = null, currentEmailIdx = null, currentActId = null;
let selectedStage = 'new';
let groupBy = 'bedrooms', stageFilter = 'all';
let staysMonth = new Date().getMonth(), staysYear = new Date().getFullYear();
let adminUnlocked = false;
let dataLoaded = false;

const STAGE_KEYS = ['new','villas','followup1','followup2','hold','invoice','confirmed','completed','dead'];
const STAGE_LABELS = {new:'New Enquiry',villas:'Needs Villas',followup1:'1st Follow Up',followup2:'2nd Follow Up',hold:'Villa on Hold',invoice:'Invoice Sent',confirmed:'Confirmed',completed:'Completed',dead:'Dead Client'};
const STAGE_COLORS = {new:'#4a8fa8',villas:'#7b68c8',followup1:'#e67e22',followup2:'#c0572b',hold:'#8b6914',invoice:'#2a7a5a',confirmed:'#27ae60',completed:'#1a3a4a',dead:'#5a5a5a'};
const TRG_LABELS={pre:'PRE-ARRIVAL',post:'POST-STAY',inhouse:'IN-HOUSE',payment:'PAYMENT',followup:'FOLLOW-UP'};
const TRG_CLASS={pre:'trg-pre',post:'trg-post',inhouse:'trg-inhouse',payment:'trg-payment',followup:'trg-followup'};

function defaultEmails() {
  return [
    {id:1,trigger:'pre',days:30,subject:'\u{1F334} 30 Days Until Your Bali Holiday!',body:'Hi {name},\n\nJust 30 days until Bali!\n\n\u2705 Confirm flights & passport\n\u2705 Travel insurance\n\u2705 Book activities\n\nSee you in paradise!\nThe Total Bali Team'},
    {id:2,trigger:'pre',days:14,subject:'\u{1F4CB} 2 Weeks to Go \u2014 Your Villa Details Inside',body:'Hi {name},\n\nOnly 2 weeks away!\n\n\u{1F3E1} Villa: {villa}\n\u{1F4CD} Location: {location}\n\u{1F4C5} Check-in: {checkin} from 2:00 PM\n\u{1F4C5} Check-out: {checkout} by 11:00 AM\n\nThe Total Bali Team'},
    {id:3,trigger:'pre',days:7,subject:'\u{1F4E6} One Week Away \u2014 Everything You Need',body:'Hi {name},\n\n7 days! Here\'s your arrival pack:\n\n\u{1F3E1} Villa: {villa}\nTotal Bali 24/7: +62 813 3864 8034\n\nThe Total Bali Team'},
    {id:4,trigger:'pre',days:1,subject:'\u{1F305} Tomorrow Is The Day!',body:'Hi {name},\n\nTomorrow is the BIG day!\nCall us anytime: +62 813 3864 8034\n\nThe Total Bali Team'},
    {id:5,trigger:'inhouse',days:1,subject:'\u2600\uFE0F How\'s Your Stay Going, {name}?',body:'Hi {name},\n\nHope you\'ve settled into {villa}!\nIf anything needs fixing, let us know.\n\nThe Total Bali Team'},
    {id:6,trigger:'post',days:2,subject:'\u{1F49B} How Was Your Stay?',body:'Hi {name},\n\nWe\'d love to hear how {villa} was.\nLeave us a Google Review!\n\nThe Total Bali Team'},
    {id:7,trigger:'payment',days:21,subject:'\u{1F4B3} Balance Payment Reminder \u2014 {villa}',body:'Hi {name},\n\nYour balance of USD ${balance} is due.\n\nBooking: {villa}\nCheck-in: {checkin}\n\nThe Total Bali Team'}
  ];
}

// ========== INIT ==========
async function initApp() {
  showLoading(true);
  emails = defaultEmails();
  try {
    const data = await API.getAll();
    enquiries = [...data.enquiries, ...data.archived];
    stays = data.stays || {};
    activities = data.activities || [];
    emailSchedule = data.emailSchedule || [];
    dataLoaded = true;
    showLoading(false);
    autoPromoteCompleted();
    renderPipeline();
    setStaysMonth(0);
    updateBadges();
  } catch(err) {
    showLoading(false);
    showNotif('Failed to connect to Google Sheets: ' + err.message, true);
  }
}

function showLoading(show) {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.toggle('hidden', !show);
}

// ========== TABS ==========
function showTab(t) {
  ['pipeline','grouping','stays','archive','guests','emails','reminders'].forEach(v => {
    document.getElementById('view-'+v).style.display = v===t?'block':'none';
    document.getElementById('tab-'+v).classList.toggle('active', v===t);
  });
  if(t==='pipeline') { autoPromoteCompleted(); renderPipeline(); }
  if(t==='grouping') renderGrouping();
  if(t==='stays') renderStays();
  if(t==='archive') renderArchive();
  if(t==='guests') renderGuests();
  if(t==='emails') renderEmails();
  if(t==='reminders') renderReminders();
  updateBadges();
}

function updateBadges() {
  const live = enquiries.filter(e=>['new','villas','followup1','followup2'].includes(e.stage));
  document.getElementById('badge-grouping').textContent = live.length;
  document.getElementById('badge-stays').textContent = enquiries.filter(e=>e.stage==='confirmed').length;
  document.getElementById('badge-archive').textContent = enquiries.filter(e=>['completed','dead'].includes(e.stage)).length;
}

function autoPromoteCompleted() {
  const now = new Date();
  enquiries.forEach(e => {
    if(e.stage==='confirmed' && e.checkout) {
      if(now > new Date(e.checkout)) { e.stage='completed'; e.completedDate=today(); }
    }
  });
}

// ========== PIPELINE ==========
function renderPipeline() {
  STAGE_KEYS.forEach(s => {
    const col = document.getElementById('col-'+s);
    if(col) col.innerHTML = '';
    const cnt = document.getElementById('cnt-'+s);
    if(cnt) cnt.textContent = 0;
  });
  const now = new Date();
  let arriving = 0;
  enquiries.forEach(e => {
    const col = document.getElementById('col-'+e.stage);
    if(!col) return;
    const cnt = document.getElementById('cnt-'+e.stage);
    cnt.textContent = parseInt(cnt.textContent)+1;
    const ci = e.checkin ? new Date(e.checkin) : null;
    const du = ci ? Math.ceil((ci-now)/86400000) : null;
    const urgent = du!==null && du<=14 && du>0;
    if(ci && ci.getMonth()===now.getMonth() && ci.getFullYear()===now.getFullYear() && e.stage==='confirmed') arriving++;
    col.innerHTML += `<div class="card" onclick="openDetail(${e.id})">
      <div class="card-name">${esc(e.name)}${urgent?'<span class="badge-dot"></span>':''}</div>
      <div class="card-detail">\u2709\uFE0F ${esc(e.email)}</div>
      ${e.phone?`<div class="card-detail">\u{1F4F1} ${esc(e.phone)}</div>`:''}
      <div class="card-tags">
        ${e.location?`<span class="tag tag-loc">\u{1F4CD} ${esc(e.location)}</span>`:''}
        ${e.bedrooms?`<span class="tag tag-bed">\u{1F6CF} ${e.bedrooms}BR</span>`:''}
        ${e.budget?`<span class="tag tag-budget">\u{1F4B5} ${esc(e.budget)}</span>`:''}
        ${urgent?`<span class="tag tag-urgent">\u26A1 ${du}d away</span>`:''}
        ${ci&&!urgent?`<span class="tag tag-arrive">\u{1F4C5} ${e.checkin}</span>`:''}
      </div>
      <div class="card-foot">Added ${fmtDate(e.created)}</div>
    </div>`;
  });
  document.getElementById('st-total').textContent = enquiries.length;
  document.getElementById('st-active').textContent = enquiries.filter(e=>['new','villas','followup1','followup2'].includes(e.stage)).length;
  document.getElementById('st-hold').textContent = enquiries.filter(e=>e.stage==='hold').length;
  document.getElementById('st-confirmed').textContent = enquiries.filter(e=>e.stage==='confirmed').length;
  document.getElementById('st-arriving').textContent = arriving;
  updateBadges();
}

// ========== GROUPING ==========
function setGroupBy(v) {
  groupBy = v;
  ['bedrooms','location','both'].forEach(b => document.getElementById('gb-'+b).classList.toggle('active', b===v));
  renderGrouping();
}
function setStageFilter(v) {
  stageFilter = v;
  ['all','new','villas','followup1','followup2'].forEach(b => document.getElementById('fp-'+b).classList.toggle('active', b===v));
  renderGrouping();
}
function renderGrouping() {
  const liveStages = ['new','villas','followup1','followup2','hold'];
  let pool = enquiries.filter(e => liveStages.includes(e.stage));
  if(stageFilter !== 'all') pool = pool.filter(e => e.stage === stageFilter);
  const groups = {};
  pool.forEach(e => {
    let key = '';
    if(groupBy==='bedrooms') key = e.bedrooms ? `${e.bedrooms} Bedroom${e.bedrooms==='1'?'':'s'}` : 'Bedrooms Unknown';
    else if(groupBy==='location') key = e.location || 'Location Flexible';
    else key = `${e.bedrooms||'?'}BR \u2014 ${e.location||'Flexible'}`;
    if(!groups[key]) groups[key]=[];
    groups[key].push(e);
  });
  const board = document.getElementById('grouping-board');
  if(Object.keys(groups).length === 0) {
    board.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark)">No live enquiries match your filter.</div>`;
    return;
  }
  const sortedKeys = Object.keys(groups).sort((a,b) => { const na=parseInt(a),nb=parseInt(b); if(!isNaN(na)&&!isNaN(nb)) return na-nb; return a.localeCompare(b); });
  board.innerHTML = sortedKeys.map(key => {
    const grp = groups[key];
    const hasMultiple = grp.length > 1;
    const cards = grp.map(e => {
      return `<div class="card${hasMultiple?' highlighted':''}" onclick="openDetail(${e.id})">
        ${hasMultiple?`<div class="match-banner show">\u{1F517} ${grp.length} enquiries \u2014 same ${groupBy==='bedrooms'?'bedroom size':groupBy==='location'?'location':'match'}</div>`:''}
        <div class="card-name">${esc(e.name)}</div>
        <div class="card-detail">\u2709\uFE0F ${esc(e.email)}</div>
        <div class="card-tags">
          <span class="tag" style="background:${STAGE_COLORS[e.stage]};color:white">${STAGE_LABELS[e.stage]}</span>
          ${e.location?`<span class="tag tag-loc">\u{1F4CD} ${esc(e.location)}</span>`:''}
          ${e.bedrooms?`<span class="tag tag-bed">\u{1F6CF} ${e.bedrooms}BR</span>`:''}
          ${e.budget?`<span class="tag tag-budget">\u{1F4B5} ${esc(e.budget)}</span>`:''}
          ${e.checkin?`<span class="tag tag-arrive">\u{1F4C5} ${e.checkin}</span>`:''}
        </div>
      </div>`;
    }).join('');
    return `<div class="group-section">
      <div class="group-label"><span>${key}</span><span class="group-count">${grp.length} enquir${grp.length===1?'y':'ies'}${hasMultiple?' \u2014 MATCH \u26A1':''}</span></div>
      <div class="group-grid">${cards}</div>
    </div>`;
  }).join('');
}

// ========== ENQUIRY CRUD ==========
function openNewEnquiry() {
  currentEnqId = null;
  document.getElementById('enq-modal-title').textContent = 'New Enquiry';
  document.getElementById('btn-del-enq').style.display = 'none';
  ['name','email','phone','country','budget','notes'].forEach(f=>document.getElementById('f-'+f).value='');
  ['location','bedrooms'].forEach(f=>document.getElementById('f-'+f).value='');
  document.getElementById('f-guests').value='';
  document.getElementById('f-checkin').value='';
  document.getElementById('f-checkout').value='';
  selectedStage='new'; updateStageUI();
  openModal('modal-enquiry');
}

function openEditEnquiry(id) {
  currentEnqId=id;
  const e=enquiries.find(x=>x.id==id);
  document.getElementById('enq-modal-title').textContent='Edit \u2014 '+e.name;
  document.getElementById('btn-del-enq').style.display='inline-block';
  document.getElementById('f-name').value=e.name||'';
  document.getElementById('f-email').value=e.email||'';
  document.getElementById('f-phone').value=e.phone||'';
  document.getElementById('f-country').value=e.country||'';
  document.getElementById('f-location').value=e.location||'';
  document.getElementById('f-bedrooms').value=e.bedrooms||'';
  document.getElementById('f-guests').value=e.guests||'';
  document.getElementById('f-budget').value=e.budget||'';
  document.getElementById('f-checkin').value=e.checkin||'';
  document.getElementById('f-checkout').value=e.checkout||'';
  document.getElementById('f-notes').value=e.notes||'';
  selectedStage=e.stage; updateStageUI();
  openModal('modal-enquiry');
}

async function saveEnquiry() {
  const name=document.getElementById('f-name').value.trim();
  const email=document.getElementById('f-email').value.trim();
  if(!name||!email){showNotif('Name and email required \u2717',true);return;}
  const data={name,email,
    phone:document.getElementById('f-phone').value.trim(),
    country:document.getElementById('f-country').value.trim(),
    location:document.getElementById('f-location').value,
    bedrooms:document.getElementById('f-bedrooms').value,
    guests:document.getElementById('f-guests').value,
    budget:document.getElementById('f-budget').value.trim(),
    checkin:document.getElementById('f-checkin').value,
    checkout:document.getElementById('f-checkout').value,
    notes:document.getElementById('f-notes').value.trim(),
    stage:selectedStage};
  if(currentEnqId) data.id = currentEnqId;
  else data.created = today();
  try {
    const resp = await API.saveEnquiry(data);
    if(!currentEnqId) { data.id = resp.id; data.created = today(); enquiries.unshift(data); }
    else { const idx=enquiries.findIndex(e=>e.id==currentEnqId); if(idx>=0) enquiries[idx]={...enquiries[idx],...data}; }
    closeModal('modal-enquiry'); renderPipeline(); updateBadges();
    showNotif(currentEnqId?'Updated \u2713':'Enquiry added \u2713');
  } catch(err) { showNotif('Save failed: '+err.message, true); }
}

async function deleteEnquiry() {
  if(!confirm('Delete this enquiry?')) return;
  try {
    await API.deleteEnquiry(currentEnqId);
    enquiries=enquiries.filter(e=>e.id!=currentEnqId);
    delete stays[currentEnqId];
    closeModal('modal-enquiry'); renderPipeline();
    showNotif('Deleted');
  } catch(err) { showNotif('Delete failed: '+err.message, true); }
}

// ========== DETAIL MODAL ==========
function openDetail(id) {
  const e=enquiries.find(x=>x.id==id);
  if(!e) return;
  const ci=e.checkin?new Date(e.checkin):null;
  const du=ci?Math.ceil((ci-new Date())/86400000):null;
  document.getElementById('detail-name').textContent=e.name;
  document.getElementById('detail-body').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <span style="background:${STAGE_COLORS[e.stage]};color:white;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600">${STAGE_LABELS[e.stage]}</span>
      <button class="btn btn-teak btn-sm" onclick="closeModal('modal-detail');openEditEnquiry(${e.id})">\u270F\uFE0F Edit</button>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${esc(e.email)}</div></div>
      <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${esc(e.phone||'\u2014')}</div></div>
      <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value">${esc(e.location||'\u2014')}</div></div>
      <div class="detail-item"><div class="detail-label">Bedrooms</div><div class="detail-value">${e.bedrooms||'\u2014'}</div></div>
      <div class="detail-item"><div class="detail-label">Guests</div><div class="detail-value">${e.guests||'\u2014'}</div></div>
      <div class="detail-item"><div class="detail-label">Budget / Night</div><div class="detail-value">${esc(e.budget||'\u2014')}</div></div>
      <div class="detail-item"><div class="detail-label">Check-in</div><div class="detail-value">${e.checkin||'\u2014'}${du!==null&&du>0?` <span style="color:var(--teak);font-size:12px">(${du}d)</span>`:''}</div></div>
      <div class="detail-item"><div class="detail-label">Check-out</div><div class="detail-value">${e.checkout||'\u2014'}</div></div>
    </div>
    ${e.notes?`<div class="form-section" style="margin-bottom:14px"><div class="fsec-title">Notes</div><div style="font-size:13px;line-height:1.6">${esc(e.notes)}</div></div>`:''}
    <div class="form-section">
      <div class="fsec-title">Move Stage</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${STAGE_KEYS.map(s=>`<button class="btn btn-sm" style="background:${e.stage===s?STAGE_COLORS[s]:'var(--sand-dark)'};color:${e.stage===s?'white':'var(--text)'}" onclick="moveStage(${e.id},'${s}')">${STAGE_LABELS[s]}</button>`).join('')}
      </div>
    </div>
    ${e.stage==='confirmed'?`<div class="form-section" style="margin-bottom:0"><div class="fsec-title">Stay Details</div><button class="btn btn-teak btn-sm" onclick="closeModal('modal-detail');openStayDetail(${e.id})">\u{1F3E1} Manage Stay Details</button></div>`:''}`;
  openModal('modal-detail');
}

async function moveStage(id, stage) {
  try {
    await API.moveStage(id, stage);
    const idx=enquiries.findIndex(e=>e.id==id);
    if(idx>=0) {
      enquiries[idx].stage=stage;
      if(stage==='completed') enquiries[idx].completedDate=today();
      if(stage==='dead') enquiries[idx].deadDate=today();
    }
    closeModal('modal-detail'); renderPipeline(); updateBadges();
    if(stage==='confirmed') { showNotif('Moved to Confirmed \u2713'); setTimeout(()=>showTab('stays'),1200); }
    else if(stage==='completed'||stage==='dead') showNotif(`Moved to ${STAGE_LABELS[stage]} \u2713`);
    else showNotif('Stage updated \u2713');
  } catch(err) { showNotif('Failed: '+err.message, true); }
}

// ========== HELPERS ==========
function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function selStage(s){selectedStage=s;updateStageUI();}
function updateStageUI(){
  document.querySelectorAll('.stage-btn').forEach(b=>{
    b.className='stage-btn';
    if(b.dataset.stage===selectedStage) b.className='stage-btn active-'+selectedStage;
  });
}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function today(){return new Date().toISOString().split('T')[0];}
function fmtDate(d){if(!d)return'\u2014';return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});}
function fmtDateShort(d){if(!d)return'\u2014';return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short'});}
function showNotif(msg,err){
  const n=document.getElementById('notif');
  n.textContent=msg; n.style.background=err?'var(--danger)':'var(--ocean)';
  n.classList.add('show'); setTimeout(()=>n.classList.remove('show'),3000);
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));
  initApp();
});
