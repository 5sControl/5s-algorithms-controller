const fastify = require('fastify')({
  logger: true,
});
fastify.register(require('@fastify/cors'), (instance) => {
  return (req, callback) => {
    const corsOptions = {
      origin: true,
    };
    callback(null, corsOptions);
  };
});
const { isExists, randomInt, parseRTSPuri } = require('./utils/');
const {
  startContainer,
  removeContainer,
  removeContainers,
  getContainersStats,
  readContainerLogs,
} = require('./containers/run');
const { images } = require('./containers/images');
const {
  validationEndpointRun,
  validationEndpointRunMinMaxAlgorithm,
} = require('./validations/validations');
isExists('images');
const io = require('socket.io-client');
const axios = require('axios');
const algorithms = {};
let isFirstStart = true;
const SERVER_IP = process.env.IP;
const pythonAlgorithms = {};

const socket = io(`http://${SERVER_IP}:3456`);
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
  const container = pythonAlgorithms[algorithms[taskId].camera_url][algorithms[taskId].algorithm];
  const logs = await readContainerLogs(container);
  res.send({ status: true, logs });
});

// algorithm: 'machine_control',
// camera_url: 'rtsp://admin:just4Taqtile@192.168.1.168/h264_stream',
// server_url: 'http://192.168.1.110'
// fastify.post('/run', async (req, res) => {
//   if (isFirstStart) {
//     console.log('<<<<<<<<<remove containers>>>>>>>>');
//     await removeContainers(images);
//     isFirstStart = false;
//   }
//   console.log(req.body, 'req.body');

//   try {
//     let validationError = validationEndpointRun(req.body);
//     if (validationError) {
//       res.send({ status: false, error: validationError });
//       return;
//     }

//     validationError = validationEndpointRunMinMaxAlgorithm(req.body);
//     if (validationError) {
//       console.log(validationError, 'validationError');
//       res.send({ status: false, error: validationError });
//       return;
//     }
//   } catch (e) {
//     console.log(e, 'validatio error catch');
//     res.send({ status: false, error: 'Validation error' });
//     return;
//   }

//   const { camera_url, algorithm, server_url, extra } = req.body;
//   console.log({ algorithm, camera_url, server_url, extra });
//   const parsedUrl = new URL(camera_url);
//   const ip = parsedUrl.hostname;

//   // is algorithms allready started
//   try {
//     if (pythonAlgorithms[camera_url] && pythonAlgorithms[camera_url][algorithm]) {
//       res.send({ status: false, error: 'Algorithm allready started' });
//       return;
//     }
//   } catch (e) {
//     res.send({ status: false, error: 'Validation error' });
//     return;
//   }

//   try {
//     const { hostname, username, password } = parseRTSPuri(req.body.camera_url);
//     let cameraUrlEnv = `camera_url=http://${SERVER_IP}:3456/onvif-http/snapshot`;
//     if (hostname !== SERVER_IP) {
//       cameraUrlEnv += `?camera_ip=${hostname}`;
//     }
//     const envVars = [cameraUrlEnv];
//     envVars.push(`username=${username}`);
//     envVars.push(`password=${password}`);
//     envVars.push(`server_url=${server_url}`);
//     envVars.push(`folder=images/${hostname}`);
//     envVars.push(`camera_ip=${hostname}`);
//     if (!!req.body.extra) {
//       const areas = req.body.extra;
//       const areasStr = JSON.stringify(areas);
//       console.log(areasStr, 'areasStr');
//       envVars.push(`areas=${areasStr}`);
//       envVars.push(`extra=${areasStr}`);
//     }

//     const pid = randomInt();
//     const image = images[algorithm][images[algorithm].length - 1];
//     const version = image.split(':')[1];
//     let container = await startContainer(image, algorithm + '_' + version + '_' + pid, envVars);
//     if (!container) {
//       res.send({ status: false, error: 'Start container error' });
//       return;
//     }
//     if (pythonAlgorithms[camera_url]) {
//       pythonAlgorithms[camera_url][algorithm] = container;
//     } else {
//       pythonAlgorithms[camera_url] = {};
//       pythonAlgorithms[camera_url][algorithm] = container;
//     }

//     algorithms[pid] = { camera_url, algorithm, image, version };

//     res.send({ status: true, pid: pid });
//     return;
//   } catch (e) {
//     console.log(e, 'e');
//     res.send({ status: false, error: 'Start python algorithm error' });
//     return;
//   }
// });

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

// fastify.post('/stop', async (req, res) => {
//   try {
//     const { pid } = req.body;
//     console.log(`stop alg with ${pid} pid`);

//     if (pid && !algorithms[pid]) {
//       res.send({ status: false, error: 'Algorithm wasn`t found' });
//       return;
//     }

//     // stop python algorithms
//     if (pid && algorithms[pid]) {
//       const isContainerRemoved = await removeContainer(
//         pythonAlgorithms[algorithms[pid].camera_url][algorithms[pid].algorithm],
//       );
//       if (isContainerRemoved) {
//         res.send({ status: true });
//         pythonAlgorithms[algorithms[pid].camera_url][algorithms[pid].algorithm] = false;
//         delete algorithms[pid];
//       } else {
//         res.send({ status: false, error: 'Container wasn`t stopped' });
//       }

//       return;
//     }

//     res.send({ status: false, error: 'Algorithm wasn`t stopped' });
//   } catch (e) {
//     console.log(e, 'e');
//     res.send({ status: false, error: 'Stop algorithm error' });
//     return;
//   }
// });

fastify.post('/run', async (req, res) => {
  if (isFirstStart) {
    console.log('<<<<<<<<<remove containers>>>>>>>>');
    const { data: images } = await axios.get(`http://${SERVER_IP}:80/getImages`);
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

  const { camera_url, server_url, image_name: image, extra } = req.body;
  console.log({ camera_url, server_url, extra, image });
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
    const { hostname, username, password } = parseRTSPuri(req.body.camera_url);
    let cameraUrlEnv = `camera_url=http://${SERVER_IP}:3456/onvif-http/snapshot`;
    if (hostname !== SERVER_IP) {
      cameraUrlEnv += `?camera_ip=${hostname}`;
    }
    const envVars = [cameraUrlEnv];
    envVars.push(`username=${username}`);
    envVars.push(`password=${password}`);
    envVars.push(`server_url=${server_url}`);
    envVars.push(`folder=images/${hostname}`);
    envVars.push(`camera_ip=${hostname}`);
    if (!!req.body.extra) {
      const areas = req.body.extra;
      const areasStr = JSON.stringify(areas);
      console.log(areasStr, 'areasStr');
      envVars.push(`areas=${areasStr}`);
      envVars.push(`extra=${areasStr}`);
    }

    const pid = randomInt();
    const containerName = `${image}_${pid}`;

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

    algorithms[pid] = { camera_url, image };

    res.send({ status: true, pid: pid });
    return;
  } catch (e) {
    console.log(e, 'e');
    res.send({ status: false, error: 'Start python algorithm error' });
    return;
  }
});

fastify.post('/info', async (req, res) => {
  const idleImage = images.idle_control[images.idle_control.length - 1];
  const minMaxImage = images.min_max_control[images.min_max_control.length - 1];
  const idleVersion = idleImage.split(':')[1];
  const minMaxVersion = minMaxImage.split(':')[1];

  const operationImage = images.operation_control[images.operation_control.length - 1];
  const operationVersion = operationImage.split(':')[1];
  const machineImage = images.machine_control[images.machine_control.length - 1];
  const machineVersion = machineImage.split(':')[1];
  const machineJsImage = images.machine_control_js[images.machine_control_js.length - 1];
  const machineJsVersion = machineJsImage.split(':')[1];

  res.send([
    {
      name: 'Idle Control PYTHON',
      version: idleVersion,
      date: '09.13.2023',
      description:
        'Designed to ensure that employees stay focused and on-task, preventing distractions' +
        ' such as talking on the phone, smoking breaks, and other time-wasting activities. With Idle Control, ' +
        'employers can monitor employee activity and productivity to ensure maximum efficiency. ',
    },
    {
      name: 'MinMax Control PYTHON',
      version: minMaxVersion,
      date: '09.20.2023',
      description:
        'Designed to ensure that optimal stock levels are maintained. ' +
        'This type of control helps to make informed decisions about when & how much to order. ' +
        'You can avoid overstocking or stockouts, preventing costly production line stoppages and lost profits.',
    },
    {
      name: 'Operation Control',
      version: operationVersion,
      date: '08.31.2023',
      description:
        'Designed to ensure that the necessary number of operations are executed while cleaning seams during production.' +
        ' This type of control helps to streamline the process and prevent any errors or omissions that could lead to costly production delays. ',
    },
    {
      name: 'Machine Control Python',
      version: machineVersion,
      date: '09.20.2023',
      description:
        'Designed to ensure that the machine is not left unsupervised, which' +
        ' could lead to accidents, breakdowns, or other issues (downtime & lost profits). ' +
        'This control is essential in workplaces where machines are used, such as factories, ' +
        'construction sites, or warehouses.',
    },
    {
      name: 'Machine Control Js',
      version: machineJsVersion,
      date: '09.20.2023',
      description:
        'Designed to ensure that the machine is not left unsupervised, which' +
        ' could lead to accidents, breakdowns, or other issues (downtime & lost profits). ' +
        'This control is essential in workplaces where machines are used, such as factories, ' +
        'construction sites, or warehouses.',
    },
  ]);
});

fastify.listen({ port: 3333, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err;
});
