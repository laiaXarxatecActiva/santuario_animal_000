// Almacenamiento de archivos (TECH_SPEC §11.3). En las fases 1 a 3 es local
// (`LocalStorage`); en la fase 4 se podrá añadir otra implementación sin
// cambiar los servicios que la usan.
export interface StorageService {
  /** Guarda el archivo en `path` (relativa, p. ej. `animals/1/x.webp`) y devuelve su URL pública. */
  save(file: Buffer, path: string, contentType: string): Promise<string>;
  /** Borra el archivo; no falla si ya no existe. */
  delete(path: string): Promise<void>;
  /** Ruta de un archivo a partir de su URL pública, o `null` si la URL no es de este almacenamiento. */
  pathFromUrl(url: string): string | null;
}
