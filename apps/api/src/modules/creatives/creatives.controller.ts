import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ZodError } from 'zod';
import { CreativesService } from './creatives.service';
import {
  attachCreativeSchema,
  createCreativeSchema,
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
  create(@Body() body: unknown) {
    return this.creatives.create(this.parse(createCreativeSchema, body));
  }

  @Post('attach')
  attach(@Body() body: unknown) {
    return this.creatives.attachToCampaign(this.parse(attachCreativeSchema, body));
  }

  @Get('by-campaign/:campaignId')
  listForCampaign(@Param('campaignId') campaignId: string) {
    return this.creatives.listForCampaign(campaignId);
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
