import { workerData, parentPort } from 'worker_threads';

let { script } = workerData;
let mod = await import(script);
let methods = Object.keys(mod);

parentPort.on('message', async ({ type, data }) => {
	if (type == 'task') {
		let { id, method, args } = data;

		try {
			let value = await mod[method](...args);

			parentPort.postMessage({
				type: 'task:result',
				data: {
					id,
					status: 'success',
					value,
				},
			});
		} catch (err) {
			parentPort.postMessage({
				type: 'task:result',
				data: {
					id,
					status: 'failed',
					error: serializeError(err),
				},
			});
		}
	}
});

parentPort.postMessage({
	type: 'ready',
	data: { methods },
});

function serializeError (err) {
	err = err || {};

	let { name, message, stack } = err;
	return { name, message, stack };
}
