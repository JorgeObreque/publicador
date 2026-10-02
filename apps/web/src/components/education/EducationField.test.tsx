import { render, screen } from '@testing-library/react';
import { EducationField } from './EducationField';
import { GLOSSARY } from '@/lib/content/marketing-glossary';

describe('EducationField', () => {
  it('renderiza un label asociado al input por htmlFor y propaga aria-describedby', () => {
    render(
      <EducationField id="primaryText" label="Texto principal" required>
        <input type="text" />
      </EducationField>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'primaryText');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('primaryText-desc');
    expect(screen.getByText(/texto principal/i)).toBeInTheDocument();
  });

  it('marca aria-invalid cuando hay error y muestra el mensaje con role=alert', () => {
    render(
      <EducationField id="headline" label="Título" error="Debe tener al menos 5 caracteres">
        <input type="text" />
      </EducationField>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('headline-err');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/debe tener al menos 5/i);
  });

  it('no marca aria-invalid cuando no hay error', () => {
    render(
      <EducationField id="headline" label="Título">
        <input type="text" />
      </EducationField>,
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('respeta un id existente en el child y añade aria-describedby sin pisarlo', () => {
    render(
      <EducationField id="primaryText" label="Texto principal" help="Máximo 2000 caracteres">
        <textarea id="my-textarea" />
      </EducationField>,
    );
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('id', 'my-textarea');
    const describedBy = textarea.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('primaryText-desc');
    expect(describedBy).toContain('primaryText-help');
  });

  it('renderiza el término del glosario cuando se pasa el id', () => {
    render(
      <EducationField
        id="brief"
        label="Plan inicial de campaña"
        term={GLOSSARY.brief}
      >
        <textarea />
      </EducationField>,
    );
    expect(screen.getAllByText(/plan inicial de campaña/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\(brief\)/i)).toBeInTheDocument();
    expect(screen.getByText(/documento donde defines/i)).toBeVisible();
  });

  it('muestra un asterisco visible en el label cuando required=true', () => {
    const { container } = render(
      <EducationField id="x" label="Etiqueta" required>
        <input type="text" />
      </EducationField>,
    );
    expect(container.textContent).toMatch(/etiqueta\s*\*\s*/i);
  });
});
