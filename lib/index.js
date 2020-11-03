import * as os from 'os';
import { Worker } from 'worker_threads';


let workerScript = require.resolve('../worker');

export let WorkerStatus = {
	Starting: 0,
	Ready: 1,
	Terminating: 2,
	Terminated: 3,
};

export class WorkerPool {
	constructor (script, opts = {}) {
		this.options = {
			max: Math.max(os.cpus().length - 1, 1),
			limits: {},
			...opts,
		};

		this.script = script;
		this.workers = [];
		this.queue = [];

		this._nextId = 0;
	}

	exec (method, args = []) {
		let deferred = createDeferred();
		let id = this._nextId++;

		let task = { id, method, args, deferred };
		this.queue.push(task);

		this._next();
		return deferred.promise;
	}

	_next () {
		if (!this.queue.length) return;

		let worker = this._getWorker();
		if (!worker) return;

		let task = this.queue.shift();

		// `worker.exec` returns the task's deferred promise, which we can use to
		// know when it's time for the next one
		worker.exec(task).finally(() => this._next());
	}

	_getWorker () {
		// Get idle worker first if available, or replace terminated worker
		for (let i = 0, len = this.workers.length; i < len; i++) {
			let worker = this.workers[i];

			if (worker.status <= WorkerStatus.Ready && !worker.active) {
				// Worker is idle
				return worker;
			} else if (worker.status >= WorkerStatus.Terminating) {
				// Worker is about to be or already terminated
				let worker = this._createWorker();
				this.workers.splice(i, 1, worker);
				return worker;
			}
		}

		// Create a new worker if there's still a spot remaining
		if (this.workers.length < this.options.max) {
			let worker = this._createWorker();
			this.workers.push(worker);
			return worker;
		}
	}

	_createWorker () {
		return new WorkerHandler(this.script, this.options);
	}
}

export class WorkerHandler {
	constructor (script, opts = {}) {
		let { limits } = opts;

		this.script = script;
		this.status = WorkerStatus.Starting;

		this.queue = [];
		this.processing = new Map;

		this.methods = null;

		this.worker = new Worker(workerScript, {
			workerData: { script },
			resourceLimits: limits,
			stdout: false,
			stderr: false,
		});

		this.worker.on('message', (value) => this._handleWorkerMessage(value));
		this.worker.on('error', (error) => this._handleWorkerError(error));
		this.worker.on('exit', (code) => this._handleWorkerExit(code));
	}

	get active () {
		return this.processing.size + this.queue.length;
	}

	exec (task) {
		if (this.status == WorkerStatus.Ready) {
			this._processTask(task);
		} else {
			this.queue.push(task);
		}

		return task.deferred.promise;
	}

	_processTask (task) {
		if (!this.methods.includes(task.method))
			return task.deferred.reject(new Error('Invalid method ' + task.method));

		this.processing.set(task.id, task);

		// `task` contains non-serializable properties, so only take what we need
		let { id, method, args } = task;
		this.worker.postMessage({ type: 'task', data: { id, method, args } });
	}

	_handleWorkerMessage ({ type, data }) {
		if (type == 'ready') {
			this.status = WorkerStatus.Ready;
			this.methods = data.methods;

			for (let task; (task = this.queue.shift());) {
				this._processTask(task);
			}
		} else if (type == 'task:result') {
			let task = this.processing.get(data.id);
			this.processing.delete(data.id);

			if (data.status == 'success') {
				task.deferred.resolve(data.value);
			} else {
				task.deferred.reject(data.error);
			}
		}
	}

	_handleWorkerError (err) {
		this.status = WorkerStatus.Terminated;

		for (let task of this.processing) {
			task.deferred.reject(err);
		}

		for (let task of this.queue) {
			task.deferred.reject(err);
		}

		this.processing.clear();
		this.queue.length = 0;
	}

	_handleWorkerExit (code) {
		this._handleWorkerError(
			new Error('Worker terminated with code ' + code)
		);
	}
}

function createDeferred () {
	let deferred = {};

	deferred.promise = new Promise((resolve, reject) => (
		Object.assign(deferred, { resolve, reject })
	));

	return deferred;
}
