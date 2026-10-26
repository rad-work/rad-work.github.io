/* ===== Замены функций, которых нет в старых браузерах (телевизоры 2018–2020 годов, Chrome 56–72) ===== */

if (!Object.fromEntries) {
  Object.fromEntries = entries => {
    const result = {};
    for (const [key, value] of entries) result[key] = value;
    return result;
  };
}

if (!String.prototype.padStart) {
  String.prototype.padStart = function (length, filler) {
    let text = String(this);
    while (text.length < length) text = filler + text;
    return text.slice(-Math.max(length, String(this).length));
  };
}

/* Только для глобальных регулярных выражений (флаг g); вместо итератора возвращает массив совпадений */
if (!String.prototype.matchAll) {
  String.prototype.matchAll = function (regexp) {
    const pattern = new RegExp(regexp.source, regexp.flags);
    const matches = [];
    let match;
    while ((match = pattern.exec(this))) {
      matches.push(match);
      if (!match[0]) pattern.lastIndex++; // пустое совпадение — сдвигаемся, иначе цикл не закончится
    }
    return matches;
  };
}
