import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { FIREBASE_WEB_CLIENT_ID } from '@env';

if (!FIREBASE_WEB_CLIENT_ID) {
  console.error('Firebase Web Client ID is not configured in .env file');
}

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: FIREBASE_WEB_CLIENT_ID,
});

// Export Firebase modules
export {
  auth,
  firestore,
  storage,
  GoogleSignin,
  FirebaseAuthTypes,
  FirebaseFirestoreTypes,
};

// Export Firebase types
export type FirestoreDocument = ReturnType<typeof firestore>['DocumentData'];
export type FirestoreDocumentSnapshot = ReturnType<typeof firestore>['DocumentSnapshot'];
export type FirestoreTimestamp = ReturnType<typeof firestore>['Timestamp'];
export type FirebaseUser = ReturnType<typeof auth>['User'];

// Export type-safe Firestore helpers
export const createFirestoreDoc = <T extends FirestoreDocument>(data: T) => data;
export const createFirestoreCollection = (name: string) => firestore().collection(name);

// Export Firebase utilities
export const GoogleAuthProvider = {
  credential: (idToken: string) => {
    return auth.GoogleAuthProvider.credential(idToken);
  },
};

export const FieldValue = {
  arrayUnion: (...elements: any[]) => {
    return firestore.FieldValue.arrayUnion(...elements);
  },
  arrayRemove: (...elements: any[]) => {
    return firestore.FieldValue.arrayRemove(...elements);
  },
  delete: () => {
    return firestore.FieldValue.delete();
  },
  increment: (n: number) => {
    return firestore.FieldValue.increment(n);
  },
  serverTimestamp: () => {
    return firestore.FieldValue.serverTimestamp();
  },
};
