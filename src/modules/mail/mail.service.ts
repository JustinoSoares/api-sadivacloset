import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private from: string = '';
  private enabled = false;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('mail.host');
    const rawPort = this.config.get<number | string>('mail.port');
    const port = typeof rawPort === 'string' ? parseInt(rawPort, 10) : rawPort;
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');
    const from = this.config.get<string>('mail.from');
    const secure = this.config.get<boolean>('mail.secure');

    this.from = from || user || 'no-reply@sadivacloset.co.ao';

    if (!host || !port || isNaN(port as number)) {
      this.logger.warn(
        'SMTP não configurado (SMTP_HOST/SMTP_PORT em falta). E-mails serão apenas logados no console. Configure .env para enviar e-mails reais.',
      );
      this.enabled = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure ?? port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.enabled = true;
    this.logger.log(`SMTP configurado: ${host}:${port} (from: ${this.from})`);

    // Verifica conexão de forma assíncrona sem bloquear boot
    this.transporter.verify().then(
      () => this.logger.log('SMTP verificado com sucesso — pronto para enviar e-mails'),
      (err) => this.logger.warn(`Falha ao verificar SMTP: ${(err as Error).message}`),
    );
  }

  async sendMail(options: { to: string; subject: string; html: string; text?: string }): Promise<void> {
    if (!this.enabled || !this.transporter) {
      this.logger.warn(`[MOCK EMAIL] para=${options.to} assunto="${options.subject}" — SMTP desabilitado, apenas logado`);
      this.logger.log(`[MOCK EMAIL] Conteúdo HTML: ${options.html.substring(0, 500)}...`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(`E-mail enviado para ${options.to} — messageId=${info.messageId}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${options.to}: ${(err as Error).message}`, (err as Error).stack);
      // Não lança erro para não quebrar fluxo de forgotPassword (evita enumeration)
      // Quem chama decide se quer propagar.
      throw err;
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string, name?: string): Promise<void> {
    const greeting = name ? `Olá, ${name}` : 'Olá';
    const subject = 'Redefinição de senha — SadivaCloset';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #111;">${greeting}!</h2>
        <p>Recebemos um pedido para redefinir a sua senha na <strong>SadivaCloset</strong>.</p>
        <p>Clique no botão abaixo para criar uma nova senha. Este link expira em <strong>15 minutos</strong>:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; background-color: #111; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Redefinir senha
          </a>
        </p>
        <p>Ou copie e cole este link no navegador:</p>
        <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 13px;">${resetLink}</p>
        <p style="margin-top: 24px; font-size: 13px; color: #777;">
          Se não solicitou a redefinição, ignore este e-mail — a sua senha permanecerá inalterada.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">SadivaCloset &copy; ${new Date().getFullYear()}</p>
      </div>
    `;
    const text = `${greeting}!\n\nRecebemos um pedido para redefinir a sua senha na SadivaCloset.\nAcesse o link abaixo (expira em 15 minutos):\n${resetLink}\n\nSe não solicitou, ignore este e-mail.`;

    // Deixa erro propagar para o caller logar, mas não bloquear resposta genérica
    try {
      await this.sendMail({ to, subject, html, text });
    } catch (e) {
      this.logger.error(`Erro ao enviar e-mail de reset para ${to}`, e as string);
      // Não relança para não expor enumeration; apenas loga
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendWebhookNotification(params: {
    to?: string;
    gateway: string;
    rawBody: string;
    headers: Record<string, string>;
    payload: any;
    payment?: any;
    order?: any;
    result?: any;
    error?: string;
  }): Promise<void> {
    const to = params.to ?? 'justinocsoares123@gmail.com';
    const subject = `[SadivaCloset] Webhook ${params.gateway.toUpperCase()} - ${params.result?.status ?? params.result?.ok ?? 'recebido'} - ${new Date().toISOString()}`;
    const prettyPayload = JSON.stringify(params.payload, null, 2);
    const prettyResult = params.result ? JSON.stringify(params.result, null, 2) : 'pendente';
    const prettyPayment = params.payment ? JSON.stringify(params.payment, null, 2) : 'não encontrado';
    const prettyOrder = params.order ? JSON.stringify(params.order, null, 2) : 'n/a';
    const html = `
      <div style="font-family: monospace, Arial; max-width: 800px; margin: 0 auto; padding: 20px; color: #222;">
        <h2 style="color:#111;">Webhook ${params.gateway} recebido - SadivaCloset</h2>
        <p><strong>Data:</strong> ${new Date().toLocaleString('pt-AO')}</p>
        <p><strong>Gateway:</strong> ${params.gateway}</p>
        <p><strong>To:</strong> ${to}</p>
        ${params.error ? `<p style="color:red;"><strong>Erro:</strong> ${params.error}</p>` : ''}
        <h3>Headers (x-signature)</h3>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${JSON.stringify(params.headers, null, 2)}</pre>
        <h3>Raw Body (primeiros 2000 chars)</h3>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${params.rawBody.substring(0, 2000)}</pre>
        <h3>Payload JSON</h3>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${prettyPayload}</pre>
        <h3>Payment encontrado</h3>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${prettyPayment}</pre>
        <h3>Order</h3>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${prettyOrder}</pre>
        <h3>Resultado do processamento</h3>
        <pre style="background:#f0fff0;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${prettyResult}</pre>
        <hr/>
        <p style="font-size:11px;color:#888;">Enviado automaticamente por SadivaCloset webhook handler - src/modules/payments/payments.service.ts</p>
      </div>
    `;
    const text = `Webhook ${params.gateway} recebido\nPayload: ${prettyPayload}\nResult: ${prettyResult}`;
    // fire and forget but await with error handling
    try {
      await this.sendMail({ to, subject, html, text });
    } catch (e) {
      this.logger.warn(`Falha ao enviar email de webhook para ${to}: ${(e as Error).message}`);
    }
  }
}
