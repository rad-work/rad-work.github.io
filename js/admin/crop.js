/* ===== Фото для постов: уменьшение при загрузке и окно обрезки ===== */

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
 * Окно обрезки, как в фоторедакторе: фото видно целиком, поверх — рамка на всё фото.
 * Рамку тянут за углы и края и передвигают.
 * По «Готово» вызывает onDone(data-URL обрезанного фото, большая сторона до 1000 px).
 */
function openCropDialog(source, onDone) {
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    .map(handle => `<span class="crop-handle" data-handle="${handle}"></span>`)
    .join('');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-box" role="dialog" aria-label="Обрезка фото">
      <h3>Обрезать фото</h3>
      <div class="crop-area">
        <div class="crop-stage"><img alt="" draggable="false"><div class="crop-box">${handles}</div></div>
      </div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button type="button" data-crop-action="cancel">Отмена</button>
        <button type="button" class="btn" data-crop-action="save">Готово</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const area = modal.querySelector('.crop-area');
  const stage = modal.querySelector('.crop-stage');
  const preview = stage.querySelector('img');
  const box = stage.querySelector('.crop-box');
  const image = new Image();

  let scale = 1; // во сколько раз фото на экране меньше настоящего
  let crop = { x: 0, y: 0, w: 0, h: 0 }; // рамка в пикселях настоящего фото
  let drag = null; // что тянем, где был указатель и рамка в начале

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const minSide = () => 40 / scale; // рамка не меньше 40 px на экране

  const redraw = () => {
    box.style.left = crop.x * scale + 'px';
    box.style.top = crop.y * scale + 'px';
    box.style.width = crop.w * scale + 'px';
    box.style.height = crop.h * scale + 'px';
  };
  /* Фото целиком вписываем в окно по ширине и по высоте экрана */
  const layout = () => {
    if (!image.naturalWidth) return; // фото ещё не загрузилось
    const padding = parseFloat(getComputedStyle(area).paddingLeft) || 0;
    const maxWidth = area.clientWidth - 2 * padding;
    const maxHeight = Math.max(160, window.innerHeight * 0.55);
    scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    stage.style.width = image.naturalWidth * scale + 'px';
    stage.style.height = image.naturalHeight * scale + 'px';
    redraw();
  };
  /* Тянем край или угол: двигаются только его стороны, противоположные стоят на месте */
  const resize = (handle, dx, dy) => {
    const start = drag.crop;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.w;
    let bottom = start.y + start.h;
    if (handle.includes('w')) left = clamp(left + dx, 0, right - minSide());
    if (handle.includes('e')) right = clamp(right + dx, left + minSide(), image.naturalWidth);
    if (handle.includes('n')) top = clamp(top + dy, 0, bottom - minSide());
    if (handle.includes('s')) bottom = clamp(bottom + dy, top + minSide(), image.naturalHeight);
    crop = { x: left, y: top, w: right - left, h: bottom - top };
  };

  image.onload = () => {
    preview.src = source;
    crop = { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
    layout();
  };
  image.src = source;

  area.addEventListener('pointerdown', event => {
    const handleElement = event.target.closest('[data-handle]');
    const handle = handleElement && handleElement.dataset.handle;
    if (!handle && !box.contains(event.target)) return;
    drag = {
      handle: handle || 'move',
      pointerX: event.clientX,
      pointerY: event.clientY,
      crop: Object.assign({}, crop),
    };
    area.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  area.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = (event.clientX - drag.pointerX) / scale;
    const dy = (event.clientY - drag.pointerY) / scale;
    if (drag.handle === 'move') {
      crop.x = clamp(drag.crop.x + dx, 0, image.naturalWidth - crop.w);
      crop.y = clamp(drag.crop.y + dy, 0, image.naturalHeight - crop.h);
    } else {
      resize(drag.handle, dx, dy);
    }
    redraw();
  });
  const stopDrag = () => {
    drag = null;
  };
  area.addEventListener('pointerup', stopDrag);
  area.addEventListener('pointercancel', stopDrag);
  window.addEventListener('resize', layout);

  const close = () => {
    window.removeEventListener('resize', layout);
    modal.remove();
  };
  modal.querySelector('[data-crop-action="cancel"]').addEventListener('click', close);
  modal.querySelector('[data-crop-action="save"]').addEventListener('click', () => {
    const outputScale = Math.min(1, 1000 / Math.max(crop.w, crop.h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.w * outputScale));
    canvas.height = Math.max(1, Math.round(crop.h * outputScale));
    canvas
      .getContext('2d')
      .drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    const dataUrl = compressToJpeg(canvas, 0.82);
    close();
    onDone(dataUrl);
  });
}
