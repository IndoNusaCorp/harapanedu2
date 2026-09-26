export const DURATION = 90;
export const scenes = [
  { start: 0, end: 7, role: 'HARAPANEDU', title: ['Ruang belajar.', 'Kesempatan baru.'], caption: 'HarapanEdu menghubungkan pengajar dan pelajar dalam satu sistem pembelajaran digital.', cards: ['Pengajar', 'Pelajar', 'Satu ruang pembelajaran'], tag: 'BELAJAR · MENGAJAR · TERHUBUNG' },
  { start: 7, end: 14, role: 'DUA PERAN', title: ['Berbeda peran,', 'satu tujuan.'], caption: 'Masuk ke akun sesuai peran. Pengajar mengelola pembelajaran, pelajar mengikuti kegiatan belajar.', cards: ['Pengajar → kelola pembelajaran', 'Pelajar → ikuti pembelajaran', 'Dasbor sesuai peran akun'], tag: '01 / MENGENAL SISTEM' },
  { start: 14, end: 22, role: 'PENGAJAR', title: ['Mulai dari', 'sebuah kelas.'], caption: 'Pengajar membuka Pekerjaan Saya untuk membuat kelas, mengatur informasi kelas, dan menambahkan materi.', cards: ['Buat kelas & mata pelajaran', 'Atur informasi dan jadwal', 'Unggah materi pembelajaran'], tag: '02 / KELOLA KELAS' },
  { start: 22, end: 30, role: 'PENGAJAR', title: ['Materi menjadi', 'aksi belajar.'], caption: 'Buat tugas dengan instruksi yang jelas, pilih kelas tujuan, lalu tentukan batas waktu pengumpulan.', cards: ['Tulis judul & instruksi tugas', 'Pilih kelas yang dituju', 'Tetapkan tenggat pengumpulan'], tag: '03 / BAGIKAN TUGAS' },
  { start: 30, end: 38, role: 'PENGAJAR', title: ['Tinjau jawaban.', 'Berikan arahan.'], caption: 'Periksa tugas yang dikumpulkan pelajar, lalu berikan nilai dan umpan balik sebagai arahan perbaikan.', cards: ['Buka pengumpulan tugas', 'Tinjau berkas jawaban', 'Simpan nilai & umpan balik'], tag: '04 / PENILAIAN' },
  { start: 38, end: 46, role: 'PENGAJAR + AI', title: ['Dibantu AI.', 'Diputuskan guru.'], caption: 'ScorpioAI membantu mengusulkan penilaian. Pengajar meninjau dan menyetujui hasil sebelum menyimpan nilai.', cards: ['Analisis jawaban dengan ScorpioAI', 'Tinjau usulan skor & feedback', 'Pengajar menyetujui nilai'], tag: '05 / SCORPIOAI' },
  { start: 46, end: 54, role: 'PELAJAR', title: ['Temukan kelas.', 'Mulai memahami.'], caption: 'Pelajar membuka Kelas Saya, melihat informasi dan jadwal kelas, lalu mengakses materi yang tersedia.', cards: ['Buka menu Kelas Saya', 'Lihat jadwal pembelajaran', 'Baca materi dari pengajar'], tag: '06 / AKSES PEMBELAJARAN' },
  { start: 54, end: 62, role: 'PELAJAR', title: ['Kerjakan.', 'Lalu kumpulkan.'], caption: 'Buka detail tugas, baca instruksi dan tenggatnya, kemudian unggah jawaban untuk diperiksa pengajar.', cards: ['Baca instruksi & batas waktu', 'Kerjakan dan unggah jawaban', 'Pantau status pengumpulan'], tag: '07 / PENGUMPULAN TUGAS' },
  { start: 62, end: 70, role: 'PELAJAR', title: ['Lihat hasil.', 'Terus berkembang.'], caption: 'Setelah dinilai pengajar, pelajar dapat melihat nilai dan umpan balik untuk memahami bagian yang perlu diperbaiki.', cards: ['Buka menu Nilai', 'Pelajari umpan balik pengajar', 'Gunakan hasil untuk belajar lagi'], tag: '08 / NILAI & UMPAN BALIK' },
  { start: 70, end: 78, role: 'BELAJAR BERSAMA AI', title: ['Ada pertanyaan?', 'Ada LibraAI.'], caption: 'LibraAI membantu pelajar memahami materi dan membantu pengajar menyiapkan ide pembelajaran.', cards: ['Pelajar → tanyakan materi', 'LibraAI → bantuan penjelasan', 'Pengajar → ide & rencana belajar'], tag: '09 / ASISTEN PEMBELAJARAN' },
  { start: 78, end: 85, role: 'TETAP TERHUBUNG', title: ['Atur waktu.', 'Bertemu bersama.'], caption: 'Kalender membantu memantau kegiatan. Fitur pertemuan mendukung interaksi pengajar dan pelajar secara daring.', cards: ['Pantau kegiatan di kalender', 'Lihat jadwal pertemuan', 'Ikuti pembelajaran daring'], tag: '10 / JADWAL & PERTEMUAN' },
  { start: 85, end: 90, role: 'HARAPANEDU', title: ['Mengajar terarah.', 'Belajar bertumbuh.'], caption: 'Dari materi hingga umpan balik, HarapanEdu menghubungkan setiap langkah pembelajaran.', cards: ['Pengajar membimbing', 'Pelajar berkembang', 'HarapanEdu menghubungkan'], tag: 'SATU SISTEM · DUA PERAN · SATU TUJUAN' },
];
export function sceneAt(time: number) { return scenes.findIndex(s => time < s.end) < 0 ? scenes.length - 1 : scenes.findIndex(s => time < s.end); }
export function timestamp(time: number) { return `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`; }

export function renderFrame(ctx: CanvasRenderingContext2D, time: number) {
  const index = sceneAt(time), scene = scenes[index];
  const local = Math.max(0, time - scene.start);
  const accent = scene.role.startsWith('PENGAJAR') ? '#c2a5ff' : '#86efcf';
  const box = (x: number, y: number, w: number, h: number, r: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill(); };
  const text = (s: string, x: number, y: number, size: number, color = '#f5f5ff', weight = 500) => { ctx.font = `${weight} ${size}px Arial, sans-serif`; ctx.fillStyle = color; ctx.fillText(s,x,y); };
  ctx.clearRect(0,0,1280,720);
  const bg = ctx.createLinearGradient(0,0,1280,720); bg.addColorStop(0,'#111a30'); bg.addColorStop(1,'#242142'); ctx.fillStyle = bg; ctx.fillRect(0,0,1280,720);
  ctx.strokeStyle = '#ffffff08'; ctx.lineWidth = 1;
  for(let x=0;x<1280;x+=64) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,720);ctx.stroke(); }
  for(let y=0;y<720;y+=64) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1280,y);ctx.stroke(); }
  const glow = ctx.createRadialGradient(1000,280,0,1000,280,490); glow.addColorStop(0,scene.role.startsWith('PENGAJAR')?'#9875ff22':'#58ddb522'); glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(0,0,1280,720);
  box(56,43,36,36,10,accent);text('H',64,69,24,'#14283a',800);text('HarapanEdu',105,69,25,'#ffffff',700);text('SYSTEM WALKTHROUGH',939,66,15,'#a7b3ca',600);
  ctx.save(); const entrance = 1-Math.pow(1-Math.min(1,(local+0.4)/0.8),3);ctx.globalAlpha=entrance;ctx.translate(0,(1-entrance)*24);
  text(scene.tag,58,170,16,accent,700);
  scene.title.forEach((line,i)=>text(line,56,260+i*68,55,i===1?accent:'#f5f5ff',700));
  box(58,385,200,38,19,'#ffffff10');text(scene.role,74,410,14,accent,700);
  text('Kenali cara kerja HarapanEdu',58,477,18,'#9eabc3');
  box(682,145,542,385,24,'#ffffff0b');box(702,165,502,48,12,'#ffffff08');
  text(scene.role.startsWith('PENGAJAR')?'Ruang pengajar':scene.role==='PELAJAR'?'Ruang pelajar':'Ekosistem pembelajaran',722,196,19,'#e4e8f4',600);
  [0,1,2].forEach(i=>{const reveal=Math.max(0,Math.min(1,(local-.35-i*.55)/.6));ctx.save();ctx.globalAlpha*=reveal;const y=234+i*90;box(704+(1-reveal)*20,y,498,74,14,'#ffffff09');box(720,y+17,40,40,12,accent);text(String(i+1).padStart(2,'0'),729,y+43,18,'#17233b',700);text(scene.cards[i],778,y+44,20,'#eef2ff',600);ctx.restore();});
  ctx.restore();
  box(56,560,1168,100,18,'#080e1d99');
  const words=scene.caption.split(' ');let line='',y=598;for(const word of words){ctx.font='23px Arial';const next=line+word+' ';if(ctx.measureText(next).width>1080){text(line.trim(),82,y,23,'#e0e5ef');line=word+' ';y+=32;}else line=next;}text(line.trim(),82,y,23,'#e0e5ef');
  box(56,687,1168,3,1,'#ffffff20');box(56,687,Math.max(1,1168*time/DURATION),3,1,accent);
  text(`${String(index+1).padStart(2,'0')} / 12`,56,548,13,'#9eabc3');text(`${timestamp(time)} / 01:30`,1108,548,14,'#9eabc3');
}
