import { auth, firestore, storage, GoogleSignin, FirebaseAuthTypes } from './firebase';
import { Alert } from 'react-native';

// Authentication utilities
export const signInWithGoogle = async (): Promise<FirebaseAuthTypes.UserCredential | null> => {
  try {
    const { idToken } = await GoogleSignin.signIn();
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    return auth().signInWithCredential(googleCredential);
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    Alert.alert('Error', 'Failed to sign in with Google');
    return null;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
    await auth().signOut();
  } catch (error) {
    console.error('Sign Out Error:', error);
    Alert.alert('Error', 'Failed to sign out');
  }
};

// Firestore utilities
export const createDocument = async (
  collection: string,
  data: any,
  id?: string
): Promise<string> => {
  try {
    if (id) {
      await firestore().collection(collection).doc(id).set(data);
      return id;
    } else {
      const doc = await firestore().collection(collection).add(data);
      return doc.id;
    }
  } catch (error) {
    console.error('Create Document Error:', error);
    throw error;
  }
};

export const updateDocument = async (
  collection: string,
  id: string,
  data: any
): Promise<void> => {
  try {
    await firestore().collection(collection).doc(id).update(data);
  } catch (error) {
    console.error('Update Document Error:', error);
    throw error;
  }
};

export const deleteDocument = async (
  collection: string,
  id: string
): Promise<void> => {
  try {
    await firestore().collection(collection).doc(id).delete();
  } catch (error) {
    console.error('Delete Document Error:', error);
    throw error;
  }
};

// Storage utilities
export const uploadFile = async (
  path: string,
  uri: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    const reference = storage().ref(path);
    const task = reference.putFile(uri);

    if (onProgress) {
      task.on('state_changed', snapshot => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      });
    }

    await task;
    const url = await reference.getDownloadURL();
    return url;
  } catch (error) {
    console.error('Upload File Error:', error);
    throw error;
  }
};

export const deleteFile = async (path: string): Promise<void> => {
  try {
    const reference = storage().ref(path);
    await reference.delete();
  } catch (error) {
    console.error('Delete File Error:', error);
    throw error;
  }
};
