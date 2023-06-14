const validationEndpointRun = (body) => {
    let {algorithm, camera_url, server_url} = body
    if (!algorithm || !camera_url || !server_url) {
        return 'Fields algorithm, camera_url and server_url not found'
    }
}

const validationEndpointRunMinMaxAlgorithm = (body) => {
    let isCoordsFound = true;
    if (body?.algorithm === "min_max_control" && !Array.isArray(body?.extra)) {
        return 'extra is not array';
    }

    if (body?.algorithm === "min_max_control" && !body?.extra[0]?.areas[0].itemId) {
        return 'ItemId not found'
    }

    if (body?.algorithm === "min_max_control" && !Array.isArray(body?.extra[0]?.areas[0].coords)) {
        return 'coords is not array'
    }

    if (body?.algorithm === "min_max_control") {
        body.extra.areas.forEach((item) => {
            if (!Array.isArray(item.coords) || item.coords.length === 0) {
                isCoordsFound = false;
            }
        })

        if (!isCoordsFound) {
            return 'coords is not array'
        }
    }


}

module.exports = {validationEndpointRun, validationEndpointRunMinMaxAlgorithm}