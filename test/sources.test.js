import test from 'node:test';
import assert from 'node:assert/strict';

import { SOURCES } from '../src/sources.js';

test('source list removes Zhangzala and tracks Khazix through public-account routes', () => {
  const ids = SOURCES.map((source) => source.id);

  assert.equal(ids.includes('xhs-zhangzala'), false);
  assert.equal(ids.includes('xhs-khazix'), false);

  const khazix = SOURCES.find((source) => source.id === 'wechat-khazix');
  assert.ok(khazix);
  assert.equal(khazix.name, '数字生命卡兹克');
  assert.equal(khazix.platform, 'wechat');
  assert.equal(khazix.kind, 'rsshub');
  assert.equal(khazix.urlEnv, 'WECHAT_KHAZIX_RSS_URL');
  assert.equal(khazix.path, '/wechat/sogou/Rockhazix');
  assert.deepEqual(khazix.fallbackPaths, ['/wechat/uread/Rockhazix']);
});

test('source list includes OpenAI News as an official RSS source', () => {
  const openaiNews = SOURCES.find((source) => source.id === 'openai-news');

  assert.ok(openaiNews);
  assert.equal(openaiNews.name, 'OpenAI News');
  assert.equal(openaiNews.platform, 'official-blog');
  assert.equal(openaiNews.kind, 'rss');
  assert.equal(openaiNews.group, 'official');
  assert.equal(openaiNews.url, 'https://openai.com/news/rss.xml');
  assert.equal(openaiNews.homepage, 'https://openai.com/news/');
});
