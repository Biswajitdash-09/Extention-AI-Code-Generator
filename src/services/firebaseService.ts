import { app, auth } from '../firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';

export { auth };
export const db = app ? getFirestore(app) : undefined;

/**
 * Token bucket rate limiter to prevent Firebase quota exhaustion
 * Firebase Free Tier: ~50 reads/second, 50 writes/second
 * We use conservative limits to stay well within quotas
 */
class FirebaseRateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number; // tokens per second

    constructor(tokens: number = 40, refillRate: number = 40) {
        this.maxTokens = tokens;
        this.tokens = tokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }

    async waitForToken(): Promise<void> {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        
        // Refill tokens based on elapsed time
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;

        if (this.tokens < 1) {
            // Wait until we have a token available
            const waitTime = (1 - this.tokens) / this.refillRate * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.lastRefill = Date.now();
            this.tokens = this.maxTokens; // Refill to max after wait
        }

        this.tokens--;
    }
}

// Singleton rate limiters for read and write operations
const writeRateLimiter = new FirebaseRateLimiter(40, 40); // 40 ops/second
const readRateLimiter = new FirebaseRateLimiter(40, 40); // 40 ops/second

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
        if (!auth || !db) throw new Error('Firebase not initialized');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Rate limit write operation
        await writeRateLimiter.waitForToken();

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
        if (!db) return null;
        
        // Rate limit read operation
        await readRateLimiter.waitForToken();
        
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);
        return snap.exists() ? snap.data() : null;
    }

    /**
     * Sign in with email and password
     */
    static async login(email: string, password: string): Promise<User> {
        if (!auth) throw new Error('Firebase not initialized');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Rate limit read operation after login
        await readRateLimiter.waitForToken();
        
        return userCredential.user;
    }

    /**
     * Sign out
     */
    static async logout(): Promise<void> {
        if (auth) await signOut(auth);
    }

    /**
     * Sync history to Firestore
     */
    static async saveHistory(userId: string, history: FirebaseHistoryItem[]): Promise<void> {
        if (!db) return;
        
        // Rate limit write operation
        await writeRateLimiter.waitForToken();
        
        const historyRef = doc(db, 'users', userId);
        await setDoc(historyRef, { history, lastUpdated: Timestamp.now() }, { merge: true });
    }

    /**
     * Get history from Firestore
     */
    static async getHistory(userId: string): Promise<FirebaseHistoryItem[]> {
        if (!db) return [];
        
        // Rate limit read operation
        await readRateLimiter.waitForToken();
        
        const historyRef = doc(db, 'users', userId);
        // Simplified for now - can use a subcollection for larger histories
        const snapshot = await getDocs(query(collection(db!, 'users', userId, 'history'), orderBy('timestamp', 'desc'), limit(50)));
        return snapshot.docs.map(doc => doc.data() as FirebaseHistoryItem);
    }
}
