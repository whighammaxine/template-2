"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from "firebase/auth";
import { User } from "firebase/auth";
import { auth, firestore, GoogleSignin } from "../firebase/firebase";
import { validateEmail, validatePassword, checkRateLimit, validateSession, sanitizeInput } from '../utils/security';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin as GoogleSigninNative } from '@react-native-google-signin/google-signin';
import { User as UserType } from '@/types';
import { enable2FA as enable2FAUtil, disable2FA as disable2FAUtil, verify2FACode as verify2FACodeUtil } from '../utils/twoFactorAuth';
import { requestNotificationPermission } from '../utils/notifications';
import { FirebaseAuthTypes } from '../firebase/firebase';
import { signInWithGoogle, signOut } from '../firebase/firebaseUtils';
import { Alert } from 'react-native';

interface User extends FirebaseAuthTypes.User {
  twoFactorEnabled?: boolean;
  activeSessions?: string[];
  lastActive?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  validateCurrentSession: () => Promise<boolean>;
  enable2FA: () => Promise<boolean>;
  disable2FA: () => Promise<boolean>;
  verify2FACode: (code: string) => Promise<boolean>;
  is2FAEnabled: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  logout: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  validateCurrentSession: async () => false,
  enable2FA: async () => false,
  disable2FA: async () => false,
  verify2FACode: async () => false,
  is2FAEnabled: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeUser: (() => void) | null = null;

    const setupAuthListener = async () => {
      try {
        // Auth state listener
        unsubscribeAuth = auth().onAuthStateChanged(async (firebaseUser: FirebaseAuthTypes.User | null) => {
          if (!isMounted) return;

          if (firebaseUser) {
            try {
              // Validate session
              const isValidSession = await validateSession(firebaseUser.uid, firebaseUser.uid);
              if (!isValidSession) {
                await auth().signOut();
                setError('Session expired. Please sign in again.');
                setUser(null);
                setLoading(false);
                return;
              }

              // Check rate limiting
              if (!checkRateLimit(firebaseUser.uid)) {
                setError('Too many requests. Please try again later.');
                return;
              }

              // Create a new session
              const newSessionId = `session_${Date.now()}`;
              setSessionId(newSessionId);

              // Set up real-time listener for user document
              const userDoc = await firestore().collection('users').doc(firebaseUser.uid).get();
              
              if (userDoc.exists) {
                const userData = userDoc.data() as User;
                // Update active sessions
                await firestore().collection('users').doc(firebaseUser.uid).update({
                  activeSessions: [...(userData.activeSessions || []), newSessionId],
                  lastActive: Date.now(),
                });
                setUser({ ...firebaseUser, ...userData });
                setIs2FAEnabled(!!userData.twoFactorEnabled);
              } else {
                // Create new user document if it doesn't exist
                const newUser: User = {
                  ...firebaseUser,
                  twoFactorEnabled: false,
                  activeSessions: [newSessionId],
                  lastActive: Date.now(),
                };
                
                await firestore().collection('users').doc(firebaseUser.uid).set(newUser);
                
                if (isMounted) {
                  setUser(newUser);
                }
              }
              if (isMounted) {
                setLoading(false);
              }
            } catch (error) {
              console.error('Error setting up user listener:', error);
              if (isMounted) {
                setError('Failed to fetch user data');
                setLoading(false);
              }
            }
          } else {
            // Clean up user listener if exists
            if (unsubscribeUser) {
              unsubscribeUser();
              unsubscribeUser = null;
            }
            if (isMounted) {
              setUser(null);
              setSessionId(null);
              setLoading(false);
            }
          }
        });
      } catch (error) {
        console.error('Error setting up auth listener:', error);
        if (isMounted) {
          setError('Failed to initialize authentication');
          setLoading(false);
        }
      }
    };

    setupAuthListener();

    return () => {
      isMounted = false;
      // Clean up all listeners
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
      if (unsubscribeUser) {
        unsubscribeUser();
      }
      // Clean up session on unmount
      if (user && sessionId) {
        firestore().collection('users').doc(user.id).update({
          activeSessions: firestore.FieldValue.arrayRemove(sessionId),
        }).catch(console.error);
      }
    };
  }, []);

  const handleSignIn = async () => {
    try {
      setError(null);
      const result = await signInWithGoogle();
      if (!result?.user) {
        throw new Error('Failed to sign in with Google');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Failed to sign in with Google');
      Alert.alert('Error', 'Failed to sign in with Google');
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to sign out');
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      
      // Validate input
      if (!validateEmail(email)) {
        setError('Invalid email format');
        return;
      }

      if (!validatePassword(password)) {
        setError('Invalid password format');
        return;
      }

      // Sanitize input
      const sanitizedEmail = sanitizeInput(email);
      
      await auth().signInWithEmailAndPassword(sanitizedEmail, password);
    } catch (error) {
      console.error('Email sign in error:', error);
      setError('Failed to sign in with email');
      Alert.alert('Error', 'Failed to sign in with email');
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      setError(null);
      
      // Validate input
      if (!validateEmail(email)) {
        setError('Invalid email format');
        return;
      }
      if (!validatePassword(password)) {
        setError('Invalid password format');
        return;
      }
      if (!displayName.trim()) {
        setError('Display name is required');
        return;
      }

      // Sanitize input
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedDisplayName = sanitizeInput(displayName);

      const { user } = await auth().createUserWithEmailAndPassword(sanitizedEmail, password);
      await user.updateProfile({ displayName: sanitizedDisplayName });
    } catch (error) {
      console.error('Email sign up error:', error);
      setError('Failed to create account');
      Alert.alert('Error', 'Failed to create account');
    }
  };

  const validateCurrentSession = async (): Promise<boolean> => {
    if (!user || !sessionId) return false;
    return validateSession(user.id, sessionId);
  };

  // Add 2FA methods
  const enable2FA = async (): Promise<boolean> => {
    try {
      if (!user) {
        setError('User must be logged in to enable 2FA');
        return false;
      }

      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        setError('Push notification permission is required for 2FA');
        return false;
      }

      const success = await enable2FAUtil(user.id);
      if (success) {
        setIs2FAEnabled(true);
        await firestore().collection('users').doc(user.id).update({
          twoFactorEnabled: true,
          updatedAt: Date.now(),
        });
      }
      return success;
    } catch (error) {
      console.error('Failed to enable 2FA:', error);
      setError('Failed to enable 2FA');
      return false;
    }
  };

  const disable2FA = async (): Promise<boolean> => {
    try {
      if (!user) {
        setError('User must be logged in to disable 2FA');
        return false;
      }

      const success = await disable2FAUtil(user.id);
      if (success) {
        setIs2FAEnabled(false);
        await firestore().collection('users').doc(user.id).update({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          updatedAt: Date.now(),
        });
      }
      return success;
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      setError('Failed to disable 2FA');
      return false;
    }
  };

  const verify2FACode = async (code: string): Promise<boolean> => {
    try {
      if (!user) {
        setError('User must be logged in to verify 2FA code');
        return false;
      }

      return await verify2FACodeUtil(user.id, code);
    } catch (error) {
      console.error('Failed to verify 2FA code:', error);
      setError('Failed to verify 2FA code');
      return false;
    }
  };

  const value = {
    user,
    loading,
    error,
    signIn: handleSignIn,
    logout: handleLogout,
    signInWithEmail,
    signUpWithEmail,
    validateCurrentSession,
    enable2FA,
    disable2FA,
    verify2FACode,
    is2FAEnabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
