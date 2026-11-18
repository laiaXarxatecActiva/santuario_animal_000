// Cálculos de los ejes de los gráficos (solo para dibujar; los totales los da el servidor).

/**
 * Marcas «redondas» del eje vertical que cubren de `minimo` a `maximo`, con
 * unos 4 tramos. Si los dos valores coinciden, se abre un margen alrededor.
 */
export function marcasEje(maximo: number, minimo = 0, tramos = 4): number[] {
  let alto = maximo;
  let bajo = minimo;
  if (alto === bajo) {
    if (alto === 0) alto = 1;
    else {
      bajo = alto - Math.abs(alto) * 0.1;
      alto = alto + Math.abs(alto) * 0.1;
    }
  }
  const paso = pasoRedondo((alto - bajo) / tramos);
  const inicio = Math.floor(bajo / paso) * paso;
  const fin = Math.ceil(alto / paso) * paso;
  const marcas: number[] = [];
  for (let v = inicio; v <= fin + paso / 2; v += paso) marcas.push(Number(v.toFixed(6)));
  return marcas;
}

function pasoRedondo(bruto: number): number {
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const normal = bruto / potencia;
  const base = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10;
  return base * potencia;
}
