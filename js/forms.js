/* ===== Формы сотрудников: благодарность, обращение в Службу заботы ===== */

const NEED_LOGIN_TEXT = 'Отправка доступна после входа в учётную запись.';
const SEND_FAILED_TEXT = 'Не удалось отправить. Попробуйте ещё раз.';

/* Благодарность уходит на модерацию (care/<uid>/items) */
document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-form="thanks"]');
  if (!form) return;
  event.preventDefault();
  const status = form.querySelector('.form-status');
  const text = form.elements.namedItem('text').value.trim();
  const name = form.elements.namedItem('name').value.trim();
  if (!text) return;
  if (!db || !userId) {
    status.textContent = NEED_LOGIN_TEXT;
    return;
  }
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const userDoc = db.collection('care').doc(userId);
    await userDoc.set({ ts: Date.now() });
    await userDoc.collection('items').add({ kind: 'thanks', text, name, status: 'new', ts: Date.now() });
    form.reset();
    status.textContent = 'Спасибо! Записка появится на стене после проверки администратором.';
  } catch (error) {
    status.textContent = SEND_FAILED_TEXT;
  }
  button.disabled = false;
});

/* Обращение в Службу заботы видят только админы */
document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-form="care"]');
  if (!form) return;
  event.preventDefault();
  const field = name => form.elements.namedItem(name);
  const status = form.querySelector('.form-status');
  const text = field('text').value.trim();
  if (!text) return;
  if (!db || !userId) {
    status.textContent = NEED_LOGIN_TEXT;
    return;
  }
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const userDoc = db.collection('care').doc(userId);
    await userDoc.set({ ts: Date.now() });
    await userDoc.collection('items').add({
      kind: 'care',
      status: 'new',
      text,
      topic: field('topic').value,
      contact: field('wantContact').checked ? field('contact').value.trim() : '',
      ts: Date.now(),
    });
    form.reset();
    status.textContent = 'Спасибо, обращение отправлено.';
  } catch (error) {
    status.textContent = SEND_FAILED_TEXT;
  }
  button.disabled = false;
});
