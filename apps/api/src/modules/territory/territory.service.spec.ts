import { TerritoryService } from './territory.service';
import { COMMUNES, REGIONS } from './data/chile-territory';

/**
 * Tests unitarios del catálogo territorial. Verifican tanto las
 * invariantes del dataset versionado (16 regiones, 346 comunas, RM=13)
 * como las funciones de búsqueda que usará el cliente web.
 *
 * No se usa Prisma ni el módulo NestJS completo: el `TerritoryService`
 * es 100% puro (los datos viven en `data/chile-territory.ts`).
 */
describe('TerritoryService', () => {
  let service: TerritoryService;

  beforeEach(() => {
    service = new TerritoryService();
  });

  describe('catálogo versionado', () => {
    it('carga exactamente 16 regiones oficiales', () => {
      expect(REGIONS).toHaveLength(16);
      expect(service.listRegions()).toHaveLength(16);
    });

    it('carga exactamente 346 comunas oficiales', () => {
      expect(COMMUNES).toHaveLength(346);
    });

    it('las regiones están ordenadas por cutCode ascendente', () => {
      const codes = service.listRegions().map((r) => r.cutCode);
      const sorted = [...codes].sort();
      expect(codes).toEqual(sorted);
      // Spot-check: la primera región es Tarapacá (01) y la última es Ñuble (16).
      expect(codes[0]).toBe('01');
      expect(codes[codes.length - 1]).toBe('16');
    });

    it('la Región Metropolitana de Santiago tiene CUT 13', () => {
      const rm = service.listRegions().find((r) => r.name.includes('Metropolitana'));
      expect(rm).toBeDefined();
      expect(rm?.cutCode).toBe('13');
    });

    it('Las Condes pertenece a la Región Metropolitana (cut 13)', () => {
      const lasCondes = COMMUNES.find((c) => c.name === 'Las Condes');
      expect(lasCondes).toBeDefined();
      expect(lasCondes?.regionCutCode).toBe('13');
      const region = service.getRegionByCommune('13114');
      expect(region?.cutCode).toBe('13');
      expect(region?.name).toContain('Metropolitana');
    });

    it('todas las comunas referencian una región existente', () => {
      const regionCuts = new Set(service.listRegions().map((r) => r.cutCode));
      for (const commune of COMMUNES) {
        expect(regionCuts.has(commune.regionCutCode)).toBe(true);
      }
    });

    it('los códigos de comuna son únicos', () => {
      const cuts = COMMUNES.map((c) => c.cutCode);
      expect(new Set(cuts).size).toBe(cuts.length);
    });

    it('los códigos de región son únicos', () => {
      const cuts = REGIONS.map((r) => r.cutCode);
      expect(new Set(cuts).size).toBe(cuts.length);
    });
  });

  describe('listCommunesByRegion', () => {
    it('devuelve las 52 comunas de la Región Metropolitana (cut 13)', () => {
      const communes = service.listCommunesByRegion('13');
      expect(communes).toHaveLength(52);
    });

    it('incluye Las Condes y Providencia en la Región Metropolitana', () => {
      const names = service.listCommunesByRegion('13').map((c) => c.name);
      expect(names).toEqual(expect.arrayContaining(['Las Condes', 'Providencia']));
    });

    it('devuelve [] para una región inexistente (no lanza)', () => {
      expect(service.listCommunesByRegion('99')).toEqual([]);
    });
  });

  describe('searchCommunes', () => {
    it('"las condes" encuentra Las Condes aunque la query sea lowercase', () => {
      const matches = service.searchCommunes('las condes');
      expect(matches.map((c) => c.name)).toContain('Las Condes');
    });

    it('la búsqueda es insensible a mayúsculas y acentos', () => {
      const matches = service.searchCommunes('MAIPU');
      expect(matches.map((c) => c.name)).toEqual(expect.arrayContaining(['Maipú']));
    });

    it('filtrar por región limita el resultado', () => {
      const all = service.searchCommunes('san');
      const inRm = service.searchCommunes('san', '13');
      expect(inRm.length).toBeLessThanOrEqual(all.length);
      for (const c of inRm) {
        expect(c.regionCutCode).toBe('13');
      }
    });

    it('devuelve [] cuando la query está vacía', () => {
      expect(service.searchCommunes('')).toEqual([]);
      expect(service.searchCommunes('   ')).toEqual([]);
    });

    it('devuelve [] cuando no hay coincidencias', () => {
      expect(service.searchCommunes('zzzzzz')).toEqual([]);
    });
  });

  describe('getRegionByCommune & findCommuneByCut', () => {
    it('resuelve la región de una comuna existente', () => {
      const region = service.getRegionByCommune('01101');
      expect(region?.cutCode).toBe('01');
    });

    it('devuelve null para una comuna inexistente', () => {
      expect(service.getRegionByCommune('99999')).toBeNull();
      expect(service.findCommuneByCut('99999')).toBeNull();
    });

    it('devuelve la comuna existente cuando se busca por CUT', () => {
      const commune = service.findCommuneByCut('13114');
      expect(commune?.name).toBe('Las Condes');
    });
  });

  describe('searchRegions', () => {
    it('"metropolitana" encuentra la Región Metropolitana', () => {
      const matches = service.searchRegions('metropolitana');
      expect(matches.map((r) => r.cutCode)).toContain('13');
    });

    it('"ñuble" encuentra la XVI Región ignorando acentos', () => {
      const matches = service.searchRegions('nuble');
      expect(matches.map((r) => r.cutCode)).toContain('16');
    });

    it('con query vacía devuelve las 16 regiones completas', () => {
      expect(service.searchRegions('')).toHaveLength(16);
    });
  });
});