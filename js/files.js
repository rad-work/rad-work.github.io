/* ===== Файлы к постам =====
 * Файл хранится в базе частями: документ files/<id> с описанием и files/<id>_0, <id>_1, … с кусками base64.
 */

// prettier-ignore
const ALLOWED_FILE_EXTENSIONS = [
  'gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'txt', 'json', 'md',
  'docx', 'pptx', 'epub', 'csv', 'ttf', 'html', 'svg', 'pdf', 'xlsx', 'zip',
];
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const FILE_CHUNK_LENGTH = 180000; // символов base64 в одном документе

/* Файлы, встроенные прямо в код (у файла есть поле emb). Сейчас таких нет. */
const EMBEDDED_FILES = {};

/* Файлы, показанные на открытой странице, по id — для кнопки «Скачать» */
const shownFiles = {};

const fileExtension = name => (String(name).split('.').pop() || '').toLowerCase();

function formatFileSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1).replace('.', ',') + ' МБ';
  return Math.max(1, Math.round(bytes / 1024)) + ' КБ';
}

/** Собирает файл из частей в базе. */
async function loadFileBlob(file) {
  let base64 = '';
  if (file.emb) {
    base64 = EMBEDDED_FILES[file.emb] || '';
  } else {
    if (!db) throw new Error('db');
    const chunks = [];
    for (let i = 0; i < (file.n || 1); i++) {
      const snapshot = await db
        .collection('files')
        .doc(file.id + '_' + i)
        .get();
      const chunk = snapshot && (snapshot.data ? snapshot.data() : snapshot);
      if (!chunk || !chunk.d) throw new Error('chunk');
      chunks.push(chunk.d);
    }
    base64 = chunks.join('');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes]);
}

async function downloadFile(fileId) {
  const file = shownFiles[fileId];
  if (!file) return;
  showToast('Готовим файл…');
  try {
    const url = URL.createObjectURL(await loadFileBlob(file));
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    showToast('Не удалось получить файл. Попробуйте ещё раз.');
  }
}

/** Блок «Файлы» на странице поста. */
function filesListHTML(files) {
  const list = (files || []).filter(file => file && file.name);
  if (!list.length) return '';
  list.forEach(file => (shownFiles[file.id] = file));
  const rows = list.map(
    file => `<div class="file-row">
        <div><b>${escapeHtml(file.name)}</b><small>${escapeHtml(fileExtension(file.name).toUpperCase())} · ${formatFileSize(file.size || 0)}</small></div>
        <button type="button" data-download="${escapeHtml(file.id)}">Скачать</button>
      </div>`,
  );
  return `<div class="post-files">
      <h3>Файлы</h3>
      ${rows.join('')}
    </div>`;
}

/** Загружает файл в базу частями и возвращает его описание для поста. */
async function uploadFile(file) {
  const extension = fileExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) throw new Error('ext:' + extension);
  if (file.size > MAX_FILE_SIZE) throw new Error('size');
  const dataUrl = await readFileAsDataUrl(file);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const id = 'fl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const chunkCount = Math.max(1, Math.ceil(base64.length / FILE_CHUNK_LENGTH));
  for (let i = 0; i < chunkCount; i++) {
    const chunk = base64.slice(i * FILE_CHUNK_LENGTH, (i + 1) * FILE_CHUNK_LENGTH);
    await db
      .collection('files')
      .doc(id + '_' + i)
      .set({ d: chunk });
  }
  await db
    .collection('files')
    .doc(id)
    .set({ name: file.name, size: file.size, n: chunkCount, ts: Date.now() });
  return { id, name: file.name, size: file.size, n: chunkCount };
}

/** Удаляет загруженный файл из базы (ошибки игнорируем — файл просто останется). */
async function deleteUploadedFile(file) {
  if (!file || file.emb || !db) return;
  try {
    for (let i = 0; i < (file.n || 1); i++)
      await db
        .collection('files')
        .doc(file.id + '_' + i)
        .delete();
    await db.collection('files').doc(file.id).delete();
  } catch (error) {
    /* не удалось удалить — не страшно */
  }
}

onClick('[data-download]', button => downloadFile(button.dataset.download));
