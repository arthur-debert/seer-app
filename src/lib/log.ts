type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let minLevel: Level = 'info';

let sink: ((level: string, component: string, message: string, ts: number) => void) | null = null;

export function setLogLevel(level: Level): void {
	minLevel = level;
}

export function setLogSink(
	fn_: ((level: string, component: string, message: string, ts: number) => void) | null
): void {
	sink = fn_;
}

export function clearLogSink(): void {
	sink = null;
}

function emit(level: Level, component: string, message: string, data?: Record<string, unknown>) {
	if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

	const entry = data
		? `[${component}] ${message} ${JSON.stringify(data)}`
		: `[${component}] ${message}`;

	switch (level) {
		case 'debug':
			console.debug(entry);
			break;
		case 'info':
			console.info(entry);
			break;
		case 'warn':
			console.warn(entry);
			break;
		case 'error':
			console.error(entry);
			break;
	}

	sink?.(level, component, message, Date.now());
}

export function logger(component: string) {
	return {
		debug: (msg: string, data?: Record<string, unknown>) => emit('debug', component, msg, data),
		info: (msg: string, data?: Record<string, unknown>) => emit('info', component, msg, data),
		warn: (msg: string, data?: Record<string, unknown>) => emit('warn', component, msg, data),
		error: (msg: string, data?: Record<string, unknown>) => emit('error', component, msg, data)
	};
}
