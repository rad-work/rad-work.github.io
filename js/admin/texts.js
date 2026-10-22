/* ===== Правка текстов сайта прямо на странице («режим правки») =====
 * Замены хранятся в базе (content/texts) парами «исходный текст → новый» и применяются ко всем
 * элементам с точно таким текстом. Исходный текст заменённого элемента запоминается в data-original-text.
 */

const EDIT_MODE_KEY = 'vr_edit'; // режим правки помнится до закрытия вкладки
let editMode = readEditMode();
let textReplacements = new Map(); // исходный текст → новый

/* Тексты в этих местах не заменяются и не правятся: админка, окна, просмотр фото, полоса режима, превью поста */
const PROTECTED_AREAS = '#admin-panel, .modal, .lightbox, .text-modal, #edit-bar, .previews';
const TEXT_TAGS = /^(H1|H2|H3|H4|P|LI|SPAN|A|B|SMALL|BUTTON|LABEL|DIV|STRONG|EM|I)$/;

function readEditMode() {
  try {
    return sessionStorage.getItem(EDIT_MODE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

const normalizeText = text => String(text).replace(/\s+/g, ' ').trim();

function rebuildTextReplacements() {
  textReplacements = new Map((store.texts || []).map(([from, to]) => [from, to]));
}

/** Применяет замены к текстовым элементам страницы и в режиме правки помечает их как редактируемые. */
function applyTextReplacements() {
  document.querySelectorAll('#view *, header *, footer *, .tab-bar *').forEach(element => {
    if (element.children.length || element.closest(PROTECTED_AREAS) || !TEXT_TAGS.test(element.tagName))
      return;
    const text = normalizeText(element.textContent);
    if (!text && !element.dataset.originalText) return;
    const original = element.dataset.originalText || text;
    if (textReplacements.has(original)) {
      const replacement = textReplacements.get(original);
      if (element.textContent !== replacement) element.textContent = replacement;
      element.dataset.originalText = original;
    } else if (element.dataset.originalText) {
      element.textContent = element.dataset.originalText;
      delete element.dataset.originalText;
    }
    const editable =
      editMode &&
      isLoggedIn &&
      normalizeText(element.textContent).length > 0 &&
      !element.closest('nav, .tab-bar');
    element.classList.toggle('is-editable', !!editable);
  });
}

/* Замены применяем и к тому, что дорисовалось на странице позже */
let applyTimer = null;
new MutationObserver(() => {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(applyTextReplacements, 30);
}).observe(document.body, { childList: true, subtree: true });

/** Полоса «Режим правки» вверху экрана — пока режим включён и админ вошёл. */
function updateEditBar() {
  const active = editMode && isLoggedIn;
  let bar = $('#edit-bar');
  document.body.classList.toggle('is-editing', !!active);
  if (active) {
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'edit-bar';
    bar.innerHTML =
      '<span>Режим правки: нажмите на любой текст, чтобы изменить его.</span><button type="button" id="edit-bar-done">Готово</button>';
    document.body.appendChild(bar);
  } else if (bar) {
    bar.remove();
  }
}

function setEditMode(on) {
  editMode = on;
  try {
    sessionStorage.setItem(EDIT_MODE_KEY, on ? '1' : '0');
  } catch (error) {
    /* хранилище недоступно */
  }
  updateEditBar();
  applyTextReplacements();
}

/** Сохраняет замену текста; пустая или совпадающая с исходным замена удаляется. */
async function saveTextReplacement(original, replacement) {
  const pairs = (store.texts || []).filter(([from]) => from !== original);
  if (replacement && replacement !== original) pairs.push([original, replacement]);
  store.texts = pairs;
  rebuildTextReplacements();
  applyTextReplacements();
  if (!db) {
    showToast('Сохранение недоступно');
    return;
  }
  try {
    await db
      .collection('content')
      .doc('texts')
      .set({ pairs: pairs.map(([from, to]) => ({ o: from, n: to })) });
    showToast('Текст сохранён');
  } catch (error) {
    showToast('Не удалось сохранить. Проверьте доступ.');
  }
}

/** Окно правки текста элемента. */
function openTextEditor(element) {
  const original = element.dataset.originalText || normalizeText(element.textContent);
  const modal = document.createElement('div');
  modal.className = 'modal text-modal';
  modal.innerHTML = `<div class="modal-box" role="dialog" aria-label="Изменить текст">
      <h3>Изменить текст</h3>
      <p class="small-print">Замена применится везде на сайте, где стоит точно такой же текст.</p>
      <textarea rows="4" maxlength="1200"></textarea>
      <div class="admin-actions" style="justify-content:flex-end">
        <button type="button" data-text-action="cancel">Отмена</button>
        ${textReplacements.has(original) ? '<button type="button" data-text-action="reset">Вернуть исходный</button>' : ''}
        <button type="button" class="btn" data-text-action="save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const textarea = modal.querySelector('textarea');
  textarea.value = normalizeText(element.textContent);
  textarea.focus();
  modal.querySelector('[data-text-action="cancel"]').onclick = () => modal.remove();
  const resetButton = modal.querySelector('[data-text-action="reset"]');
  if (resetButton) {
    resetButton.onclick = () => {
      modal.remove();
      saveTextReplacement(original, '');
    };
  }
  modal.querySelector('[data-text-action="save"]').onclick = () => {
    const value = normalizeText(textarea.value);
    if (!value) {
      showToast('Текст не может быть пустым');
      return;
    }
    modal.remove();
    saveTextReplacement(original, value);
  };
}

/* В режиме правки клик по тексту открывает окно правки (перехватываем раньше остальных обработчиков) */
document.addEventListener(
  'click',
  event => {
    if (event.target.closest?.('#edit-bar-done')) {
      setEditMode(false);
      location.hash = '#admin';
      return;
    }
    if (!(editMode && isLoggedIn)) return;
    const element = event.target.closest?.('.is-editable');
    if (!element || element.closest('#edit-bar, .text-modal, #admin-panel')) return;
    event.preventDefault();
    event.stopPropagation();
    openTextEditor(element);
  },
  true,
);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelector('.text-modal')?.remove();
});
