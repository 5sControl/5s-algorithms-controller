const Docker = require('node-docker-api').Docker;
const docker = new Docker({socketPath: '/var/run/docker.sock'})

const t = async () => {
const containers = await docker.container.list({all: true});
containers.forEach(c => {
if (c.data?.Names[0]?.includes('model')) {
container
}

})
}
t()
