import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
/**
 * Parses the output of docker ps into container objects
 */
function parseDockerPs(output) {
    const lines = output.trim().split('\n');
    if (lines.length <= 1)
        return []; // Only header row or empty
    return lines.slice(1).map(line => {
        const parts = line.split(/\s{2,}/);
        if (parts.length < 7) {
            // Fallback parsing for edge cases
            const id = parts[0] || '';
            const image = parts[1] || '';
            const name = parts[parts.length - 1] || '';
            const status = parts[4] || 'unknown';
            return {
                id: id.substring(0, 12), // Short ID
                name: name || `<unnamed-${id.substring(0, 8)}>`,
                image: image || 'unknown',
                status: (status.toLowerCase().includes('up') ? 'running' : 'exited'),
                ports: [],
                created: parts[3] || 'unknown',
                size: '0B'
            };
        }
        const [id, image, command, created, status, ports, name] = parts;
        return {
            id: id.substring(0, 12), // Use short ID
            name: name || `<unnamed-${id.substring(0, 8)}>`,
            image: image || 'unknown',
            status: (status?.toLowerCase().includes('up') ? 'running' : 'exited'),
            ports: ports ? ports.split(', ').filter(p => p.trim()) : [],
            created: created || 'unknown',
            size: '0B' // Size requires a separate docker command
        };
    }).filter(c => c.id); // Filter out invalid entries
}
/**
 * Lists all Docker containers
 */
export async function listContainers() {
    try {
        const { stdout } = await execAsync('/usr/bin/docker ps -a');
        const containers = parseDockerPs(stdout);
        // Get container sizes in parallel
        const containersWithSize = await Promise.all(containers.map(async (container) => {
            try {
                const { stdout: sizeOutput } = await execAsync(`/usr/bin/docker container ls -s -f "id=${container.id}" --format "{{.Size}}"`);
                return { ...container, size: sizeOutput.trim() };
            }
            catch {
                return container;
            }
        }));
        return { ok: true, value: containersWithSize };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to list containers' };
    }
}
/**
 * Starts a Docker container
 */
export async function startContainer(id) {
    try {
        await execAsync(`/usr/bin/docker start ${id}`);
        return { ok: true, value: undefined };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to start container' };
    }
}
/**
 * Stops a Docker container
 */
export async function stopContainer(id) {
    try {
        await execAsync(`/usr/bin/docker stop ${id}`);
        return { ok: true, value: undefined };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to stop container' };
    }
}
/**
 * Removes a Docker container
 */
export async function removeContainer(id) {
    try {
        await execAsync(`/usr/bin/docker rm ${id}`);
        return { ok: true, value: undefined };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to remove container' };
    }
}
/**
 * Gets logs from a Docker container
 */
export async function getContainerLogs(id, tail = 100) {
    try {
        const { stdout } = await execAsync(`/usr/bin/docker logs --tail ${tail} ${id}`);
        return { ok: true, value: stdout.split('\n') };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to get container logs' };
    }
}
/**
 * Gets statistics for a Docker container
 */
export async function getContainerStats(id) {
    try {
        // Get stats with no-stream option to get just one reading
        const { stdout } = await execAsync(`/usr/bin/docker stats ${id} --no-stream --format "{{.CPUPerc}};{{.MemUsage}};{{.MemPerc}};{{.NetIO}};{{.BlockIO}};{{.PIDs}}"`);
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
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to get container statistics' };
    }
}
/**
 * Cleans up unused Docker resources (containers, networks, images)
 */
export async function cleanupSystem() {
    try {
        await execAsync('/usr/bin/docker system prune -f');
        return { ok: true, value: undefined };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to cleanup system' };
    }
}
/**
 * Checks if Docker daemon is running
 */
export async function checkDockerDaemon() {
    try {
        await execAsync('/usr/bin/docker info');
        return { ok: true, value: undefined };
    }
    catch (error) {
        return { ok: false, error: 'Docker daemon is not running' };
    }
}
/**
 * Gets detailed information about a container
 */
export async function inspectContainer(id) {
    try {
        const { stdout } = await execAsync(`/usr/bin/docker inspect ${id}`);
        return { ok: true, value: JSON.parse(stdout)[0] };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to inspect container' };
    }
}
/**
 * Performs bulk operations on multiple containers
 */
export async function performBulkOperation(containerIds, operation) {
    try {
        const operationFn = {
            start: startContainer,
            stop: stopContainer,
            remove: removeContainer
        }[operation];
        const results = await Promise.all(containerIds.map(id => operationFn(id)));
        const errors = results.filter(r => !r.ok).map(r => r.error);
        if (errors.length > 0) {
            return { ok: false, error: `Some operations failed:\n${errors.join('\n')}` };
        }
        return { ok: true, value: undefined };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to perform bulk operation' };
    }
}
/**
 * Executes a command inside a container
 */
export async function execInContainer(id, command) {
    try {
        const { stdout } = await execAsync(`/usr/bin/docker exec ${id} ${command}`);
        return { ok: true, value: stdout };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to execute command in container' };
    }
}
/**
 * Gets environment variables from a container
 */
export async function getContainerEnv(id) {
    try {
        // First try inspect (works even if container is stopped)
        try {
            const { stdout } = await execAsync(`/usr/bin/docker inspect ${id} --format '{{range .Config.Env}}{{println .}}{{end}}'`);
            const env = {};
            stdout.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        env[key] = valueParts.join('=');
                    }
                }
            });
            if (Object.keys(env).length > 0) {
                return { ok: true, value: env };
            }
        }
        catch {
            // Fall through to exec method
        }
        // Fallback to exec (only works if container is running)
        const { stdout } = await execAsync(`/usr/bin/docker exec ${id} env`);
        const env = {};
        stdout.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    env[key] = valueParts.join('=');
                }
            }
        });
        return { ok: true, value: env };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to get container environment variables' };
    }
}
/**
 * Creates and starts a PostgreSQL container
 */
export async function createPostgresContainer(name, password, port = 5432, database = 'postgres') {
    try {
        // Check if container with same name already exists
        const { stdout: existingContainers } = await execAsync(`/usr/bin/docker ps -a --filter "name=${name}" --format "{{.Names}}"`);
        if (existingContainers.trim() === name) {
            return { ok: false, error: `Container with name "${name}" already exists` };
        }
        // Create PostgreSQL container
        const { stdout: containerId } = await execAsync(`/usr/bin/docker run -d ` +
            `--name ${name} ` +
            `-e POSTGRES_PASSWORD=${password} ` +
            `-e POSTGRES_DB=${database} ` +
            `-p ${port}:5432 ` +
            `postgres:latest`);
        const connectionString = `postgresql://postgres:${password}@localhost:${port}/${database}`;
        return {
            ok: true,
            value: {
                id: containerId.trim(),
                connectionString
            }
        };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to create PostgreSQL container' };
    }
}
/**
 * Searches containers by name or image
 */
export async function searchContainers(query) {
    try {
        const allContainers = await listContainers();
        if (!allContainers.ok) {
            return allContainers;
        }
        const queryLower = query.toLowerCase();
        const filtered = allContainers.value.filter(container => container.name.toLowerCase().includes(queryLower) ||
            container.image.toLowerCase().includes(queryLower));
        return { ok: true, value: filtered };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to search containers' };
    }
}
/**
 * Restarts a container
 */
export async function restartContainer(id) {
    try {
        await execAsync(`/usr/bin/docker restart ${id}`);
        return { ok: true, value: undefined };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Failed to restart container' };
    }
}
/**
 * Generates environment variables from containers
 */
export function generateEnvironmentVariables(containers, isVite = false) {
    const envVars = [];
    containers.forEach(container => {
        const prefix = isVite ? 'VITE_' : '';
        // Generate common environment variables based on container name and image
        const sanitizedName = container.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        if (container.image.toLowerCase().includes('postgres') || container.image.toLowerCase().includes('database')) {
            envVars.push(`${prefix}${sanitizedName}_HOST=localhost`);
            envVars.push(`${prefix}${sanitizedName}_PORT=5432`);
            envVars.push(`${prefix}${sanitizedName}_USER=postgres`);
            envVars.push(`${prefix}${sanitizedName}_PASSWORD=${generateRandomPassword()}`);
            envVars.push(`${prefix}${sanitizedName}_DATABASE=${container.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`);
        }
        else if (container.image.toLowerCase().includes('mysql')) {
            envVars.push(`${prefix}${sanitizedName}_HOST=localhost`);
            envVars.push(`${prefix}${sanitizedName}_PORT=3306`);
            envVars.push(`${prefix}${sanitizedName}_USER=root`);
            envVars.push(`${prefix}${sanitizedName}_PASSWORD=${generateRandomPassword()}`);
            envVars.push(`${prefix}${sanitizedName}_DATABASE=${container.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`);
        }
        else if (container.image.toLowerCase().includes('redis')) {
            envVars.push(`${prefix}${sanitizedName}_HOST=localhost`);
            envVars.push(`${prefix}${sanitizedName}_PORT=6379`);
            envVars.push(`${prefix}${sanitizedName}_PASSWORD=${generateRandomPassword()}`);
        }
        else if (container.image.toLowerCase().includes('mongo')) {
            envVars.push(`${prefix}${sanitizedName}_HOST=localhost`);
            envVars.push(`${prefix}${sanitizedName}_PORT=27017`);
            envVars.push(`${prefix}${sanitizedName}_DATABASE=${container.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`);
        }
        else {
            // Generic container
            envVars.push(`${prefix}${sanitizedName}_HOST=localhost`);
            // Try to guess port from common container mappings
            if (container.ports.length > 0) {
                const firstPort = container.ports[0];
                const portMatch = firstPort.match(/:(\d+)/);
                if (portMatch) {
                    envVars.push(`${prefix}${sanitizedName}_PORT=${portMatch[1]}`);
                }
            }
        }
    });
    return envVars.join('\n');
}
/**
 * Generates a docker-compose.yml file from containers
 */
export function generateDockerCompose(containers) {
    const services = [];
    const volumes = [];
    const networks = ['default'];
    containers.forEach(container => {
        const serviceName = container.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        let service = `  ${serviceName}:\n`;
        service += `    image: ${container.image}\n`;
        service += `    container_name: ${container.name}\n`;
        // Add restart policy
        if (container.status === 'running') {
            service += `    restart: unless-stopped\n`;
        }
        // Add ports
        if (container.ports.length > 0) {
            service += `    ports:\n`;
            container.ports.forEach(port => {
                // Clean up port format
                const cleanPort = port.replace(/tcp\/udp$/, '').trim();
                service += `      - "${cleanPort}"\n`;
            });
        }
        // Add common configurations based on image type
        if (container.image.toLowerCase().includes('postgres')) {
            const password = generateRandomPassword();
            service += `    environment:\n`;
            service += `      POSTGRES_DB: ${container.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}\n`;
            service += `      POSTGRES_USER: postgres\n`;
            service += `      POSTGRES_PASSWORD: ${password}\n`;
            volumes.push(`${serviceName}-data:/var/lib/postgresql/data`);
        }
        else if (container.image.toLowerCase().includes('mysql')) {
            const password = generateRandomPassword();
            service += `    environment:\n`;
            service += `      MYSQL_ROOT_PASSWORD: ${password}\n`;
            service += `      MYSQL_DATABASE: ${container.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}\n`;
            volumes.push(`${serviceName}-data:/var/lib/mysql`);
        }
        else if (container.image.toLowerCase().includes('redis')) {
            service += `    command: redis-server --requirepass ${generateRandomPassword()}\n`;
            volumes.push(`${serviceName}-data:/data`);
        }
        else if (container.image.toLowerCase().includes('mongo')) {
            service += `    environment:\n`;
            service += `      MONGO_INITDB_DATABASE: ${container.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}\n`;
            volumes.push(`${serviceName}-data:/data/db`);
        }
        // Add volume mounts if any are defined
        if (volumes.some(v => v.startsWith(serviceName))) {
            service += `    volumes:\n`;
            volumes.filter(v => v.startsWith(serviceName)).forEach(volume => {
                service += `      - ${volume}\n`;
            });
        }
        services.push(service);
    });
    let compose = `version: '3.8'\n\nservices:\n`;
    compose += services.join('\n');
    // Add volumes section if any volumes are defined
    if (volumes.length > 0) {
        compose += `\nvolumes:\n`;
        const uniqueVolumes = [...new Set(volumes)];
        uniqueVolumes.forEach(volume => {
            compose += `  ${volume}:\n`;
        });
    }
    // Add networks section
    compose += `\nnetworks:\n`;
    networks.forEach(network => {
        compose += `  ${network}:\n    driver: bridge\n`;
    });
    return compose;
}
/**
 * Generates a random password
 */
function generateRandomPassword(length = 16) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}
//# sourceMappingURL=docker-utils.js.map