#!/usr/bin/env node
require('dotenv').config();

import express from 'express';
import {isRight} from 'fp-ts/lib/Either';

import {jmdictIdsToWords, handleSentence} from './annotate';
import {v1ReqSentence, v1ReqSentences, v1ResSentence} from './interfaces';

const app = express();
app.use(require('cors')({origin: true, credentials: true}));
app.use(require('body-parser').json());
app.post('/api/v1/sentence', async (req, res) => {
  const body = v1ReqSentence.decode(req.body);
  if (!isRight(body)) {
    res.status(400).json('bad payload' + JSON.stringify(body.left));
    return;
  }
  const {sentence, overrides = {}, nBest = 1} = body.right;
  if (nBest < 1) {
    res.status(400).json('nBest should be positive');
    return;
  }
  res.json(await handleSentence(sentence, overrides, !!req.query.includeWord, !!req.query.includeClozes, nBest));
});

app.post('/api/v1/sentences', async (req, res) => {
  const body = v1ReqSentences.decode(req.body);
  if (!isRigh