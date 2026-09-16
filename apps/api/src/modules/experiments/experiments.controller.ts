import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import {
  completeExperimentSchema,
  createExperimentSchema,
} from './dto/experiment.dto';

@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experiments: ExperimentsService) {}

  @Get()
  list() {
    return this.experiments.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.experiments.findOne(id);
  }

  @Post()
  create(@Body() body: ReturnType<typeof createExperimentSchema.parse>) {
    return this.experiments.create(createExperimentSchema.parse(body));
  }

  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() body: ReturnType<typeof completeExperimentSchema.parse>,
  ) {
    const parsed = completeExperimentSchema.parse(body ?? {});
    return this.experiments.complete(id, parsed.outcome);
  }
}
