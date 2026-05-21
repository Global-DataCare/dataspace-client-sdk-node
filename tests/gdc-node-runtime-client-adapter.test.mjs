import test from 'node:test';
import assert from 'node:assert/strict';

import { DataspaceNodeRuntimeClientAdapter } from '../dist/index.js';

test('DataspaceNodeRuntimeClientAdapter delegates to DataspaceNodeClient methods explicitly', async () => {
  const calls = [];
  const client = {
    createOrganizationEmployee: async (...args) => { calls.push(['createOrganizationEmployee', args]); return { ok: true }; },
    requestSmartTokenSimple: async (...args) => { calls.push(['requestSmartTokenSimple', args]); return { ok: true }; },
    submitBatch: async (...args) => { calls.push(['submitBatch', args]); return { ok: true }; },
    pollUntilComplete: async (...args) => { calls.push(['pollUntilComplete', args]); return { ok: true }; },
    submitAndPoll: async (...args) => { calls.push(['submitAndPoll', args]); return { ok: true }; },
  };

  const runtimeClient = new DataspaceNodeRuntimeClientAdapter(client);
  await runtimeClient.createOrganizationEmployee({}, {});
  await runtimeClient.requestSmartTokenSimple({});
  await runtimeClient.submitBatch('/submit', { thid: 'job-1' });
  await runtimeClient.pollUntilComplete('/poll', { thid: 'job-1' }, { timeoutMs: 1000 });
  await runtimeClient.submitAndPoll('/submit', '/poll', {});

  assert.deepEqual(
    calls.map(([name]) => name),
    ['createOrganizationEmployee', 'requestSmartTokenSimple', 'submitBatch', 'pollUntilComplete', 'submitAndPoll'],
  );
});
