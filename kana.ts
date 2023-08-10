let hiragana = "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなに" +
               "ぬねのはばぱひびぴふぶぷへべぺほぼまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ";
let katakana = "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニ" +
               "ヌネノハバパヒビピフブプヘベペホボマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ";

if (hiragana.length !== katakana.length) { throw new Error('Kana strings not same length?'); }

export let kata2hiraMap: Map<string, string> = new Map([]);
export let hira2kataMap: Map<string, string> = new Map([]);
hiragana.split('').forEach((h, i) => {
  kata2hiraMap.set(katakana[i], h);
  hira2kataMap.set(h, katakana[i])
});

export function kata2hira(s: string) { return s.split('').map(c => kata2hiraMap.get(c) |