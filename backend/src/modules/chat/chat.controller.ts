import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { ChatService } from './chat.service';
import { ChatDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async ask(@Body() body: ChatDto, @CurrentUser() user: AuthContext) {
    return this.chatService.ask(user, body.message);
  }
}
