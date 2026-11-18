import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { traducirMensaje } from '../src/i18n/mensajesValidacion';

describe('Fase 3 Mensajes de validación en el idioma de la web', () => {
  it('traduce los mensajes del esquema y los del servidor', () => {
    expect(traducirMensaje('Introduce un email válido.', 'en')).toBe('Enter a valid email.');
    expect(traducirMensaje('Las contraseñas no coinciden.', 'ca')).toBe('Les contrasenyes no coincideixen.');
    expect(traducirMensaje('La fecha no puede ser futura.', 'en')).toBe('The date cannot be in the future.');
  });

  it('traduce los mensajes con números', () => {
    expect(traducirMensaje('La contraseña debe tener al menos 10 caracteres.', 'en')).toBe(
      'The password must be at least 10 characters long.',
    );
    expect(traducirMensaje('No puede tener más de 200 caracteres.', 'ca')).toBe('No pot tindre més de 200 caràcters.');
  });

  it('en castellano, o si no lo conoce, lo deja igual', () => {
    expect(traducirMensaje('Introduce un email válido.', 'es')).toBe('Introduce un email válido.');
    expect(traducirMensaje('Un mensaje nuevo.', 'en')).toBe('Un mensaje nuevo.');
  });

  it('cubre todos los mensajes fijos de los esquemas compartidos', () => {
    const carpeta = join(__dirname, '../../shared/src/schemas');
    const mensajes = new Set<string>();
    for (const archivo of readdirSync(carpeta)) {
      const codigo = readFileSync(join(carpeta, archivo), 'utf8');
      for (const m of codigo.matchAll(/(?:error|message): *'([^']+)'/g)) mensajes.add(m[1]!);
    }
    expect(mensajes.size).toBeGreaterThan(30);
    for (const mensaje of mensajes) {
      expect(traducirMensaje(mensaje, 'en'), mensaje).not.toBe(mensaje);
      expect(traducirMensaje(mensaje, 'ca'), mensaje).not.toBe(mensaje);
    }
  });
});
