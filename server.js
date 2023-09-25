const path = require('path');
const express = require('express');
const app = express();
const { isExists, randomInt, parseRTSPuri } = require('./utils/');
const { startContainer, removeContainer, removeContainers } = require('./containers/run.js');
const { images } = require('./containers/images');
const bodyParser = require('body-parser');
const {
  validationEndpointRun,
  validationEndpointRunMinMaxAlgorithm,
} = require('./validations/validations');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
isExists('images');
const cameras = {};
const algorithms = {};
let isFirstStart = true;

const Algorithms = {
  idle_control: Idle,
  machine_control: Machine,
  safety_control_ear_protection: Safety,
  safety_control_reflective_jacket: Safety,
  operation_control: CornerCleaning,
  min_max_control: MinMax,
};
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// algorithm: 'machine_control',
// camera_url: 'rtsp://admin:just4Taqtile@192.168.1.168/h264_stream',
// server_url: 'http://192.168.1.110'
const MIN_MAX_PYTHON = process.env.MIN_MAX_PYTHON;
const IDLE_PYTHON = process.env.IDLE_PYTHON;
const SERVER_IP = process.env.IP;
const pythonAlgorithms = {};

setInterval(() => {
  console.log(algorithms, 'algorithms');
}, 60000);

app.use('/run', async (req, res) => {
  if (isFirstStart) {
    console.log('<<<<<<<<<remove containers>>>>>>>>');
    await removeContainers(images);
    isFirstStart = false;
  }
  console.log(req.body, 'req.body');
  // validation
  try {
    let validationError = validationEndpointRun(req.body);
    if (validationError) {
      res.json({ status: false, error: validationError });
      return;
    }

    validationError = validationEndpointRunMinMaxAlgorithm(req.body);
    if (validationError) {
      console.log(validationError, 'validationError');
      res.json({ status: false, error: validationError });
      return;
    }
  } catch (e) {
    res.json({ status: false, error: 'Validation error' });
    return;
  }
  const { camera_url, algorithm, server_url, extra } = req.body;
  console.log({ algorithm, camera_url, server_url, extra });

  const parsedUrl = new URL(camera_url);
  const ip = parsedUrl.hostname;

  // is algorithms allready started
  try {
    if (cameras[req.body.camera_url]?.algorithms.includes(algorithm)) {
      res.json({ status: false, error: 'Algorithm allready started' });
      return;
    }
    if (pythonAlgorithms[camera_url] && pythonAlgorithms[camera_url][algorithm]) {
      res.json({ status: false, error: 'Algorithm allready started' });
      return;
    }
  } catch (e) {
    res.json({ status: false, error: 'Validation error' });
    return;
  }

  // python algorithms
  try {
    if (
      (req.body.algorithm === 'min_max_control' && MIN_MAX_PYTHON) ||
      (req.body.algorithm === 'idle_control' && IDLE_PYTHON)
    ) {
      const { hostname, username, password } = parseRTSPuri(req.body.camera_url);
      const envVars = [
        `camera_url=http://${SERVER_IP}:3456/onvif-http/snapshot?Profile_1?camera_ip=${hostname}`,
      ];
      envVars.push(`username=${username}`);
      envVars.push(`password=${password}`);
      envVars.push(`server_url=${server_url}`);
      envVars.push(`folder=images/${hostname}`);
      if (req.body.algorithm === 'min_max_control') {
        const areas = req.body.extra;
        const areasStr = JSON.stringify(areas);
        console.log(areasStr, 'areasStr');
        envVars.push(`areas=${areasStr}`);
      }

      const pid = randomInt();
      const image = images[algorithm][images[algorithm].length - 1];
      const version = image.split(':')[1];
      let container = await startContainer(image, algorithm + '_' + version + '_' + pid, envVars);
      if (!container) {
        res.json({ status: false, error: 'Start container error' });
        return;
      }
      algorithms[pid] = { container, algorithm, camera_url };
      if (pythonAlgorithms[camera_url]) {
        pythonAlgorithms[camera_url][algorithm] = container;
      } else {
        pythonAlgorithms[camera_url] = {};
        pythonAlgorithms[camera_url][algorithm] = container;
      }

      res.json({ status: true, pid: pid });
      return;
    }
  } catch (e) {
    console.log(e, 'e');
    res.json({ status: false, error: 'Start python algorithm error' });
    return;
  }

  // js algorithms
  try {
    const reqBody = { algorithm, camera_url, server_url, extra };
    const currentAlgorithm = Algorithms[reqBody.algorithm];

    if (!cameras[reqBody.camera_url]) {
      const camera = new Camera();
      const cameraInterval = await camera.init(reqBody, server_url.indexOf(ip) !== -1, SERVER_IP);
      if (!cameraInterval.snapshot.buffer) {
        console.log('Snapshot not found');
        res.json({ status: false, message: 'Snapshot not found' });
        return;
      }

      cameras[reqBody.camera_url] = cameraInterval;
      cameras[reqBody.camera_url].algorithms = [algorithm];
    } else if (cameras[reqBody.camera_url].algorithms.includes(algorithm)) {
      console.log('The requested algorithm is already running');
      res.json({ status: false, message: 'The requested algorithm is already running' });
      return;
    } else {
      cameras[reqBody.camera_url].algorithms.push(algorithm);
    }

    const createdAlgorithm = new currentAlgorithm(
      cameras[reqBody.camera_url].camera,
      algorithm,
      extra,
    );

    const algorithmInterval = await createdAlgorithm.start(cameras[reqBody.camera_url].camera);
    const intervalId = randomInt();
    algorithms[intervalId] = { algorithmInterval, algorithm, camera_url };

    res.json({ status: true, pid: intervalId });
  } catch (e) {
    console.log(e, 'e');
    res.json({ status: false });
  }
});
app.post('/stop', async (req, res) => {
  try {
    const { pid } = req.body;
    console.log(`stop alg with ${pid} pid`);

    if (pid && !algorithms[pid]) {
      res.json({ status: false, error: 'Algorithm wasn`t found' });
      return;
    }

    // stop python algorithms
    if (pid && algorithms[pid] && algorithms[pid]?.container) {
      const isContainerRemoved = await removeContainer(algorithms[pid].container);
      if (isContainerRemoved) {
        res.json({ status: true });
        pythonAlgorithms[algorithms[pid].camera_url][algorithms[pid].algorithm] = false;
        delete algorithms[pid];
      } else {
        res.json({ status: false, error: 'Container wasn`t stopped' });
      }

      return;
    }

    // stop js algorithms
    if (pid && algorithms[pid] && !algorithms[pid]?.container) {
      clearInterval(algorithms[pid].algorithmInterval);
      const { camera_url, algorithm } = algorithms[pid];
      if (cameras[camera_url].algorithms.includes(algorithm)) {
        cameras[camera_url].algorithms = cameras[camera_url].algorithms.filter(
          (algoName) => algoName !== algorithm,
        );
      }
      res.json({ status: true });
      delete algorithms[pid];
      return;
    }

    res.json({ status: false, error: 'Algorithm wasn`t stopped' });
  } catch (e) {
    console.log(e, 'e');
    res.json({ status: false, error: 'Stop algorithm error' });
    return;
  }
});

app.post('/info', async (req, res) => {
  const idleImage = images.idle_control[images.idle_control.length - 1];
  const minMaxImage = images.min_max_control[images.min_max_control.length - 1];
  const idleVersion = idleImage.split(':')[1];
  const minMaxVersion = minMaxImage.split(':')[1];

  res.json([
    {
      name: 'Idle Control JS',
      version: 'v0.1.0',
    },
    {
      name: 'Idle Control PYTHON',
      version: idleVersion,
    },
    {
      name: 'Machine Control JS',
      version: 'v0.1.0',
    },
    {
      name: 'Safety Control ear protection JS',
      version: 'v0.1.0',
    },
    {
      name: 'Safety Control head protection JS',
      version: 'v0.1.0',
    },
    {
      name: 'Safety Control hand protection JS',
      version: 'v0.1.0',
    },
    {
      name: 'Safety Control reflective jacket JS',
      version: 'v0.1.0',
    },
    {
      name: 'MinMax Control JS',
      version: 'v0.3.4',
    },
    {
      name: 'MinMax Control PYTHON',
      version: minMaxVersion,
    },
    {
      name: 'Operation Control',
      version: 'v0.3.1',
    },
  ]);
});

app.listen(3333);
