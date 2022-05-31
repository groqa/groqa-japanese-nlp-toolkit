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
               