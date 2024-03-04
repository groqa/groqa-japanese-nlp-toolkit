# Groqa Japanese NLP toolkit -- Work in progress

A TypeScript/JavaScript library for Node.js that amalgamates a *Japanese language learner*-oriented Japanese NLP pipeline using these technologies:
- [MeCab](https://github.com/taku910/mecab), the Japanese morphological parser and part-of-speech tagger;
- [J.DepP](https://www.tkl.iis.u-tokyo.ac.jp/~ynaga/jdepp/), the bunsetsu chunker and dependency parser that consumes MeCab output;
- [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html), the free open-source Japanese-to-languages dictionary;
- [JMdict-Simplified](https://github.com/fasiha/jmdict-simplified), JMdict in JSON;
- [JMdict-Furigana](https://github.com/Doublevil/JmdictFurigana), mapping JMdict entries to accurate furigana (like <ruby>食<rt>た</rt></ruby>べ<ruby>物<rt>もの</rt></ruby>);
- [Kanjidic2](http://www.edrdg.org/wiki/index.php/KANJIDIC_Project), a database of kanji (漢字, i.e., Chinese characters) and their components, affiliated with JMdict;
- [Kamiya-Codec](https://github.com/fasiha/kamiya-codec), which conjugates and deconjugates Japanese verbs and adjectives based on Taeko Kamiya's textbooks;
- This library also wraps Naoko Chino's *All about particles: a handbook of Japanese function words*'s taxonomy of particles.

This library processes a sentence like this:

> **へましたらリーダーに切られるだけ**

And provides the following:
- Furigana like へましたらリーダーに<ruby>切<rt>き</rt></ruby>られるだけ;
- Morpheme and bunsetsu boundaries (input didn't have spaces, so these are inferred):
  - へま し たら │ リーダー に │ 切ら れる だけ (spaces are morpheme boundaries, `|` bunsetsu boundaryes)
- Bunsetsu dependencies, allowing you to reconstruct the hierarchical structure;
- Conjugation of verbs and adjectives;
- A list of particles;
- A long list of dictionary entries broken dow