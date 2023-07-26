#!/usr/bin/env node
require('dotenv').config();

import express from 'express';
import {isRight} from 'fp-ts/lib/Either';

import {jmdictIdsToWords, handleSentence} from './annotate';
import {v1ReqSentence, v1ReqSentences, v1ResSentence} from './interfaces';

const a