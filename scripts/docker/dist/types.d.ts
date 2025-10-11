type TContainerStatus = 'running' | 'stopped' | 'exited';
type TContainer = {
    id: string;
    name: string;
    status: TContainerStatus;
    image: string;
    ports: string[];
    created: string;
    size: string;
};
type TMenuItem = {
    text: string;
    value: string;
};
type TViewState = 'main' | 'containers' | 'details' | 'logs';
type TResult<T, E = string> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
type TContainerStats = {
    cpu: string;
    memory: {
        usage: string;
        limit: string;
        percent: number;
    };
    network: {
        rx: string;
        tx: string;
    };
    blockIO: {
        read: string;
        write: string;
    };
    pids: number;
};
export type { TContainerStatus, TContainer, TMenuItem, TViewState, TResult, TContainerStats, };
