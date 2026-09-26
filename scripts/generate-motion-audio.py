"""Generate an original 90-second instrumental and synchronized UI sound effects.
Run with Python + numpy. No external samples or recordings are used.
"""
from pathlib import Path
import wave
import numpy as np

RATE = 24000
DURATION = 90
mix = np.zeros((RATE * DURATION, 2), dtype=np.float64)
rng = np.random.default_rng(42)

def add(signal, start, level=1, pan=0):
    offset = round(start * RATE)
    length = min(len(signal), len(mix) - offset)
    if length <= 0:
        return
    mix[offset:offset+length, 0] += signal[:length] * level * np.sqrt((1-pan)/2)
    mix[offset:offset+length, 1] += signal[:length] * level * np.sqrt((1+pan)/2)

def note(midi, start, duration, level, pan=0, pad=False):
    t = np.arange(round(duration * RATE)) / RATE
    f = 440 * 2 ** ((midi-69)/12)
    tone = np.sin(2*np.pi*f*t) + .22*np.sin(2*np.pi*f*2*t) + .07*np.sin(2*np.pi*f*3*t)
    env = np.minimum(t/(.3 if pad else .012), 1) * np.minimum((duration-t)/(.6 if pad else .12), 1)
    if not pad:
        env *= np.exp(-t*3)
    add(tone * env, start, level, pan)

# 96 BPM: warm Cmaj7 / G / Am7 / Fmaj7, with a light plucked melody.
beat = 60/96
chords = [[48,55,59,64], [43,55,59,62], [45,52,55,60], [41,53,57,60]]
for bar, start in enumerate(np.arange(0, DURATION, beat*4)):
    chord = chords[bar % 4]
    for j, pitch in enumerate(chord):
        note(pitch, start, beat*4+.3, .045, (j-1.5)/3, True)
    for step in range(8):
        pitch = chord[[1,2,3,2,1,3,2,3][step]] + 12
        note(pitch, start+step*beat/2, .65, .065 if step % 2 == 0 else .04, .3*np.sin(step))
    for step in range(4):
        moment = start+step*beat
        t = np.arange(round(.18*RATE))/RATE
        kick = np.sin(2*np.pi*(48*t+5*(1-np.exp(-t*28))))*np.exp(-t*24)
        add(kick, moment, .12 if step % 2 == 0 else .06)
        t = np.arange(round(.07*RATE))/RATE
        noise = rng.normal(0,1,len(t)); noise = np.diff(noise, prepend=0)
        add(noise*np.exp(-t*80), moment+beat/2, .012, .25)

# Scene transition sweeps and three soft interface chimes per scene.
starts = [0,7,14,22,30,38,46,54,62,70,78,85]
for start in starts:
    t = np.arange(round(.48*RATE))/RATE
    noise = rng.normal(0,1,len(t))
    smooth = np.convolve(noise, np.ones(10)/10, mode='same')
    add(smooth*np.sin(np.pi*t/.48)**2, start, .12, -.15)
    for j in range(3):
        note([79,83,86][j], start+.35+j*.55, .3, .07, (j-1)*.35)

fade = np.minimum(np.arange(len(mix))/RATE/1.5,1) * np.minimum((DURATION-np.arange(len(mix))/RATE)/2.5,1)
mix *= fade[:,None]
mix = np.tanh(mix*1.6)
assert np.isfinite(mix).all()
assert np.max(np.abs(mix)) < 1
out = Path(__file__).resolve().parents[1]/'public/audio/harapanedu-motion-90s.wav'
with wave.open(str(out), 'wb') as file:
    file.setnchannels(2); file.setsampwidth(2); file.setframerate(RATE)
    file.writeframes((mix*32767).astype('<i2').tobytes())
print(f'{out.name}: {DURATION}s stereo; peak {np.max(np.abs(mix)):.3f}; {out.stat().st_size} bytes')
