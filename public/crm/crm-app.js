let enquiries = [];
let stays = {};
let activities = [];
let emails = [];
let currentEnqId = null, currentStayId = null, currentEmailIdx = null, currentActId = null;
let selectedStage = 'new';
let groupBy = 'bedrooms', stageFilter = 'all';
let staysMonth = new Date().getMonth(), staysYear = new Date().getFullYear();

function defaultEmails() {
  return [
    { id:1, trigger:'pre', days:30, subject:'🌴 30 Days Until Your Bali Holiday!',
      body:`Hi {name},\n\nWe're SO excited for you — just 30 days until Bali! Here's what to organise now:\n\n✅ Confirm flights & check passport (6+ months validity needed)\n✅ Arrange travel insurance\n✅ Book any activities — we can help!\n\nOur most popular add-ons for groups:\n🚤 Lembongan snorkelling day trip\n🧘 In-villa yoga at sunrise\n🎂 Celebration cake & flowers on arrival\n🍽️ Private chef dinner\n\nJust reply and we'll sort everything.\n\nSee you in paradise!\nThe Total Bali Team 🌺` },
    { id:2, trigger:'pre', days:14, subject:'📋 2 Weeks to Go — Your Villa Details Inside',
      body:`Hi {name},\n\nOnly 2 weeks away! Here are your confirmed details:\n\n🏡 Villa: {villa}\n📍 Location: {location}\n📅 Check-in: {checkin} from 2:00 PM\n📅 Check-out: {checkout} by 11:00 AM\n\nIf you have any outstanding balance, please arrange payment before arrival.\n\nWe'll send your full arrival pack — including the villa address and manager contact — closer to your date.\n\nThe Total Bali Team 🌴` },
    { id:3, trigger:'pre', days:7, subject:"📦 One Week Away — Everything You Need",
      body:`Hi {name},\n\n7 days! Here's your complete arrival pack:\n\n🏡 YOUR VILLA: {villa}\n📍 Address: (see attachment)\n✈️ Your airport transfer is confirmed — driver meets you in arrivals\n\n📱 KEY CONTACTS\nVilla Manager: (details to follow)\nTotal Bali 24/7: +62 813 3864 8034\n\n💡 BALI ARRIVAL TIPS\n• Visa on arrival = USD $35 per person\n• Download the Grab app for local taxis\n• Bring some cash (USD/AUD) for first day\n\nCan't wait to see you!\nThe Total Bali Team 🌺` },
    { id:4, trigger:'pre', days:1, subject:'🌅 Tomorrow Is The Day! Final Bali Reminders',
      body:`Hi {name},\n\nTomorrow is the BIG day! 🎉\n\nYour driver will meet you at Ngurah Rai Airport (DPS). Their number is saved in your arrival pack.\n\nIf your flight is delayed or anything comes up, call us anytime:\n📱 +62 813 3864 8034\n\nGet ready — Bali is waiting for you!\n\nSee you on the island 🌴\nThe Total Bali Team` },
    { id:5, trigger:'inhouse', days:1, subject:'☀️ How\'s Your Stay Going, {name}?',
      body:`Hi {name},\n\nWe hope you've settled into {villa} and you're already loving every moment!\n\nJust checking in to make sure everything is perfect. If anything at all isn't quite right — please tell us now so we can fix it immediately. That's what we're here for.\n\nAlso, if you'd like to add any activities, in-villa dining, spa treatments, or anything else during your stay, just reply or WhatsApp us on +62 813 3864 8034 — we can usually arrange same-day!\n\nEnjoy every second 🌺\nThe Total Bali Team` },
    { id:6, trigger:'post', days:2, subject:'💛 How Was Your Stay? We\'d Love Your Feedback',
      body:`Hi {name},\n\nWe hope you made it home safely and you're still riding those good Bali vibes! ✨\n\nWe'd love to hear how your stay at {villa} was. And if you have a moment, a Google review means the world to a small team like ours:\n\n⭐ Leave us a Google Review: [https://g.page/totalbali/review]\n\nAlso — when are you coming back? 😊 Returning guests get priority availability and our best rates. Just hit reply and we'll take care of everything.\n\nThank you for choosing Total Bali.\n\nWith love from Bali 🌴\nThe Total Bali Team` },
    { id:7, trigger:'payment', days:21, subject:'💳 Balance Payment Reminder — {villa}',
      body:`Hi {name},\n\nJust a friendly reminder that your balance of USD ${'{balance}'} is due 21 days before your arrival.\n\nBooking: {villa}\nCheck-in: {checkin}\nCheck-out: {checkout}\n\nPlease arrange your bank transfer at your earliest convenience. Once received we'll send your confirmation and full arrival details.\n\nAny questions — we're always here!\nThe Total Bali Team\n+62 813 3864 8034` },
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


async function loadData() {
  emails = defaultEmails();
  const data = await apiRequest('getAll');
  if (data) {
    enquiries = [...data.enquiries, ...data.archived];
    stays = data.stays || {};
    activities = data.activities || [];
    autoPromoteCompleted();
    renderPipeline();
    updateBadges();
    showNotif('Data Synced ✓', false);
  }
}

// Keep a local backup in case of network issues
function saveLocalBackup() {
  localStorage.setItem('tb_backup_enq', JSON.stringify(enquiries));
  localStorage.setItem('tb_backup_stays', JSON.stringify(stays));
  localStorage.setItem('tb_backup_act', JSON.stringify(activities));
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
  const conf = enquiries.filter(e=>e.stage==='confirmed').length;
  document.getElementById('badge-stays').textContent = conf;
  const arch = enquiries.filter(e=>['completed','dead'].includes(e.stage)).length;
  document.getElementById('badge-archive').textContent = arch;
}

// Auto-promote confirmed stays whose checkout has passed to Completed
function autoPromoteCompleted() {
  const now = new Date();
  let changed = false;
  enquiries.forEach(e => {
    if(e.stage === 'confirmed' && e.checkout) {
      const co = new Date(e.checkout);
      if(now > co) { e.stage = 'completed'; e.completedDate = today(); changed = true; }
    }
  });
  if(changed) {
    saveLocalBackup();
    // Sync auto-promotions to the backend
    enquiries.forEach(e => {
      if(e.stage === 'completed' && e.completedDate) {
        apiRequest('moveStage', { id: e.id, stage: 'completed' });
      }
    });
  }
}

// ========== PIPELINE ==========
const STAGE_KEYS = ['new','villas','followup1','followup2','hold','invoice','confirmed','completed','dead'];
const STAGE_LABELS = {new:'New Enquiry',villas:'Needs Villas',followup1:'1st Follow Up',followup2:'2nd Follow Up',hold:'Villa on Hold',invoice:'Invoice Sent',confirmed:'Confirmed',completed:'Completed',dead:'Dead Client'};
const STAGE_COLORS = {new:'#4a8fa8',villas:'#7b68c8',followup1:'#e67e22',followup2:'#c0572b',hold:'#8b6914',invoice:'#2a7a5a',confirmed:'#27ae60',completed:'#1a3a4a',dead:'#5a5a5a'};

function renderPipeline() {
  STAGE_KEYS.forEach(s => {
    document.getElementById('col-'+s).innerHTML = '';
    document.getElementById('cnt-'+s).textContent = 0;
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
      <div class="card-name">${e.name}${urgent?'<span class="badge-dot"></span>':''}</div>
      <div class="card-detail">✉️ ${e.email}</div>
      ${e.phone?`<div class="card-detail">📱 ${e.phone}</div>`:''}
      <div class="card-tags">
        ${e.location?`<span class="tag tag-loc">📍 ${e.location}</span>`:''}
        ${e.bedrooms?`<span class="tag tag-bed">🛏 ${e.bedrooms}BR</span>`:''}
        ${e.budget?`<span class="tag tag-budget">💵 ${e.budget}</span>`:''}
        ${urgent?`<span class="tag tag-urgent">⚡ ${du}d away</span>`:''}
        ${ci&&!urgent?`<span class="tag tag-arrive">📅 ${e.checkin}</span>`:''}
      </div>
      <div class="card-foot">Added ${fmtDate(e.created)}</div>
    </div>`;
  });
  // Stats
  document.getElementById('st-total').textContent = enquiries.length;
  document.getElementById('st-active').textContent = enquiries.filter(e=>['new','villas','followup1','followup2'].includes(e.stage)).length;
  document.getElementById('st-hold').textContent = enquiries.filter(e=>e.stage==='hold').length;
  document.getElementById('st-confirmed').textContent = enquiries.filter(e=>e.stage==='confirmed').length;
  document.getElementById('st-arriving').textContent = arriving;
  updateBadges();
}

// ========== SMART MATCH / GROUPING ==========
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
    else key = `${e.bedrooms||'?'}BR — ${e.location||'Flexible'}`;
    if(!groups[key]) groups[key]=[];
    groups[key].push(e);
  });

  const board = document.getElementById('grouping-board');
  if(Object.keys(groups).length === 0) {
    board.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark)">No live enquiries match your filter. Try "All Live" or add new enquiries.</div>`;
    return;
  }

  // Sort keys: bedrooms numerically
  const sortedKeys = Object.keys(groups).sort((a,b) => {
    const na = parseInt(a), nb = parseInt(b);
    if(!isNaN(na) && !isNaN(nb)) return na-nb;
    return a.localeCompare(b);
  });

  board.innerHTML = sortedKeys.map(key => {
    const grp = groups[key];
    const hasMultiple = grp.length > 1;
    const cards = grp.map(e => {
      const ci = e.checkin ? new Date(e.checkin) : null;
      const du = ci ? Math.ceil((ci-new Date())/86400000) : null;
      return `<div class="card${hasMultiple?' highlighted':''}" onclick="openDetail(${e.id})">
        ${hasMultiple?`<div class="match-banner show">🔗 ${grp.length} enquiries — same ${groupBy === 'bedrooms' ? 'bedroom size' : groupBy === 'location' ? 'location' : 'match'}</div>`:''}
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
        ${e.notes?`<div class="card-detail" style="margin-top:4px;font-style:italic">"${e.notes.substring(0,60)}${e.notes.length>60?'…':''}"</div>`:''}
      </div>`;
    }).join('');

    return `<div class="group-section">
      <div class="group-label">
        <span>${groupBy==='bedrooms'?'🛏':groupBy==='location'?'📍':'🔀'} ${key}</span>
        <span class="group-count">${grp.length} enquir${grp.length===1?'y':'ies'}${hasMultiple?' — MATCH OPPORTUNITY ⚡':''}</span>
      </div>
      <div class="group-grid">${cards}</div>
    </div>`;
  }).join('');
}

// ========== CONFIRMED STAYS ==========
function changeMonth(d) {
  staysMonth += d;
  if(staysMonth > 11) { staysMonth=0; staysYear++; }
  if(staysMonth < 0) { staysMonth=11; staysYear--; }
  renderStays();
}
function setStaysMonth(offset) {
  const now = new Date();
  staysMonth = now.getMonth()+offset;
  staysYear = now.getFullYear();
  if(staysMonth > 11) { staysMonth -= 12; staysYear++; }
  renderStays();
}

function renderStays() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('month-label').textContent = `${months[staysMonth]} ${staysYear}`;

  // Regular confirmed stays
  const confirmed = enquiries.filter(e => e.stage==='confirmed' && e.checkin).sort((a,b) => new Date(a.checkin)-new Date(b.checkin));
  const inWindow = confirmed.filter(e => {
    const ci = new Date(e.checkin);
    return ci.getMonth()===staysMonth && ci.getFullYear()===staysYear;
  });

  // Activity-only bookings
  const actInWindow = activities.filter(a => {
    const ad = new Date(a.date);
    return ad.getMonth()===staysMonth && ad.getFullYear()===staysYear;
  });

  const board = document.getElementById('stays-board');
  if(inWindow.length===0 && actInWindow.length===0) {
    board.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark);margin-top:4px">No confirmed stays or activities in ${months[staysMonth]} ${staysYear}.</div>`;
    return;
  }

  const now = new Date();

  // Build combined rows sorted by date
  const stayRows = inWindow.map(e => ({ type:'stay', date: new Date(e.checkin), data: e }));
  const actRows = actInWindow.map(a => ({ type:'activity', date: new Date(a.date), data: a }));
  const allRows = [...stayRows, ...actRows].sort((a,b) => a.date - b.date);

  board.innerHTML = allRows.map(row => {
    if(row.type === 'activity') {
      const a = row.data;
      const ad = new Date(a.date);
      const du = Math.ceil((ad - now) / 86400000);
      let chipClass='chip-far', chipText=`${du}d away`;
      if(du < 0) { chipClass='chip-past'; chipText='Done'; }
      else if(du === 0) { chipClass='chip-today'; chipText='TODAY'; }
      else if(du <= 3) { chipClass='chip-soon'; chipText=`${du}d away`; }
      else if(du <= 14) { chipClass='chip-near'; chipText=`${du}d away`; }
      return `<div class="stay-row activity-row" style="cursor:pointer" onclick="openActivityDetail(${a.id})">
        <div>
          <div class="stay-date">${fmtDateShort(a.date)}</div>
          <div class="stay-date-sub">${a.time||'Time TBC'}</div>
        </div>
        <div><div class="stay-date-sub" style="color:var(--text-muted);font-style:italic">Activity only</div></div>
        <div>
          <div class="activity-badge">ACTIVITY</div>
          <div class="stay-villa" style="font-size:12px">${a.guestName}</div>
          <div class="stay-villa-sub">✉️ ${a.email||'—'}</div>
          ${a.guests?`<div class="stay-villa-sub">👥 ${a.guests} guests</div>`:''}
        </div>
        <div>
          <div class="stay-villa" style="color:#7b68c8">🎯 ${a.activityType}</div>
          ${a.details?`<div class="stay-villa-sub">${a.details}</div>`:''}
          ${a.pickup?`<div class="stay-villa-sub">🚗 Pickup: ${a.pickup}</div>`:''}
        </div>
        <div>
          ${a.notes?`<span class="service-tag">📝 ${a.notes.substring(0,40)}</span>`:'<span style="font-size:11px;color:var(--text-muted)">—</span>'}
        </div>
        <div>${a.price?`<div style="font-weight:600;color:var(--success)">$${a.price}</div>`:`<div style="color:var(--text-muted);font-size:12px">—</div>`}</div>
        <div>
          <div class="days-chip ${chipClass}">${chipText}</div>
          <button class="btn btn-sm btn-teak" style="margin-top:6px;width:100%;background:#7b68c8" onclick="event.stopPropagation();openActivityDetail(${a.id})">✏️ Edit</button>
        </div>
      </div>`;
    }

    // Regular stay row
    const e = row.data;
    const sd = stays[e.id] || {};
    const ci = new Date(e.checkin);
    const co = e.checkout ? new Date(e.checkout) : null;
    const daysUntil = Math.ceil((ci-now)/86400000);
    const nights = co ? Math.ceil((co-ci)/86400000) : '?';
    const inHouse = daysUntil <= 0 && (!co || now < co);
    const past = co && now > co;

    // Checkout status
    let coChipClass='', coChipText='';
    if(co) {
      const dco = Math.ceil((co-now)/86400000);
      if(past) { coChipClass='chip-past'; coChipText='Checked out'; }
      else if(dco===0) { coChipClass='chip-today'; coChipText='CHECKS OUT TODAY'; }
      else if(dco<=1) { coChipClass='chip-soon'; coChipText='Tomorrow'; }
      else if(inHouse) { coChipClass='chip-inhouse'; coChipText=`Out in ${dco}d`; }
    }

    let chipClass='chip-far', chipText = `${daysUntil}d away`;
    if(past) { chipClass='chip-past'; chipText='Checked out'; }
    else if(inHouse) { chipClass='chip-inhouse'; chipText='IN HOUSE 🏡'; }
    else if(daysUntil===0) { chipClass='chip-today'; chipText='ARRIVES TODAY'; }
    else if(daysUntil<=3) { chipClass='chip-soon'; chipText=`${daysUntil}d away`; }
    else if(daysUntil<=14) { chipClass='chip-near'; chipText=`${daysUntil}d away`; }

    const svcs = [];
    if(sd.cars) sd.cars.split(',').forEach(s=>svcs.push(`<span class="service-tag car">🚗 ${s.trim()}</span>`));
    if(sd.checkout_car) svcs.push(`<span class="service-tag car">🚗 CO: ${sd.checkout_car}</span>`);
    if(sd.meals) sd.meals.split(',').forEach(s=>svcs.push(`<span class="service-tag meal">🍽️ ${s.trim()}</span>`));
    if(sd.tours) sd.tours.split(',').forEach(s=>svcs.push(`<span class="service-tag tour">🌊 ${s.trim()}</span>`));
    if(sd.services) sd.services.split(',').forEach(s=>svcs.push(`<span class="service-tag">✨ ${s.trim()}</span>`));
    if(sd.special) svcs.push(`<span class="service-tag special">⭐ ${sd.special}</span>`);

    const emailDots = getEmailDots(e, sd);
    const balanceDue = daysUntil > 0 && daysUntil <= 21 && sd.balance;
    const balanceHtml = sd.balance
      ? `<div style="font-weight:600;color:${balanceDue?'var(--danger)':'var(--success)'}">${balanceDue?'⚠️ ':'✅ '}$${sd.balance}</div><div class="stay-date-sub">${balanceDue?'OVERDUE':'Received'}</div>`
      : `<div style="color:var(--text-muted);font-size:12px">Not set</div>`;

    return `<div class="stay-row" style="cursor:pointer" onclick="openStayDetail(${e.id})">
      <div>
        <div class="stay-date">${fmtDateShort(e.checkin)}</div>
        <div class="stay-date-sub">${nights} nights</div>
      </div>
      <div>
        <div class="stay-date" style="font-size:12px">${e.checkout?fmtDateShort(e.checkout):'—'}</div>
        ${coChipText?`<div class="days-chip ${coChipClass}" style="font-size:9px;padding:2px 6px;margin-top:3px">${coChipText}</div>`:''}
        ${sd.checkout_car?`<div class="stay-date-sub">🚗 ${sd.checkout_car}</div>`:''}
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
        <div class="stay-services">${svcs.length?svcs.join(''):'<span style="color:var(--text-muted);font-size:11px">None booked</span>'}</div>
        ${sd.notes?`<div style="font-size:10px;color:var(--text-muted);margin-top:3px">📝 ${sd.notes.substring(0,50)}…</div>`:''}
      </div>
      <div class="stay-emails">${emailDots}</div>
      <div>${balanceHtml}</div>
      <div>
        <div class="days-chip ${chipClass}">${chipText}</div>
        <button class="btn btn-sm btn-teak" style="margin-top:6px;width:100%" onclick="event.stopPropagation();openStayDetail(${e.id})">✏️ Edit</button>
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
    if(em.trigger==='pre'&&ci) fd = new Date(ci.getTime()-em.days*86400000);
    if(em.trigger==='post'&&co) fd = new Date(co.getTime()+em.days*86400000);
    if(em.trigger==='inhouse'&&ci) fd = new Date(ci.getTime()+86400000);
    if(em.trigger==='payment'&&ci) fd = new Date(ci.getTime()-em.days*86400000);
    if(!fd) return;
    const sent = fd < now;
    const dueToday = !sent && Math.ceil((fd-now)/86400000)<=1;
    rows.push(`<div class="email-dot ${sent?'dot-sent':dueToday?'dot-due':'dot-pending'}">
      ${sent?'✅':dueToday?'🔴':'⏳'} <span>${em.subject.substring(0,28)}…</span>
    </div>`);
  });
  return rows.length ? rows.join('') : '<div style="font-size:11px;color:var(--text-muted)">No dates set</div>';
}

// ========== STAY DETAIL ==========
function openStayDetail(id) {
  currentStayId = id;
  const e = enquiries.find(x=>x.id===id);
  const sd = stays[id] || {};
  document.getElementById('stay-modal-title').textContent = `${e.name} — ${fmtDate(e.checkin)}`;
  document.getElementById('s-villa').value = sd.villa||'';
  document.getElementById('s-villa-loc').value = sd.villaLoc||e.location||'';
  document.getElementById('s-villa-addr').value = sd.villaAddr||'';
  document.getElementById('s-vm-name').value = sd.vmName||'';
  document.getElementById('s-vm-phone').value = sd.vmPhone||'';
  document.getElementById('s-balance').value = sd.balance||'';
  document.getElementById('s-balance-paid').value = sd.balancePaid||'No';
  document.getElementById('s-cars').value = sd.cars||'';
  document.getElementById('s-checkout-car').value = sd.checkout_car||'';
  document.getElementById('s-meals').value = sd.meals||'';
  document.getElementById('s-tours').value = sd.tours||'';
  document.getElementById('s-services').value = sd.services||'';
  document.getElementById('s-special').value = sd.special||'';
  document.getElementById('s-notes').value = sd.notes||'';
  openModal('modal-stay');
}

async function saveStayDetails() {
  const data = {
    id: currentStayId,
    villa: document.getElementById('s-villa').value.trim(),
    villaLoc: document.getElementById('s-villa-loc').value.trim(),
    villaAddr: document.getElementById('s-villa-addr').value.trim(),
    vmName: document.getElementById('s-vm-name').value.trim(),
    vmPhone: document.getElementById('s-vm-phone').value.trim(),
    balance: document.getElementById('s-balance').value.trim(),
    balancePaid: document.getElementById('s-balance-paid').value,
    cars: document.getElementById('s-cars').value.trim(),
    checkout_car: document.getElementById('s-checkout-car').value.trim(),
    meals: document.getElementById('s-meals').value.trim(),
    tours: document.getElementById('s-tours').value.trim(),
    services: document.getElementById('s-services').value.trim(),
    special: document.getElementById('s-special').value.trim(),
    notes: document.getElementById('s-notes').value.trim(),
  };
  const resp = await apiRequest('saveStay', data);
  if (resp && resp.success) {
    stays[currentStayId] = data;
    closeModal('modal-stay'); renderStays();
    showNotif('Stay details saved ✓');
  }
}

// ========== ACTIVITIES CRUD ==========
function openNewActivity() {
  currentActId = null;
  document.getElementById('act-modal-title').textContent = 'Add Activity / Service Booking';
  document.getElementById('btn-del-act').style.display = 'none';
  ['a-name','a-email','a-phone','a-details','a-pickup','a-notes'].forEach(f=>document.getElementById(f).value='');
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
  document.getElementById('act-modal-title').textContent = `Edit — ${a.activityType}: ${a.guestName}`;
  document.getElementById('btn-del-act').style.display = 'inline-block';
  document.getElementById('a-name').value = a.guestName||'';
  document.getElementById('a-email').value = a.email||'';
  document.getElementById('a-phone').value = a.phone||'';
  document.getElementById('a-guests').value = a.guests||'';
  document.getElementById('a-type').value = a.activityType||'';
  document.getElementById('a-date').value = a.date||'';
  document.getElementById('a-time').value = a.time||'';
  document.getElementById('a-pickup').value = a.pickup||'';
  document.getElementById('a-price').value = a.price||'';
  document.getElementById('a-details').value = a.details||'';
  document.getElementById('a-supplier').value = a.supplierContact||'';
  document.getElementById('a-notes').value = a.notes||'';
  openModal('modal-activity');
}

async function saveActivity() {
  const name = document.getElementById('a-name').value.trim();
  const atype = document.getElementById('a-type').value;
  const date = document.getElementById('a-date').value;
  if(!name||!atype||!date){showNotif('Name, activity type and date required ✗',true);return;}
  const data = {
    guestName: name,
    email: document.getElementById('a-email').value.trim(),
    phone: document.getElementById('a-phone').value.trim(),
    guests: document.getElementById('a-guests').value,
    activityType: atype,
    date, time: document.getElementById('a-time').value,
    pickup: document.getElementById('a-pickup').value.trim(),
    price: document.getElementById('a-price').value.trim(),
    details: document.getElementById('a-details').value.trim(),
    supplierContact: document.getElementById('a-supplier').value.trim(),
    notes: document.getElementById('a-notes').value.trim(),
  };
  if(currentActId) data.id = currentActId;
  const resp = await apiRequest('saveActivity', data);
  if (resp && resp.success) {
    if(currentActId) {
      const idx = activities.findIndex(a=>a.id===currentActId);
      activities[idx] = {...activities[idx], ...data};
      showNotif('Activity updated ✓');
    } else {
      data.id = resp.id;
      data.dateAdded = today();
      activities.push(data);
      showNotif('Activity added ✓');
    }
    closeModal('modal-activity');
    // Switch to stays tab showing the right month
    const d = new Date(date);
    staysMonth = d.getMonth(); staysYear = d.getFullYear();
    showTab('stays');
  }
}

async function deleteActivity() {
  if(!confirm('Delete this activity booking?')) return;
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
  selectedStage='new'; updateStageUI();
  openModal('modal-enquiry');
}

function openEditEnquiry(id) {
  currentEnqId=id;
  const e=enquiries.find(x=>x.id===id);
  document.getElementById('enq-modal-title').textContent='Edit — '+e.name;
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
  if(!name||!email){showNotif('Name and email required ✗',true);return;}
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
  const resp = await apiRequest('saveEnquiry', data);
  if (resp && resp.success) {
    if(currentEnqId) {
      const idx=enquiries.findIndex(e=>e.id===currentEnqId);
      enquiries[idx]={...enquiries[idx],...data};
      showNotif('Updated ✓');
    } else {
      data.id=resp.id; data.created=today();
      enquiries.unshift(data);
      showNotif('Enquiry added ✓');
    }
    closeModal('modal-enquiry'); renderPipeline(); updateBadges();
  }
}

async function deleteEnquiry() {
  if(!confirm('Delete this enquiry?')) return;
  const resp = await apiRequest('deleteEnquiry', { id: currentEnqId });
  if (resp && resp.success) {
    enquiries=enquiries.filter(e=>e.id!==currentEnqId);
    closeModal('modal-enquiry'); renderPipeline();
    showNotif('Deleted');
  }
}

// ========== DETAIL MODAL ==========
function openDetail(id) {
  const e=enquiries.find(x=>x.id===id);
  if(!e) return;
  const ci=e.checkin?new Date(e.checkin):null;
  const du=ci?Math.ceil((ci-new Date())/86400000):null;
  document.getElementById('detail-name').textContent=e.name;
  document.getElementById('detail-body').innerHTML=`
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
    ${e.notes?`<div class="form-section" style="margin-bottom:14px"><div class="fsec-title">Notes</div><div style="font-size:13px;line-height:1.6">${e.notes}</div></div>`:''}
    <div class="form-section">
      <div class="fsec-title">Move Stage</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${STAGE_KEYS.map(s=>`<button class="btn btn-sm" style="background:${e.stage===s?STAGE_COLORS[s]:'var(--sand-dark)'};color:${e.stage===s?'white':'var(--text)'}" onclick="moveStage(${e.id},'${s}')">${STAGE_LABELS[s]}</button>`).join('')}
      </div>
    </div>
    ${e.stage==='confirmed'?`<div class="form-section" style="margin-bottom:0"><div class="fsec-title">Stay Details</div><button class="btn btn-teak btn-sm" onclick="closeModal('modal-detail');openStayDetail(${e.id})">🏡 Manage Stay Details & Logistics</button></div>`:''}`;
  openModal('modal-detail');
}

async function moveStage(id, stage) {
  const resp = await apiRequest('moveStage', { id, stage });
  if (resp && resp.success) {
    const idx=enquiries.findIndex(e=>e.id===id);
    enquiries[idx].stage=stage;
    if(stage==='completed') enquiries[idx].completedDate = today();
    if(stage==='dead') enquiries[idx].deadDate = today();
    closeModal('modal-detail'); renderPipeline(); updateBadges();
    if(stage==='confirmed') {
      showNotif('Moved to Confirmed — check the Stays tab to add villa & logistics ✓');
      setTimeout(()=>showTab('stays'),1200);
    } else if(stage==='completed'||stage==='dead') {
      showNotif(`Moved to ${STAGE_LABELS[stage]} — find them in the Archive tab ✓`);
    } else {
      showNotif('Stage updated ✓');
    }
  }
}

// ========== GUESTS TABLE ==========
function renderGuests() {
  const q=(document.getElementById('guest-search')?.value||'').toLowerCase();
  const filtered=enquiries.filter(e=>!q||e.name.toLowerCase().includes(q)||e.email.toLowerCase().includes(q)||(e.location||'').toLowerCase().includes(q));
  document.getElementById('guests-tbody').innerHTML=filtered.length===0
    ?'<tr><td colspan="8" style="padding:30px;text-align:center;color:var(--text-muted)">No guests found</td></tr>'
    :filtered.map(e=>`<tr style="border-bottom:1px solid var(--sand);cursor:pointer" onclick="openDetail(${e.id})" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
      <td style="padding:10px 14px"><div style="font-weight:500">${e.name}</div><div style="font-size:11px;color:var(--text-muted)">${e.email}</div></td>
      <td style="padding:10px 14px">${e.location||'—'}</td>
      <td style="padding:10px 14px">${e.bedrooms||'—'}</td>
      <td style="padding:10px 14px">${e.guests||'—'}</td>
      <td style="padding:10px 14px">${e.budget||'—'}</td>
      <td style="padding:10px 14px">${e.checkin||'—'}</td>
      <td style="padding:10px 14px"><span style="background:${STAGE_COLORS[e.stage]};color:white;padding:3px 9px;border-radius:10px;font-size:10px;font-weight:600">${STAGE_LABELS[e.stage]}</span></td>
      <td style="padding:10px 14px"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEditEnquiry(${e.id})">Edit</button></td>
    </tr>`).join('');
}

// ========== EMAILS ==========
const TRG_LABELS={pre:'PRE-ARRIVAL',post:'POST-STAY',inhouse:'IN-HOUSE',payment:'PAYMENT',followup:'FOLLOW-UP'};
const TRG_CLASS={pre:'trg-pre',post:'trg-post',inhouse:'trg-inhouse',payment:'trg-payment',followup:'trg-followup'};

function renderEmails() {
  document.getElementById('email-list').innerHTML=emails.map((em,i)=>`
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
  currentEmailIdx=idx;
  if(idx===-1){
    document.getElementById('e-trigger').value='pre';
    document.getElementById('e-days').value='';
    document.getElementById('e-subject').value='';
    document.getElementById('e-body').value='';
  } else {
    const em=emails[idx];
    document.getElementById('e-trigger').value=em.trigger;
    document.getElementById('e-days').value=em.days;
    document.getElementById('e-subject').value=em.subject;
    document.getElementById('e-body').value=em.body;
  }
  openModal('modal-email');
}

function saveEmail() {
  const em={
    id:currentEmailIdx===-1?Date.now():emails[currentEmailIdx].id,
    trigger:document.getElementById('e-trigger').value,
    days:parseInt(document.getElementById('e-days').value)||0,
    subject:document.getElementById('e-subject').value,
    body:document.getElementById('e-body').value,
  };
  if(currentEmailIdx===-1) emails.push(em); else emails[currentEmailIdx]=em;
  // Emails are mostly local templates, but we could sync them too. 
  // For now, keep them in localStorage as they are "app settings"
  localStorage.setItem('tb_emails', JSON.stringify(emails));
  closeModal('modal-email'); renderEmails();
  showNotif('Template saved ✓');
}

function delEmail(i) {
  if(!confirm('Delete this template?')) return;
  emails.splice(i,1);
  localStorage.setItem('tb_emails', JSON.stringify(emails));
  renderEmails();
}

// ========== REMINDERS ==========
function renderReminders() {
  const now=new Date();
  const upcoming=[];
  enquiries.filter(e=>e.stage==='confirmed').forEach(e=>{
    const ci=e.checkin?new Date(e.checkin):null;
    const co=e.checkout?new Date(e.checkout):null;
    const sd=stays[e.id]||{};
    emails.forEach(em=>{
      let fd=null;
      if(em.trigger==='pre'&&ci) fd=new Date(ci.getTime()-em.days*86400000);
      if(em.trigger==='post'&&co) fd=new Date(co.getTime()+em.days*86400000);
      if(em.trigger==='inhouse'&&ci) fd=new Date(ci.getTime()+86400000);
      if(em.trigger==='payment'&&ci) fd=new Date(ci.getTime()-em.days*86400000);
      if(fd&&fd>=now) upcoming.push({guest:e.name,email:e.email,subject:em.subject,fd,trigger:em.trigger});
    });
    // Balance reminder
    if(sd.balance&&ci) {
      const balDue=new Date(ci.getTime()-21*86400000);
      if(balDue>=now) upcoming.push({guest:e.name,email:e.email,subject:'💳 Balance payment due',fd:balDue,trigger:'payment'});
    }
  });
  upcoming.sort((a,b)=>a.fd-b.fd);
  const list=document.getElementById('reminders-list');
  if(!upcoming.length){
    list.innerHTML=`<div style="padding:30px;text-align:center;color:var(--text-muted);background:white;border-radius:8px;border:1px solid var(--sand-dark)">No upcoming reminders. Add confirmed guests with check-in dates to see their scheduled emails here.</div>`;
    return;
  }
  list.innerHTML=upcoming.map(r=>{
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
  if (typeof window !== 'undefined' && window.__CRM_ARCHIVE_ADMIN_PW) {
    return String(window.__CRM_ARCHIVE_ADMIN_PW);
  }
  return '';
}

function unlockAdmin() {
  const pw = document.getElementById('admin-pw').value;
  const expected = getArchiveAdminPassword();
  if(!expected){
    document.getElementById('admin-status').textContent = '⚙️ Archive PIN not configured on server';
    document.getElementById('admin-status').style.color = 'var(--warning)';
    return;
  }
  if(pw === expected) {
    adminUnlocked = true;
    document.getElementById('admin-status').textContent = '🔓 Admin unlocked';
    document.getElementById('admin-status').style.color = 'var(--success)';
    document.getElementById('admin-pw').style.display = 'none';
    renderArchive();
  } else {
    document.getElementById('admin-status').textContent = '❌ Wrong password';
    document.getElementById('admin-status').style.color = 'var(--danger)';
  }
}

function renderArchive() {
  const q = (document.getElementById('archive-search')?.value||'').toLowerCase();
  const filter = document.getElementById('archive-filter')?.value || 'all';
  let pool = enquiries.filter(e => ['completed','dead'].includes(e.stage));
  if(filter==='completed') pool = pool.filter(e=>e.stage==='completed');
  if(filter==='dead') pool = pool.filter(e=>e.stage==='dead');
  if(q) pool = pool.filter(e=>
    e.name.toLowerCase().includes(q)||e.email.toLowerCase().includes(q)||(e.location||'').toLowerCase().includes(q)
  );
  pool.sort((a,b)=>{
    const da = a.completedDate||a.deadDate||a.created||'';
    const db = b.completedDate||b.deadDate||b.created||'';
    return db.localeCompare(da);
  });

  document.getElementById('archive-count').textContent = `${pool.length} record${pool.length!==1?'s':''}`;
  const board = document.getElementById('archive-board');

  if(pool.length===0) {
    board.innerHTML = `<div class="archive-empty">No archived guests yet. Completed stays auto-move here after checkout. Mark lost leads as "Dead Client" to archive them.</div>`;
    return;
  }

  const completed = pool.filter(e=>e.stage==='completed');
  const dead = pool.filter(e=>e.stage==='dead');

  let html = '';

  if(completed.length>0 && filter!=='dead') {
    html += `<div class="archive-section">
      <div class="archive-section-title">
        <span>🌴 Completed Stays (${completed.length})</span>
        ${adminUnlocked?`<button class="btn btn-danger btn-sm" onclick="deleteAllStage('completed')">Delete All Completed</button>`:''}
      </div>
      <div class="archive-grid">
        ${completed.map(e=>archiveCard(e)).join('')}
      </div>
    </div>`;
  }

  if(dead.length>0 && filter!=='completed') {
    html += `<div class="archive-section">
      <div class="archive-section-title">
        <span>💀 Dead Clients (${dead.length})</span>
        ${adminUnlocked?`<button class="btn btn-danger btn-sm" onclick="deleteAllStage('dead')">Delete All Dead</button>`:''}
      </div>
      <div class="archive-grid">
        ${dead.map(e=>archiveCard(e)).join('')}
      </div>
    </div>`;
  }

  board.innerHTML = html;
}

function archiveCard(e) {
  const sd = stays[e.id]||{};
  const isCompleted = e.stage==='completed';
  const archiveDate = e.completedDate||e.deadDate||e.created||'';
  const copyText = buildCopyText(e, sd);

  return `<div class="archive-card ${isCompleted?'completed-card':'dead-card'}">
    <button class="copy-btn" onclick="copyToClipboard(${e.id})" title="Copy guest info">📋 Copy</button>
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
    ${e.notes?`<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:3px">"${e.notes.substring(0,60)}${e.notes.length>60?'…':''}"</div>`:''}
    <div class="archive-meta">${isCompleted?'✅ Completed':'💀 Lost'} · ${archiveDate?fmtDate(archiveDate):'—'}</div>
    <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
      <button class="copy-btn" style="position:static" onclick="copyToClipboard(${e.id})">📋 Copy Info</button>
      <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="restoreArchive(${e.id})">↩️ Restore</button>
      ${adminUnlocked?`<button class="admin-delete-btn" onclick="deleteArchive(${e.id})">🗑️ Delete</button>`:`<span style="font-size:10px;color:var(--text-muted)">🔒 Admin to delete</span>`}
    </div>
    <textarea id="copy-${e.id}" style="position:absolute;left:-9999px;opacity:0">${copyText}</textarea>
  </div>`;
}

function buildCopyText(e, sd) {
  let txt = `=== TOTAL BALI GUEST RECORD ===\n`;
  txt += `Name: ${e.name}\nEmail: ${e.email}\nPhone: ${e.phone||'—'}\nCountry: ${e.country||'—'}\n`;
  txt += `\n--- BOOKING DETAILS ---\n`;
  txt += `Location: ${e.location||'—'}\nBedrooms: ${e.bedrooms||'—'}\nGuests: ${e.guests||'—'}\nBudget/night: ${e.budget||'—'}\n`;
  txt += `Check-in: ${e.checkin||'—'}\nCheck-out: ${e.checkout||'—'}\n`;
  if(sd.villa) txt += `\n--- VILLA ---\n${sd.villa}, ${sd.villaLoc||''}\nAddress: ${sd.villaAddr||'—'}\nVilla Manager: ${sd.vmName||'—'} ${sd.vmPhone||''}\n`;
  if(sd.cars||sd.checkout_car||sd.meals||sd.tours||sd.services) {
    txt += `\n--- SERVICES / LOGISTICS ---\n`;
    if(sd.cars) txt += `Pickup transfer: ${sd.cars}\n`;
    if(sd.checkout_car) txt += `Checkout transfer: ${sd.checkout_car}\n`;
    if(sd.meals) txt += `Meals/Chef: ${sd.meals}\n`;
    if(sd.tours) txt += `Tours: ${sd.tours}\n`;
    if(sd.services) txt += `In-villa services: ${sd.services}\n`;
    if(sd.special) txt += `Special: ${sd.special}\n`;
  }
  if(e.notes) txt += `\n--- NOTES ---\n${e.notes}\n`;
  txt += `\nStage: ${STAGE_LABELS[e.stage]} | Added: ${e.created||'—'} | Archived: ${e.completedDate||e.deadDate||'—'}`;
  return txt;
}

function copyToClipboard(id) {
  const el = document.getElementById('copy-'+id);
  if(!el) return;
  navigator.clipboard.writeText(el.value).then(()=>{
    showNotif('Guest info copied to clipboard ✓');
  }).catch(()=>{
    el.style.position='static'; el.style.opacity='1';
    el.select(); document.execCommand('copy');
    el.style.position='absolute'; el.style.opacity='0';
    showNotif('Copied ✓');
  });
}

async function deleteArchive(id) {
  if(!adminUnlocked){showNotif('Unlock admin first ✗',true);return;}
  const e = enquiries.find(x=>x.id===id);
  if(!confirm(`Permanently delete "${e.name}"? This CANNOT be undone.`)) return;
  const resp = await apiRequest('deleteArchive', { id });
  if (resp && resp.success) {
    enquiries = enquiries.filter(x=>x.id!==id);
    delete stays[id];
    renderArchive(); updateBadges();
    showNotif('Record permanently deleted');
  }
}

async function deleteAllStage(stage) {
  if(!adminUnlocked){showNotif('Unlock admin first ✗',true);return;}
  const count = enquiries.filter(e=>e.stage===stage).length;
  if(!confirm(`Permanently delete ALL ${count} ${STAGE_LABELS[stage]} records? This CANNOT be undone.`)) return;
  const resp = await apiRequest('deleteAllStage', { stage });
  if (resp && resp.success) {
    enquiries = enquiries.filter(e=>e.stage!==stage);
    renderArchive(); updateBadges();
    showNotif(`${count} records deleted`);
  }
}

async function restoreArchive(id) {
  const resp = await apiRequest('restoreArchive', { id });
  if (resp && resp.success) {
    const idx = enquiries.findIndex(e=>e.id===id);
    enquiries[idx].stage = 'new';
    delete enquiries[idx].completedDate;
    delete enquiries[idx].deadDate;
    renderArchive(); renderPipeline(); updateBadges();
    showNotif('Restored to New Enquiry ✓');
  }
}

// ========== HELPERS ==========
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
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});}
function fmtDateShort(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short'});}
function showNotif(msg,err){
  const n=document.getElementById('notif');
  n.textContent=msg; n.style.background=err?'var(--danger)':'var(--ocean)';
  n.classList.add('show'); setTimeout(()=>n.classList.remove('show'),3000);
}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

// ========== SAMPLE DATA ==========
function loadSample(){
  if(enquiries.length>0) return;
  const d=off=>{const dt=new Date();dt.setDate(dt.getDate()+off);return dt.toISOString().split('T')[0];};
  enquiries=[
    {id:1,name:'Sarah & James Thompson',email:'sarah.t@gmail.com',phone:'+61 412 555 123',country:'Australia',location:'Seminyak',bedrooms:'5',guests:'10',budget:'$400–600',checkin:d(45),checkout:d(52),notes:'Birthday for Sarah turning 40. Flowers & cake on arrival.',stage:'confirmed',created:d(-10)},
    {id:2,name:'Mike Chen',email:'mchen@outlook.com',phone:'+65 9123 4567',country:'Singapore',location:'Canggu',bedrooms:'3',guests:'6',budget:'$200–300',checkin:d(12),checkout:d(17),notes:'Surf trip with friends. Early check-in requested.',stage:'invoice',created:d(-5)},
    {id:3,name:'The Williams Family',email:'cwilliams@yahoo.com',phone:'+44 7911 123456',country:'UK',location:'Ubud',bedrooms:'4',guests:'8',budget:'$300–400',checkin:d(90),checkout:d(100),notes:'Multi-generational family. Grandparents need ground floor room.',stage:'followup1',created:d(-2)},
    {id:4,name:'Emma Rossi',email:'emma.rossi@gmail.com',phone:'',country:'Italy',location:'Seminyak',bedrooms:'7',guests:'14',budget:'$500+',checkin:d(60),checkout:d(67),notes:'Hen party. Pool is essential. DJ setup possible?',stage:'new',created:d(-1)},
    {id:5,name:'David Park',email:'dpark@naver.com',phones:'+82 10 1234 5678',country:'South Korea',location:'Uluwatu',bedrooms:'2',guests:'4',budget:'$150–250',checkin:d(30),checkout:d(35),notes:'Honeymoon couple.',stage:'confirmed',created:d(-15)},
    {id:6,name:'Priya Sharma',email:'priya.s@gmail.com',phone:'+91 98765 43210',country:'India',location:'Seminyak',bedrooms:'5',guests:'5',budget:'$200–350',checkin:d(55),checkout:d(62),notes:'Anniversary trip. Surprise dinner appreciated.',stage:'followup2',created:d(-8)},
    {id:7,name:'Lars & Anna Johansson',email:'lars.j@hotmail.com',phone:'+46 70 123 4567',country:'Sweden',location:'Canggu',bedrooms:'3',guests:'5',budget:'$200–350',checkin:d(55),checkout:d(62),notes:'Anniversary trip. Surprise dinner appreciated.',stage:'followup2',created:d(-8)},
    {id:8,name:'The Rodriguez Group',email:'carlos.r@gmail.com',phone:'+34 612 345 678',country:'Spain',location:'Seminyak',bedrooms:'5',guests:'10',budget:'$400–600',checkin:d(40),checkout:d(47),notes:'10-year friends reunion. Need good sound system.',stage:'followup1',created:d(-6)},
    {id:9,name:'Kate & Friends',email:'kate.m@icloud.com',phone:'+61 423 111 222',country:'Australia',location:'Canggu',bedrooms:'3',guests:'6',budget:'$250–350',checkin:d(38),checkout:d(43),notes:'Girls trip. Love yoga and healthy food.',stage:'hold',created:d(-4)},
    {id:10,name:'The Patel Wedding Party',email:'raj.patel@gmail.com',phone:'+44 7700 900123',country:'UK',location:'Seminyak',bedrooms:'9+',guests:'18',budget:'$600+',checkin:d(120),checkout:d(128),notes:'Pre-wedding celebrations. Need catering, decorator.',stage:'new',created:d(-1)},
  ];
  stays[1]={villa:'Villa Kalis',villaLoc:'Seminyak',villaAddr:'Jl. Kayu Aya No. 88',vmName:'Wayan',vmPhone:'+62 812 3456 789',balance:'3200',cars:'2x airport transfer, 14:00',checkout_car:'2x transfer to airport, 10:00',meals:'Private chef Wed',tours:'Lembongan Fri',services:'Cake & flowers on arrival',special:'Birthday banner poolside',notes:'Key with security gate. Use back entrance for deliveries.'};
  stays[5]={villa:'Villa Aramis',villaLoc:'Uluwatu',villaAddr:'Jl. Labuansait No. 12',vmName:'Made',vmPhone:'+62 819 2345 678',balance:'',cars:'1x airport transfer',checkout_car:'1x transfer to airport, 09:30',meals:'',tours:'Sunset dinner Fri',services:'Couples massage',special:'Rose petals in room',notes:'Romantic setup requested. Confirm sunset time with restaurant.'};
  if(activities.length===0) {
    activities = [
      {id:101, guestName:'Jake & Crew', email:'jake.b@gmail.com', phone:'+61 412 999 888', guests:'12', activityType:'Party Bus', date:d(8), time:'20:00', pickup:'Villa Kalis, Seminyak', price:'480', details:'4hr party bus, DJ, drinks package, 3 club stops — Ku De Ta, Motel Mexicola, Mirror', notes:'Confirm DJ playlist in advance. Need 2x security guard contact.'},
      {id:102, guestName:'Sophie Williams', email:'sophie.w@hotmail.com', phone:'', guests:'4', activityType:'Lembongan Boat Trip', date:d(15), time:'07:30', pickup:'Pantai Double Six, Seminyak', price:'280', details:'Full day snorkelling & island tour, includes lunch', notes:'Check tide times. Snorkel gear confirmed with operator.'},
    ];
  }
} // end loadSample()

// ========== INITIALISE ==========
async function init() {
  emails = defaultEmails();

  const data = await apiRequest('getAll');
  if (
    data &&
    !data.error &&
    typeof data.backendConfigured !== 'undefined' &&
    data.backendConfigured === false
  ) {
    loadSample();
    autoPromoteCompleted();
    renderPipeline();
    setStaysMonth(0);
    updateBadges();
    showNotif('Sample data — set CRM_APPS_SCRIPT_URL on the server to sync', false);
    return;
  }

  const okPayload =
    data &&
    !data.error &&
    (Array.isArray(data.enquiries) || data.success === true);
  if (okPayload) {
    enquiries = [...(data.enquiries || []), ...(data.archived || [])];
    stays = data.stays || {};
    activities = data.activities || [];
    autoPromoteCompleted();
    renderPipeline();
    setStaysMonth(0);
    updateBadges();
    showNotif(data.success !== false ? 'Data Synced ✓' : 'Loaded ✓', false);
  } else {
    loadSample();
    autoPromoteCompleted();
    renderPipeline();
    setStaysMonth(0);
    updateBadges();
  }
}

init();

