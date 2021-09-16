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
 * The outer-most layer enumerates the *starting* mor