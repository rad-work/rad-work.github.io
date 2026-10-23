/* ===== Замены текстов сайта =====
 * Замены хранятся в базе (content/texts) парами «исходный текст → новый» и применяются ко всем
 * элементам с точно таким текстом. Исходный текст заменённого элемента запоминается в data-original-text.
 */

let textReplacements = new Map(); // исходный текст → новый

/* Тексты в этих местах не заменяются: админка, окна, просмотр фото, превью поста */
const PROTECTED_AREAS = '#admin-panel, .modal, .lightbox, .previews';
const TEXT_TAGS = /^(H1|H2|H3|H4|P|LI|SPAN|A|B|SMALL|BUTTON|LABEL|DIV|STRONG|EM|I)$/;

const normalizeText = text => String(text).replace(/\s+/g, ' ').trim();

function rebuildTextReplacements() {
  textReplacements = new Map((store.texts || []).map(([from, to]) => [from, to]));
}

/** Применяет замены к текстовым элементам страницы. */
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
  });
}

/* Замены применяем и к тому, что дорисовалось на странице позже */
let applyTimer = null;
new MutationObserver(() => {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(applyTextReplacements, 30);
}).observe(document.body, { childList: true, subtree: true });
