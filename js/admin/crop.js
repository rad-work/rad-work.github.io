/* ===== Фото для постов: уменьшение при загрузке и окно подрезки ===== */

/* Пропорции кадра в окне подрезки */
const CROP_ASPECT_RATIOS = [
  ['Карточка', 1.28],
  ['Главная тема', 1.385],
  ['Широкое 16:9', 16 / 9],
  ['Квадрат', 1],
];

const defaultAspectRatio = section => (section === 'hero' ? 1.385 : 1.28);

/** JPEG из canvas: качество снижаем шагами по 0,1, пока data-URL длиннее 190 000 символов (но не ниже 0,35). */
function compressToJpeg(canvas, quality) {
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 190000 && quality > 0.35) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

/** Уменьшает фото так, чтобы большая сторона была не больше maxSize, и сжимает в JPEG. */
function resizeImageFile(file, maxSize = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(compressToJpeg(canvas, 0.8));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Окно подрезки: фото перетаскивается внутри рамки выбранных пропорций и масштабируется.
 * По «Готово» вызывает onDone(data-URL подрезанного фото шириной до 1000 px).
 */
function openCropDialog(source, initialRatio, onDone) {
  const ratioButtons = CROP_ASPECT_RATIOS.map(
    ([label, value]) =>
      `<button type="button" data-ratio="${value}" aria-pressed="${Math.abs(value - initialRatio) < 0.01}">${label}</button>`,
  ).join('');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-box" role="dialog" aria-label="Подрезка фото">
      <h3>Подрезать фото</h3>
      <div class="crop-ratios">${ratioButtons}</div>
      <div class="crop-frame"><img alt="" draggable="false"></div>
      <label class="crop-zoom">Масштаб <input type="range" min="1" max="3" step="0.01" value="1"></label>
      <p class="small-print">Перетащите фото, чтобы выбрать нужную часть кадра.</p>
      <div class="admin-actions" style="justify-content:flex-end">
        <button type="button" data-crop-action="cancel">Отмена</button>
        <button type="button" class="btn" data-crop-action="save">Готово</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const frame = modal.querySelector('.crop-frame');
  const preview = frame.querySelector('img');
  const zoomInput = modal.querySelector('.crop-zoom input');
  const image = new Image();

  let ratio = initialRatio;
  let frameWidth = 0;
  let frameHeight = 0;
  let baseScale = 1; // масштаб, при котором фото ровно закрывает рамку
  let zoom = 1; // увеличение поверх baseScale (ползунок «Масштаб»)
  let offsetX = 0; // сдвиг левого верхнего угла фото относительно рамки, px (≤ 0)
  let offsetY = 0;
  let drag = null; // положение указателя и фото в начале перетаскивания

  /* Не даём краю фото заехать внутрь рамки */
  const clampOffset = () => {
    const scale = baseScale * zoom;
    offsetX = Math.min(0, Math.max(frameWidth - image.naturalWidth * scale, offsetX));
    offsetY = Math.min(0, Math.max(frameHeight - image.naturalHeight * scale, offsetY));
  };
  const redraw = () => {
    clampOffset();
    const scale = baseScale * zoom;
    preview.style.width = image.naturalWidth * scale + 'px';
    preview.style.height = image.naturalHeight * scale + 'px';
    preview.style.transform = `translate(${offsetX}px,${offsetY}px)`;
  };
  /* Рамка под выбранные пропорции, фото — по центру и без увеличения */
  const layout = () => {
    frameWidth = frame.clientWidth;
    frameHeight = Math.round(frameWidth / ratio);
    frame.style.height = frameHeight + 'px';
    baseScale = Math.max(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight);
    zoom = 1;
    zoomInput.value = 1;
    offsetX = (frameWidth - image.naturalWidth * baseScale) / 2;
    offsetY = (frameHeight - image.naturalHeight * baseScale) / 2;
    redraw();
  };

  image.onload = () => {
    preview.src = source;
    layout();
  };
  image.src = source;

  frame.addEventListener('pointerdown', event => {
    drag = { pointerX: event.clientX, pointerY: event.clientY, offsetX, offsetY };
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('pointermove', event => {
    if (!drag) return;
    offsetX = drag.offsetX + event.clientX - drag.pointerX;
    offsetY = drag.offsetY + event.clientY - drag.pointerY;
    redraw();
  });
  const stopDrag = () => {
    drag = null;
  };
  frame.addEventListener('pointerup', stopDrag);
  frame.addEventListener('pointercancel', stopDrag);

  /* Масштаб меняем относительно центра рамки */
  zoomInput.addEventListener('input', () => {
    const oldScale = baseScale * zoom;
    const centerX = (frameWidth / 2 - offsetX) / oldScale;
    const centerY = (frameHeight / 2 - offsetY) / oldScale;
    zoom = Number(zoomInput.value);
    const newScale = baseScale * zoom;
    offsetX = frameWidth / 2 - centerX * newScale;
    offsetY = frameHeight / 2 - centerY * newScale;
    redraw();
  });

  modal.querySelectorAll('[data-ratio]').forEach(button =>
    button.addEventListener('click', () => {
      ratio = Number(button.dataset.ratio);
      modal
        .querySelectorAll('[data-ratio]')
        .forEach(other => other.setAttribute('aria-pressed', other === button));
      layout();
    }),
  );

  modal.querySelector('[data-crop-action="cancel"]').addEventListener('click', () => modal.remove());
  modal.querySelector('[data-crop-action="save"]').addEventListener('click', () => {
    const scale = baseScale * zoom;
    const sourceWidth = frameWidth / scale;
    const sourceHeight = frameHeight / scale;
    const outputWidth = Math.min(1000, Math.round(sourceWidth));
    const outputHeight = Math.round(outputWidth / ratio);
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    canvas
      .getContext('2d')
      .drawImage(
        image,
        -offsetX / scale,
        -offsetY / scale,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );
    const dataUrl = compressToJpeg(canvas, 0.82);
    modal.remove();
    onDone(dataUrl);
  });
}
