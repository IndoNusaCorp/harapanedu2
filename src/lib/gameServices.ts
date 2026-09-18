import { connecttofirestore, connecttoauth } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface GameProgress {
  currentLevel: number;
  totalScore: number;
}

export const getGameProgress = async (gameId: string): Promise<GameProgress> => {
  const user = connecttoauth.currentUser;
  if (!user) {
    console.warn("User not authenticated. Returning default progress.");
    return { currentLevel: 1, totalScore: 0 };
  }

  try {
    const docRef = doc(connecttofirestore, "users", user.uid, "games", gameId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        currentLevel: data.currentLevel || 1,
        totalScore: data.totalScore || 0,
      };
    } else {
      // Default state if no progress saved yet
      return { currentLevel: 1, totalScore: 0 };
    }
  } catch (error) {
    console.error("Error fetching game progress:", error);
    return { currentLevel: 1, totalScore: 0 };
  }
};

export const saveGameProgress = async (gameId: string, progress: GameProgress): Promise<void> => {
  const user = connecttoauth.currentUser;
  if (!user) {
    console.warn("User not authenticated. Cannot save progress.");
    return;
  }

  try {
    const docRef = doc(connecttofirestore, "users", user.uid, "games", gameId);
    await setDoc(docRef, {
      currentLevel: progress.currentLevel,
      totalScore: progress.totalScore,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

  } catch (error) {
    console.error("Error saving game progress:", error);
  }
};
