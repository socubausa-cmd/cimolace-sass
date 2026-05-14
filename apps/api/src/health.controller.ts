import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get()
  root() {
    return { status: "ok", name: "MedOS API", version: "0.1.0", timestamp: new Date().toISOString() };
  }

  @Get("health")
  health() {
    return { status: "ok", uptime: process.uptime() };
  }
}
