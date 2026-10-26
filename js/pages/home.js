/* ===== Главная страница ===== */

let currentSlide = 0; // номер показанной «Главной темы»
let slideTimer = null; // автопереключение тем

function homePage() {
  const now = new Date();
  const today = `${now.getDate()} ${MONTH_NAMES_GENITIVE[now.getMonth()]} ${now.getFullYear()}`;
  return (
    `<div class="masthead"><span class="masthead-date">${today}</span><h1>VR РИТМ</h1></div>
    <section>
      <div class="section-head"><h2>Главная тема</h2></div>
      <div class="hero">
        <div class="hero-main">
          <div id="hero-photo"></div>
          <div>
            <h3 id="hero-title"></h3>
            <p id="hero-text"></p>
            <div class="hero-controls"><a class="btn" id="hero-link" href="#">Читать</a><div class="slide-dots" id="hero-dots"></div></div>
          </div>
        </div>
        <aside class="quote" id="week-quote">${quoteHTML(currentQuote())}</aside>
      </div>
    </section>
    <section id="events">
      <div class="section-head"><h2>Мероприятия</h2></div>
      <div class="home-calendar">
        <div class="month-card" id="home-month"></div>
        <div id="home-events" style="min-height:0;height:100%"></div>
      </div>
    </section>` +
    homeSectionHTML('team') +
    homeSectionHTML('charity') +
    careSectionHTML() +
    homeSectionHTML('library') +
    homeSectionHTML('surveys') +
    thanksSectionHTML()
  );
}

/** Запуск главной после отрисовки: тема, календарь и автопереключение тем раз в 8 секунд. */
function startHomePage() {
  drawHeroSlide();
  drawCalendars();
  if (visiblePosts('hero').length > 1 && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
    slideTimer = setInterval(() => {
      currentSlide = (currentSlide + 1) % Math.max(1, visiblePosts('hero').length);
      drawHeroSlide();
    }, 8000);
  }
}

/* ----- «Главная тема» и цитата недели ----- */

function drawHeroSlide() {
  const slides = visiblePosts('hero');
  if (!slides.length || !$('#hero-title')) return;
  if (currentSlide >= slides.length) currentSlide = 0;
  const slide = slides[currentSlide];
  $('#hero-title').textContent = slide.t;
  $('#hero-text').textContent = slide.d || '';
  $('#hero-link').href = '#a-' + slide.id;
  $('#hero-link').dataset.route = 'a-' + slide.id;
  $('#hero-photo').innerHTML = pictureHTML(slide.img, slide.t, slide.fx, slide.fy);
  drawSlideDots();
}

function drawSlideDots() {
  const dots = $('#hero-dots');
  if (!dots) return;
  const slides = visiblePosts('hero');
  const buttons = slides.map(
    (_, i) =>
      `<button data-slide="${i}" aria-label="Тема ${i + 1}" aria-current="${i === currentSlide}"></button>`,
  );
  dots.innerHTML = slides.length > 1 ? buttons.join('') : ''; // одна тема — точки не нужны
}

function quoteHTML(quote) {
  const paragraphs = quote.p.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
  return `<span class="eyebrow">${escapeHtml(quote.label)}</span>
      <div class="quote-text">${paragraphs}</div>
      <div class="quote-author">${escapeHtml(quote.by)}</div>`;
}

onClick('[data-slide]', dot => {
  currentSlide = Number(dot.dataset.slide);
  drawHeroSlide();
});

/* ----- Разделы с карточками и опросы ----- */

/** Раздел с карточками; если их больше четырёх — карусель со стрелками справа от заголовка. */
function homeSectionHTML(sectionId) {
  if (sectionId === 'surveys') return surveysSectionHTML();
  const title = SITE.groups.find(group => group.id === sectionId).title;
  const posts = visiblePosts(sectionId);
  const isCarousel = posts.length > 4;
  const arrows = `<div class="carousel-nav">
        <button type="button" data-carousel-step="-1" aria-label="Назад">←</button>
        <button type="button" data-carousel-step="1" aria-label="Вперёд">→</button>
      </div>`;
  return `<section id="${sectionId}"${isCarousel ? ' class="carousel is-scrollable"' : ''}>
      <div class="section-head"><h2>${title}</h2>${isCarousel ? arrows : ''}</div>
      ${cardsHTML(posts)}
    </section>`;
}

function cardsHTML(posts) {
  if (!posts.length) return '<p class="empty">Скоро здесь появятся материалы.</p>';
  const cards = posts.map(
    post => `<div class="card">
          ${pictureHTML(post.img, post.t, post.fx, post.fy)}
          <div class="card-body">
            <h3>${escapeHtml(post.t)}</h3>
            <p>${escapeHtml(post.d || '')}</p>
            <a class="more-link" href="#a-${post.id}" data-route="a-${post.id}">Подробнее →</a>
          </div>
        </div>`,
  );
  return `<div class="card-grid">${cards.join('')}</div>`;
}

function surveysSectionHTML() {
  const rows = visiblePosts('surveys').map(survey => {
    const isExternal = survey.url && /^https?:/.test(survey.url);
    const link = isExternal
      ? `href="${escapeHtml(survey.url)}" target="_blank" rel="noopener"`
      : `href="#a-${survey.id}" data-route="a-${survey.id}"`;
    const closedStyle = survey.tag === 'Закрыт' ? ' style="color:var(--color-muted)"' : '';
    return `<li>
          <a ${link}>
            <div><h3>${escapeHtml(survey.t)}</h3><p>${escapeHtml(survey.d || '')}</p></div>
            <span class="survey-status"${closedStyle}>${escapeHtml(survey.tag || 'Открыт')}</span>
          </a>
        </li>`;
  });
  return `<section id="surveys">
      <div class="section-head"><h2>Опросы</h2></div>
      <ul class="survey-list">${rows.join('')}</ul>
    </section>`;
}

/** После изменения постов в базе: перерисовать разделы с карточками (на главной и в плане), цитату и админку. */
function repaintPosts() {
  ['team', 'charity', 'library', 'surveys'].forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) section.outerHTML = homeSectionHTML(sectionId);
  });
  if ($('#hero-title')) drawHeroSlide();
  if ($('#week-quote')) $('#week-quote').innerHTML = quoteHTML(currentQuote());
  if ($('#admin-panel') && !adminState.draft && !isTypingInAdmin()) renderAdmin();
}

/* ----- Служба заботы и слова благодарности ----- */

function careSectionHTML() {
  const care = SITE.care;
  const topics = care.topics.map(topic => `<option>${topic}</option>`).join('');
  return `<section id="care">
      <div class="care">
        <div class="care-grid">
          <div><h2>${care.h}</h2><p>${care.lede}</p><p>${care.note}</p></div>
          <form class="form" data-form="care">
            <label class="form-title" for="care-topic">Тема</label>
            <select id="care-topic" name="topic">${topics}</select>
            <label class="form-title" for="care-text">Ваше обращение</label>
            <textarea id="care-text" name="text" rows="4" maxlength="1500" required placeholder="Опишите ситуацию или вопрос"></textarea>
            <input name="contact" id="care-contact" maxlength="120" placeholder="Как с вами связаться (необязательно)" aria-label="Контакт для связи">
            <label class="checkbox"><input type="checkbox" name="wantContact" id="care-want-contact"> Хочу, чтобы со мной связались</label>
            <button class="btn" type="submit">Отправить</button>
            <div class="form-status" role="status"></div>
          </form>
        </div>
      </div>
    </section>`;
}

function thanksSectionHTML() {
  return `<section id="thanks">
      <div class="thanks">
        <div class="thanks-intro">
          <h2>Слова благодарности</h2>
          <p>Напишите коллеге спасибо: записка появится рядом, и её увидит вся компания.</p>
          <form class="form" data-form="thanks">
            <label for="thanks-text" class="form-title">Кого и за что поблагодарить?</label>
            <input id="thanks-text" name="text" maxlength="160" required placeholder="Например: Оле за помощь с релизом" autocomplete="off">
            <input name="name" maxlength="40" placeholder="Подпись (необязательно)" autocomplete="off" aria-label="Подпись">
            <button class="btn pill" type="submit">Прикрепить записку</button>
            <span class="form-status" role="status"></span>
          </form>
        </div>
        <div class="thanks-notes" id="thanks-list"></div>
      </div>
    </section>`;
}

/**
 * Записки на стене благодарностей.
 * Пока данные из базы не пришли, стена пустая; если база не подключилась — записки-примеры.
 */
function drawThanks() {
  const thanksList = $('#thanks-list');
  const notes = dbFailed ? SAMPLE_THANKS : store.thanks;
  if (thanksList && notes) {
    thanksList.innerHTML = notes.length
      ? notes
          .slice(0, 6)
          .map(
            (note, i) => `<article class="thanks-note color-${i % 3}">
            <span class="pin"></span>
            <p>${escapeHtml(note.text)}</p>
            ${note.name ? `<small>от ${escapeHtml(note.name)}</small>` : ''}
          </article>`,
          )
          .join('')
      : '<p class="empty">Пока записок нет — будьте первыми.</p>';
  }
}

/* ----- Карусель карточек ----- */

function updateCarouselButtons(carousel) {
  const grid = carousel.querySelector('.card-grid');
  const buttons = carousel.querySelectorAll('[data-carousel-step]');
  if (!grid || !buttons.length) return;
  buttons[0].disabled = grid.scrollLeft <= 2;
  buttons[1].disabled = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 2;
}

function updateAllCarousels() {
  document.querySelectorAll('.carousel.is-scrollable').forEach(updateCarouselButtons);
}

/* Стрелка прокручивает ровно на одну карточку */
onClick('[data-carousel-step]', button => {
  const grid = button.closest('.carousel').querySelector('.card-grid');
  const card = grid.querySelector('.card');
  if (!card) return;
  const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(grid).columnGap || 0);
  grid.scrollBy({ left: Number(button.dataset.carouselStep) * step, behavior: 'smooth' });
});

document.addEventListener(
  'scroll',
  event => {
    const grid = event.target;
    if (grid?.classList?.contains('card-grid') && grid.parentNode.classList.contains('carousel')) {
      updateCarouselButtons(grid.parentNode);
    }
  },
  true,
);

let carouselTimer = null;
new MutationObserver(() => {
  clearTimeout(carouselTimer);
  carouselTimer = setTimeout(updateAllCarousels, 60);
}).observe(document.body, { childList: true, subtree: true });
addEventListener('resize', updateAllCarousels);
