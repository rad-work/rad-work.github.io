/* ===== Админ-панель: разметка вкладок ===== */

const ADMIN_TABS = [
  ['posts', 'Посты'],
  ['thanks', 'Благодарности'],
  ['care', 'Служба заботы'],
  ['quote', 'Цитата недели'],
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
        rowsByKey[post.key] = Object.assign({}, post, { shownIn: [section] });
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

/** Фото поста в редакторе: обрезка, удаление и порядок — стрелками или перетаскиванием (первое — обложка). */
function editorPhotosHTML() {
  const photos = adminState.draft.photos || [];
  if (!photos.length) return '<p class="small-print">Фото пока нет.</p>';
  return photos
    .map((ref, index) => {
      const url = imageUrl(ref);
      return `<div class="photo-item" draggable="true" data-photo-index="${index}">
        ${url ? `<img src="${escapeHtml(url)}" alt="" draggable="false">` : '<div class="thumb"></div>'}
        <small>${index ? 'Фото ' + (index + 1) : 'Обложка'}</small>
        <div class="admin-actions">
          <button type="button" data-action="photo-crop" data-index="${index}">Обрезать</button>
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
      <div class="field-label">Фото — первое станет обложкой карточки; порядок меняется перетаскиванием</div>
      <div id="post-photos" class="photo-list">${editorPhotosHTML()}</div>
      <div class="admin-actions" style="justify-content:flex-start"><label class="upload-button">+ Добавить фото<input type="file" accept="image/*" multiple id="post-photo-input" hidden></label></div>
      <div class="field-label">Файлы к посту (скачиваются со страницы поста)</div>
      <div id="post-files" class="file-list">${editorFilesHTML()}</div>
      <div class="admin-actions" style="justify-content:flex-start"><label class="upload-button">+ Прикрепить файл<input type="file" multiple id="post-file-input" hidden></label></div>
      <p class="admin-hint">Форматы: pdf, docx, xlsx, pptx, zip, csv, txt, изображения, видео mp4/webm и др. Размер до 8 МБ. Другие форматы (doc, xls, rar) сначала упакуйте в zip.</p>
      <label class="checkbox"><input type="checkbox" id="post-published" ${draft.hidden ? '' : 'checked'}> Показывать на сайте</label>
      <div class="admin-actions" style="justify-content:flex-start"><button class="btn" type="submit">Сохранить</button><button type="button" data-action="draft-cancel">Отмена</button></div>
    </form>`;
}

function postsTabHTML() {
  const rows = adminPostRows().filter(row => row.section !== 'surveys');
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
    <div class="filter-bar"><span></span><button class="btn" data-action="post-new">+ Новый пост</button></div>
    ${adminState.draft ? postEditorHTML() : ''}
    <div>${rows.map(rowHTML).join('')}</div>`;
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

/* ----- Цитата недели ----- */

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
