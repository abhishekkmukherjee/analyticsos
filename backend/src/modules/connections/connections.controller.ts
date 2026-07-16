import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.connections.list(user.tenantId);
  }

  @Post()
  create(@Body() dto: CreateConnectionDto, @CurrentUser() user: AuthContext) {
    return this.connections.create(user.tenantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.connections.remove(user.tenantId, id);
  }

  @Get(':id/status')
  status(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.connections.status(user.tenantId, id);
  }

  @Post(':id/sync')
  sync(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.connections.sync(user.tenantId, id);
  }
}
