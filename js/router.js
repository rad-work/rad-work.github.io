/* ===== Навигация по адресу после «#» =====
 *   #home, #plan, … — страницы;  #a-<id> — страница поста;
 *   #events, #charity, … — разделы главной (страница прокручивается к ним).
 */

const PAGE_ROUTES = ['home', 'plan', 'career', 'learning', 'sport', 'charity-cal', 'admin'];
const HOME_ANCHORS = [
  'events',
  'charity',
  'team',
  'library',
  'surveys',
  'care',
  'thanks',
];
const PAGE_RENDERERS = {
  home: homePage,
  plan: planPage,
  career: careerPage,
  learning: learningPage,
  sport: sportPage,
  'charity-cal': charityPage,
  admin: adminPage,
};
/* Заголовки вкладки браузера для страниц, которых нет в меню (SITE.pages) */
const PAGE_TITLES = {
  career: 'Карьерные треки',
  sport: 'Спорт VR',
  'charity-cal': 'Благотворительность',
  admin: 'Админ-панель',
};

/* Нижнее меню на телефоне: страница, подпись, иконка */
const TAB_BAR_ITEMS = [
  [
    'plan',
    'План',
    '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  ],
  ['career', 'Карьера', '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>'],
  ['home', 'VR', ''],
  [
    'learning',
    'Обучение',
    '<svg viewBox="0 0 24 24"><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13"/></svg>',
  ],
  [
    'sport',
    'Спорт',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7"/><path d="M12 10v4l2.5 1.5M9.5 3h5M12 3v3.5"/></svg>',
  ],
];

const currentAttr = isCurrent => (isCurrent ? 'aria-current="page"' : '');

function renderNav(current) {
  $('#main-nav').innerHTML = SITE.pages
    .map(
      page =>
        `<a href="#${page.id}" data-route="${page.id}" ${currentAttr(page.id === current)}>${page.title}</a>`,
    )
    .join('');
}

function renderTabBar(current) {
  const tabBar = $('#tab-bar');
  if (!tabBar) return;
  tabBar.innerHTML = TAB_BAR_ITEMS.map(([page, label, icon]) =>
    page === 'home'
      ? `<a class="tab-home" href="#home" data-route="home" aria-label="Главная" ${currentAttr(current === 'home')}><span>VR</span></a>`
      : `<a href="#${page}" data-route="${page}" ${currentAttr(current === page)}>${icon}${label}</a>`,
  ).join('');
}

/** Блок «Полезные ссылки» внизу страницы. Ссылки «@mail» и «@kb» берут адрес из админки. */
function renderUsefulLinks() {
  const addresses = store.links || {};
  const usefulLinkHTML = ([label, href]) => {
    if (href.startsWith('@')) {
      const url = (addresses[href.slice(1)] || '').trim();
      return url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`
        : `<a href="#a-contacts" data-route="a-contacts" data-coming-soon="${escapeHtml(label)}">${label}</a>`; // адрес ещё не задан
    }
    const attrs =
      href.length > 1 && href[0] === '#' ? ` data-route="${href.slice(1)}"` : externalLinkAttrs(href);
    return `<a href="${href}"${attrs}>${label}</a>`;
  };
  $('#useful-links').innerHTML =
    `<h2>${SITE.wall.t}</h2><div class="links">${SITE.wall.links.map(usefulLinkHTML).join('')}</div>`;
}

/** Какой пункт меню подсветить: для поста — главную. */
function navigationPageFor(page) {
  if (page === 'post') return 'home';
  if (page === 'charity-cal') return 'plan';
  return page;
}

function pageTitle(page, post) {
  if (page === 'home') return 'VR РИТМ';
  if (page === 'post') return post.t + ' · VR РИТМ';
  return (PAGE_TITLES[page] || SITE.pages.find(item => item.id === page).title) + ' · VR РИТМ';
}

/** Рисует страницу по адресу. scroll === false — не прокручивать наверх. */
function route(scroll) {
  const hash = (location.hash || '#home').slice(1) || 'home';
  const postData = hash.startsWith('a-') ? findPostPage(hash.slice(2)) : null;
  let page = 'home';
  let anchor = null;
  if (PAGE_ROUTES.includes(hash)) page = hash;
  else if (postData) page = 'post';
  else if (HOME_ANCHORS.includes(hash)) anchor = hash;

  const content = page === 'post' ? postPage(postData) : PAGE_RENDERERS[page]();
  $('#view').innerHTML = `<div class="fade-in">${content}</div>`;
  document.body.classList.toggle('is-sport-page', page === 'sport');

  const navigationPage = navigationPageFor(page);
  renderNav(navigationPage);
  renderTabBar(navigationPage);
  renderUsefulLinks();
  document.title = pageTitle(page, postData);

  clearInterval(slideTimer);
  if (page === 'admin') {
    renderAdmin();
    loadInbox();
  }
  $('#useful-links').hidden = page === 'admin';
  if (page === 'home') startHomePage();
  if (['plan', 'learning', 'charity-cal'].includes(page)) showCalendarMonth(page);
  drawThanks();

  if (anchor) {
    requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      if (target) target.scrollIntoView();
    });
  } else if (scroll !== false) window.scrollTo(0, 0);
}

/* Ссылки с data-route переключают страницу; клик по ссылке на текущую страницу перерисовывает её */
onClick('[data-route]', (link, event) => {
  event.preventDefault();
  const target = link.dataset.route;
  if (location.hash === '#' + target) route();
  else location.hash = target;
});
onClick('a[href="#"]', (link, event) => event.preventDefault());
addEventListener('hashchange', () => route());

/* Клик по адресу почты копирует его в буфер обмена */
onClick('a[href^="mailto:"]', link => {
  const address = link.getAttribute('href').slice(7);
  try {
    navigator.clipboard.writeText(address).then(
      () => showToast('Адрес скопирован: ' + address),
      () => {},
    );
  } catch (error) {
    /* буфер обмена недоступен */
  }
});
onClick('[data-coming-soon]', link =>
  showToast('Ссылка на «' + link.dataset.comingSoon + '» ещё не добавлена. Контакты — на этой странице.'),
);
