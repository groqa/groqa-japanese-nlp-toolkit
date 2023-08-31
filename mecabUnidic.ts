#!/usr/bin/env node
const spawn = require('child_process').spawn;
const assert = require('assert')
import{partitionBy, flatten} from 'curtiz-utils';

// https://gist.github.com/masayu-a/e3eee0637c07d4019ec9 "prepared by Irena Srdanovic, 17.1.2013, checked by Ogiso, Den
// and Maekawa"
const partOfSpeechKeys = [
  "代名詞",
  "pronoun",
  "副詞",
  "adverb",
  "助動詞",
  "auxiliary_verb",
  "助詞",
  "particle",
  "係助詞",
  "binding",
  "副助詞",
  "adverbial",
  "接続助詞",
  "conjunctive",
  "格助詞",
  "case",
  "準体助詞",
  "nominal",
  "終助詞",
  "phrase_final",
  "動詞",
  "verb",
  "一般",
  "general",
  "非自立可能",
  "bound",
  "名詞",
  "noun",
  "助動詞語幹",
  "auxiliary",
  "固有名詞",
  "proper",
  "人名",
  "name",
  "名",
  "firstname",
  "姓",
  "surname",
  "地名",
  "place",
  "国",
  "country",
  "数詞",
  "numeral",
  "普通名詞",
  "common",
  "サ変可能",
  "verbal_suru",
  "サ変形状詞可能",
  "verbal_adjectival",
  "副詞可能",
  "adverbial_suffix",
  "助数詞可能",
  "counter",
  "形状詞可能",
  "adjectival",
  "形容詞",
  "adjective_i",
  "形状詞",
  "adjectival_noun",
  "タリ",
  "tari",
  "感動詞",
  "interjection",
  "フィラー",
  "filler",
  "接尾辞",
  "suffix",
  "動詞的",
  "verbal",
  "名詞的",
  "nominal_suffix",
  "助数詞",
  "counter_suffix",
  "形容詞的",
  "adjective_i_suffix",
  "形状詞的",
  "adjectival_noun_suffix",
  "接続詞",
  "conjunction",
  "接頭辞",
  "prefix",
  "空白",
  "whitespace",
  "補助記号",
  "supplementary_symbol",
  "ＡＡ",
  "ascii_art",
  "顔文字",
  "emoticon",
  "句点",
  "period",
  "括弧閉",
  "bracket_open",
  "括弧開",
  "bracket_close",
  "読点",
  "comma",
  "記号",
  "symbol",
  "文字",
  "character",
  "連体詞",
  "adnominal",
  "未知語",
  "unknown_words",
  "カタカナ文",
  "katakana",
  "漢文",
  "chinese_writing",
  "言いよどみ",
  "hesitation",
  "web誤脱",
  "errors_omissions",
  "方言",
  "dialect",
  "ローマ字文",
  "latin_alphabet",
  "新規未知語",
  "new_unknown_words"
];

// https://gist.github.com/masayu-a/3e11168f9330e2d83a68 "prepared by Irena Srdanovic, 18.1.2013 and 22.1.2013"
const inflectionKeys = [
  "ク語法",     "ku_wording",
  "仮定形",     "conditional",
  "一般",       "general",
  "融合",       "integrated",
  "命令形",     "imperative",
  "已然形",     "realis",
  "補助",       "auxiliary_inflection",
  "意志推量形", "volitional_tentative",
  "未然形",     "irrealis",
  "サ",         "sa",
  "セ",         "se",
  "撥音便",     "euphonic_change_n",
  "終止形",     "conclusive",
  "ウ音便",     "euphonic_change_u",
  "促音便",     "euphonic_change_t",
  "語幹",       "word_stem",
  "連体形",     "attributive",
  "イ音便",     "euphonic_change_i",
  "省略",       "abbreviation",
  "連用形",     "continuative",
  "ト",         "change_to",
  "ニ",         "change_ni",
  "長音",       "long_sound",
  "*",          "uninflected"
];

// https://gist.github.com/masayu-a/b3ce862336e47736e84f "prepared by Irena Srdanovic, 18.1.2013 and 22.1.2013"
const inflectionTypeKeys = [
  "ユク",         "yuku",
  "ダ行",         "da_column",
  "ザ行変格",     "zahen_verb_irregular",
  "ダ",           "da",
  "タイ",         "tai",
  "文語ラ行変格", "classical_ra_column_change",
  "ワ行",         "wa_column",
  "コス",         "kosu",
  "キ",           "ki",
  "文語下二段",   "classical_shimonidan_verb_e_u_row",
  "ス",           "su",
  "ハ行",         "ha_column",
  "上一段",       "kamiichidan_verb_i_row",
  "イク",         "iku",
  "マ行",         "ma_column",
  "助動詞",       "auxiliary",
  "シク",         "shiku",
  "ナ行",         "na_column",
  "ガ行",         "ga_column",
  "ム",           "mu",
  "ア行",         "a_column",
  "ザンス",       "zansu",
  "文語形容詞",   "classical_adjective",
  "タ",           "ta",
  "伝聞",         "reported_speech",
  "ナイ",         "nai",
  "ヘン",         "hen",
  "文語助動詞",   "classical_auxiliary",
  "ジ",           "ji",
  "ワア行",       "wa_a_column",
  "文語ナ行変格", "classical_na_column_change",
  "カ行変格",     "kahen_verb_irregular",
  "ラシ",         "rashi",
  "マイ",         "mai",
  "タリ",         "tari",
  "呉レル",       "kureru",
  "形容詞",       "adjective",
  "ゲナ",         "gena",
  "一般+う",      "general_u",
  "ザマス",       "zamasu",
  "ゴトシ",       "gotoshi",
  "ヌ",           "nu",
  "文語上二段",   "classical_kaminidan_verb_u_i_row",
  "ク",           "ku",
  "サ行変格",     "sahen_verb_irregular",
  "ラ行",         "ra_column",
  "下一段",       "shimoichidan_verb_e_row",
  "完了",         "final",
  "ラシイ",       "rashii",
  "文語四段",     "classical_yondan_verb",
  "ドス",         "dosu",
  "ザ行",         "za_column",
  "ツ",           "shi",
  "ヤス",         "yasu",
  "バ行",         "ba_column",
  "断定",         "assertive",
  "ナンダ",       "nanda",
  "ケリ",         "keri",
  "文語サ行変格", "classical_sa_column_change",
  "タ行",         "ta_column",
  "ケム",         "kemu",
  "カ行",         "ka_column",
  "ゲス",         "gesu",
  "ヤ行",         "ya_column",
  "マス",         "masu",
  "レル",         "reru",
  "サ行",         "sa_column",
  "文語下一段",   "classical_shimoichidan_verb_e_row",
  "ベシ",         "beshi",
  "アル",         "aru",
  "ヤ",           "ya",
  "五段",         "godan_verb",
  "一般",         "general",
  "デス",         "desu",
  "リ",           "ri",
  "ナリ",         "nari",
  "文語上一段",   "classical_kamiichidan_verb_i_row",
  "無変化型",     "uninflected_form",
  "ズ",           "zu",
  "ジャ",         "ja",
  "文語カ行変格", "classical_ka_column_change",
  "イウ",         "iu"
];
function keysToObj(keys: string[]) {
  if (keys.length % 2 !== 0) { throw new Error("Even number of keys required"); }
  let ret: any = {};
  for (let i = 0; i < keys.length; i += 2) { ret[keys[i]] = keys[i + 1]; }
  return ret;
}
const partOfSpeechObj = keysToObj(partOfSpeechKeys);
const inflectionObj = keysToObj(inflectionKeys);
const inflectionTypeObj = keysToObj(inflectionTypeKeys);

export function invokeMecab(text: string, numBest: number = 1): Promise<string> {
  const native = !(process.env["NODE_MECAB"]);
  const numBestArgs = numBest === 1 ? [] : ['-N', numBest.toString()];
  return new Promise((resolve, reject) => {
    let spawned;
    if (native) {
      spawned = spawn('mecab', ['-d', '/opt/homebrew/lib/mecab/dic/unidic'].concat(numBestArgs))
    } else {
      const args =
          ['mecab-emscripten-node', '-d', process.env["UNIDIC"] || '/opt/homebrew/lib/mecab/dic/unidic'].concat(
              process.env["MECABRC"] ? ['-r', process.env["MECABRC"] || '/usr/local/etc/mecabrc'] : []);
      args.push(...numBestArgs);
      spawned = spawn('npx', args);
    }
    spawned.stdin.write(text);
    spawned.stdin.write('\n'); // necessary, otherwise MeCab says `input-buffer overflow.`
    spawned.stdin.end();
    let arr: string[] = [];
    spawned.stdout.on('data', (data: Buffer) => arr.push(data.toString('utf8')));
    spawned.stderr.on('data', (data: Buffer) => {
      console.log('stderr', data.toString());
      reject(data);
    });
    spawned.on('close', (code: number) => {
      if (code !== 0) { reject(code); }
      resolve(arr.join(''));
    });
  });
}

export interface Morpheme {
  literal: string;
  pronunciation: string;
  lemmaReading: string;
  lemma: string;
  partOfSpeech: string[];
  inflectionType: string[]|null;
  inflection: string[]|null;
}
export type MaybeMorpheme = Morpheme|null;
export function maybeMorphemesToMorphemes(v: MaybeMorpheme[]): Morpheme[] { return v.filter(o => !!o) as Morpheme[]; }
export function maybeMorphemeToMorpheme(o: MaybeMorpheme): Morpheme {
  if (o) { return o; }
  throw new Error('Invalid morpheme found');
}
export function morphemesEq(x: MaybeMorpheme, y: MaybeMorpheme): boolean {
  return !!x && !!y && ultraCompressMorpheme(x) === ultraCompressMorpheme(y);
}
export function parseMorpheme(raw: string[]): MaybeMorpheme {
  if (raw.length === 7) {
    const [literal, pronunciation, lemmaReading, lemma, partOfSpeechRaw, inflectionTypeRaw, inflectionRaw] = raw;
    const clean = (dashed: string, obj: any) => dashed === '' ? null : dashed.split('-').map(key => {
      const res: string = obj[key];
      if (!res) {
        console.error('Unknown MeCab Unidic key encountered, key', key, 'dashed', dashed, 'raw', raw);
        // throw new Error('Unknown MeCab Unidic key encountered');
        return '';
      }
      return res;
    });
    const partOfSpeech = clean(partOfSpeechRaw, partOfSpeechObj);
    if (!partOfSpeech) {
      // this will never happen, but `clean` does potentially return null so let's check it.
      throw new Error('Empty part of speech encountered');
    }
    // These two can potentially be null, for uninflected morphemes
    const inflectionType = clean(inflectionTypeRaw, inflectionTypeObj);
    const inflection = clean(inflectionRaw, inflectionObj);
    return {literal, pronunciation, lemmaReading, lemma, partOfSpeech, inflectionType, inflection};
  } else if (raw.length === 1) {
    return null;
  }
  console.error('Neither 1 nor 7', raw);
  return null;
  // throw new Error('Unexpected number of columns in MeCab Unidic output');
}

/**
 * Outermost nesting: sentence of input
