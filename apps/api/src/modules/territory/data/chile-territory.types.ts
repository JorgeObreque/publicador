/**
 * Tipos públicos del catálogo territorial de Chile.
 *
 * El catálogo versiona en código (no en migración Prisma) la unidad
 * territorial oficial de Chile: 16 regiones y 346 comunas, según los
 * códigos únicos territoriales (CUT) publicados por SUBDERE/INE desde
 * la creación de la XVI Región de Ñuble (Ley 21.033, vigente desde el
 * 6 de septiembre de 2018). No hay subdivisiones nuevas hasta 2026.
 */

export interface Region {
  /** Código Único Territorial de la región (string para preservar ceros a la izquierda). */
  cutCode: string;
  /** Nombre oficial según SUBDERE 2018. */
  name: string;
  /** Abreviatura ISO 3166-2:CL opcional (sólo informativa, no se usa como ID). */
  iso3166: string;
  /** Capital regional (sólo informativa, no se usa como ID). */
  capital: string;
}

export interface Commune {
  /** Código Único Territorial de la comuna (string para preservar ceros a la izquierda). */
  cutCode: string;
  /** Nombre oficial según SUBDERE 2018. */
  name: string;
  /** CUT de la región a la que pertenece la comuna. */
  regionCutCode: string;
}