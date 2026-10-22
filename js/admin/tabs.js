/* ===== Админ-панель: разметка вкладок ===== */

const ADMIN_TABS = [
  ['posts', 'Посты'],
  ['photos', 'Фотографии'],
  ['thanks', 'Благодарности'],
  ['care', 'Служба заботы'],
  ['calendar', 'Календарь'],
  ['texts', 'Тексты сайта'],
  ['polls', 'Опросы'],
  ['quote', 'Цитата недели'],
  ['links', 'Ссылки'],
];

/* Календари, в которых можно показать событие (ключи хранятся в базе) */
const CALENDAR_SCOPES = [
  ['home', 'Главная'],
  ['plan', 'План коммуникаций'],
  ['charity', 'Благотворительность'],
  ['sport', 'Спорт VR'],
  ['learn', 'Обучение'],
];

/** Кнопки вкладок (с числом новых записок и обращений) и строка сообщений под ними. */
function adminTabsHTML() {
  const newCounts = { thanks: newThanksCount(), care: newCareCount() };
  const tabs = ADMIN_TABS.map(([id, label]) => {
    const count = newCounts[id] ? `<b>${newCounts[id]}</b>` : '';
    return `<button role="tab" data-admin-tab="${id}" aria-pressed="${adminState.tab === id}">${label}${count}</button>`;
  });
  return `<div class="admin-tabs" role="tablist">${tabs.join('')}</div>
    <div id="admin-flash" class="admin-flash" role="status">${escapeHtml(adminState.message)}</div>`;
}

const formatDateTime = timestamp =>
  timestamp
    ? new Date(timestamp).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/* ----- Посты и фото ----- */

/**
 * Строки списка постов: каждый пост один раз; shownIn — разделы, где он показан,
 * включая разделы, куда встроенный пост добавлен через also.
 */
function adminPostRows() {
  const rowsByKey = {};
  const rows = [];
  const sections = [...POST_SECTIONS.map(([id]) => id), 'surveys'];
  sections.forEach(section =>
    postsInSection(section).forEach(post => {
      if (post.shared) return;
      const row = rowsByKey[post.key];
      if (!row) {
        rowsByKey[post.key] = { ...post, shownIn: [section] };
        rows.push(rowsByKey[post.key]);
      } else if (!row.shownIn.includes(section)) {
        row.shownIn.push(section);
      }
    }),
  );
  sections.forEach(section =>
    postsInSection(section).forEach(post => {
      const row = rowsByKey[post.key];
      if (post.shared && row && !row.shownIn.includes(section)) row.shownIn.push(section);
    }),
  );
  return rows;
}

const sectionsLabel = row => row.shownIn.map(section => SECTION_TITLES[section]).join(' · ');

/** Миниатюра обложки в списке постов (или пустой квадрат, если фото нет). */
function thumbnailHTML(post) {
  if (!imageUrl(post.img)) return '<div class="thumb"></div>';
  return pictureHTML(post.img, post.t).replace('class="pic"', 'class="thumb"');
}

/** Разделы, отмеченные в редакторе поста; если не отмечено ни одного — как было в черновике. */
function selectedSections() {
  const checked = [...document.querySelectorAll('#post-sections input:checked')].map(input => input.value);
  return checked.length ? checked : adminState.draft.sections || [];
}

function previewImageHTML(ref, focusX, focusY) {
  const url = imageUrl(ref);
  if (!url) return '<div class="placeholder pic"></div>';
  const focus = focusX != null ? `style="object-position:${focusX}% ${focusY}%"` : '';
  return `<img class="pic" src="${escapeHtml(url)}" alt="" ${focus}>`;
}

/** Как пост будет выглядеть на сайте: в «Главной теме», карточкой в разделах и на своей странице. */
function postPreviewHTML() {
  const draft = adminState.draft;
  const inputValue = id => document.getElementById(id)?.value || '';
  const title = inputValue('post-title') || draft.title || 'Заголовок новости';
  const description = inputValue('post-description') || draft.description || '';
  const sections = selectedSections();
  const cover = previewImageHTML((draft.photos || [])[0], draft.focusX, draft.focusY);
  const previews = [];
  if (sections.includes('hero')) {
    previews.push(`<div class="preview">
        <span class="preview-label">Главная тема</span>
        <div class="preview-hero">${cover}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><span class="btn">Читать</span></div>
      </div>`);
  }
  const cardSections = sections.filter(section => section !== 'hero');
  if (cardSections.length) {
    const where = cardSections.map(section => SECTION_TITLES[section]).join(', ');
    previews.push(`<div class="preview">
        <span class="preview-label">Карточка · ${where}</span>
        <div class="card preview-card">${cover}<div class="card-body"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><span class="more-link">Подробнее →</span></div></div>
      </div>`);
  }
  const album = albumHTML(draft.photos || [], title) || '<p class="small-print">Фото не добавлены.</p>';
  previews.push(`<div class="preview preview-wide">
      <span class="preview-label">Страница новости</span>
      <div class="preview-page"><h3>${escapeHtml(title)}</h3>${album}</div>
    </div>`);
  return previews.join('');
}

/** Выбор точки фокуса обложки: клик по фото ставит отметку. */
function focusPickerHTML() {
  const draft = adminState.draft;
  const url = imageUrl((draft.photos || [])[0]);
  if (!url) return '<p class="small-print">Добавьте фото, чтобы выбрать точку фокуса.</p>';
  return `<div class="focus-picker"><img src="${escapeHtml(url)}" alt=""><i style="left:${draft.focusX ?? 50}%;top:${draft.focusY ?? 50}%"></i></div>
    <p class="small-print">Нажмите на главное в кадре. Когда обложка обрезается под карточку или «Главную тему», эта часть останется на виду.</p>
    <div class="admin-actions" style="justify-content:flex-start"><button type="button" data-action="focus-reset">Сбросить</button></div>`;
}

/** Фото поста в редакторе: подрезка, удаление и порядок (первое — обложка). */
function editorPhotosHTML() {
  const photos = adminState.draft.photos || [];
  if (!photos.length) return '<p class="small-print">Фото пока нет.</p>';
  return photos
    .map((ref, index) => {
      const url = imageUrl(ref);
      return `<div class="photo-item">
        ${url ? `<img src="${escapeHtml(url)}" alt="">` : '<div class="thumb"></div>'}
        <small>${index ? 'Фото ' + (index + 1) : 'Обложка'}</small>
        <div class="admin-actions">
          <button type="button" data-action="photo-crop" data-index="${index}">Подрезать</button>
          <button type="button" data-action="photo-remove" data-index="${index}">Убрать</button>
          <button type="button" data-action="photo-left" data-index="${index}" ${index ? '' : 'disabled'}>←</button>
          <button type="button" data-action="photo-right" data-index="${index}" ${index < photos.length - 1 ? '' : 'disabled'}>→</button>
        </div>
      </div>`;
    })
    .join('');
}

function editorFilesHTML() {
  const files = adminState.draft.files || [];
  if (!files.length) return '<p class="admin-hint">Файлов нет.</p>';
  return files
    .map(
      (file, index) => `<div class="file-row">
        <div><b>${escapeHtml(file.name)}</b><small>${formatFileSize(file.size || 0)}</small></div>
        <button type="button" data-action="file-remove" data-index="${index}">Убрать</button>
      </div>`,
    )
    .join('');
}

/* Части редактора, которые перерисовываются без перерисовки всей формы */
const repaintPart = (selector, html) => {
  const element = $(selector);
  if (element) element.innerHTML = html();
};
const repaintPreview = () => repaintPart('#post-preview', postPreviewHTML);
const repaintFocusPicker = () => repaintPart('#post-focus', focusPickerHTML);
const repaintEditorPhotos = () => repaintPart('#post-photos', editorPhotosHTML);
const repaintEditorFiles = () => repaintPart('#post-files', editorFilesHTML);

function postEditorHTML() {
  const draft = adminState.draft;
  const sectionBoxes = POST_SECTIONS.map(([id, title]) => {
    const checked = draft.sections.includes(id) ? 'checked' : '';
    const disabled = draft.originalSection === id ? 'disabled' : ''; // родной раздел встроенного поста не снять
    return `<label class="checkbox"><input type="checkbox" value="${id}" ${checked} ${disabled}> ${title}</label>`;
  }).join('');
  return `<form class="admin-form form" data-admin-form="post">
      <h3>${draft.key ? 'Редактирование' : 'Новый пост'}</h3>
      <div class="field-label">Где показать (можно выбрать несколько разделов)</div>
      <div id="post-sections" class="checkbox-grid">${sectionBoxes}</div>
      <label class="field-label" for="post-title">Заголовок</label>
      <input id="post-title" type="text" maxlength="140" required value="${escapeHtml(draft.title || '')}">
      <label class="field-label" for="post-description">Короткий текст (на карточке)</label>
      <textarea id="post-description" rows="2" maxlength="300">${escapeHtml(draft.description || '')}</textarea>
      <label class="field-label" for="post-body">Полный текст (на странице поста)</label>
      <textarea id="post-body" rows="6" maxlength="6000">${escapeHtml(draft.body || '')}</textarea>
      <div class="field-label">Фото — первое станет обложкой карточки</div>
      <div id="post-photos" class="photo-list">${editorPhotosHTML()}</div>
      <div class="admin-actions" style="justify-content:flex-start"><label class="upload-button">+ Добавить фото<input type="file" accept="image/*" multiple id="post-photo-input" hidden></label></div>
      <div class="field-label">Файлы к посту (скачиваются со страницы поста)</div>
      <div id="post-files" class="file-list">${editorFilesHTML()}</div>
      <div class="admin-actions" style="justify-content:flex-start"><label class="upload-button">+ Прикрепить файл<input type="file" multiple id="post-file-input" hidden></label></div>
      <p class="admin-hint">Форматы: pdf, docx, xlsx, pptx, zip, csv, txt, изображения, видео mp4/webm и др. Размер до 8 МБ. Другие форматы (doc, xls, rar) сначала упакуйте в zip.</p>
      <div class="field-label">Точка фокуса обложки</div>
      <div id="post-focus">${focusPickerHTML()}</div>
      <div class="field-label">Как это будет выглядеть на сайте</div>
      <div id="post-preview" class="previews">${postPreviewHTML()}</div>
      <label class="checkbox"><input type="checkbox" id="post-published" ${draft.hidden ? '' : 'checked'}> Показывать на сайте</label>
      <div class="admin-actions" style="justify-content:flex-start"><button class="btn" type="submit">Сохранить</button><button type="button" data-action="draft-cancel">Отмена</button></div>
    </form>`;
}

function postsTabHTML() {
  const filter = adminState.postSection;
  const rows = adminPostRows().filter(
    row => row.section !== 'surveys' && (filter === 'all' || row.shownIn.includes(filter)),
  );
  const sectionChips = POST_SECTIONS.map(
    ([id, title]) => `<button data-post-section="${id}" aria-pressed="${filter === id}">${title}</button>`,
  ).join('');
  const rowHTML = row => {
    const status =
      (row.custom ? ' · новый пост' : row.edited ? ' · изменён' : '') + (row.hidden ? ' · скрыт' : '');
    let extraButton = '';
    if (row.custom) extraButton = `<button data-action="post-delete" data-key="${row.key}">Удалить</button>`;
    else if (row.edited)
      extraButton = `<button data-action="post-reset" data-key="${row.key}">Вернуть исходный</button>`;
    return `<div class="admin-row">
        ${thumbnailHTML(row)}
        <div><h3>${escapeHtml(row.t)}</h3><small>${sectionsLabel(row)}${status}</small></div>
        <div class="admin-actions">
          <button data-action="post-edit" data-key="${row.key}">Изменить</button>
          <button data-action="post-toggle" data-key="${row.key}" data-section="${row.section}">${row.hidden ? 'Показать' : 'Скрыть'}</button>
          ${extraButton}
        </div>
      </div>`;
  };
  return `<p class="admin-hint">Посты показываются на главной странице в выбранном разделе. Новые посты появляются первыми. Встроенные карточки можно изменить или скрыть.</p>
    <div class="filter-bar">
      <div class="chips"><button data-post-section="all" aria-pressed="${filter === 'all'}">Все разделы</button>${sectionChips}</div>
      <button class="btn" data-action="post-new">+ Новый пост</button>
    </div>
    ${adminState.draft ? postEditorHTML() : ''}
    <div>${rows.map(rowHTML).join('')}</div>`;
}

function photosTabHTML() {
  const rows = adminPostRows().filter(row => row.section !== 'surveys');
  const cardHTML = row => {
    const picture = imageUrl(row.img) ? pictureHTML(row.img, row.t) : '<div class="placeholder pic"></div>';
    const target = `data-key="${row.key}" data-section="${row.section}"`;
    const coverButtons = row.img
      ? `<button data-action="cover-crop" ${target}>Подрезать</button><button data-action="cover-remove" ${target}>Убрать</button>`
      : '';
    const resetButton =
      row.edited && !row.custom
        ? `<button data-action="cover-reset" data-key="${row.key}">Исходное</button>`
        : '';
    return `<div class="photo-card">
        ${picture}
        <div><b>${escapeHtml(row.t)}</b><small>${sectionsLabel(row)}</small></div>
        <div class="admin-actions" style="justify-content:flex-start"><label class="upload-button">Заменить фото<input type="file" accept="image/*" hidden data-replace-photo ${target}></label>${coverButtons}${resetButton}</div>
      </div>`;
  };
  return `<p class="admin-hint">Загрузите новое фото или нажмите «Подрезать»: перетащите кадр и выберите масштаб. Фото автоматически уменьшается для быстрой загрузки.</p>
    <div class="photo-grid">${rows.map(cardHTML).join('')}</div>`;
}

/* ----- Календарь ----- */

function eventDatesLabel(event) {
  const start = parseIsoDate(event.date);
  const end = event.end && event.end !== event.date ? parseIsoDate(event.end) : null;
  const format = date => `${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]}`;
  return format(start) + (end ? ' – ' + format(end) : '');
}

function eventFormHTML() {
  const draft = adminState.eventDraft;
  const categoryOptions = Object.entries(EVENT_CATEGORIES)
    .map(
      ([id, category]) =>
        `<option value="${id}" ${draft.category === id ? 'selected' : ''}>${category.label}</option>`,
    )
    .join('');
  const scopeBoxes = CALENDAR_SCOPES.map(
    ([id, title]) =>
      `<label class="checkbox"><input type="checkbox" value="${id}" ${(draft.scopes || []).includes(id) ? 'checked' : ''}> ${title}</label>`,
  ).join('');
  return `<form class="admin-form form" data-admin-form="event">
      <h3>${draft.id ? 'Редактирование события' : 'Новое событие'}</h3>
      <label class="field-label" for="event-title">Название</label>
      <input id="event-title" type="text" maxlength="160" required value="${escapeHtml(draft.title)}">
      <label class="field-label" for="event-category">Тип события</label>
      <select id="event-category">${categoryOptions}</select>
      <div class="field-pair">
        <div><label class="field-label" for="event-start">Дата начала</label><input id="event-start" type="date" required value="${escapeHtml(draft.date)}"></div>
        <div><label class="field-label" for="event-end">Дата окончания (если несколько дней)</label><input id="event-end" type="date" value="${escapeHtml(draft.end || '')}"></div>
      </div>
      <div class="field-pair">
        <div><label class="field-label" for="event-time">Время</label><input id="event-time" type="text" maxlength="40" placeholder="Например: 11:00" value="${escapeHtml(draft.time || '')}"></div>
        <div><label class="field-label" for="event-place">Место</label><input id="event-place" type="text" maxlength="120" value="${escapeHtml(draft.place || '')}"></div>
      </div>
      <label class="field-label" for="event-description">Описание (откроется на странице события)</label>
      <textarea id="event-description" rows="4" maxlength="1500">${escapeHtml(draft.description || '')}</textarea>
      <div class="field-label">В каких календарях показывать</div>
      <div id="event-scopes" class="checkbox-grid">${scopeBoxes}</div>
      <label class="checkbox"><input type="checkbox" id="event-planned" ${draft.planned ? 'checked' : ''}> Дата плановая: на странице события будет пометка «требует подтверждения»</label>
      <div class="admin-actions" style="justify-content:flex-start"><button class="btn" type="submit">Сохранить</button><button type="button" data-action="event-cancel">Отмена</button></div>
    </form>`;
}

function calendarTabHTML() {
  const filter = adminState.eventCategory;
  const events = allEvents().filter(event => filter === 'all' || event.cat === filter);
  const filters = [
    ['all', 'Все'],
    ...Object.entries(EVENT_CATEGORIES).map(([id, category]) => [id, category.label]),
  ];
  const filterChips = filters
    .map(
      ([id, label]) =>
        `<button data-event-category="${id}" aria-pressed="${filter === id}">${label}</button>`,
    )
    .join('');
  const scopeTitle = scope => (CALENDAR_SCOPES.find(([id]) => id === scope) || [0, scope])[1];
  const rowHTML = event => {
    const category = EVENT_CATEGORIES[event.cat] ? EVENT_CATEGORIES[event.cat].label : '';
    const notes =
      (event.soft ? ' · плановая дата' : '') +
      (event.custom ? ' · добавлено' : event.edited ? ' · изменено' : '') +
      (event.hidden ? ' · скрыто' : '');
    let extraButton = '';
    if (event.custom)
      extraButton = `<button data-action="event-delete" data-id="${event.id}">Удалить</button>`;
    else if (event.edited)
      extraButton = `<button data-action="event-reset" data-id="${event.id}">Вернуть исходное</button>`;
    return `<div class="admin-row admin-event">
        <div class="admin-event-date"><b>${eventDatesLabel(event)}</b><small>${parseIsoDate(event.date).getFullYear()}</small></div>
        <div><h3>${escapeHtml(event.t)}</h3><small>${category} · ${(event.sc || []).map(scopeTitle).join(', ')}${notes}</small></div>
        <div class="admin-actions">
          <button data-action="event-edit" data-id="${event.id}">Изменить</button>
          <button data-action="event-toggle" data-id="${event.id}">${event.hidden ? 'Показать' : 'Скрыть'}</button>
          ${extraButton}
        </div>
      </div>`;
  };
  return `<p class="admin-hint">Здесь можно добавить событие, изменить дату, название и описание, выбрать календари, в которых оно показывается, или скрыть событие. Изменения сразу видны на сайте.</p>
    <div class="filter-bar">
      <div class="chips">${filterChips}</div>
      <button class="btn" data-action="event-new">+ Новое событие</button>
    </div>
    ${adminState.eventDraft ? eventFormHTML() : ''}
    <div>${events.length ? events.map(rowHTML).join('') : '<p class="empty">Событий нет.</p>'}</div>`;
}

/* ----- Благодарности и Служба заботы ----- */

function thanksTabHTML() {
  const notes = inboxItems().filter(item => inboxKind(item) === 'thanks');
  const pending = notes.filter(item => inboxStatus(item) === 'new');
  const published = store.thanks || [];
  const signature = item =>
    (item.name ? 'от ' + escapeHtml(item.name) + ' · ' : '') + formatDateTime(item.ts);
  const pendingHTML = item => `<div class="admin-row">
        <div style="grid-column:1/3"><textarea id="thanks-edit-${item.id}" rows="2" maxlength="300">${escapeHtml(item.text)}</textarea><small>${signature(item)}</small></div>
        <div class="admin-actions">
          <button class="is-primary" data-action="thanks-approve" data-uid="${item.uid}" data-id="${item.id}">Опубликовать</button>
          <button data-action="thanks-reject" data-uid="${item.uid}" data-id="${item.id}">Отклонить</button>
        </div>
      </div>`;
  const publishedHTML = item => `<div class="admin-row">
        <div style="grid-column:1/3"><div>${escapeHtml(item.text)}</div><small>${signature(item)}</small></div>
        <div class="admin-actions"><button data-action="thanks-unpublish" data-id="${item.id}">Снять с публикации</button></div>
      </div>`;
  return `<p class="admin-hint">Записки сотрудников появляются на сайте только после вашего согласования. Текст можно поправить перед публикацией.</p>
    <h3 class="admin-subtitle">Ждут согласования · ${pending.length}</h3>
    ${pending.length ? pending.map(pendingHTML).join('') : '<p class="empty">Новых записок нет.</p>'}
    <h3 class="admin-subtitle" style="margin-top:2rem">Опубликованы · ${published.length}</h3>
    ${published.length ? published.map(publishedHTML).join('') : '<p class="empty">Пока ничего не опубликовано.</p>'}`;
}

function careTabHTML() {
  const filter = adminState.careFilter;
  const items = inboxItems().filter(
    item => inboxKind(item) === 'care' && (filter === 'all' || inboxStatus(item) === filter),
  );
  const itemHTML = item => {
    const done = inboxStatus(item) === 'done';
    const contact = item.contact
      ? `<small>Контакт для связи: ${escapeHtml(item.contact)}</small>`
      : '<small>Контакт не указан</small>';
    return `<div class="admin-row">
        <div style="grid-column:1/3">
          <small>${escapeHtml(item.topic || 'Обращение')} · ${formatDateTime(item.ts)}</small>
          <div style="margin:.3rem 0">${escapeHtml(item.text).replace(/\n/g, '<br>')}</div>
          ${contact}
        </div>
        <div class="admin-actions"><button data-action="care-status" data-uid="${item.uid}" data-id="${item.id}" data-status="${done ? 'new' : 'done'}">${done ? 'Вернуть в новые' : 'Отметить обработанным'}</button></div>
      </div>`;
  };
  return `<p class="admin-hint">Обращения сотрудников в Службу заботы видите только вы. Отметьте обращение обработанным, когда ответили человеку.</p>
    <div class="chips">
      <button data-care-filter="new" aria-pressed="${filter === 'new'}">Новые · ${newCareCount()}</button>
      <button data-care-filter="done" aria-pressed="${filter === 'done'}">Обработанные</button>
      <button data-care-filter="all" aria-pressed="${filter === 'all'}">Все</button>
      <button data-action="inbox-reload">Обновить</button>
    </div>
    ${items.length ? items.map(itemHTML).join('') : '<p class="empty">Обращений нет.</p>'}`;
}

/* ----- Тексты, опросы, цитата, ссылки ----- */

function textsTabHTML() {
  const pairs = store.texts || [];
  const rows = pairs
    .map(
      ([from, to], index) => `<div class="admin-row" style="grid-template-columns:minmax(0,1fr) auto">
        <div><small>Было</small><div>${escapeHtml(from)}</div><small>Стало</small><div><b>${escapeHtml(to)}</b></div></div>
        <div class="admin-actions"><button data-action="text-reset" data-index="${index}">Вернуть</button></div>
      </div>`,
    )
    .join('');
  return `<p class="admin-hint">Любой текст на сайте можно изменить прямо на странице. Нажмите кнопку ниже, откройте нужную страницу и кликните по тексту. Заголовки новостей, их описания и фото меняются во вкладке «Посты», события — во вкладке «Календарь».</p>
    <div class="admin-actions" style="justify-content:flex-start;margin-bottom:1.25rem"><button class="btn" data-action="edit-mode">Открыть сайт в режиме правки</button></div>
    <form class="admin-form form" data-admin-form="text">
      <h3>Заменить текст вручную</h3>
      <label class="field-label" for="text-original">Исходный текст (точно как на сайте)</label>
      <input id="text-original" type="text" maxlength="400" required>
      <label class="field-label" for="text-new">Новый текст</label>
      <input id="text-new" type="text" maxlength="1200" required>
      <div class="admin-actions" style="justify-content:flex-start"><button class="btn" type="submit">Сохранить замену</button></div>
    </form>
    <h3 class="admin-subtitle">Изменённые тексты · ${pairs.length}</h3>
    ${rows || '<p class="empty">Пока ничего не менялось.</p>'}`;
}

function pollsTabHTML() {
  const polls = postsInSection('surveys');
  const draft = adminState.draft && adminState.draft.isPoll ? adminState.draft : null;
  const formHTML = () => `<form class="admin-form form" data-admin-form="poll">
      <h3>${draft.key ? 'Редактирование опроса' : 'Новый опрос'}</h3>
      <label class="field-label" for="poll-title">Название</label>
      <input id="poll-title" type="text" required maxlength="160" value="${escapeHtml(draft.title || '')}">
      <label class="field-label" for="poll-description">Описание</label>
      <input id="poll-description" type="text" maxlength="200" value="${escapeHtml(draft.description || '')}">
      <label class="field-label" for="poll-url">Ссылка на опрос (https://…)</label>
      <input id="poll-url" type="url" placeholder="https://" value="${escapeHtml(draft.url || '')}">
      <label class="field-label" for="poll-status">Статус</label>
      <select id="poll-status"><option ${draft.status !== 'Закрыт' ? 'selected' : ''}>Открыт</option><option ${draft.status === 'Закрыт' ? 'selected' : ''}>Закрыт</option></select>
      <div class="admin-actions" style="justify-content:flex-start"><button class="btn" type="submit">Сохранить</button><button type="button" data-action="draft-cancel">Отмена</button></div>
    </form>`;
  const rowHTML = poll => {
    const details = `${escapeHtml(poll.d || '')} · ${escapeHtml(poll.tag || 'Открыт')}${poll.url ? ' · есть ссылка' : ' · без ссылки'}${poll.hidden ? ' · скрыт' : ''}`;
    return `<div class="admin-row" style="grid-template-columns:minmax(0,1fr) auto">
        <div><h3>${escapeHtml(poll.t)}</h3><small>${details}</small></div>
        <div class="admin-actions">
          <button data-action="poll-edit" data-key="${poll.key}">Изменить</button>
          <button data-action="post-toggle" data-key="${poll.key}" data-section="surveys">${poll.hidden ? 'Показать' : 'Скрыть'}</button>
          ${poll.custom ? `<button data-action="post-delete" data-key="${poll.key}">Удалить</button>` : ''}
        </div>
      </div>`;
  };
  return `<p class="admin-hint">Создайте опрос в любом сервисе (Яндекс Формы, Google Forms и т.д.) и вставьте ссылку: сотрудники перейдут по ней с главной страницы.</p>
    <div class="filter-bar"><span></span><button class="btn" data-action="poll-new">+ Новый опрос</button></div>
    ${draft ? formHTML() : ''}
    <div>${polls.map(rowHTML).join('')}</div>`;
}

function quoteTabHTML() {
  const quote = currentQuote();
  const resetButton = store.quote
    ? '<button type="button" data-action="quote-reset">Вернуть исходную</button>'
    : '';
  return `<p class="admin-hint">Цитата показывается на главной странице справа от главной темы. Каждый абзац — с новой строки.</p>
    <form class="admin-form form" data-admin-form="quote">
      <label class="field-label" for="quote-label-input">Заголовок блока</label>
      <input id="quote-label-input" type="text" maxlength="60" value="${escapeHtml(quote.label)}">
      <label class="field-label" for="quote-text-input">Текст цитаты</label>
      <textarea id="quote-text-input" rows="6" maxlength="600">${escapeHtml(quote.p.join('\n'))}</textarea>
      <label class="field-label" for="quote-author-input">Автор</label>
      <input id="quote-author-input" type="text" maxlength="160" value="${escapeHtml(quote.by)}">
      <div class="admin-actions" style="justify-content:flex-start"><button class="btn" type="submit">Сохранить цитату</button>${resetButton}</div>
    </form>`;
}

function linksTabHTML() {
  const links = store.links || {};
  return `<p class="admin-hint">Адреса для блока «Полезные ссылки» внизу сайта. Пока адрес не указан, ссылка ведёт на страницу «Контакты».</p>
    <form class="admin-form form" data-admin-form="links">
      <label class="field-label" for="link-mail">Корпоративная почта (адрес входа)</label>
      <input id="link-mail" type="url" placeholder="https://" value="${escapeHtml(links.mail || '')}">
      <label class="field-label" for="link-kb">База знаний</label>
      <input id="link-kb" type="url" placeholder="https://" value="${escapeHtml(links.kb || '')}">
      <div class="admin-actions" style="justify-content:flex-start"><button class="btn" type="submit">Сохранить ссылки</button></div>
    </form>`;
}
