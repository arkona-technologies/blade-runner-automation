
FROM node:20-buster as build

WORKDIR /app
COPY package*.json ./
RUN ls -l /app/ || true
RUN rm -rf build || true
RUN rm -rf node_modules || true
COPY . .
RUN npm install --legacy-peer-deps
RUN npx tsc

FROM node:20-alpine as run
LABEL org.opencontainers.image.source=https://github.com/arkona-technologies/blade-runner-automation
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/build ./

RUN npm install --production 
RUN npm prune --production

ADD container/entry.sh /app/

RUN chmod +x ./entry.sh
ENTRYPOINT ["sh","/app/entry.sh"]
