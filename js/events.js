/* ===== События: встроенные (SITE.events), из плана на 2027 год и из базы ===== */

/* Типы событий: подпись в фильтрах, подпись одного события и цвет в календаре. Ключи хранятся в базе. */
const EVENT_CATEGORIES = {
  corp: { label: 'Корпоративные мероприятия', singular: 'Корпоративное мероприятие', tone: 'grey' },
  prof: { label: 'Профессиональные праздники', singular: 'Профессиональный праздник', tone: 'blue' },
  charity: { label: 'Благотворительность', singular: 'Благотворительная акция', tone: 'green' },
  learn: { label: 'Обучение', singular: 'Обучение', tone: 'green' },
  sport: { label: 'Спорт', singular: 'Спортивная активность', tone: 'blue' },
};

/* ----- События из плана: все с пометкой «плановая дата» (soft) ----- */

/** Неделя плана по её понедельнику «ДД.ММ» 2027 года → { date, end } на семь дней. */
function planWeekDates(monday) {
  const [day, month] = monday.split('.');
  const start = new Date(2027, +month - 1, +day);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { date: toIsoDate(start), end: toIsoDate(end) };
}

/** Описание корпоративной активности по её названию в плане. */
function corporateEventText(activity) {
  const planText = pattern => (PLAN_2027.corp.find(row => pattern.test(row.t)) || {}).x || '';
  if (/нов(ому|ый|огод)/i.test(activity))
    return 'Новый год ГК VR и компаний группы. ' + planText(/Новый год/);
  if (/23 февраля|8 марта/i.test(activity)) return planText(/23 февраля/);
  if (/дни рождения/i.test(activity)) {
    return (
      'Дни рождения компаний группы: VR LOGISTIC, Premium World, БАС ГЛОРИ ЭЙР. ' + planText(/VR LOGISTIC/)
    );
  }
  if (/тимбилдинг/i.test(activity)) return planText(/Командообразующие/);
  if (/летнее/i.test(activity)) return planText(/Летнее/);
  return 'Анонс и коммуникация в каналах ГК VR. Подробности появятся ближе к дате.';
}

/** Описание спортивной активности по её названию в плане. */
function sportEventText(activity) {
  const planText = (rows, pattern) => (rows.find(row => pattern.test(row.t)) || {}).x || '';
  if (/запуск/i.test(activity)) return planText(PLAN_2027.sport, /клуб/i);
  if (/турнир/i.test(activity)) return planText(PLAN_2027.sport, /подразделен/i);
  if (/подготовка/i.test(activity)) return planText(PLAN_2027.sport1, /Подготовка/);
  if (/забег|марафон/i.test(activity)) return planText(PLAN_2027.sport1, /Городские/);
  if (/фитнес|тренировк/i.test(activity)) return planText(PLAN_2027.sport2, /фитнес/i);
  return 'Подведение итогов спортивного сезона.';
}

/** Добавляет в SITE.events праздники, корпоративные, спортивные и благотворительные события из плана. */
function addPlanEvents() {
  PLAN_2027.hol.forEach((holiday, index) => {
    const [day, month] = holiday.d.split('.');
    SITE.events.push({
      id: 'h' + index,
      date: `2027-${month}-${day}`,
      t: holiday.t,
      cat: 'prof',
      sub: holiday.c,
      d: holiday.x,
      sc: ['plan', 'home'],
      soft: 1,
    });
  });

  PLAN_2027.weeks
    .filter(week => /^Корп/.test(week.s))
    .forEach(week => {
      SITE.events.push(
        Object.assign({ id: 'c' + week.n }, planWeekDates(week.d), {
          t: capitalize(week.a.replace(/\*/g, '')),
          cat: 'corp',
          d: corporateEventText(week.a),
          sc: ['plan', 'home'],
          soft: 1,
        }),
      );
    });

  PLAN_2027.weeks
    .filter(week => week.s === 'Спорт')
    .forEach(week => {
      SITE.events.push(
        Object.assign({ id: 's' + week.n }, planWeekDates(week.d), {
          t: capitalize(week.a),
          cat: 'sport',
          d: sportEventText(week.a),
          sc: ['sport', 'plan', 'home'],
          soft: 1,
        }),
      );
    });

  addPlanCharityEvents();
  add2026Events();
}

/* Благотворительность: акции раз в квартал ставим в свободные («резервные») недели плана, даты уточняются */
function addPlanCharityEvents() {
  const howOften = pattern => (PLAN_2027.char.find(row => pattern.test(row.t)) || {}).w;
  const add = (id, weekNumber, title, text) =>
    SITE.events.push(
      Object.assign({ id }, planWeekDates(PLAN_2027.weeks.find(week => week.n === weekNumber).d), {
        t: title,
        cat: 'charity',
        d: text + ' Точные даты и место будут объявлены дополнительно.',
        sc: ['plan', 'charity', 'home'],
        soft: 1,
      }),
    );

  /* id события — префикс и порядковый номер акции в году */
  const quarterlyActions = [
    {
      idPrefix: 'ch-s',
      weeks: [10, 22, 34, 46],
      title: 'Помощь приюту для животных',
      text: 'Сбор вещей и пожертвований для приюта, передача и отчёт. ' + howOften(/приют/) + '.',
    },
    {
      idPrefix: 'ch-d',
      weeks: [4, 16, 28, 40],
      title: 'Донорская акция',
      text: 'Анонс, регистрация, проведение и итоги донорской акции. ' + howOften(/Донор/) + '.',
    },
    {
      idPrefix: 'ch-f',
      weeks: [12, 24, 36, 44],
      title: 'Прививки от гриппа',
      text: 'Организация прививок от гриппа для сотрудников. ' + howOften(/Прививки/) + '.',
    },
  ];
  quarterlyActions.forEach(({ idPrefix, weeks, title, text }) =>
    weeks.forEach((week, i) => add(idPrefix + i, week, title, text)),
  );
  add(
    'ch-b',
    48,
    'Помощь детскому дому посёлка Бетлица',
    'Новогодняя акция «Стань Дедом Морозом»: сбор подарков по списку желаний детей, передача и отчёт.',
  );
}

/* Ближайшие события конца 2026 года по тому же плану: праздники с фиксированной датой и повторяющиеся блоки */
function add2026Events() {
  const holidays = [
    [/народного единства/, 'hn'],
    [/работника транспорта$/, 'ht'],
    [/Международный день гражданской авиации/, 'ha'],
    [/Конституции/, 'hk'],
    [/День таможенника/, 'hc'],
  ];
  holidays.forEach(([pattern, id]) => {
    const holiday = PLAN_2027.hol.find(item => pattern.test(item.t));
    if (!holiday) return;
    const [day, month] = holiday.d.split('.');
    SITE.events.push({
      id: id + '26',
      date: `2026-${month}-${day}`,
      t: holiday.t,
      cat: 'prof',
      sub: holiday.c,
      d: holiday.x,
      sc: ['plan', 'home'],
      soft: 1,
    });
  });

  const yearEndEvents = [
    {
      id: 'c26a',
      date: '2026-12-14',
      end: '2026-12-20',
      t: 'Итоговая коммуникация',
      cat: 'corp',
      d: corporateEventText('новый год'),
      sc: ['plan', 'home'],
    },
    {
      id: 'c26b',
      date: '2026-12-21',
      end: '2026-12-27',
      t: 'Новогодние мероприятия',
      cat: 'corp',
      d: corporateEventText('новогодние'),
      sc: ['plan', 'home'],
    },
    {
      id: 'c26c',
      date: '2026-12-28',
      end: '2027-01-03',
      t: 'Поздравление / итоги',
      cat: 'corp',
      d: corporateEventText('новый год'),
      sc: ['plan', 'home'],
    },
    {
      id: 's26',
      date: '2026-12-07',
      end: '2026-12-13',
      t: 'Итоги спортсезона',
      cat: 'sport',
      d: sportEventText('итоги'),
      sc: ['sport', 'plan', 'home'],
    },
    {
      id: 'ch26',
      date: '2026-12-07',
      end: '2026-12-13',
      t: 'Помощь детскому дому посёлка Бетлица',
      cat: 'charity',
      d: 'Новогодняя акция «Стань Дедом Морозом»: сбор подарков по списку желаний детей. Точные даты сбора будут опубликованы дополнительно.',
      sc: ['plan', 'charity', 'home'],
    },
  ];
  yearEndEvents.forEach(event => SITE.events.push(Object.assign({}, event, { soft: 1 })));
}

/* ----- Итоговый список событий ----- */

let visibleEvents = []; // все нескрытые события по дате

const EVENT_FIELDS = ['t', 'date', 'end', 'cat', 'time', 'place', 'd', 'sc', 'soft', 'hidden'];

/** Известные поля события из документа базы (только заданные). */
function pickEventFields(doc) {
  const fields = {};
  EVENT_FIELDS.forEach(name => {
    if (doc[name] !== undefined) fields[name] = doc[name];
  });
  return fields;
}

/** Встроенные события с правками из базы и новые события из базы — по дате, включая скрытые. */
function allEvents() {
  const docs = store.events || {};
  const builtin = SITE.events.map(event => {
    const override = docs['ev__' + event.id];
    return override
      ? Object.assign({}, event, pickEventFields(override), { id: event.id, edited: true })
      : Object.assign({}, event);
  });
  /* id нового события — id его документа в базе («ec…») */
  const added = Object.entries(docs)
    .filter(([, doc]) => doc.custom)
    .map(([docId, doc]) =>
      Object.assign(pickEventFields(doc), { sc: doc.sc || ['plan'], id: docId, custom: true }),
    );
  return [...builtin, ...added]
    .filter(event => event.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function rebuildEvents() {
  visibleEvents = allEvents().filter(event => !event.hidden);
}

/** События одного календаря; в плане коммуникаций — с учётом выбранного фильтра. */
function eventsForCalendar(scope) {
  return visibleEvents.filter(
    event =>
      event.sc.includes(scope) && (scope !== 'plan' || planFilter === 'all' || event.cat === planFilter),
  );
}

/** { 'ГГГГ-ММ-ДД': [события дня] }; многодневное событие попадает в каждый свой день. */
function eventsByDay(events) {
  const days = {};
  events.forEach(event => {
    const last = parseIsoDate(event.end || event.date);
    for (const day = parseIsoDate(event.date); day <= last; day.setDate(day.getDate() + 1)) {
      const key = toIsoDate(day);
      (days[key] = days[key] || []).push(event);
    }
  });
  return days;
}

/** Пересекается ли событие с периодом from…to (оба — Date). */
const eventOverlaps = (event, from, to) =>
  parseIsoDate(event.date) <= to && parseIsoDate(event.end || event.date) >= from;
