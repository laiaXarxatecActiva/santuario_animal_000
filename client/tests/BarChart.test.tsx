import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart } from '../src/components/charts/BarChart';
import { BarList } from '../src/components/charts/BarList';

const series = [
  { name: 'Cuotas', values: [10, 20], display: ['10,00 €', '20,00 €'] },
  { name: 'Donaciones', values: [5, 0], display: ['5,00 €', '0,00 €'] },
];

describe('BarChart (DESIGN_SYSTEM §8.9)', () => {
  it('dibuja una barra por serie y mes, con leyenda, resumen y la tabla «Ver los datos»', () => {
    const { container } = render(
      <BarChart title="Ingresos por mes" labels={['oct 26', 'nov 26']} series={series} formatAxis={String} />,
    );
    const grafico = screen.getByRole('img', { name: 'Ingresos por mes: 2 meses, de oct 26 a nov 26.' });
    expect(grafico.querySelectorAll('rect')).toHaveLength(4);
    expect(container.querySelector('ul')).toHaveTextContent('CuotasDonaciones');
    const tabla = screen.getByRole('table', { name: 'Ingresos por mes' });
    expect(within(tabla).getAllByRole('row')).toHaveLength(3);
    expect(within(tabla).getByRole('columnheader', { name: 'Donaciones' })).toBeInTheDocument();
    expect(within(tabla).getByText('20,00 €')).toBeInTheDocument();
  });

  it('3a: sin datos (todo a 0) muestra «No hay datos en este rango»', () => {
    render(
      <BarChart
        title="Ingresos por mes"
        labels={['oct 26']}
        series={[{ name: 'Cuotas', values: [0], display: ['0,00 €'] }]}
        formatAxis={String}
      />,
    );
    expect(screen.getByText('No hay datos en este rango')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('BarList (DESIGN_SYSTEM §8.9)', () => {
  it('una fila por elemento con su cifra; la barra es proporcional al mayor', () => {
    render(
      <BarList
        label="Animales más adoptados"
        items={[
          { key: 1, label: 'Rufo', value: 4, display: '4' },
          { key: 2, label: 'Greta', value: 2, display: '2' },
        ]}
      />,
    );
    const lista = screen.getByRole('list', { name: 'Animales más adoptados' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Rufo4');
    const barras = lista.querySelectorAll<HTMLElement>('[data-bar]');
    expect(barras[0]!.style.width).toBe('100%');
    expect(barras[1]!.style.width).toBe('50%');
  });

  it('sin elementos muestra el mensaje vacío', () => {
    render(<BarList label="Por plan" items={[]} />);
    expect(screen.getByText('No hay datos en este rango')).toBeInTheDocument();
  });
});
