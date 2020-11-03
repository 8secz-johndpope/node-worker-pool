import type { Worker, ResourceLimits } from 'worker_threads';


interface Deferred<V> {
	promise: Promise<V>,
	resolve: (value: V | PromiseLike<V>) => void,
	reject: (reason?: any) => void,
}

export interface Task {
	id: number,
	method: string,
	args: any[],
	deferred: Deferred<any>,
}

export interface WorkerHandlerOptions {
	limits?: ResourceLimits,
}

export interface WorkerPoolOptions extends WorkerHandlerOptions {
	max?: number,
}

export type WorkerMethods<T> = { [K in keyof T]: (...args: any[]) => unknown };

type DefaultWorkerMethods = { [method: string]: (...args: any[]) => any };

export declare let WorkerStatus: {
	Starting: number,
	Ready: number,
	Terminating: number,
	Terminated: number,
};

export declare class WorkerPool<M extends WorkerMethods<M> = DefaultWorkerMethods> {
	constructor (script: string, options?: WorkerPoolOptions);

	options: WorkerPoolOptions;

	script: string;
	workers: WorkerHandler[];
	queue: Task[];

	exec<T extends keyof M> (method: T, args: Parameters<M[T]>): Promise<ReturnType<M[T]>>;
}

export declare class WorkerHandler {
	constructor (script: string, options?: WorkerHandlerOptions);

	options: WorkerHandlerOptions;

	script: string;
	status: number;

	queue: Task[];
	processing: Map<number, Task>;

	methods: string[] | null;

	worker: Worker;

	get active (): number;
	exec (task: Task): void;
}
