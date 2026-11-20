const DB_NAME = 'pali-learning-app';
const DB_VERSION = 1;
const STORE = 'appState';
const STATE_KEY = 'main';

const DEMO_CARDS = [
  {
    id: 'dukkha', pali: 'dukkha', meaning: '苦；不圆满', category: '核心概念', hint: '从经验本身观察这个词',
    grammar: '名词 · 中性', core: '苦、不圆满、难以满足。',
    explanation: '它不只指身体疼痛，也可以指经验中不稳定、不能带来持久满足的性质。理解时要看具体语境，不要把它压缩成一个固定的中文词。',
    story: '当一个愉快的感受正在变化时，我们能否要求它永远保持原样？这个问题可以帮助我们观察 dukkha 的一个面向。',
    related: ['vedanā · 感受', 'anicca · 无常', 'taṇhā · 渴爱']
  },
  {
    id: 'anicca', pali: 'anicca', meaning: '无常；不恒常', category: '核心概念', hint: '留意正在发生的变化',
    grammar: '形容词', core: '无常、变化、不恒常。',
    explanation: '这个词指向事物不是固定不变的性质。学习时可以留意它在描述身体、感受、想法或其他现象时的具体用法。',
    story: '声音出现，然后减弱，最后消失。我们不需要先接受一个理论，只要仔细观察这个过程，就能开始接触 anicca。',
    related: ['dukkha · 苦', 'anattā · 无我', 'uppāda · 生起']
  },
  {
    id: 'anatta', pali: 'anattā', meaning: '无我；非我', category: '核心概念', hint: '不要急着把它变成口号',
    grammar: '形容词 / 中性名词用法依语境', core: '非我、不是一个可支配的自我。',
    explanation: 'anattā 不是简单地说“什么都不存在”。理解它需要观察现象是否真的恒常、可控制，并能被合理地认作“这是我的、这是我、这是我的自我”。',
    story: '身体会变化，感受会变化，念头也会变化。面对这些现象时，可以逐一观察：它们是否完全受我们的命令？',
    related: ['anicca · 无常', 'dukkha · 苦', 'rūpa · 色 / 物质形态']
  }
];

const $ = (id) => document.getElementById(id);
let db;
let state;
let currentCard = null;
let drag = null;
let toastTimer;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function readState() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(STATE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function writeState() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(state, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('保存中断'));
  });
}
function freshState() {
  return {
    schemaVersion: 1,
    queue: DEMO_CARDS.map(card => card.id),
    progress: {},
    history: [],
    updatedAt: new Date().toISOString()
  };
}
function cardById(id) { return DEMO_CARDS.find(card => card.id === id); }
function current() { return cardById(state.queue[0]); }
function statusFor(id) { return state.progress[id]?.status || 'NEW'; }
function updateHeader() {
  const total = DEMO_CARDS.length;
  const remaining = state.queue.length;
  const known = Object.values(state.progress).filter(item => item.status === 'RECOGNIZED' || item.status === 'FAMILIAR').length;
  $('remainingCount').textContent = String(remaining);
  $('totalCount').textContent = String(total);
  $('knownCount').textContent = String(known);
  $('progressFill').style.width = `${((total - remaining) / total) * 100}%`;
  $('undoButton').disabled = state.history.length === 0;
}
function renderCard() {
  currentCard = current();
  updateHeader();
  const empty = !currentCard;
  $('wordCard').hidden = empty;
  $('emptyState').hidden = !empty;
  $('gestureHint').hidden = empty;
  $('unknownButton').disabled = empty;
  $('knownButton').disabled = empty;
  $('detailButton').disabled = empty;
  if (empty) return;
  const index = DEMO_CARDS.findIndex(card => card.id === currentCard.id) + 1;
  $('wordCategory').textContent = currentCard.category;
  $('wordIndex').textContent = String(index).padStart(2, '0');
  $('wordPali').textContent = currentCard.pali;
  $('wordMeaning').textContent = currentCard.meaning;
  $('wordHint').textContent = currentCard.hint;
  $('wordCard').style.transform = '';
  $('wordCard').style.opacity = '1';
  $('knownStamp').style.opacity = '0';
  $('unknownStamp').style.opacity = '0';
}
function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1700);
}
async function classify(direction) {
  if (!currentCard) return;
  const card = currentCard;
  const previous = state.progress[card.id] ? structuredClone(state.progress[card.id]) : null;
  state.history.push({ id: card.id, previous, direction });
  state.progress[card.id] = {
    status: direction === 'right' ? 'RECOGNIZED' : 'LEARNING',
    next_review_at: new Date(Date.now() + 86400000).toISOString(),
    correct_streak: 0,
    last_action_at: new Date().toISOString()
  };
  state.queue.shift();
  state.updatedAt = new Date().toISOString();
  await writeState();
  renderCard();
  showToast(direction === 'right' ? '已标记为认识' : '已放入学习中');
}
async function undo() {
  const action = state.history.pop();
  if (!action) return;
  state.queue.unshift(action.id);
  if (action.previous) state.progress[action.id] = action.previous;
  else delete state.progress[action.id];
  state.updatedAt = new Date().toISOString();
  await writeState();
  renderCard();
  showToast('已撤销上一步');
}
function openDetails() {
  if (!currentCard) return;
  $('detailTitle').textContent = currentCard.pali;
  $('detailSubtitle').textContent = currentCard.grammar;
  $('detailCore').textContent = currentCard.core;
  $('detailExplanation').textContent = currentCard.explanation;
  $('detailStory').textContent = currentCard.story;
  $('relatedWords').replaceChildren(...currentCard.related.map(text => {
    const chip = document.createElement('span');
    chip.className = 'related-chip';
    chip.textContent = text;
    return chip;
  }));
  $('detailOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDetails() {
  $('detailOverlay').hidden = true;
  document.body.style.overflow = '';
}
async function restartDeck() {
  state.queue = DEMO_CARDS.map(card => card.id);
  state.history = [];
  state.updatedAt = new Date().toISOString();
  await writeState();
  renderCard();
}
function startDrag(event) {
  if (!currentCard || event.target.closest('button')) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  drag = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
  $('wordCard').setPointerCapture?.(event.pointerId);
  $('wordCard').classList.add('dragging');
}
function moveDrag(event) {
  if (!drag) return;
  drag.x = event.clientX;
  drag.y = event.clientY;
  const dx = drag.x - drag.startX;
  const dy = drag.y - drag.startY;
  if (Math.abs(dx) > 7 || Math.abs(dy) > 7) drag.moved = true;
  if (!drag.moved) return;
  const rotate = Math.max(-13, Math.min(13, dx / 18));
  $('wordCard').style.transform = `translate3d(${dx}px, ${dy * .12}px, 0) rotate(${rotate}deg)`;
  $('knownStamp').style.opacity = String(Math.max(0, Math.min(1, dx / 100)));
  $('unknownStamp').style.opacity = String(Math.max(0, Math.min(1, -dx / 100)));
}
async function endDrag() {
  if (!drag) return;
  const dx = drag.x - drag.startX;
  const moved = drag.moved;
  drag = null;
  $('wordCard').classList.remove('dragging');
  if (Math.abs(dx) > 105) {
    $('wordCard').style.transition = 'transform .22s ease, opacity .22s ease';
    $('wordCard').style.transform = `translate3d(${dx > 0 ? 650 : -650}px, 0, 0) rotate(${dx > 0 ? 18 : -18}deg)`;
    $('wordCard').style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 180));
    $('wordCard').style.transition = '';
    await classify(dx > 0 ? 'right' : 'left');
  } else {
    $('wordCard').style.transition = 'transform .2s ease';
    $('wordCard').style.transform = '';
    $('knownStamp').style.opacity = '0';
    $('unknownStamp').style.opacity = '0';
    setTimeout(() => { $('wordCard').style.transition = ''; }, 210);
    if (!moved) openDetails();
  }
}

async function init() {
  try {
    db = await openDB();
    state = await readState();
    if (!state || state.schemaVersion !== 1) {
      state = freshState();
      await writeState();
    }
    renderCard();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch (error) {
    console.error(error);
    showToast('本地数据库无法启动，请刷新页面');
  }
  $('knownButton').addEventListener('click', () => classify('right'));
  $('unknownButton').addEventListener('click', () => classify('left'));
  $('detailButton').addEventListener('click', openDetails);
  $('wordCard').addEventListener('pointerdown', startDrag);
  $('wordCard').addEventListener('pointermove', moveDrag);
  $('wordCard').addEventListener('pointerup', endDrag);
  $('wordCard').addEventListener('pointercancel', endDrag);
  $('undoButton').addEventListener('click', undo);
  $('restartButton').addEventListener('click', restartDeck);
  $('closeDetailButton').addEventListener('click', closeDetails);
  $('detailOverlay').addEventListener('click', event => { if (event.target === $('detailOverlay')) closeDetails(); });
  $('detailKnownButton').addEventListener('click', async () => { closeDetails(); await classify('right'); });
  $('detailUnknownButton').addEventListener('click', async () => { closeDetails(); await classify('left'); });
  $('wordCard').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('detailOverlay').hidden) closeDetails(); });
}
init();
