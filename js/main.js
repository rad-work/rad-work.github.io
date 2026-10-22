/* ===== Запуск сайта ===== */

addPlanEvents(); // события из плана на 2027 год → SITE.events
rebuildEvents();
updateEditBar(); // полоса режима правки, если он был включён в этой вкладке
rebuildTextReplacements();
initFirebase(); // база подключается асинхронно; до этого сайт показывает встроенный контент
route(false);
