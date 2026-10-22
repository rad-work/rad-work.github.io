/* ===== Подключение к Firebase: база Firestore и вход =====
 * Конфиг веб-приложения берётся из Firebase Console → Project settings → Your apps.
 * Правила доступа к базе лежат в firestore.rules.
 */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDCeUKMnA7S64oh_bELOtY-qa6yBpGLljY',
  authDomain: 'vrpuls-69f26.firebaseapp.com',
  projectId: 'vrpuls-69f26',
  storageBucket: 'vrpuls-69f26.firebasestorage.app',
  messagingSenderId: '1015452686802',
  appId: '1:1015452686802:web:d3b3cc1895b8948202d00b',
};
const FIREBASE_SDK_URL = 'https://www.gstatic.com/firebasejs/12.19.0/firebase-';
const INBOX_REFRESH_MS = 30000;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/** Загружает SDK и подписывается на данные. Без базы сайт работает на встроенном контенте. */
async function initFirebase() {
  try {
    if (!FIREBASE_CONFIG.apiKey) throw new Error('Firebase не настроен');
    await loadScript(FIREBASE_SDK_URL + 'app-compat.js');
    await Promise.all(
      ['auth', 'firestore'].map(module => loadScript(FIREBASE_SDK_URL + module + '-compat.js')),
    );
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    auth = firebase.auth();
  } catch (error) {
    db = null;
    auth = null;
  }
  if (!db) {
    dbFailed = true;
    isAdmin = false;
    drawThanksAndIdeas();
    if ($('#admin-panel')) renderAdmin();
    return;
  }
  watchAuth();
  watchCollections();
  if ($('#admin-panel')) renderAdmin();
  setInterval(loadInbox, INBOX_REFRESH_MS);
}

/* Сотрудники входят анонимно (UID нужен для обращений), админы — по почте и паролю */
function watchAuth() {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      userId = null;
      isLoggedIn = false;
      isAdmin = false;
      onAuthChanged();
      auth.signInAnonymously().catch(() => {});
      return;
    }
    userId = user.uid;
    isLoggedIn = !user.isAnonymous;
    isAdmin = isLoggedIn ? null : false; // права админа проверяем по документу admins/<UID>
    onAuthChanged();
    if (!isLoggedIn) return;
    try {
      isAdmin = (await db.collection('admins').doc(user.uid).get()).exists;
    } catch (error) {
      isAdmin = false;
    }
    onAuthChanged();
  });
}

function onAuthChanged() {
  if (isAdmin) loadInbox();
  else store.inbox = null;
  updateEditBar();
  applyTextReplacements();
  if ($('#admin-panel')) renderAdmin();
}

/** Подписка на изменения в базе; если подписаться не удалось, работаем со встроенными данными. */
function subscribe(makeQuery, onChange, onError = () => {}) {
  try {
    makeQuery().onSnapshot(onChange, onError);
  } catch (error) {
    /* подписка не удалась */
  }
}

const docsById = snapshot => Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data()]));

function watchCollections() {
  subscribe(
    () => db.collection('events'),
    snapshot => {
      store.events = docsById(snapshot);
      rebuildEvents();
      refreshAfterEventsChange();
    },
  );

  subscribe(
    () => db.collection('content'),
    snapshot => {
      const texts = snapshot.docs.find(doc => doc.id === 'texts');
      store.texts = texts ? (texts.data().pairs || []).map(pair => [pair.o, pair.n]) : [];
      rebuildTextReplacements();
      applyTextReplacements();
      if ($('#admin-panel') && adminState.tab === 'texts' && !adminState.draft) renderAdmin();
    },
  );

  subscribe(
    () => db.collection('photos'),
    snapshot => {
      store.photos = docsById(snapshot);
      repaintPosts();
      if (/^#a-/.test(location.hash) && !adminState.draft) route(false);
    },
  );

  subscribe(
    () => db.collection('settings'),
    snapshot => {
      const quote = snapshot.docs.find(doc => doc.id === 'quote');
      const links = snapshot.docs.find(doc => doc.id === 'links');
      store.quote = quote ? quote.data() : null;
      store.links = links ? links.data() : null;
      renderUsefulLinks();
      repaintPosts();
    },
  );

  subscribe(
    () => db.collection('posts'),
    snapshot => {
      store.posts = Object.fromEntries(snapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id }]));
      repaintPosts();
    },
  );

  /* Благодарности и идеи: 60 последних */
  ['thanks', 'ideas'].forEach(collection => {
    subscribe(
      () => db.collection(collection).orderBy('ts', 'desc').limit(60),
      snapshot => {
        store[collection] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        drawThanksAndIdeas();
        if (collection === 'thanks' && $('#admin-panel') && !adminState.draft && !isTypingInAdmin())
          renderAdmin();
      },
      () => {
        store[collection] = store[collection] || [];
        drawThanksAndIdeas();
      },
    );
  });
}
