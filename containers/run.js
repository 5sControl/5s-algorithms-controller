const Docker = require('node-docker-api').Docker;
const docker = new Docker({socketPath: '/var/run/docker.sock'})

const startContainer = async (image = 'test_ref', name = 'test_ref', envVars = ['camera_url=http://192.168.1.162/onvif-http/snapshot?Profile_1']) => {
    try {
        const container = await docker.container.create({
            image: image,
            name: name,
            Env: envVars,
            HostConfig: {
                Mounts: [
                    {
                        Type: 'bind',
                        Source: '/home/server/reps/images',
                        Target: '/var/www/5scontrol/images',
                        ReadOnly: false
                    },
                    {
                        Type: 'bind',
                        Source: '/home/server/reps/debug',
                        Target: '/var/www/5scontrol/debug',
                        ReadOnly: false
                    }
                ],
                CpuQuota: 100000,
                NetworkMode: 'host'
            }
        })
        const startedContainer = await container.start();
        return startedContainer
    } catch (e) {
        console.log(e, 'e')
        return false
    }
}

const removeContainer = async (container) => {
    try {
        const deletedContainer = await container.delete({force: true})
        return true
    } catch (e) {
        console.log(e, 'e')
        return false
    }
}

const removeContainerByImage = async (imageName) => {
    try {
        const containers = await docker.container.list({all: true});

        for (const container of containers) {
            const containerDetails = await container.status();
            let containerImage = containerDetails.data.Config.Image;
            containerImage = containerImage.split(':')[0];
            if (containerImage === imageName) {
                await container.delete({force: true})
                console.log(`Container stopped successfully.`);
            }
        }
        return true;
    } catch (error) {
        console.error('Error stopping container:', error);
        return false;
    }
};

const removeContainers = async (images) => {
    for (const [key, imageArray] of Object.entries(images)) {
        console.log(`Key: ${key}`);
        console.log(`Images: ${imageArray.join(', ')}`);

        for (const image of imageArray) {
            await removeContainerByImage(image.split(':')[0])
        }
    }
};

async function readContainerStats(container) {
    try {
        const statsStream = await container.stats();
        const chunks = []
        return new Promise((resolve, reject) => {
            statsStream
                .on('data', (chunk) => {
                    if (chunks.length === 2) {
                        statsStream.destroy();
                        const currentStats = JSON.parse(chunks[1].toString());
                        const previousStats = JSON.parse(chunks[0].toString());
                        const data = {currentStats, previousStats}
                        resolve(data);
                    } else {
                        chunks.push(chunk)
                    }
                })
        });
    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
}

async function readContainerLogs(container) {
    try {
        // const stream = await container.logs({follow: true, stdout: true, stderr: true})
        return new Promise((resolve, reject) => {
            container.logs({follow: true, stdout: true, stderr: true}).then((stream) => {
                stream.on('data', (chunk) => {
                    resolve(chunk.toString())
                });
            }).catch((err) => {
                console.error('readContainerLogs error:', err);
                resolve(err);
            });
        });
    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
}

async function readContainerStatus(container) {
    try {
        let status = await container.status();
        status = status.data.State.Status;
        return status;
    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
}

function calculateContainerCpuLoad(currentCpuStats, previousCpuStats) {
    const currentTotalUsage = currentCpuStats.cpu_usage.total_usage;
    const previousTotalUsage = previousCpuStats.cpu_usage.total_usage;

    const currentSystemUsage = currentCpuStats.system_cpu_usage;
    const previousSystemUsage = previousCpuStats.system_cpu_usage;

    const cpuDelta = currentTotalUsage - previousTotalUsage;
    const systemDelta = currentSystemUsage - previousSystemUsage;
    const {online_cpus} = currentCpuStats;

    const cpuLoadPercentage = (cpuDelta / systemDelta) * online_cpus * 100;

    return cpuLoadPercentage.toFixed(2);
}

const getContainersStats = async (algorithms, pythonAlgorithms) => {
    const algorithmsDataToSend = {};
    for (const alg in algorithms) {
        const {version, image, algorithm, camera_url} = algorithms[alg];
        const container = pythonAlgorithms[camera_url][algorithm];
        const status = await readContainerStatus(container);
        let {previousStats, currentStats} = await readContainerStats(container);
        const {memory_stats} = currentStats;
        let ram = memory_stats.usage / 1000000; // to mb;
        let cpu = calculateContainerCpuLoad(currentStats.cpu_stats, previousStats.cpu_stats);
        cpu = cpu + '%';
        ram = ram.toFixed(0) + 'M'
        const additionalData = {cpu, ram, status}
        algorithmsDataToSend[alg] = {...algorithms[alg], ...additionalData}
    }
    return algorithmsDataToSend;
};

module.exports = {startContainer, removeContainer, removeContainerByImage, removeContainers, getContainersStats}