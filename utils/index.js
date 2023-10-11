import { accessSync, mkdirSync } from 'fs';

function isExists(dir) {
  try {
    accessSync(dir);
    console.log('Dir exists');
  } catch (err) {
    if (err.code === 'ENOENT') {
      mkdirSync(dir);
      console.log(dir, 'created successfully... ');
    }
  }
}

function cutString(str, from, to) {
  let cuttedString = '';
  if (from === 0) {
    cuttedString = str.substring(0, str.lastIndexOf(to));
  } else {
    cuttedString = str.substring(str.indexOf(from) + 1, str.lastIndexOf(to));
  }
  return cuttedString;
}

function padTo2Digits(num) {
  return num.toString().padStart(2, '0');
}

function formatDate(date) {
  return (
    [date.getFullYear(), padTo2Digits(date.getMonth() + 1), padTo2Digits(date.getDate())].join(
      '-',
    ) +
    '-' +
    [
      padTo2Digits(date.getHours()),
      padTo2Digits(date.getMinutes()),
      padTo2Digits(date.getSeconds()),
    ].join('-')
  );
}

function djangoDate(date) {
  return (
    [date.getFullYear(), padTo2Digits(date.getMonth() + 1), padTo2Digits(date.getDate())].join(
      '-',
    ) +
    ' ' +
    [
      padTo2Digits(date.getHours()),
      padTo2Digits(date.getMinutes()),
      padTo2Digits(date.getSeconds()),
    ].join(':') +
    '.' +
    date.getMilliseconds()
  );
}

function isEmptyObj(obj) {
  return obj && Object.keys(obj).length === 0 && Object.getPrototypeOf(obj) === Object.prototype;
}

function arrayBufferToBuffer(arrayBuffer) {
  const buffer = Buffer.alloc(arrayBuffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) buffer[i] = view[i];
  return buffer;
}

const bBox = {
  convert(prediction) {
    const { x, y, width, height } = prediction;
    return [x, y, width, height];
  },
  getOrigin(bbox) {
    if (Array.isArray(bbox)) {
      const [x, y, width, height] = bbox;
      let originX = x + width / 2;
      let originY = y + height / 2;
      return [originX, originY];
    }
  },
};

function pointsDistanceModule(point_1, point_2) {
  let xModule = Math.floor(Math.abs(point_1[0] - point_2[0]));
  let yModule = Math.floor(Math.abs(point_1[1] - point_2[1]));
  return [xModule, yModule];
}

const randomInt = () => {
  const min = 1;
  const max = 111111111111;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const parseRTSPuri = (rtspUri) => {
  const cleanedUri = rtspUri.replace('rtsp://', '');
  const username = cutString(cleanedUri, 0, ':');
  const password = cutString(cleanedUri, ':', '@');
  const hostname = cutString(cleanedUri, '@', '/');
  return { hostname, username, password };
};

export {
  isExists,
  cutString,
  formatDate,
  arrayBufferToBuffer,
  bBox,
  djangoDate,
  randomInt,
  parseRTSPuri,
};
