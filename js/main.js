/* ===== Запуск сайта ===== */

addPlanEvents(); // события из плана на 2027 год → SITE.events
rebuildEvents();
rebuildTextReplacements();
initFirebase(); // база подключается асинхронно; до этого сайт показывает встроенный контент
route(false);
