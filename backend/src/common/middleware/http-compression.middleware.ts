import compression from 'compression';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import zlib from 'node:zlib';

// Same cutoff the `compression` package uses: below ~1KB the encoding
// overhead outweighs the savings.
const THRESHOLD_BYTES = 1024;

// Level 3 is zstd's default. On a representative 214KB order-list JSON
// payload it compressed slightly smaller than brotli q4 (what `compression`
// uses) and ~3x faster than both brotli q4 and gzip -6 — the CPU
// win is the point for per-request API responses.
const ZSTD_LEVEL = 3;

const NO_TRANSFORM = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;

type Listener = (...args: unknown[]) => void;

/**
 * Response compression that prefers zstd when the client accepts it
 * (Chrome/Edge 123+, Firefox 126+) and otherwise defers to the `compression`
 * package's brotli/gzip handling, so clients without zstd support (older
 * Safari, curl, server-to-server callers) see no change.
 *
 * The zstd path mirrors `compression`'s rules: same filter
 * (compressible Content-Type), threshold, Cache-Control: no-transform,
 * already-encoded and HEAD handling, plus `res.flush()` support.
 */
export function httpCompression(): RequestHandler {
  const fallback = compression({ threshold: THRESHOLD_BYTES });
  return (req, res, next) =>
    prefersZstd(req.headers['accept-encoding'])
      ? zstdCompression(req, res, next)
      : fallback(req, res, next);
}

/**
 * True when the client lists zstd with a q-value at least as high as any
 * other encoding it accepts (ties go to zstd).
 */
export function prefersZstd(header: string | undefined): boolean {
  if (!header) return false;
  let zstdQ = 0;
  let bestOtherQ = 0;
  for (const part of header.split(',')) {
    const [rawName, ...params] = part.trim().split(';');
    const name = rawName.trim().toLowerCase();
    if (!name) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split('=');
      if (key?.trim().toLowerCase() === 'q') q = Number(value) || 0;
    }
    if (name === 'zstd') zstdQ = q;
    else if (name !== 'identity') bestOtherQ = Math.max(bestOtherQ, q);
  }
  return zstdQ > 0 && zstdQ >= bestOtherQ;
}

function zstdCompression(req: Request, res: Response, next: NextFunction) {
  let stream: zlib.ZstdCompress | undefined;
  let decided = false;
  let ended = false;
  let endLength: number | undefined;
  let listeners: Array<[string, Listener]> | null = [];

  const _write = res.write.bind(res) as (
    chunk: unknown,
    encoding?: BufferEncoding,
  ) => boolean;
  const _end = res.end.bind(res) as (
    chunk?: unknown,
    encoding?: BufferEncoding,
  ) => Response;
  const _on = res.on.bind(res) as (event: string, l: Listener) => Response;
  const _writeHead = res.writeHead.bind(res) as (
    ...args: unknown[]
  ) => Response;

  res.flush = () => stream?.flush();

  res.writeHead = function writeHead(...args: unknown[]) {
    if (!decided) {
      decided = true;
      // Headers passed to writeHead() aren't visible via getHeader() yet —
      // apply them first so the decision below sees the final header set.
      const last = args[args.length - 1];
      if (last && typeof last === 'object' && !Array.isArray(last)) {
        for (const [key, value] of Object.entries(last)) {
          if (value !== undefined) res.setHeader(key, value as string);
        }
        args.pop();
      }
      decide();
    }
    return _writeHead(...args);
  } as Response['writeHead'];

  res.write = function write(chunk: unknown, encoding?: unknown) {
    if (ended) return false;
    if (!res.headersSent) res.writeHead(res.statusCode);
    const enc =
      typeof encoding === 'string' ? (encoding as BufferEncoding) : undefined;
    return stream ? stream.write(toBuffer(chunk, enc)) : _write(chunk, enc);
  } as Response['write'];

  res.end = function end(chunk?: unknown, encoding?: unknown) {
    if (ended) return res;
    if (typeof chunk === 'function') chunk = undefined;
    const enc =
      typeof encoding === 'string' ? (encoding as BufferEncoding) : undefined;
    if (!res.headersSent) {
      if (!res.getHeader('Content-Length')) endLength = chunkLength(chunk, enc);
      res.writeHead(res.statusCode);
    }
    if (!stream) return _end(chunk, enc);
    ended = true;
    if (chunk) stream.end(toBuffer(chunk, enc));
    else stream.end();
    return res;
  } as Response['end'];

  // Backpressure listeners must attach to the compression stream once one
  // exists; until the decision is made, buffer them.
  res.on = function on(event: string, listener: Listener) {
    if (!listeners || event !== 'drain') return _on(event, listener);
    if (stream) {
      stream.on(event, listener);
      return res;
    }
    listeners.push([event, listener]);
    return res;
  } as Response['on'];

  function passthrough() {
    for (const [event, listener] of listeners ?? []) _on(event, listener);
    listeners = null;
  }

  function decide() {
    if (!compression.filter(req, res)) return passthrough();
    const cacheControl = res.getHeader('Cache-Control');
    if (typeof cacheControl === 'string' && NO_TRANSFORM.test(cacheControl)) {
      return passthrough();
    }

    res.vary('Accept-Encoding');

    if (
      Number(res.getHeader('Content-Length')) < THRESHOLD_BYTES ||
      (endLength !== undefined && endLength < THRESHOLD_BYTES)
    ) {
      return passthrough();
    }
    const existing = res.getHeader('Content-Encoding');
    if (existing && existing !== 'identity') return passthrough();
    if (req.method === 'HEAD') return passthrough();

    const zstd = zlib.createZstdCompress({
      params: { [zlib.constants.ZSTD_c_compressionLevel]: ZSTD_LEVEL },
    });
    stream = zstd;
    for (const [event, listener] of listeners ?? []) zstd.on(event, listener);
    listeners = null;

    res.setHeader('Content-Encoding', 'zstd');
    res.removeHeader('Content-Length');

    zstd.on('data', (chunk: Buffer) => {
      if (_write(chunk) === false) zstd.pause();
    });
    zstd.on('end', () => _end());
    _on('drain', () => zstd.resume());
  }

  next();
}

function toBuffer(chunk: unknown, encoding?: BufferEncoding): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(typeof chunk === 'string' ? chunk : '', encoding);
}

function chunkLength(chunk: unknown, encoding?: BufferEncoding): number {
  if (!chunk) return 0;
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  return typeof chunk === 'string' ? Buffer.byteLength(chunk, encoding) : 0;
}
