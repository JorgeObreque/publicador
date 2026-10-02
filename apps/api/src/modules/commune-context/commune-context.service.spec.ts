import { TerritoryService } from '../territory/territory.service';
import { CommuneContextService } from './commune-context.service';
import { SANTIAGO_METRO_CONTEXT } from './data/santiago-metro.context';

/**
 * Tests unitarios de la capa de contexto socioeconómico orientativo de
 * las 52 comunas de la Región Metropolitana de Santiago.
 *
 * El servicio es 100% puro (datos versionados en
 * `data/santiago-metro.context.ts`, sin Prisma). Se valida:
 *  - que el dataset tenga exactamente 52 comunas;
 *  - que las entradas sean plausibles (Las Condes / Vitacura / Lo
 *    Barnechea con ingresos altos, Lo Espejo / La Pintana / Cerro Navia
 *    con ingresos bajos);
 *  - que `getContext` valide contra `TerritoryService.findCommuneByCut`
 *    y devuelva `null` para CUTs inválidos;
 *  - que `compareNeighborCommunes` devuelva siempre 10 entradas
 *    ordenadas por ingreso desc y excluya la comuna consultada.
 */
describe('CommuneContextService', () => {
  let service: CommuneContextService;

  beforeEach(() => {
    service = new CommuneContextService(new TerritoryService());
  });

  describe('catálogo versionado', () => {
    it('carga exactamente 52 comunas de la RM', () => {
      expect(SANTIAGO_METRO_CONTEXT).toHaveLength(52);
      expect(service.count()).toBe(52);
    });

    it('los CUTs son únicos', () => {
      const cuts = SANTIAGO_METRO_CONTEXT.map((c) => c.cutCode);
      expect(new Set(cuts).size).toBe(cuts.length);
    });

    it('todos los CUTs existen en el catálogo territorial', () => {
      const territory = new TerritoryService();
      for (const entry of SANTIAGO_METRO_CONTEXT) {
        const commune = territory.findCommuneByCut(entry.cutCode);
        expect(commune).not.toBeNull();
        expect(commune?.regionCutCode).toBe('13');
      }
    });

    it('Las Condes (13114) tiene ingreso alto (>1.5M CLP)', () => {
      const entry = service.getContext('13114');
      expect(entry).not.toBeNull();
      expect(entry?.avgHouseholdIncomeCLP).toBeGreaterThan(1_500_000);
    });

    it('Vitacura (13132), Lo Barnechea (13115) y Providencia (13123) están en el tercio superior de ingresos', () => {
      const sortedByIncome = [...SANTIAGO_METRO_CONTEXT].sort(
        (a, b) => b.avgHouseholdIncomeCLP - a.avgHouseholdIncomeCLP,
      );
      const topThird = sortedByIncome.slice(0, Math.ceil(sortedByIncome.length / 3));
      const topCuts = new Set(topThird.map((c) => c.cutCode));
      expect(topCuts.has('13132')).toBe(true);
      expect(topCuts.has('13115')).toBe(true);
      expect(topCuts.has('13123')).toBe(true);
    });

    it('Lo Espejo (13116), Cerro Navia (13103) y La Pintana (13112) están en el tercio inferior de ingresos', () => {
      const sortedByIncome = [...SANTIAGO_METRO_CONTEXT].sort(
        (a, b) => a.avgHouseholdIncomeCLP - b.avgHouseholdIncomeCLP,
      );
      const bottomThird = sortedByIncome.slice(0, Math.ceil(sortedByIncome.length / 3));
      const bottomCuts = new Set(bottomThird.map((c) => c.cutCode));
      expect(bottomCuts.has('13116')).toBe(true);
      expect(bottomCuts.has('13103')).toBe(true);
      expect(bottomCuts.has('13112')).toBe(true);
    });

    it('la descripción de perfil es un texto no vacío y razonable', () => {
      for (const entry of SANTIAGO_METRO_CONTEXT) {
        expect(typeof entry.profileDescription).toBe('string');
        expect(entry.profileDescription.trim().length).toBeGreaterThan(20);
      }
    });

    it('source es "estimación Publicador" y year=2024 en todas las entradas', () => {
      for (const entry of SANTIAGO_METRO_CONTEXT) {
        expect(entry.source).toBe('estimación Publicador');
        expect(entry.year).toBe(2024);
      }
    });

    it('population > 0 y adultShare25_55 ∈ (0, 1]', () => {
      for (const entry of SANTIAGO_METRO_CONTEXT) {
        expect(entry.population).toBeGreaterThan(0);
        expect(entry.adultShare25_55).toBeGreaterThan(0);
        expect(entry.adultShare25_55).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getContext', () => {
    it('devuelve una entry válida para "13114" (Las Condes)', () => {
      const entry = service.getContext('13114');
      expect(entry).not.toBeNull();
      expect(entry?.cutCode).toBe('13114');
      expect(entry?.avgHouseholdIncomeCLP).toBeGreaterThan(1_500_000);
    });

    it('devuelve null para un CUT inválido (no existe en el catálogo)', () => {
      expect(service.getContext('99999')).toBeNull();
    });

    it('devuelve null para una comuna fuera de la RM', () => {
      // Valparaíso, pertenece a la región 05.
      expect(service.getContext('05101')).toBeNull();
    });

    it('devuelve null para un CUT vacío o whitespace', () => {
      expect(service.getContext('')).toBeNull();
      expect(service.getContext('   ')).toBeNull();
    });
  });

  describe('listForRegion', () => {
    it('devuelve 52 entradas para la Región Metropolitana (cut 13)', () => {
      const entries = service.listForRegion('13');
      expect(entries).toHaveLength(52);
    });

    it('devuelve [] para una región sin contexto cargado', () => {
      // La región 05 (Valparaíso) existe pero no tiene contexto cargado.
      expect(service.listForRegion('05')).toEqual([]);
    });

    it('devuelve [] para un CUT vacío o inválido', () => {
      expect(service.listForRegion('')).toEqual([]);
      expect(service.listForRegion('99')).toEqual([]);
    });
  });

  describe('compareNeighborCommunes', () => {
    it('devuelve 10 entradas ordenadas por ingreso descendente', () => {
      const neighbors = service.compareNeighborCommunes('13114');
      expect(neighbors).toHaveLength(10);
      for (let i = 1; i < neighbors.length; i++) {
        expect(neighbors[i - 1]!.avgHouseholdIncomeCLP).toBeGreaterThanOrEqual(
          neighbors[i]!.avgHouseholdIncomeCLP,
        );
      }
    });

    it('excluye la comuna consultada', () => {
      const neighbors = service.compareNeighborCommunes('13114');
      expect(neighbors.find((n) => n.cutCode === '13114')).toBeUndefined();
    });

    it('devuelve [] para una comuna fuera de la RM', () => {
      expect(service.compareNeighborCommunes('05101')).toEqual([]);
    });

    it('devuelve [] para un CUT inválido', () => {
      expect(service.compareNeighborCommunes('99999')).toEqual([]);
    });
  });

  describe('listAll', () => {
    it('devuelve 52 entradas ordenadas por cutCode ascendente', () => {
      const all = service.listAll();
      expect(all).toHaveLength(52);
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1]!.cutCode.localeCompare(all[i]!.cutCode)).toBeLessThanOrEqual(0);
      }
    });
  });
});