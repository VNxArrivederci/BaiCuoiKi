// utils/activityLogger.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Ghi một hoạt động vào collection activity_feed
 * @param {Object} data - { type, actorId, actorName, actorPhoto, targetId, targetName, collection, rating, category }
 */
export async function logActivity(data) {
  try {
    await addDoc(collection(db, 'activity_feed'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-blocking — không throw để không ảnh hưởng flow chính
    console.warn('logActivity error:', err.message);
  }
}