import nodemailer from 'nodemailer';
import logger from './logger.js';
import AppError from './appError.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_PORT) === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const getSender = () => {
  const from = process.env.EMAIL_FROM || '';
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);

  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, '').trim() || 'Sistema PI II',
      email: match[2].trim(),
    };
  }

  return {
    name: 'Sistema PI II',
    email: from.trim(),
  };
};

const sendWithBrevo = async (options) => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: getSender(),
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Brevo API retornou HTTP ${response.status}`);
  }

  return true;
};

/**
 * Envia e-mails pela API Brevo ou pelo SMTP local.
 * @param {Object} options - { to, subject, html }
 */
export const sendEmail = async (options) => {
  if (process.env.NODE_ENV === 'test') {
    logger.info('TESTE: envio de e-mail simulado.');
    return true;
  }
  try {
    if (process.env.BREVO_API_KEY?.trim()) {
      await sendWithBrevo(options);
      logger.info('E-mail aceito pela API Brevo.');
      return true;
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Template API <noreply@template.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    logger.info(`E-mail aceito pelo SMTP: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(
      { message: error.message },
      'Falha no envio de e-mail.',
    );

    throw new AppError(
      'Não foi possível enviar o e-mail de confirmação. Tente novamente.',
      503,
    );
  }
};
