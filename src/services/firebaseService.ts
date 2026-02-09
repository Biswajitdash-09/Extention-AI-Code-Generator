import { app, auth } from '../firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';

export { auth };
export const db = getFirestore(app);

export interface FirebaseHistoryItem {
    prompt: string;
    provider: string;
    model: string;
    timestamp: number;
    projectName?: string;
}

export class FirebaseService {
    /**
     * Sign up with email and password
     */
    static async signup(email: string, password: string, role: string = 'user'): Promise<User> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            email,
            role,
            createdAt: Timestamp.now()
        });

        return user;
    }

    /**
     * Get user profile data
     */
    static async getUserProfile(userId: string): Promise<any> {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDocs(query(collection(db, 'users'), limit(1))); // Simplified, should use getDoc
        // Correcting to getDoc
        const { getDoc } = await import('firebase/firestore');
        const snap = await getDoc(userRef);
        return snap.exists() ? snap.data() : null;
    }

    /**
     * Sign in with email and password
     */
    static async login(email: string, password: string): Promise<User> {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    }

    /**
     * Sign out
     */
    static async logout(): Promise<void> {
        await signOut(auth);
    }

    /**
     * Sync history to Firestore
     */
    static async saveHistory(userId: string, history: FirebaseHistoryItem[]): Promise<void> {
        const historyRef = doc(db, 'users', userId);
        await setDoc(historyRef, { history, lastUpdated: Timestamp.now() }, { merge: true });
    }

    /**
     * Get history from Firestore
     */
    static async getHistory(userId: string): Promise<FirebaseHistoryItem[]> {
        const historyRef = doc(db, 'users', userId);
        // Simplified for now - can use a subcollection for larger histories
        const snapshot = await getDocs(query(collection(db, 'users', userId, 'history'), orderBy('timestamp', 'desc'), limit(50)));
        return snapshot.docs.map(doc => doc.data() as FirebaseHistoryItem);
    }
}
