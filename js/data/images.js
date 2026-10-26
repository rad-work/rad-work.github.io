/*
 * Встроенные фото сайта: ключ → путь к файлу в assets/img.
 * Ключи пишутся в контенте (SITE: поля img и imgs) и в постах, сохранённых в базе,
 * поэтому их нельзя переименовывать.
 */
// prettier-ignore
const IMAGE_NAMES = [
  'xf1', 'lib3', 'lib4', 'vac1', 'sh2', 'hero', 'c1', 'c2', 'c3', 't1', 't2', 't3', 'l1',
  'l2', 'learn', 'n1a', 'n1b', 'k1', 'k2', 'ct1', 'ct2', 'cit1', 'cit2', 'gifts1',
  'chef1', 'chef2', 'chef3', 'chef4', 'chef5', 'chef6', 'chef7', 'chef8', 'chef9', 'chef10',
];

const IMAGES = Object.fromEntries(IMAGE_NAMES.map(name => [name, `assets/img/${name}.jpg`]));
