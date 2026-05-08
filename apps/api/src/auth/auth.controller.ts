import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    return { data: { id: req.user.id, email: req.user.email } };
  }
}
