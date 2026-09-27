"use client";

import { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, RotateCcw, ArrowUpRight, Volume2, VolumeX } from 'lucide-react';
import { DURATION, scenes, sceneAt, timestamp, renderFrame } from './story';
import './motion-graphics.css';

export default function MotionGraphicsPage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const audioGraph = useRef<{ context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode } | null>(null);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const position = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const cancelExport = useRef<(() => void) | null>(null);
  const active = sceneAt(time);

  useEffect(() => { const ctx=canvas.current?.getContext('2d');if(ctx) renderFrame(ctx,time); },[time]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      position.current = Math.min(DURATION, audio.current?.currentTime ?? position.current);
      setTime(position.current);
      if(position.current < DURATION) frame=requestAnimationFrame(tick);else setPlaying(false);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing]);
  useEffect(() => {
    if (!playing && !exporting) audio.current?.pause(); 
  }, [playing, exporting]);
  useEffect(() => {
    if (audioGraph.current) audioGraph.current.gain.gain.value = muted ? 0 : volume;
  }, [volume, muted]);
  useEffect(()=>()=>{cancelExport.current?.();void audioGraph.current?.context.close();},[]);
  const seek=(value:number)=>{ position.current=value;setTime(value);if(audio.current)audio.current.currentTime=value; };

  async function prepareAudio() {
    if (!audio.current) throw new Error('Audio belum tersedia.');
    if (!audioGraph.current) {
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio.current);
      const gain = context.createGain();
      source.connect(gain);gain.connect(context.destination);
      audioGraph.current = { context, source, gain };
    }
    audioGraph.current.gain.gain.value = muted ? 0 : volume;
    await audioGraph.current.context.resume();
    return audioGraph.current;
  }

  async function togglePlayback() {
    if (playing) {audio.current?.pause();setPlaying(false);return;}
    try {
      await prepareAudio();
      if (position.current >= DURATION) seek(0);
      await audio.current!.play();setPlaying(true);
    } catch {setMessage('Audio tidak dapat diputar. Muat ulang halaman lalu coba lagi.');}
  }

  async function download() {
    if(exporting) return;
    setPlaying(false);setExporting(true);setProgress(0);setMessage('Menyiapkan MP4…');
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let recorder: MediaRecorder | undefined;
    let cancelled=false;
    let audioDestination: MediaStreamAudioDestinationNode | undefined;
    const restorePosition=position.current;
    audio.current?.pause();
    try {
      if(typeof MediaRecorder==='undefined') throw new Error('Browser ini belum mendukung perekaman video. Gunakan browser terbaru yang mendukung MP4.');
      const mime=['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
      if(!mime) throw new Error('Encoder MP4 tidak tersedia di browser ini. Buka halaman ini di Chrome atau Safari terbaru yang mendukung perekaman MP4.');
      const output=document.createElement('canvas');output.width=1280;output.height=720;
      const ctx=output.getContext('2d');if(!ctx || !output.captureStream) throw new Error('Browser tidak mendukung ekspor canvas.');
      renderFrame(ctx,0);stream=output.captureStream(30);
      const graph=await prepareAudio();
      audioDestination=graph.context.createMediaStreamDestination();
      graph.gain.connect(audioDestination);
      audioDestination.stream.getAudioTracks().forEach(track=>stream!.addTrack(track));
      recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5_000_000,audioBitsPerSecond:128_000});
      audio.current!.currentTime=0;
      const chunks: BlobPart[]=[];recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);};
      await new Promise<void>((resolve,reject)=>{
        const rec=recorder!;
        cancelExport.current=()=>{cancelled=true;if(timer) clearInterval(timer);if(rec.state!=='inactive')rec.stop();resolve();};
        rec.onerror=()=>reject(new Error('Perekaman gagal. Silakan coba kembali.'));
        rec.onstop=()=>resolve();
        // Hidden tabs throttle canvas capture; abort rather than deliver missing scenes.
        rec.start(1000);
        void audio.current!.play().catch(()=>reject(new Error('Audio gagal dimulai. Ekspor dibatalkan.')));
        timer=setInterval(()=>{
          if(document.hidden){reject(new Error('Ekspor dihentikan karena tab tidak aktif. Tetap buka tab ini selama ekspor 90 detik.'));return;}
          const elapsed=Math.min(DURATION,audio.current!.currentTime);
          renderFrame(ctx,elapsed);setProgress(Math.floor(elapsed/DURATION*100));
          if(elapsed>=DURATION){clearInterval(timer);rec.stop();}
        },1000/30);
      });
      if(cancelled) {setMessage('Ekspor dibatalkan.');return;}
      const blob=new Blob(chunks,{type:recorder.mimeType});if(!blob.size) throw new Error('Video kosong. Silakan ulangi ekspor.');
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='harapanedu-pengajar-pelajar-90-detik.mp4';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
      setMessage('MP4 selesai dibuat. Unduhan telah dimulai.');
    } catch(error) { setMessage(error instanceof Error?error.message:'Ekspor gagal. Silakan coba lagi.'); }
    finally {audio.current?.pause();if(audio.current)audio.current.currentTime=restorePosition;if(audioDestination){audioGraph.current?.gain.disconnect(audioDestination);audioDestination.stream.getTracks().forEach(track=>track.stop());}if(timer)clearInterval(timer);if(recorder && recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(track=>track.stop());cancelExport.current=null;setExporting(false);}
  }

  return <main className="mg-page">
    <audio ref={audio} src="/audio/harapanedu-motion-90s.wav" preload="auto" onError={()=>{audio.current?.pause();setPlaying(false);cancelExport.current?.();setMessage('Berkas musik gagal dimuat. Muat ulang halaman untuk mencoba kembali.');}} />
    <header className="mg-header"><a href="/" className="mg-brand"><span>H</span> HarapanEdu</a><span className="mg-edition">THE LEARNING SERIES / 01</span></header>
    <section className="mg-heading"><div><p className="mg-kicker">MENGENAL HARAPANEDU</p><h1>Dua peran.<br/><em>Satu perjalanan belajar.</em></h1></div><div className="mg-intro"><p>Kenali cara pengajar mengelola pembelajaran dan pelajar menjalani setiap langkahnya, dalam 90 detik.</p><button className="mg-download" onClick={download} disabled={exporting}><Download size={18}/>{exporting?`Mengekspor ${progress}%`:'Download MP4'}<ArrowUpRight size={18}/></button></div></section>
    <section className="mg-player" aria-label="Video penjelasan HarapanEdu"><div className="mg-player-top"><span><i/> SYSTEM WALKTHROUGH</span><span>01:30 · 720p · MUSIK + SFX</span></div><canvas ref={canvas} width={1280} height={720} role="img" aria-label={`${scenes[active].role}: ${scenes[active].caption}`}/><div className="mg-controls"><button disabled={exporting} onClick={togglePlayback} aria-label={playing?'Jeda':'Putar'}>{playing?<Pause size={20}/>:<Play size={20}/>}</button><button disabled={exporting} onClick={()=>{setPlaying(false);seek(0);}} aria-label="Ulangi dari awal"><RotateCcw size={18}/></button><input disabled={exporting} type="range" min={0} max={DURATION} step={0.1} value={time} aria-label="Posisi video" aria-valuetext={`${timestamp(time)} dari 01:30`} onChange={e=>seek(Number(e.target.value))}/><span>{timestamp(time)} <b>/ 01:30</b></span></div></section>
    <div className="mg-audio-controls"><button disabled={exporting} onClick={()=>setMuted(!muted)} aria-label={muted?'Aktifkan suara':'Bisukan suara'} aria-pressed={muted}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><label htmlFor="motion-volume">Volume musik & efek</label><input id="motion-volume" disabled={exporting} type="range" min="0" max="1" step="0.05" value={muted?0:volume} onChange={event=>{setVolume(Number(event.target.value));setMuted(false);}}/><span>{Math.round((muted?0:volume)*100)}%</span><small>Volume ini juga digunakan pada MP4.</small></div>
    <div className="mg-note"><p>Musik instrumental orisinal dengan efek transisi dan bunyi kemunculan kartu, tanpa narasi suara. Ekspor MP4 memerlukan sekitar 90 detik; biarkan tab ini tetap aktif.</p>{exporting&&<button onClick={()=>cancelExport.current?.()}>Batalkan ekspor</button>}</div>
    {message&&<p className="mg-status" role="status">{exporting?`Merekam MP4… ${progress}%`:message}</p>}
    <section className="mg-chapters" aria-label="Bab video"><div className="mg-section-title"><h2>Setiap langkah, terhubung.</h2><span>12 BAB / 90 DETIK</span></div><div className="mg-chapter-grid">{scenes.map((scene,index)=><button key={scene.start} disabled={exporting} aria-current={active===index?'step':undefined} onClick={()=>seek(scene.start)}><span className="mg-chapter-no">{String(index+1).padStart(2,'0')}</span><span><small>{scene.role}</small><strong>{scene.title.join(' ')}</strong></span><time>{timestamp(scene.start)}</time></button>)}</div></section>
    <details className="mg-transcript"><summary>Baca transkrip penjelasan</summary>{scenes.map(scene=><p key={scene.start}><strong>{timestamp(scene.start)} · {scene.role}</strong><br/>{scene.caption}</p>)}</details>
    <footer className="mg-footer"><span>HarapanEdu</span><span>Mengajar terarah. Belajar bertumbuh.</span></footer>
  </main>;
}
