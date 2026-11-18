// Exportaciones CSV para abrir en una hoja de cálculo en castellano (TECH_SPEC
// §16, Fase 2): separador «;», UTF-8 con BOM (para que se lean bien las tildes)
// y decimales con coma.

const BOM = '﻿';
const SEPARADOR = ';';
const FIN_DE_LINEA = '\r\n';

/**
 * Un texto que empieza por = + - @ (o tabulador o retorno) se tomaría por una
 * fórmula al abrir el archivo; se le antepone un apóstrofo para que sea texto.
 */
function neutralizarFormula(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function campo(valor: string | null): string {
  if (valor === null || valor === '') return '';
  const texto = neutralizarFormula(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function generarCsv(cabeceras: readonly string[], filas: readonly (readonly (string | null)[])[]): string {
  const lineas = [cabeceras, ...filas].map((fila) => fila.map(campo).join(SEPARADOR));
  return BOM + lineas.map((linea) => linea + FIN_DE_LINEA).join('');
}

/** `"12.50"` → `"12,50"`. El importe ya viene calculado como texto; solo cambia el separador. */
export function importeCsv(importe: string): string {
  return importe.replace('.', ',');
}
