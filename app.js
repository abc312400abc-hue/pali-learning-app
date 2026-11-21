/* Pali Learning App — content and learning records are stored separately. */
const DB_NAME = 'pali-learning-app';
const DB_VERSION = 2;
const STORES = { state: 'appState', content: 'contentCards', learning: 'learningRecords', meta: 'metadata' };
const STATE_KEY = 'main';

const DEMO_CARDS = [
  {
    id: 'dukkha', headword: 'dukkha', display: 'dukkha', meaning: '苦；不圆满', category: '核心概念', hint: '从经验本身观察这个词',
    partOfSpeech: '名词 · 中性', core: '苦、不圆满、难以满足。',
    explanation: '它不只指身体疼痛，也可以指经验中不稳定、不能带来持久满足的性质。理解时要看具体语境，不要把它压缩成一个固定的中文词。',
    story: '当一个愉快的感受正在变化时，我们能否要求它永远保持原样？这个问题可以帮助我们观察 dukkha 的一个面向。',
    usage: [], relations: [
      { targetId: 'vedana', type: 'teaching', label: 'vedanā · 感受', note: '教学关联；不是词源关系。' },
      { targetId: 'anicca', type: 'teaching', label: 'anicca · 无常', note: '教学关联；不是词源关系。' },
      { targetId: 'tanha', type: 'teaching', label: 'taṇhā · 渴爱', note: '教学关联；不是词源关系。' }
    ], provenance: [], contentStatus: 'teaching-draft', active: true
  },
  {
    id: 'anicca', headword: 'anicca', display: 'anicca', meaning: '无常；不恒常', category: '核心概念', hint: '留意正在发生的变化',
    partOfSpeech: '形容词', core: '无常、变化、不恒常。',
    explanation: '这个词指向事物不是固定不变的性质。学习时可以留意它在描述身体、感受、想法或其他现象时的具体用法。',
    story: '声音出现，然后减弱，最后消失。我们不需要先接受一个理论，只要仔细观察这个过程，就能开始接触 anicca。',
    usage: [], relations: [
      { targetId: 'dukkha', type: 'teaching', label: 'dukkha · 苦', note: '教学关联；不是词源关系。' },
      { targetId: 'anatta', type: 'teaching', label: 'anattā · 无我', note: '教学关联；不是词源关系。' },
      { targetId: 'uppada', type: 'teaching', label: 'uppāda · 生起', note: '教学关联；不是词源关系。' }
    ], provenance: [], contentStatus: 'teaching-draft', active: true
  },
  {
    id: 'anatta', headword: 'anattā', display: 'anattā', meaning: '无我；非我', category: '核心概念', hint: '不要急着把它变成口号',
    partOfSpeech: '形容词 / 名词用法依语境', core: '非我、不是一个可支配的自我。',
    explanation: 'anattā 不是简单地说“什么都不存在”。理解它需要观察现象是否真的恒常、可控制，并能被合理地认作“这是我的、这是我、这是我的自我”。',
    story: '身体会变化，感受会变化，念头也会变化。面对这些现象时，可以逐一观察：它们是否完全受我们的命令？',
    usage: [], relations: [
      { targetId: 'anicca', type: 'teaching', label: 'anicca · 无常', note: '教学关联；不是词源关系。' },
      { targetId: 'dukkha', type: 'teaching', label: 'dukkha · 苦', note: '教学关联；不是词源关系。' }
    ], provenance: [], contentStatus: 'teaching-draft', active: true
  }
];

const $ = id => document.getElementById(id);
let db;
let state;
let cards = [];
let learning = {};
let currentCard = null;
let detailCardId = null;
let detailHistory = [];
let drag = null;
let toastTimer;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORES.state)) database.createObjectStore(STORES.state);
      if (!database.objectStoreNames.contains(STORES.content)) database.createObjectStore(STORES.content, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(STORES.learning)) database.createObjectStore(STORES.learning, { keyPath: 'cardId' });
      if (!database.objectStoreNames.contains(STORES.meta)) database.createObjectStore(STORES.meta);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('数据库操作中断'));
  });
}
async function getValue(store, key) {
  const tx = db.transaction(store, 'readonly');
  const result = await requestResult(tx.objectStore(store).get(key));
  await txDone(tx);
  return result;
}
async function getAll(store) {
  const tx = db.transaction(store, 'readonly');
  const result = await requestResult(tx.objectStore(store).getAll());
  await txDone(tx);
  return result;
}
async function putValue(store, value, key) {
  const tx = db.transaction(store, 'readwrite');
  if (key === undefined) tx.objectStore(store).put(value);
  else tx.objectStore(store).put(value, key);
  await txDone(tx);
}
async function saveAppState() {
  state.updatedAt = new Date().toISOString();
  await putValue(STORES.state, state, STATE_KEY);
}
async function saveLearning(record) {
  learning[record.cardId] = record;
  await putValue(STORES.learning, record);
}
function normalizeCard(card) {
  // Keep a stable, predictable shape while allowing optional research fields to grow.
  return {
    id: card.id,
    headword: card.headword,
    display: card.display || card.headword,
    meaning: card.meaning || '',
    category: card.category || '未分类',
    hint: card.hint || '点击卡片，查看这个词的内容',
    partOfSpeech: card.partOfSpeech || card.grammar || '',
    core: card.core || '',
    explanation: card.explanation || '',
    story: card.story || '',
    morphology: card.morphology || {},
    senses: Array.isArray(card.senses) ? card.senses : [],
    usage: Array.isArray(card.usage) ? card.usage : [],
    relations: Array.isArray(card.relations) ? card.relations : [],
    provenance: Array.isArray(card.provenance) ? card.provenance : [],
    contentStatus: card.contentStatus || 'draft',
    active: card.active !== false,
    deprecatedReason: card.deprecatedReason || '',
    updatedAt: card.updatedAt || new Date().toISOString()
  };
}
function freshState() {
  return { schemaVersion: 2, queue: [], history: [], updatedAt: new Date().toISOString() };
}
async function initializeData() {
  // Preserve the v1 learning data already stored by the first prototype.
  const oldState = await getValue(STORES.state, STATE_KEY);
  let storedCards = await getAll(STORES.content);
  if (!storedCards.length) {
    const tx = db.transaction(STORES.content, 'readwrite');
    DEMO_CARDS.map(normalizeCard).forEach(card => tx.objectStore(STORES.content).put(card));
    await txDone(tx);
    storedCards = DEMO_CARDS.map(normalizeCard);
  }
  cards = storedCards;

  const records = await getAll(STORES.learning);
  learning = Object.fromEntries(records.map(record => [record.cardId, record]));
  if (oldState?.progress && !records.length) {
    const tx = db.transaction(STORES.learning, 'readwrite');
    for (const [cardId, oldRecord] of Object.entries(oldState.progress)) {
      const record = { cardId, status: oldRecord.status || 'NEW', next_review_at: oldRecord.next_review_at || null,
        correct_streak: oldRecord.correct_streak || 0, last_action_at: oldRecord.last_action_at || null };
      tx.objectStore(STORES.learning).put(record);
      learning[cardId] = record;
    }
    await txDone(tx);
  }
  const activeIds = cards.filter(card => card.active).map(card => card.id);
  const validOldQueue = Array.isArray(oldState?.queue) ? oldState.queue.filter(id => activeIds.includes(id)) : [];
  const alreadyQueued = new Set(validOldQueue);
  const initialQueue = oldState ? validOldQueue : activeIds;
  for (const id of activeIds) if (!alreadyQueued.has(id) && !learning[id]) initialQueue.push(id);
  state = { schemaVersion: 2, queue: initialQueue, history: Array.isArray(oldState?.history) ? oldState.history : [], updatedAt: new Date().toISOString() };
  await saveAppState();
}
function activeCards() { return cards.filter(card => card.active); }
function cardById(id) { return cards.find(card => card.id === id); }
function current() { return cardById(state.queue[0]); }
function statusFor(id) { return learning[id]?.status || 'NEW'; }
function updateHeader() {
  const total = activeCards().length;
  const remaining = state.queue.length;
  const known = Object.values(learning).filter(item => item.status === 'RECOGNIZED' || item.status === 'FAMILIAR').length;
  $('remainingCount').textContent = String(remaining);
  $('totalCount').textContent = String(total);
  $('knownCount').textContent = String(known);
  $('progressFill').style.width = `${total ? ((total - remaining) / total) * 100 : 0}%`;
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
  $('wordCategory').textContent = currentCard.category;
  $('wordIndex').textContent = String(activeCards().findIndex(card => card.id === currentCard.id) + 1).padStart(2, '0');
  $('wordPali').textContent = currentCard.display;
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
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2200);
}
async function classifyCard(cardId, direction) {
  const card = cardById(cardId);
  if (!card) return;
  const previous = learning[card.id] ? structuredClone(learning[card.id]) : null;
  state.history.push({ id: card.id, previous, direction });
  await saveLearning({ cardId: card.id, status: direction === 'right' ? 'RECOGNIZED' : 'LEARNING',
    next_review_at: new Date(Date.now() + 86400000).toISOString(), correct_streak: 0, last_action_at: new Date().toISOString() });
  state.queue = state.queue.filter(id => id !== card.id);
  await saveAppState();
  renderCard();
  showToast(direction === 'right' ? `已标记 ${card.display} 为认识` : `已将 ${card.display} 放入学习中`);
}
async function classify(direction) {
  if (!currentCard) return;
  return classifyCard(currentCard.id, direction);
}
async function undo() {
  const action = state.history.pop();
  if (!action) return;
  state.queue.unshift(action.id);
  if (action.previous) await saveLearning(action.previous);
  else {
    delete learning[action.id];
    const tx = db.transaction(STORES.learning, 'readwrite');
    tx.objectStore(STORES.learning).delete(action.id);
    await txDone(tx);
  }
  await saveAppState();
  renderCard();
  showToast('已撤销上一步');
}
function openDetails(cardId = currentCard?.id) {
  const targetCard = cardById(cardId);
  if (!targetCard) {
    showToast('找不到这个关联词。请检查词汇包中的 targetId。');
    return;
  }
  if ($('detailOverlay').hidden) detailHistory = [];
  detailCardId = targetCard.id;
  $('detailTitle').textContent = targetCard.display;
  $('detailSubtitle').textContent = targetCard.partOfSpeech || '词类信息待补充';
  $('detailCore').textContent = targetCard.core || targetCard.meaning || '核心语义待补充';
  $('detailExplanation').textContent = targetCard.explanation || '详细解释尚未添加。';
  $('detailStory').textContent = targetCard.story || '教学内容尚未添加。';
  const usage = $('detailUsage');
  usage.replaceChildren();
  if (!targetCard.usage.length) {
    const note = document.createElement('div'); note.className = 'source-note';
    note.textContent = '尚无经过核对的经典例句。这里不会用自编句子冒充经文。'; usage.append(note);
  } else {
    targetCard.usage.forEach(item => {
      const box = document.createElement('div'); box.className = 'usage-item';
      const pali = document.createElement('p'); pali.className = 'usage-pali'; pali.textContent = item.paliText || item.text || '';
      const translation = document.createElement('p'); translation.className = 'usage-translation'; translation.textContent = item.translation || '';
      const source = document.createElement('p'); source.className = 'usage-source';
      const ref = item.source?.reference || item.source?.collection || '出处待补充';
      source.textContent = `${ref}${item.source?.segmentId ? ` · ${item.source.segmentId}` : ''} · ${item.verificationStatus || '待核验'}`;
      box.append(pali, translation, source); usage.append(box);
    });
  }
  $('relatedWords').replaceChildren(...targetCard.relations.map(rel => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'related-chip';
    chip.textContent = rel.label || rel.targetId;
    chip.title = `${rel.type || '关联'}：${rel.note || ''}`;
    const exists = Boolean(cardById(rel.targetId));
    chip.disabled = !exists;
    chip.setAttribute('aria-label', exists ? `打开关联词 ${chip.textContent}` : `关联词 ${chip.textContent} 尚未导入`);
    if (exists) chip.addEventListener('click', () => {
      detailHistory.push(detailCardId);
      openDetails(rel.targetId);
    });
    return chip;
  }));
  $('detailBackButton').hidden = detailHistory.length === 0;
  $('detailContentStatus').textContent = `内容状态：${targetCard.contentStatus || 'draft'} · 学习状态：${statusFor(targetCard.id)}`;
  $('detailOverlay').hidden = false;
  document.body.style.overflow = 'hidden';
  $('detailScroll').scrollTop = 0;
}
function backToPreviousDetail() {
  const previousId = detailHistory.pop();
  if (previousId) openDetails(previousId);
}
function closeDetails() {
  $('detailOverlay').hidden = true;
  document.body.style.overflow = '';
  detailCardId = null;
  detailHistory = [];
}
async function restartDeck() {
  state.queue = activeCards().map(card => card.id);
  state.history = [];
  await saveAppState();
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
  drag.x = event.clientX; drag.y = event.clientY;
  const dx = drag.x - drag.startX; const dy = drag.y - drag.startY;
  if (Math.abs(dx) > 7 || Math.abs(dy) > 7) drag.moved = true;
  if (!drag.moved) return;
  $('wordCard').style.transform = `translate3d(${dx}px, ${dy * .12}px, 0) rotate(${Math.max(-13, Math.min(13, dx / 18))}deg)`;
  $('knownStamp').style.opacity = String(Math.max(0, Math.min(1, dx / 100)));
  $('unknownStamp').style.opacity = String(Math.max(0, Math.min(1, -dx / 100)));
}
async function endDrag() {
  if (!drag) return;
  const dx = drag.x - drag.startX; const moved = drag.moved; drag = null;
  $('wordCard').classList.remove('dragging');
  if (Math.abs(dx) > 105) {
    $('wordCard').style.transition = 'transform .22s ease, opacity .22s ease';
    $('wordCard').style.transform = `translate3d(${dx > 0 ? 650 : -650}px, 0, 0) rotate(${dx > 0 ? 18 : -18}deg)`;
    $('wordCard').style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 180));
    $('wordCard').style.transition = '';
    await classify(dx > 0 ? 'right' : 'left');
  } else {
    $('wordCard').style.transition = 'transform .2s ease'; $('wordCard').style.transform = '';
    $('knownStamp').style.opacity = '0'; $('unknownStamp').style.opacity = '0';
    setTimeout(() => { $('wordCard').style.transition = ''; }, 210);
    if (!moved) openDetails();
  }
}

function validatePackage(pkg) {
  const errors = [];
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return ['文件最外层必须是 JSON 对象。'];
  if (pkg.schemaVersion !== 1) errors.push('schemaVersion 必须为数字 1。');
  if (!pkg.packageId || typeof pkg.packageId !== 'string') errors.push('缺少 packageId。');
  if (!pkg.packageVersion || typeof pkg.packageVersion !== 'string') errors.push('缺少 packageVersion。');
  if (!Array.isArray(pkg.cards)) errors.push('cards 必须是数组。');
  if (Array.isArray(pkg.cards)) {
    const seen = new Set();
    pkg.cards.forEach((card, index) => {
      const prefix = `cards[${index}]`;
      if (!card || typeof card !== 'object' || Array.isArray(card)) { errors.push(`${prefix} 必须是对象。`); return; }
      if (typeof card.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/.test(card.id)) errors.push(`${prefix}.id 格式不正确（2–80 位，仅字母、数字、点、下划线、连字符）。`);
      else if (seen.has(card.id)) errors.push(`词汇包内出现重复 ID：${card.id}`);
      else seen.add(card.id);
      if (typeof card.headword !== 'string' || !card.headword.trim()) errors.push(`${prefix}.headword 不能为空。`);
      if (card.relations !== undefined && !Array.isArray(card.relations)) errors.push(`${prefix}.relations 必须是数组。`);
      if (card.usage !== undefined && !Array.isArray(card.usage)) errors.push(`${prefix}.usage 必须是数组。`);
      if (card.provenance !== undefined && !Array.isArray(card.provenance)) errors.push(`${prefix}.provenance 必须是数组。`);
    });
  }
  return errors;
}
function downloadJSON(filename, object) {
  const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function downloadTemplate() {
  downloadJSON('pali-content-package-template.json', {
    schemaVersion: 1, packageId: 'my-pali-content', packageVersion: '1.0.0',
    title: '巴利语词汇内容包', language: 'pi', description: '请按 README 中的数据格式填写。',
    cards: []
  });
}
async function importPackageFile(file) {
  const text = await file.text();
  let pkg;
  try { pkg = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON。'); }
  const errors = validatePackage(pkg);
  if (errors.length) throw new Error(errors.slice(0, 8).join('\n'));
  const existingIds = new Set(cards.map(card => card.id));
  const newCount = pkg.cards.filter(card => !existingIds.has(card.id)).length;
  const updateCount = pkg.cards.length - newCount;
  const message = `词汇包：${pkg.title || pkg.packageId}\n版本：${pkg.packageVersion}\n总词数：${pkg.cards.length}\n新增：${newCount}\n更新：${updateCount}\n\n确认导入？\n\n注意：只更新教学内容，不覆盖个人学习记录。`;
  if (!window.confirm(message)) return;
  const normalized = pkg.cards.map(normalizeCard);
  const tx = db.transaction([STORES.content, STORES.meta], 'readwrite');
  const contentStore = tx.objectStore(STORES.content);
  normalized.forEach(card => contentStore.put(card));
  tx.objectStore(STORES.meta).put({ packageId: pkg.packageId, packageVersion: pkg.packageVersion, importedAt: new Date().toISOString(), cardCount: normalized.length }, `package:${pkg.packageId}`);
  await txDone(tx);
  const activeIds = new Set(cards.filter(card => card.active).map(card => card.id));
  state.queue = state.queue.filter(id => activeIds.has(id));
  const priorQueue = new Set(state.queue);
  for (const card of normalized) {
    if (card.active && !priorQueue.has(card.id) && !learning[card.id]) state.queue.push(card.id);
  }
  await saveAppState();
  cards = await getAll(STORES.content);
  renderCard();
  showToast(`导入完成：新增 ${newCount}，更新 ${updateCount}；学习记录已保留`);
}

async function init() {
  try {
    db = await openDB();
    await initializeData();
    renderCard();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch (error) {
    console.error(error); showToast('本地数据库无法启动，请刷新页面');
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
  $('detailKnownButton').addEventListener('click', async () => { const id = detailCardId; closeDetails(); if (id) await classifyCard(id, 'right'); });
  $('detailUnknownButton').addEventListener('click', async () => { const id = detailCardId; closeDetails(); if (id) await classifyCard(id, 'left'); });
  $('detailBackButton').addEventListener('click', backToPreviousDetail);
  $('wordCard').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('detailOverlay').hidden) closeDetails(); });
  $('importButton').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { await importPackageFile(file); }
    catch (error) { alert(`导入失败：\n${error.message}`); }
    finally { event.target.value = ''; }
  });
  $('templateButton').addEventListener('click', downloadTemplate);
}
init();
