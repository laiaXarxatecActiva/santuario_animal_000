import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { esMp4, procesarImagen } from '../../../src/services/storage/image-processing.js';

const imagen = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#b5653a' } })
    .jpeg()
    .toBuffer();

describe('TECH_SPEC §13 procesado de imágenes (CU-29 paso 4)', () => {
  it('redimensiona a 1600 px de ancho en WebP y crea una miniatura de 400 px', async () => {
    const resultado = await procesarImagen(await imagen(2000, 1000));
    expect(resultado).not.toBeNull();
    const grande = await sharp(resultado!.imagen).metadata();
    const mini = await sharp(resultado!.miniatura).metadata();
    expect(grande).toMatchObject({ format: 'webp', width: 1600, height: 800 });
    expect(mini).toMatchObject({ format: 'webp', width: 400, height: 200 });
  });

  it('no amplía las imágenes pequeñas', async () => {
    const resultado = await procesarImagen(await imagen(300, 200));
    expect(await sharp(resultado!.imagen).metadata()).toMatchObject({ width: 300, height: 200 });
    expect(await sharp(resultado!.miniatura).metadata()).toMatchObject({ width: 300, height: 200 });
  });

  it('2a: devuelve null si el archivo no es una imagen', async () => {
    expect(await procesarImagen(Buffer.from('esto no es una imagen'))).toBeNull();
  });

  it('esMp4 reconoce la cabecera «ftyp» de un MP4', () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(16)]);
    expect(esMp4(mp4)).toBe(true);
    expect(esMp4(Buffer.from('no es un vídeo de verdad'))).toBe(false);
    expect(esMp4(Buffer.alloc(3))).toBe(false);
  });
});
