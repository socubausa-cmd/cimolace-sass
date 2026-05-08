import { Controller, Post, Body } from "@nestjs/common";
import { CheckoutService } from "./checkout.service";

@Controller("checkout")
export class CheckoutController {
  constructor(private svc: CheckoutService) {}
  @Post("sessions") async create(@Body() b: any) { return { data: await this.svc.createSession(b) }; }
  @Post("webhook/stripe") async webhook(@Body() b: any) { return { data: await this.svc.handleWebhook(b) }; }
}
