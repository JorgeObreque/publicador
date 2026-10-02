import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

function Harness({ initial = false }: { initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button" data-testid="outside">
        Outside
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmar acción"
        description="¿Estás segura de que quieres continuar?"
        primaryLabel="Sí, continuar"
        secondaryLabel="Cancelar"
        onPrimary={() => undefined}
        tone="info"
      >
        <p>Contenido adicional del diálogo.</p>
      </ConfirmDialog>
    </div>
  );
}

describe('ConfirmDialog', () => {
  it('no se renderiza hasta que open=true', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre el diálogo y muestra título, descripción y children', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open/i }));
    const dialog = await screen.findByRole('dialog');
    expect(withinDialog(dialog).getByRole('heading', { name: /confirmar acción/i })).toBeInTheDocument();
    expect(withinDialog(dialog).getByText(/¿estás segura/i)).toBeInTheDocument();
    expect(withinDialog(dialog).getByText(/contenido adicional/i)).toBeInTheDocument();
  });

  it('cierra el diálogo con Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open/i }));
    const dialog = await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(dialog).not.toBeInTheDocument();
  });

  it('cierra el diálogo al pulsar el botón secundario', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(withinDialog(dialog).getByRole('button', { name: /cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('mueve el foco inicial al primer botón al abrir', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open/i }));
    const dialog = await screen.findByRole('dialog');
    const firstButton = withinDialog(dialog).getByRole('button', { name: /cancelar/i });
    await waitFor(() => {
      expect(firstButton).toHaveFocus();
    });
  });

  it('hace foco trap con Tab desde el último botón vuelve al primero', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open/i }));
    const dialog = await screen.findByRole('dialog');
    const cancel = withinDialog(dialog).getByRole('button', { name: /cancelar/i });
    const confirm = withinDialog(dialog).getByRole('button', { name: /sí, continuar/i });
    cancel.focus();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
  });

  it('hace foco trap con Shift+Tab desde el primer botón salta al último', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open/i }));
    const dialog = await screen.findByRole('dialog');
    const cancel = withinDialog(dialog).getByRole('button', { name: /cancelar/i });
    const confirm = withinDialog(dialog).getByRole('button', { name: /sí, continuar/i });
    cancel.focus();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it('restaura el foco al elemento que abrió el diálogo después de cerrar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /open/i });
    trigger.focus();
    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});

function withinDialog(dialog: HTMLElement) {
  return within(dialog);
}
