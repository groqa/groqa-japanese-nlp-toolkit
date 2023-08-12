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
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const node_gzip_1 = require("node-gzip");
const xml2js_1 = require("xml2js");
const KANJIDIC_FILE = 'kanjidic2.xml.gz';
function setup() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs_1.existsSync(KANJIDIC_FILE)) {
            console.error(`Kanjidic2 missing. Download ${KANJIDIC_FILE} from http://www.edrdg.org/wiki/index.php/KANJIDIC_Project.`);
            process.exit(1);
        }
        const raw = (yield node_gzip_1.ungzip(fs_1.readFileSync(KANJIDIC_FILE)