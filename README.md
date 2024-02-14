# Groqa Japanese NLP toolkit -- Work in progress

A TypeScript/JavaScript library for Node.js that amalgamates a *Japanese language learner*-oriented Japanese NLP pipeline using these technologies:
- [MeCab](https://github.com/taku910/mecab), the Japanese morphological parser and part-of-speech tagger;
- [J.DepP](https://www.tkl.iis.u-tokyo.ac.jp/~ynaga/jdepp/), the bunsetsu chunker and dependency parser that consumes MeCab output;
- [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html), the free open-source Japanese-to-languages dictionary;
- [JMdict-Simplified](https://github.com/fasiha/jmdict-simplified), JMdict in JSON;
- [JMdict-Furigana](https://github.com/Doublevil/JmdictFurigana), mapping JMdict entries to accurate furigana (like <ruby>食<rt>た</rt></ruby>べ<ruby>物<rt>もの</rt></ruby>);
- [Kanjidic2](http://www.edrdg.org/wiki/index.php/KANJIDIC_Project), a database of kanji (漢字, i.e., Chinese characters) and their components, affiliated with JMdict;
- [Kamiya-Codec](https://github.com/fasiha/kamiya-codec), which co