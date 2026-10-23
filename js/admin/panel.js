/* ===== Админ-панель: состояние, сохранение в базу, кнопки и формы ===== */

const adminState = {
  tab: 'posts', // открытая вкладка
  postSection: 'all', // фильтр постов по разделу
  draft: null, // пост или опрос (isPoll) в редакторе
  eventDraft: null, // событие в редакторе
  message: '', // сообщение под вкладками
  careFilter: 'new', // какие обращения в Службу заботы показывать
  eventCategory: 'all', // фильтр событий по типу
};

function adminPage() {
  return '<div id="admin-panel"></div>';
}

/** Строка заголовка панели; справа — кнопка «Выйти», когда админ вошёл. */
function adminHeaderHTML(withLogout) {
  const account = withLogout
    ? '<div class="admin-account"><span class="small-print">Вы вошли как администратор</span><button type="button" data-action="logout">Выйти</button></div>'
    : '';
  return `<div class="admin-top"><h1 class="page-title">Админ-панель</h1>${account}</div>`;
}

function loginFormHTML() {
  return `<form class="login-form form" data-admin-form="login">
      <p>Вход для администраторов сайта.</p>
      <label class="field-label" for="login-email">Почта</label>
      <input id="login-email" type="email" autocomplete="username" required>
      <label class="field-label" for="login-password">Пароль</label>
      <input id="login-password" type="password" autocomplete="current-password" required>
      <div class="form-status" id="login-error" role="alert"></div>
      <button class="btn" type="submit">Войти</button>
    </form>`;
}

const ADMIN_TAB_RENDERERS = {
  posts: postsTabHTML,
  photos: photosTabHTML,
  thanks: thanksTabHTML,
  care: careTabHTML,
  calendar: calendarTabHTML,
  texts: textsTabHTML,
  polls: pollsTabHTML,
  quote: quoteTabHTML,
  links: linksTabHTML,
};

/** Рисует панель: проверку доступа, форму входа или вкладки. */
function renderAdmin() {
  const panel = $('#admin-panel');
  if (!panel) return;
  if (isAdmin === null) {
    panel.innerHTML = adminHeaderHTML(false) + '<p class="empty">Проверяем доступ…</p>';
    return;
  }
  if (!isLoggedIn) {
    if (!panel.querySelector('.login-form')) panel.innerHTML = adminHeaderHTML(false) + loginFormHTML();
    return;
  }
  const notAdminWarning = isAdmin
    ? ''
    : `<div class="warning">Вход выполнен, но этой учётной записи нет в списке администраторов: изменения не сохранятся. Добавьте в Firestore документ admins/${escapeHtml(userId || '')}.</div>`;
  panel.innerHTML =
    adminHeaderHTML(true) +
    notAdminWarning +
    adminTabsHTML() +
    ADMIN_TAB_RENDERERS[adminState.tab]();
}

/** Пользователь печатает в поле админки — тогда панель не перерисовываем, чтобы не сбить ввод. */
function isTypingInAdmin() {
  const active = document.activeElement;
  return !!(active?.closest?.('#admin-panel') && /INPUT|TEXTAREA|SELECT/.test(active.tagName));
}

let flashTimer = null;

/** Сообщение под вкладками; через 3,5 секунды исчезает. */
function flashMessage(message) {
  adminState.message = message;
  const flash = $('#admin-flash');
  if (flash) flash.textContent = message;
  if (!adminState.draft && !isTypingInAdmin()) renderAdmin();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    adminState.message = '';
    const line = $('#admin-flash');
    if (line) line.textContent = '';
  }, 3500);
}

/* ----- Сохранение в базу ----- */

/** Записывает документ поста целиком: прежние поля плюс новые. */
async function savePostDoc(key, fields) {
  const doc = { ...((store.posts || {})[key] || {}), ...fields };
  delete doc.id;
  await db.collection('posts').doc(key).set(doc);
}

async function createPostDoc(fields) {
  const id = 'p' + Date.now().toString(36);
  await db
    .collection('posts')
    .doc(id)
    .set({ ...fields, custom: true, ts: Date.now() });
}

/** Убирает поле из правки встроенного поста; если в правке больше ничего нет, удаляет её. */
async function removePostField(key, field) {
  const doc = { ...((store.posts || {})[key] || {}) };
  delete doc.id;
  delete doc[field];
  if (Object.keys(doc).some(name => name !== 'section')) await db.collection('posts').doc(key).set(doc);
  else await db.collection('posts').doc(key).delete();
}

async function saveEventDoc(docId, fields) {
  const doc = { ...((store.events || {})[docId] || {}) };
  delete doc.id;
  await db
    .collection('events')
    .doc(docId)
    .set({ ...doc, ...fields });
}

/** Кладёт фото в коллекцию photos и возвращает ссылку на него для поста («ph:<id>»). */
async function uploadPhoto(dataUrl) {
  const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  store.photos = store.photos || {};
  store.photos[id] = { d: dataUrl };
  await db.collection('photos').doc(id).set({ d: dataUrl, ts: Date.now() });
  return 'ph:' + id;
}

/* ----- Входящие: обращения в Службу заботы и благодарности на модерации ----- */

const inboxItems = () => store.inbox || [];
const inboxKind = item => item.kind || 'care';
const inboxStatus = item => item.status || 'new';
const newThanksCount = () =>
  inboxItems().filter(item => inboxKind(item) === 'thanks' && inboxStatus(item) === 'new').length;
const newCareCount = () =>
  inboxItems().filter(item => inboxKind(item) === 'care' && inboxStatus(item) === 'new').length;

/* Обращения сотрудника лежат в care/<uid>/items/<id> */
const inboxItemsOf = uid => db.collection('care').doc(uid).collection('items');

/** Загружает входящие всех сотрудников, новые сверху. Только для админа. */
async function loadInbox() {
  if (!db || !isAdmin) return;
  try {
    const users = await db.collection('care').get();
    const items = [];
    for (const user of users.docs) {
      const userItems = await inboxItemsOf(user.id).get();
      userItems.docs.forEach(doc => items.push({ ...doc.data(), id: doc.id, uid: user.id }));
    }
    items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    store.inbox = items;
    if ($('#admin-panel') && !adminState.draft && !isTypingInAdmin()) renderAdmin();
  } catch (error) {
    /* нет доступа или сети — оставляем прежний список */
  }
}

/* ----- Кнопки с data-action: имя действия → обработчик(параметры кнопки из data-атрибутов) ----- */

const ADMIN_ACTIONS = {
  /* посты */
  'post-new': () => {
    const section = ['all', 'surveys'].includes(adminState.postSection) ? 'charity' : adminState.postSection;
    adminState.draft = {
      key: null,
      section: 'charity',
      sections: [section],
      title: '',
      description: '',
      body: '',
      photos: [],
      files: [],
      removedFiles: [],
      focusX: null,
      focusY: null,
      hidden: false,
    };
    renderAdmin();
  },
  'post-edit': ({ key }) => {
    const row = adminPostRows().find(item => item.key === key);
    adminState.draft = {
      key,
      section: row.section,
      sections: row.shownIn.slice(),
      originalSection: row.custom ? null : row.section, // встроенный пост всегда остаётся в своём разделе
      isCustom: row.custom,
      title: row.t,
      description: row.d || '',
      body: row.body || '',
      photos: [row.img, ...(row.imgs || [])].filter(Boolean),
      files: (row.files || []).slice(),
      removedFiles: [],
      focusX: row.fx ?? null,
      focusY: row.fy ?? null,
      hidden: !!row.hidden,
    };
    renderAdmin();
  },
  'post-toggle': async ({ key, section }) => {
    const post = postsInSection(section).find(item => item.key === key);
    await savePostDoc(key, { section, hidden: !post.hidden });
    flashMessage(post.hidden ? 'Показано на сайте' : 'Скрыто с сайта');
  },
  'post-delete': async ({ key }) => {
    await db.collection('posts').doc(key).delete();
    flashMessage('Удалено');
  },
  'post-reset': async ({ key }) => {
    await db.collection('posts').doc(key).delete();
    flashMessage('Возвращён исходный вариант');
  },
  'draft-cancel': () => {
    adminState.draft = null;
    renderAdmin();
  },

  /* фото и файлы в редакторе поста */
  'photo-crop': ({ index }) => {
    const position = Number(index);
    const url = imageUrl(adminState.draft.photos[position]);
    if (!url) return;
    openCropDialog(url, defaultAspectRatio(adminState.draft.section), async dataUrl => {
      try {
        adminState.draft.photos[position] = await uploadPhoto(dataUrl);
        repaintPhotoEditor();
      } catch (error) {
        flashMessage('Не удалось сохранить фото.');
      }
    });
  },
  'photo-remove': ({ index }) => {
    adminState.draft.photos.splice(Number(index), 1);
    repaintPhotoEditor();
  },
  'photo-left': ({ index }) => movePhoto(Number(index), -1),
  'photo-right': ({ index }) => movePhoto(Number(index), 1),
  'focus-reset': () => {
    adminState.draft.focusX = null;
    adminState.draft.focusY = null;
    repaintFocusPicker();
    repaintPreview();
  },
  'file-remove': ({ index }) => {
    const [removed] = adminState.draft.files.splice(Number(index), 1);
    if (removed) adminState.draft.removedFiles.push(removed); // удалим из базы при сохранении поста
    repaintEditorFiles();
  },

  /* обложки на вкладке «Фотографии» */
  'cover-crop': ({ key, section }) => {
    const doc = (store.posts || {})[key];
    const url = imageUrl(
      (doc && doc.img) || (postsInSection(section).find(item => item.key === key) || {}).img,
    );
    if (!url) return;
    openCropDialog(url, defaultAspectRatio(section), async dataUrl => {
      try {
        await savePostDoc(key, { section, img: dataUrl });
        flashMessage('Фото подрезано');
      } catch (error) {
        flashMessage('Не удалось сохранить.');
      }
    });
  },
  'cover-remove': async ({ key, section }) => {
    await savePostDoc(key, { section, img: '' });
    flashMessage('Фото убрано');
  },
  'cover-reset': async ({ key }) => {
    await removePostField(key, 'img');
    await removePostField(key, 'imgs');
    flashMessage('Возвращено исходное фото');
  },

  /* опросы */
  'poll-new': () => {
    adminState.draft = { isPoll: true, key: null, title: '', description: '', url: '', status: 'Открыт' };
    renderAdmin();
  },
  'poll-edit': ({ key }) => {
    const poll = postsInSection('surveys').find(item => item.key === key);
    adminState.draft = {
      isPoll: true,
      key,
      title: poll.t,
      description: poll.d || '',
      url: poll.url || '',
      status: poll.tag || 'Открыт',
    };
    renderAdmin();
  },

  /* события */
  'event-new': () => {
    adminState.eventDraft = {
      id: null,
      title: '',
      date: '',
      end: '',
      category: 'corp',
      time: '',
      place: '',
      description: '',
      scopes: ['plan', 'home'],
      planned: false,
    };
    renderAdmin();
  },
  'event-edit': ({ id }) => {
    const event = allEvents().find(item => item.id === id);
    adminState.eventDraft = {
      id,
      isCustom: !!event.custom,
      title: event.t,
      date: event.date,
      end: event.end || '',
      category: event.cat,
      time: event.time || '',
      place: event.place || '',
      description: event.d || '',
      scopes: (event.sc || []).slice(),
      planned: !!event.soft,
    };
    renderAdmin();
  },
  'event-cancel': () => {
    adminState.eventDraft = null;
    renderAdmin();
  },
  'event-toggle': async ({ id }) => {
    const event = allEvents().find(item => item.id === id);
    await saveEventDoc(event.custom ? id : 'ev__' + id, { hidden: !event.hidden });
    flashMessage(event.hidden ? 'Событие показано' : 'Событие скрыто');
  },
  'event-delete': async ({ id }) => {
    await db.collection('events').doc(id).delete();
    flashMessage('Событие удалено');
  },
  'event-reset': async ({ id }) => {
    await db
      .collection('events')
      .doc('ev__' + id)
      .delete();
    flashMessage('Возвращено исходное событие');
  },

  /* благодарности и Служба заботы */
  'thanks-approve': params => moderateThanks(params, true),
  'thanks-reject': params => moderateThanks(params, false),
  'thanks-unpublish': async ({ id }) => {
    await db.collection('thanks').doc(id).delete();
    flashMessage('Снято с публикации');
  },
  'care-status': async ({ uid, id, status }) => {
    await inboxItemsOf(uid).doc(id).update({ status });
    await loadInbox();
    flashMessage(status === 'done' ? 'Отмечено обработанным' : 'Возвращено в новые');
  },
  'inbox-reload': async () => {
    await loadInbox();
    flashMessage('Обновлено');
  },

  /* цитата, тексты, режим правки, выход */
  'quote-reset': async () => {
    await db.collection('settings').doc('quote').delete();
    flashMessage('Возвращена исходная цитата');
  },
  'text-reset': async ({ index }) => {
    const pair = (store.texts || [])[Number(index)];
    if (pair) await saveTextReplacement(pair[0], '');
    renderAdmin();
  },
  'edit-mode': () => {
    setEditMode(true);
    location.hash = '#home';
  },
  logout: async () => {
    setEditMode(false);
    isLoggedIn = false;
    isAdmin = false;
    adminState.draft = null;
    location.hash = '#home';
    await auth.signOut();
  },
};

function repaintPhotoEditor() {
  repaintEditorPhotos();
  repaintFocusPicker();
  repaintPreview();
}

/** Меняет фото местами с соседним (step = -1 или 1); первое фото — обложка. */
function movePhoto(index, step) {
  const photos = adminState.draft.photos;
  const target = index + step;
  if (target < 0 || target >= photos.length) return;
  [photos[index], photos[target]] = [photos[target], photos[index]];
  repaintPhotoEditor();
}

/** Публикует записку (текст можно было поправить в поле) или отклоняет её. */
async function moderateThanks({ uid, id }, approve) {
  const item = inboxItems().find(entry => entry.id === id);
  const textarea = document.getElementById('thanks-edit-' + id);
  const text = (textarea ? textarea.value : item.text).trim();
  if (approve) await db.collection('thanks').add({ text, name: item.name || '', ts: Date.now(), src: id });
  await inboxItemsOf(uid)
    .doc(id)
    .update({ status: approve ? 'approved' : 'rejected' });
  await loadInbox();
  flashMessage(approve ? 'Записка опубликована' : 'Записка отклонена');
}

async function runAdminAction(button) {
  if (!db) return;
  const action = ADMIN_ACTIONS[button.dataset.action];
  if (!action) return;
  try {
    await action(button.dataset);
  } catch (error) {
    flashMessage('Не удалось сохранить. Проверьте доступ и попробуйте ещё раз.');
  }
}

/* Клик по фото «Точки фокуса» задаёт точку фокуса обложки в процентах */
onClick('.focus-picker', (picker, event) => {
  if (!adminState.draft) return;
  const box = picker.getBoundingClientRect();
  const percent = (offset, size) => Math.round(Math.min(100, Math.max(0, (offset / size) * 100)));
  adminState.draft.focusX = percent(event.clientX - box.left, box.width);
  adminState.draft.focusY = percent(event.clientY - box.top, box.height);
  repaintFocusPicker();
  repaintPreview();
});

/* Превью поста обновляется при вводе текста и при выборе разделов */
document.addEventListener('input', event => {
  if (event.target.closest?.('[data-admin-form="post"]') && adminState.draft) repaintPreview();
});
document.addEventListener('change', event => {
  if (event.target.closest?.('#post-sections') && adminState.draft) {
    adminState.draft.sections = selectedSections();
    repaintPreview();
  }
});

onClick('[data-admin-tab]', button => {
  adminState.tab = button.dataset.adminTab;
  adminState.draft = null;
  adminState.eventDraft = null;
  renderAdmin();
});
onClick('[data-post-section]', button => {
  adminState.postSection = button.dataset.postSection;
  renderAdmin();
});
onClick('[data-event-category]', button => {
  adminState.eventCategory = button.dataset.eventCategory;
  renderAdmin();
});
onClick('[data-care-filter]', button => {
  adminState.careFilter = button.dataset.careFilter;
  renderAdmin();
});
onClick('[data-action]', runAdminAction);

/* ----- Загрузка файлов: вложения к посту, фото поста, замена обложки ----- */

document.addEventListener('change', async event => {
  const input = event.target;
  if (!input.matches?.('input[type=file]')) return;
  if (!input.files || !input.files[0]) return;
  if (input.id === 'post-file-input') {
    await attachFiles(input);
    return;
  }
  try {
    if (input.id === 'post-photo-input') {
      for (const photo of [...input.files]) {
        const dataUrl = await resizeImageFile(photo, 1000);
        adminState.draft.photos.push(await uploadPhoto(dataUrl));
        repaintPhotoEditor();
      }
      input.value = '';
      return;
    }
    const dataUrl = await readFileAsDataUrl(input.files[0]);
    input.value = '';
    if (input.dataset.replacePhoto === undefined) return;
    const { key, section } = input.dataset;
    openCropDialog(dataUrl, defaultAspectRatio(section), async cropped => {
      try {
        await savePostDoc(key, { section, img: cropped });
        flashMessage('Фото заменено');
      } catch (error) {
        flashMessage('Не удалось сохранить.');
      }
    });
  } catch (error) {
    flashMessage('Не удалось загрузить фото. Попробуйте другой файл.');
  }
});

/** Прикрепляет выбранные файлы к посту в редакторе (каждый загружается в базу сразу). */
async function attachFiles(input) {
  const files = [...input.files];
  input.value = '';
  if (!db) {
    flashMessage('Нет связи с базой данных');
    return;
  }
  for (const file of files) {
    try {
      flashMessage('Загружаем «' + file.name + '»…');
      adminState.draft.files.push(await uploadFile(file));
      repaintEditorFiles();
      flashMessage('Файл прикреплён: ' + file.name);
    } catch (error) {
      const reason = String(error?.message || '');
      if (reason.startsWith('ext:'))
        flashMessage('Формат .' + reason.slice(4) + ' не подходит для скачивания. Упакуйте файл в zip.');
      else if (reason === 'size') flashMessage('Файл больше 8 МБ.');
      else flashMessage('Не удалось загрузить файл.');
    }
  }
}

/* ----- Формы панели: вход, замена текста и сохранение черновиков ----- */

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-admin-form]');
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.adminForm;
  if (kind === 'login') return submitLogin();
  if (kind === 'text') return submitTextReplacement();
  if (!db) return;
  try {
    await ADMIN_FORM_SAVERS[kind]?.();
  } catch (error) {
    flashMessage('Не удалось сохранить. Проверьте доступ и попробуйте ещё раз.');
  }
});

async function submitLogin() {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errorText = $('#login-error');
  if (!auth) {
    errorText.textContent = 'Вход недоступен: база не подключена.';
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    errorText.textContent =
      error && error.code === 'auth/too-many-requests'
        ? 'Слишком много попыток. Попробуйте позже.'
        : 'Неверная почта или пароль.';
    $('#login-password').value = '';
  }
}

async function submitTextReplacement() {
  const original = normalizeText($('#text-original').value);
  const replacement = normalizeText($('#text-new').value);
  if (!original || !replacement) return;
  await saveTextReplacement(original, replacement);
  $('#text-original').value = '';
  $('#text-new').value = '';
  renderAdmin();
}

const ADMIN_FORM_SAVERS = {
  post: savePostDraft,
  event: saveEventDraft,
  links: saveLinks,
  quote: saveQuote,
  poll: savePollDraft,
};

const fieldValue = id => document.getElementById(id).value;

async function savePostDraft() {
  const draft = adminState.draft;
  const photos = draft.photos || [];
  const fields = {
    t: fieldValue('post-title').trim(),
    d: fieldValue('post-description').trim(),
    body: fieldValue('post-body').trim(),
    img: photos[0] || '',
    imgs: photos.slice(1),
    hidden: !document.getElementById('post-published').checked,
    files: draft.files || [],
  };
  if (!fields.t) return;
  const sections = selectedSections();
  if (!sections.length) {
    flashMessage('Выберите хотя бы один раздел');
    return;
  }
  fields.fx = draft.focusX ?? null;
  fields.fy = draft.focusY ?? null;
  if (!draft.key) {
    await createPostDoc({ section: sections[0], sections, ...fields });
  } else if (draft.isCustom) {
    await savePostDoc(draft.key, { section: sections[0], sections, ...fields });
  } else {
    // встроенный пост живёт в своём разделе, а в остальных выбранных показывается через also
    const also = sections.filter(section => section !== draft.originalSection);
    await savePostDoc(draft.key, { section: draft.originalSection, also, ...fields });
  }
  for (const file of draft.removedFiles || []) await deleteUploadedFile(file);
  adminState.draft = null;
  flashMessage('Сохранено. Пост уже на сайте.');
}

async function saveEventDraft() {
  const draft = adminState.eventDraft;
  const scopes = [...document.querySelectorAll('#event-scopes input:checked')].map(input => input.value);
  if (!fieldValue('event-title').trim() || !fieldValue('event-start')) return;
  if (!scopes.length) {
    flashMessage('Выберите хотя бы один календарь');
    return;
  }
  let end = fieldValue('event-end');
  if (end && end <= fieldValue('event-start')) end = ''; // конец не раньше начала
  const fields = {
    t: fieldValue('event-title').trim(),
    cat: fieldValue('event-category'),
    date: fieldValue('event-start'),
    end,
    time: fieldValue('event-time').trim(),
    place: fieldValue('event-place').trim(),
    d: fieldValue('event-description').trim() || 'Подробности появятся ближе к дате.',
    sc: scopes,
    soft: document.getElementById('event-planned').checked,
  };
  if (draft.id) {
    await saveEventDoc(draft.isCustom ? draft.id : 'ev__' + draft.id, fields);
  } else {
    await db
      .collection('events')
      .doc('ec' + Date.now().toString(36))
      .set({ custom: true, ts: Date.now(), ...fields });
  }
  adminState.eventDraft = null;
  flashMessage('Событие сохранено');
}

async function saveLinks() {
  const mail = fieldValue('link-mail').trim();
  const knowledgeBase = fieldValue('link-kb').trim();
  const isValid = url => !url || /^https?:\/\//.test(url);
  if (!isValid(mail) || !isValid(knowledgeBase)) {
    flashMessage('Адрес должен начинаться с https://');
    return;
  }
  await db.collection('settings').doc('links').set({ mail, kb: knowledgeBase });
  flashMessage('Ссылки сохранены');
}

async function saveQuote() {
  const paragraphs = fieldValue('quote-text-input')
    .trim()
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  if (!paragraphs.length) return;
  await db
    .collection('settings')
    .doc('quote')
    .set({
      label: fieldValue('quote-label-input').trim() || 'Еженедельная цитата',
      p: paragraphs,
      by: fieldValue('quote-author-input').trim(),
    });
  flashMessage('Цитата обновлена на главной');
}

async function savePollDraft() {
  const draft = adminState.draft;
  const url = fieldValue('poll-url').trim();
  if (url && !/^https?:\/\//i.test(url)) {
    flashMessage('Ссылка должна начинаться с https://');
    return;
  }
  const fields = {
    t: fieldValue('poll-title').trim(),
    d: fieldValue('poll-description').trim(),
    url,
    tag: fieldValue('poll-status'),
  };
  if (!fields.t) return;
  if (draft.key) await savePostDoc(draft.key, { section: 'surveys', ...fields });
  else await createPostDoc({ section: 'surveys', ...fields });
  adminState.draft = null;
  flashMessage('Опрос сохранён');
}
