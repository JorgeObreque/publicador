import { Module, Global } from '@nestjs/common';
import { BusinessContextResolver } from './business-context.resolver';

@Global()
@Module({
  providers: [BusinessContextResolver],
  exports: [BusinessContextResolver],
})
export class BusinessContextModule {}
