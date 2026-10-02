import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessProfileForm } from './BusinessProfileForm';
import type { BusinessProfile } from '@/lib/business-profile/api';
import type { CommuneContext } from '@/lib/commune-context/api';

jest.mock('./actions', () => ({
  upsertBusinessProfileAction: jest.fn(),
  markBusinessProfileCompleteAction: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/territory/api', () => {
  const regions = [
    {
      cutCode: '13',
      name: 'Región Metropolitana de Santiago',
      iso3166: 'CL-RM',
      capital: 'Santiago',
    },
    { cutCode: '05', name: 'Región de Valparaíso', iso3166: 'CL-VS', capital: 'Valparaíso' },
  ];
  const communesByRegion: Record<string, Array<{ cutCode: string; name: string; regionCutCode: string }>> = {
    '13': [
      { cutCode: '13101', name: 'Santiago', regionCutCode: '13' },
      { cutCode: '13114', name: 'Las Condes', regionCutCode: '13' },
      { cutCode: '13120', name: 'Ñuñoa', regionCutCode: '13' },
      { cutCode: '13132', name: 'Vitacura', regionCutCode: '13' },
      { cutCode: '13115', name: 'Lo Barnechea', regionCutCode: '13' },
    ],
    '05': [
      { cutCode: '05101', name: 'Valparaíso', regionCutCode: '05' },
      { cutCode: '05109', name: 'Viña del Mar', regionCutCode: '05' },
    ],
  };
  return {
    listRegions: jest.fn(async () => regions),
    listCommunesByRegion: jest.fn(async (cut: string) => ({
      region: regions.find((r) => r.cutCode === cut),
      communes: communesByRegion[cut] ?? [],
    })),
    searchCommunes: jest.fn(),
    getCommune: jest.fn(),
  };
});

const { upsertBusinessProfileAction, markBusinessProfileCompleteAction } = jest.requireMock(
  './actions',
) as {
  upsertBusinessProfileAction: jest.Mock;
  markBusinessProfileCompleteAction: jest.Mock;
};

const fullProfile: BusinessProfile = {
  id: 'prof-1',
  businessId: 'biz-1',
  addressLine: 'Av. Apoquindo 4501',
  neighborhood: 'Las Condes',
  regionCutCode: '13',
  communeCutCode: '13114',
  regionName: 'Región Metropolitana de Santiago',
  communeName: 'Las Condes',
  countryCode: 'CL',
  phone: '+56222222222',
  whatsappNumber: '+56912345678',
  publicEmail: 'a@b.cl',
  googleMapsUrl: 'https://maps.google.com/?q=foo',
  brandVoiceKeywords: ['profesional', 'cercana'],
  wordsToAvoid: ['barato'],
  preferredEmojiSemantics: ['✨'],
  primaryCustomerProfile: 'Mujer 30-45 que busca balayage natural',
  commonObjections: ['Es muy caro'],
  qualifyingQuestions: ['¿Tienes el cabello tinturado?'],
  weeklyServiceCapacity: 20,
  monthlyRevenueTarget: '3000000.00',
  monthlyAcquisitionGoal: 10,
  costPerAcquisitionCap: '50000.00',
  tagline: 'Tu pelo, nuestras manos',
  differentiators: ['20 años de experiencia'],
  nearbyCommunesCutCodes: [],
  profileCompletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const sampleCommuneContext: CommuneContext = {
  cutCode: '13114',
  population: 330000,
  adultShare25_55: 0.55,
  avgHouseholdIncomeCLP: 1950000,
  profileDescription:
    'Comuna de ingresos altos del sector oriente, polo de上班族 y familias de clase alta.',
  source: 'estimación Publicador',
  year: 2024,
};

beforeEach(() => {
  upsertBusinessProfileAction.mockReset();
  markBusinessProfileCompleteAction.mockReset();
});

describe('BusinessProfileForm', () => {
  it('renderiza con initialProfile=null mostrando los campos vacíos y la sección incompleta', async () => {
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toHaveValue('');
    });
    expect(screen.getByLabelText(/barrio/i)).toHaveValue('');
    expect(screen.getByLabelText(/región/i)).toHaveValue('');
    expect(screen.getByLabelText(/^comuna/i)).toHaveValue('');
    expect(screen.getByLabelText(/persona a la que quieres atraer/i)).toHaveValue('');
    expect(screen.getByText(/perfil incompleto: faltan 7 campos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /marcar como completo/i })).toBeInTheDocument();
  });

  it('renderiza con un perfil completo mostrando los valores precargados y el indicador de listo', async () => {
    render(<BusinessProfileForm initialProfile={fullProfile} communeContext={sampleCommuneContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toHaveValue('Av. Apoquindo 4501');
      expect(screen.getByLabelText(/^comuna/i)).toHaveValue('13114');
    });
    expect(screen.getByLabelText(/^barrio/i)).toHaveValue('Las Condes');
    expect(screen.getByLabelText(/^región/i)).toHaveValue('13');
    expect(screen.getByLabelText(/persona a la que quieres atraer/i)).toHaveValue(
      'Mujer 30-45 que busca balayage natural',
    );

    // Chips for brand voice (≥1) y qualifying questions (≥1) must be rendered.
    expect(screen.getByText('profesional')).toBeInTheDocument();
    expect(screen.getByText('cercana')).toBeInTheDocument();
    expect(screen.getByText('¿Tienes el cabello tinturado?')).toBeInTheDocument();

    // Completeness indicates all 7 fields are filled
    expect(screen.getByText(/perfil listo/i)).toBeInTheDocument();
    expect(screen.getByText(/7 campos completos/i)).toBeInTheDocument();
  });

  it('permite editar un campo y llama a upsertBusinessProfileAction al guardar', async () => {
    const updated: BusinessProfile = {
      ...fullProfile,
      communeCutCode: '13120',
      communeName: 'Ñuñoa',
    };
    upsertBusinessProfileAction.mockResolvedValueOnce({ profile: updated, ready: true });

    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={fullProfile} communeContext={sampleCommuneContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^comuna/i)).toHaveValue('13114');
    });

    const communeSelect = screen.getByLabelText(/^comuna/i);
    await user.selectOptions(communeSelect, '13120');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(upsertBusinessProfileAction).toHaveBeenCalledTimes(1);
    });

    const payload = upsertBusinessProfileAction.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.communeCutCode).toBe('13120');
    expect(payload.regionCutCode).toBe('13');
    expect(payload.addressLine).toBe('Av. Apoquindo 4501');
    expect(payload.primaryCustomerProfile).toBe('Mujer 30-45 que busca balayage natural');
    expect(payload.brandVoiceKeywords).toEqual(['profesional', 'cercana']);
    expect(payload.qualifyingQuestions).toEqual(['¿Tienes el cabello tinturado?']);
    expect(payload.monthlyRevenueTarget).toBe(3000000);
    // countryCode no se envía desde el frontend; el backend rellena CL.
    expect(payload['countryCode']).toBeUndefined();
    // nearbyCommunesCutCodes ya no se envía desde el frontend por ahora.
    expect(payload['nearbyCommunesCutCodes']).toBeUndefined();
  });

  it('renderiza los chips y permite agregar y eliminar', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/agregar preguntas que enviarás después/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(
      /agregar preguntas que enviarás después del primer mensaje/i,
    );
    const section = input.closest('section');
    expect(section).not.toBeNull();
    const addButton = within(section!).getByRole('button', { name: /^agregar$/i });

    await user.type(input, '¿Tienes el cabello tinturado?');
    await user.click(addButton);

    expect(
      await within(section!).findByTestId(
        'bp-chip-qualifyingQuestions-¿Tienes el cabello tinturado?',
      ),
    ).toBeInTheDocument();

    const removeButton = within(section!).getByRole('button', {
      name: /quitar ¿Tienes el cabello tinturado\? de Preguntas que enviarás después/i,
    });
    await user.click(removeButton);

    await waitFor(() => {
      expect(
        within(section!).queryByTestId(
          'bp-chip-qualifyingQuestions-¿Tienes el cabello tinturado?',
        ),
      ).not.toBeInTheDocument();
    });
  });

  it('muestra el error cuando la server action de upsert lanza una excepción', async () => {
    upsertBusinessProfileAction.mockRejectedValueOnce(new Error('API error 500: oops'));

    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={fullProfile} communeContext={sampleCommuneContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toHaveValue('Av. Apoquindo 4501');
    });

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('API error 500: oops')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });

  it('bloquea el guardado cuando primaryCustomerProfile está vacío', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={fullProfile} communeContext={sampleCommuneContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/persona a la que quieres atraer/i)).toHaveValue(
        'Mujer 30-45 que busca balayage natural',
      );
    });

    const primaryTextarea = screen.getByLabelText(/persona a la que quieres atraer/i);
    await user.clear(primaryTextarea);

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/perfil del cliente ideal es obligatorio/i),
    ).toBeInTheDocument();
    expect(upsertBusinessProfileAction).not.toHaveBeenCalled();
  });

  it('llama a markBusinessProfileCompleteAction al hacer click en "Marcar como completo"', async () => {
    const completed: BusinessProfile = {
      ...fullProfile,
      profileCompletedAt: '2026-02-01T00:00:00.000Z',
    };
    markBusinessProfileCompleteAction.mockResolvedValueOnce({ profile: completed, ready: true });

    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={fullProfile} communeContext={sampleCommuneContext} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toHaveValue('Av. Apoquindo 4501');
    });

    await user.click(screen.getByRole('button', { name: /marcar como completo/i }));

    await waitFor(() => {
      expect(markBusinessProfileCompleteAction).toHaveBeenCalledTimes(1);
      expect(markBusinessProfileCompleteAction).toHaveBeenCalledWith();
    });
    expect(upsertBusinessProfileAction).not.toHaveBeenCalled();
  });

  it('muestra el bloque de contexto territorial y el perfil general cuando hay context', async () => {
    render(
      <BusinessProfileForm
        initialProfile={fullProfile}
        communeContext={sampleCommuneContext}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('bp-commune-context-block')).toBeInTheDocument();
    });
    expect(screen.getByText(/Contexto territorial orientativo/i)).toBeInTheDocument();
    expect(screen.getByText(/estimación Publicador/i)).toBeInTheDocument();
    expect(screen.getByText(/Población estimada/i)).toBeInTheDocument();
    expect(screen.getByText(sampleCommuneContext.profileDescription)).toBeInTheDocument();
  });

  it('no muestra el bloque de contexto territorial cuando no hay context ni perfil', () => {
    render(
      <BusinessProfileForm
        initialProfile={null}
        communeContext={null}
      />,
    );
    expect(screen.queryByTestId('bp-commune-context-block')).not.toBeInTheDocument();
  });

  it('no expone la sección "Comunas cercanas de interés" en la UI', async () => {
    render(
      <BusinessProfileForm
        initialProfile={fullProfile}
        communeContext={sampleCommuneContext}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^comuna/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/Comunas cercanas de interés/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^bp-nearby-/)).not.toBeInTheDocument();
  });

  it('siempre renderiza la sección de emblemas visuales con "Sin elementos" cuando está vacía', async () => {
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/agregar emblemas visuales/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/agregar emblemas visuales/i);
    const section = input.closest('section');
    expect(section).not.toBeNull();
    expect(within(section!).getByText(/\(sin elementos\)/i)).toBeInTheDocument();
    expect(
      within(section!).getByRole('button', { name: /emojis comunes/i }),
    ).toBeInTheDocument();
  });

  it('deshabilita "Agregar" en emblemas visuales hasta que se ingresa un emoji válido', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/agregar emblemas visuales/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/agregar emblemas visuales/i);
    const section = input.closest('section')!;
    const addButton = within(section).getByRole('button', { name: /^agregar$/i });

    expect(addButton).toBeDisabled();

    await user.type(input, 'hola');
    expect(addButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, '✨');
    expect(addButton).not.toBeDisabled();
  });

  it('agrega un emoji al input controlado y lo guarda como chip', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/agregar emblemas visuales/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/agregar emblemas visuales/i);
    const section = input.closest('section')!;
    const addButton = within(section).getByRole('button', { name: /^agregar$/i });

    await user.type(input, '✨');
    await user.click(addButton);

    expect(
      await within(section).findByTestId('bp-chip-preferredEmojiSemantics-✨'),
    ).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('abre el popover, agrega un emoji común al listado y cierra el diálogo', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/agregar emblemas visuales/i),
      ).toBeInTheDocument();
    });

    const section = screen
      .getByLabelText(/agregar emblemas visuales/i)
      .closest('section')!;
    const trigger = within(section).getByRole('button', {
      name: /emojis comunes/i,
    });

    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByText(/servicio\/estética/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/cercanía/i)).toBeInTheDocument();

    const hairButton = within(dialog).getByTestId('emoji-popover-💇‍♀️');
    await user.click(hairButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      within(section).getByTestId('bp-chip-preferredEmojiSemantics-💇‍♀️'),
    ).toBeInTheDocument();
  });

  it('cierra el popover de emojis al pulsar Escape', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/agregar emblemas visuales/i),
      ).toBeInTheDocument();
    });

    const trigger = screen
      .getByLabelText(/agregar emblemas visuales/i)
      .closest('section')!
      .querySelector<HTMLButtonElement>(
        'button[aria-haspopup="dialog"]',
      )!;
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('muestra el texto corto visible bajo los labels de los campos con ayuda', async () => {
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/cosas concretas que te hacen distinta\.\s*la ia las usará para diferenciarte\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/es solo una aspiración para tu negocio; no es la meta de una campaña individual\./i),
    ).toBeInTheDocument();
  });

  it('asocia el input al texto corto mediante aria-describedby con id estable', async () => {
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/agregar razones por las que una clienta te elegir[ií]a/i),
      ).toBeInTheDocument();
    });

    const differentiatorsInput = screen.getByRole('textbox', {
      name: /agregar razones por las que una clienta te elegir[ií]a/i,
    });
    expect(differentiatorsInput).toHaveAttribute('aria-describedby', 'bp-help-differentiators');

    const monthlyRevenueInput = screen.getByLabelText(/cu[aá]nto te gustar[ií]a facturar al mes/i);
    expect(monthlyRevenueInput).toHaveAttribute(
      'aria-describedby',
      'bp-help-monthlyRevenueTarget',
    );
  });

  it('renderiza el botón "?" con aria-label descriptivo para cada campo con ayuda', async () => {
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /más información sobre diferenciadores/i }),
    ).toBeInTheDocument();
  });

  it('abre el popover con la descripción completa al hacer focus en el botón "?"', async () => {
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    });

    const helpButton = screen.getByRole('button', {
      name: /más información sobre diferenciadores/i,
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await act(async () => {
      helpButton.focus();
    });

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/\(Diferenciadores\)/);
    expect(tooltip).toHaveTextContent(
      /son las razones concretas por las que una clienta te elegiría/i,
    );
    expect(tooltip).toHaveTextContent(/peluquería/i);
  });

  it('abre el popover al hacer click en el botón "?" (compatible móvil)', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    });

    const helpButton = screen.getByRole('button', {
      name: /más información sobre diferenciadores/i,
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.click(helpButton);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/\(Diferenciadores\)/);
    expect(tooltip).toHaveTextContent(/peluquería/i);
  });

  it('cierra el popover al pulsar Escape y devuelve el foco al botón "?"', async () => {
    const user = userEvent.setup();
    render(<BusinessProfileForm initialProfile={null} communeContext={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/dirección/i)).toBeInTheDocument();
    });

    const helpButton = screen.getByRole('button', {
      name: /más información sobre diferenciadores/i,
    });

    await user.click(helpButton);
    await screen.findByRole('tooltip');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
    expect(helpButton).toHaveFocus();
  });

  it('renderiza el campo "Máximo aceptable por adquisición (tope de CPA)" con su hint', async () => {
    render(
      <BusinessProfileForm
        initialProfile={fullProfile}
        communeContext={sampleCommuneContext}
      />,
    );

    const cpaInput = await screen.findByLabelText(
      /m[áa]ximo aceptable por adquisici[óo]n \(tope de cpa\)/i,
    );
    expect(cpaInput).toBeInTheDocument();
    expect(cpaInput).toHaveAttribute('id', 'bp-cpaCap');
    // El formateador CLP aplica el sufijo de moneda (es-CL).
    expect((cpaInput as HTMLInputElement).value).toMatch(/50\.000/);
    expect(
      screen.getByText(
        /Monto tope que est[áa]s dispuesto a invertir por cada reserva o venta antes de detener o revisar la campaña\./i,
      ),
    ).toBeInTheDocument();
  });

  it('incluye costPerAcquisitionCap numérico en el payload al guardar', async () => {
    upsertBusinessProfileAction.mockResolvedValueOnce({
      profile: fullProfile,
      ready: true,
    });

    const user = userEvent.setup();
    render(
      <BusinessProfileForm
        initialProfile={fullProfile}
        communeContext={sampleCommuneContext}
      />,
    );

    const cpaInput = await screen.findByLabelText(
      /m[áa]ximo aceptable por adquisici[óo]n \(tope de cpa\)/i,
    );
    await user.clear(cpaInput);
    await user.type(cpaInput, '25000');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(upsertBusinessProfileAction).toHaveBeenCalledTimes(1);
    });
    const payload = upsertBusinessProfileAction.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(payload.costPerAcquisitionCap).toBe(25000);
  });

  it('explica el rol del tope CPA en el copy de Capacidad y aspiración', async () => {
    render(
      <BusinessProfileForm
        initialProfile={fullProfile}
        communeContext={sampleCommuneContext}
      />,
    );

    await screen.findByLabelText(/dirección/i);
    expect(
      screen.getByText(
        /Define un tope m[áa]ximo de inversi[óo]n por cada reserva o venta efectiva\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /No necesitas definir CPA ni contactos calificados por adelantado\./i,
      ),
    ).not.toBeInTheDocument();
  });
});