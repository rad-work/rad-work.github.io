/* ===== Внутренние страницы: план, благотворительность, обучение, карьера, событие ===== */

const backLinkHTML = (target, label) =>
  `<a class="back-link" href="#${target}" data-route="${target}">← ${label || 'На главную'}</a>`;

/* Подписи ссылки «Назад» на странице события — по странице, откуда пришли */
const BACK_LABELS = {
  plan: 'К плану коммуникаций',
  learning: 'К обучению',
  sport: 'К Спорт VR',
  'charity-cal': 'К благотворительности',
  home: 'На главную',
  events: 'Назад',
};

const PLAN_FILTERS = [
  ['all', 'Все'],
  ['corp', 'Корпоративные мероприятия'],
  ['prof', 'Профессиональные праздники'],
  ['sport', 'Спорт'],
  ['charity', 'Благотворительность'],
];

/** Блок «Календарь событий» внутренней страницы: легенда, два месяца и списки событий. */
function pageCalendarHTML(scope, filtersHTML) {
  return `<div class="filter-bar">${filtersHTML}</div>
    <div class="months-card" data-calendar="${scope}"></div>
    <div data-calendar-list="${scope}" style="margin-top:0.75rem"></div>`;
}

function planPage() {
  const filters = PLAN_FILTERS.map(
    ([key, label]) =>
      `<button data-plan-filter="${key}" aria-pressed="${planFilter === key}">${label}</button>`,
  ).join('');
  return (
    backLinkHTML('home') +
    `<h1 class="page-title with-rule">План внутренних коммуникаций</h1>
    ${pageCalendarHTML('plan', `<div class="chips" role="group" aria-label="Фильтр событий">${filters}</div>`)}
    <div class="band band-sport">
      <div class="band-columns">
        <div class="band-text">
          <h2>Спорт VR</h2>
          <p>Направление компании в спорте: спортивный клуб сотрудников, киберспорт, турниры между подразделениями и компаниями, марафоны и корпоративный фитнес.</p>
          <a class="more-link" href="#sport" data-route="sport">Открыть Спорт VR →</a>
        </div>
        <div class="placeholder" aria-hidden="true"></div>
      </div>
    </div>` +
    homeSectionHTML('charity')
  );
}

function charityPage() {
  const directions = PLAN_2027.char.filter(row => row.t && !/Единый порядок/.test(row.t));
  const cards = directions.map(
    row => `<div class="info-card" style="border:1px solid var(--color-line)">
          <h3>${escapeHtml(row.t)}</h3>
          <p>${escapeHtml(row.x || 'Формат уточняется.')}</p>
          <span class="badge">Точные даты — в календаре</span>
        </div>`,
  );
  return (
    backLinkHTML('plan', 'К плану коммуникаций') +
    `<h1 class="page-title with-rule">Благотворительность</h1>
    <p class="lede">Когда можно принести вещи и на какие акции мы собираем помощь. Отмеченные в календаре даты — дни сбора.</p>
    ${pageCalendarHTML('charity', '<span></span>', ['charity'])}
    <section>
      <div class="section-head"><h2>На что и как помогаем</h2></div>
      <div class="info-grid">${cards.join('')}</div>
    </section>`
  );
}

function learningPage() {
  const items = SITE.learning.map(
    item =>
      `<div class="learning-item">${pictureHTML(item.img, item.t)}<p style="margin-top:1.125rem">${escapeHtml(item.d)}</p></div>`,
  );
  return (
    backLinkHTML('home') +
    `<h1 class="page-title">Обучение</h1>
    ${pageCalendarHTML('learn', '<span></span>', ['learn'])}
    <section>
      <div class="section-head"><h2>Вебинары, внутренние лекции и митапы</h2></div>
      ${items.join('')}
    </section>`
  );
}

function careerPage() {
  const tracks = SITE.career.tracks.map(
    track => `<div class="track">
          <h3>${track.t}</h3>
          <ol>${track.steps.map(step => `<li>${step}</li>`).join('')}</ol>
        </div>`,
  );
  const [linkLabel, linkRoute] = SITE.career.link;
  return (
    backLinkHTML('home') +
    `<h1 class="page-title">Карьерные треки</h1>
    <div class="tracks">${tracks.join('')}</div>
    <p style="margin:28px 0 0"><a class="text-link" href="#${linkRoute}" data-route="${linkRoute}">${linkLabel} →</a></p>`
  );
}

/** Страница события #e-<id>; previousPage — откуда пришли (для ссылки «Назад»). */
function eventPage(eventId, previousPage) {
  const event = eventsById[eventId];
  let backRoute = event.back === 'home' ? 'events' : event.back;
  if (previousPage && BACK_LABELS[previousPage] && previousPage !== 'events') backRoute = previousPage;
  const start = parseIsoDate(event.date);
  const end = event.end && event.end !== event.date ? parseIsoDate(event.end) : null;
  const dates = end
    ? `${start.getDate()}–${end.getDate()} ${MONTH_NAMES_GENITIVE[end.getMonth()]} ${end.getFullYear()}`
    : `${start.getDate()} ${MONTH_NAMES_GENITIVE[start.getMonth()]} ${start.getFullYear()}`;
  const place = event.place ? `<div><small>Место</small><b>${escapeHtml(event.place)}</b></div>` : '';
  const meta =
    event.cat === 'prof'
      ? ''
      : `<div class="event-meta">
          <div><small>Дата</small><b>${dates}</b></div>
          <div><small>Время</small><b>${event.time || 'Уточняется'}</b></div>
          ${place}
        </div>`;
  const plannedNote = event.soft ? '<p class="event-note">Плановая дата: требует подтверждения.</p>' : '';
  return (
    backLinkHTML(backRoute, BACK_LABELS[backRoute]) +
    `<h1 class="page-title" style="font-size:clamp(2rem,5vw,3.6rem);margin-bottom:1.75rem">${escapeHtml(event.t)}</h1>
    <div class="event-page">
      <div class="placeholder" aria-hidden="true"></div>
      <div>
        ${meta}
        <p class="event-text">${escapeHtml(event.d)}</p>
        ${plannedNote}
      </div>
    </div>`
  );
}
