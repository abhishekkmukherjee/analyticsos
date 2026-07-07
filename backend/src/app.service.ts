import { Injectable } from '@nestjs/common';


@Injectable()
export class AppService {
  getHello() {
    return{
      status: "ok",
      service: "AnalyticsOp API",
      version: "0.1.0"
    }
  }
}
