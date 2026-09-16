import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignInput, UpdateCampaignInput } from './dto/campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Post()
  create(@Body() body: CreateCampaignInput) {
    return this.campaigns.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCampaignInput) {
    return this.campaigns.update(id, body);
  }

  @Patch(':id/pause')
  pause(@Param('id') id: string) {
    return this.campaigns.pause(id);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.campaigns.archive(id);
  }
}
