import prisma from '../../core/database/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../core/config/index.js';
import { ApiError } from '../../core/utils/apiResponse.js';
import emailService from '../email/emailService.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_FORGOT_PASSWORD_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

export const authService = {
  // Register new user
  async register(userData) {
    const { email, password, name } = userData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw ApiError.conflict('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true
      }
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return { user, ...tokens };
  },

  // Login user
  async login(userData) {
    const { email, password } = userData;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    // Fetch workspaces inline (eliminates a separate API call after login)
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, projects: true } }
          }
        },
        customRole: { select: { id: true, name: true, color: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    const workspaces = memberships.map(m => ({ ...m.workspace, role: m.role, customRole: m.customRole || null }));

    // Return only safe public fields — never expose password, refreshToken, or refreshTokenExp
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return { user: safeUser, ...tokens, workspaces };
  },

  // Refresh token
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token required');
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      
      if (!decoded || !decoded.userId) {
        throw ApiError.unauthorized('Invalid refresh token payload');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      // Check if token matches stored token
      if (user.refreshToken !== refreshToken) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user.id);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.unauthorized('Invalid refresh token');
      }
      throw error;
    }
  },

  // Request a password reset email. Always resolves with the same generic
  // message regardless of whether the email is registered, so callers can't
  // use this endpoint to enumerate accounts.
  async forgotPassword(email) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: hashedToken, resetPasswordExpires }
    });

    const resetLink = `${config.frontendUrl}/reset-password/${rawToken}`;
    emailService.sendPasswordResetEmail(user.email, user.name, resetLink).catch(err => {
      console.error(`[AuthService] Failed to send password reset email to ${user.email}:`, err?.message);
    });

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  },

  // Reset password using a token issued by forgotPassword
  async resetPassword(rawToken, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() }
      }
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired password reset link');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        // Invalidate any existing session so a stolen refresh token can't
        // outlive the password change.
        refreshToken: null,
        refreshTokenExp: null
      }
    });

    return { message: 'Password has been reset successfully' };
  },

  // Change password from Profile after confirming the user's current password.
  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw ApiError.badRequest('New password must be different from the current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Password changed successfully' };
  },

  // Logout
  async logout(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExp: null
      }
    });

    return true;
  },

  // Generate access and refresh tokens
  async generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      config.jwt.secret,
      { expiresIn: config.jwt.expire }
    );

    const refreshToken = jwt.sign(
      { userId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpire }
    );

    // Store refresh token
    const refreshTokenExp = new Date();
    refreshTokenExp.setDate(refreshTokenExp.getDate() + 7);

    await prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken,
        refreshTokenExp
      }
    });

    return { accessToken, refreshToken };
  },

  // Get current user
  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }
};

export default authService;
