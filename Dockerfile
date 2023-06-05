FROM node:18
WORKDIR /var/www/5scontrol
COPY package.json .
RUN npm i
COPY . .
ENTRYPOINT ["node", "fastify.js"]