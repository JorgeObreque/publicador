/**
 * Capa de contexto socioeconómico ORIENTATIVO para las 52 comunas de la
 * Región Metropolitana de Santiago (cut prefix '13').
 *
 * IMPORTANTE: Estos valores NO son datos personales ni estadísticas
 * oficiales del INE/CASEN. Son estimaciones gruesas a nivel comunal,
 * versionadas en código, que se usan para:
 *  - Mostrar al operador un bloque de "perfil territorial" en el
 *    formulario del BusinessProfile.
 *  - Inyectar contexto cualitativo en prompts de marketing/IA.
 *  - Sugerir "comunas vecinas de interés" ordenadas por ingreso
 *    promedio estimado del hogar.
 *
 * Reglas de uso:
 *  - Si una comuna NO aparece aquí, el código NO debe inventar valores
 *    (la regla del módulo es devolver `null`, no aproximar).
 *  - `source` siempre es "estimación Publicador" para que la UI pueda
 *    mostrar el disclaimer correspondiente.
 *  - `avgHouseholdIncomeCLP` está en pesos chilenos (CLP) y representa
 *    una estimación del ingreso líquido mensual del hogar mediano, no
 *    del individuo.
 *  - `adultShare25_55` es la fracción (0-1) estimada de adultos en el
 *    tramo 25-55 años; se usa para priorizar el público objetivo en la
 *    copia publicitaria.
 */

export interface SantiagoMetroCommuneContext {
  /** CUT oficial de la comuna (5 dígitos, prefijo '13'). */
  cutCode: string;
  /** Población estimada (habitantes). */
  population: number;
  /** Fracción (0-1) estimada de adultos entre 25 y 55 años. */
  adultShare25_55: number;
  /** Ingreso mensual estimado del hogar mediano, en CLP. */
  avgHouseholdIncomeCLP: number;
  /** Descripción cualitativa corta (1-2 frases) pensada para prompts y UI. */
  profileDescription: string;
  /** Fuente/origen de los datos (siempre "estimación Publicador" en esta capa). */
  source: string;
  /** Año de referencia de la estimación. */
  year: number;
}

export const SANTIAGO_METRO_CONTEXT: readonly SantiagoMetroCommuneContext[] = [
  {
    cutCode: '13101',
    population: 410_000,
    adultShare25_55: 0.58,
    avgHouseholdIncomeCLP: 980_000,
    profileDescription:
      'Comuna central con alta densidad de trabajadores y estudiantes. Demanda servicios rápidos y de precio medio.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13102',
    population: 80_000,
    adultShare25_55: 0.5,
    avgHouseholdIncomeCLP: 720_000,
    profileDescription:
      'Comuna residencial de clase media, con familias jóvenes que valoran la cercanía y la atención personalizada.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13103',
    population: 150_000,
    adultShare25_55: 0.49,
    avgHouseholdIncomeCLP: 560_000,
    profileDescription:
      'Comuna popular del sector poniente. Público sensible al precio, busca ofertas concretas y buena relación calidad-precio.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13104',
    population: 130_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 620_000,
    profileDescription:
      'Barrio tradicional del norte de la capital, clase media trabajadora. Valora la confianza y la atención familiar.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13105',
    population: 175_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 600_000,
    profileDescription:
      'Comuna residencial del sur poniente, marcada por el comercio local. Público busca conveniencia y servicio rápido.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13106',
    population: 210_000,
    adultShare25_55: 0.56,
    avgHouseholdIncomeCLP: 740_000,
    profileDescription:
      'Hub de transporte y logística, con población flotante de trabajadores y residentes. Demanda horarios amplios y servicios express.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13107',
    population: 110_000,
    adultShare25_55: 0.55,
    avgHouseholdIncomeCLP: 1_100_000,
    profileDescription:
      'Comuna de ingresos medios-altos en el norponiente, con nuevas familias profesionales. Valora calidad y servicio premium.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13108',
    population: 145_000,
    adultShare25_55: 0.57,
    avgHouseholdIncomeCLP: 690_000,
    profileDescription:
      'Comuna hospitalaria del sector norte, con fuerte presencia de trabajadores y estudiantes. Población diversa y sensible a precio.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13109',
    population: 95_000,
    adultShare25_55: 0.5,
    avgHouseholdIncomeCLP: 720_000,
    profileDescription:
      'Comuna residencial tranquila del sur, con clase media consolidada. Público fiel que valora la atención cercana.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13110',
    population: 380_000,
    adultShare25_55: 0.54,
    avgHouseholdIncomeCLP: 800_000,
    profileDescription:
      'Una de las comunas más grandes del país, mezcla de familias jóvenes y adultos mayores. Demanda servicios integrales y atención personalizada.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13111',
    population: 145_000,
    adultShare25_55: 0.5,
    avgHouseholdIncomeCLP: 580_000,
    profileDescription:
      'Comuna popular del sector sur, con fuerte identidad barrial. Público sensible al precio, busca confianza y cercanía.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13112',
    population: 195_000,
    adultShare25_55: 0.49,
    avgHouseholdIncomeCLP: 540_000,
    profileDescription:
      'Comuna del sur con alta vulnerabilidad social. Público busca soluciones accesibles y financiamiento flexible.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13113',
    population: 100_000,
    adultShare25_55: 0.53,
    avgHouseholdIncomeCLP: 1_300_000,
    profileDescription:
      'Comuna de ingresos altos del oriente, con público consolidado y exigente. Demanda servicio premium y atención muy profesional.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13114',
    population: 330_000,
    adultShare25_55: 0.55,
    avgHouseholdIncomeCLP: 1_950_000,
    profileDescription:
      'Comuna de ingresos altos del sector oriente, polo de trabajadores y familias de clase alta. Valora atención profesional y servicio diferenciado.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13115',
    population: 130_000,
    adultShare25_55: 0.54,
    avgHouseholdIncomeCLP: 2_100_000,
    profileDescription:
      'Comuna cordillerana del nororiente, con los ingresos más altos del país. Público de clase alta que demanda exclusividad y servicio premium.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13116',
    population: 115_000,
    adultShare25_55: 0.49,
    avgHouseholdIncomeCLP: 510_000,
    profileDescription:
      'Comuna popular del surponiente, con alta vulnerabilidad. Público busca precio accesible y financiamiento.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13117',
    population: 105_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 600_000,
    profileDescription:
      'Comuna residencial del poniente santiaguino, clase media trabajadora. Valora la cercanía y el servicio rápido.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13118',
    population: 130_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 700_000,
    profileDescription:
      'Comuna residencial del sector suroriente, con familias jóvenes de clase media. Demanda servicio amable y de calidad consistente.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13119',
    population: 540_000,
    adultShare25_55: 0.55,
    avgHouseholdIncomeCLP: 820_000,
    profileDescription:
      'Una de las comunas más grandes del país, gran centro comercial y residencial. Público amplio y diverso, sensible a precio y conveniencia.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13120',
    population: 210_000,
    adultShare25_55: 0.57,
    avgHouseholdIncomeCLP: 1_280_000,
    profileDescription:
      'Comuna del sector oriente con público profesional y culturalmente activo. Demanda servicio de calidad y propuestas con identidad.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13121',
    population: 110_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 580_000,
    profileDescription:
      'Comuna popular del centro-sur, marcada por su identidad industrial. Público fiel, sensible a precio y que valora la honestidad.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13122',
    population: 240_000,
    adultShare25_55: 0.53,
    avgHouseholdIncomeCLP: 880_000,
    profileDescription:
      'Comuna del sector oriente con marcadas diferencias socioeconómicas. Demanda segmentada: parte premium y parte массовая.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13123',
    population: 150_000,
    adultShare25_55: 0.56,
    avgHouseholdIncomeCLP: 1_620_000,
    profileDescription:
      'Comuna icónica del barrio oriente, de ingresos altos y público cosmopolita. Valora servicio profesional, estética cuidada y propuestas exclusivas.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13124',
    population: 245_000,
    adultShare25_55: 0.54,
    avgHouseholdIncomeCLP: 760_000,
    profileDescription:
      'Comuna del poniente con marcado carácter popular y creciente desarrollo. Público diverso, sensible a precio y conveniencia.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13125',
    population: 230_000,
    adultShare25_55: 0.56,
    avgHouseholdIncomeCLP: 940_000,
    profileDescription:
      'Comuna en pleno crecimiento del norte de la capital, con familias jóvenes y trabajadores. Demanda servicio moderno y de calidad consistente.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13126',
    population: 115_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 700_000,
    profileDescription:
      'Comuna residencial tradicional del sector poniente, con trabajadores y familias de clase media. Valora la atención amable y los precios razonables.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13127',
    population: 155_000,
    adultShare25_55: 0.55,
    avgHouseholdIncomeCLP: 780_000,
    profileDescription:
      'Comuna del sector norte con fuerte componente de trabajadores del centro. Público diverso que busca servicio rápido y bien localizado.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13128',
    population: 145_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 600_000,
    profileDescription:
      'Comuna popular del norponiente con marcada identidad industrial. Público sensible al precio, valora la confianza y la cercanía.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13129',
    population: 95_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 670_000,
    profileDescription:
      'Comuna residencial del centro-sur, con trabajadores y familias tradicionales. Demanda servicio de barrio y atención personal.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13130',
    population: 130_000,
    adultShare25_55: 0.55,
    avgHouseholdIncomeCLP: 920_000,
    profileDescription:
      'Comuna del sector sur con trabajadores profesionales y residentes de clase media. Valora atención profesional y propuestas bien diseñadas.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13131',
    population: 90_000,
    adultShare25_55: 0.5,
    avgHouseholdIncomeCLP: 560_000,
    profileDescription:
      'Comuna popular del sur con alta densidad residencial. Público sensible al precio, busca confianza y atención familiar.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13132',
    population: 95_000,
    adultShare25_55: 0.55,
    avgHouseholdIncomeCLP: 2_400_000,
    profileDescription:
      'Comuna del barrio oriente con el ingreso promedio más alto del país. Público de clase alta que exige servicio exclusivo y atención impecable.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13201',
    population: 580_000,
    adultShare25_55: 0.53,
    avgHouseholdIncomeCLP: 780_000,
    profileDescription:
      'La comuna más poblada del país, gran centro urbano del sur. Público masivo de clase media, sensible a precio y a promociones.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13202',
    population: 35_000,
    adultShare25_55: 0.5,
    avgHouseholdIncomeCLP: 1_050_000,
    profileDescription:
      'Comuna rural del Cajón del Maipo, con público residencial de ingresos medios-altos que valora naturaleza y exclusividad.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13203',
    population: 19_000,
    adultShare25_55: 0.5,
    avgHouseholdIncomeCLP: 880_000,
    profileDescription:
      'Comuna cordillerana con perfil turístico y de montaña. Público visitante y residencial con capacidad adquisitiva media-alta.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13301',
    population: 175_000,
    adultShare25_55: 0.55,
    avgHouseholdIncomeCLP: 1_000_000,
    profileDescription:
      'Comuna del norponiente con fuerte componente industrial y familias de clase media-alta. Demanda servicio moderno y profesional.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13302',
    population: 130_000,
    adultShare25_55: 0.54,
    avgHouseholdIncomeCLP: 860_000,
    profileDescription:
      'Comuna en crecimiento del norponiente, con nuevas familias y trabajadores. Valora propuestas modernas y buena relación calidad-precio.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13303',
    population: 22_000,
    adultShare25_55: 0.5,
    avgHouseholdIncomeCLP: 780_000,
    profileDescription:
      'Comuna rural del norte de la RM con público residencial de ingresos medios. Demanda servicio personalizado y horarios flexibles.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13401',
    population: 320_000,
    adultShare25_55: 0.54,
    avgHouseholdIncomeCLP: 720_000,
    profileDescription:
      'Comuna del sur de la RM con fuerte componente industrial y residencial. Público masivo de clase media, sensible a precio.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13402',
    population: 100_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 780_000,
    profileDescription:
      'Comuna residencial del surponiente con familias jóvenes y trabajadores. Demanda servicio amable y propuestas accesibles.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13403',
    population: 28_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 850_000,
    profileDescription:
      'Comuna pequeña del surponiente, perfil residencial y agrícola. Público busca atención cercana y horarios extendidos.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13404',
    population: 80_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 720_000,
    profileDescription:
      'Comuna del surponiente con creciente desarrollo urbano. Público de clase media, sensible a precio y calidad.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13501',
    population: 130_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 660_000,
    profileDescription:
      'Comuna del poniente con perfil semi-rural y urbano. Público residencial de clase media, valora la confianza y el servicio familiar.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13502',
    population: 6_500,
    adultShare25_55: 0.49,
    avgHouseholdIncomeCLP: 540_000,
    profileDescription:
      'Comuna rural pequeña del poniente. Público muy acotado, demanda atención personal y horarios flexibles.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13503',
    population: 35_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 760_000,
    profileDescription:
      'Comuna rural con creciente desarrollo residencial. Público de clase media con interés en servicio profesional.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13504',
    population: 50_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 700_000,
    profileDescription:
      'Comuna semi-rural del poniente, familias de clase media que se desplazan a la capital. Demanda horarios extendidos y atención cercana.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13505',
    population: 11_000,
    adultShare25_55: 0.49,
    avgHouseholdIncomeCLP: 620_000,
    profileDescription:
      'Comuna rural pequeña del poniente. Demanda atención muy personalizada y servicio familiar.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13601',
    population: 80_000,
    adultShare25_55: 0.53,
    avgHouseholdIncomeCLP: 760_000,
    profileDescription:
      'Comuna del poniente sur con familias de clase media-alta y trabajadores que viajan al centro. Valora servicio moderno y bien presentado.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13602',
    population: 40_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 640_000,
    profileDescription:
      'Comuna del poniente sur con perfil residencial y agrícola. Público busca atención familiar y precios razonables.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13603',
    population: 40_000,
    adultShare25_55: 0.51,
    avgHouseholdIncomeCLP: 700_000,
    profileDescription:
      'Comuna semi-rural del surponiente con familias de clase media. Demanda servicio accesible y de calidad.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13604',
    population: 80_000,
    adultShare25_55: 0.52,
    avgHouseholdIncomeCLP: 720_000,
    profileDescription:
      'Comuna residencial del surponiente con creciente desarrollo urbano. Público masivo de clase media, sensible a precio.',
    source: 'estimación Publicador',
    year: 2024,
  },
  {
    cutCode: '13605',
    population: 100_000,
    adultShare25_55: 0.53,
    avgHouseholdIncomeCLP: 760_000,
    profileDescription:
      'Comuna del surponiente con trabajadores y familias establecidas. Demanda servicio profesional y propuestas bien segmentadas.',
    source: 'estimación Publicador',
    year: 2024,
  },
];