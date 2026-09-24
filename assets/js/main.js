(() => {
  'use strict';

  /* ======================================================================
     Шапка: тень при прокрутке и мобильное меню
     ====================================================================== */

  const header = document.querySelector('[data-header]');
  const burger = header.querySelector('.burger');
  const nav = document.getElementById('nav');

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    header.classList.toggle('is-menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  burger.addEventListener('click', () => setMenu(!header.classList.contains('is-menu-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Ссылки на страницы, которых пока нет, никуда не ведут и не прыгают наверх.
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[data-stub]')) e.preventDefault();
  });

  /* ======================================================================
     Модели: кнопка → карточка дрона
     Картинка ищется по тексту кнопки: assets/img/drones/<текст>.webp.
     Чтобы добавить модель — добавьте кнопку в HTML и файл с тем же именем.
     ====================================================================== */

  const DRONE_IMG_DIR = 'assets/img/drones/';
  const droneImageUrl = (name) => `${DRONE_IMG_DIR}${encodeURIComponent(name)}.webp`;

  const SPEC_LABELS = ['взлетный вес', 'полетное время', 'крейсерская скорость', 'грузоподъемность'];

  // Данные карточек. Для моделей без записи показывается заглушка.
  const DRONES = {
    'OG-25': {
      desc: 'VTOL лёгкого класса. Взлетает с площадки 6×6 м без полосы. Для логистики, мониторинга и патрулирования.',
      specs: ['до 30 кг', 'до 3 ч', '100 км/ч', 'до 10 кг'],
    },
  };

  const droneStub = (name) => ({
    desc: `Описание ${name} — заглушка. Здесь будет коротко о модели: класс аппарата, способ взлёта и основные задачи.`,
    specs: ['—', '—', '—', '—'],
  });

  const tabList = document.querySelector('[data-drone-tabs]');
  const card = document.querySelector('[data-drone-card]');
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  const ui = {
    name: card.querySelector('[data-drone-name]'),
    desc: card.querySelector('[data-drone-desc]'),
    specs: card.querySelector('[data-drone-specs]'),
    img: card.querySelector('[data-drone-img]'),
    placeholder: card.querySelector('[data-drone-placeholder]'),
    placeholderName: card.querySelector('[data-drone-placeholder-name]'),
    buy: card.querySelector('[data-buy]'),
  };

  const tabName = (tab) => tab.textContent.trim();

  // name → Promise<boolean>: есть ли картинка (загружаем один раз)
  const imageCache = new Map();
  const loadDroneImage = (name) => {
    if (!imageCache.has(name)) {
      imageCache.set(name, new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = droneImageUrl(name);
      }));
    }
    return imageCache.get(name);
  };

  const renderSpecs = (values) => {
    ui.specs.replaceChildren(...SPEC_LABELS.map((label, i) => {
      const item = document.createElement('div');
      item.className = 'spec';
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = values[i] ?? '—';
      item.append(dt, dd);
      return item;
    }));
  };

  let currentDrone = tabName(tabs.find((t) => t.classList.contains('is-active')) || tabs[0]);

  async function showDrone(tab, { focus = false } = {}) {
    const name = tabName(tab);

    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    if (focus) tab.focus({ preventScroll: true });
    // на узких экранах полоса вкладок прокручивается — центрируем выбранную (только по горизонтали)
    if (tabList.scrollWidth > tabList.clientWidth) {
      const offset = tab.getBoundingClientRect().left - tabList.getBoundingClientRect().left;
      tabList.scrollBy({ left: offset - (tabList.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
    }

    if (name === currentDrone) return;
    currentDrone = name;

    card.classList.add('is-loading');
    void card.offsetWidth; // фиксируем прозрачность, чтобы снятие класса запустило плавное появление

    const data = DRONES[name] || droneStub(name);
    card.setAttribute('aria-labelledby', tab.id);
    ui.name.textContent = name;
    ui.desc.textContent = data.desc;
    renderSpecs(data.specs);
    ui.buy.dataset.model = name;

    const hasImage = await loadDroneImage(name);
    if (currentDrone !== name) return; // пока грузилось, выбрали другую модель

    if (hasImage) {
      ui.img.src = droneImageUrl(name);
      ui.img.alt = `Беспилотник ${name}`;
      ui.img.hidden = false;
      ui.placeholder.hidden = true;
      await ui.img.decode().catch(() => {});
      if (currentDrone !== name) return;
    } else {
      ui.img.hidden = true;
      ui.placeholderName.textContent = name;
      ui.placeholder.hidden = false;
    }

    card.classList.remove('is-loading');
  }

  tabList.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) showDrone(tab);
  });

  // Стрелки / Home / End — как в стандартных вкладках
  tabList.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    showDrone(tabs[next], { focus: true });
  });

  // Ссылки на модели в подвале открывают нужную вкладку, если она есть
  document.querySelectorAll('[data-model-link]').forEach((link) => {
    link.addEventListener('click', () => {
      const tab = tabs.find((t) => tabName(t) === link.textContent.trim());
      if (tab) showDrone(tab);
    });
  });

  // Когда страница загрузилась — подгружаем фото остальных моделей заранее
  window.addEventListener('load', () => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    idle(() => tabs.forEach((t) => loadDroneImage(tabName(t))));
  });

  /* ======================================================================
     Форма заявки
     ====================================================================== */

  const form = document.querySelector('[data-lead-form]');
  const orgField = form.querySelector('[data-org-field]');
  const orgInput = orgField.querySelector('input');

  function setClientType(type) {
    const isPerson = type === 'person';
    form.classList.toggle('is-person', isPerson);
    orgField.hidden = isPerson;
    orgInput.disabled = isPerson; // скрытое поле не отправляется
    form.elements.client_type.value = type;
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'client_type') setClientType(e.target.value);
  });

  // «Купить» и «Записаться» подставляют текст в сообщение (если его не меняли вручную)
  let autoMessage = '';
  function prefill(text, clientType) {
    const message = form.elements.message;
    if (!message.value.trim() || message.value === autoMessage) {
      message.value = text;
      autoMessage = text;
    }
    if (clientType) setClientType(clientType);
  }

  document.addEventListener('click', (e) => {
    const buy = e.target.closest('[data-buy]');
    if (buy) prefill(`Здравствуйте! Интересует покупка ${buy.dataset.model || currentDrone}.`);
    if (e.target.closest('[data-signup]')) {
      prefill('Здравствуйте! Хочу записаться на программу подготовки пилотов БАС.', 'person');
    }
  });
})();
