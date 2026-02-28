import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as PDFDocument from 'pdfkit';
import * as archiver from 'archiver';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  private getDeepLink(code: string): string {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://resto-qr.onrender.com';
    return `${baseUrl}/v/${code}`;
  }

  async generateQrPng(code: string): Promise<Buffer> {
    const url = this.getDeepLink(code);
    return QRCode.toBuffer(url, {
      type: 'png',
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  }

  async generateBatchPdf(
    campaignId: number,
    brandId?: number,
    status?: string,
  ): Promise<Buffer> {
    const where: any = { campaignId };
    if (brandId) where.brandId = brandId;
    if (status) where.status = status;
    else where.status = 'FREE';

    const vouchers = await this.prisma.voucher.findMany({
      where,
      include: { brand: true, campaign: true },
      orderBy: { code: 'asc' },
    });

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 30 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        const qrSize = Math.min(doc.page.width - 80, 400);

        for (let i = 0; i < vouchers.length; i++) {
          if (i > 0) doc.addPage();

          const v = vouchers[i];
          const url = this.getDeepLink(v.code);
          const qrPng = await QRCode.toBuffer(url, {
            type: 'png',
            width: qrSize,
            margin: 1,
            errorCorrectionLevel: 'M',
          });

          const qrX = (doc.page.width - qrSize) / 2;
          const qrY = (doc.page.height - qrSize) / 2 - 60;

          doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });

          doc
            .fontSize(24)
            .font('Helvetica-Bold')
            .text(v.code, 0, qrY + qrSize + 20, {
              width: doc.page.width,
              align: 'center',
            });

          doc
            .fontSize(16)
            .font('Helvetica')
            .text(v.brand.name, 0, qrY + qrSize + 55, {
              width: doc.page.width,
              align: 'center',
            });
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  async generateBatchZip(
    campaignId: number,
    brandId?: number,
    status?: string,
  ): Promise<Buffer> {
    const where: any = { campaignId };
    if (brandId) where.brandId = brandId;
    if (status) where.status = status;
    else where.status = 'FREE';

    const vouchers = await this.prisma.voucher.findMany({
      where,
      include: { brand: true },
      orderBy: { code: 'asc' },
    });

    return new Promise(async (resolve, reject) => {
      try {
        const archive = archiver('zip', { zlib: { level: 5 } });
        const chunks: Buffer[] = [];

        archive.on('data', (chunk: Buffer) => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        for (const v of vouchers) {
          const png = await this.generateQrPng(v.code);
          archive.append(png, { name: `${v.brand.name}_${v.code}.png` });
        }

        await archive.finalize();
      } catch (e) {
        reject(e);
      }
    });
  }
}
