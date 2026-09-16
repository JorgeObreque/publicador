import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface BusinessContext {
  businessId: string;
  source: 'env';
}

@Injectable()
export class BusinessContextResolver {
  resolve(): BusinessContext {
    const raw = process.env.BUSINESS_ID;
    if (!raw || raw.trim().length === 0) {
      throw new InternalServerErrorException(
        'BUSINESS_ID no configurado. Define la variable de entorno con un identificador no vacío.',
      );
    }
    return { businessId: raw.trim(), source: 'env' };
  }
}
