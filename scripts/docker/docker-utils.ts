import { exec } from 'child_process';
import { promisify } from 'util';
import type { TContainer, TContainerStats, TResult } from './types.js';
import { formatSize, formatElapsedTime } from './ui-utils.js';

const execAsync = promisify(exec);

/**
 * Parses the output of docker ps into container objects
 */
function parseDockerPs(output: string): TContainer[] {
    const lines = output.trim().split('\n');
    if (lines.length <= 1) return []; // Only header row or empty

    return lines.slice(1).map(line => {
        const [id, image, command, created, status, ports, name] = line.split(/\s{2,}/);
        return {
            id,
            name,
            image,
            status: status.toLowerCase().includes('up') ? 'running' : 'exited',
            ports: ports ? ports.split(', ') : [],
            created,
            size: '0B' // Size requires a separate docker command
        };
    });
}

/**
 * Lists all Docker containers
 */
export async function listContainers(): Promise<TResult<TContainer[], string>> {
    try {
        const { stdout } = await execAsync('docker ps -a');
        const containers = parseDockerPs(stdout);

        // Get container sizes in parallel
        const containersWithSize = await Promise.all(
            containers.map(async container => {
                try {
                    const { stdout: sizeOutput } = await execAsync(`docker container ls -s -f "id=${container.id}" --format "{{.Size}}"`);
                    return { ...container, size: sizeOutput.trim() };
                } catch {
                    return container;
                }
            })
        );

        return { ok: true, value: containersWithSize };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to list containers' };
    }
}

/**
 * Starts a Docker container
 */
export async function startContainer(id: string): Promise<TResult<void, string>> {
    try {
        await execAsync(`docker start ${id}`);
        return { ok: true, value: undefined };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to start container' };
    }
}

/**
 * Stops a Docker container
 */
export async function stopContainer(id: string): Promise<TResult<void, string>> {
    try {
        await execAsync(`docker stop ${id}`);
        return { ok: true, value: undefined };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to stop container' };
    }
}

/**
 * Removes a Docker container
 */
export async function removeContainer(id: string): Promise<TResult<void, string>> {
    try {
        await execAsync(`docker rm ${id}`);
        return { ok: true, value: undefined };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to remove container' };
    }
}

/**
 * Gets logs from a Docker container
 */
export async function getContainerLogs(id: string, tail: number = 100): Promise<TResult<string[], string>> {
    try {
        const { stdout } = await execAsync(`docker logs --tail ${tail} ${id}`);
        return { ok: true, value: stdout.split('\n') };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to get container logs' };
    }
}

/**
 * Gets statistics for a Docker container
 */
export async function getContainerStats(id: string): Promise<TResult<TContainerStats, string>> {
    try {
        // Get stats with no-stream option to get just one reading
        const { stdout } = await execAsync(`docker stats ${id} --no-stream --format "{{.CPUPerc}};{{.MemUsage}};{{.MemPerc}};{{.NetIO}};{{.BlockIO}};{{.PIDs}}"`);
        const [cpu, memUsage, memPerc, netIO, blockIO, pids] = stdout.trim().split(';');
        
        const [memUsed, memLimit] = memUsage.split(' / ');
        const [netRx, netTx] = netIO.split(' / ');
        const [blockRead, blockWrite] = blockIO.split(' / ');

        return {
            ok: true,
            value: {
                cpu: cpu,
                memory: {
                    usage: memUsed.trim(),
                    limit: memLimit.trim(),
                    percent: parseFloat(memPerc.replace('%', ''))
                },
                network: {
                    rx: netRx.trim(),
                    tx: netTx.trim()
                },
                blockIO: {
                    read: blockRead.trim(),
                    write: blockWrite.trim()
                },
                pids: parseInt(pids, 10)
            }
        };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to get container statistics' };
    }
}

/**
 * Cleans up unused Docker resources (containers, networks, images)
 */
export async function cleanupSystem(): Promise<TResult<void, string>> {
    try {
        await execAsync('docker system prune -f');
        return { ok: true, value: undefined };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to cleanup system' };
    }
}

/**
 * Checks if Docker daemon is running
 */
export async function checkDockerDaemon(): Promise<TResult<void, string>> {
    try {
        await execAsync('docker info');
        return { ok: true, value: undefined };
    } catch (error) {
        return { ok: false, error: 'Docker daemon is not running' };
    }
}

/**
 * Gets detailed information about a container
 */
export async function inspectContainer(id: string): Promise<TResult<Record<string, any>, string>> {
    try {
        const { stdout } = await execAsync(`docker inspect ${id}`);
        return { ok: true, value: JSON.parse(stdout)[0] };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to inspect container' };
    }
}

/**
 * Performs bulk operations on multiple containers
 */
export async function performBulkOperation(
    containerIds: string[],
    operation: 'start' | 'stop' | 'remove'
): Promise<TResult<void, string>> {
    try {
        const operationFn = {
            start: startContainer,
            stop: stopContainer,
            remove: removeContainer
        }[operation];

        const results = await Promise.all(containerIds.map(id => operationFn(id)));
        const errors = results.filter(r => !r.ok).map(r => (r as { error: string }).error);
        
        if (errors.length > 0) {
            return { ok: false, error: `Some operations failed:\n${errors.join('\n')}` };
        }
        
        return { ok: true, value: undefined };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to perform bulk operation' };
    }
}