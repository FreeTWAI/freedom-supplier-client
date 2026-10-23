import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startPairing, pollPairing, ScopedReadClient } from '../client/read-client.mjs';

async function withServer(handler, fn) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('integration: supplier API authentication', async () => {
  await withServer((req, res) => {
    if (req.url === '/api/v1/client-connections/start') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        device_secret: 'fw_pair_' + 'A'.repeat(43),
        user_code: '12345-12345-12345-12345',
        verification_uri: `http://${req.headers.host}/#account`,
        scope: 'supplier:read',
        expires_in: 300,
        interval: 5
      }));
    }
  }, async (origin) => {
    const result = await startPairing({ origin, kind: 'supplier', clientName: 'Test Client' });
    assert.equal(result.device_secret, 'fw_pair_' + 'A'.repeat(43));
  });
});

test('integration: payload serialization handling', async () => {
  await withServer((req, res) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        const parsed = JSON.parse(body);
        assert.equal(parsed.kind, 'supplier');
        assert.equal(parsed.client_name, 'Test Client');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          device_secret: 'fw_pair_' + 'B'.repeat(43),
          user_code: '11111-22222-33333-44444',
          verification_uri: `http://${req.headers.host}/#account`,
          scope: 'supplier:read',
          expires_in: 300,
          interval: 5
        }));
      });
    }
  }, async (origin) => {
    const result = await startPairing({ origin, kind: 'supplier', clientName: 'Test Client' });
    assert.equal(result.device_secret, 'fw_pair_' + 'B'.repeat(43));
  });
});

test('integration: retry logic with slow_down', async () => {
  let attempts = 0;
  await withServer((req, res) => {
    attempts++;
    if (attempts === 1) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'slow_down' }));
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'authorized',
        access_token: 'fw_read_' + 'C'.repeat(43),
        scope: 'supplier:read',
        read_only: true,
        api_base_path: '/client-api/v1',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }));
    }
  }, async (origin) => {
    const secret = 'fw_pair_' + 'C'.repeat(43);
    const result1 = await pollPairing({ origin, deviceSecret: secret });
    assert.equal(result1.status, 'slow_down');

    const result2 = await pollPairing({ origin, deviceSecret: secret });
    assert.equal(result2.status, 'authorized');
    assert.equal(result2.access_token, 'fw_read_' + 'C'.repeat(43));
  });
});

test('integration: ScopedReadClient reads and serializes data', async () => {
  await withServer((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer fw_read_' + 'D'.repeat(43));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      items: [{ id: 1, name: 'Product A' }],
      read_only: true
    }));
  }, async (origin) => {
    const client = new ScopedReadClient({ origin, token: 'fw_read_' + 'D'.repeat(43) });
    const data = await client.read('products');
    assert.equal(data.read_only, true);
    assert.deepEqual(data.items, [{ id: 1, name: 'Product A' }]);
  });
});
