import test from 'tape';

import * as annotate from '../annotate';

const p = (x: any) => console.dir(x, {depth: null});
type Ugh<T> = (T extends(infer X)[] ? X : never)[];

test('chatta', async t => {
  // in this sentence, Jdepp makes ことちゃった a bunsetsu
  const sentence = 'それは昨日のことちゃった';
  const x = (await annotate.handleSentence(sentence))[0];
  if (typeof x === 'string' || 