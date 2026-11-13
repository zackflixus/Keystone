import authService from './authService.js';
import { successResponse, createdResponse } from '../../core/utils/apiResponse.js';

export const authController = {
  // Register
  async register(req, res, next) {
    const result = await authService.register(req.validatedBody);
    return createdResponse(res, result, 'Registration successful');
  },

  // Login
  async login(req, res, next) {
    const result = await authService.login(req.validatedBody);
    return successResponse(res, result, 'Login successful');
  },

  // Refresh token
  async refreshToken(req, res, next) {
    const { refreshToken } = req.validatedBody;
    const result = await authService.refreshToken(refreshToken);
    return successResponse(res, result, 'Token refreshed');
  },

  // Request a password reset email
  async forgotPassword(req, res, next) {
    const { email } = req.validatedBody;
    const result = await authService.forgotPassword(email);
    return successResponse(res, null, result.message);
  },

  // Reset password using a token from the forgot-password email
  async resetPassword(req, res, next) {
    const { token, password } = req.validatedBody;
    const result = await authService.resetPassword(token, password);
    return successResponse(res, null, result.message);
  },

  // Change password for the authenticated user
  async changePassword(req, res, next) {
    const { currentPassword, newPassword } = req.validatedBody;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    return successResponse(res, null, result.message);
  },

  // Logout
  async logout(req, res, next) {
    await authService.logout(req.user.id);
    return successResponse(res, null, 'Logout successful');
  },

  // Get current user
  async getCurrentUser(req, res, next) {
    const user = await authService.getCurrentUser(req.user.id);
    return successResponse(res, user);
  }
};

export default authController;
