import { Docker } from 'node-docker-api';
import axios from 'axios';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const K8S_MASTER_IP = process.env.K8S_MASTER_IP || '192.168.1.115';
const RUNNING_ON_K8S = process.env.K8S;
const ALGORITMS_TARGET_DEBUG_DIST = process.env.ALGORITMS_TARGET_DEBUG_DIST;
const ALGORITMS_TARGET_IMAGES_DIST = process.env.ALGORITMS_TARGET_IMAGES_DIST;
const ALGORITMS_SOURCE_DEBUG_DIST = process.env.ALGORITMS_SOURCE_DEBUG_DIST;
const ALGORITMS_SOURCE_IMAGES_DIST = process.env.ALGORITMS_SOURCE_IMAGES_DIST;

export const startContainer = async (
  image = 'test_ref',
  name = 'test_ref',
  envVars = ['camera_url=http://192.168.1.162/onvif-http/snapshot?Profile_1'],
) => {
  try {
    if (!RUNNING_ON_K8S) {
      const container = await docker.container.create({
        image: image,
        name: name,
        Env: envVars,
        HostConfig: {
          Mounts: [
            {
              Type: 'bind',
              Source: ALGORITMS_SOURCE_IMAGES_DIST,
              Target: ALGORITMS_TARGET_IMAGES_DIST,
              ReadOnly: false,
            },
            {
              Type: 'bind',
              Source: ALGORITMS_SOURCE_DEBUG_DIST,
              Target: ALGORITMS_TARGET_DEBUG_DIST,
              ReadOnly: false,
            },
          ],
          CpuQuota: 100000,
          NetworkMode: 'host',
        },
      });
      const startedContainer = await container.start();
      return startedContainer;
    } else {
      const body = { image, name, envVars };
      const response = await axios.post(`http://${K8S_MASTER_IP}:4545/create-pod`, body);
      return response.data?.name || null;
    }
  } catch (e) {
    console.log(e, 'e');
    return false;
  }
};

export const removeContainer = async (pod) => {
  try {
    if (!RUNNING_ON_K8S) {
      const deletedContainer = await pod.delete({ force: true });
      return true;
    } else {
      const response = await axios.post(`http://${K8S_MASTER_IP}:4545/stop-pod`, { pod });
      return response.data?.success;
    }
  } catch (e) {
    console.log(e, 'e');
    return false;
  }
};

// const removeContainerByImage = async (imageName) => {
//   try {
//     const containers = await docker.container.list({ all: true });

//     for (const container of containers) {
//       const containerDetails = await container.status();
//       let containerImage = containerDetails.data.Config.Image;
//       containerImage = containerImage.split(':')[0];
//       if (containerImage === imageName) {
//         await container.delete({ force: true });
//         console.log(`Container stopped successfully.`);
//       }
//     }
//     return true;
//   } catch (error) {
//     console.error('Error stopping container:', error);
//     return false;
//   }
// };

export const removeContainerByImage = async (imageName) => {
  try {
    const containers = await docker.container.list({ all: true });

    for (const container of containers) {
      const containerDetails = await container.status();
      const containerImage = containerDetails.data.Config.Image;
      if (containerImage === imageName) {
        await container.delete({ force: true });
        console.log(`Container stopped successfully.`);
      }
    }
    return true;
  } catch (error) {
    console.error('Error stopping container:', error);
    return false;
  }
};

export const removeContainers = async (images) => {
  for (const image of images) {
    console.log(`Image: ${image}`);

    await removeContainerByImage(image);
  }
};

export const readContainerStats = async (container) => {
  try {
    const statsStream = await container.stats();
    const chunks = [];
    return new Promise((resolve, reject) => {
      statsStream.on('data', (chunk) => {
        if (chunks.length === 2) {
          statsStream.destroy();
          const currentStats = JSON.parse(chunks[1].toString());
          const previousStats = JSON.parse(chunks[0].toString());
          const data = { currentStats, previousStats };
          resolve(data);
        } else {
          chunks.push(chunk);
        }
      });
    });
  } catch (err) {
    console.error('Error:', err);
    throw err;
  }
};

export const readContainerLogs = async (container) => {
  try {
    const logs = [];
    // const stream = await container.logs({follow: true, stdout: true, stderr: true})
    return new Promise((resolve, reject) => {
      container
        .logs({ follow: false, stdout: true, stderr: true })
        .then((stream) => {
          stream.on('data', (chunk) => {
            logs.unshift(chunk.toString());
          });

          stream.on('end', () => {
            resolve(logs.map((log) => log.replace(/\\u[0-9a-f]{4}|[^ -~]+/g, '')));
          });
        })
        .catch((err) => {
          console.error('readContainerLogs error:', err);
          resolve(err);
        });
    });
  } catch (err) {
    console.error('Error:', err);
    throw err;
  }
};

export const searchImage = async (imageName, tag = 'latest') => {
  const image = docker.image.get(`${imageName}:${tag}`);
  return image.status().catch(() => null);
};

export const searchImageOnDockerHub = async (imageName, tag = 'latest') => {
  try {
    const image = await axios.get(
      `https://hub.docker.com/v2/repositories/${imageName}/tags/${tag}`,
    );
    return image.data;
  } catch (e) {
    // console.log(e);
    if (e.response.status === 404)
      throw new Error(`Image ${imageName}:${tag} not found on Docker Hub`);
    throw e;
  }
};

const promisifyStream = (stream) =>
  new Promise((resolve, reject) => {
    stream.on('data', (data) => data);
    stream.on('end', resolve);
    stream.on('error', reject);
  });

export const pullImageFromDockerHub = async (imageName, tag = 'latest') => {
  return docker.image
    .create({}, { fromImage: imageName, tag })
    .then((stream) => promisifyStream(stream))
    .then(() => docker.image.get(`${imageName}:${tag}`))
    .catch((e) => {
      if (e.statusCode === 404) e.message = 'Image not found on Docker Hub';
      throw e;
    })
    .then((image) => image.status());
};

export const readContainerStatus = async (container) => {
  try {
    let status = await container.status();
    status = status.data.State.Status;
    return status;
  } catch (err) {
    console.error('Error:', err);
    throw err;
  }
};

export const calculateContainerCpuLoad = async (currentCpuStats, previousCpuStats) => {
  const currentTotalUsage = currentCpuStats.cpu_usage.total_usage;
  const previousTotalUsage = previousCpuStats.cpu_usage.total_usage;

  const currentSystemUsage = currentCpuStats.system_cpu_usage;
  const previousSystemUsage = previousCpuStats.system_cpu_usage;

  const cpuDelta = currentTotalUsage - previousTotalUsage;
  const systemDelta = currentSystemUsage - previousSystemUsage;
  const { online_cpus } = currentCpuStats;

  const cpuLoadPercentage = (cpuDelta / systemDelta) * online_cpus * 100;

  return cpuLoadPercentage.toFixed(2);
};

export const getContainersStats = async (algorithms, pythonAlgorithms) => {
  try {
    const algorithmsDataToSend = {};
    for (const alg in algorithms) {
      let { version, algorithm, image, camera_url } = algorithms[alg];
      const container = pythonAlgorithms[camera_url][image];
      const status = await readContainerStatus(container);
      let { previousStats, currentStats } = await readContainerStats(container);
      const { memory_stats } = currentStats;
      let ram = memory_stats.usage / 1000000; // to mb;
      let cpu = calculateContainerCpuLoad(currentStats.cpu_stats, previousStats.cpu_stats);
      if (isNaN(cpu)) {
        cpu = 0;
      }
      if (isNaN(ram)) {
        ram = 0;
      }
      cpu = cpu + '%';
      ram = ram.toFixed(0) + 'M';
      let gpu = '0%';

      const additionalData = { cpu, ram, status, gpu };
      algorithmsDataToSend[alg] = { ...algorithms[alg], ...additionalData };
      const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
      const match = ipPattern.exec(camera_url);
      if (match) {
        algorithmsDataToSend[alg].camera_url = match[0];
      }
    }
    return algorithmsDataToSend;
  } catch (e) {
    console.log(e, 'e');
    return 'Get stats error';
  }
};
