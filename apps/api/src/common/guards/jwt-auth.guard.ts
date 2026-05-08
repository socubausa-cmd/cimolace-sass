import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../../auth/auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedException("Missing token");
    const token = authHeader.slice(7);
    const user = await this.authService.verifyToken(token);
    if (!user) throw new UnauthorizedException("Invalid token");
    request.user = user;
    return true;
  }
}
