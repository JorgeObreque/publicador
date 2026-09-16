import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BigIntSerializerInterceptor } from './bigint-serializer.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntSerializerInterceptor,
    },
  ],
})
export class SerializersModule {}
