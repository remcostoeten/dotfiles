import type { TContainer, TContainerStats, TResult } from './types.js';
/**
 * Lists all Docker containers
 */
export declare function listContainers(): Promise<TResult<TContainer[], string>>;
/**
 * Starts a Docker container
 */
export declare function startContainer(id: string): Promise<TResult<void, string>>;
/**
 * Stops a Docker container
 */
export declare function stopContainer(id: string): Promise<TResult<void, string>>;
/**
 * Removes a Docker container
 */
export declare function removeContainer(id: string): Promise<TResult<void, string>>;
/**
 * Gets logs from a Docker container
 */
export declare function getContainerLogs(id: string, tail?: number): Promise<TResult<string[], string>>;
/**
 * Gets statistics for a Docker container
 */
export declare function getContainerStats(id: string): Promise<TResult<TContainerStats, string>>;
/**
 * Cleans up unused Docker resources (containers, networks, images)
 */
export declare function cleanupSystem(): Promise<TResult<void, string>>;
/**
 * Checks if Docker daemon is running
 */
export declare function checkDockerDaemon(): Promise<TResult<void, string>>;
/**
 * Gets detailed information about a container
 */
export declare function inspectContainer(id: string): Promise<TResult<Record<string, any>, string>>;
/**
 * Performs bulk operations on multiple containers
 */
export declare function performBulkOperation(containerIds: string[], operation: 'start' | 'stop' | 'remove'): Promise<TResult<void, string>>;
/**
 * Executes a command inside a container
 */
export declare function execInContainer(id: string, command: string): Promise<TResult<string, string>>;
/**
 * Gets environment variables from a container
 */
export declare function getContainerEnv(id: string): Promise<TResult<Record<string, string>, string>>;
/**
 * Creates and starts a PostgreSQL container
 */
export declare function createPostgresContainer(name: string, password: string, port?: number, database?: string): Promise<TResult<{
    id: string;
    connectionString: string;
}, string>>;
/**
 * Searches containers by name or image
 */
export declare function searchContainers(query: string): Promise<TResult<TContainer[], string>>;
/**
 * Restarts a container
 */
export declare function restartContainer(id: string): Promise<TResult<void, string>>;
/**
 * Generates environment variables from containers
 */
export declare function generateEnvironmentVariables(containers: TContainer[], isVite?: boolean): string;
/**
 * Generates a docker-compose.yml file from containers
 */
export declare function generateDockerCompose(containers: TContainer[]): string;
