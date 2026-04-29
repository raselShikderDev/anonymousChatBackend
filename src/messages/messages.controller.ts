import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionData } from '../redis/redis.service';

@Controller('rooms/:id/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async findMessages(
    @Param('id') roomId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.findMessages(roomId, parsedLimit, before);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMessage(
    @Param('id') roomId: string,
    @Body() createMessageDto: CreateMessageDto,
    @CurrentUser() user: SessionData,
  ) {
    return this.messagesService.createMessage(
      roomId,
      user.username,
      createMessageDto.content,
    );
  }
}