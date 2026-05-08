import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { ConsultationNoteService } from "./consultation-note.service";

@Controller("med")
@UseGuards(JwtAuthGuard, TenantGuard)
export class ConsultationNoteController {
  constructor(private service: ConsultationNoteService) {}

  @Get("patients/:recordId/notes")
  async findByRecord(@Req() req: any, @Param("recordId") recordId: string) {
    return { data: await this.service.findByRecord(req.tenant.id, recordId) };
  }

  @Post("patients/:recordId/notes")
  async create(@Req() req: any, @Param("recordId") recordId: string, @Body() body: any) {
    return { data: await this.service.create(req.tenant.id, { ...body, record_id: recordId, practitioner_id: req.user.id }) };
  }

  @Patch("notes/:id")
  async update(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return { data: await this.service.update(req.tenant.id, id, body) };
  }

  @Post("notes/:id/sign")
  async sign(@Req() req: any, @Param("id") id: string) {
    return { data: await this.service.sign(req.tenant.id, id) };
  }

  @Patch("notes/:id/share")
  async share(@Req() req: any, @Param("id") id: string, @Body() body: { is_shared: boolean }) {
    return { data: await this.service.share(req.tenant.id, id, body.is_shared) };
  }
}
