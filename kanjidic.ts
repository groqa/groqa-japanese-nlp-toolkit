import {existsSync, readFileSync, writeFileSync} from 'fs'
import {ungzip} from 'node-gzip';
import {parseStringPromise} from 'xml2js';

export interface Header {
  file_version: [string];
  database_version: [string];
  date_of_creation: [string];
}
export interface Reading {
  _: string;
  $: {r_type: string};
}
export interface Meaning {
  _: string;
  $: {m_lang: string};
}
export interface ReadingMeaning {
  rmgroup: [{reading?: Reading[], meaning?: (string|Meaning)[]}];
  nanori?: string[];
}
export interface Character {
  literal: [string];
  reading_meaning?: [ReadingMeaning];
}
ex