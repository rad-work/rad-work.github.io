/* ===== Общие помощники и состояние сайта ===== */

// prettier-ignore
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
/* «5 мая» */
// prettier-ignore
const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
/* «5–7 мая» в списках событий */
const MONTH_NAMES_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

const $ = selector => document.querySelector(selector);

/** Экранирует текст для вставки в HTML, в том числе в атрибуты в двойных кавычках. */
const escapeHtml = value =>
  String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

const pad2 = number => String(number).padStart(2, '0');

/** Date → «ГГГГ-ММ-ДД» по местному времени. */
const toIsoDate = date => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** «ГГГГ-ММ-ДД» → Date (полночь по местному времени). */
function parseIsoDate(text) {
  const [year, month, day] = text.split('-');
  return new Date(+year, +month - 1, +day);
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

const TODAY_ISO = toIsoDate(new Date());

/**
 * Адрес картинки по ссылке из контента: data:-URL отдаём как есть,
 * «ph:<id>» — фото из коллекции photos, остальное — ключ встроенного фото из IMAGES.
 */
function imageUrl(ref) {
  if (!ref) return ref;
  if (ref.startsWith('data:')) return ref;
  if (ref.startsWith('ph:')) return ((store.photos || {})[ref.slice(3)] || {}).d;
  return IMAGES[ref];
}

/** Фото с точкой фокуса (focusX и focusY — в процентах) или серая заглушка «Место под фото». */
function pictureHTML(ref, alt, focusX, focusY) {
  const url = imageUrl(ref);
  if (!url) return '<div class="placeholder pic" role="img" aria-label="Место под фото"></div>';
  const focus = focusX != null ? ` style="object-position:${focusX}% ${focusY}%"` : '';
  return `<img class="pic" src="${url}" alt="${escapeHtml(alt || '')}"${focus}>`;
}

/** Атрибуты для внешней ссылки (http…): открывать в новой вкладке. */
const externalLinkAttrs = href => (href && href.startsWith('http') ? ' target="_blank" rel="noopener"' : '');

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/** Всплывающее сообщение внизу экрана на 3 секунды. */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

/** Обработчик кликов по элементам, подходящим под селектор (в том числе добавленным позже). */
function onClick(selector, handler) {
  document.addEventListener('click', event => {
    const target = event.target.closest?.(selector);
    if (target) handler(target, event);
  });
}

/* ----- Подключение к базе и вход ----- */
let db = null; // Firestore; null — пока подключается или если база недоступна
let dbFailed = false; // база не подключилась — сайт работает на встроенном контенте
let auth = null; // Firebase Auth
let userId = null; // UID текущего пользователя: анонимного сотрудника или админа
let isLoggedIn = false; // вошёл по почте и паролю, а не анонимно
let isAdmin = null; // null — права ещё проверяются, затем true или false

/* Данные из базы; null — ещё не загружены */
const store = {
  thanks: null, // опубликованные благодарности
  ideas: null, // комментарии «Предложить идею»
  posts: null, // правки встроенных постов и новые посты: { [id документа]: документ }
  photos: null, // загруженные фото: { [id]: { d: data-URL } }
  events: null, // правки встроенных событий («ev__<id>») и новые события
  texts: null, // замены текстов сайта: [[исходный, новый], …]
  quote: null, // цитата недели
  links: null, // адреса полезных ссылок: { mail, kb }
  inbox: null, // обращения в Службу заботы и благодарности на модерации (только для админа)
};
