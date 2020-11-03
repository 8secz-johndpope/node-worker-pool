# `node-worker-pool`

Offload heavy tasks to a pool of worker threads.

Requires Node.js 10.5.0 and up.

```sh
npm install @intrnl/node-worker-pool
# pnpm install @intrnl/node-worker-pool
# yarn install @intrnl/node-worker-pool
```

## Usage

```js
// ./app.js
let { WorkerPool } = require('@intrnl/node-worker-pool');

// Path to your worker script, `require.resolve` will resolve requires from
// where this script is located.
let workerScript = require.resolve('./worker.js');

let pool = new WorkerPool(workerScript, {
  // Max workers to run concurrently, default is number of CPU cores minus 1
  max: 2,
  // Resource limits to set on the worker thread, Node.js 12.16.0 and up only,
  // see <https://nodejs.org/api/worker_threads.html#worker_threads_worker_resourcelimits>
  limits: {},
});

pool.exec('fibonacci', [32])
  // This should output `2178309`
  .then((value) => console.log('result:', value))
  .catch((error) => console.error('error:', error))
  // Terminates all currently running workers
  .then(() => pool.terminate())
```

```js
// ./worker.js
function fibonacci (n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

module.exports = { fibonacci };
```
