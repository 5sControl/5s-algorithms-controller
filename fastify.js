const fastify = require('fastify')({
    logger: true
})
const path = require('path')
const {isExists, randomInt, parseRTSPuri} = require('./utils/')
const {startContainer, removeContainer, removeContainers} = require('./containers/run')
const {images} = require('./containers/images')
const {validationEndpointRun, validationEndpointRunMinMaxAlgorithm} = require("./validations/validations");
isExists("images")

const algorithms = {}
let isFirstStart = true;

setInterval(() => {
    console.log(algorithms, 'algorithms')
}, 10000)

const MIN_MAX_PYTHON = process.env.MIN_MAX_PYTHON;
const IDLE_PYTHON = process.env.IDLE_PYTHON;
const SERVER_IP = process.env.IP;
const pythonAlgorithms = {}

// algorithm: 'machine_control',
// camera_url: 'rtsp://admin:just4Taqtile@192.168.1.168/h264_stream',
// server_url: 'http://192.168.1.110'
fastify.post('/run', async (req, res) => {
    if (isFirstStart) {
        console.log('<<<<<<<<<remove containers>>>>>>>>')
        await removeContainers(images)
        isFirstStart = false;
    }
    console.log(req.body, 'req.body')

    try {
        let validationError = validationEndpointRun(req.body)
        if (validationError) {
            res.send({'status': false, 'error': validationError})
            return
        }

        validationError = validationEndpointRunMinMaxAlgorithm(req.body)
        if (validationError) {
            console.log(validationError, 'validationError')
            res.send({'status': false, 'error': validationError})
            return
        }
    } catch (e) {
        res.send({'status': false, 'error': 'Validation error'})
        return
    }

    const {camera_url, algorithm, server_url, extra} = req.body;
    console.log({algorithm, camera_url, server_url, extra})
    const parsedUrl = new URL(camera_url);
    const ip = parsedUrl.hostname;

    // is algorithms allready started
    try {
        if (pythonAlgorithms[camera_url] && pythonAlgorithms[camera_url][algorithm]) {
            res.send({'status': false, 'error': 'Algorithm allready started'})
            return
        }
    } catch (e) {
        res.send({'status': false, 'error': 'Validation error'})
        return
    }

    try {
        const {hostname, username, password} = parseRTSPuri(req.body.camera_url)
        const envVars = [`camera_url=http://${SERVER_IP}:3456/onvif-http/snapshot?Profile_1?camera_ip=${hostname}`]
        envVars.push(`username=${username}`)
        envVars.push(`password=${password}`)
        envVars.push(`server_url=${server_url}`)
        envVars.push(`folder=images/${hostname}`)
        if (req.body.algorithm === 'min_max_control') {
            const areas = req.body.extra;
            const areasStr = JSON.stringify(areas)
            console.log(areasStr, 'areasStr')
            envVars.push(`areas=${areasStr}`)
        }

        const pid = randomInt()
        const image = images[algorithm][images[algorithm].length - 1];
        const version = image.split(':')[1];
        let container = await startContainer(image, algorithm + '_' + version + '_' + pid, envVars)
        if (!container) {
            res.send({'status': false, 'error': 'Start container error'})
            return
        }
        if (pythonAlgorithms[camera_url]) {
            pythonAlgorithms[camera_url][algorithm] = true
        } else {
            pythonAlgorithms[camera_url] = {}
            pythonAlgorithms[camera_url][algorithm] = true
        }

        res.send({'status': true, 'pid': pid})
        return
    } catch (e) {
        console.log(e, 'e')
        res.send({'status': false, 'error': 'Start python algorithm error'})
        return
    }
})

fastify.post('/stop', async (req, res) => {
    try {
        const {pid} = req.body;
        console.log(`stop alg with ${pid} pid`)

        if (pid && !algorithms[pid]) {
            res.send({'status': false, 'error': 'Algorithm wasn`t found'})
            return
        }

        // stop python algorithms
        if (pid && algorithms[pid] && algorithms[pid]?.container) {
            const isContainerRemoved = await removeContainer(algorithms[pid].container)
            if (isContainerRemoved) {
                res.send({'status': true})
                pythonAlgorithms[algorithms[pid].camera_url][algorithms[pid].algorithm] = false
                delete algorithms[pid]
            } else {
                res.send({'status': false, 'error': 'Container wasn`t stopped'})
            }

            return
        }

        res.send({'status': false, 'error': 'Algorithm wasn`t stopped'})
    } catch (e) {
        console.log(e, 'e')
        res.send({'status': false, 'error': 'Stop algorithm error'})
        return
    }
})

fastify.post('/info', async (req, res) => {
    const idleImage = images.idle_control[images.idle_control.length - 1]
    const minMaxImage = images.min_max_control[images.min_max_control.length - 1]
    const idleVersion = idleImage.split(':')[1];
    const minMaxVersion = minMaxImage.split(':')[1];

    const operationImage = images.operation_control[images.operation_control.length - 1]
    const operationVersion = operationImage.split(':')[1];
    const machineImage = images.machine_control[images.machine_control.length - 1]
    const machineVersion = machineImage.split(':')[1];


    res.send([
        {
            "name": "Idle Control PYTHON",
            "version": idleVersion,
            "date": "05.23.2023",
            "description": 'Designed to ensure that employees stay focused and on-task, preventing distractions' +
                ' such as talking on the phone, smoking breaks, and other time-wasting activities. With Idle Control, ' +
                'employers can monitor employee activity and productivity to ensure maximum efficiency. '
        },
        {
            "name": "MinMax Control PYTHON",
            "version": minMaxVersion,
            "date": "06.02.2023",
            "description": 'Designed to ensure that optimal stock levels are maintained. ' +
                'This type of control helps to make informed decisions about when & how much to order. ' +
                'You can avoid overstocking or stockouts, preventing costly production line stoppages and lost profits.'
        },
        {
            "name": "Operation Control",
            "version": operationVersion,
            "date": '05.25.2023',
            "description": 'Designed to ensure that the necessary number of operations are executed while cleaning seams during production.' +
                ' This type of control helps to streamline the process and prevent any errors or omissions that could lead to costly production delays. ',
        },
        {
            "name": "Machine Control JS",
            "version": machineVersion,
            "date": '03.23.2023',
            "description": 'Designed to ensure that the machine is not left unsupervised, which' +
                ' could lead to accidents, breakdowns, or other issues (downtime & lost profits). ' +
                'This control is essential in workplaces where machines are used, such as factories, ' +
                'construction sites, or warehouses.',
        }
    ])
})

fastify.listen({port: 3333, host: '0.0.0.0'}, (err, address) => {
    if (err) throw err
})