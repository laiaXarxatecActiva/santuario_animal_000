import { htmlConEnlace, type EmailContent } from './layout.js';
import { lineasRecibo, type ReceiptData } from './receipt.js';
import { FIRMA, idiomaDe, saludo, VER_MIS_ANIMALES } from './textos.js';

// CU-13 paso 8 y CU-14: adopción activada, con el recibo de la primera cuota.
export function adoptionWelcomeEmail(datos: ReceiptData): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const t = {
    es: {
      subject: `¡Ya adoptas a ${a}!`,
      cuerpo: `¡Gracias por adoptar a ${a}! Seguirá viviendo en el santuario y te contaremos cómo está al menos cada dos semanas.`,
      // CU-22 (Fase 3): el certificado se descarga desde «Mis animales» (el enlace del email).
      certificado: `Desde «Mis animales» puedes descargar el certificado de adopción de ${a}.`,
    },
    ca: {
      subject: `Ja adoptes ${a}!`,
      cuerpo: `Gràcies per adoptar ${a}! Continuarà vivint al santuari i et contarem com està almenys cada dues setmanes.`,
      certificado: `Des de «Els meus animals» pots baixar el certificat d'adopció de ${a}.`,
    },
    en: {
      subject: `You now adopt ${a}!`,
      cuerpo: `Thank you for adopting ${a}! They will keep living at the sanctuary and we will tell you how they are doing at least every two weeks.`,
      certificado: `From "My animals" you can download ${a}'s adoption certificate.`,
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  const recibo = lineasRecibo(datos);
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', t.certificado, '', ...recibo, '', datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace(
      [hola, t.cuerpo, t.certificado, ...recibo],
      { url: datos.url, texto: VER_MIS_ANIMALES[idioma] },
      [],
      undefined,
      idioma,
    ),
  };
}
