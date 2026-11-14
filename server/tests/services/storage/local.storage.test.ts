import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalStorage } from '../../../src/services/storage/local.storage.js';
import type { StorageService } from '../../../src/services/storage/storage.service.js';

let dir: string;
let storage: StorageService;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'santuario-storage-'));
  storage = createLocalStorage(dir);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const existe = (ruta: string) =>
  stat(ruta).then(
    () => true,
    () => false,
  );

describe('TECH_SPEC §11.3 LocalStorage', () => {
  it('save guarda el archivo (creando las carpetas) y devuelve su URL en /uploads', async () => {
    const url = await storage.save(Buffer.from('hola'), 'animals/7/foto.webp', 'image/webp');
    expect(url).toBe('/uploads/animals/7/foto.webp');
    expect(await readFile(join(dir, 'animals/7/foto.webp'), 'utf8')).toBe('hola');
  });

  it('delete borra el archivo y no falla si ya no existe', async () => {
    await storage.save(Buffer.from('x'), 'animals/7/borrar.webp', 'image/webp');
    await storage.delete('animals/7/borrar.webp');
    expect(await existe(join(dir, 'animals/7/borrar.webp'))).toBe(false);
    await expect(storage.delete('animals/7/borrar.webp')).resolves.toBeUndefined();
  });

  it('no permite rutas que salgan de la carpeta de subidas', async () => {
    await expect(storage.save(Buffer.from('x'), '../fuera.txt', 'text/plain')).rejects.toThrow();
    await expect(storage.save(Buffer.from('x'), '/etc/fuera.txt', 'text/plain')).rejects.toThrow();
    await expect(storage.delete('animals/../../fuera.txt')).rejects.toThrow();
  });

  it('pathFromUrl devuelve la ruta de una URL suya, o null si no lo es', () => {
    expect(storage.pathFromUrl('/uploads/animals/1/a.webp')).toBe('animals/1/a.webp');
    expect(storage.pathFromUrl('https://otro.example/a.webp')).toBeNull();
    expect(storage.pathFromUrl('/uploads/../secreto')).toBeNull();
  });
});
