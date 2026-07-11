import { Module } from '@nestjs/common';
import { ConnectorsModule } from '../connectors/connectors.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [ConnectorsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
