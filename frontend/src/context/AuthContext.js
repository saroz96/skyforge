
<<<<<<< HEAD
=======

>>>>>>> 36ec5a2 (reuploading project)
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCredentials, logout as reduxLogout, setCurrentCompany } from '../auth/authSlice';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { userInfo, currentCompany } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

<<<<<<< HEAD
    const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    withCredentials: true,
  });
  
=======
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    withCredentials: true,
  });

>>>>>>> 36ec5a2 (reuploading project)
  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if user is already logged in (via session cookie)
        const { data } = await api.get('/api/auth/me', { withCredentials: true });
        if (data.user) {
<<<<<<< HEAD
          dispatch(setCredentials({ 
=======
          dispatch(setCredentials({
>>>>>>> 36ec5a2 (reuploading project)
            user: data.user,
            currentCompany: data.currentCompany || null
          }));
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [dispatch]);

  const hasPermission = (requiredPermission) => {
    if (!userInfo || !userInfo.permissions) return false;
    return userInfo.permissions.includes(requiredPermission);
  };

  const clearAuthData = useCallback(() => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    dispatch(reduxLogout());
  }, [dispatch]);

  const switchCompany = async (companyId) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.get(`/api/switch/${companyId}`, {
        withCredentials: true
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to switch company');
      }

      // Update the current company in Redux store
      dispatch(setCurrentCompany({
        company: data.data.sessionData.company,
        fiscalYear: data.data.sessionData.fiscalYear
      }));

      return data;
    } catch (err) {
      const error = err.response?.data?.message || err.message || 'Failed to switch company';
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData, options = {}) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.post('/api/auth/register', userData);

      if (options.autoLogin && data.token) {
        localStorage.setItem('token', data.token);
        await validateToken(data.token);
      }

      return data;
    } catch (err) {
      console.error('Registration error:', err);
      const error = err.response?.data?.error ||
        err.response?.data?.message ||
        'Registration failed';
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const validateToken = async (token) => {
    try {
      const { data } = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
<<<<<<< HEAD
      dispatch(setCredentials({ 
=======
      dispatch(setCredentials({
>>>>>>> 36ec5a2 (reuploading project)
        user: data.user,
        currentCompany: data.currentCompany || null
      }));
      return data.user;
    } catch (err) {
      clearAuthData();
      throw err;
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await axios.post('/api/auth/login', credentials, {
        withCredentials: true
      });

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

<<<<<<< HEAD
      dispatch(setCredentials({ 
=======
      dispatch(setCredentials({
>>>>>>> 36ec5a2 (reuploading project)
        user: data.user,
        currentCompany: data.currentCompany || null
      }));
      return data;
    } catch (err) {
      const error = err.response?.data?.message || err.message || 'Login failed';
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await axios.post('/api/auth/logout', {}, {
        withCredentials: true
      });

      // Clear frontend auth state
      clearAuthData();

      // Force refresh to ensure all session data is cleared
      window.location.href = '/api/auth/login';
    } catch (err) {
      console.error('Logout error:', err);
      // Even if API fails, clear frontend state
      clearAuthData();
      window.location.href = '/api/auth/login';
    } finally {
      setLoading(false);
    }
  }, [clearAuthData]);

  const value = {
    currentUser: userInfo,
    currentCompany,
    loading,
    error,
    hasPermission,
    register,
    login,
    logout,
    switchCompany,
    clearError: () => setError(null),
    validateToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
<<<<<<< HEAD
};
=======
};
>>>>>>> 36ec5a2 (reuploading project)
