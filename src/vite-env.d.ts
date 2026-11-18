/// <reference types="vite/client" />

declare module 'virtual:ocr-assets' {
  /** Carpeta del motor de OCR relativa a la base de la app, por ejemplo "ocr/1a2b3c4d5e/". */
  export const OCR_DIR: string;
  /** Megabytes aproximados que se descargan la primera vez que se usa el OCR. */
  export const OCR_MB: number;
}
