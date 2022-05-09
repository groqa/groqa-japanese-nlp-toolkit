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
  