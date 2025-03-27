import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
    // TODO: Replace with your Firebase config
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export class FirebaseService {
    constructor() {
        this.transcriptsCollection = collection(db, 'videoTranscripts');
    }

    /**
     * Generate a unique storage path for a video transcript
     * @param {string} videoId - YouTube video ID or unique identifier
     * @returns {string} Storage path
     */
    getStoragePath(videoId) {
        return `transcripts/${videoId}.html`;
    }

    /**
     * Check if a transcript exists for a given video
     * @param {string} videoId - YouTube video ID or unique identifier
     * @returns {Promise<Object|null>} Transcript metadata or null if not found
     */
    async getTranscriptMetadata(videoId) {
        try {
            const docRef = doc(this.transcriptsCollection, videoId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data();
            }
            return null;
        } catch (error) {
            console.error('Error fetching transcript metadata:', error);
            throw error;
        }
    }

    /**
     * Store transcript content and metadata
     * @param {string} videoId - YouTube video ID or unique identifier
     * @param {Object} metadata - Video metadata (title, URL, etc.)
     * @param {string} htmlContent - Full HTML content of the transcript
     * @returns {Promise<Object>} Stored transcript metadata
     */
    async storeTranscript(videoId, metadata, htmlContent) {
        try {
            // 1. Upload HTML content to Cloud Storage
            const storagePath = this.getStoragePath(videoId);
            const storageRef = ref(storage, storagePath);
            await uploadString(storageRef, htmlContent, 'raw');
            
            // 2. Get the download URL
            const downloadUrl = await getDownloadURL(storageRef);
            
            // 3. Create Firestore document
            const transcriptData = {
                ...metadata,
                videoId,
                storageUrl: downloadUrl,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await setDoc(doc(this.transcriptsCollection, videoId), transcriptData);
            
            return transcriptData;
        } catch (error) {
            console.error('Error storing transcript:', error);
            throw error;
        }
    }

    /**
     * Fetch HTML content from Cloud Storage
     * @param {string} storageUrl - URL to the stored HTML content
     * @returns {Promise<string>} HTML content
     */
    async fetchTranscriptContent(storageUrl) {
        try {
            const response = await fetch(storageUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch transcript content');
            }
            return await response.text();
        } catch (error) {
            console.error('Error fetching transcript content:', error);
            throw error;
        }
    }
}
