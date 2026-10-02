import { render, screen } from '@testing-library/react';
import { FieldShell } from './FieldShell';

describe('FieldShell', () => {
  it('asocia el label al control mediante htmlFor/id', () => {
    render(
      <FieldShell id="name" label="Nombre">
        <input type="text" />
      </FieldShell>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'name');
    expect(screen.getByText(/nombre/i)).toBeInTheDocument();
  });

  it('muestra asterisco cuando required y aria-required en el control', () => {
    render(
      <FieldShell id="name" label="Nombre" required>
        <input type="text" />
      </FieldShell>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('muestra el error con role=alert y propaga aria-invalid + aria-describedby', () => {
    render(
      <FieldShell id="name" label="Nombre" error="Requerido">
        <input type="text" />
      </FieldShell>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('name-err');
    expect(screen.getByRole('alert')).toHaveTextContent(/requerido/i);
  });

  it('muestra la ayuda como texto opcional y la incluye en aria-describedby', () => {
    render(
      <FieldShell id="email" label="Correo" hint="Usa tu correo principal">
        <input type="email" />
      </FieldShell>,
    );
    const input = screen.getByRole('textbox');
    expect(screen.getByText(/usa tu correo principal/i)).toBeInTheDocument();
    expect(input.getAttribute('aria-describedby')).toContain('email-help');
  });

  it('genera un id estable a partir del label si no se pasa id', () => {
    render(
      <FieldShell label="Ciudad de residencia">
        <input type="text" />
      </FieldShell>,
    );
    const input = screen.getByRole('textbox');
    expect(input.id).toMatch(/^field-/);
    expect(screen.getByText('Ciudad de residencia').closest('label')).toHaveAttribute(
      'for',
      input.id,
    );
  });

  it('incluye el término técnico entre paréntesis cuando se pasa term', () => {
    render(
      <FieldShell id="cpl" label="Costo por mensaje" term="CPL">
        <input type="text" />
      </FieldShell>,
    );
    expect(screen.getByText(/costo por mensaje/i)).toBeInTheDocument();
    expect(screen.getByText(/cpl/i)).toBeInTheDocument();
  });
});
