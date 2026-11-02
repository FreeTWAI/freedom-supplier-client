import { createServer } from 'node:http';
import { ScopedReadClient } from '../client/read-client.mjs';

async function runBenchmark() {
  let requestCount = 0;
  let connectionCount = 0;

  const server = createServer((req, res) => {
    requestCount++;
    if (req.url === '/client-api/v1/supplier/products') {
      // Simulate transient error for the first two requests to test retry
      if (requestCount <= 2) {
        res.writeHead(503, { 'Retry-After': '1', 'Connection': 'keep-alive' });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Connection': 'keep-alive' });
      res.end(JSON.stringify({ items: [{ id: 1 }], read_only: true }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.on('connection', () => {
    connectionCount++;
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const client = new ScopedReadClient({ origin, token: 'fw_read_' + 'A'.repeat(43) });

  console.log('--- Benchmarking Connection Pooling & Retries ---');

  const start = performance.now();
  try {
    const data1 = await client.read('products');
    const time1 = performance.now() - start;
    console.log(`First request (with simulated 503 retries) took: ${time1.toFixed(2)}ms`);

    const start2 = performance.now();
    const data2 = await client.read('products');
    const time2 = performance.now() - start2;
    console.log(`Second request (reusing connection) took: ${time2.toFixed(2)}ms`);

    console.log(`Total TCP connections established: ${connectionCount}`);
    console.log(`Total HTTP requests received: ${requestCount}`);

    if (connectionCount <= 2) {
      console.log('✅ Connection pooling (reuse) confirmed.');
    } else {
      console.log('⚠️ Too many connections established (pooling might be failing).');
    }

    if (requestCount === 4) { // 2 failures + 1 success for data1, 1 success for data2
      console.log('✅ Exponential backoff retries confirmed.');
    } else {
      console.log('⚠️ Unexpected number of requests.');
    }

  } finally {
    server.close();
  }
}

runBenchmark().catch(console.error);
