import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

let inMemoryToken: string | null = null;

export const setToken = (token: string | null): void => {
  inMemoryToken = token;
};

export const getToken = (): string | null => inMemoryToken;

export interface Role {
  id: number;
  name: string;
  permissions: Record<string, any>;
}

export interface UserUsage {
  user_id: number;
  audits_performed: number;
  audit_limit: number;
  rounds_per_audit: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;  // Backend returns number, not string
  email: string;
  operator_name: string;
  is_temp: boolean;
  access_key?: string;
  expires_at?: string;
  subscription_tier: string;
  user_usage?: UserUsage;
  status: string;
  roles: Role[];
  created_at: string;
  updated_at: string;
}

export interface RegisterData {
  email: string;
  password: string;
  operator_name: string;
}

export interface LoginData {
  email: string;
  password?: string;
  access_key?: string;
}

export interface GenerateTempUserData {
  operator_name: string;
  email: string;
  expires_at: string;
}

export interface GenerateTempUserResponse {
  user: User;
  access_key: string;
}

export interface LoginResponse {
  user: User;
  message: string;
  token?: string;
}

export interface UpdateUserData {
  email?: string;
  subscription_tier?: string;
  status?: string;
}

export interface Offer {
  id: number;
  name: string;
  tier: number;
  tier_label: string;
  price: number;
  price_label: string;
  price_suffix: string;
  features: string[];
  color: string;
  is_recommended: boolean;
  is_active: boolean;
  sort_order: number;
  cta_label: string;
  cta_type: string;
  cta_link: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntentResult {
  client_secret: string;
  payment_intent_id: string;
  amount_cents: number;
  currency: string;
  offer_name: string;
  amount_display: number;
}

export interface Payment {
  id: number;
  user_id: number;
  offer_id: number | null;
  offer?: Offer;
  stripe_session_id: string;
  amount_paid: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Admin-only fields (preloaded)
  user?: User;
}

export interface Session {
  id: number;
  user_id: number;
  user?: User;
  token: string;
  created_at: string;
  expires_at: string;
}

export interface HeatmapSegment {
  text: string;
  heat: 'red' | 'yellow' | 'green' | 'neutral';
  note?: string;
}

export interface Vulnerability {
  id: string;
  severity: string;
  section: string;
  title: string;
  detail: string;
  precedent?: string;
}

export interface LogicalFallacy {
  id: string;
  type: string;
  sections: string;
  title: string;
  detail: string;
}

export interface FortificationStep {
  step: string;
  priority: string;
  title: string;
  fixes: string[];
  action: string;
  effort: string;
  impact: string;
}

export interface AuditReport {
  id: number;
  document_id: number;
  round_number: number;
  resilience_score: number | null;
  resilience_rationale?: string;
  section_scores?: { section_name: string; section_score: number; section_rationale: string }[];
  quality_score?: number;
  quality_issues?: { issues?: string[] };
  quality_reason?: string;
  heatmap_data: { segments: HeatmapSegment[] } | HeatmapSegment[] | any;
  vulnerabilities: Vulnerability[] | any;
  logical_fallacies: LogicalFallacy[] | any;
  fortification_plan: { steps: FortificationStep[] } | FortificationStep[] | any;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  total_documents: number;
  active_users: number;
  total_users: number;
  total_audit_reports: number;
  total_audio_debates: number;
  avg_resilience: number;
  processed_docs: number;
  pending_docs: number;
  failed_docs: number;
  total_payments: number;
  total_revenue: number;
  recent_activity: {
    document_id: number;
    file_name: string;
    status: string;
    user_email: string;
    created_at: string;
  }[];
}

export interface PublicStats {
  total_documents: number;
  total_audits: number;
  total_threats: number;
  avg_resilience: number;
  total_audio_debates: number;
}

export interface Document {
  id: number;
  user_id: number;
  file_name: string;
  cloudinary_url: string;
  raw_text?: string;
  status: string;
  rounds_used: number;
  audit_reports?: AuditReport[];
  audio_debates?: AudioDebate[];
  // Compatibility for existing untouched pages.
  audit_report?: AuditReport;
  audio_debate?: AudioDebate;
  created_at: string;
  updated_at: string;
}

export interface AudioDebate {
  id: number;
  document_id: number;
  round_number: number;
  cloudinary_audio_url: string;
  transcript_json: any;
  created_at: string;
  updated_at: string;
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies with requests
});

// Add Authorization header with JWT token from memory
axiosInstance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle 401 and refresh token
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 errors for protected API calls (NOT auth endpoints)
    // Auth endpoints are: login, logout, register, refresh
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    
    if (error.response?.status === 401 && !isAuthEndpoint) {
      try {
        // Try to refresh the token
        const response = await axiosInstance.post('/auth/refresh');
        const newToken = response.data.token;

        if (newToken) {
          // Update token in memory
          setToken(newToken);
          // Update authorization header for retry
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          // Retry original request
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - session expired
        setToken(null);
        // Dispatch custom event that components can listen to
        window.dispatchEvent(new CustomEvent('SESSION_EXPIRED'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  // Register a new user
  async register(data: RegisterData): Promise<LoginResponse> {
    try {
      const response = await axiosInstance.post<LoginResponse>('/auth/register', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  // Login user
  async login(data: LoginData): Promise<LoginResponse> {
    try {
      const response = await axiosInstance.post<LoginResponse>('/auth/login', data);
      // Save JWT token to memory from response
      if (response.data.token) {
        setToken(response.data.token);
      }
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  // Generate a temporary user (admin only)
  async generateTempUser(data: GenerateTempUserData): Promise<GenerateTempUserResponse> {
    try {
      const response = await axiosInstance.post<GenerateTempUserResponse>('/users/temp', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to generate temp user');
    }
  },

  async refreshToken(): Promise<string> {
    try {
      const response = await axiosInstance.post<{ token: string }>('/auth/refresh');
      const newToken = response.data.token;

      setToken(newToken);
      return newToken;
    } catch (error) {
      setToken(null);
      throw error;
    }
  },

  // Request a password reset code (unauthenticated)
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.post<{ message: string }>('/auth/forgot-password', { email });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to request password reset');
    }
  },

  // Reset password with code (unauthenticated)
  async resetPassword(code: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.post<{ message: string }>('/auth/reset-password', {
        code,
        new_password: newPassword,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to reset password');
    }
  },

  async validateResetCode(code: string): Promise<{ valid: boolean }> {
    try {
      const response = await axiosInstance.post<{ valid: boolean }>('/auth/validate-code', { code });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Invalid or expired code');
    }
  },

  // Get all users
  async getAllUsers(): Promise<User[]> {
    try {
      const response = await axiosInstance.get<User[]>('/users');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch users');
    }
  },

  // Get user by ID
  async getUserById(userId: number): Promise<User> {
    try {
      const response = await axiosInstance.get<User>(`/users/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch user');
    }
  },

  // Update user
  async updateUser(userId: number, data: UpdateUserData): Promise<User> {
    try {
      const response = await axiosInstance.put<User>(`/users/${userId}`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update user');
    }
  },

  // Delete user
  async deleteUser(userId: number): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.delete<{ message: string }>(`/users/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete user');
    }
  },

  // Logout user
  async logout(): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.post<{ message: string }>('/auth/logout');
      setToken(null);
      return response.data;
    } catch (error: any) {
      setToken(null);
      throw new Error(error.response?.data?.error || 'Logout failed');
    }
  },

  // Get all documents (admin)
  async getAllDocuments(): Promise<Document[]> {
    try {
      const response = await axiosInstance.get<Document[]>('/documents');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch documents');
    }
  },

  async getAdminStats(): Promise<AdminStats> {
    try {
      const response = await axiosInstance.get<AdminStats>('/admin/stats');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch admin stats');
    }
  },

  async getPublicStats(): Promise<PublicStats> {
    try {
      const response = await axiosInstance.get<PublicStats>('/public/stats');
      return response.data;
    } catch {
      return {
        total_documents: 0,
        total_audits: 0,
        total_threats: 0,
        avg_resilience: 0,
        total_audio_debates: 0,
      };
    }
  },

  async getAllAudioDebatesAdmin(): Promise<AudioDebate[]> {
    try {
      const response = await axiosInstance.get<AudioDebate[]>('/admin/audio-debates');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch audio debates');
    }
  },

  // Get document by ID
  async getDocumentById(docId: number): Promise<Document> {
    try {
      const response = await axiosInstance.get<Document>(`/documents/${docId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch document');
    }
  },

  // Get user documents
  async getUserDocuments(userId: number): Promise<Document[]> {
    try {
      const response = await axiosInstance.get<Document[]>(`/documents/user/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch user documents');
    }
  },

  // Create document with file upload
  async createDocument(userId: number, file: File): Promise<Document> {
    try {
      const formData = new FormData();
      formData.append('user_id', String(userId));
      formData.append('file', file);

      const response = await axiosInstance.post<Document>('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create document');
    }
  },

  // Update document
  async updateDocument(docId: number, updates: { file_name?: string; status?: string }): Promise<Document> {
    try {
      const response = await axiosInstance.put<Document>(`/documents/${docId}`, updates);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update document');
    }
  },

  async archiveDocument(docId: number): Promise<Document> {
    try {
      const response = await axiosInstance.put<Document>(`/documents/${docId}/archive`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to archive document');
    }
  },

  async reAuditDocument(docId: number, file: File): Promise<Document> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axiosInstance.put<Document>(`/documents/${docId}/reaudit`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to re-audit document');
    }
  },

  // Delete document
  async deleteDocument(docId: number): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.delete<{ message: string }>(`/documents/${docId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete document');
    }
  },

  // Local storage helpers
  saveUserToStorage(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  clearUserFromStorage(): void {
    localStorage.removeItem('user');
  },

  // Get role ID from user (convenience function)
  getRoleIdFromUser(user: User): number | null {
    if (!user.roles || user.roles.length === 0) return null;
    return user.roles[0].id;
  },

  // Check if user is admin
  isAdmin(user: User): boolean {
    const roleId = this.getRoleIdFromUser(user);
    return roleId === 1;
  },

  // Get current authenticated user with role info
  async getCurrentUser(): Promise<User> {
    try {
      const response = await axiosInstance.get<User>('/auth/me');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch current user');
    }
  },

  // Get active offers (user-facing billing page)
  async getActiveOffers(): Promise<Offer[]> {
    try {
      const response = await axiosInstance.get<Offer[]>('/offers');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch offers');
    }
  },

  // Get all offers including disabled ones (admin only)
  async getAllOffersAdmin(): Promise<Offer[]> {
    try {
      const response = await axiosInstance.get<Offer[]>('/admin/offers');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch admin offers');
    }
  },

  // Toggle offer active status (admin only)
  async toggleOffer(id: number): Promise<Offer> {
    try {
      const response = await axiosInstance.put<Offer>(`/admin/offers/${id}/toggle`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to toggle offer');
    }
  },

  // Create a Stripe PaymentIntent for an offer
  async createPaymentIntent(offerId: number): Promise<PaymentIntentResult> {
    try {
      const response = await axiosInstance.post<PaymentIntentResult>('/payments/intent', { offer_id: offerId });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create payment intent');
    }
  },

  // Confirm payment after Stripe client-side confirmation succeeds
  async confirmPayment(paymentIntentId: string, offerId: number): Promise<Payment> {
    try {
      const response = await axiosInstance.post<Payment>('/payments/confirm', {
        payment_intent_id: paymentIntentId,
        offer_id: offerId,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to confirm payment');
    }
  },

  // Get the authenticated user's payment history
  async getPaymentHistory(): Promise<Payment[]> {
    try {
      const response = await axiosInstance.get<Payment[]>('/payments/history');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch payment history');
    }
  },

  async getPaymentReceipt(paymentId: number): Promise<{ receipt_url: string }> {
    try {
      const response = await axiosInstance.get<{ receipt_url: string }>(`/payments/${paymentId}/receipt`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch payment receipt');
    }
  },

  // Get all payments (admin only)
  async getAllPayments(): Promise<Payment[]> {
    try {
      const response = await axiosInstance.get<Payment[]>('/admin/payments');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch payments');
    }
  },

  // Get all active and expired refresh-token sessions (admin only)
  async getAllSessions(): Promise<Session[]> {
    try {
      const response = await axiosInstance.get<Session[]>('/users/sessions');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch sessions');
    }
  },

  // Delete all expired refresh-token sessions (admin only)
  async clearExpiredSessions(): Promise<{ deleted: number }> {
    try {
      const response = await axiosInstance.delete<{ deleted: number }>('/users/sessions/expired');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to clear expired sessions');
    }
  },

  // Compare multiple documents
  async compareDocuments(documentIds: number[]): Promise<any> {
    try {
      const response = await axiosInstance.post('/documents/compare', { document_ids: documentIds });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to compare documents');
    }
  },

  // Token helpers
  getToken(): string | null {
    return getToken();
  },

  clearToken(): void {
    setToken(null);
  },
};
