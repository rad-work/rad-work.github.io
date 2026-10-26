/* ===== Календари: сетка месяца, списки событий, переключение месяцев ===== */

let selectedDay = null; // выбранный день «ГГГГ-ММ-ДД» или null
let planFilter = 'all'; // фильтр по типу событий на странице плана
const shownMonth = { year: new Date().getFullYear(), month: new Date().getMonth() }; // первый показанный месяц

/* Если в один день несколько событий, цвет дня берём по самому важному типу */
const CATEGORY_PRIORITY = { prof: 0, charity: 1, sport: 1, learn: 2, corp: 3 };
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const TONE_COLORS = {
  grey: 'var(--color-gray-tint)',
  blue: 'var(--color-accent-tint)',
  green: 'var(--color-green-tint)',
};

/** Сетка месяца: дни с событиями выделены цветом и нажимаются. */
function monthGridHTML(year, month, events) {
  const daysBefore = (new Date(year, month, 1).getDay() + 6) % 7; // дни прошлого месяца до первого понедельника
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const byDay = eventsByDay(events);

  let html = '<div class="month-days">' + WEEKDAYS.map(name => `<span>${name}</span>`).join('');
  for (let i = daysBefore - 1; i >= 0; i--) html += `<i class="other-month">${daysInPreviousMonth - i}</i>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const dayEvents = byDay[date];
    const todayClass = date === TODAY_ISO ? ' is-today' : '';
    if (!dayEvents) {
      html += `<i class="${todayClass.trim()}">${day}</i>`;
      continue;
    }
    const main = dayEvents.slice().sort((a, b) => CATEGORY_PRIORITY[a.cat] - CATEGORY_PRIORITY[b.cat])[0];
    const classes = `has-events tone-${EVENT_CATEGORIES[main.cat].tone}${todayClass}${selectedDay === date ? ' is-selected' : ''}`;
    const label = `${day} ${MONTH_NAMES_GENITIVE[month]}: ${escapeHtml(main.t)}`;
    html += `<i class="${classes}" data-day="${date}" role="button" tabindex="0" aria-label="${label}">${day}</i>`;
  }
  const daysAfter = (7 - ((daysBefore + daysInMonth) % 7)) % 7;
  for (let day = 1; day <= daysAfter; day++) html += `<i class="other-month">${day}</i>`;
  return html + '</div>';
}

/** Строка события в списке: даты, название и время или тип события. */
function eventRowHTML(event) {
  const start = parseIsoDate(event.date);
  const end = event.end && event.end !== event.date ? parseIsoDate(event.end) : null;
  const category = EVENT_CATEGORIES[event.cat];
  const days = end ? `${start.getDate()}–${end.getDate()}` : start.getDate();
  const months =
    end && end.getMonth() !== start.getMonth()
      ? `${MONTH_NAMES_SHORT[start.getMonth()]}–${MONTH_NAMES_SHORT[end.getMonth()]}`
      : MONTH_NAMES_SHORT[start.getMonth()];
  const subtitle = event.time ? `${event.time} · ${event.place}` : event.sub || category.singular;
  const selected = selectedDay === event.date ? 'is-selected' : '';
  return `<li>
      <a class="event-row tone-${category.tone} ${selected}" href="#e-${event.id}" data-route="e-${event.id}">
        <div class="event-date">${days}<small>${months}</small></div>
        <div><h3>${escapeHtml(event.t)}</h3><p>${escapeHtml(subtitle)}</p></div>
      </a>
    </li>`;
}

/** Список событий; full — без собственной прокрутки (на внутренних страницах). */
const eventListHTML = (events, full) =>
  `<ul class="event-list ${full ? 'is-full' : ''}">${events.map(eventRowHTML).join('')}</ul>`;

/** Перерисовывает календарь главной и все календари внутренних страниц. */
function drawCalendars() {
  drawHomeCalendar();
  document.querySelectorAll('[data-calendar]').forEach(drawPageCalendar);
}

/* Главная: один месяц и список его событий */
function drawHomeCalendar() {
  const box = $('#home-month');
  if (!box) return;
  const { year, month } = shownMonth;
  const events = eventsForCalendar('home');
  box.innerHTML =
    `<div class="month-head">
        <button data-month-step="-1" aria-label="Предыдущий месяц">←</button>
        <b>${MONTH_NAMES[month]} ${year}</b>
        <button data-month-step="1" aria-label="Следующий месяц">→</button>
      </div>` + monthGridHTML(year, month, events);
  const monthEvents = events.filter(event =>
    eventOverlaps(event, new Date(year, month, 1), new Date(year, month + 1, 0)),
  );
  $('#home-events').innerHTML = monthEvents.length
    ? eventListHTML(monthEvents)
    : '<p class="empty">В этом месяце событий пока нет.</p>';
}

/* Внутренние страницы: два месяца подряд и под ними списки событий каждого месяца */
function drawPageCalendar(box) {
  const scope = box.dataset.calendar;
  const events = eventsForCalendar(scope);
  const { year, month } = shownMonth;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  box.innerHTML = `<div class="month-nav"><button data-month-step="-1" aria-label="Предыдущий месяц">←</button></div>
    <div class="month-pane"><b>${MONTH_NAMES[month]} ${year}</b>${monthGridHTML(year, month, events)}</div>
    <div class="month-pane second-month"><b>${MONTH_NAMES[nextMonth]} ${nextYear}</b>${monthGridHTML(nextYear, nextMonth, events)}</div>
    <div class="month-nav" style="text-align:right"><button data-month-step="1" aria-label="Следующий месяц">→</button></div>`;

  const list = document.querySelector(`[data-calendar-list="${scope}"]`);
  if (!list) return;
  const columnHTML = (columnYear, columnMonth) => {
    const from = new Date(columnYear, columnMonth, 1);
    const to = new Date(columnYear, columnMonth + 1, 0);
    let columnEvents = events.filter(event => eventOverlaps(event, from, to));
    if (selectedDay) {
      columnEvents = columnEvents.filter(event =>
        eventOverlaps(event, parseIsoDate(selectedDay), parseIsoDate(selectedDay)),
      );
    }
    const content = columnEvents.length
      ? eventListHTML(columnEvents, true)
      : '<p class="empty">Событий нет</p>';
    return `<div class="event-column">${content}</div>`;
  };
  const nothingShown = !events.some(event =>
    eventOverlaps(event, new Date(year, month, 1), new Date(nextYear, nextMonth + 1, 0)),
  );
  const jumpButton = nothingShown
    ? `<div class="calendar-empty"><button data-jump-calendar="${scope}">К ближайшему событию</button></div>`
    : '';
  list.innerHTML =
    `<div class="event-columns">${columnHTML(year, month)}${columnHTML(nextYear, nextMonth)}</div>` +
    jumpButton;
}

/** Легенда цветов календаря для перечисленных типов событий. */
function legendHTML(categories) {
  const items = categories.map(key => {
    const category = EVENT_CATEGORIES[key];
    return `<span><i style="background:${TONE_COLORS[category.tone]}"></i>${category.label}</span>`;
  });
  const today = '<span><i style="box-shadow:inset 0 0 0 1px var(--color-red)"></i>Сегодня</span>';
  return `<div class="legend">${items.join('')}${today}</div>`;
}

/**
 * Месяц, с которого открывается календарь внутренней страницы: текущий,
 * а для спорта и благотворительности — месяц ближайшего события.
 */
function showCalendarMonth(page) {
  const now = new Date();
  shownMonth.year = now.getFullYear();
  shownMonth.month = now.getMonth();
  if (page === 'sport' || page === 'charity-cal') {
    const today = toIsoDate(now);
    const events = eventsForCalendar(page === 'sport' ? 'sport' : 'charity');
    const next = events.find(event => (event.end || event.date) >= today) || events[0];
    if (next) {
      const date = parseIsoDate(next.date < today ? today : next.date);
      shownMonth.year = date.getFullYear();
      shownMonth.month = date.getMonth();
    }
  }
  drawCalendars();
}

/** После обновления событий в базе: перерисовать открытую страницу события или календари. */
function refreshAfterEventsChange() {
  if ($('#admin-panel')) return;
  if (/^#(e-|charity-cal|plan|sport|learning)/.test(location.hash)) route(false);
  else drawCalendars(); // в том числе календарь главной
}

/* ----- Действия в календарях ----- */

onClick('[data-plan-filter]', button => {
  planFilter = button.dataset.planFilter;
  selectedDay = null;
  document
    .querySelectorAll('[data-plan-filter]')
    .forEach(other => other.setAttribute('aria-pressed', other === button));
  drawCalendars();
});

onClick('[data-month-step]', button => {
  shownMonth.month += Number(button.dataset.monthStep);
  if (shownMonth.month < 0) {
    shownMonth.month = 11;
    shownMonth.year--;
  }
  if (shownMonth.month > 11) {
    shownMonth.month = 0;
    shownMonth.year++;
  }
  selectedDay = null;
  drawCalendars();
});

/* «К ближайшему событию»: первое событие после показанных месяцев, а если такого нет — самое первое */
onClick('[data-jump-calendar]', button => {
  const events = eventsForCalendar(button.dataset.jumpCalendar);
  const firstShown = new Date(shownMonth.year, shownMonth.month, 1);
  const lastShown = new Date(shownMonth.year, shownMonth.month + 2, 0);
  const next =
    events.find(
      event => parseIsoDate(event.date) > firstShown && !eventOverlaps(event, firstShown, lastShown),
    ) || events[0];
  if (!next) return;
  const date = parseIsoDate(next.date);
  shownMonth.year = date.getFullYear();
  shownMonth.month = date.getMonth();
  selectedDay = null;
  drawCalendars();
});

/* Клик по дню: на внутренней странице единственное событие дня открывается сразу, иначе день выбирается */
onClick('[data-day]', cell => {
  const day = cell.dataset.day;
  const calendar = cell.closest('[data-calendar]');
  const scope = calendar ? calendar.dataset.calendar : 'home';
  const dayEvents = eventsForCalendar(scope).filter(event =>
    eventOverlaps(event, parseIsoDate(day), parseIsoDate(day)),
  );
  if (dayEvents.length === 1 && calendar) {
    location.hash = 'e-' + dayEvents[0].id;
    return;
  }
  selectedDay = selectedDay === day ? null : day;
  drawCalendars();
});

/* Дни с событиями нажимаются и с клавиатуры */
document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.dataset && event.target.dataset.day) {
    event.preventDefault();
    event.target.click();
  }
});
