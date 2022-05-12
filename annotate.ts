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
 * The outer-most layer enumerates the *starting* morpheme, the middle layer the ending morpheme, and the fin