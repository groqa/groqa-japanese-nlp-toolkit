import {existsSync, readFileSync, writeFileSync} from 'fs'
import {ungzip} from 'node-gzip';
import {parseStringPromise} from 'xml2js';

export interface Header {
  file_version: [string];
  database_version: [string];
