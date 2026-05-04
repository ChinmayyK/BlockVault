import apiClient from '../client';
import { API_ENDPOINTS } from '@/config/constants';

export const authService = {
  /**
   * Login with wallet address
   */
  async login(walletAddress: string) {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
      address: walletAddress,
    });
    return response.data;
  },

  /**
   * Logout current user
   */
  async logout() {
    const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    return response.data;
  },

  /**
   * Get user profile
   */
  async getProfile() {
    const response = await apiClient.get(API_ENDPOINTS.AUTH.PROFILE);
    return response.data;
  },

  /**
   * Update user profile
   */
  async updateProfile(profileData: {
    name?: string;
    role?: string;
    firm?: string;
  }) {
    const response = await apiClient.put(API_ENDPOINTS.AUTH.PROFILE, profileData);
    return response.data;
  },

  /**
   * Register new user
   */
  async register(userData: {
    address: string;
    name?: string;
    role?: string;
    firm?: string;
  }) {
    const response = await apiClient.post('/users/register', userData);
    return response.data;
  },
};







