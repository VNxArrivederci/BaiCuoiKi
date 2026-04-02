// context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);

      if (firebaseUser) {
        await firebaseUser.reload().catch(() => {});
        const isGoogle   = firebaseUser.providerData?.[0]?.providerId === 'google.com';
        const isVerified = firebaseUser.emailVerified;

        if (isGoogle || isVerified) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef).catch(() => null);
          setUser({
            ...firebaseUser,
            profile: userDoc?.exists() ? userDoc.data() : null,
          });
        } else {
          await signOut(auth);
          setUser(false);
        }
      } else {
        setUser(false);
      }

      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // ────────────────────────────────────────────────
  // Refresh user — gọi sau khi cập nhật profile
  // ────────────────────────────────────────────────
  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    await firebaseUser.reload().catch(() => {});
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef).catch(() => null);
    setUser({
      ...firebaseUser,
      profile: userDoc?.exists() ? userDoc.data() : null,
    });
  };

  // ────────────────────────────────────────────────
  // Đăng ký Email/Password
  // ────────────────────────────────────────────────
  const registerWithEmail = async (email, password, displayName) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName });
      await sendEmailVerification(newUser);

      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        displayName,
        email,
        provider: 'email',
        emailVerified: false,
        travelStyle: null,
        interests: [],
        createdAt: serverTimestamp(),
      });

      await signOut(auth);

      return {
        success: true,
        message: `Email xác thực đã gửi tới ${email}.\nVui lòng kiểm tra hộp thư (kể cả Spam) rồi đăng nhập lại.`,
      };
    } catch (err) {
      return { success: false, message: getFirebaseErrorMessage(err.code) };
    }
  };

  // ────────────────────────────────────────────────
  // Đăng nhập Email/Password
  // ────────────────────────────────────────────────
  const loginWithEmail = async (email, password) => {
    try {
      const { user: loggedUser } = await signInWithEmailAndPassword(auth, email, password);
      await loggedUser.reload();

      if (!loggedUser.emailVerified) {
        await signOut(auth);
        return {
          success: false,
          message: 'Email chưa được xác thực.\nKiểm tra hộp thư và nhấn link xác thực trước khi đăng nhập.',
        };
      }

      await setDoc(
        doc(db, 'users', loggedUser.uid),
        { emailVerified: true },
        { merge: true }
      );

      return { success: true };
    } catch (err) {
      return { success: false, message: getFirebaseErrorMessage(err.code) };
    }
  };

  // ────────────────────────────────────────────────
  // Đăng nhập Google
  // ────────────────────────────────────────────────
  const loginWithGoogle = async (idToken) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const { user: googleUser } = await signInWithCredential(auth, credential);

      const userRef = doc(db, 'users', googleUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          uid: googleUser.uid,
          displayName: googleUser.displayName,
          email: googleUser.email,
          photoURL: googleUser.photoURL,
          provider: 'google',
          emailVerified: true,
          travelStyle: null,
          interests: [],
          createdAt: serverTimestamp(),
        });
      }

      return { success: true, isNewUser: !userDoc.exists() };
    } catch (err) {
      return { success: false, message: getFirebaseErrorMessage(err.code) };
    }
  };

  // ────────────────────────────────────────────────
  // Quên mật khẩu
  // ────────────────────────────────────────────────
  const forgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'Email khôi phục mật khẩu đã được gửi!' };
    } catch (err) {
      return { success: false, message: getFirebaseErrorMessage(err.code) };
    }
  };

  // ────────────────────────────────────────────────
  // Đăng xuất
  // ────────────────────────────────────────────────
  const logout = async () => {
    await signOut(auth);
    setUser(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user, loading,
        registerWithEmail, loginWithEmail, loginWithGoogle,
        forgotPassword, logout, refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────
const getFirebaseErrorMessage = (code) => {
  const map = {
    'auth/email-already-in-use':   'Email này đã được sử dụng.',
    'auth/invalid-email':          'Địa chỉ email không hợp lệ.',
    'auth/weak-password':          'Mật khẩu phải có ít nhất 6 ký tự.',
    'auth/user-not-found':         'Không tìm thấy tài khoản với email này.',
    'auth/wrong-password':         'Mật khẩu không đúng.',
    'auth/invalid-credential':     'Email hoặc mật khẩu không đúng.',
    'auth/too-many-requests':      'Quá nhiều lần thử. Vui lòng thử lại sau.',
    'auth/network-request-failed': 'Lỗi kết nối mạng.',
    'auth/user-disabled':          'Tài khoản này đã bị vô hiệu hóa.',
  };
  return map[code] || `Đã có lỗi xảy ra (${code})`;
};