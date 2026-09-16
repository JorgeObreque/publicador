import { BadRequestException } from '@nestjs/common';

const VALIDATION_PATTERN = /^ADS:(CMP-[A-Z0-9_-]+)-([A-Z0-9_-]+)$/i;
const EXTRACTION_PATTERN = /ADS:(CMP-[A-Z0-9_-]+)-([A-Z0-9_-]+)/i;

export interface AttributionCodeParts {
  campaignCode: string;
  variantCode: string;
}

export function parseAttributionCode(raw: string | null | undefined): AttributionCodeParts | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(VALIDATION_PATTERN);
  if (!match) {
    throw new BadRequestException(`Código de atribución inválido: ${raw}`);
  }
  return { campaignCode: match[1].toUpperCase(), variantCode: match[2].toUpperCase() };
}

export function extractAttributionCode(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(EXTRACTION_PATTERN);
  return match ? `ADS:${match[1].toUpperCase()}-${match[2].toUpperCase()}` : null;
}

export function buildAttributionCode(campaignCode: string, variantCode: string): string {
  return `ADS:${campaignCode.toUpperCase()}-${variantCode.toUpperCase()}`;
}
