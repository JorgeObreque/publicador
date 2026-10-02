import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TermHelp } from './TermHelp';
import type { GlossaryEntry } from '@/lib/content/marketing-glossary';

const baseEntry: GlossaryEntry = {
  everydayLabel: 'Plan inicial de campaña',
  technicalTerm: 'Brief',
  short: 'Documento donde defines qué servicio ofreces y a quién.',
};

describe('TermHelp', () => {
  it('muestra el label cotidiano y el término técnico entre paréntesis', () => {
    render(<TermHelp id="brief" entry={baseEntry} />);
    expect(screen.getByText(/plan inicial de campaña/i)).toBeInTheDocument();
    expect(screen.getByText(/\(brief\)/i)).toBeInTheDocument();
  });

  it('muestra el texto corto visible siempre', () => {
    render(<TermHelp id="brief" entry={baseEntry} />);
    const description = screen.getByText(/documento donde defines/i);
    expect(description).toBeVisible();
    expect(description).toHaveAttribute('id', 'brief-desc');
  });

  it('renderiza el ejemplo dentro de un details/summary cuando existe', async () => {
    const user = userEvent.setup();
    render(
      <TermHelp
        id="brief"
        entry={{
          ...baseEntry,
          example: 'Tu brief puede decir: "Balayage en Santiago, objetivo citas por WhatsApp".',
        }}
      />,
    );
    const summary = screen.getByRole('group', { hidden: true }) || document.querySelector('details');
    expect(summary).toBeTruthy();
    const details = document.querySelector('details') as HTMLDetailsElement;
    expect(details).toBeInTheDocument();
    const trigger = screen.getByText(/ver ejemplo/i);
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);
    expect(details).toHaveAttribute('open');
    expect(
      screen.getByText(/tu brief puede decir/i),
    ).toBeVisible();
  });

  it('muestra el warning visible sin colapsar cuando no hay ejemplo', () => {
    render(
      <TermHelp
        id="ctr"
        entry={{
          everydayLabel: 'Porcentaje de clics',
          short: 'De cada 100 impresiones, cuántas personas hicieron clic.',
          warning: 'Meta agrega los datos y no distingue clics reales de accidentales.',
        }}
      />,
    );
    const details = document.querySelector('details');
    expect(details).toBeNull();
    const warning = screen.getByText(/meta agrega los datos/i);
    expect(warning).toBeVisible();
    expect(warning).toHaveAttribute('role', 'note');
  });

  it('asocia el contenedor descrito por aria-describedby mediante el id-desc', () => {
    const { container } = render(<TermHelp id="kpi" entry={baseEntry} />);
    const descriptionEl = container.querySelector('#kpi-desc');
    expect(descriptionEl).not.toBeNull();
    expect(descriptionEl?.textContent).toMatch(/documento donde defines/i);
  });

  it('no muestra paréntesis de término técnico cuando no existe', () => {
    render(
      <TermHelp
        id="x"
        entry={{
          everydayLabel: 'Concepto simple',
          short: 'Una definición breve sin término técnico.',
        }}
      />,
    );
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
  });
});
