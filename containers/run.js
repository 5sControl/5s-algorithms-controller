const {images} = require("./images");
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

const runMinMaxModel = async () => {

};

module.exports = {startContainer, removeContainer, removeContainerByImage, removeContainers}