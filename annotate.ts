import {
  allSubstrings,
  dedupeLimit,
  flatten,
  generateContextClozed,
  hasHiragana,
  hasKana,
  hasKanji,
  kata2hira
} from 'curtiz-utils'
import {readdirSync, readFileSync} from 'fs';
import {Entry, Furigana, JmdictFurigana, Ruby, setup as setupJmdictFurigana} from 'jmdict-furigana-node';
import {
  getField,
  getTags as getTagsDb,
  getXrefs,
  idsToWords,
  kanjiBeginning,
  readingBeginning,
  Sense,
  setup as setupJmdict,
  Tag,
  Word,
  Xref,
} from 'jmdict-simplified-node';
import {adjDeconjugate, AdjDeconjugated, Deconjugated, verbDeconjugate} from 'kamiya-codec';
import path from 'path';

import {lookup} from './chino-particles';
import {
  ConjugatedPhrase,
  ContextCloze,
  FillInTheBlanks,
  Particle,
  ScoreHit,
  ScoreHits,
  SearchMapped,
  v1ResSentence,
  v1ResSentenceNbest
} from './interfaces';
import {addJdepp, Bunsetsu} from './jdepp';
import {setupSimple as kanjidicSetup, SimpleCharacter} from './kanjidic';
import {invokeMecab, maybeMorphemesToMorphemes, Morpheme, parseMecab} from './mecabUnidic';

export * from './interfaces';

export {
  Entry,
  Furigana,
  furiganaToString,
  JmdictFurigana,
  Ruby,
  setup as setupJmdictFurigana
} from 'jmdict-furigana-node';
export {getField} from 'jmdict-simplified-node';

export const jmdictFuriganaPromise = setupJmdictFurigana(process.env['JMDICT_FURIGANA']);
export const jmdictPromise = setupJmdict(
    process.env['JMDICT_SIMPLIFIED_LEVELDB'] || 'jmdict-simplified',
    process.env['JMDICT_SIMPLIFIED_JSON'] ||
        readdirSync('.').sort().reverse().find(s => s.startsWith('jmdict-eng') && s.endsWith('.json')) ||
        'jmdict-eng-3.1.0.json',
    true,
    true,
);

/**
 * Without this limit on how many Leveldb hits jmdict-simplified-node will get, things slow way down. Not much loss in
 * usefulness with this set to 20.
 */
const DICTIONARY_LIMIT = 20;

/**
 * Outer index: 1 through `nBest` MeCab parsings.
 * Inner index: individual morphemes/bunsetsu
 */
interface MecabJdeppParsed {
  morphemes: Morpheme[];
  bunsetsus: Bunsetsu<Morpheme>[];
}
export async function mecabJdepp(sentence: string, nBest = 1): Promise<MecabJdeppParsed[]> {
  let rawMecab = await invokeMecab(sentence, nBest);
  let {morphemes: allSentencesMorphemes, raws: allSentencesRaws} = parseMecab(rawMecab, nBest);
  // throw away multiple sentences, we're only going to pass in one (hopefully)
  const morphemes = allSentencesMorphemes[0];
  const raws = allSentencesRaws[0];
  const bunsetsus = await Promise.all(morphemes.map((attempt, idx) => addJdepp(raws[idx], attempt)))
  return morphemes.map((attempt, idx) => ({morphemes: attempt, bunsetsus: bunsetsus[idx]}));
}

const p = (x: any) => console.dir(x, {depth: null});
type WithSearchReading<T> = T&{ searchReading: string[]; };
type WithSearchKanji<T> = T&{ searchKanji: string[]; };
/**
 * Given MeCab morphemes, return a triply-nested array of JMDict hits.
 *
 * The outer-most layer enumerates the *starting* morpheme, the middle layer the ending morpheme, and the final
 * inner-most layer the list of dictionary hits for the sequence of morphemes between the start and end.
 *
 * Roughly, in code (except we might not find anything for all start-to-end sequences):
 * ```js
 * for (let startIdx = 0; startIdx < morphemes.length; startIdx++) {
 *  for (let endIdx = morphemes.length; endIdx > startIdx; endIdx--) {
 *    result.push(JMDict.search(morpehemes.slice(startIdx, endIdx)));
 *  }
 * }
 * ```
 */
export async function enumerateDictionaryHits(plainMorphemes: Morpheme[], full = true,
                                              limit = -1): Promise<ScoreHits[]> {
  const {db} = await jmdictPromise;
  const simplify = (c: ContextCloze) => (c.left || c.right) ? c : c.cloze;

  const jmdictFurigana = await jmdictFuriganaPromise;
  const morphemes: WithSearchKanji<WithSearchReading<Morpheme>>[] = plainMorphemes.map(
      m => ({
        ...m,
        // if "symbol" POS, don't needlessly double the number of things to search for later in forkingPaths
        searchKanji: unique(m.partOfSpeech[0].startsWith('symbol') ? [m.literal] : [m.literal, m.lemma]),
        searchReading: unique(morphemeToSearchLemma(m).concat(morphemeToStringLiteral(m, jmdictFurigana)))
      }));
  const superhits: ScoreHits[] = [];
  for (let startIdx = 0; startIdx < morphemes.length; startIdx++) {
    const results: ScoreHits['results'] = [];

    if (!full) {
      const pos = morphemes[startIdx].partOfSpeech;
      if (pos[0].startsWith('supplementary') || pos[0].startsWith('auxiliary')) {
        // skip these
        superhits.push({startIdx, results});
        continue;
      }
    }

    for (let endIdx = Math.min(morphemes.length, startIdx + 5); endIdx > startIdx; --endIdx) {
      const run = morphemes.slice(startIdx, endIdx);
      const runLiteralCore = bunsetsuToString(run);
      const runLiteral = simplify(generateContextClozed(bunsetsuToString(morphemes.slice(0, startIdx)), runLiteralCore,
                                                        bunsetsuToString(morphemes.slice(endIdx))));
      if (!full) {
        // skip particles like は and も if they're by themselves as an optimization
        if (runLiteralCore.length === 1 && hasKana(runLiteralCore[0]) && runLiteralCore === run[0].lemma) { continue; }
      }
      const scored: ScoreHit[] = [];

      function helperSearchesHitsToScored(searches: string[], subhits: Word[][],
                                          searchKey: "kana"|"kanji"): ScoreHit[] {
        return flatten(subhits.map((v, i) => v.map(w => {
          // help catch issues with automatic type widening and excess property checks
          const ret: ScoreHit = {
            wordId: w.id,
            score: scoreMorphemeWord(run, searches[i], searchKey, w),
            search: searches[i],
            tags: {}
            // run: runLiteral,
            // runIdx: [startIdx, endIdx - 1],
          };
          return ret;
        })));
      }
      // Search reading
      {
        const readingSearches = forkingPaths(run.map(m => m.searchReading)).map(v => v.join(''));
        // Consider searching rendaku above for non-initial morphemes? It'd be nice if "猿ちえお" (saru chi e o) found
        // "猿知恵" (さるぢえ・さるじえ)

        const readingSubhits =
            await Promise.all(readingSearches.map(search => readingBeginning(db, search, DICTIONARY_LIMIT)));
        scored.push(...helperSearchesHitsToScored(readingSearches, readingSubhits, 'kana'));
      }
      // Search literals if needed, this works around MeCab mis-readings like お父さん->おちちさん
      {
        const kanjiSearches = forkingPaths(run.map(m => m.searchKanji)).map(v => v.join('')).filter(hasKanji);
        const kanjiSubhits =
            await Promise.all(kanjiSearches.map(search => kanjiBeginning(db, search, DICTIONARY_LIMIT)));
        scored.push(...helperSearchesHitsToScored(kanjiSearches, kanjiSubhits, 'kanji'));
      }

      scored.sort((a, b) => b.score - a.score);
      if (scored.length > 0) {
        results.push({endIdx, run: runLiteral, results: dedupeLimit(scored, o => o.wordId, limit)});
      }
    }

    if (results.length === 0) {
      // we didn't find ANYTHING for this morpheme? Try character by character
      const m = morphemes[startIdx];

      const scored: ScoreHit[] = [];

      for (const [searches, searchFn, key] of [[m.searchReading, readingBeginning, 'kana'],
                                               [m.searchKanji, kanjiBeginning, 'kanji'],
      ] as const) {
        for (const search of searches) {
          const all = Array.from(allSubstrings(search));
          const subhits = await Promise.all(all.map(search => searchFn(db, search, DICTIONARY_LIMIT)));
          for (const [idx, hits] of subhits.entries()) {
            const search = all[idx];
            for (const w of hits) {
              const score = scoreMorphemeWord([m], search, key, w)
              scored.push({wordId: w.id, score, search, tags: {}});
            }
          }
        }
      }

      if (scored.length > 0) {
        scored.sort((a, b) => b.score - a.score);
        const endIdx = startIdx + 1;

        const run = morphemes.slice(startIdx, endIdx);
        const runLiteralCore = bunsetsuToString(run);
        const runLiteral = simplify(generateContextClozed(bunsetsuToString(morphemes.slice(0, startIdx)),
                                                          runLiteralCore, bunsetsuToString(morphemes.slice(endIdx))));

        results.push({endIdx, run: runLiteral, results: dedupeLimit(scored, o => o.wordId, limit)});
      }
    }
    {
      // add relateds
      for (const r of results) {
        const words = await jmdictIdsToWords(r.results);
        const xrefs = words.flatMap(w => w.sense.flatMap(s => s.related));
        const references = await Promise.all(xrefs.flatMap(x => getXrefs(db, x).then(refs => ({refs, xref: x}))));

        for (const {refs, xref} of references) {
          for (const word of refs) {
            r.results.push({wordId: word.id, score: 0, search: JSON.stringify({xref}), tags: {}, isXref: true})
          }
        }
      }
    }
    superhits.push({startIdx, results});
  }
  return superhits;
}
function scoreMorphemeWord(run: Morpheme[], searched: string, searchKey: 'kana'|'kanji', word: Word): number {
  const len = searched.length;

  // if the shortest kana is shorter than the search, let the cost be 0. If shortest kana is longer than search, let the
  // overrun cost be negative. Shortest because we're being optimistic
  const overrunPenalty =
      Math.min(0, len - Math.min(...word[searchKey].filter(k => k.text.includes(searched)).map(k => k.text.length)));

  // literal may contain kanji that lemma doesn't, e.g., 大阪's literal in UniDic is katakana
  const wordKanjis = new Set(flatten(word.kanji.map(k => k.text.split('').filter(hasKanji))));
  const lemmaKanjis = new Set(flatten(run.map(m => m.lemma.split('').filter(hasKanji))));
  const literalKanjis = new Set(flatten(run.map(m => m.literal.split('').filter(hasKanji))));
  const lemmaKanjiBonus = intersectionSize(lemmaKanjis, wordKanjis);
  const literalKanjiBonus = intersectionSize(literalKanjis, wordKanjis);

  // make sure one-morpheme particles rise to the top of the pile of 10k hits...
  const particleBonus = +(run.length === 1 && run[0].partOfSpeech.some(pos => pos.includes('particle')) &&
                          word.sense.some(sense => sense.partOfSpeech.includes('prt')));

  return overrunPenalty * 10 + literalKanjiBonus * 2 + lemmaKanjiBonus * 1 + 5 * particleBonus;
}
function intersection<T>(small: Set<T>, big: Set<T>): Set<T> {
  if (small.size > big.size * 1.1) { return intersection(big, small); }
  const ret: Set<T> = new Set();
  for (const x of small) {
    if (big.has(x)) { ret.add(x) }
  }
  return ret;
}
function intersectionSize<T>(small: Set<T>, big: Set<T>): number {
  if (small.size > big.size * 1.1) { return intersectionSize(big, small); }
  let ret = 0;
  for (const x of small) { ret += +big.has(x); }
  return ret;
}
function unique<T>(v: T[]): T[] { return [...new Set(v)]; }

const circledNumbers = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿".split('');
const prefixNumber = (n: number) => circledNumbers[n] || `(${n + 1})`;
export function displayWord(w: Word) {
  return w.kanji.map(k => k.text).join('・') + '「' + w.kana.map(k => k.text).join('・') + '」：' +
         w.sense.map((sense, n) => prefixNumber(n) + ' ' + sense.gloss.map(gloss => gloss.text).join('/')).join('; ');
}

function printXrefs(v: Xref[]) { return v.map(x => x.join(',')).join(';'); }
export function displayWordLight(w: Word, tags: Record<string, string>) {
  const kanji = w.kanji.map(k => k.text).join('・');
  const kana = w.kana.map(k => k.text).join('・');

  type TagKey = {[K in keyof Sense]: Sense[K] extends Tag[] ? K : never}[keyof Sense];
  const tagFields: Partial<Record<TagKey, string>> = {dialect: '🗣', field: '🀄️', misc: '✋'};
  const s =
      w.sense
          .map((sense, n) => prefixNumber(n) + ' ' + sense.gloss.map(gloss => gloss.text).join('/') +
                             (sense.related.length ? ` (👉 ${printXrefs(sense.related)})` : '') +
                             (sense.antonym.length ? ` (👈 ${printXrefs(sense.antonym)})` : '') +
                             Object.entries(tagFields)
                                 .map(([k, v]) => sense[k as TagKey].length
                                                      ? ` (${v} ${sense[k as TagKey].map(k => tags[k]).join('; ')})`
                                                      : '')
                                 .join(''))
          .join(' ');
  // console.error(related)
  return `${kanji}「${kana}」| ${s}`;
}
export function displayWordDetailed(w: Word, tags: {[k: string]: string}) {
  return w.kanji.concat(w.kana).map(k => k.text).join('・') + '：' +
         w.sense
             .map((sense, n) => prefixNumber(n) + ' ' + sense.gloss.map(gloss => gloss.text).join('/') + ' {*' +
                                sense.partOfSpeech.map(pos => tags[pos]).join('; ') + '*}')
             .join('; ') +
         ' #' + w.id;
}

/**
 * Cartesian product.
 *
 * Treats each sub-array in an array of arrays as a list of choices for that slot, and enumerates all paths.
 *
 * So [['hi', 'ola'], ['Sal']] => [['hi', 'Sal'], ['ola', 'Sal']]
 *
 */
function forkingPaths<T>(v: T[][]): T[][] {
  let ret: T[][] = [[]];
  for (const u of v) { ret = flatten(u.map(x => ret.map(v => v.concat(x)))); }
  return ret;
}

const bunsetsuToString = (morphemes: Morpheme[]) => morphemes.map(m => m.literal).join('');
function betterMorphemePredicate(m: Morpheme): boolean {
  return !(m.partOfSpeech[0] === 'supplementary_symbol') && !(m.partOfSpeech[0] === 'particle');
}

async function morphemesToConjPhrases(startIdx: number, goodBunsetsu: Morpheme[], fullCloze: ContextCloze,
                                      verbose = false): Promise<ConjugatedPhrase> {
  const endIdx = startIdx + goodBunsetsu.length;
  const cloze = bunsetsuToString(goodBunsetsu);
  const jf = await jmdictFuriganaPromise;

  const lemmas = goodBunsetsu.map(o => {
    const entries = jf.textToEntry.get(o.lemma) || [];
    if (o.lemma.endsWith('-他動詞') && o.partOfSpeech[0] === 'verb') {
      // sometimes ("ひいた" in "かぜひいた"), UniDic lemmas are weird like "引く-他動詞" eyeroll
      entries.push(...(jf.textToEntry.get(o.lemma.replace('-他動詞', '')) || []))
    }
    const lemmaReading = kata2hira(o.lemmaReading);
    const entry = entries.find(e => e.reading === lemmaReading);
    return entry ? entry.furigana : o.lemma === lemmaReading ? [lemmaReading] : [{ruby: o.lemma, rt: lemmaReading}];
  });

  const ret: ConjugatedPhrase = {deconj: [], startIdx, endIdx, morphemes: goodBunsetsu, cloze: fullCloze, lemmas};

  const first = goodBunsetsu[0];
  const pos0 = first.partOfSpeech[0];
  const pos0Last = first.partOfSpeech[first.partOfSpeech.length - 1];
  const verbNotAdj = pos0.startsWith('verb') || pos0.endsWith('_verb') || pos0Last === 'verbal_suru';
  const ichidan = first.inflectionType?.[0].includes('ichidan');
  const iAdj = pos0.endsWith('adjective_i');

  const deconjs: (AdjDeconjugated|Deconjugated)[] = [];
  for (const mergeSuffixes of [true, false]) {
    // sometimes the lemma is too helpful: "ワンダフル-wonderful", so split on dash
    let dictionaryForm = goodBunsetsu[0].lemma.split('-')[0];
    if (mergeSuffixes) {
      const nonSuffixIdx = goodBunsetsu.findIndex