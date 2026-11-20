import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  Logger,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ConversationService } from '../conversation/conversation.service';
import { WhatsappWebhookBody } from '../conversation/inbound/whatsapp-payload';
import { Public } from '../auth/decorators/public.decorator';
import { MetaSignatureGuard } from './meta-signature.guard';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly conversation: ConversationService) {}

  @Public()
  @Get('webhook')
  webhook(@Query() query: Record<string, string | undefined>) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (
      mode === 'subscribe' &&
      token &&
      token === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      return challenge;
    }
    throw new HttpException('Forbidden', 403);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @UseGuards(MetaSignatureGuard)
  handleIncomingMessage(@Body() body: WhatsappWebhookBody) {
    // Sin await: Meta recibe 200 de inmediato y reintenta si tardamos.
    this.conversation
      .handleWebhook(body)
      .catch((err: Error) =>
        this.logger.error(`[WEBHOOK] ${err.message}`, err.stack),
      );
    return { status: 'success' };
  }

  @Public()
  @Get('current-version')
  version() {
    return {
      message: 'version 1.0.1',
    };
  }
}
