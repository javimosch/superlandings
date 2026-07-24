require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { i18nMiddleware, createTranslationHelper, loadTranslations } = require('../lib/i18n');

test('createTranslationHelper returns nested value by dotted key', () => {
  const t = createTranslationHelper({ nav: { home: 'Accueil' }, title: 'X' });
  assert.equal(t('nav.home'), 'Accueil');
  assert.equal(t('title'), 'X');
});

test('createTranslationHelper returns the key when not found', () => {
  const t = createTranslationHelper({ nav: {} });
  assert.equal(t('nav.missing'), 'nav.missing');
  assert.equal(t('totally.absent'), 'totally.absent');
});

test('loadTranslations returns {} when no locale file exists', () => {
  const dir = path.join(process.env.SL_DATA_DIR, 'no-locale');
  fs.mkdirSync(dir, { recursive: true });
  assert.deepEqual(loadTranslations(dir, 'fr'), {});
});

test('loadTranslations loads JSON and falls back to en', () => {
  const dir = path.join(process.env.SL_DATA_DIR, 'with-locale');
  fs.mkdirSync(path.join(dir, 'locales'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ hi: 'Hello' }));
  fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify({ hi: 'Bonjour' }));
  assert.equal(loadTranslations(dir, 'fr').hi, 'Bonjour');
  assert.equal(loadTranslations(dir, 'de').hi, 'Hello'); // fallback to en
});

test('i18nMiddleware detects lang from query, sets res.locals', async () => {
  const dir = path.join(process.env.SL_DATA_DIR, 'mw-locale');
  fs.mkdirSync(path.join(dir, 'locales'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify({ hi: 'Salut' }));
  const req = { query: { lang: 'fr' }, params: {}, headers: {}, path: '/' };
  const res = { locals: {} };
  await new Promise((resolve, reject) => {
    i18nMiddleware(dir)(req, res, (err) => err ? reject(err) : resolve());
  });
  assert.equal(res.locals.lang, 'fr');
  assert.equal(res.locals.t.hi, 'Salut');
});

test('i18nMiddleware falls back to Accept-Language then en', async () => {
  const dir = path.join(process.env.SL_DATA_DIR, 'accept-locale');
  fs.mkdirSync(path.join(dir, 'locales'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ hi: 'Hello' }));
  const req = { query: {}, params: {}, headers: { 'accept-language': 'fr-FR,fr;q=0.9' }, path: '/' };
  const res = { locals: {} };
  await new Promise((resolve, reject) => {
    i18nMiddleware(dir)(req, res, (err) => err ? reject(err) : resolve());
  });
  assert.equal(res.locals.lang, 'fr');
  // no fr.json → fallback to en
  assert.equal(res.locals.t.hi, 'Hello');
});
