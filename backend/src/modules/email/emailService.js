import nodemailer from 'nodemailer';
import config from '../../core/config/index.js';
import logger from '../../core/logger/index.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  pool: true,        // reuse SMTP connections instead of reconnecting each time
  maxConnections: 3,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export const emailService = {
  /**
   * Send a workspace invitation email
   */
  async sendInviteEmail(to, workspaceName, inviterName, inviteLink) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">You've Been Invited!</h2>
        <p>Hello,</p>
        <p><strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace on Keystone.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #4F46E5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Accept Invitation</a>
        </div>
        <p>If you don't have an account yet, you'll be prompted to create one after clicking the button.</p>
        <p>This link will expire in 7 days.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777777; text-align: center;">If you weren't expecting this invitation, you can safely ignore this email.</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"Keystone" <${config.smtp.user}>`,
        to,
        subject: `Join ${workspaceName} on Keystone`,
        html,
      });
      console.log(`[EmailService] Invitation sent to ${to}. Message ID: ${info.messageId}`);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`[EmailService] Failed to send email to ${to}:`, error);
      logger.error('Error sending email:', error);
      throw error;
    }
  },

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(to, name, resetLink) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">Reset Your Password</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset the password for your Keystone account. Click the button below to choose a new password.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4F46E5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777777; text-align: center;">If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"Keystone" <${config.smtp.user}>`,
        to,
        subject: 'Reset your Keystone password',
        html,
      });
      console.log(`[EmailService] Password reset email sent to ${to}. Message ID: ${info.messageId}`);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`[EmailService] Failed to send password reset email to ${to}:`, error);
      logger.error('Error sending email:', error);
      throw error;
    }
  },

  /**
   * Sent by the rules engine when a rule is auto-disabled after failing
   * RULE_AUTO_DISABLE_THRESHOLD times in a row (see modules/rules/ruleEngine.js).
   */
  async sendRuleDisabledEmail(to, name, ruleName, rulesLink) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #EF4444; text-align: center;">A rule was automatically turned off</h2>
        <p>Hello ${name},</p>
        <p>Your rule <strong>"${ruleName}"</strong> failed several times in a row, so Keystone turned it off to stop it from failing repeatedly. Nothing else happened to your data.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${rulesLink}" style="background-color: #4F46E5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Review the rule</a>
        </div>
        <p>Check its run history for the error, fix what's causing it, then turn it back on.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777777; text-align: center;">You're receiving this because you created this rule on Keystone.</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"Keystone" <${config.smtp.user}>`,
        to,
        subject: `Rule "${ruleName}" was turned off automatically`,
        html,
      });
      console.log(`[EmailService] Rule-disabled email sent to ${to}. Message ID: ${info.messageId}`);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`[EmailService] Failed to send rule-disabled email to ${to}:`, error);
      logger.error('Error sending email:', error);
      throw error;
    }
  },

  /**
   * Send a report email
   */
  async sendReportEmail(to, subject, html, senderName) {
    try {
      const fromName = senderName ? `${senderName} via Keystone` : 'Keystone Reports';
      const info = await transporter.sendMail({
        from: `"${fromName}" <${config.smtp.user}>`,
        to,
        subject,
        html,
      });
      console.log(`[EmailService] Report sent to ${to}. Message ID: ${info.messageId}`);
      logger.info(`Report email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`[EmailService] Failed to send report to ${to}:`, error);
      logger.error('Error sending report email:', error);
      throw error;
    }
  }
};

export default emailService;
