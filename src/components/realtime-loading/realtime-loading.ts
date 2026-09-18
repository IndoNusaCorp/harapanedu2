"use client"
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { connecttofirestore } from "@/lib/firebase";

export type RealtimeLoadingOptions = {
    //nama koleksi firestore yang dipantau, contoh ["assignments"]
    koleksi?: string[];
    //fungsi load data milik halaman (misal loadData), dipanggil ulang saat guru add/edit/delete
    onRefresh?: () => unknown;
};

export function useRealtimeLoading(intervalDetik = 10, { koleksi = [], onRefresh }: RealtimeLoadingOptions = {}) {
    const router = useRouter();
    const [loading, startTransition] = useTransition();
    const [error, setError] = useState(false);
    const isloading = useRef(false);
    const onRefreshRef = useRef(onRefresh);

    const maxtimeout = 30; //timeout selama 30 detik
    const pauseRealtime = 500; //jeda agar beberapa perubahan beruntun cukup dimuat sekali

    //selalu pakai fungsi onRefresh terbaru dari halaman
    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    //refresh otomatis tanpa perlu refresh manual
    useEffect(() => {
        const interval = setInterval(() => {
            //tidak refresh saat tab tidak aktif
            if (document.hidden) return;
            startTransition(() => router.refresh());
        }, intervalDetik * 1000);
        return () => clearInterval(interval);
    }, [router, intervalDetik]);

    //realtime: pantau koleksi firestore, saat guru add/edit/delete data halaman student dimuat ulang otomatis
    const kunciKoleksi = koleksi.join("|");
    useEffect(() => {
        if (!kunciKoleksi) return;
        let jeda: ReturnType<typeof setTimeout> | undefined;

        const unsubscribes = kunciKoleksi.split("|").map((nama) => {
            let snapshotPertama = true;
            return onSnapshot(
                collection(connecttofirestore, nama),
                (snapshot) => {
                    //snapshot pertama berisi data awal, bukan perubahan dari guru
                    if (snapshotPertama) {
                        snapshotPertama = false;
                        return;
                    }
                    //perubahan lokal yang belum tersimpan di server diabaikan
                    if (snapshot.metadata.hasPendingWrites) return;

                    console.log(`Data "${nama}" berubah, memuat ulang...`);
                    clearTimeout(jeda);
                    jeda = setTimeout(() => {
                        startTransition(async () => {
                            if (onRefreshRef.current) await onRefreshRef.current();
                            else router.refresh();
                        });
                    }, pauseRealtime);
                },
                (err) => console.warn(`Realtime "${nama}" gagal:`, err)
            );
        });

        return () => {
            clearTimeout(jeda);
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [router, kunciKoleksi]);

    //logika if else proses loading maksimal 30 detik, jika melewati 30 detik maka loading error
    //menggunakan if else di dalam useeffect
    useEffect(() => {
        if (loading) {
            isloading.current = true;
            console.log("Loading...");
            const timeout = setTimeout(() => {
                setError(true);
                console.log("Loading error...");
            }, maxtimeout * 1000);
            return () => clearTimeout(timeout);
        } else {
            //menambahkan console log jika berhasil
            if (isloading.current) {
                isloading.current = false;
                console.log("Loading berhasil.");
            }
            setError(false);
        }
    }, [loading]);

    const tryagain = () => {
        setError(false);
        startTransition(async () => {
            router.refresh();
            await onRefreshRef.current?.();
        });
    };

    return { loading, error, tryagain };
}
