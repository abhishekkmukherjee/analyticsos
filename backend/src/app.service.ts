import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor (private readonly configService: ConfigService){}
  getHello() {
    return{
      status: "ok",
      service: this.configService.get("APP_NAME"),
      version: this.configService.get("APP_VERSION")
     
    }
  }
}
