import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { ScopedReadClient } from '../client/read-client.mjs';

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

test('benchmark: ScopedReadClient latency remains under threshold', async () => {
  const payload = {
    items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Product ${i}`, price: i * 10 })),
    read_only: true
  };
  const jsonPayload = JSON.stringify(payload);

  await withServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(jsonPayload);
  }, async (origin) => {
    const client = new ScopedReadClient({ origin, token: 'fw_read_' + 'B'.repeat(43) });

    // Warmup
    for (let i = 0; i < 5; i++) {
      await client.read('products');
    }

    const start = performance.now();
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      await client.read('products');
    }
    const end = performance.now();

    const avgLatency = (end - start) / iterations;
    console.log(`Average latency for ScopedReadClient.read: ${avgLatency.toFixed(2)}ms`);

    // Ensure average latency is under a reasonable threshold (e.g. 10ms for a local mock API read + parse)
    assert.ok(avgLatency < 20, `Latency threshold exceeded: ${avgLatency}ms >= 20ms`);
  });
});
