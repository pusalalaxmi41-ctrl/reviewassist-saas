import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import {
  buildPrintableA5PdfFromJpeg,
  generateBusinessQRMatrix,
  QR_ACCENT_PRESETS,
  renderQrTemplateToRgbaBuffer,
  type QRTemplateId,
} from '../src/services/qr/qrGenerator.ts';

const TEST_BUSINESSES = [
  { slug: 'the-urban-kitchen', origin: 'https://reviewassist.app' },
  { slug: 'akshaya-pg', origin: 'http://localhost:5173' },
  { slug: 'brew-and-bean-cafe', origin: 'https://reviewassist.app' },
];

const TEMPLATES: QRTemplateId[] = [
  'minimal_google',
  'business_branded',
  'table_standee',
];

function runAutomatedQrVerification(): void {
  let totalChecks = 0;

  // 1. Test all 3 templates x all test businesses + PNG binary round-trip + jsQR decode
  for (const biz of TEST_BUSINESSES) {
    const expectedUrl = `${biz.origin}/r/${biz.slug}`;
    const matrix = generateBusinessQRMatrix(biz.slug, biz.origin);

    if (matrix.url !== expectedUrl) {
      throw new Error(
        `Matrix URL mismatch for ${biz.slug}: expected "${expectedUrl}", got "${matrix.url}"`,
      );
    }
    if (matrix.quietZoneModules < 4) {
      throw new Error(`Quiet zone must be at least 4 modules, got ${matrix.quietZoneModules}`);
    }

    for (const template of TEMPLATES) {
      for (const preset of QR_ACCENT_PRESETS) {
        const rendered = renderQrTemplateToRgbaBuffer(
          biz.slug,
          { template, accentColor: preset.hex },
          { width: 800, height: 1132, baseOrigin: biz.origin },
        );

        // Encode rendered template to a real PNG binary buffer (simulating PNG file download)
        const png = new PNG({ width: rendered.width, height: rendered.height });
        Buffer.from(rendered.data.buffer).copy(png.data);
        const pngBuffer = PNG.sync.write(png);

        if (pngBuffer.byteLength < 1000) {
          throw new Error(`Exported PNG for ${biz.slug} (${template}) is unexpectedly small`);
        }

        // Decode the exported PNG file bytes back into RGBA pixels and scan with jsQR
        const decodedPng = PNG.sync.read(pngBuffer);
        const qrResult = jsQR(
          new Uint8ClampedArray(decodedPng.data),
          decodedPng.width,
          decodedPng.height,
        );

        if (!qrResult) {
          throw new Error(
            `SCAN FAILED: jsQR could not decode exported PNG for slug="${biz.slug}" template="${template}" accent="${preset.hex}"`,
          );
        }

        if (qrResult.data !== expectedUrl) {
          throw new Error(
            `URL MISMATCH: Decoded QR URL "${qrResult.data}" !== expected "${expectedUrl}" (template="${template}")`,
          );
        }

        totalChecks++;
      }
    }
    console.log(
      `PASS [QR Decode + PNG Roundtrip]: slug="${biz.slug}" -> "${expectedUrl}" across all 3 templates & 5 accents`,
    );
  }

  // 2. Verify Printable A5 PDF generation structure
  const fakeJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const pdfBytes = buildPrintableA5PdfFromJpeg(fakeJpegBytes, 1200, 1700);
  const pdfText = new TextDecoder().decode(pdfBytes);

  if (!pdfText.startsWith('%PDF-1.4')) {
    throw new Error('Generated PDF does not start with %PDF-1.4 header');
  }
  if (!pdfText.includes('/MediaBox [0 0 420 595]')) {
    throw new Error('Generated PDF does not contain A5 portrait MediaBox [0 0 420 595]');
  }
  if (!pdfText.includes('/Subtype /Image /Width 1200 /Height 1700')) {
    throw new Error('Generated PDF does not embed 1200x1700 high-resolution poster XObject');
  }
  if (!pdfText.trimEnd().endsWith('%%EOF')) {
    throw new Error('Generated PDF does not end with %%EOF');
  }
  console.log(
    `PASS [Printable A5 PDF Export]: Valid %PDF-1.4 binary (${pdfBytes.byteLength} bytes, MediaBox [0 0 420 595], 1200x1700 XObject)`,
  );

  console.log(
    `\nALL ${totalChecks} AUTOMATED QR SCAN VERIFICATION & EXPORT CHECKS PASSED.`,
  );
}

runAutomatedQrVerification();
