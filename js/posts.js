/* ===== Посты: встроенные (SITE) с правками из базы и новые посты из базы ===== */

/* Разделы, где можно показать пост. Ключи хранятся в базе. */
const POST_SECTIONS = [
  ['hero', 'Главная тема'],
  ['charity', 'Благотворительность'],
  ['team', 'Team VR'],
  ['library', 'Корпоративная библиотека VR'],
  ['sportnews', 'Спорт VR'],
];
const SECTION_TITLES = Object.fromEntries([...POST_SECTIONS, ['surveys', 'Опросы']]);

/* Поля поста, которые админ может поменять в базе */
const POST_FIELDS = [
  't',
  'd',
  'body',
  'img',
  'imgs',
  'hidden',
  'url',
  'tag',
  'fx',
  'fy',
  'sections',
  'also',
  'files',
];

/** Цитата недели: из базы, если там есть хотя бы один абзац, иначе встроенная. */
const currentQuote = () => (store.quote && store.quote.p && store.quote.p.length ? store.quote : SITE.quote);

function pickPostFields(doc) {
  const fields = {};
  POST_FIELDS.forEach(name => {
    if (doc[name] !== undefined) fields[name] = doc[name];
  });
  return fields;
}

/** Встроенные посты раздела из SITE. */
function builtinPosts(section) {
  if (section === 'hero') return SITE.slides;
  if (section === 'surveys') return SITE.surveys;
  const group = SITE.groups.find(item => item.id === section);
  return group ? group.items : [];
}

/**
 * Все посты раздела, включая скрытые: сначала новые из базы (свежие выше), затем встроенные с правками,
 * затем встроенные посты других разделов, которые админ показал и здесь (поле also).
 * key — id документа в базе: у новых постов свой, у встроенных «<раздел>__<id поста>».
 */
function postsInSection(section) {
  const docs = store.posts || {};
  const added = Object.values(docs)
    .filter(doc => doc.custom && (doc.section === section || (doc.sections || []).includes(section)))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .map(doc => ({
      ...pickPostFields(doc),
      id: doc.id,
      key: doc.id,
      custom: true,
      section: doc.section || section,
    }));

  const builtin = builtinPosts(section).map(post => {
    const key = section + '__' + post.id;
    const override = docs[key];
    const changes = override ? pickPostFields(override) : {};
    return { ...post, ...changes, id: post.id, key, custom: false, edited: !!override, section };
  });

  const sharedHere = [];
  [...POST_SECTIONS.map(([id]) => id), 'surveys'].forEach(otherSection => {
    if (otherSection === section) return;
    builtinPosts(otherSection).forEach(post => {
      const key = otherSection + '__' + post.id;
      const override = docs[key];
      if (override && (override.also || []).includes(section)) {
        sharedHere.push({
          ...post,
          ...pickPostFields(override),
          id: post.id,
          key,
          custom: false,
          edited: true,
          section: otherSection,
          shared: true,
        });
      }
    });
  });

  return [...added, ...builtin, ...sharedHere];
}

const visiblePosts = section => postsInSection(section).filter(post => !post.hidden);

/* Где искать пост для страницы #a-<id> (по порядку) */
const POST_PAGE_SECTIONS = ['sportnews', 'charity', 'team', 'library', 'surveys', 'hero'];

/** Данные страницы поста #a-<id>: тексты, фото, файлы и куда ведёт «Назад». */
function findPostPage(id) {
  if (id === 'contacts') return { t: 'Контакты', d: '', body: CONTACTS_TEXT, back: 'home' };
  for (const section of POST_PAGE_SECTIONS) {
    const post = postsInSection(section).find(item => item.id === id && !item.hidden);
    if (!post) continue;
    return {
      t: post.t,
      d: post.d,
      body: post.body,
      img: post.img,
      imgs: post.imgs,
      files: post.files,
      back: section === 'sportnews' ? 'sport' : 'home',
      anchor: section === 'hero' || section === 'sportnews' ? undefined : section,
    };
  }
  return null;
}

/* ----- Разметка текста поста ----- */

/* [текст](ссылка), http(s)-ссылка или адрес почты */
const INLINE_LINK =
  /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]*[^\s<>().,;:])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Ссылка: внутренние (#…) открываются здесь же, остальные — в новой вкладке. */
function linkHTML(href, text) {
  if (href.startsWith('#')) return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

/** Строка текста: экранирует HTML и превращает ссылки и адреса почты в <a>. */
function inlineHTML(text) {
  let html = '';
  let position = 0;
  for (const match of text.matchAll(INLINE_LINK)) {
    const [whole, linkText, linkHref, url, email] = match;
    html += escapeHtml(text.slice(position, match.index));
    if (linkText) html += linkHTML(linkHref, linkText);
    else if (email) html += `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
    else html += linkHTML(url, url);
    position = match.index + whole.length;
  }
  return html + escapeHtml(text.slice(position));
}

/**
 * Текст поста → HTML. Блоки разделяются пустой строкой: блок из строк «> » — цитата,
 * блок из строк «- » — список; в остальных блоках «## » — подзаголовок, «- » — пункт списка, прочее — абзацы.
 */
function postBodyHTML(text) {
  if (!text) return `<p>${escapeHtml(SITE.soon)}</p>`;
  return String(text)
    .split(/\n{2,}/)
    .map(blockHTML)
    .join('')
    .replace(/<\/ul><ul>/g, ''); // соседние списки склеиваем в один
}

function blockHTML(block) {
  const lines = block.split('\n');
  if (lines.every(line => line.startsWith('> '))) {
    return `<blockquote>${lines.map(line => inlineHTML(line.slice(2))).join('<br>')}</blockquote>`;
  }
  if (lines.every(line => line.startsWith('- '))) {
    return `<ul>${lines.map(line => `<li>${inlineHTML(line.slice(2))}</li>`).join('')}</ul>`;
  }
  return lines
    .map(line => {
      if (line.startsWith('## ')) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
      if (line.startsWith('- ')) return `<ul><li>${inlineHTML(line.slice(2))}</li></ul>`;
      return `<p>${inlineHTML(line)}</p>`;
    })
    .join('');
}
