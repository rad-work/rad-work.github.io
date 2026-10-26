/* ===== Страница поста: текст, альбом фото (раскладка как в Telegram), просмотр фото, файлы ===== */

function postPage(post) {
  return (
    backLinkHTML(post.anchor ? post.anchor : post.back, 'Назад') +
    `<div class="post-page">
      <h1 class="page-title" style="font-size:clamp(32px,5vw,max(60px,3rem))">${escapeHtml(post.t)}</h1>
      ${albumHTML([post.img, ...(post.imgs || [])], post.t)}
      ${post.d && !post.body ? `<p>${escapeHtml(post.d)}</p>` : ''}
      ${postBodyHTML(post.body)}
      ${filesListHTML(post.files)}
    </div>`
  );
}

/* Сколько фото в каждой строке альбома при 1–9 фото */
const ALBUM_LAYOUTS = {
  1: [1],
  2: [2],
  3: [3],
  4: [2, 2],
  5: [2, 3],
  6: [3, 3],
  7: [2, 2, 3],
  8: [2, 3, 3],
  9: [3, 3, 3],
};

/** Размеры строк альбома; больше девяти фото — по три в строке, без одинокого фото в конце. */
function albumRowSizes(count) {
  if (ALBUM_LAYOUTS[count]) return ALBUM_LAYOUTS[count];
  const sizes = [];
  for (let left = count; left > 0;) {
    const size = left % 3 === 1 && left > 3 ? 2 : Math.min(3, left);
    sizes.push(size);
    left -= size;
  }
  return sizes;
}

function albumHTML(refs, alt) {
  const photos = (refs || []).filter(ref => ref && imageUrl(ref));
  if (!photos.length) return '';
  let next = 0;
  const rows = albumRowSizes(photos.length).map(size => {
    const images = photos
      .slice(next, (next += size))
      .map(
        ref => `<img src="${escapeHtml(imageUrl(ref))}" alt="${escapeHtml(alt || '')}" style="flex:1 1 0">`,
      );
    return `<div class="album-row">${images.join('')}</div>`;
  });
  return `<div class="album${photos.length === 1 ? ' is-single' : ''}">${rows.join('')}</div>`;
}

/* Фото альбома занимает в строке ширину по своим пропорциям */
document.addEventListener(
  'load',
  event => {
    const image = event.target;
    if (image?.matches?.('.album img') && image.naturalHeight) {
      image.style.flexGrow = (image.naturalWidth / image.naturalHeight).toFixed(3);
      image.style.aspectRatio = image.naturalWidth + '/' + image.naturalHeight;
    }
  },
  true,
);

/* Клик по фото альбома открывает его на весь экран; закрывается кликом или Esc */
onClick('.album img', image => {
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `<img src="${image.src}" alt="">`;
  lightbox.addEventListener('click', () => lightbox.remove());
  document.body.appendChild(lightbox);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelector('.lightbox')?.remove();
});
