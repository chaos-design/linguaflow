# 内置词库数据来源

LinguaFlow 的内置词库是可选导入的数据集，不会在注册时自动写入用户账户。导入时会
创建对应的词库标签，并可为本次新增词条指定统一的词汇来源；已有词条只追加词库标签，
不会覆盖原来源，也不会重复创建。所有新词按“每日新词上限”错峰安排首次复习日期。

## 词库范围

| 词库 | 条目数 | 范围 |
| --- | ---: | --- |
| B1 | 2,394 | CEFR-J 1.6 B1 中可由应用安全表示的全部词条与拼写变体 |
| B2 / 雅思 6 分 | 2,771 | CEFR-J 1.6 B2 中可由应用安全表示的全部词条与拼写变体 |
| C1 | 1,026 | Octanove C1/C2 Vocabulary Profile 中的全部 C1 词条与拼写变体 |
| 常用词组 | 503 | PHRASE List 中可由应用安全表示的全部高频表达 |

“全部”指上述固定版本数据源中通过 LinguaFlow 词条格式校验的全部条目，并不表示英语
中存在一个穷尽所有单词或词组的官方清单。同一个词可能因不同词性或语义出现在多个
CEFR 等级中；应用会合并词条并保留多个标签。

[IELTS 与 CEFR 官方对照资料](https://ielts.org/organisations/ielts-for-organisations/compare-ielts/ielts-and-the-cefr)
说明两者不是精确的一一换算；IELTS 6.0 的能力区间大致映射到 CEFR B2。因此应用使用
“B2 / 雅思 6 分”作为学习目标标签，而不是考试得分保证。

## 来源与许可

- [**CEFR-J Wordlist 1.6**](http://www.cefr-j.org/download_eng)：
  Yukio Tono，东京外国语大学 Tono Laboratory。允许研究及商业使用，但必须注明来源。
- [**Octanove Vocabulary Profile C1/C2 1.0**](https://github.com/openlanguageprofiles/olp-en-cefrj)：
  Octanove Labs，采用 CC BY-SA 4.0。
- [**PHRASE List**](https://www.lextutor.ca/freq/lists_download/phrase_list_martinez.htm)：
  Ron Martinez 与 Norbert Schmitt，基于 British National Corpus 的 505 个高频
  多词表达研究列表。
- [**ECDICT**](https://github.com/skywind3000/ECDICT)：Linwei，MIT License。
  用于音标、英文释义和中文释义。
- [**generated-english-phrasal-verbs**](https://github.com/WithEnglishWeCan/generated-english-phrasal-verbs)：
  WithEnglishWeCan，MIT License。用于补充部分短语动词释义。
- [**FreeDictionaryAPI.com**](https://freedictionaryapi.com/)：基于 Wiktionary
  的公开词典接口，仅在生成阶段补充 ECDICT 缺少的英文释义。

生成后的词库固定保存在 `src/data/vocabulary-packs/`，运行时导入不依赖这些上游
服务。数据源 URL、提交版本和 SHA-256 校验值记录在
`scripts/generate-vocabulary-packs.mjs` 中。

## 重新生成

直接下载并生成：

```bash
pnpm generate:vocabulary-packs
```

使用已经下载到某个目录的源文件：

```bash
pnpm generate:vocabulary-packs -- --source-dir /path/to/source-files
```
