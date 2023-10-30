import cors from '@fastify/cors';
import fastyifyApp from 'fastify';
import io from 'socket.io-client';
import axios from 'axios';
import { isExists, randomInt, parseRTSPuri } from './utils/index.js';
import {
  startContainer,
  removeContainer,
  removeContainers,
  getContainersStats,
  readContainerLogs,
  pullImageFromDockerHub,
  searchImageOnDockerHub,
  searchImage,
} from './containers/run.js';
import {
  validationEndpointRun,
  validationEndpointRunMinMaxAlgorithm,
} from './validations/validations.js';

const fastify = fastyifyApp({
  logger: true,
});

fastify.register(cors, (instance) => {
  return (req, callback) => {
    const corsOptions = {
      origin: true,
    };
    callback(null, corsOptions);
  };
});

isExists('images');
const algorithms = {};
let isFirstStart = true;
const DJANGO_SERVICE_URL = process.env.DJANGO_SERVICE_URL;
const ONVIF_SERVICE_URL = process.env.ONVIF_SERVICE_URL;
const RUNNING_ON_K8S = process.env.K8S;
setTimeout(() => {
  axios.get(`http://${DJANGO_SERVICE_URL}:8000/api/core/start-process/`);
}, 10000)

const pythonAlgorithms = {};

const socket = io(`http://${ONVIF_SERVICE_URL}:3456`);
let tasks = {};
function asyncSetInterval(fn, interval) {
  const asyncWrapper = async () => {
    await fn();
    scheduleAsync();
  };

  function scheduleAsync() {
    setTimeout(asyncWrapper, interval);
  }

  scheduleAsync();

  // Return a function to stop the async interval
  return () => clearTimeout(asyncWrapper);
}
socket.on('connect', () => {
  console.log('<<<<<connect>>>>');
  const fn = (algorithms, pythonAlgorithms, socket) => {
    return async () => {
      const stats = await getContainersStats(algorithms, pythonAlgorithms);
      console.log('<<<<<<emit>>>>>>');
      tasks = stats;
      socket.emit('tasks', stats);
    };
  };
  const getStatsFn = fn(algorithms, pythonAlgorithms, socket);
  asyncSetInterval(getStatsFn, 1000);
});

setInterval(() => {
  console.log(algorithms, 'algorithms');
  console.log(pythonAlgorithms, 'pythonAlgorithms');
}, 1000 * 60 * 10);

fastify.get('/tasks', async (req, res) => {
  res.send({ status: true, tasks });
});

fastify.get('/logs', async (req, res) => {
  const { taskId } = req.query;
  if (!taskId) return res.send({ status: false, error: 'taskId is required' });
  if (!algorithms[taskId]) return res.send({ status: false, error: 'task not found' });
  const container = pythonAlgorithms[algorithms[taskId].camera_url][algorithms[taskId].image];
  const logs = await readContainerLogs(container);
  res.send({ status: true, logs });
});

fastify.post('/stop', async (req, res) => {
  try {
    const { pid } = req.body;
    console.log(`stop alg with ${pid} pid`);

    if (pid && !algorithms[pid]) {
      res.send({ status: false, error: 'Algorithm wasn`t found' });
      return;
    }

    // stop python algorithms
    if (pid && algorithms[pid]) {
      const isContainerRemoved = await removeContainer(
        pythonAlgorithms[algorithms[pid].camera_url][algorithms[pid].image],
      );
      if (isContainerRemoved) {
        res.send({ status: true });
        pythonAlgorithms[algorithms[pid].camera_url][algorithms[pid].image] = false;
        delete algorithms[pid];
      } else {
        res.send({ status: false, error: 'Container wasn`t stopped' });
      }

      return;
    }

    res.send({ status: false, error: 'Algorithm wasn`t stopped' });
  } catch (e) {
    console.log(e, 'e');
    res.send({ status: false, error: 'Stop algorithm error' });
    return;
  }
});

fastify.post('/run', async (req, res) => {
  if (isFirstStart && !RUNNING_ON_K8S) {
    console.log('<<<<<<<<<remove containers>>>>>>>>');
    const { data: images } = await axios.get(
      `http://${DJANGO_SERVICE_URL}:8000/api/camera-algorithms/unique-image-names`,
    );
    console.log(images);
    await removeContainers(images);
    isFirstStart = false;
  }
  console.log(req.body, 'req.body');

  // try {
  //   let validationError = validationEndpointRun(req.body);
  //   if (validationError) {
  //     res.send({ status: false, error: validationError });
  //     return;
  //   }

  //   validationError = validationEndpointRunMinMaxAlgorithm(req.body);
  //   if (validationError) {
  //     console.log(validationError, 'validationError');
  //     res.send({ status: false, error: validationError });
  //     return;
  //   }
  // } catch (e) {
  //   console.log(e, 'validatio error catch');
  //   res.send({ status: false, error: 'Validation error' });
  //   return;
  // }

  const { camera_url, server_url, algorithm, link_reports, image_name: image, extra } = req.body;
  console.log({ camera_url, server_url, extra, image, algorithm });
  const parsedUrl = new URL(camera_url);
  const ip = parsedUrl.hostname;

  // is algorithms allready started
  try {
    if (pythonAlgorithms[camera_url] && pythonAlgorithms[camera_url][image]) {
      res.send({ status: false, error: 'Algorithm allready started' });
      return;
    }
  } catch (e) {
    res.send({ status: false, error: 'Validation error' });
    return;
  }

  try {
    if (!RUNNING_ON_K8S) {
      let { hostname, username, password } = parseRTSPuri(req.body.camera_url);
      let cameraUrlEnv = `camera_url=http://${ONVIF_SERVICE_URL}:3456/onvif-http/snapshot`;
      if (hostname !== ONVIF_SERVICE_URL) {
        cameraUrlEnv += `?camera_ip=${hostname}`;
      }
      const envVars = [cameraUrlEnv];
      envVars.push(`camera_stream_url=${camera_url}`);
      envVars.push(`username=${username}`);
      envVars.push(`password=${password}`);
      envVars.push(`server_url=${server_url}`);
      envVars.push(`link_reports=${link_reports}`);
      envVars.push(`folder=images/${hostname}`);
      envVars.push(`camera_ip=${hostname}`);
      envVars.push(`algorithm_name=${algorithm}`);
      if (!!req.body.extra) {
        const areas = req.body.extra;
        const areasStr = JSON.stringify(areas);
        console.log(areasStr, 'areasStr');
        envVars.push(`areas=${areasStr}`);
        envVars.push(`extra=${areasStr}`);
      }

      const pid = randomInt();
      const containerName = `${algorithm.replace(/[/:]/g, '_')}_${pid}`;

      let container = await startContainer(image, containerName, envVars);
      if (!container) {
        res.send({ status: false, error: 'Start container error' });
        return;
      }
      if (pythonAlgorithms[camera_url]) {
        pythonAlgorithms[camera_url][image] = container;
      } else {
        pythonAlgorithms[camera_url] = {};
        pythonAlgorithms[camera_url][image] = container;
      }

      algorithms[pid] = { camera_url, image, algorithm };

      res.send({ status: true, pid: pid });
      return;
    } else {
      const { hostname, username, password } = parseRTSPuri(req.body.camera_url);
      let envVars = [{ name: 'camera_url', value: `http://${ONVIF_SERVICE_URL}:3456/onvif-http/snapshot` }];
      if (hostname !== ONVIF_SERVICE_URL) {
        envVars = [
          {
            name: 'camera_url',
            value: `http://${ONVIF_SERVICE_URL}:3456/onvif-http/snapshot?camera_ip=${hostname}`,
          },
        ];
      }
      envVars.push({ name: 'username', value: username });
      envVars.push({ name: 'password', value: password });

      const modelNamesToServiceNames = {"min_max_control": "http://min-max-model", "machine_control": "http://machine-model", "machine_control_js": "http://machine-model-js", "idle_control": "http://idle-model"}
      envVars.push({ name: 'server_url', value: modelNamesToServiceNames[algorithm]});
      envVars.push({ name: 'folder', value: `images/${hostname}` });
      envVars.push({ name: 'algorithm_name', value: algorithm });
      if (!!req.body.extra) {
        const areas = req.body.extra;
        const areasStr = JSON.stringify(areas);
        console.log(areasStr, 'areasStr');
        envVars.push({ name: 'areas', value: areasStr });
        envVars.push({ name: 'extra', value: areasStr });
      }

      let pod = await startContainer(image, algorithm, envVars);
      if (!pod) {
        res.send({ status: false, error: 'Start container error' });
        return;
      }
      if (pythonAlgorithms[camera_url]) {
        pythonAlgorithms[camera_url][image] = pod;
      } else {
        pythonAlgorithms[camera_url] = {};
        pythonAlgorithms[camera_url][image] = pod;
      }

      algorithms[pod] = { camera_url, image, algorithm };

      res.send({ status: true, pid: +pod });
      return;
    }
  } catch (e) {
    console.log(e, 'e');
    res.send({ status: false, error: 'Start python algorithm error' });
    return;
  }
});
fastify.get('/image/search', async (req, res) => {
  try {
    const { image_name } = req.query;

    const [imageName, tag] = image_name.split(':');

    const image = await searchImage(imageName, tag);
    if (image)
      return { status: true, download: true, date: new Date(image.data.Created).toISOString() };

    await searchImageOnDockerHub(imageName, tag);

    return { status: true, download: false };
  } catch (e) {
    console.log(e.message);
    return { status: false, error: e.message };
  }
});

fastify.get('/image/download', async (req, res) => {
  try {
    const { image_name } = req.query;

    const [imageName, tag] = image_name.split(':');

    const image = await pullImageFromDockerHub(imageName, tag);

    return { status: true, date: new Date(image.data.Created).toISOString() };
  } catch (e) {
    return { status: false, error: e.message };
  }
});

fastify.listen({ port: 3333, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err;
});
