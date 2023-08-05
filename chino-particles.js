"use strict";
// Based on Naoko Chino's *All About Particles* (Kodansha)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const idxChinoParticles = fs_1.readFileSync(path_1.default.join(__dirname, 'chino-all-about-particles.txt'), 'utf8')
    .trim()
    .split('\n')
    .map((s, i) => [i + 1, s.split('・')]);
function lookup(raw) {
    const ret = [];
    if (raw.length === 0) {
        return ret;
    }
    const rawAlternative = raw === 'ん' ? 'の' : '';
    for (const [idx, list] of idxChinoParticles) {
        if (list.some(chino => chino.includes(raw) || (rawAlternative && chino.includes(rawAlternative)))) {
            ret.push([idx, list]);
        }
    }
    const scoreMatch = ([_, v]) => {
    