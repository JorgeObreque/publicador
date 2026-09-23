import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ZodError } from 'zod';
import { CampaignsService } from './campaigns.service';
import {
  createCampaignSchema,
  createCampaignWithCreativeSchema,
  updateCampaignSchema,
} from './dto/campaign.dto';

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
  create(@Body() body: unknown) {
    return this.campaigns.create(this.parse(createCampaignSchema, body));
  }

  @Post('with-creative')
  createWithCreative(@Body() body: unknown) {
    return this.campaigns.createWithCreative(
      this.parse(createCampaignWithCreativeSchema, body),
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.campaigns.update(id, this.parse(updateCampaignSchema, body));
  }

  @Patch(':id/pause')
  pause(@Param('id') id: string) {
    return this.campaigns.pause(id);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.campaigns.archive(id);
  }

  private parse<T>(schema: { parse: (input: unknown) => T }, body: unknown): T {
    try {
      return schema.parse(body ?? {});
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Datos inválidos',
          issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
        });
      }
      throw err;
    }
  }
}
