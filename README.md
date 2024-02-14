# Groqa Japanese NLP toolkit -- Work in progress

A TypeScript/JavaScript library for Node.js that amalgamates a *Japanese language learner*-oriented Japanese NLP pipeline using these technologies:
- [MeCab](https://github.com/taku910/mecab), the Japanese morphological parser and part-of-speech tagger;
- [J.DepP](https://www.tkl.iis.u-tokyo.ac.jp/~ynaga/jdepp/), the bunsetsu chunker and dependency parser that consumes MeCab output;
- [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html), the free open-source Japanese-to-languages dictionary;
- [JMdict-Simplified](https://github.com/fasiha/jmdict-simplified), JMdict in JSON;
- [JMdict-Furigana](http