import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  private async getDeepLink(code: string, brandId?: number): Promise<string> {
    let botUsername = 'your_bot';
    if (brandId) {
      const bot = await this.prisma.telegramBot.findFirst({
        where: { brandId, isActive: true },
      });
      if (bot) botUsername = bot.username;
    }
    if (botUsername === 'your_bot') {
      const anyBot = await this.prisma.telegramBot.findFirst({
        where: { isActive: true },
      });
      if (anyBot) botUsername = anyBot.username;
    }
    return `https://t.me/${botUsername}?start=CODE_${code}`;
  }

  async generateQrPng(code: string, brandId?: number): Promise<Buffer> {
    const url = await this.getDeepLink(code, brandId);
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

        const cols = 3;
        const rows = 4;
        const perPage = cols * rows;

        const cellW = (doc.page.width - 60) / cols;
        const cellH = (doc.page.height - 60) / rows;
        const qrSize = Math.min(cellW - 20, cellH - 50);

        for (let i = 0; i < vouchers.length; i++) {
          if (i > 0 && i % perPage === 0) doc.addPage();

          const posOnPage = i % perPage;
          const col = posOnPage % cols;
          const row = Math.floor(posOnPage / cols);

          const x = 30 + col * cellW;
          const y = 30 + row * cellH;

          const v = vouchers[i];
          const url = await this.getDeepLink(v.code, v.brandId);
          const qrPng = await QRCode.toBuffer(url, {
            type: 'png',
            width: qrSize,
            margin: 1,
            errorCorrectionLevel: 'M',
          });

          const qrX = x + (cellW - qrSize) / 2;
          doc.image(qrPng, qrX, y, { width: qrSize, height: qrSize });

          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(v.code, x, y + qrSize + 4, {
              width: cellW,
              align: 'center',
            });

          doc
            .fontSize(7)
            .font('Helvetica')
            .text(v.brand.name, x, y + qrSize + 18, {
              width: cellW,
              align: 'center',
            });
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
