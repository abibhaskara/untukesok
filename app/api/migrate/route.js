import { NextResponse } from 'next/server';
import { db } from '../../../src/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { programsData as programs } from '../../../src/data/programsData';
import { newsData } from '../../../src/data/newsData';

export async function GET() {
  try {
    let migratedPrograms = 0;
    let migratedNews = 0;

    // Migrate Programs
    if (programs && programs.length > 0) {
      for (const prog of programs) {
        // Use the existing ID as the document ID
        await setDoc(doc(db, 'programs', prog.id), prog);
        migratedPrograms++;
      }
    }

    // Migrate News
    if (newsData && newsData.length > 0) {
      for (const news of newsData) {
        // News might not have an ID, we'll generate one or use a clean slug
        const docId = news.id || news.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await setDoc(doc(db, 'news', docId), { ...news, id: docId });
        migratedNews++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Migrasi berhasil!', 
      migratedPrograms, 
      migratedNews 
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
