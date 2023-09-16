import test from 'tape';

import * as annotate from '../annotate';

const p = (x: any) => console.dir(x, {depth: null});
type Ugh<T> = (T extends(infer X)[] ? X : never)[];

test('chatta', async t => {
  // in this sentence, Jdepp makes ことちゃった a bunsetsu
  const sentence = 'それは昨日のことちゃった';
  const x = (await annotate.handleSentence(sentence))[0];
  if (typeof x === 'string' || !x.clozes) { throw new Error('assert') }
  const conj = x.clozes?.conjugatedPhrases;
  const deconj = conj.map(o => o.deconj);
  t.ok(deconj.length);
  t.ok(deconj.some(v => (v as Ugh<typeof v>).some(o => o.result.includes('ちゃった'))));
  t.end();
});
test('denwa suru', async t => {
  // in this sentence, Jdepp makes 電話 し ます a bunsetsu
  const sentence = '彼に電話します';
  co