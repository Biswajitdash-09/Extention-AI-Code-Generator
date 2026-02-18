import { initializeApp, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// Firebase client config is safe to ship in the extension bundle.
// Replace the placeholder values below with your actual Firebase project config
// before publishing the extension to the Marketplace.
export const firebaseConfig = {
    apiKey: 'AIzaSyD-KGY1JrUmRVIB0A272ZFG_b0RlmgrlhY',
    authDomain: 'ai-website-extention.firebaseapp.com',
    projectId: 'ai-website-extention',
    storageBucket: 'ai-website-extention.firebasestorage.app',
    messagingSenderId: '569092778147',
    appId: '1:569092778147:web:e7dc556ed798d975317716',
    measurementId: 'G-PBW2NL00RD'
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
    } else {
        console.warn('Firebase API Key missing. Authentication features will be disabled.');
    }
} catch (error) {
    console.error('Firebase initialization failed:', error);
}

export { app, auth };
