import { render, screen, within } from '@testing-library/react';
import { MetricCard } from './MetricCard';
import { GLOSSARY } from '@/lib/content/marketing-glossary';

describe('MetricCard', () => {
  it('muestra label y valor sin delta', () => {
    render(<MetricCard label="Costo por mensaje" value="USD 1,20" />);
    const article = screen.getByRole('article');
    expect(within(article).getByText(/costo por mensaje/i)).toBeInTheDocument();
    expect(within(article).getByText('USD 1,20')).toBeInTheDocument();
    expect(screen.queryByText(/mejor que el período anterior/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/peor que el período anterior/i)).not.toBeInTheDocument();
  });

  it('muestra el delta favorable=down con explicación textual', () => {
    render(
      <MetricCard
        label="Costo por mensaje"
        value="USD 1,80"
        delta={{ value: '+15%', label: 'vs período anterior', favorable: 'down' }}
        numericStatus="warn"
      />,
    );
    expect(screen.getByText(/vs período anterior/i)).toBeInTheDocument();
    expect(screen.getByText(/peor que el período anterior/i)).toBeInTheDocument();
  });

  it('muestra el delta favorable=up con explicación textual', () => {
    render(
      <MetricCard
        label="Clics"
        value="320"
        delta={{ value: '+10%', label: 'vs período anterior', favorable: 'up' }}
        numericStatus="ok"
      />,
    );
    expect(screen.getByText(/mejor que el período anterior/i)).toBeInTheDocument();
  });

  it('muestra el delta favorable=flat con explicación neutral', () => {
    render(
      <MetricCard
        label="Clics"
        value="300"
        delta={{ value: '0%', label: 'vs período anterior', favorable: 'flat' }}
        numericStatus="info"
      />,
    );
    expect(screen.getByText(/sin cambio respecto al período anterior/i)).toBeInTheDocument();
  });

  it('no muestra el término técnico entre paréntesis cuando se entrega term', () => {
    render(
      <MetricCard
        label="Costo por mensaje"
        value="USD 1,20"
        term={GLOSSARY.cpl}
        numericStatus="info"
      />,
    );
    const article = screen.getByRole('article');
    expect(within(article).queryByText(/cpl/i)).not.toBeInTheDocument();
    expect(within(article).queryByText(/meta reporta/i)).not.toBeInTheDocument();
    expect(within(article).queryByText(/costo por mensaje/i)).toBeInTheDocument();
  });

  it('no abre ningún diálogo aunque se entregue término y fórmula', () => {
    render(
      <MetricCard
        label="Porcentaje de clics"
        value="2,4%"
        term={GLOSSARY.ctr}
        formula="CTR = clics / impresiones × 100"
        numericStatus="info"
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /más información/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/CTR = clics/i)).not.toBeInTheDocument();
  });
});
