FROM node:20-alpine
WORKDIR /app
COPY apps/api/package.json ./
RUN npm install --legacy-peer-deps --ignore-scripts
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/src/health.controller.ts ./src/health.controller.ts
COPY apps/api/src/app.module.min.ts ./src/app.module.ts
COPY apps/api/src/main.ts ./src/main.ts
RUN npx nest build
EXPOSE 8080
CMD ["node", "dist/main.js"]
