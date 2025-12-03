// Utility functions for authentication

export const authStorage = {
  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(token) {
    localStorage.setItem('auth_token', token);
  },

  removeToken() {
    localStorage.removeItem('auth_token');
  },

  getUser() {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser(user) {
    localStorage.setItem('auth_user', JSON.stringify(user));
  },

  removeUser() {
    localStorage.removeItem('auth_user');
  },

  clear() {
    this.removeToken();
    this.removeUser();
  },
};
