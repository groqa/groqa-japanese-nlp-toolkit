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
  "adverbi