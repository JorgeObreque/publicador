import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreativesService } from './creatives.service';
import {
  AttachCreativeInput,
  CreateCreativeInput,
} from './dto/creative.dto';

@Controller('creatives')
export class CreativesController {
  constructor(private readonly creatives: CreativesService) {}

  @Get()
  list() {
    return this.creatives.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creatives.findOne(id);
  }

  @Post()
  create(@Body() body: CreateCreativeInput) {
    return this.creatives.create(body);
  }

  @Post('attach')
  attach(@Body() body: AttachCreativeInput) {
    return this.creatives.attachToCampaign(body);
  }

  @Get('by-campaign/:campaignId')
  listForCampaign(@Param('campaignId') campaignId: string) {
    return this.creatives.listForCampaign(campaignId);
  }
}
