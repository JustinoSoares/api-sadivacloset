import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly maxSizeBytes: number;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>('upload.dir') || './uploads';
    const maxMb = this.config.get<number>('upload.maxSizeMb') || 5;
    this.maxSizeBytes = maxMb * 1024 * 1024;
    this.ensureDir();
  }

  private ensureDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload dir ${this.uploadDir}`);
    }
  }

  async saveComprovativo(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException({
        erro: { codigo: 'FICHEIRO_OBRIGATORIO', mensagem: 'Ficheiro comprovativo é obrigatório' },
      });
    }
    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException({
        erro: {
          codigo: 'FICHEIRO_MUITO_GRANDE',
          mensagem: `Ficheiro excede ${this.maxSizeBytes / (1024 * 1024)}MB`,
        },
      });
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (file.mimetype && !allowed.includes(file.mimetype)) {
      throw new BadRequestException({
        erro: {
          codigo: 'FORMATO_INVALIDO',
          mensagem: `Formato ${file.mimetype} não permitido. Use JPG, PNG, WEBP ou PDF`,
        },
      });
    }
    const ext = path.extname(file.originalname) || this.extFromMime(file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    const fullPath = path.join(this.uploadDir, filename);
    await fs.promises.writeFile(fullPath, file.buffer);
    // Return URL path (served statically) – in prod would be S3 URL
    return `/uploads/${filename}`;
  }

  private extFromMime(mime?: string): string {
    switch (mime) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'application/pdf':
        return '.pdf';
      default:
        return '.bin';
    }
  }
}
