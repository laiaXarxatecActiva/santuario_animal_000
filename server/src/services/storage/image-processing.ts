import sharp from 'sharp';

// Procesado de las imágenes subidas (TECH_SPEC §13): WebP de calidad 80, como
// máximo 1600 px de ancho, y una miniatura de 400 px. Nunca se amplían.
const ANCHO_MAXIMO = 1600;
const ANCHO_MINIATURA = 400;
const CALIDAD = 80;

export interface ImagenProcesada {
  imagen: Buffer;
  miniatura: Buffer;
}

/** Devuelve la imagen y su miniatura en WebP, o `null` si el archivo no es una imagen válida. */
export async function procesarImagen(archivo: Buffer): Promise<ImagenProcesada | null> {
  try {
    // `rotate()` aplica la orientación EXIF y los metadatos (con la ubicación) no se copian.
    const base = sharp(archivo, { failOn: 'error' }).rotate();
    const [imagen, miniatura] = await Promise.all([
      base.clone().resize({ width: ANCHO_MAXIMO, withoutEnlargement: true }).webp({ quality: CALIDAD }).toBuffer(),
      base.clone().resize({ width: ANCHO_MINIATURA, withoutEnlargement: true }).webp({ quality: CALIDAD }).toBuffer(),
    ]);
    return { imagen, miniatura };
  } catch {
    return null;
  }
}

/** Los vídeos no se procesan: solo se comprueba la firma `ftyp` de un MP4. */
export function esMp4(archivo: Buffer): boolean {
  return archivo.length >= 12 && archivo.subarray(4, 8).toString('latin1') === 'ftyp';
}
