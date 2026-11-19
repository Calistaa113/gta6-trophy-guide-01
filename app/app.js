// Leonida Trophy Atlas — a plain checklist, tracker and roadmap for the 55 GTA VI trophies.
// Everything runs from static files: the trophy list and the roadmap are fetched from data/
// on this same server, progress lives in localStorage, and nothing is sent anywhere.
const STORE_KEY = 'leonida-trophy-atlas-v1';
const UNCONFIRMED_IDS = new Set([44, 49, 50, 51]);
const STORY_KINDS = new Set(['story', 'platinum']);

const listEl = document.getElementById('trophyList');
const detailEl = document.getElementById('detail');
const noteEl = document.getElementById('listNote');
const emptyEl = document.getElementById('emptyState');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('gradeFilter');
const chipsEl = document.getElementById('kindChips');
const spoilerEl = document.getElementById('spoilerToggle');
const progressText = document.getElementById('progressText');
const progressPct = document.getElementById('progressPct');
const progressFill = document.getElementById('progressFill');
const gradeCounts = document.getElementById('gradeCounts');

const params = new URLSearchParams(location.search);
let state = loadState();
let trophies = [];
let roadmap = null;
let kindFilter = params.get('filter') || 'all';
let selectedId = Number(params.get('trophy')) || null;
let view = params.get('view') === 'roadmap' ? 'roadmap' : 'guide';
if (params.get('spoiler') === '1') state.spoiler = true;

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (raw && Array.isArray(raw.earned)) {
      return { earned: new Set(raw.earned.filter((n) => Number.isInteger(n))), spoiler: raw.spoiler === true };
    }
  } catch {
    // A corrupt saved state is not worth losing the checklist over: start fresh.
  }
  return { earned: new Set(), spoiler: false };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ earned: [...state.earned].sort((a, b) => a - b), spoiler: state.spoiler }));
}

function gradeLabel(grade) {
  return grade === 'platinum' ? 'Platinum' : grade === 'gold' ? 'Gold' : grade === 'silver' ? 'Silver' : 'Bronze';
}

function kindLabel(kind) {
  const labels = { platinum: 'Platinum', story: 'Story', collectible: 'Collectible', activity: 'Activity', crime: 'Crime', money: 'Money', exploration: 'Exploration', completion: '100% list' };
  return labels[kind] ?? kind;
}

function isHidden(t) {
  return state.spoiler && t.kind === 'story' && !state.earned.has(t.id);
}

function matchesKind(t) {
  if (kindFilter === 'all') return true;
  if (kindFilter === 'story') return STORY_KINDS.has(t.kind);
  if (kindFilter === 'missable') return t.missable === true;
  if (kindFilter === 'collectible') return t.kind === 'collectible';
  if (kindFilter === 'activity') return t.kind === 'activity';
  if (kindFilter === 'online') return false;
  return true;
}

function visibleTrophies() {
  const q = searchEl.value.trim().toLowerCase();
  return trophies.filter((t) => {
    if (!matchesKind(t)) return false;
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (q && !(t.name + ' ' + t.description + ' ' + t.guide).toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderProgress() {
  const total = trophies.length;
  const earned = state.earned.size;
  progressText.textContent = `${earned} of ${total} earned`;
  progressPct.textContent = total ? `${Math.round((earned / total) * 100)}%` : '0%';
  progressFill.style.width = total ? `${(earned / total) * 100}%` : '0%';
  const byGrade = {};
  for (const t of trophies) {
    byGrade[t.grade] = byGrade[t.grade] || [0, 0];
    byGrade[t.grade][1] += 1;
    if (state.earned.has(t.id)) byGrade[t.grade][0] += 1;
  }
  gradeCounts.textContent = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => `${gradeLabel(g)[0]} ${byGrade[g] ? byGrade[g][0] : 0}/${byGrade[g] ? byGrade[g][1] : 0}`)
    .join(' · ');
}

function renderList() {
  const shown = visibleTrophies();
  emptyEl.hidden = kindFilter !== 'online';
  listEl.replaceChildren();
  noteEl.textContent = kindFilter === 'online'
    ? 'Online filter: nothing to show.'
    : `Showing ${shown.length} of ${trophies.length} trophies` + (state.spoiler ? ' — story spoilers hidden until earned.' : '.');
  for (const t of shown) {
    const li = document.createElement('li');
    li.className = 'trophy' + (state.earned.has(t.id) ? ' earned' : '') + (selectedId === t.id ? ' selected' : '');
    li.id = `trophy-${t.id}`;

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.earned.has(t.id);
    box.setAttribute('aria-label', `Mark ${t.name} as earned`);
    box.addEventListener('change', () => {
      if (box.checked) state.earned.add(t.id);
      else state.earned.delete(t.id);
      saveState();
      renderAllKeepScroll();
    });

    const body = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'trophy-name';
    name.textContent = isHidden(t) ? '' : t.name;
    if (isHidden(t)) {
      const hidden = document.createElement('span');
      hidden.className = 'hidden-name';
      hidden.textContent = 'Hidden story trophy — earn it to reveal';
      name.append(hidden);
    }
    const desc = document.createElement('div');
    desc.className = 'trophy-desc';
    desc.textContent = isHidden(t) ? 'Name and description hidden until earned.' : t.description;
    const tags = document.createElement('div');
    tags.className = 'tags';
    const kindTag = document.createElement('span');
    kindTag.className = `tag kind-${t.kind}`;
    kindTag.textContent = kindLabel(t.kind);
    tags.append(kindTag);
    if (t.missable) {
      const miss = document.createElement('span');
      miss.className = 'tag missable';
      miss.textContent = 'Missable';
      tags.append(miss);
    }
    if (t.count) {
      const count = document.createElement('span');
      count.className = 'tag';
      count.textContent = `Target: ${t.count}`;
      tags.append(count);
    }
    const guideBtn = document.createElement('button');
    guideBtn.type = 'button';
    guideBtn.className = 'guide-btn';
    guideBtn.textContent = 'Read guide';
    guideBtn.addEventListener('click', () => { selectedId = t.id; renderAll(); });
    body.append(name, desc, tags, guideBtn);

    const grade = document.createElement('div');
    grade.className = `grade ${t.grade}`;
    grade.textContent = gradeLabel(t.grade);

    li.append(box, body, grade);
    listEl.append(li);
  }
}

function renderDetail() {
  const t = trophies.find((x) => x.id === selectedId);
  if (!t) {
    detailEl.innerHTML = '';
    const hint = document.createElement('p');
    hint.className = 'detail-hint';
    hint.textContent = 'Pick a trophy on the left to read its guide and sources.';
    detailEl.append(hint);
    return;
  }
  detailEl.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = isHidden(t) ? 'Hidden story trophy' : t.name;
  const official = document.createElement('p');
  official.className = 'official';
  official.textContent = isHidden(t)
    ? 'Hidden until earned — turn the spoiler setting off, or tick it off in-game, to reveal it.'
    : `${t.description} — ${gradeLabel(t.grade)} · ${kindLabel(t.kind)}${t.missable ? ' · Missable' : ''}`;
  detailEl.append(title, official);

  if (t.count && !isHidden(t)) {
    const count = document.createElement('p');
    count.className = 'count-line';
    count.textContent = `Target: ${t.count}`;
    detailEl.append(count);
  }
  if (!isHidden(t)) {
    const guideTitle = document.createElement('h3');
    guideTitle.textContent = 'Guide';
    const guide = document.createElement('p');
    guide.className = 'guide-text';
    guide.textContent = t.guide;
    detailEl.append(guideTitle, guide);
    if (UNCONFIRMED_IDS.has(t.id)) {
      const note = document.createElement('p');
      note.className = 'unconfirmed';
      note.textContent = 'Unconfirmed: no guide has pinned down the exact trigger for this trophy yet (PowerPyx, 18 Nov 2026). The guide above is the best-supported reading of the description — it does not invent a method.';
      detailEl.append(note);
    }
    const srcTitle = document.createElement('h3');
    srcTitle.textContent = 'Sources';
    const srcList = document.createElement('ul');
    srcList.className = 'sources';
    for (const s of t.sources) {
      const item = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = s.name;
      item.append(a);
      srcList.append(item);
    }
    detailEl.append(srcTitle, srcList);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'earned-toggle' + (state.earned.has(t.id) ? ' earned' : '');
  toggle.textContent = state.earned.has(t.id) ? '✓ Earned — click to untick' : 'Mark as earned';
  toggle.addEventListener('click', () => {
    if (state.earned.has(t.id)) state.earned.delete(t.id);
    else state.earned.add(t.id);
    saveState();
    renderAllKeepScroll();
  });
  detailEl.append(toggle);
}

function renderRoadmap() {
  if (!roadmap) return;
  document.getElementById('roadmapTitle').textContent = roadmap.title;
  document.getElementById('roadmapEstimate').textContent = roadmap.estimate;
  document.getElementById('roadmapSave').textContent = roadmap.saveAdvice;
  document.getElementById('roadmapMissable').textContent = roadmap.missableNote;
  const srcEl = document.getElementById('roadmapSources');
  srcEl.innerHTML = '';
  srcEl.append(document.createTextNode('Sources: '));
  roadmap.sources.forEach((s, i) => {
    if (i > 0) srcEl.append(document.createTextNode(' · '));
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.name;
    srcEl.append(a);
  });
  const stageList = document.getElementById('stageList');
  stageList.replaceChildren();
  for (const stage of roadmap.stages) {
    const li = document.createElement('li');
    li.className = 'stage';
    const h = document.createElement('h3');
    h.textContent = `Stage ${stage.n} — ${stage.name}`;
    const hours = document.createElement('div');
    hours.className = 'hours';
    hours.textContent = stage.hours;
    const summary = document.createElement('p');
    summary.className = 'summary';
    summary.textContent = stage.summary;
    const steps = document.createElement('ol');
    for (const step of stage.steps) {
      const item = document.createElement('li');
      item.textContent = step;
      steps.append(item);
    }
    li.append(h, hours, summary, steps);
    const members = trophies.filter((t) => t.stage === stage.n);
    if (members.length) {
      const names = document.createElement('p');
      names.className = 'stage-trophies';
      const strong = document.createElement('strong');
      strong.textContent = `Trophies in this stage (${members.length}): `;
      names.append(strong, document.createTextNode(members.map((t) => t.name).join(', ')));
      li.append(names);
    }
    stageList.append(li);
  }
}

function renderViews() {
  document.getElementById('guideView').hidden = view !== 'guide';
  document.getElementById('roadmapView').hidden = view !== 'roadmap';
  document.getElementById('viewGuideBtn').classList.toggle('active', view === 'guide');
  document.getElementById('viewRoadmapBtn').classList.toggle('active', view === 'roadmap');
}

function renderAll() {
  spoilerEl.checked = state.spoiler;
  chipsEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.kind === kindFilter));
  renderProgress();
  renderList();
  renderDetail();
  renderViews();
}

// Re-rendering the list rebuilds its rows, which drops the page back to the top. Ticking a
// trophy mid-list should leave the reader where they were, so tick handlers go through here.
function renderAllKeepScroll() {
  const y = window.scrollY;
  renderAll();
  window.scrollTo(0, y);
}

document.getElementById('viewGuideBtn').addEventListener('click', () => { view = 'guide'; renderViews(); });
document.getElementById('viewRoadmapBtn').addEventListener('click', () => { view = 'roadmap'; renderViews(); });
document.getElementById('missableJump').addEventListener('click', () => {
  kindFilter = 'missable';
  selectedId = 28;
  view = 'guide';
  renderAll();
  document.getElementById('trophy-28')?.scrollIntoView({ block: 'center' });
});
searchEl.addEventListener('input', renderList);
gradeEl.addEventListener('change', renderList);
chipsEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  kindFilter = chip.dataset.kind;
  renderAll();
});
spoilerEl.addEventListener('change', () => {
  state.spoiler = spoilerEl.checked;
  saveState();
  renderAllKeepScroll();
});
document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = { game: 'Grand Theft Auto VI', platform: 'PlayStation 5', exportedAt: new Date().toISOString(), earned: [...state.earned].sort((a, b) => a - b) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'leonida-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(ids)) throw new Error('no earned list');
    const valid = ids.filter((n) => Number.isInteger(n) && n >= 1 && n <= trophies.length);
    if (!valid.length) throw new Error('no valid trophy ids');
    state.earned = new Set(valid);
    saveState();
    renderAllKeepScroll();
  } catch {
    alert('That file is not a Leonida Trophy Atlas progress export.');
  }
  e.target.value = '';
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Clear every tick in this tracker?')) {
    state.earned.clear();
    saveState();
    renderAllKeepScroll();
  }
});

const [trophyDoc, roadmapDoc] = await Promise.all([
  (await fetch('data/trophies.json')).json(),
  (await fetch('data/roadmap.json')).json(),
]);
trophies = trophyDoc.trophies;
roadmap = roadmapDoc;
renderRoadmap();
renderAll();
