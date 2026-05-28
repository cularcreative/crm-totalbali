// ========== STATE ==========
let enquiries = [];
let stays = {};
let activities = [];
let emails = [];
let payments = [];   // Finance tab — localStorage only
let expenses = [];   // Finance tab — localStorage only
let currentEnqId = null, currentStayId = null, currentEmailIdx = null, currentActId = null;
let currentPayId = null, currentExpId = null;
let selectedStage = 'new';
let groupBy = 'bedrooms', stageFilter = 'all';
let staysMonth = new Date().getMonth(), staysYear = new Date().getFullYear();
let transferMonth = new Date().getMonth(), transferYear = new Date().getFullYear();
let locFilter = 'all';
let activeCurrency = 'USD';

// FX rates (approximate — update as needed)
const FX = { USD: 1, AUD: 1.54, IDR: 16000 };

function toUSD(amount, currency) {
  return parseFloat(amount || 0) / (FX[currency] || 1);
}
function fmtCurrency(usd) {
  if (activeCurrency === 'IDR') return 'Rp ' + Math.round(usd * FX.IDR).toLocaleString();
  if (activeCurrency === 'AUD') return 'A$' + (usd * FX.AUD).toFixed(0);
  return '$' + usd.toFixed(0);
}

// ========== DEFAULT EMAILS ==========
function defaultEmails() {
  return [
    { id:1, trigger:'pre', days:30, subject:'🌴 30 Days Until Your Bali Holiday!',
      body:`Hi {name},\n\nWe're SO excited for you — just 30 days until Bali! Here's what to organise now:\n\n✅ Confirm flights & check passport (6+ months validity needed)\n✅ Arrange travel insurance\n✅ Book any activities — we can help!\n\nOur most popular add-ons:\n🚤 Lembongan snorkelling day trip\n🧘 In-villa yoga at sunrise\n🎂 Celebration cake & flowers on arrival\n🍽️ Private chef dinner\n\nJust reply and we'll sort everything.\n\nSee you in paradise!\nThe Total Bali Team 🌺` },
    { id:2, trigger:'pre', days:14, subject:'📋 2 Weeks to Go — Your Villa Details Inside',
      body:`Hi {name},\n\nOnly 2 weeks away! Your confirmed details:\n\n🏡 Villa: {villa}\n📍 Location: {location}\n📅 Check-in: {checkin} from 2:00 PM\n📅 Check-out: {checkout} by 11:00 AM\n\nThe Total Bali Team 🌴` },
    { id:3, trigger:'pre', days:7, subject:"📦 One Week Away — Everything You Need",
      body:`Hi {name},\n\n7 days! Here's your complete arrival pack:\n\n🏡 YOUR VILLA: {villa}\n✈️ Your airport transfer is confirmed — driver meets you in arrivals\n\n📱 Total Bali 24/7: +62 813 3864 8034\n\nCan't wait to see you!\nThe Total Bali Team 🌺` },
    { id:4, trigger:'pre', days:1, subject:'🌅 Tomorrow Is The Day! Final Bali Reminders',
      body:`Hi {name},\n\nTomorrow is the BIG day! 🎉\n\nYour driver will meet you at Ngurah Rai Airport (DPS). Call us anytime:\n📱 +62 813 3864 8034\n\nSee you on the island 🌴\nThe Total Bali Team` },
    { id:5, trigger:'inhouse', days:1, subject:'☀️ How\'s Your Stay Going, {name}?',
      body:`Hi {name},\n\nWe hope you've settled into {villa} and you're already loving every moment!\n\nAnything at all isn't right — please tell us now so we can fix it immediately.\n\nEnjoy every second 🌺\nThe Total Bali Team` },
    { id:6, trigger:'post', days:2, subject:'💛 How Was Your Stay? We\'d Love Your Feedback',
      body:`Hi {name},\n\nWe hope you made it home safely! We'd love to hear how your stay at {villa} was.\n\n⭐ Leave us a Google Review: [https://g.page/totalbali/review]\n\nThank you for choosing Total Bali.\n\nWith love from Bali 🌴\nThe Total Bali Team` },
    { id:7, trigger:'payment', days:21, subject:'💳 Balance Payment Reminder — {villa}',
      body:`Hi {name},\n\nJust a friendly reminder that your balance of USD ${'{balance}'} is due 21 days before your arrival.\n\nBooking: {villa} · Check-in: {checkin}\n\nPlease arrange your bank transfer at your earliest convenience.\n\nThe Total Bali Team\n+62 813 3864 8034` },
  ];
}

// ========== SYNC ENGINE ==========
async function apiRequest(action, data = null) {
  const url = `/api/crm/apps-script?action=${encodeURIComponent(action)}`;
  showNotif('Syncing...', false);
  try {
    let options;
    if (data) {
      options = {
        method: 'POST',
        redirect: 'follow',
        credentials: 'include',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data),
      };
    } else {
      options = { method: 'GET', redirect: 'follow', credentials: 'include' };
    }
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  } catch (err) {
    showNotif('Sync Error: ' + err.message, true);
    console.error('[CRM Sync Error]', action, err);
    return null;
  }
}

function saveLocalBackup() {
  localStorage.setItem('tb_backup_enq', JSON.stringify(enquiries));
  localStorage.setItem('tb_backup_stays', JSON.stringify(stays));
  localStorage.setItem('tb_backup_act', JSON.stringify(activities));
}

// ========== TABS ==========
const ALL_TABS = ['pipeline','grouping','stays','finance','transfers','archive','guests','emails','reminders'];

function showTab(t) {
  ALL_TABS.forEach(v => {
    const view = document.getElementById('view-'+v);
    const tab  = document.getElementById('tab-'+v);
    if (view) view.style.display = v===t ? 'block' : 'none';
    if (tab)  tab.classList.toggle('active', v===t);
  });
  if (t==='pipeline')  { autoPromoteCompleted(); renderPipeline(); }
  if (t==='grouping')  renderGrouping();
  if (t==='stays')     renderStays();
  if (t==='finance')   renderFinance();
  if (t==='transfers') renderTransfers();
  if (t==='archive')   renderArchive();
  if (t==='guests')    renderGuests();
  if (t==='emails')    renderEmails();
  if (t==='reminders') renderReminders();
  updateBadges();
}

function updateBadges() {
  const live = enquiries.filter(e=>['new','villas','followup1','followup2'].includes(e.stage));
  document.getElementById('badge-grouping').textContent = live.length;
  const conf = enquiries.filter(e=>['deposit','fullpay','confirmed'].includes(e.stage)).length;
  document.getElementById('badge-stays').textContent = conf;
  const arch = enquiries.filter(e=>['completed','dead'].includes(e.stage)).length;
  document.getElementById('badge-archive').textContent = arch;
  const unpaid = payments.filter(p=>p.status==='overdue'||p.status==='pending').length;
  document.getElementById('badge-finance').textContent = unpaid || '';
}

function autoPromoteCompleted() {
  const now = new Date();
  let changed = false;
  enquiries.forEach(e => {
    if (['deposit','fullpay','confirmed'].includes(e.stage) && e.checkout) {
      const co = new Date(e.checkout);
      if (now > co) {
        e.stage = 'completed';
        e.completedDate = today();
        changed = true;
        apiRequest('moveStage', { id: e.id, stage: 'completed' });
      }
    }
  });
  if (changed) saveLocalBackup();
}

// ========== PIPELINE ==========
const STAGE_KEYS = ['new','villas','followup1','followup2','hold','invoice','deposit','fullpay','confirmed','completed','dead'];
const STAGE_LABELS = {
  new:'New Enquiry',villas:'Needs Villas',followup1:'1st Follow Up',followup2:'2nd Follow Up',
  hold:'Villa on Hold',invoice:'Invoice Sent',deposit:'Deposit Received',fullpay:'Full Payment',
  confirmed:'Confirmed',completed:'Completed',dead:'Dead Client'
};
const STAGE_COLORS = {
  new:'#4a8fa8',villas:'#7b68c8',followup1:'#e67e22',followup2:'#c0572b',
  hold:'#8b6914',invoice:'#2a7a5a',deposit:'#16a085',fullpay:'#27ae60',
  confirmed:'#1a7a50',completed:'#1a3a4a',dead:'#5a5a5a'
};

function setLocFilter(loc) {
  locFilter = loc;
  document.querySelectorAll('.loc-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('loc-' + loc);
  if (btn) btn.classList.add('active');
  renderPipeline();
}

function renderPipeline() {
  STAGE_KEYS.forEach(s => {
    const col = document.getElementById('col-'+s);
    const cnt = document.getElementById('cnt-'+s);
    if (col) col.innerHTML = '';
    if (cnt) cnt.textContent = 0;
  });

  const now = new Date();
  let arriving = 0;

  // Filter by location
  let pool = enquiries.filter(e => !['completed','dead'].includes(e.stage));
  if (locFilter !== 'all') {
    pool = pool.filter(e => (e.location||'') === locFilter);
  }
  const countEl = document.getElementById('loc-filter-count');
  if (countEl) countEl.textContent = locFilter==='all' ? '' : `${pool.length} shown`;

  pool.forEach(e => {
    const col = document.getElementById('col-'+e.stage);
    if (!col) return;
    const cnt = document.getElementById('cnt-'+e.stage);
    if (cnt) cnt.textContent = parseInt(cnt.textContent||0)+1;
    const ci = e.checkin ? new Date(e.checkin) : null;
    const du = ci ? Math.ceil((ci-now)/86400000) : null;
    const urgent = du!==null && du<=14 && du>0;
    if (ci && ci.getMonth()===now.getMonth() && ci.getFullYear()===now.getFullYear() && e.stage==='confirmed') arriving++;
    const isPaid = e.stage==='deposit'||e.stage==='fullpay';
    col.innerHTML += `<div class="card" onclick="openDetail(${e.id})">
      <div class="card-name">${e.name}${urgent?'<span class="badge-dot"></span>':''}</div>
      <div class="card-detail">✉️ ${e.email}</div>
      ${e.phone?`<div class="card-detail">📱 ${e.phone}</div>`:''}
      <div class="card-tags">
        ${e.location?`<span class="tag tag-loc">📍 ${e.location}</span>`:''}
        ${e.bedrooms?`<span class="tag tag-bed">🛏 ${e.bedrooms}BR</span>`:''}
        ${e.budget?`<span class="tag tag-budget">💵 ${e.budget}</span>`:''}
        ${isPaid?`<span class="tag tag-pay">💳 ${STAGE_LABELS[e.stage]}</span>`:''}
        ${urgent?`<span class="tag tag-urgent">⚡ ${du}d away</span>`:''}
        ${ci&&!urgent?`<span class="tag tag-arrive">📅 ${e.checkin}</span>`:''}
      </div>
      <div class="card-foot">Added ${fmtDate(e.created)}</div>
    </div>`;
  });

  document.getElementById('st-total').textContent = enquiries.filter(e=>!['completed','dead'].includes(e.stage)).length;
  document.getElementById('st-active').textContent = enquiries.filter(e=>['new','villas','followup1','followup2'].includes(e.stage)).length;
  document.getElementById('st-deposit').textContent = enquiries.filter(e=>e.stage==='deposit').length;
  document.getElementById('st-fullpay').textContent = enquiries.filter(e=>e.stage==='fullpay').length;
  document.getElementById('st-confirmed').textContent = enquiries.filter(e=>e.stage==='confirmed').length;
  document.getElementById('st-arriving').textContent = arriving;
  updateBadges();
}

// ========== SMART MATCH ==========
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
  if (stageFilter !== 'all') pool = pool.filter(e => e.stage === stageFilter);

  const groups = {};
  pool.forEach(e => {
    let key = '';
    if (groupBy==='bedrooms') key = e.bedrooms ? `${e.bedrooms} Bedroom${e.bedrooms==='1'?'':'s'}` : 'Bedrooms Unknown';
    else if (groupBy==='location') key = e.location || 'Location Flexible';
    else key = `${e.bedrooms||'?'}BR — ${e.location||'Flexible'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  const board = document.getElementById('grouping-board');
  if (Object.keys(groups).length === 0) {
    board.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark)">No live enquiries match your filter.</div>`;
    return;
  }

  const sortedKeys = Object.keys(groups).sort((a,b) => {
    const na=parseInt(a), nb=parseInt(b);
    if (!isNaN(na)&&!isNaN(nb)) return na-nb;
    return a.localeCompare(b);
  });

  board.innerHTML = sortedKeys.map(key => {
    const grp = groups[key];
    const hasMultiple = grp.length > 1;
    const cards = grp.map(e => {
      const ci = e.checkin ? new Date(e.checkin) : null;
      const du = ci ? Math.ceil((ci-new Date())/86400000) : null;
      return `<div class="card${hasMultiple?' highlighted':''}" onclick="openDetail(${e.id})">
        ${hasMultiple?`<div class="match-banner show">🔗 ${grp.length} enquiries — same ${groupBy==='bedrooms'?'bedroom size':groupBy==='location'?'location':'match'}</div>`:''}
        <div class="card-name">${e.name}</div>
        <div class="card-detail">✉️ ${e.email}${e.phone?` · 📱 ${e.phone}`:''}</div>
        <div class="card-tags">
          <span class="tag" style="background:${STAGE_COLORS[e.stage]};color:white">${STAGE_LABELS[e.stage]}</span>
          ${e.location?`<span class="tag tag-loc">📍 ${e.location}</span>`:''}
          ${e.bedrooms?`<span class="tag tag-bed">🛏 ${e.bedrooms}BR</span>`:''}
          ${e.guests?`<span class="tag tag-budget">👥 ${e.guests} guests</span>`:''}
          ${e.budget?`<span class="tag tag-budget">💵 ${e.budget}</span>`:''}
          ${e.checkin?`<span class="tag tag-arrive">📅 ${e.checkin}</span>`:''}
          ${du!==null&&du<=14&&du>0?`<span class="tag tag-urgent">⚡ ${du}d</span>`:''}
        </div>
        ${e.notes?`<div class="card-detail" style="margin-top:3px;font-style:italic">"${e.notes.substring(0,60)}${e.notes.length>60?'…':''}"</div>`:''}
      </div>`;
    }).join('');
    return `<div class="group-section">
      <div class="group-label">
        <span>${groupBy==='bedrooms'?'🛏':groupBy==='location'?'📍':'🔀'} ${key}</span>
        <span class="group-count">${grp.length} enquir${grp.length===1?'y':'ies'}${hasMultiple?' — MATCH ⚡':''}</span>
      </div>
      <div class="group-grid">${cards}</div>
    </div>`;
  }).join('');
}

// ========== CONFIRMED STAYS ==========
function changeMonth(d) {
  staysMonth += d;
  if (staysMonth > 11) { staysMonth=0; staysYear++; }
  if (staysMonth < 0)  { staysMonth=11; staysYear--; }
  renderStays();
}
function setStaysMonth(offset) {
  const now = new Date();
  staysMonth = now.getMonth()+offset;
  staysYear = now.getFullYear();
  if (staysMonth > 11) { staysMonth -= 12; staysYear++; }
  renderStays();
}

function renderStays() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('month-label').textContent = `${months[staysMonth]} ${staysYear}`;

  const confirmed = enquiries.filter(e => ['deposit','fullpay','confirmed'].includes(e.stage) && e.checkin)
    .sort((a,b) => new Date(a.checkin)-new Date(b.checkin));
  const inWindow = confirmed.filter(e => {
    const ci = new Date(e.checkin);
    return ci.getMonth()===staysMonth && ci.getFullYear()===staysYear;
  });

  const actInWindow = activities.filter(a => {
    const ad = new Date(a.date);
    return ad.getMonth()===staysMonth && ad.getFullYear()===staysYear;
  });

  const board = document.getElementById('stays-board');
  if (inWindow.length===0 && actInWindow.length===0) {
    board.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark);margin-top:4px">No confirmed stays or activities in ${months[staysMonth]} ${staysYear}.</div>`;
    return;
  }

  const now = new Date();
  const stayRows = inWindow.map(e => ({ type:'stay', date: new Date(e.checkin), data: e }));
  const actRows  = actInWindow.map(a => ({ type:'activity', date: new Date(a.date), data: a }));
  const allRows  = [...stayRows, ...actRows].sort((a,b) => a.date - b.date);

  board.innerHTML = allRows.map(row => {
    if (row.type === 'activity') {
      const a = row.data;
      const ad = new Date(a.date);
      const du = Math.ceil((ad - now) / 86400000);
      let chipClass='chip-far', chipText=`${du}d away`;
      if (du < 0)    { chipClass='chip-past'; chipText='Done'; }
      else if (du===0) { chipClass='chip-today'; chipText='TODAY'; }
      else if (du<=3)  { chipClass='chip-soon'; chipText=`${du}d`; }
      else if (du<=14) { chipClass='chip-near'; chipText=`${du}d`; }
      return `<div class="stay-row-wrap">
        <div class="stay-row activity-row" onclick="openActivityDetail(${a.id})">
          <div>
            <div class="stay-date">${fmtDateShort(a.date)}</div>
            <div class="stay-date-sub">${a.time||'TBC'}</div>
          </div>
          <div>
            <div class="activity-badge">ACTIVITY</div>
            <div class="stay-villa">${a.guestName}</div>
            <div class="stay-villa-sub">✉️ ${a.email||'—'}</div>
          </div>
          <div><div class="stay-villa" style="color:#7b68c8">🎯 ${a.activityType}</div>${a.details?`<div class="stay-villa-sub">${a.details}</div>`:''}</div>
          <div>${a.pickup?`<span class="service-tag">🚗 ${a.pickup}</span>`:''}${a.notes?`<span class="service-tag" style="margin-top:3px">📝 ${a.notes.substring(0,30)}</span>`:''}</div>
          <div>${a.price?`<div style="font-weight:600;color:var(--success)">$${a.price}</div>`:'—'}</div>
          <div><div class="stay-date-sub" style="font-size:10px;color:var(--text-muted)">Activity only</div></div>
          <div>
            <div class="days-chip ${chipClass}">${chipText}</div>
            <button class="btn btn-sm" style="margin-top:5px;width:100%;background:#7b68c8;color:white" onclick="event.stopPropagation();openActivityDetail(${a.id})">✏️ Edit</button>
          </div>
        </div>
      </div>`;
    }

    const e = row.data;
    const sd = stays[e.id] || {};
    const ci = new Date(e.checkin);
    const co = e.checkout ? new Date(e.checkout) : null;
    const daysUntil = Math.ceil((ci-now)/86400000);
    const nights = co ? Math.ceil((co-ci)/86400000) : '?';
    const inHouse = daysUntil <= 0 && (!co || now < co);
    const past = co && now > co;

    let chipClass='chip-far', chipText=`${daysUntil}d away`;
    if (past)       { chipClass='chip-past'; chipText='Checked out'; }
    else if (inHouse) { chipClass='chip-inhouse'; chipText='IN HOUSE 🏡'; }
    else if (daysUntil===0) { chipClass='chip-today'; chipText='ARRIVES TODAY'; }
    else if (daysUntil<=3)  { chipClass='chip-soon'; chipText=`${daysUntil}d`; }
    else if (daysUntil<=14) { chipClass='chip-near'; chipText=`${daysUntil}d`; }

    const svcs = [];
    if (sd.meals)    sd.meals.split(',').forEach(s=>svcs.push(`<span class="service-tag meal">🍽️ ${s.trim()}</span>`));
    if (sd.tours)    sd.tours.split(',').forEach(s=>svcs.push(`<span class="service-tag tour">🌊 ${s.trim()}</span>`));
    if (sd.services) sd.services.split(',').forEach(s=>svcs.push(`<span class="service-tag">✨ ${s.trim()}</span>`));
    if (sd.special)  svcs.push(`<span class="service-tag special">⭐ ${sd.special}</span>`);
    if (sd.bod)      svcs.push(`<span class="service-tag" style="background:#f0ebff;color:#5a48a8">🎁 ${sd.bod}</span>`);
    const ts = sd.transferSlots || [];
    ts.forEach(t => {
      if (t.type) svcs.push(`<span class="service-tag car">🚗 ${t.type}${t.date?' '+t.date:''}</span>`);
    });
    if (sd.flightIn) svcs.push(`<span class="service-tag" style="background:#e8f4f8;color:var(--ocean-mid)">✈️ In: ${sd.flightIn}</span>`);
    if (sd.flightOut) svcs.push(`<span class="service-tag" style="background:#e8f4f8;color:var(--ocean-mid)">✈️ Out: ${sd.flightOut}</span>`);

    // Payment summary from paymentSchedule
    const ps = sd.paymentSchedule || [];
    let payHtml = '';
    if (ps.length) {
      payHtml = '<div class="pay-schedule">' + ps.map(p => {
        let cls = 'pay-future', icon = '○';
        if (p.status==='paid') { cls='pay-paid'; icon='✓'; }
        else if (p.status==='overdue') { cls='pay-overdue'; icon='!'; }
        else if (p.status==='pending' && p.dueDate && new Date(p.dueDate) <= new Date()) { cls='pay-due'; icon='!'; }
        const amt = p.currency==='IDR' ? `Rp${parseInt(p.amount||0).toLocaleString()}` : `${p.currency==='AUD'?'A$':'$'}${p.amount||''}`;
        return `<div class="pay-row"><span class="pay-status ${cls}">${icon}</span><span>${p.type||''} ${amt}</span>${p.dueDate?`<span style="color:var(--text-muted)">${p.dueDate}</span>`:''}</div>`;
      }).join('') + '</div>';
    } else {
      payHtml = '<div style="font-size:10px;color:var(--text-muted)">No payments logged</div>';
    }

    const emailDots = getEmailDots(e, sd);
    const stageBadge = e.stage==='deposit' ? `<span style="background:#16a085;color:white;font-size:9px;padding:2px 6px;border-radius:8px;font-weight:700">💳 DEPOSIT</span>` :
                       e.stage==='fullpay' ? `<span style="background:#27ae60;color:white;font-size:9px;padding:2px 6px;border-radius:8px;font-weight:700">✅ FULL PAY</span>` : '';

    return `<div class="stay-row-wrap">
      <div class="stay-row" onclick="openStayDetail(${e.id})">
        <div>
          <div class="stay-date">${fmtDateShort(e.checkin)}</div>
          <div class="stay-date-sub">${nights}n · ${e.checkout?fmtDateShort(e.checkout):'—'}</div>
          ${stageBadge}
        </div>
        <div>
          <div class="stay-villa">${e.name}</div>
          <div class="stay-villa-sub">✉️ ${e.email}</div>
          <div class="stay-villa-sub">👥 ${e.guests||'?'} guests</div>
        </div>
        <div>
          <div class="stay-villa">${sd.villa||'<span style="color:var(--text-muted);font-style:italic">No villa</span>'}</div>
          <div class="stay-villa-sub">📍 ${sd.villaLoc||e.location||'—'} · 🛏 ${e.bedrooms||'?'}BR</div>
          ${sd.vmName?`<div class="stay-villa-sub">👤 ${sd.vmName} ${sd.vmPhone||''}</div>`:''}
        </div>
        <div>
          <div class="stay-services">${svcs.length?svcs.join(''):'<span style="color:var(--text-muted);font-size:10px">None booked</span>'}</div>
          ${sd.notes?`<div style="font-size:9px;color:var(--text-muted);margin-top:2px">📝 ${sd.notes.substring(0,50)}</div>`:''}
        </div>
        <div>${payHtml}</div>
        <div class="stay-emails">${emailDots}</div>
        <div>
          <div class="days-chip ${chipClass}">${chipText}</div>
          <button class="btn btn-sm btn-teak" style="margin-top:5px;width:100%" onclick="event.stopPropagation();openStayDetail(${e.id})">✏️ Edit</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function getEmailDots(e, sd) {
  const now = new Date();
  const ci = e.checkin ? new Date(e.checkin) : null;
  const co = e.checkout ? new Date(e.checkout) : null;
  const rows = [];
  emails.forEach(em => {
    let fd = null;
    if (em.trigger==='pre'&&ci)      fd = new Date(ci.getTime()-em.days*86400000);
    if (em.trigger==='post'&&co)     fd = new Date(co.getTime()+em.days*86400000);
    if (em.trigger==='inhouse'&&ci)  fd = new Date(ci.getTime()+86400000);
    if (em.trigger==='payment'&&ci)  fd = new Date(ci.getTime()-em.days*86400000);
    if (!fd) return;
    const sent = fd < now;
    const dueToday = !sent && Math.ceil((fd-now)/86400000)<=1;
    rows.push(`<div class="email-dot ${sent?'dot-sent':dueToday?'dot-due':'dot-pending'}">
      ${sent?'✅':dueToday?'🔴':'⏳'} <span style="font-size:9px">${em.subject.substring(0,24)}…</span>
    </div>`);
  });
  return rows.length ? rows.join('') : '<div style="font-size:10px;color:var(--text-muted)">No dates set</div>';
}

// ========== STAY DETAIL MODAL ==========
function openStayDetail(id) {
  currentStayId = id;
  const e = enquiries.find(x=>x.id===id);
  if (!e) return;
  const sd = stays[id] || {};
  document.getElementById('stay-modal-title').textContent = `${e.name} — ${fmtDate(e.checkin)}`;

  document.getElementById('s-villa').value       = sd.villa||'';
  document.getElementById('s-villa-loc').value   = sd.villaLoc||e.location||'';
  document.getElementById('s-villa-addr').value  = sd.villaAddr||'';
  document.getElementById('s-vm-name').value     = sd.vmName||'';
  document.getElementById('s-vm-phone').value    = sd.vmPhone||'';
  document.getElementById('s-sector').value      = sd.sector||'';
  document.getElementById('s-flight-in').value       = sd.flightIn||'';
  document.getElementById('s-flight-in-time').value  = sd.flightInTime||'';
  document.getElementById('s-flight-in-from').value  = sd.flightInFrom||'';
  document.getElementById('s-flight-out').value      = sd.flightOut||'';
  document.getElementById('s-flight-out-time').value = sd.flightOutTime||'';
  document.getElementById('s-flight-out-to').value   = sd.flightOutTo||'';
  document.getElementById('s-meals').value      = sd.meals||'';
  document.getElementById('s-tours').value      = sd.tours||'';
  document.getElementById('s-services').value  = sd.services||'';
  document.getElementById('s-special').value   = sd.special||'';
  document.getElementById('s-bod').value        = sd.bod||'';
  document.getElementById('s-commission').value = sd.commission||'';
  document.getElementById('s-notes').value      = sd.notes||'';

  renderPaymentSlots(sd.paymentSchedule || []);
  renderTransferSlots(sd.transferSlots || []);
  openModal('modal-stay');
}

// Payment slots inside stay modal
function renderPaymentSlots(slots) {
  const el = document.getElementById('payment-schedule-editor');
  if (!el) return;
  if (!slots.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">No payments added yet.</div>'; return; }
  el.innerHTML = slots.map((p, i) => `
    <div class="transfer-row" id="pay-slot-${i}">
      <div class="transfer-row-header">
        <span>💳 Payment ${i+1}</span>
        <button class="btn btn-danger btn-sm" onclick="removePaymentSlot(${i})">Remove</button>
      </div>
      <div class="form-grid3" style="gap:6px">
        <div class="fg"><label>Type</label>
          <select onchange="updatePaySlot(${i},'type',this.value)">
            ${['deposit','instalment','balance','full','refund'].map(t=>`<option value="${t}"${p.type===t?' selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Amount</label><input type="number" value="${p.amount||''}" onchange="updatePaySlot(${i},'amount',this.value)" placeholder="1500"></div>
        <div class="fg"><label>Currency</label>
          <select onchange="updatePaySlot(${i},'currency',this.value)">
            ${['USD','AUD','IDR'].map(c=>`<option value="${c}"${p.currency===c?' selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Due Date</label><input type="date" value="${p.dueDate||''}" onchange="updatePaySlot(${i},'dueDate',this.value)"></div>
        <div class="fg"><label>Status</label>
          <select onchange="updatePaySlot(${i},'status',this.value)">
            ${['pending','paid','overdue'].map(s=>`<option value="${s}"${p.status===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Method</label>
          <select onchange="updatePaySlot(${i},'method',this.value)">
            ${['bank','cc','cash','wise'].map(m=>`<option value="${m}"${p.method===m?' selected':''}>${m==='cc'?'Credit Card':m==='wise'?'Wise/PayPal':m.charAt(0).toUpperCase()+m.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>CC Fee %</label><input type="number" value="${p.ccFee||''}" onchange="updatePaySlot(${i},'ccFee',this.value)" placeholder="2.9" step="0.1"></div>
        <div class="fg"><label>Wave Ref #</label><input value="${p.waveRef||''}" onchange="updatePaySlot(${i},'waveRef',this.value)" placeholder="INV-001"></div>
        <div class="fg"><label>Paid Date</label><input type="date" value="${p.paidDate||''}" onchange="updatePaySlot(${i},'paidDate',this.value)"></div>
      </div>
    </div>`).join('');
}

let _paySlots = [];
let _transferSlots = [];

function addPaymentSlot() {
  _paySlots.push({id:'pay_'+Date.now(), type:'deposit', amount:'', currency:'USD', dueDate:'', status:'pending', method:'bank', ccFee:'', waveRef:'', paidDate:''});
  renderPaymentSlots(_paySlots);
}
function removePaymentSlot(i) {
  _paySlots.splice(i, 1);
  renderPaymentSlots(_paySlots);
}
function updatePaySlot(i, field, val) {
  if (_paySlots[i]) _paySlots[i][field] = val;
}

// Transfer slots inside stay modal
function renderTransferSlots(slots) {
  const el = document.getElementById('transfer-slots-editor');
  if (!el) return;
  if (!slots.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">No transfers added yet.</div>'; return; }
  el.innerHTML = slots.map((t, i) => `
    <div class="transfer-row" id="tr-slot-${i}">
      <div class="transfer-row-header">
        <span>🚗 Transfer ${i+1}</span>
        <button class="btn btn-danger btn-sm" onclick="removeTransferSlot(${i})">Remove</button>
      </div>
      <div class="form-grid3" style="gap:6px">
        <div class="fg"><label>Type</label>
          <select onchange="updateTrSlot(${i},'type',this.value)">
            ${['Airport Pickup','Airport Drop-off','Multi-stop Transfer','Villa to Villa','Day Trip Transfer','Other'].map(tp=>`<option value="${tp}"${t.type===tp?' selected':''}>${tp}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Date</label><input type="date" value="${t.date||''}" onchange="updateTrSlot(${i},'date',this.value)"></div>
        <div class="fg"><label>Time</label><input type="time" value="${t.time||''}" onchange="updateTrSlot(${i},'time',this.value)"></div>
        <div class="fg"><label>Pax</label><input type="number" value="${t.pax||''}" onchange="updateTrSlot(${i},'pax',this.value)" placeholder="4"></div>
        <div class="fg"><label>Pickup</label><input value="${t.pickup||''}" onchange="updateTrSlot(${i},'pickup',this.value)" placeholder="Ngurah Rai Airport"></div>
        <div class="fg"><label>Dropoff</label><input value="${t.dropoff||''}" onchange="updateTrSlot(${i},'dropoff',this.value)" placeholder="Villa Kalis, Seminyak"></div>
        <div class="fg"><label>Vehicle / Details</label><input value="${t.details||''}" onchange="updateTrSlot(${i},'details',this.value)" placeholder="MPV, max 6 pax"></div>
        <div class="fg"><label>Notes</label><input value="${t.notes||''}" onchange="updateTrSlot(${i},'notes',this.value)" placeholder="Driver contact, flight no…"></div>
      </div>
    </div>`).join('');
}

function addTransferSlot() {
  _transferSlots.push({type:'Airport Pickup', date:'', time:'', pax:'', pickup:'', dropoff:'', details:'', notes:''});
  renderTransferSlots(_transferSlots);
}
function removeTransferSlot(i) {
  _transferSlots.splice(i, 1);
  renderTransferSlots(_transferSlots);
}
function updateTrSlot(i, field, val) {
  if (_transferSlots[i]) _transferSlots[i][field] = val;
}

// Override openStayDetail to initialise slot arrays
const _origOpenStayDetail = openStayDetail;
openStayDetail = function(id) {
  const sd = stays[id] || {};
  _paySlots = JSON.parse(JSON.stringify(sd.paymentSchedule || []));
  _transferSlots = JSON.parse(JSON.stringify(sd.transferSlots || []));
  _origOpenStayDetail(id);
};

async function saveStayDetails() {
  const data = {
    id: currentStayId,
    villa:         document.getElementById('s-villa').value.trim(),
    villaLoc:      document.getElementById('s-villa-loc').value.trim(),
    villaAddr:     document.getElementById('s-villa-addr').value.trim(),
    vmName:        document.getElementById('s-vm-name').value.trim(),
    vmPhone:       document.getElementById('s-vm-phone').value.trim(),
    sector:        document.getElementById('s-sector').value,
    flightIn:      document.getElementById('s-flight-in').value.trim(),
    flightInTime:  document.getElementById('s-flight-in-time').value,
    flightInFrom:  document.getElementById('s-flight-in-from').value.trim(),
    flightOut:     document.getElementById('s-flight-out').value.trim(),
    flightOutTime: document.getElementById('s-flight-out-time').value,
    flightOutTo:   document.getElementById('s-flight-out-to').value.trim(),
    meals:         document.getElementById('s-meals').value.trim(),
    tours:         document.getElementById('s-tours').value.trim(),
    services:      document.getElementById('s-services').value.trim(),
    special:       document.getElementById('s-special').value.trim(),
    bod:           document.getElementById('s-bod').value.trim(),
    commission:    document.getElementById('s-commission').value.trim(),
    notes:         document.getElementById('s-notes').value.trim(),
    paymentSchedule: _paySlots,
    transferSlots:   _transferSlots,
  };
  const resp = await apiRequest('saveStay', data);
  if (resp && resp.success) {
    stays[currentStayId] = data;
    saveLocalBackup();
    closeModal('modal-stay');
    renderStays();
    showNotif('Stay details saved ✓');
  }
}

// ========== TRANSFERS TAB ==========
function changeTransferMonth(d) {
  transferMonth += d;
  if (transferMonth > 11) { transferMonth=0; transferYear++; }
  if (transferMonth < 0)  { transferMonth=11; transferYear--; }
  renderTransfers();
}
function setTransferMonth(offset) {
  const now = new Date();
  transferMonth = now.getMonth()+offset;
  transferYear = now.getFullYear();
  renderTransfers();
}

function renderTransfers() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('transfer-month-label').textContent = `${months[transferMonth]} ${transferYear}`;

  const board = document.getElementById('transfers-board');
  const rows = [];

  // Collect all transfer events from stays in window
  enquiries.filter(e => ['deposit','fullpay','confirmed'].includes(e.stage) && e.checkin).forEach(e => {
    const sd = stays[e.id] || {};
    const slots = sd.transferSlots || [];
    slots.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (d.getMonth()===transferMonth && d.getFullYear()===transferYear) {
        rows.push({ date: d, enq: e, sd, transfer: t });
      }
    });
    // Also show flight arrival/departure if in window
    if (sd.flightInTime) {
      const d = new Date(sd.flightInTime);
      if (d.getMonth()===transferMonth && d.getFullYear()===transferYear) {
        rows.push({ date: d, enq: e, sd, transfer: { type:'Flight Arrival', date: sd.flightInTime, pickup:'Airport', dropoff:sd.villaLoc||e.location||'', details:`${sd.flightIn||''} from ${sd.flightInFrom||''}`, notes:'' } });
      }
    }
    if (sd.flightOutTime) {
      const d = new Date(sd.flightOutTime);
      if (d.getMonth()===transferMonth && d.getFullYear()===transferYear) {
        rows.push({ date: d, enq: e, sd, transfer: { type:'Flight Departure', date: sd.flightOutTime, pickup:sd.villaLoc||e.location||'', dropoff:'Airport', details:`${sd.flightOut||''} to ${sd.flightOutTo||''}`, notes:'' } });
      }
    }
  });

  rows.sort((a,b) => a.date - b.date);

  if (!rows.length) {
    board.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark)">No transfers in ${months[transferMonth]} ${transferYear}. Add transfer slots in the Stay Details modal.</div>`;
    return;
  }

  board.innerHTML = rows.map(row => {
    const t = row.transfer;
    const e = row.enq;
    const sd = row.sd;
    const d = row.date;
    const isArrival = t.type && t.type.toLowerCase().includes('pickup') || t.type==='Flight Arrival';
    const color = isArrival ? '#16a085' : t.type==='Flight Departure'?'#c0572b':'#2a5568';
    return `<div class="transfer-row" style="margin-bottom:8px;border-left:3px solid ${color}">
      <div class="transfer-row-header">
        <span style="color:${color};font-size:12px">🚗 ${t.type||'Transfer'}</span>
        <span style="font-size:11px;color:var(--text-muted)">${fmtDate(t.date||'')} ${t.time||''}</span>
      </div>
      <div style="font-size:11px;margin-bottom:4px"><strong>${e.name}</strong> · 👥 ${e.guests||'?'} pax ${t.pax?`(${t.pax} this transfer)`:''}</div>
      <div style="font-size:11px;color:var(--text-muted)">
        📍 From: ${t.pickup||'—'} → ${t.dropoff||'—'}
        ${t.details?` · ${t.details}`:''}
      </div>
      ${sd.villa?`<div style="font-size:10px;color:var(--text-muted);margin-top:2px">🏡 ${sd.villa}</div>`:''}
      ${t.notes?`<div style="font-size:10px;color:var(--ocean);margin-top:2px">📝 ${t.notes}</div>`:''}
    </div>`;
  }).join('');
}

function copyTransferReport() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let txt = `TOTAL BALI — TRANSFER REPORT\n${months[transferMonth]} ${transferYear}\nGenerated: ${new Date().toLocaleDateString()}\n`;
  txt += '='.repeat(50) + '\n\n';

  const rows = [];
  enquiries.filter(e => ['deposit','fullpay','confirmed'].includes(e.stage) && e.checkin).forEach(e => {
    const sd = stays[e.id] || {};
    (sd.transferSlots || []).forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (d.getMonth()===transferMonth && d.getFullYear()===transferYear) rows.push({ date: d, e, sd, t });
    });
  });
  rows.sort((a,b) => a.date - b.date);

  rows.forEach(row => {
    const {e, sd, t} = row;
    txt += `${fmtDate(t.date||'')} ${t.time||''} — ${t.type||'Transfer'}\n`;
    txt += `  Guest: ${e.name} (${e.guests||'?'} pax)\n`;
    txt += `  From: ${t.pickup||'—'} → To: ${t.dropoff||'—'}\n`;
    if (t.details) txt += `  Vehicle: ${t.details}\n`;
    if (t.notes) txt += `  Notes: ${t.notes}\n`;
    if (sd.villa) txt += `  Villa: ${sd.villa}\n`;
    txt += '\n';
  });

  if (!rows.length) txt += 'No transfers this month.\n';
  navigator.clipboard.writeText(txt).then(()=>showNotif('Transfer report copied ✓')).catch(()=>showNotif('Copy failed',true));
}

// ========== ACTIVITIES CRUD ==========
function openNewActivity() {
  currentActId = null;
  document.getElementById('act-modal-title').textContent = 'Add Activity / Service Booking';
  document.getElementById('btn-del-act').style.display = 'none';
  ['a-name','a-email','a-phone','a-details','a-pickup','a-notes','a-supplier'].forEach(f=>{const el=document.getElementById(f);if(el)el.value='';});
  document.getElementById('a-guests').value='';
  document.getElementById('a-price').value='';
  document.getElementById('a-type').value='';
  document.getElementById('a-date').value='';
  document.getElementById('a-time').value='';
  openModal('modal-activity');
}

function openActivityDetail(id) {
  currentActId = id;
  const a = activities.find(x=>x.id===id);
  if (!a) return;
  document.getElementById('act-modal-title').textContent = `Edit — ${a.activityType}: ${a.guestName}`;
  document.getElementById('btn-del-act').style.display = 'inline-block';
  document.getElementById('a-name').value    = a.guestName||'';
  document.getElementById('a-email').value   = a.email||'';
  document.getElementById('a-phone').value   = a.phone||'';
  document.getElementById('a-guests').value  = a.guests||'';
  document.getElementById('a-type').value    = a.activityType||'';
  document.getElementById('a-date').value    = a.date||'';
  document.getElementById('a-time').value    = a.time||'';
  document.getElementById('a-pickup').value  = a.pickup||'';
  document.getElementById('a-price').value   = a.price||'';
  document.getElementById('a-details').value = a.details||'';
  document.getElementById('a-supplier').value= a.supplierContact||'';
  document.getElementById('a-notes').value   = a.notes||'';
  openModal('modal-activity');
}

async function saveActivity() {
  const name  = document.getElementById('a-name').value.trim();
  const atype = document.getElementById('a-type').value;
  const date  = document.getElementById('a-date').value;
  if (!name||!atype||!date) { showNotif('Name, activity type and date required ✗',true); return; }
  const data = {
    guestName: name,
    email:     document.getElementById('a-email').value.trim(),
    phone:     document.getElementById('a-phone').value.trim(),
    guests:    document.getElementById('a-guests').value,
    activityType: atype, date,
    time:      document.getElementById('a-time').value,
    pickup:    document.getElementById('a-pickup').value.trim(),
    price:     document.getElementById('a-price').value.trim(),
    details:   document.getElementById('a-details').value.trim(),
    supplierContact: document.getElementById('a-supplier').value.trim(),
    notes:     document.getElementById('a-notes').value.trim(),
  };
  if (currentActId) data.id = currentActId;
  const resp = await apiRequest('saveActivity', data);
  if (resp && resp.success) {
    if (currentActId) {
      const idx = activities.findIndex(a=>a.id===currentActId);
      activities[idx] = {...activities[idx], ...data};
      showNotif('Activity updated ✓');
    } else {
      data.id = resp.id; data.dateAdded = today();
      activities.push(data);
      showNotif('Activity added ✓');
    }
    closeModal('modal-activity');
    const d = new Date(date); staysMonth = d.getMonth(); staysYear = d.getFullYear();
    showTab('stays');
  }
}

async function deleteActivity() {
  if (!confirm('Delete this activity?')) return;
  const resp = await apiRequest('deleteActivity', { id: currentActId });
  if (resp && resp.success) {
    activities = activities.filter(a=>a.id!==currentActId);
    closeModal('modal-activity'); renderStays();
    showNotif('Deleted');
  }
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
  document.getElementById('f-team-notes').value='';
  selectedStage='new'; updateStageUI();
  openModal('modal-enquiry');
}

function openEditEnquiry(id) {
  currentEnqId = id;
  const e = enquiries.find(x=>x.id===id);
  if (!e) return;
  document.getElementById('enq-modal-title').textContent = 'Edit — '+e.name;
  document.getElementById('btn-del-enq').style.display = 'inline-block';
  document.getElementById('f-name').value      = e.name||'';
  document.getElementById('f-email').value     = e.email||'';
  document.getElementById('f-phone').value     = e.phone||'';
  document.getElementById('f-country').value   = e.country||'';
  document.getElementById('f-location').value  = e.location||'';
  document.getElementById('f-bedrooms').value  = e.bedrooms||'';
  document.getElementById('f-guests').value    = e.guests||'';
  document.getElementById('f-budget').value    = e.budget||'';
  document.getElementById('f-checkin').value   = e.checkin||'';
  document.getElementById('f-checkout').value  = e.checkout||'';
  document.getElementById('f-notes').value     = e.notes||'';
  document.getElementById('f-team-notes').value = e.teamNotes||'';
  selectedStage = e.stage; updateStageUI();
  openModal('modal-enquiry');
}

async function saveEnquiry() {
  const name  = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  if (!name||!email) { showNotif('Name and email required ✗',true); return; }
  const data = { name, email,
    phone:     document.getElementById('f-phone').value.trim(),
    country:   document.getElementById('f-country').value.trim(),
    location:  document.getElementById('f-location').value,
    bedrooms:  document.getElementById('f-bedrooms').value,
    guests:    document.getElementById('f-guests').value,
    budget:    document.getElementById('f-budget').value.trim(),
    checkin:   document.getElementById('f-checkin').value,
    checkout:  document.getElementById('f-checkout').value,
    notes:     document.getElementById('f-notes').value.trim(),
    teamNotes: document.getElementById('f-team-notes').value.trim(),
    stage:     selectedStage
  };
  if (currentEnqId) data.id = currentEnqId;
  const resp = await apiRequest('saveEnquiry', data);
  if (resp && resp.success) {
    if (currentEnqId) {
      const idx = enquiries.findIndex(e=>e.id===currentEnqId);
      enquiries[idx] = {...enquiries[idx], ...data};
      showNotif('Updated ✓');
    } else {
      data.id = resp.id; data.created = today();
      enquiries.unshift(data);
      showNotif('Enquiry added ✓');
    }
    closeModal('modal-enquiry'); renderPipeline(); updateBadges();
  }
}

async function deleteEnquiry() {
  if (!confirm('Delete this enquiry?')) return;
  const resp = await apiRequest('deleteEnquiry', { id: currentEnqId });
  if (resp && resp.success) {
    enquiries = enquiries.filter(e=>e.id!==currentEnqId);
    closeModal('modal-enquiry'); renderPipeline();
    showNotif('Deleted');
  }
}

// ========== DETAIL MODAL ==========
function openDetail(id) {
  const e = enquiries.find(x=>x.id===id);
  if (!e) return;
  const ci = e.checkin ? new Date(e.checkin) : null;
  const du = ci ? Math.ceil((ci-new Date())/86400000) : null;
  document.getElementById('detail-name').textContent = e.name;
  const isStayStage = ['deposit','fullpay','confirmed'].includes(e.stage);
  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <span style="background:${STAGE_COLORS[e.stage]};color:white;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600">${STAGE_LABELS[e.stage]}</span>
      <button class="btn btn-teak btn-sm" onclick="closeModal('modal-detail');openEditEnquiry(${e.id})">✏️ Edit</button>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${e.email}</div></div>
      <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${e.phone||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value">${e.location||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Bedrooms</div><div class="detail-value">${e.bedrooms||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Guests</div><div class="detail-value">${e.guests||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Budget / Night</div><div class="detail-value">${e.budget||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Check-in</div><div class="detail-value">${e.checkin||'—'}${du!==null&&du>0?` <span style="color:var(--teak);font-size:12px">(${du}d)</span>`:''}</div></div>
      <div class="detail-item"><div class="detail-label">Check-out</div><div class="detail-value">${e.checkout||'—'}</div></div>
    </div>
    ${e.notes?`<div class="form-section" style="margin-bottom:12px"><div class="fsec-title">Guest Notes</div><div style="font-size:13px;line-height:1.6">${e.notes}</div></div>`:''}
    ${e.teamNotes?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px 12px;margin-bottom:12px"><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#856404;margin-bottom:4px">Team Notes</div><div style="font-size:12px;line-height:1.6;color:#5a4200">${e.teamNotes}</div></div>`:''}
    <div class="form-section">
      <div class="fsec-title">Move Stage</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${STAGE_KEYS.map(s=>`<button class="btn btn-sm" style="background:${e.stage===s?STAGE_COLORS[s]:'var(--sand-dark)'};color:${e.stage===s?'white':'var(--text)'}" onclick="moveStage(${e.id},'${s}')">${STAGE_LABELS[s]}</button>`).join('')}
      </div>
    </div>
    ${isStayStage?`<div class="form-section" style="margin-bottom:0"><div class="fsec-title">Stay Details</div><button class="btn btn-teak btn-sm" onclick="closeModal('modal-detail');openStayDetail(${e.id})">🏡 Manage Stay Details & Logistics</button></div>`:''}`;
  openModal('modal-detail');
}

async function moveStage(id, stage) {
  const resp = await apiRequest('moveStage', { id, stage });
  if (resp && resp.success) {
    const idx = enquiries.findIndex(e=>e.id===id);
    enquiries[idx].stage = stage;
    if (stage==='completed') enquiries[idx].completedDate = today();
    if (stage==='dead')      enquiries[idx].deadDate = today();
    saveLocalBackup();
    closeModal('modal-detail'); renderPipeline(); updateBadges();
    if (['deposit','fullpay','confirmed'].includes(stage)) {
      showNotif(`Moved to ${STAGE_LABELS[stage]} — check the Stays tab to add villa & logistics ✓`);
      setTimeout(()=>showTab('stays'), 1200);
    } else if (stage==='completed'||stage==='dead') {
      showNotif(`Moved to ${STAGE_LABELS[stage]} — find them in the Archive tab ✓`);
    } else {
      showNotif('Stage updated ✓');
    }
  }
}

// ========== GUESTS TABLE ==========
function renderGuests() {
  const q = (document.getElementById('guest-search')?.value||'').toLowerCase();
  const filtered = enquiries.filter(e=>!q||e.name.toLowerCase().includes(q)||e.email.toLowerCase().includes(q)||(e.location||'').toLowerCase().includes(q));
  document.getElementById('guests-tbody').innerHTML = filtered.length===0
    ? '<tr><td colspan="8" style="padding:30px;text-align:center;color:var(--text-muted)">No guests found</td></tr>'
    : filtered.map(e=>`<tr style="border-bottom:1px solid var(--sand);cursor:pointer" onclick="openDetail(${e.id})" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
      <td style="padding:9px 12px"><div style="font-weight:500">${e.name}</div><div style="font-size:10px;color:var(--text-muted)">${e.email}</div></td>
      <td style="padding:9px 12px">${e.location||'—'}</td>
      <td style="padding:9px 12px">${e.bedrooms||'—'}</td>
      <td style="padding:9px 12px">${e.guests||'—'}</td>
      <td style="padding:9px 12px">${e.budget||'—'}</td>
      <td style="padding:9px 12px">${e.checkin||'—'}</td>
      <td style="padding:9px 12px"><span style="background:${STAGE_COLORS[e.stage]};color:white;padding:3px 9px;border-radius:10px;font-size:9px;font-weight:600">${STAGE_LABELS[e.stage]}</span></td>
      <td style="padding:9px 12px"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEditEnquiry(${e.id})">Edit</button></td>
    </tr>`).join('');
}

// ========== FINANCE TAB ==========
function setCurrency(c) {
  activeCurrency = c;
  ['USD','AUD','IDR'].forEach(x=>document.getElementById('cur-'+x).classList.toggle('active',x===c));
  renderFinance();
}

function populateFinanceMonthSelect() {
  const sel = document.getElementById('finance-month-select');
  if (!sel) return;
  sel.innerHTML = '';
  const now = new Date();
  for (let i = -3; i <= 6; i++) {
    let m = now.getMonth()+i, y = now.getFullYear();
    if (m < 0)  { m += 12; y--; }
    if (m > 11) { m -= 12; y++; }
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const opt = document.createElement('option');
    opt.value = `${y}-${m}`;
    opt.textContent = `${months[m]} ${y}`;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

function renderFinance() {
  const sel = document.getElementById('finance-month-select');
  let fMonth = new Date().getMonth(), fYear = new Date().getFullYear();
  if (sel && sel.value) {
    const parts = sel.value.split('-');
    fYear  = parseInt(parts[0]);
    fMonth = parseInt(parts[1]);
  }

  // Collect all payments: Finance standalone + stay payment schedules
  const allPayments = [...payments];
  Object.keys(stays).forEach(id => {
    const sd = stays[id];
    const enq = enquiries.find(e=>String(e.id)===String(id));
    (sd.paymentSchedule || []).forEach(p => {
      allPayments.push({
        ...p,
        guestId: id,
        guestName: enq ? enq.name : id,
        villa: sd.villa || '',
        isSchedule: true,
      });
    });
  });

  // Filter for display month
  const monthPayments = allPayments.filter(p => {
    const d = new Date(p.dueDate||p.paidDate||'');
    return !isNaN(d) && d.getMonth()===fMonth && d.getFullYear()===fYear;
  });

  // KPIs
  let totalRec = 0, totalOut = 0, ccFees = 0, overdueCount = 0;
  allPayments.forEach(p => {
    const usd = toUSD(p.amount, p.currency);
    if (p.status==='paid') totalRec += usd;
    else if (p.status==='pending'||p.status==='overdue') totalOut += usd;
    if (p.status==='overdue') overdueCount++;
    if (p.status==='paid' && p.method==='cc' && p.ccFee) ccFees += usd * parseFloat(p.ccFee) / 100;
  });

  const kEl = document.getElementById('finance-kpis');
  if (kEl) kEl.innerHTML = `
    <div class="kpi-card"><div class="kpi-value">${fmtCurrency(totalRec)}</div><div class="kpi-label">Total Received (All Time)</div></div>
    <div class="kpi-card" style="border-top-color:var(--warning)"><div class="kpi-value">${fmtCurrency(totalOut)}</div><div class="kpi-label">Outstanding (All)</div></div>
    <div class="kpi-card" style="border-top-color:var(--danger)"><div class="kpi-value">${fmtCurrency(ccFees)}</div><div class="kpi-label">CC Fees (All Time)</div></div>
    <div class="kpi-card" style="border-top-color:#7b68c8"><div class="kpi-value">${overdueCount}</div><div class="kpi-label">Overdue Invoices</div></div>`;

  // Payment summary row stats
  const mRec = monthPayments.filter(p=>p.status==='paid').reduce((s,p)=>s+toUSD(p.amount,p.currency),0);
  const mOut = monthPayments.filter(p=>p.status!=='paid').reduce((s,p)=>s+toUSD(p.amount,p.currency),0);
  const mCC  = monthPayments.filter(p=>p.status==='paid'&&p.method==='cc'&&p.ccFee).reduce((s,p)=>s+toUSD(p.amount,p.currency)*parseFloat(p.ccFee)/100,0);
  const mOvd = monthPayments.filter(p=>p.status==='overdue').length;
  const fR=document.getElementById('fin-total-received'), fO=document.getElementById('fin-total-outstanding');
  const fC=document.getElementById('fin-cc-fees'), fV=document.getElementById('fin-overdue-count');
  if(fR)fR.textContent=fmtCurrency(mRec);
  if(fO)fO.textContent=fmtCurrency(mOut);
  if(fC)fC.textContent=fmtCurrency(mCC);
  if(fV)fV.textContent=mOvd;

  // Payment table
  const ptEl = document.getElementById('payment-table');
  if (ptEl) {
    if (!monthPayments.length) {
      ptEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No payments in this period. Add payments via the Stay modal payment schedule, or use "+ Add Payment" for standalone records.</div>';
    } else {
      ptEl.innerHTML = `<table class="finance-table"><thead><tr>
        <th>Guest</th><th>Villa</th><th>Type</th><th>Amount</th><th>Method</th><th>Due</th><th>Status</th><th>Wave #</th><th></th>
      </tr></thead><tbody>
        ${monthPayments.map((p,i)=>{
          const usd = toUSD(p.amount, p.currency);
          const sBadge = p.status==='paid'?'badge-paid':p.status==='overdue'?'badge-overdue':'badge-unpaid';
          return `<tr>
            <td>${p.guestName||p.guestId||'—'}</td>
            <td>${p.villa||'—'}</td>
            <td>${p.type||'—'}</td>
            <td><strong>${fmtCurrency(usd)}</strong>${p.ccFee?`<div style="font-size:9px;color:var(--text-muted)">+${p.ccFee}% fee</div>`:''}</td>
            <td>${p.method||'—'}</td>
            <td>${p.dueDate||'—'}</td>
            <td><span class="status-badge ${sBadge}">${p.status||'—'}</span></td>
            <td>${p.waveRef||'—'}</td>
            <td>${!p.isSchedule?`<button class="btn btn-ghost btn-sm" onclick="openEditPayment(${i})">Edit</button>`:'<span style="font-size:9px;color:var(--text-muted)">Stay</span>'}</td>
          </tr>`;
        }).join('')}
      </tbody></table>`;
    }
  }

  // Expenses table
  const exEl = document.getElementById('expense-table');
  if (exEl) {
    const monthExp = expenses.filter(ex => {
      const d = new Date(ex.date||'');
      return !isNaN(d) && d.getMonth()===fMonth && d.getFullYear()===fYear;
    });
    if (!monthExp.length) {
      exEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No expenses in this period.</div>';
    } else {
      exEl.innerHTML = `<table class="finance-table"><thead><tr>
        <th>Vendor</th><th>Category</th><th>Amount</th><th>Date</th><th>Sector</th><th>Wave #</th><th>Description</th><th></th>
      </tr></thead><tbody>
        ${monthExp.map((ex,i)=>`<tr>
          <td>${ex.vendor||'—'}</td>
          <td>${ex.category||'—'}</td>
          <td><strong>${fmtCurrency(toUSD(ex.amount,ex.currency))}</strong></td>
          <td>${ex.date||'—'}</td>
          <td>${ex.sector||'—'}</td>
          <td>${ex.waveRef||'—'}</td>
          <td>${ex.description||'—'}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="openEditExpense(${i})">Edit</button></td>
        </tr>`).join('')}
      </tbody></table>`;
    }
  }

  // Sector report
  const sectors = {};
  Object.keys(stays).forEach(id=>{
    const sd=stays[id], enq=enquiries.find(e=>String(e.id)===String(id));
    if (!sd.sector) return;
    if (!sectors[sd.sector]) sectors[sd.sector]={rev:0,count:0};
    (sd.paymentSchedule||[]).filter(p=>p.status==='paid').forEach(p=>{sectors[sd.sector].rev+=toUSD(p.amount,p.currency);sectors[sd.sector].count++;});
  });
  const scEl = document.getElementById('sector-report');
  if (scEl) {
    const keys = Object.keys(sectors);
    if (!keys.length) { scEl.innerHTML='<div style="padding:10px;color:var(--text-muted);font-size:11px">No sector data yet. Assign Business Sector in Stay Details.</div>'; }
    else scEl.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">'+keys.map(k=>`<div class="sector-card"><div class="sector-name">${k}</div><div class="sector-rev">${fmtCurrency(sectors[k].rev)}</div><div class="sector-sub">${sectors[k].count} payments</div></div>`).join('')+'</div>';
  }

  // Villa report
  const villas = {};
  Object.keys(stays).forEach(id=>{
    const sd=stays[id];
    if (!sd.villa) return;
    if (!villas[sd.villa]) villas[sd.villa]={rev:0,count:0,loc:sd.villaLoc||''};
    (sd.paymentSchedule||[]).filter(p=>p.status==='paid').forEach(p=>{villas[sd.villa].rev+=toUSD(p.amount,p.currency);villas[sd.villa].count++;});
  });
  const vlEl = document.getElementById('villa-report');
  if (vlEl) {
    const vkeys = Object.keys(villas);
    if (!vkeys.length) { vlEl.innerHTML='<div style="padding:10px;color:var(--text-muted);font-size:11px">No villa revenue data yet.</div>'; }
    else vlEl.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">'+vkeys.map(k=>`<div class="sector-card"><div class="sector-name">🏡 ${k}</div><div class="sector-rev">${fmtCurrency(villas[k].rev)}</div><div class="sector-sub">${villas[k].loc} · ${villas[k].count} payments</div></div>`).join('')+'</div>';
  }

  // Wave prompts
  const wEl = document.getElementById('wave-prompts');
  if (wEl) {
    const payList = monthPayments.filter(p=>p.status==='paid');
    const expList = expenses.filter(ex=>{ const d=new Date(ex.date||''); return !isNaN(d)&&d.getMonth()===fMonth&&d.getFullYear()===fYear; });
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const mn = months[fMonth]+' '+fYear;
    const payText = payList.map(p=>`- ${p.guestName||'Guest'} | ${p.type} | ${p.currency} ${p.amount} | ${p.paidDate||p.dueDate} | ${p.method} | ${p.waveRef||'no ref'}`).join('\n') || 'No paid invoices this month.';
    const expText = expList.map(ex=>`- ${ex.vendor} | ${ex.category} | ${ex.currency} ${ex.amount} | ${ex.date} | ${ex.waveRef||'no ref'} | ${ex.description}`).join('\n') || 'No expenses this month.';
    const prompt1 = `Please log these ${mn} income records in Wave:\n\n${payText}\n\nFor each: create a sales transaction with the guest name as customer and the amount in the correct currency.`;
    const prompt2 = `Please log these ${mn} expense records in Wave:\n\n${expText}\n\nFor each: create an expense transaction with the vendor name and correct category.`;
    wEl.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;color:var(--ocean);margin-bottom:6px">Income Prompt</div>
        <div class="wave-prompt-box">${escHtml(prompt1)}<button class="copy-prompt-btn" onclick="copyText(${JSON.stringify(prompt1)})">Copy</button></div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:var(--ocean);margin-bottom:6px">Expenses Prompt</div>
        <div class="wave-prompt-box">${escHtml(prompt2)}<button class="copy-prompt-btn" onclick="copyText(${JSON.stringify(prompt2)})">Copy</button></div>
      </div>`;
  }
}

function copyWavePrompt(type) {
  renderFinance();
  showNotif('Wave prompt section updated — scroll to bottom of Finance tab ✓');
}

function copyText(txt) {
  navigator.clipboard.writeText(txt).then(()=>showNotif('Copied ✓')).catch(()=>showNotif('Copy failed',true));
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Finance: standalone payment CRUD
function openNewPayment() {
  currentPayId = null;
  document.getElementById('pay-modal-title').textContent = 'Add Payment Record';
  document.getElementById('btn-del-pay').style.display = 'none';
  ['p-amount','p-wave-ref','p-notes','p-cc-fee'].forEach(f=>{const el=document.getElementById(f);if(el)el.value='';});
  document.getElementById('p-due-date').value='';
  document.getElementById('p-paid-date').value='';
  document.getElementById('p-type').value='deposit';
  document.getElementById('p-currency').value='USD';
  document.getElementById('p-method').value='bank';
  document.getElementById('p-status').value='pending';
  // Populate guest select
  const sel = document.getElementById('p-guest-id');
  sel.innerHTML = enquiries.filter(e=>['deposit','fullpay','confirmed','completed'].includes(e.stage))
    .map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  // Also populate e2-booking-id
  const bSel = document.getElementById('e2-booking-id');
  if (bSel) bSel.innerHTML = '<option value="">None</option>' + enquiries.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  openModal('modal-payment');
}

function openEditPayment(i) {
  const filt = getMonthPayments();
  const p = filt[i];
  if (!p || p.isSchedule) return;
  currentPayId = p.id;
  const idx = payments.findIndex(x=>x.id===p.id);
  document.getElementById('pay-modal-title').textContent = 'Edit Payment';
  document.getElementById('btn-del-pay').style.display = 'inline-block';
  document.getElementById('p-amount').value   = p.amount||'';
  document.getElementById('p-type').value     = p.type||'deposit';
  document.getElementById('p-currency').value = p.currency||'USD';
  document.getElementById('p-due-date').value = p.dueDate||'';
  document.getElementById('p-paid-date').value= p.paidDate||'';
  document.getElementById('p-method').value   = p.method||'bank';
  document.getElementById('p-cc-fee').value   = p.ccFee||'';
  document.getElementById('p-status').value   = p.status||'pending';
  document.getElementById('p-wave-ref').value = p.waveRef||'';
  document.getElementById('p-notes').value    = p.notes||'';
  const sel = document.getElementById('p-guest-id');
  sel.innerHTML = enquiries.map(e=>`<option value="${e.id}"${String(e.id)===String(p.guestId)?' selected':''}>${e.name}</option>`).join('');
  openModal('modal-payment');
}

function getMonthPayments() {
  const sel = document.getElementById('finance-month-select');
  let fMonth = new Date().getMonth(), fYear = new Date().getFullYear();
  if (sel && sel.value) { const pts=sel.value.split('-'); fYear=parseInt(pts[0]); fMonth=parseInt(pts[1]); }
  const all = [...payments];
  Object.keys(stays).forEach(id=>{
    const sd=stays[id], enq=enquiries.find(e=>String(e.id)===String(id));
    (sd.paymentSchedule||[]).forEach(p=>all.push({...p,guestId:id,guestName:enq?enq.name:id,villa:sd.villa||'',isSchedule:true}));
  });
  return all.filter(p=>{const d=new Date(p.dueDate||p.paidDate||'');return !isNaN(d)&&d.getMonth()===fMonth&&d.getFullYear()===fYear;});
}

function savePayment() {
  const guestId = document.getElementById('p-guest-id').value;
  const amount  = document.getElementById('p-amount').value;
  if (!guestId||!amount) { showNotif('Guest and amount required ✗',true); return; }
  const enq = enquiries.find(e=>String(e.id)===String(guestId));
  const p = {
    id:       currentPayId || ('pay_'+Date.now()),
    guestId, guestName: enq?enq.name:guestId,
    type:     document.getElementById('p-type').value,
    amount, currency: document.getElementById('p-currency').value,
    dueDate:  document.getElementById('p-due-date').value,
    paidDate: document.getElementById('p-paid-date').value,
    method:   document.getElementById('p-method').value,
    ccFee:    document.getElementById('p-cc-fee').value,
    status:   document.getElementById('p-status').value,
    waveRef:  document.getElementById('p-wave-ref').value,
    notes:    document.getElementById('p-notes').value,
  };
  if (currentPayId) {
    const idx = payments.findIndex(x=>x.id===currentPayId);
    if (idx>=0) payments[idx]=p; else payments.push(p);
  } else {
    payments.push(p);
  }
  localStorage.setItem('tb_payments', JSON.stringify(payments));
  closeModal('modal-payment');
  renderFinance();
  showNotif('Payment saved ✓');
}

function deletePayment() {
  if (!confirm('Delete this payment record?')) return;
  payments = payments.filter(p=>p.id!==currentPayId);
  localStorage.setItem('tb_payments', JSON.stringify(payments));
  closeModal('modal-payment');
  renderFinance();
  showNotif('Deleted');
}

// Finance: expense CRUD
function openNewExpense() {
  currentExpId = null;
  document.getElementById('btn-del-exp').style.display = 'none';
  ['e2-vendor','e2-amount','e2-wave-ref','e2-desc'].forEach(f=>{const el=document.getElementById(f);if(el)el.value='';});
  document.getElementById('e2-date').value='';
  document.getElementById('e2-cat').value='';
  document.getElementById('e2-currency').value='USD';
  document.getElementById('e2-sector').value='';
  const bSel = document.getElementById('e2-booking-id');
  if (bSel) bSel.innerHTML='<option value="">None</option>'+enquiries.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  openModal('modal-expense');
}

function openEditExpense(i) {
  const sel = document.getElementById('finance-month-select');
  let fMonth = new Date().getMonth(), fYear = new Date().getFullYear();
  if (sel && sel.value) { const pts=sel.value.split('-'); fYear=parseInt(pts[0]); fMonth=parseInt(pts[1]); }
  const monthExp = expenses.filter(ex=>{const d=new Date(ex.date||'');return !isNaN(d)&&d.getMonth()===fMonth&&d.getFullYear()===fYear;});
  const ex = monthExp[i];
  if (!ex) return;
  currentExpId = ex.id;
  document.getElementById('btn-del-exp').style.display = 'inline-block';
  document.getElementById('e2-vendor').value  = ex.vendor||'';
  document.getElementById('e2-cat').value     = ex.category||'';
  document.getElementById('e2-amount').value  = ex.amount||'';
  document.getElementById('e2-currency').value= ex.currency||'USD';
  document.getElementById('e2-date').value    = ex.date||'';
  document.getElementById('e2-sector').value  = ex.sector||'';
  document.getElementById('e2-wave-ref').value= ex.waveRef||'';
  document.getElementById('e2-desc').value    = ex.description||'';
  const bSel=document.getElementById('e2-booking-id');
  if(bSel) bSel.innerHTML='<option value="">None</option>'+enquiries.map(e=>`<option value="${e.id}"${String(e.id)===String(ex.bookingId)?' selected':''}>${e.name}</option>`).join('');
  openModal('modal-expense');
}

function saveExpense() {
  const vendor = document.getElementById('e2-vendor').value.trim();
  const amount = document.getElementById('e2-amount').value;
  if (!vendor||!amount) { showNotif('Vendor and amount required ✗',true); return; }
  const ex = {
    id:          currentExpId || ('exp_'+Date.now()),
    vendor, category: document.getElementById('e2-cat').value,
    amount, currency: document.getElementById('e2-currency').value,
    date:        document.getElementById('e2-date').value,
    bookingId:   document.getElementById('e2-booking-id').value,
    sector:      document.getElementById('e2-sector').value,
    waveRef:     document.getElementById('e2-wave-ref').value,
    description: document.getElementById('e2-desc').value,
  };
  if (currentExpId) {
    const idx=expenses.findIndex(x=>x.id===currentExpId);
    if(idx>=0) expenses[idx]=ex; else expenses.push(ex);
  } else { expenses.push(ex); }
  localStorage.setItem('tb_expenses', JSON.stringify(expenses));
  closeModal('modal-expense');
  renderFinance();
  showNotif('Expense saved ✓');
}

function deleteExpense() {
  if (!confirm('Delete this expense?')) return;
  expenses = expenses.filter(x=>x.id!==currentExpId);
  localStorage.setItem('tb_expenses', JSON.stringify(expenses));
  closeModal('modal-expense');
  renderFinance();
  showNotif('Deleted');
}

// ========== EMAILS ==========
const TRG_LABELS = {pre:'PRE-ARRIVAL',post:'POST-STAY',inhouse:'IN-HOUSE',payment:'PAYMENT',followup:'FOLLOW-UP'};
const TRG_CLASS  = {pre:'trg-pre',post:'trg-post',inhouse:'trg-inhouse',payment:'trg-payment',followup:'trg-followup'};

function renderEmails() {
  document.getElementById('email-list').innerHTML = emails.map((em,i)=>`
    <div class="email-item">
      <div class="email-trigger ${TRG_CLASS[em.trigger]}">${TRG_LABELS[em.trigger]}<br><span style="font-size:10px;font-weight:400">${em.days>0?em.days+' days':'Instant'}</span></div>
      <div class="email-info">
        <div class="email-subject">${em.subject}</div>
        <div class="email-preview">${em.body.substring(0,100).replace(/\n/g,' ')}…</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="openEmailEditor(${i})">Edit</button>
        <button class="btn btn-sm" style="background:var(--sand-dark);color:var(--text-muted)" onclick="delEmail(${i})">✕</button>
      </div>
    </div>`).join('');
}

function openEmailEditor(idx) {
  currentEmailIdx = idx;
  if (idx===-1) {
    document.getElementById('e-trigger').value='pre';
    document.getElementById('e-days').value='';
    document.getElementById('e-subject').value='';
    document.getElementById('e-body').value='';
  } else {
    const em = emails[idx];
    document.getElementById('e-trigger').value = em.trigger;
    document.getElementById('e-days').value    = em.days;
    document.getElementById('e-subject').value = em.subject;
    document.getElementById('e-body').value    = em.body;
  }
  openModal('modal-email');
}

function saveEmail() {
  const em = {
    id:      currentEmailIdx===-1 ? Date.now() : emails[currentEmailIdx].id,
    trigger: document.getElementById('e-trigger').value,
    days:    parseInt(document.getElementById('e-days').value)||0,
    subject: document.getElementById('e-subject').value,
    body:    document.getElementById('e-body').value,
  };
  if (currentEmailIdx===-1) emails.push(em); else emails[currentEmailIdx]=em;
  localStorage.setItem('tb_emails', JSON.stringify(emails));
  closeModal('modal-email'); renderEmails();
  showNotif('Template saved ✓');
}

function delEmail(i) {
  if (!confirm('Delete this template?')) return;
  emails.splice(i,1);
  localStorage.setItem('tb_emails', JSON.stringify(emails));
  renderEmails();
}

// ========== REMINDERS ==========
function renderReminders() {
  const now = new Date();
  const upcoming = [];
  enquiries.filter(e=>['deposit','fullpay','confirmed'].includes(e.stage)).forEach(e=>{
    const ci = e.checkin ? new Date(e.checkin) : null;
    const co = e.checkout ? new Date(e.checkout) : null;
    emails.forEach(em=>{
      let fd=null;
      if(em.trigger==='pre'&&ci)     fd=new Date(ci.getTime()-em.days*86400000);
      if(em.trigger==='post'&&co)    fd=new Date(co.getTime()+em.days*86400000);
      if(em.trigger==='inhouse'&&ci) fd=new Date(ci.getTime()+86400000);
      if(em.trigger==='payment'&&ci) fd=new Date(ci.getTime()-em.days*86400000);
      if(fd&&fd>=now) upcoming.push({guest:e.name,email:e.email,subject:em.subject,fd,trigger:em.trigger});
    });
  });
  upcoming.sort((a,b)=>a.fd-b.fd);
  const list=document.getElementById('reminders-list');
  if (!upcoming.length) {
    list.innerHTML=`<div style="padding:30px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark)">No upcoming reminders. Add confirmed guests with check-in dates to see their scheduled emails here.</div>`;
    return;
  }
  list.innerHTML = upcoming.map(r=>{
    const d=Math.ceil((r.fd-now)/86400000);
    const dText=d===0?'Today':d===1?'Tomorrow':`In ${d} days`;
    const col=d<=2?'var(--danger)':d<=7?'var(--warning)':'var(--success)';
    return `<div class="reminder-row">
      <div class="reminder-date">${fmtDateShort(r.fd.toISOString().split('T')[0])}</div>
      <div class="email-trigger ${TRG_CLASS[r.trigger]}" style="min-width:80px;font-size:10px">${TRG_LABELS[r.trigger]}</div>
      <div class="reminder-info">
        <div class="reminder-subject">${r.subject}</div>
        <div class="reminder-guest">To: ${r.guest} &lt;${r.email}&gt;</div>
      </div>
      <div class="reminder-days" style="color:${col}">${dText}</div>
    </div>`;
  }).join('');
}

// ========== ARCHIVE ==========
let adminUnlocked = false;
function getArchiveAdminPassword() {
  if (typeof window !== 'undefined' && window.__CRM_ARCHIVE_ADMIN_PW) return String(window.__CRM_ARCHIVE_ADMIN_PW);
  return '';
}

function unlockAdmin() {
  const pw = document.getElementById('admin-pw').value;
  const expected = getArchiveAdminPassword();
  if (!expected) {
    document.getElementById('admin-status').textContent='⚙️ Archive PIN not configured on server';
    document.getElementById('admin-status').style.color='var(--warning)';
    return;
  }
  if (pw===expected) {
    adminUnlocked=true;
    document.getElementById('admin-status').textContent='🔓 Admin unlocked';
    document.getElementById('admin-status').style.color='var(--success)';
    document.getElementById('admin-pw').style.display='none';
    renderArchive();
  } else {
    document.getElementById('admin-status').textContent='❌ Wrong password';
    document.getElementById('admin-status').style.color='var(--danger)';
  }
}

function renderArchive() {
  const q = (document.getElementById('archive-search')?.value||'').toLowerCase();
  const filter = document.getElementById('archive-filter')?.value||'all';
  let pool = enquiries.filter(e=>['completed','dead'].includes(e.stage));
  if (filter==='completed') pool=pool.filter(e=>e.stage==='completed');
  if (filter==='dead')      pool=pool.filter(e=>e.stage==='dead');
  if (q) pool=pool.filter(e=>e.name.toLowerCase().includes(q)||e.email.toLowerCase().includes(q)||(e.location||'').toLowerCase().includes(q));
  pool.sort((a,b)=>{
    const da=a.completedDate||a.deadDate||a.created||'';
    const db=b.completedDate||b.deadDate||b.created||'';
    return db.localeCompare(da);
  });

  document.getElementById('archive-count').textContent=`${pool.length} record${pool.length!==1?'s':''}`;
  const board=document.getElementById('archive-board');

  if (!pool.length) {
    board.innerHTML=`<div class="archive-empty">No archived guests yet. Completed stays auto-move here after checkout.</div>`;
    return;
  }

  const completed=pool.filter(e=>e.stage==='completed');
  const dead=pool.filter(e=>e.stage==='dead');
  let html='';

  if (completed.length&&filter!=='dead') {
    html+=`<div class="archive-section">
      <div class="archive-section-title">
        <span>🌴 Completed Stays (${completed.length})</span>
        ${adminUnlocked?`<button class="btn btn-danger btn-sm" onclick="deleteAllStage('completed')">Delete All Completed</button>`:''}
      </div>
      <div class="archive-grid">${completed.map(e=>archiveCard(e)).join('')}</div>
    </div>`;
  }
  if (dead.length&&filter!=='completed') {
    html+=`<div class="archive-section">
      <div class="archive-section-title">
        <span>💀 Dead Clients (${dead.length})</span>
        ${adminUnlocked?`<button class="btn btn-danger btn-sm" onclick="deleteAllStage('dead')">Delete All Dead</button>`:''}
      </div>
      <div class="archive-grid">${dead.map(e=>archiveCard(e)).join('')}</div>
    </div>`;
  }
  board.innerHTML = html;
}

function archiveCard(e) {
  const sd = stays[e.id]||{};
  const isCompleted = e.stage==='completed';
  const archDate = e.completedDate||e.deadDate||e.created||'';
  const copyText = buildCopyText(e, sd);
  return `<div class="archive-card ${isCompleted?'completed-card':'dead-card'}">
    <div class="card-name" style="padding-right:50px">${e.name}</div>
    <div style="font-size:11px;color:var(--text-muted)">✉️ ${e.email}${e.phone?` · 📱 ${e.phone}`:''}</div>
    <div class="card-tags" style="margin:5px 0">
      ${e.location?`<span class="tag tag-loc">📍 ${e.location}</span>`:''}
      ${e.bedrooms?`<span class="tag tag-bed">🛏 ${e.bedrooms}BR</span>`:''}
      ${e.guests?`<span class="tag tag-budget">👥 ${e.guests}</span>`:''}
      ${e.budget?`<span class="tag tag-budget">💵 ${e.budget}</span>`:''}
    </div>
    ${e.checkin?`<div style="font-size:11px;color:var(--text-muted)">📅 ${e.checkin}${e.checkout?' → '+e.checkout:''}</div>`:''}
    ${isCompleted&&sd.villa?`<div style="font-size:11px;color:var(--text-muted)">🏡 ${sd.villa}</div>`:''}
    ${e.teamNotes?`<div style="font-size:11px;color:#856404;font-style:italic;margin-top:3px;background:#fff3cd;padding:4px 6px;border-radius:4px">${e.teamNotes.substring(0,80)}${e.teamNotes.length>80?'…':''}</div>`:''}
    ${e.notes?`<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:3px">"${e.notes.substring(0,60)}${e.notes.length>60?'…':''}"</div>`:''}
    <div class="archive-meta">${isCompleted?'✅ Completed':'💀 Lost'} · ${archDate?fmtDate(archDate):'—'}</div>
    <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
      <button class="copy-btn" onclick="copyToClipboard(${e.id})">📋 Copy Info</button>
      <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="restoreArchive(${e.id})">↩️ Restore</button>
      ${adminUnlocked?`<button class="admin-delete-btn" onclick="deleteArchive(${e.id})">🗑️ Delete</button>`:`<span style="font-size:10px;color:var(--text-muted)">🔒 Admin to delete</span>`}
    </div>
    <textarea id="copy-${e.id}" style="position:absolute;left:-9999px;opacity:0">${copyText}</textarea>
  </div>`;
}

function buildCopyText(e, sd) {
  let txt = `=== TOTAL BALI GUEST RECORD ===\n`;
  txt += `Name: ${e.name}\nEmail: ${e.email}\nPhone: ${e.phone||'—'}\nCountry: ${e.country||'—'}\n`;
  txt += `\n--- BOOKING ---\nLocation: ${e.location||'—'} · Bedrooms: ${e.bedrooms||'—'} · Guests: ${e.guests||'—'}\n`;
  txt += `Budget/night: ${e.budget||'—'}\nCheck-in: ${e.checkin||'—'}\nCheck-out: ${e.checkout||'—'}\n`;
  if (sd.villa) txt += `\n--- VILLA ---\n${sd.villa}, ${sd.villaLoc||''}\nAddress: ${sd.villaAddr||'—'}\nVilla Manager: ${sd.vmName||'—'} ${sd.vmPhone||''}\n`;
  if (sd.meals||sd.tours||sd.services) {
    txt += `\n--- SERVICES ---\n`;
    if (sd.meals)    txt += `Meals/Chef: ${sd.meals}\n`;
    if (sd.tours)    txt += `Tours: ${sd.tours}\n`;
    if (sd.services) txt += `In-villa services: ${sd.services}\n`;
    if (sd.special)  txt += `Special: ${sd.special}\n`;
  }
  if (e.teamNotes) txt += `\n--- TEAM NOTES ---\n${e.teamNotes}\n`;
  if (e.notes) txt += `\n--- GUEST NOTES ---\n${e.notes}\n`;
  txt += `\nStage: ${STAGE_LABELS[e.stage]||e.stage} | Added: ${e.created||'—'} | Archived: ${e.completedDate||e.deadDate||'—'}`;
  return txt;
}

function copyToClipboard(id) {
  const el = document.getElementById('copy-'+id);
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(()=>showNotif('Guest info copied ✓')).catch(()=>{
    el.style.position='static'; el.style.opacity='1';
    el.select(); document.execCommand('copy');
    el.style.position='absolute'; el.style.opacity='0';
    showNotif('Copied ✓');
  });
}

async function deleteArchive(id) {
  if (!adminUnlocked){showNotif('Unlock admin first ✗',true);return;}
  const e=enquiries.find(x=>x.id===id);
  if (!confirm(`Permanently delete "${e.name}"? This CANNOT be undone.`)) return;
  const resp=await apiRequest('deleteArchive',{id});
  if(resp&&resp.success){
    enquiries=enquiries.filter(x=>x.id!==id);
    delete stays[id];
    renderArchive(); updateBadges();
    showNotif('Record permanently deleted');
  }
}

async function deleteAllStage(stage) {
  if (!adminUnlocked){showNotif('Unlock admin first ✗',true);return;}
  const count=enquiries.filter(e=>e.stage===stage).length;
  if (!confirm(`Permanently delete ALL ${count} ${STAGE_LABELS[stage]} records? CANNOT be undone.`)) return;
  const resp=await apiRequest('deleteAllStage',{stage});
  if(resp&&resp.success){
    enquiries=enquiries.filter(e=>e.stage!==stage);
    renderArchive(); updateBadges();
    showNotif(`${count} records deleted`);
  }
}

async function restoreArchive(id) {
  const resp=await apiRequest('restoreArchive',{id});
  if(resp&&resp.success){
    const idx=enquiries.findIndex(e=>e.id===id);
    enquiries[idx].stage='new';
    delete enquiries[idx].completedDate;
    delete enquiries[idx].deadDate;
    renderArchive(); renderPipeline(); updateBadges();
    showNotif('Restored to New Enquiry ✓');
  }
}

// ========== HELPERS ==========
function selStage(s) { selectedStage=s; updateStageUI(); }
function updateStageUI() {
  document.querySelectorAll('.stage-btn').forEach(b=>{
    b.className='stage-btn';
    if (b.dataset.stage===selectedStage) b.className='stage-btn active-'+selectedStage;
  });
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) { if(!d)return'—'; return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}); }
function fmtDateShort(d) { if(!d)return'—'; return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short'}); }
function showNotif(msg, err) {
  const n=document.getElementById('notif');
  n.textContent=msg; n.style.background=err?'var(--danger)':'var(--ocean)';
  n.classList.add('show'); setTimeout(()=>n.classList.remove('show'),3000);
}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

// ========== SAMPLE DATA ==========
function loadSample() {
  if (enquiries.length>0) return;
  const d=off=>{const dt=new Date();dt.setDate(dt.getDate()+off);return dt.toISOString().split('T')[0];};
  enquiries=[
    {id:1,name:'Sarah & James Thompson',email:'sarah.t@gmail.com',phone:'+61 412 555 123',country:'Australia',location:'Seminyak',bedrooms:'5',guests:'10',budget:'$400–600',checkin:d(45),checkout:d(52),notes:'Birthday for Sarah turning 40. Flowers & cake on arrival.',teamNotes:'Offered Villa Kalis and Villa Sol. Client prefers Kalis.',stage:'confirmed',created:d(-10)},
    {id:2,name:'Mike Chen',email:'mchen@outlook.com',phone:'+65 9123 4567',country:'Singapore',location:'Canggu',bedrooms:'3',guests:'6',budget:'$200–300',checkin:d(12),checkout:d(17),notes:'Surf trip with friends. Early check-in requested.',teamNotes:'',stage:'deposit',created:d(-5)},
    {id:3,name:'The Williams Family',email:'cwilliams@yahoo.com',phone:'+44 7911 123456',country:'UK',location:'Ubud',bedrooms:'4',guests:'8',budget:'$300–400',checkin:d(90),checkout:d(100),notes:'Multi-generational family. Grandparents need ground floor.',teamNotes:'Slow to respond — follow up Tuesday.',stage:'followup1',created:d(-2)},
    {id:4,name:'Emma Rossi',email:'emma.rossi@gmail.com',phone:'',country:'Italy',location:'Seminyak',bedrooms:'7',guests:'14',budget:'$500+',checkin:d(60),checkout:d(67),notes:'Hen party. Pool essential. DJ setup?',teamNotes:'',stage:'new',created:d(-1)},
    {id:5,name:'David Park',email:'dpark@naver.com',phone:'+82 10 1234 5678',country:'South Korea',location:'Uluwatu',bedrooms:'2',guests:'4',budget:'$150–250',checkin:d(30),checkout:d(35),notes:'Honeymoon couple.',teamNotes:'',stage:'fullpay',created:d(-15)},
    {id:6,name:'Lars & Anna Johansson',email:'lars.j@hotmail.com',phone:'+46 70 123 4567',country:'Sweden',location:'Canggu',bedrooms:'3',guests:'5',budget:'$200–350',checkin:d(55),checkout:d(62),notes:'Anniversary trip. Surprise dinner.',teamNotes:'',stage:'followup2',created:d(-8)},
  ];
  stays[1]={villa:'Villa Kalis',villaLoc:'Seminyak',villaAddr:'Jl. Kayu Aya No. 88',vmName:'Wayan',vmPhone:'+62 812 3456 789',sector:'Villa Rental — Seminyak',flightIn:'QF41',flightInTime:'',flightInFrom:'Sydney',flightOut:'QF42',flightOutTime:'',flightOutTo:'Sydney',meals:'Private chef Wed',tours:'Lembongan Fri',services:'Cake & flowers on arrival',special:'Birthday banner poolside',bod:'',commission:'',notes:'Key with security gate.',transferSlots:[{type:'Airport Pickup',date:d(45),time:'14:00',pax:'10',pickup:'Ngurah Rai Airport',dropoff:'Villa Kalis',details:'2x MPV',notes:''}],paymentSchedule:[{id:'p1',type:'deposit',amount:'2000',currency:'USD',dueDate:d(-10),status:'paid',method:'bank',ccFee:'',waveRef:'INV-001',paidDate:d(-10)},{id:'p2',type:'balance',amount:'3200',currency:'USD',dueDate:d(24),status:'pending',method:'bank',ccFee:'',waveRef:'INV-002',paidDate:''}]};
  stays[2]={villa:'Villa Surf',villaLoc:'Canggu',villaAddr:'Jl. Batu Bolong No. 5',vmName:'Made',vmPhone:'+62 819 2345',sector:'Villa Rental — Canggu',flightIn:'',flightInTime:'',flightInFrom:'',flightOut:'',flightOutTime:'',flightOutTo:'',meals:'',tours:'',services:'',special:'',bod:'',commission:'',notes:'',transferSlots:[],paymentSchedule:[{id:'p3',type:'deposit',amount:'800',currency:'USD',dueDate:d(-3),status:'paid',method:'cc',ccFee:'2.9',waveRef:'INV-003',paidDate:d(-3)}]};
  stays[5]={villa:'Villa Aramis',villaLoc:'Uluwatu',villaAddr:'Jl. Labuansait No. 12',vmName:'Made',vmPhone:'+62 819 2345 678',sector:'Villa Rental — Uluwatu',flightIn:'',flightInTime:'',flightInFrom:'',flightOut:'',flightOutTime:'',flightOutTo:'',meals:'',tours:'Sunset dinner Fri',services:'Couples massage',special:'Rose petals in room',bod:'',commission:'',notes:'Romantic setup.',transferSlots:[],paymentSchedule:[{id:'p4',type:'full',amount:'1800',currency:'USD',dueDate:d(-15),status:'paid',method:'wise',ccFee:'',waveRef:'INV-004',paidDate:d(-15)}]};
}

// ========== INIT ==========
async function init() {
  emails = JSON.parse(localStorage.getItem('tb_emails')||'null') || defaultEmails();
  payments = JSON.parse(localStorage.getItem('tb_payments')||'[]');
  expenses = JSON.parse(localStorage.getItem('tb_expenses')||'[]');
  populateFinanceMonthSelect();

  const data = await apiRequest('getAll');
  if (data && !data.error && typeof data.backendConfigured !== 'undefined' && data.backendConfigured === false) {
    loadSample();
    autoPromoteCompleted();
    renderPipeline();
    setStaysMonth(0);
    setTransferMonth(0);
    updateBadges();
    showNotif('Sample data — set CRM_APPS_SCRIPT_URL on server to sync', false);
    return;
  }

  const okPayload = data && !data.error && (Array.isArray(data.enquiries) || data.success === true);
  if (okPayload) {
    enquiries  = [...(data.enquiries||[]), ...(data.archived||[])];
    stays      = data.stays || {};
    activities = data.activities || [];
    autoPromoteCompleted();
    renderPipeline();
    setStaysMonth(0);
    setTransferMonth(0);
    updateBadges();
    saveLocalBackup();
    showNotif('Data Synced ✓', false);
  } else {
    loadSample();
    autoPromoteCompleted();
    renderPipeline();
    setStaysMonth(0);
    setTransferMonth(0);
    updateBadges();
  }
}

init();
