import { Injectable } from '@nestjs/common';
import { version } from 'os';

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
