"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const curtiz_utils_1 = require("curtiz-utils");
const fs_1 = require("fs");
const jmdict_furigana_node_1 = require("jmdict-furigana-node");
const jmdict_simplified_node_1 = require("jmdict-simplified-node");
const kamiya_codec_1 = require("kamiya-codec");
const path_1 = __importDefault(require("path"));
const chino_particles_1 = require("./chino-particles");
const jdepp_1 = require("./jdepp");
const kanjidic_1 = require("./kanjidic");
const mecabUnidic_1 = require("./mecabUnidic");
__export(require("./interfaces"));
var jmdict_furigana_node_2 = require("jmdict-furigana-node");
exports.furiganaToString = jmdict_furigana_node_2.furiganaToString;
exports.setupJmdictFurigana = jmdict_furigana_node_2.setup;
var jmdict_simplified_node_2 = require("jmdict-simplified-node");
exports.getField = jmdict_simplified_node_2.getField;
exports.jmdictFuriganaPromise = jmdict_furigana_node_1.setup(process.env['JMDICT_FURIGANA']);
exports.jmdictPromise = jmdict_simplified_node_1.setup(process.env['JMDICT_SIMPLIFIED_LEVELDB'] || 'jmdict-simplified', process.env['JMDICT_SIMPLIFIED_JSON'] ||
    fs_1.readdirSync('.').sort().reverse().find(s => s.startsWith('jmdict-eng') && s.endsWith('.json')) ||
    'jmdict-eng-3.1.0.json', true, true);
/**
 * Without this limit on how many Leveldb hits jmdict-simplified-node will get, things slow way down. Not much loss in
 * usefulness with this set to 20.
 */
const DICTIONARY_LIMIT = 20;
function mecabJdepp(sentence, nBest = 1) {
    return __awaiter(this, void 0, void 0, function* () {
        let rawMecab = yield mecabUnidic_1.invokeMecab(sentence, nBest);
        let { morphemes: allSentencesMorphemes, raws: allSentencesRaws } = mecabUnidic_1.parseMecab(rawMecab, nBest);
        // throw away multiple sentences, we're only going to pass in one (hopefully)
        const morphemes = allSentencesMorphemes[0];
        const raws = allSentencesRaws[0];
        const bunsetsus = yield Promise.all(morphemes.map((attempt, idx) => jdepp_1.addJdepp(raws[idx], attempt)));
        return morphemes.map((attempt, idx) => ({ morphemes: attempt, bunsetsus: bunsetsus[idx] }));
    });
}
exports.mecabJdepp = mecabJdepp;
const p = (x) => console.dir(x, { depth: null });
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
function enumerateDictionaryHits(plainMorphemes, full = true, limit = -1) {
    return __awaiter(this, void 0, void 0, function* () {
        const { db } = yield exports.jmdictPromise;
        const simplify = (c) => (c.left || c.right) ? c : c.cloze;
        const jmdictFurigana = yield exports.jmdictFuriganaPromise;
        const morphemes = plainMorphemes.map(m => (Object.assign(Object.assign({}, m), { 
            // if "symbol" POS, don't needlessly double the number of things to search for later in forkingPaths
            searchKanji: unique(m.partOfSpeech[0].startsWith('symbol') ? [m.literal] : [m.literal, m.lemma]), searchReading: unique(morphemeToSearchLemma(m).concat(morphemeToStringLiteral(m, jmdictFurigana))) })));
        const superhits = [];
        for (let startIdx = 0; startIdx < morphemes.length; startIdx++) {
            const results = [];
            if (!full) {
                const pos = morphemes[startIdx].partOfSpeech;
                if (pos[0].startsWith('supplementary') || pos[0].startsWith('auxiliary')) {
                    // skip these
                    superhits.push({ startIdx, results });
                    continue;
                }
            }
            for (let endIdx = Math.min(morphemes.length, startIdx + 5); endIdx > startIdx; --endIdx) {
                const run = morphemes.slice(startIdx, endIdx);
                const runLiteralCore = bunsetsuToString(run);
                const runLiteral = simplify(curtiz_utils_1.generateContextClozed(bunsetsuToString(morphemes.slice(0, startIdx)), runLiteralCore, bunsetsuToString(morphemes.slice(endIdx))));
                if (!full) {
                    // skip particles like は and も if they're by themselves as an optimization
                    if (runLiteralCore.length === 1 && curtiz_utils_1.hasKana(runLiteralCore[0]) && runLiteralCore === run[0].lemma) {
                        continue;
                    }
                }
                const scored = [];
                function helperSearchesHitsToScored(searches, subhits, searchKey) {
                    return curtiz_utils_1.flatten(subhits.map((v, i) => v.map(w => {
                        // help catch issues with automatic type widening and excess property checks
                        const ret = {
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
                    const readingSubhits = yield Promise.all(readingSearches.map(search => jmdict_simplified_node_1.readingBeginning(db, search, DICTIONARY_LIMIT)));
                    scored.push(...helperSearchesHitsToScored(readingSearches, readingSubhits, 'kana'));
                }
                // Search literals if needed, this works around MeCab mis-readings like お父さん->おちちさん
                {
                    const kanjiSearches = forkingPaths(run.map(m => m.searchKanji)).map(v => v.join('')).filter(curtiz_utils_1.hasKanji);
                    const kanjiSubhits = yield Promise.all(kanjiSearches.map(search => jmdict_simplified_node_1.kanjiBeginning(db, search, DICTIONARY_LIMIT)));
                    scored.push(...helperSearchesHitsToScored(kanjiSearches, kanjiSubhits, 'kanji'));
                }
                scored.sort((a, b) => b.score - a.score);
                if (scored.length > 0) {
                    results.push({ endIdx, run: runLiteral, results: curtiz_utils_1.dedupeLimit(scored, o => o.wordId, limit) });
                }
            }
            if (results.length === 0) {
                // we didn't find ANYTHING for this morpheme? Try character by character
                const m = morphemes[startIdx];
                const scored = [];
                for (const [searches, searchFn, key] of [[m.searchReading, jmdict_simplified_node_1.readingBeginning, 'kana'],
                    [m.searchKanji, jmdict_simplified_node_1.kanjiBeginning, 'kanji'],
                ]) {
                    for (const search of searches) {
                        const all = Array.from(curtiz_utils_1.allSubstrings(search));
                        const subhits = yield Promise.all(all.map(search => searchFn(db, search, DICTIONARY_LIMIT)));
                        for (const [idx, hits] of subhits.entries()) {
                            const search = all[idx];
                            for (const w of hits) {
                                const score = scoreMorphemeWord([m], search, key, w);
                                scored.push({ wordId: w.id, score, search, tags: {} });
                            }
                        }
                    }
                }
                if (scored.length > 0) {
                    scored.sort((a, b) => b.score - a.score);
                    const endIdx = startIdx + 1;
                    const run = morphemes.slice(startIdx, endIdx);
                    const runLiteralCore = bunsetsuToString(run);
                    const runLiteral = simplify(curtiz_utils_1.generateContextClozed(bunsetsuToString(morphemes.slice(0, startIdx)), runLiteralCore, bunsetsuToString(morphemes.slice(endIdx))));
                    results.push({ endIdx, run: runLiteral, results: curtiz_utils_1.dedupeLimit(scored, o => o.wordId, limit) });
                }
            }
            {
                // add relateds
                for (const r of results) {
                    const words = yield jmdictIdsToWords(r.results);
                    const xrefs = words.flatMap(w => w.sense.flatMap(s => s.related));
                    const references = yield Promise.all(xrefs.flatMap(x => jmdict_simplified_node_1.getXrefs(db, x).then(refs => ({ refs, xref: x }))));
                    for (const { refs, xref } of references) {
                        for (const word of refs) {
                            r.results.push({ wordId: word.id, score: 0, search: JSON.stringify({ xref }), tags: {}, isXref: true });
                        }
                    }
                }
            }
            superhits.push({ startIdx, results });
        }
        return superhits;
    });
}
exports.enumerateDictionaryHits = enumerateDictionaryHits;
function scoreMorphemeWord(run, searched, searchKey, word) {
    const len = searched.length;
    // if the shortest kana is shorter than the search, let the cost be 0. If shortest kana is longer than search, let the
    // overrun cost be negative. Shortest because we're being optimistic
    const overrunPenalty = Math.min(0, len - Math.min(...word[searchKey].filter(k => k.text.includes(searched)).map(k => k.text.length)));
    // literal may contain kanji that lemma doesn't, e.g., 大阪's literal in UniDic is katakana
    const wordKanjis = new Set(curtiz_utils_1.flatten(word.kanji.map(