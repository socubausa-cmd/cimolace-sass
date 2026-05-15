FROM node:20-alpine
WORKDIR /app
RUN echo '{"dependencies":{"@nestjs/common":"^11","@nestjs/core":"^11","@nestjs/platform-express":"^11","reflect-metadata":"^0.2","rxjs":"^7"}}' > package.json
RUN npm install --legacy-peer-deps
RUN mkdir -p src
RUN echo "
const { Module, Controller, Get } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
@Controller()
class H { @Get('health') get() { return { status: 'ok', uptime: process.uptime() }; } }
@Module({ controllers: [H] }) class A {}
async function b() { const a = await NestFactory.create(A); await a.listen(process.env.PORT || 4000, '0.0.0.0'); console.log('ready'); } b();
" > src/main.ts
RUN npx nest build
ENV PORT=4000
EXPOSE 4000
CMD ["node","dist/main.js"]
