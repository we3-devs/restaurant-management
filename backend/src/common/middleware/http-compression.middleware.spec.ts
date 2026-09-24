import express from 'express';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import request from 'supertest';
import { httpCompression, prefersZstd } from './http-compression.middleware';

const big = {
  rows: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `item ${i}` })),
};

function app() {
  const a = express();
  a.use(httpCompression());
  a.get('/big', (_req, res) => res.json(big));
  a.get('/small', (_req, res) => res.json({ ok: true }));
  a.get('/no-transform', (_req, res) => {
    res.set('Cache-Control', 'no-transform');
    res.json(big);
  });
  a.get('/stream', (_req, res) => {
    res.type('text/plain');
    Readable.from(
      Array.from({ length: 50 }, (_, i) => `line ${i}\n`.repeat(20)),
    ).pipe(res);
  });
  return a;
}

// Collect the raw (still-encoded) body so the test decodes it itself.
const raw = (r: request.Test) =>
  r.buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

describe('httpCompression', () => {
  it('serves zstd when the client prefers it', async () => {
    const res = await raw(
      request(app())
        .get('/big')
        .set('Accept-Encoding', 'gzip, deflate, br, zstd'),
    );
    expect(res.headers['content-encoding']).toBe('zstd');
    expect(res.headers['vary']).toMatch(/Accept-Encoding/i);
    expect(res.headers['content-length']).toBeUndefined();
    expect(
      JSON.parse(zlib.zstdDecompressSync(res.body as Buffer).toString()),
    ).toEqual(big);
  });

  it('falls back to brotli when zstd is not accepted', async () => {
    const res = await raw(
      request(app()).get('/big').set('Accept-Encoding', 'gzip, br'),
    );
    // superagent transparently decodes br (but not zstd), so the body arrives plain.
    expect(res.headers['content-encoding']).toBe('br');
    expect(JSON.parse((res.body as Buffer).toString())).toEqual(big);
  });

  it('compresses streamed responses with zstd', async () => {
    const res = await raw(
      request(app()).get('/stream').set('Accept-Encoding', 'zstd'),
    );
    expect(res.headers['content-encoding']).toBe('zstd');
    expect(zlib.zstdDecompressSync(res.body as Buffer).toString()).toContain(
      'line 49',
    );
  });

  it.each([
    ['below threshold', 'get', '/small'],
    ['Cache-Control: no-transform', 'get', '/no-transform'],
    ['HEAD request', 'head', '/big'],
  ] as const)('skips compression for %s', async (_label, method, path) => {
    const res = await request(app())
      [method](path)
      .set('Accept-Encoding', 'zstd');
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});

describe('prefersZstd', () => {
  it.each([
    ['gzip, deflate, br, zstd', true],
    ['zstd', true],
    ['gzip, br', false],
    ['zstd;q=0', false],
    ['br;q=1, zstd;q=0.5', false],
    ['br;q=0.5, zstd', true],
    [undefined, false],
  ])('%s -> %s', (header, expected) => {
    expect(prefersZstd(header)).toBe(expected);
  });
});
