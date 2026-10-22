/* ===== Спорт VR ===== */

/* Отметки «Напомнить мне» хранятся только в этом браузере */
const REMINDERS_KEY = 'vr-remind';
const reminders = loadReminders();

function loadReminders() {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '{}') || {};
  } catch (error) {
    return {};
  }
}

const formatDayMonth = date => `${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]}`;

/** Забеги и марафоны из плана: неделя старта и начало подготовки за 8 недель до него. */
function marathonsFromPlan() {
  return PLAN_2027.weeks
    .filter(week => /(забег|марафон)/i.test(week.a) && !/подготов/i.test(week.a))
    .map(week => {
      const [day, month] = week.d.split('.');
      const start = new Date(2027, +month - 1, +day);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const trainingStart = new Date(start);
      trainingStart.setDate(trainingStart.getDate() - 56);
      return { id: 'm' + week.n, title: capitalize(week.a), start, end, trainingStart };
    });
}

const reminderLabel = id => (reminders[id] ? 'Напоминание включено ✓' : 'Напомнить мне');

function sportPage() {
  const sport = SITE.sport;
  const teamCardHTML = item => `<div class="info-card">
          <h3>${escapeHtml(item.t)}</h3>
          <p>${escapeHtml(item.x)}</p>
          <div class="card-actions"><span class="soon-badge">Опрос — скоро</span><span class="soon-badge">Набор — скоро</span><span class="soon-badge">Telegram — скоро</span></div>
        </div>`;
  const soonCardHTML = item => `<div class="info-card">
          <span class="badge">Скоро</span>
          <h3>${escapeHtml(item.t)}</h3>
          <p>${escapeHtml(item.x)}</p>
        </div>`;
  const marathonHTML = marathon => `<div class="marathon">
        <div><b>${escapeHtml(marathon.title)}</b><small>${formatDayMonth(marathon.start)} – ${formatDayMonth(marathon.end)} 2027</small></div>
        <small>План тренировок — с ${formatDayMonth(marathon.trainingStart)} (за 8 недель до старта)</small>
        <div class="card-actions" style="margin:0;padding:0"><button data-reminder="${marathon.id}" aria-pressed="${!!reminders[marathon.id]}">${reminderLabel(marathon.id)}</button></div>
      </div>`;

  const news = visiblePosts('sportnews');
  const fitnessCards = news.length
    ? news.map(
        post => `<div class="info-card">
          <h3>${escapeHtml(post.t)}</h3>
          <p>${escapeHtml(post.d || '')}</p>
          <a class="more-link" href="#a-${post.id}" data-route="a-${post.id}">Подробнее →</a>
        </div>`,
      )
    : [soonCardHTML({ t: PLAN_2027.sport2[0].t, x: '' })];

  return (
    backLinkHTML('home') +
    `<div class="sport-media" role="img" aria-label="Место под фото или видео">${sport.media}</div>
    <h1 class="sport-title">Спорт VR</h1>
    <p class="lede">${sport.lede}</p>
    <section id="sport-team">
      <div class="section-head"><h2>${sport.team.h}</h2></div>
      <div class="info-grid">${PLAN_2027.sport.map(teamCardHTML).join('')}</div>
    </section>
    <section id="sport-marathons">
      <div class="section-head"><h2>${sport.marathon.h}</h2></div>
      ${marathonsFromPlan().map(marathonHTML).join('')}
      <p class="small-print" style="margin:0.6rem 0 1.25rem">Отметка «Напомнить мне» хранится в вашем браузере.</p>
      <div class="info-grid">${PLAN_2027.sport1
        .filter(row => /Подготовка|Истории/.test(row.t))
        .map(soonCardHTML)
        .join('')}</div>
    </section>
    <section id="sport-fitness">
      <div class="section-head"><h2>${sport.fitness.h}</h2></div>
      <div class="info-grid three-columns">${fitnessCards.join('')}${PLAN_2027.sport2.slice(1).map(soonCardHTML).join('')}</div>
    </section>
    <section id="sport-calendar">
      <div class="section-head"><h2>Спортивный год 2027</h2></div>
      ${pageCalendarHTML('sport', '<span></span>', ['sport'])}
      <p class="small-print" style="margin-top:0.6rem">Плановые активности: даты требуют подтверждения.</p>
    </section>`
  );
}

onClick('[data-reminder]', button => {
  const id = button.dataset.reminder;
  reminders[id] = !reminders[id];
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  } catch (error) {
    /* хранилище недоступно — отметка проживёт до перезагрузки */
  }
  button.setAttribute('aria-pressed', !!reminders[id]);
  button.textContent = reminderLabel(id);
});
