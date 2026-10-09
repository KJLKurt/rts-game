#!/usr/bin/env python3
"""Starfall Outpost: two original sample-free science-fantasy pilot loops.

Portable, offline Python/NumPy/SciPy/FFmpeg source. All musical tables and voices
are newly authored. Utility conventions are adapted from the retained original
Hollow Lanterns tools. No old theme is imported, rendered or modified.
"""
from pathlib import Path
from dataclasses import dataclass, asdict
import argparse, hashlib, json, math, re, struct, subprocess, sys
import numpy as np
import scipy
from scipy.io.wavfile import write
from scipy.signal import butter, sosfilt

SR=44100; BPM=100; BEAT=60/BPM; TAU=2*np.pi; BARS=24; BEATS=BARS*4
FRAMES=round(BEATS*BEAT*SR); DURATION=FRAMES/SR; SEED=202610091525
BASE=Path(__file__).resolve().parent
TITLES={'exploration':'Signals Beyond the Pale Ridge','combat':'Hold the Starfall Line'}
TARGET={'exploration':-20.3,'combat':-19.7}
VOLUMES={'exploration':.72,'combat':.68}
KEYS={'exploration':'D major with Lydian color; B-minor middle',
      'combat':'D Dorian with an F-sharp passing tone; open fifths and suspended extensions'}

# New 24-bar harmonic forms, not transpositions of any retained bank.
EXP_HARMONY=[
 ('Dmaj9',38,[54,61,64,69]),('Aadd9/C#',37,[52,57,59,64]),
 ('E6/B',35,[56,59,61,64]),('Dmaj9/A',33,[54,57,61,64]),
 ('Bm11',35,[54,57,61,64]),('Amaj9',33,[56,59,61,64]),
 ('Eadd9/G#',32,[52,59,64,66]),('A6sus2',33,[52,57,59,66]),
 ('Bm9',35,[54,57,61,66]),('F#m7/A',33,[54,57,61,64]),
 ('Em9/G',31,[55,59,62,66]),('A13',33,[55,59,61,66]),
 ('Dmaj9/F#',30,[54,57,61,64]),('E6/G#',32,[56,59,61,64]),
 ('Bm11/A',33,[54,59,61,64]),('A6sus2',33,[52,57,59,66]),
 ('Dmaj9',38,[54,61,64,69]),('Aadd9/C#',37,[52,57,59,64]),
 ('E6/B',35,[56,59,61,64]),('Dmaj9/A',33,[54,57,61,64]),
 ('Bm11',35,[54,57,61,64]),('Eadd9/G#',32,[52,59,64,66]),
 ('A13sus4',33,[55,59,62,66]),('A6add9',33,[54,57,59,64]),
]
EXP_MELODY=[
 [(.25,74,.65),(1.5,76,.40),(2.25,81,.95),(3.5,80,.35)],
 [(.5,78,.85),(2,76,.50),(3,73,.65)],
 [(0,76,.65),(1.25,80,.65),(2.75,78,.90)],
 [(.75,76,.45),(1.5,73,.65),(2.75,74,.95)],
 [(.25,78,.70),(1.75,81,.45),(2.5,85,1.10)],
 [(.5,83,.60),(1.75,80,.70),(3,76,.65)],
 [(0,78,.70),(1.25,80,.45),(2,83,.70),(3.25,80,.50)],
 [(.5,78,.55),(1.5,76,.80),(3,73,.65)],
 [(.25,73,1.15),(1.75,74,.55),(2.75,78,.80)],
 [(.5,76,.85),(2,73,.55),(3,69,.60)],
 [(0,71,.55),(1,74,.75),(2.5,78,1.05)],
 [(.25,79,.75),(1.75,78,.50),(2.75,76,.95)],
 [(.5,78,.55),(1.5,81,.90),(3,78,.60)],
 [(0,80,.90),(1.75,78,.60),(3,76,.70)],
 [(.5,73,.65),(1.75,76,.50),(2.75,78,.85)],
 [(.25,76,.75),(1.75,71,.60),(3,73,.60)],
 [(.25,74,.65),(1.5,76,.40),(2.25,81,.65),(3.25,85,.50)],
 [(.5,83,.65),(1.75,80,.50),(2.75,78,.85)],
 [(0,80,.50),(1,83,.65),(2.5,88,1.10)],
 [(.5,85,.65),(1.75,81,.65),(3,78,.60)],
 [(.25,78,.70),(1.75,76,.45),(2.5,73,1.10)],
 [(.5,76,.60),(1.75,78,.70),(3,80,.65)],
 [(0,79,.65),(1.25,78,.55),(2.25,76,1.15)],
 [(.5,73,.70),(1.75,71,.55),(2.75,69,.55),(3.5,76,.30)],
]
COMBAT_HARMONY=[
 ('Dm9',38,[53,57,60,64]),('G6/B',35,[55,59,62,64]),
 ('Cmaj9',36,[55,59,62,64]),('Dm11/A',33,[53,55,60,62]),
 ('Dm9',38,[53,57,60,64]),('Em7/G',31,[55,59,62,64]),
 ('G6',31,[55,59,62,64]),('Am7',33,[55,57,60,64]),
 ('Fmaj7',29,[53,57,60,64]),('Cmaj9/E',28,[55,59,62,64]),
 ('G6',31,[55,59,62,64]),('Dm9/A',33,[53,57,60,64]),
 ('Dm11',38,[53,55,60,64]),('Cmaj9',36,[55,59,62,64]),
 ('G6/B',35,[55,59,62,64]),('Asus4(add9)',33,[55,59,62,64]),
 ('Dm9',38,[53,57,60,64]),('G6/B',35,[55,59,62,64]),
 ('Cmaj9',36,[55,59,62,64]),('Dm11/A',33,[53,55,60,62]),
 ('Fmaj7',29,[53,57,60,64]),('G6',31,[55,59,62,64]),
 ('Dm9/A',33,[53,57,60,64]),('Asus4(add9)',33,[55,59,62,64]),
]
COMBAT_MELODY=[
 [(0,74,.30),(.75,76,.30),(1.5,81,.40),(2.25,79,.30),(3,77,.65)],
 [(.25,79,.30),(1,83,.55),(2,81,.35),(2.75,79,.65)],
 [(0,84,.40),(.75,83,.30),(1.5,79,.60),(2.75,76,.70)],
 [(.25,77,.30),(1,76,.30),(1.75,74,.60),(3,69,.55)],
 [(0,74,.30),(.75,76,.30),(1.5,81,.40),(2.25,84,.30),(3,83,.65)],
 [(.25,83,.30),(1,79,.55),(2,78,.35),(2.75,76,.65)],
 [(0,79,.40),(.75,81,.30),(1.5,83,.60),(2.75,86,.70)],
 [(.25,84,.30),(1,81,.30),(1.75,79,.60),(3,76,.55)],
 [(0,77,.70),(1.25,81,.45),(2,84,.80),(3.25,81,.40)],
 [(.5,83,.60),(1.5,79,.60),(2.75,76,.80)],
 [(0,79,.70),(1.25,83,.45),(2,86,.80),(3.25,83,.40)],
 [(.5,81,.60),(1.5,77,.60),(2.75,74,.80)],
 [(0,76,.45),(.75,77,.45),(1.75,81,.60),(2.75,86,.70)],
 [(.25,84,.60),(1.25,83,.45),(2.25,79,1.10)],
 [(0,83,.45),(.75,81,.45),(1.75,79,.60),(2.75,74,.70)],
 [(.25,76,.60),(1.25,79,.45),(2.25,81,1.10)],
 [(0,74,.30),(.75,76,.30),(1.5,81,.40),(2.25,86,.30),(3,84,.65)],
 [(.25,83,.30),(1,86,.55),(2,83,.35),(2.75,79,.65)],
 [(0,84,.40),(.75,83,.30),(1.5,79,.60),(2.75,76,.70)],
 [(.25,77,.30),(1,81,.30),(1.75,79,.60),(3,74,.55)],
 [(0,77,.30),(.75,76,.30),(1.5,72,.40),(2.25,69,.30),(3,72,.65)],
 [(.25,74,.30),(1,79,.55),(2,81,.35),(2.75,83,.65)],
 [(0,81,.40),(.75,77,.30),(1.5,76,.60),(2.75,74,.70)],
 [(.25,76,.30),(1,79,.30),(1.75,81,.60),(3,76,.55)],
]

@dataclass
class Note:
    instrument:str
    beat:float
    midi:int
    duration:float
    velocity:float
    pan:float=0.

def composition(state):
    busy=state=='combat'; notes=[]; drums=[]
    harmony=COMBAT_HARMONY if busy else EXP_HARMONY
    melody=COMBAT_MELODY if busy else EXP_MELODY
    def add(ins,b,p,d,v,pan=0):notes.append(Note(ins,b,int(p),d,v,pan))
    for bar,(_,root,chord) in enumerate(harmony):
        b=bar*4; middle=8<=bar<16; returned=bar>=16
        for j,p in enumerate(chord):
            add('horizon_pad',b+.03,p,3.83,.043 if busy else (.052 if middle else .038),[-.30,-.10,.10,.30][j])
        if not busy:
            add('pulse_bass',b,root,1.28,.34)
            add('pulse_bass',b+2.5,root+12,.65,.22)
            # A hovering off-beat response, distinct from the lead's long arcs.
            for off,idx in ([(1,1),(3.25,2)] if middle else [(.875,2),(2.875,0)]):
                add('orbit_pluck',b+off,chord[idx]+12,.45,.13,-.29)
            for i,(off,p,d) in enumerate(melody[bar]):
                add('signal_pluck',b+off,p,d,.32*(1-.07*(i%2)),.16)
            if bar in [2,6,10,14,18,22]:
                add('beacon_sine',b+1.75,chord[2]+12,1.2,.10,-.22)
            if returned and bar%2==1:
                add('beacon_sine',b+.125,chord[0]+12,.8,.09,-.15)
            if bar%2==0:drums.append((b,'ion_kick',.13,0))
            for off in ([1.5,3.5] if middle else [3.5]):drums.append((b+off,'dust_tick',.065,.28))
        else:
            # Eighth-grid propulsion with 3+3+2 accents over the quarter pulse.
            for off,interval,d,v in [(0,0,.40,.33),(.75,0,.24,.18),(1.5,12,.36,.22),(2.5,0,.40,.29),(3.25,7,.30,.20)]:
                add('pulse_bass',b+off,root+interval,d,v)
            steps=[.5,1.25,2,2.75,3.5] if not middle else [.5,2,3.5]
            for i,off in enumerate(steps):
                add('orbit_pluck',b+off,chord[(bar+i)%4]+12,.22,.17 if i%2==0 else .12,-.25)
            for i,(off,p,d) in enumerate(melody[bar]):
                add('signal_pluck',b+off,p,d,.30*(1-.065*(i%3)),.12)
                if returned and i==0:add('beacon_sine',b+off,p-12,.60,.12,-.12)
            if middle and bar%2==0:add('beacon_sine',b+2.5,chord[2]+12,1.2,.11,.20)
            for off,v in [(0,.24),(1.5,.17),(2.5,.21)]:drums.append((b+off,'ion_kick',v,0))
            for off,v in [(1,.105),(3,.13)]:drums.append((b+off,'circuit_snap',v,-.10))
            for i,off in enumerate([.5,1,1.5,2,2.5,3,3.5]):
                drums.append((b+off,'dust_tick',.073 if i%2==0 else .042,.28))
            if bar%8==7:
                for off in [3.25,3.75]:drums.append((b+off,'circuit_snap',.065,-.20 if off==3.25 else .20))
    return notes,drums

def envelope(t,gate,attack,decay,sustain,release):
    a=np.minimum(t/attack,1)
    d=np.where(t>attack,sustain+(1-sustain)*np.exp(-(t-attack)/decay),1)
    r=np.where(t>gate,np.maximum(1-(t-gate)/release,0)**2,1)
    return a*d*r

def synth(n):
    gate=n.duration*BEAT
    release={'signal_pluck':.52,'orbit_pluck':.23,'horizon_pad':.65,'pulse_bass':.19,'beacon_sine':.45}[n.instrument]
    t=np.arange(round((gate+release)*SR))/SR;f=440*2**((n.midi-69)/12);p=TAU*f*t
    if n.instrument=='signal_pluck':
        # Light decaying FM sidebands above a stable harmonic fundamental.
        fm=.58*np.exp(-t/.13)*np.sin(2*p)
        y=np.sin(p+fm)*np.exp(-t/.58)+.19*np.sin(2*p)*np.exp(-t/.25)+.052*np.sin(3.006*p)*np.exp(-t/.34)
        y*=(1-np.exp(-t/.007))*np.where(t>gate,np.exp(-(t-gate)/.21),1)*.68
    elif n.instrument=='orbit_pluck':
        y=(np.sin(p+.35*np.sin(3*p)*np.exp(-t/.075))+.13*np.sin(2*p)*np.exp(-t/.12))*np.exp(-t/.19)
        y*=(1-np.exp(-t/.004))*np.where(t>gate,np.exp(-(t-gate)/.10),1)*.64
    elif n.instrument=='horizon_pad':
        y=np.zeros_like(t)
        for det,amp in [(.99935,.50),(1.00065,.50)]:
            pp=p*det;y+=amp*(np.sin(pp)+.085*np.sin(2*pp)+.036*np.sin(3*pp))
        y*=envelope(t,gate,.24,.70,.78,release)*(.98+.02*np.sin(TAU*.43*t))*.44
    elif n.instrument=='pulse_bass':
        y=np.sin(p)+.22*np.sin(2*p)*np.exp(-t/.20)+.045*np.sin(3*p)*np.exp(-t/.075)
        y*=envelope(t,gate,.009,.13,.30,release)*np.exp(-t/1.12)*.78
    elif n.instrument=='beacon_sine':
        y=np.sin(p+.028*np.sin(TAU*3.7*t))+.055*np.sin(2*p)
        y*=envelope(t,gate,.050,.30,.66,release)*.55
    else:raise ValueError(n.instrument)
    y*=n.velocity;ramp=min(96,len(y)//2)
    y[:ramp]*=np.linspace(0,1,ramp);y[-ramp:]*=np.linspace(1,0,ramp)
    return y.astype(np.float32)

def percussion(kind,velocity,rng):
    duration={'ion_kick':.26,'circuit_snap':.105,'dust_tick':.075}[kind]
    t=np.arange(round(duration*SR))/SR
    if kind=='ion_kick':
        phase=TAU*(61*t+57*.019*(1-np.exp(-t/.019)))
        y=np.sin(phase)*np.exp(-t/.057)*.78
    else:
        noise=rng.normal(0,1,len(t));lo,hi=(1050,5200) if kind=='circuit_snap' else (4300,8700)
        noise=sosfilt(butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),noise)
        if kind=='circuit_snap':y=(noise*np.exp(-t/.017)+.11*np.sin(TAU*820*t)*np.exp(-t/.012))*.52
        else:y=noise*np.exp(-t/.012)*.34
    y*=velocity;y[:48]*=np.linspace(0,1,48);y[-96:]*=np.linspace(1,0,96)
    return y.astype(np.float32)

def add_periodic(dest,signal,seconds,pan):
    start=round(seconds*SR)%len(dest);size=min(len(signal),len(dest)-start)
    for ch,g in enumerate([math.sqrt((1-pan)/2),math.sqrt((1+pan)/2)]):
        dest[start:start+size,ch]+=signal[:size]*g
        if size<len(signal):dest[:len(signal)-size,ch]+=signal[size:]*g

def periodic_filter(signal,sos):
    return sosfilt(sos,np.concatenate([signal[-SR:],signal]),axis=0)[SR:].astype(np.float32)

def sky_reflections(signal):
    # Restrained periodic reflections only on pitched upper instruments.
    # Bass, kick, snap and ticks stay dry and centered/controlled.
    wet=np.zeros_like(signal)
    for sec,amp,swap in [(.150,.080,True),(.300,.054,False),(.450,.035,True),(.750,.018,False)]:
        wet+=np.roll(signal[:,::-1] if swap else signal,round(sec*SR),axis=0)*amp
    return signal+periodic_filter(wet,butter(2,4600,fs=SR,output='sos'))

def loudness(path):
    run=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-20:TP=-3:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    m=re.search(r'\{\s*"input_i"[\s\S]+?\}',run.stderr)
    if not m:raise ValueError('Missing loudness measurements')
    v=json.loads(m.group())
    return {'integratedLUFS':float(v['input_i']),'truePeakDbTP':float(v['input_tp']),'loudnessRangeLU':float(v['input_lra'])}

def vlq(v):
    assert v>=0;out=[v&127];v>>=7
    while v:out.insert(0,(v&127)|128);v>>=7
    return bytes(out)

def midi_export(path,notes,drums,title):
    programs={'signal_pluck':10,'orbit_pluck':98,'horizon_pad':89,'pulse_bass':38,'beacon_sine':80}
    def chunk(events):
        prev=0;buf=bytearray()
        for tick,order,msg in sorted(events,key=lambda e:(e[0],e[1])):
            buf+=vlq(tick-prev)+msg;prev=tick
        buf+=vlq(BEATS*480-prev)+b'\xff\x2f\x00'
        return b'MTrk'+struct.pack('>I',len(buf))+buf
    def name(text):
        b=text.encode();return b'\xff\x03'+vlq(len(b))+b
    chunks=[chunk([(0,0,name(title)),(0,1,b'\xff\x51\x03'+int(60e6/BPM).to_bytes(3,'big')),(0,2,b'\xff\x58\x04\x04\x02\x18\x08')])]
    for channel,ins in enumerate(programs):
        events=[(0,0,name(ins)),(0,1,bytes([0xc0+channel,programs[ins]]))]
        evs=[n for n in notes if n.instrument==ins]
        pan=round(64+63*(sum(n.pan for n in evs)/len(evs)))
        events.append((0,2,bytes([0xb0+channel,10,pan])))
        for n in evs:
            events.extend([(round(n.beat*480),4,bytes([0x90+channel,n.midi,max(1,min(127,round(n.velocity*200)))])),(round((n.beat+n.duration)*480),3,bytes([0x80+channel,n.midi,0]))])
        chunks.append(chunk(events))
    events=[(0,0,name('Electronic kick, snap, tick (GM approximation)'))]
    for b,kind,v,pan in drums:
        key={'ion_kick':36,'circuit_snap':39,'dust_tick':42}[kind]
        events.extend([(round(b*480),2,bytes([0x99,key,max(1,round(v*250))])),(round(b*480)+40,1,bytes([0x89,key,0]))])
    chunks.append(chunk(events))
    path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(chunks),480)+b''.join(chunks))

def signal_metrics(path,state):
    meta=json.loads(subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=codec_name,sample_fmt,sample_rate,channels','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)['streams'][0]
    decoded=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True).stdout
    x=np.frombuffer(decoded,np.float32).reshape(-1,2).astype(np.float64)
    steps=np.abs(np.diff(x,axis=0));k=round(.02*SR)
    local_steps=np.r_[steps[:k],steps[-k:]]
    curvature=np.abs(np.r_[np.diff(x[:k],n=2,axis=0),np.diff(x[-k:],n=2,axis=0)])
    seam=x[0]-x[-1];delta=float(np.max(np.abs(seam)))
    bend=float(max(np.max(np.abs(seam-(x[-1]-x[-2]))),np.max(np.abs(x[1]-x[0]-seam))))
    rms=np.sqrt(np.mean(x**2));mono=x.mean(axis=1)
    windows=np.sqrt(np.mean(x[:len(x)//SR*SR].reshape(-1,SR,2)**2,axis=(1,2)))
    db=20*np.log10(np.maximum(windows,1e-12))
    result={'file':str(Path(path.parent.name)/path.name),'bytes':path.stat().st_size,
      'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'decodedPcmSha256':hashlib.sha256(decoded).hexdigest(),
      'codec':meta['codec_name'],'sampleRate':int(meta['sample_rate']),'channels':int(meta['channels']),
      'frames':len(x),'expectedFrames':FRAMES,'durationSeconds':len(x)/SR,'durationExact':len(x)==FRAMES,
      **loudness(path),'samplePeakDbFS':float(20*np.log10(np.max(np.abs(x)))),
      'rmsDbFS':float(20*np.log10(rms)),'crestDb':float(20*np.log10(np.max(np.abs(x))/rms)),
      'clippedSamples':int(np.count_nonzero(np.abs(x)>=1)),
      'dcOffsetMax':float(np.max(np.abs(np.mean(x,axis=0)))),'stereoCorrelation':float(np.corrcoef(x.T)[0,1]),
      'monoFoldDownDb':float(20*np.log10(np.sqrt(np.mean(mono**2))/rms)),
      'boundaryDelta':delta,'boundaryDeltaDbFS':float(20*np.log10(max(delta,1e-12))),
      'boundaryDeltaVsTrack99p':delta/max(float(np.quantile(steps,.99)),1e-12),
      'boundaryDeltaVsLocal99p':delta/max(float(np.quantile(local_steps,.99)),1e-12),
      'boundaryCurvature':bend,'boundaryCurvatureVsLocal99p':bend/max(float(np.quantile(curvature,.99)),1e-12),
      'join20msRmsDbBefore':float(20*np.log10(np.sqrt(np.mean(x[-k:]**2)))),
      'join20msRmsDbAfter':float(20*np.log10(np.sqrt(np.mean(x[:k]**2)))),
      'oneSecondRmsDb':{'min':float(db.min()),'max':float(db.max()),'range':float(np.ptp(db)),
        'standardDeviation':float(db.std()),'values':[round(float(v),3) for v in db]}}
    result['estimatedPostManifestLUFS']=result['integratedLUFS']+20*math.log10(VOLUMES[state])
    checks={'correctCodec':result['codec']=={'wav':'pcm_s16le','ogg':'vorbis','mp3':'mp3'}[path.suffix[1:]],
       'exactDuration':result['durationExact'],'stereo44100':result['sampleRate']==SR and result['channels']==2,
       'noClipping':result['clippedSamples']==0,'truePeakHeadroom':result['truePeakDbTP'] < -4,
       'loudnessTargetRange':-21.5<result['integratedLUFS']<-19.0,'dcBelow0001':result['dcOffsetMax']<.0001,
       'loopStepBelowTrack99p':result['boundaryDeltaVsTrack99p']<1,
       'monoLossBelow1dB':result['monoFoldDownDb']> -1}
    result['checks']={key:bool(value) for key,value in checks.items()};result['passed']=all(checks.values())
    return result

def melody_signature(phrase):return tuple((b,p-phrase[0][1],d) for b,p,d in phrase)

def distinction(reference_path):
    references=json.loads(reference_path.read_text());reports={}
    for bank,reference in references.items():
        tables=reference['tables'];old=[melody_signature(p) for p in tables['EXP_MELODY']+tables['COMBAT_MELODY']]
        reports[bank]={'sourceSha256':reference['sourceSha256'],
          'transpositionEquivalentCompleteMelodyBars':{state:[i+1 for i,p in enumerate(new) if melody_signature(p) in old] for state,new in [('exploration',EXP_MELODY),('combat',COMBAT_MELODY)]}}
    assert all(not bars for report in reports.values() for bars in report['transpositionEquivalentCompleteMelodyBars'].values())
    return {'method':'Compare every complete melody bar: relative pitches, exact onsets and durations, against both reference lead tables.',
      'limit':'Narrow mechanical check only. Not a music-catalog search or legal originality proof.','referenceBanks':reports}

def render(state,output):
    seed=SEED+sum(map(ord,state));rng=np.random.default_rng(seed)
    notes,drums=composition(state);pitched=np.zeros((FRAMES,2),np.float32);dry=np.zeros_like(pitched)
    for n in notes:add_periodic(dry if n.instrument=='pulse_bass' else pitched,synth(n),n.beat*BEAT,n.pan)
    for b,kind,vel,pan in drums:add_periodic(dry,percussion(kind,vel,rng),b*BEAT,pan)
    mix=sky_reflections(pitched)+dry
    for sos in (butter(2,36,btype='highpass',fs=SR,output='sos'),butter(2,8800,btype='lowpass',fs=SR,output='sos')):mix=periodic_filter(mix,sos)
    mix-=mix.mean(axis=0,dtype=np.float64).astype(np.float32)
    mix*=.10/np.sqrt(np.mean(mix**2))
    calibration=output/'evidence/intermediates'/f'{state}-calibration.wav';write(calibration,SR,mix)
    measured=loudness(calibration);gain=min(TARGET[state]-measured['integratedLUFS'],-4.8-measured['truePeakDbTP'])
    mix*=10**(gain/20)
    mix+=(rng.uniform(-.5,.5,mix.shape)+rng.uniform(-.5,.5,mix.shape)).astype(np.float32)/32768
    assert np.max(np.abs(mix))<1,'Do not clip or silently limit the master'
    pcm=np.rint(mix*32768).astype(np.int16);wav=output/'masters'/f'{state}.wav';write(wav,SR,pcm)
    for ext,args in [('ogg',['-codec:a','libvorbis','-q:a','5']),('mp3',['-codec:a','libmp3lame','-b:a','128k','-write_xing','1'])]:
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),'-map_metadata','-1',*args,'-fflags','+bitexact',str(output/'assets'/f'{state}.{ext}')],check=True)
    midi_export(output/'masters'/f'{state}.mid',notes,drums,TITLES[state])
    harmony=EXP_HARMONY if state=='exploration' else COMBAT_HARMONY;melody=EXP_MELODY if state=='exploration' else COMBAT_MELODY
    score={'suite':'Starfall Outpost','title':TITLES[state],'state':state,'key':KEYS[state],'bpm':BPM,'timeSignature':[4,4],
      'bars':BARS,'beats':BEATS,'durationSeconds':DURATION,'loop':True,'loopStart':0,'loopEnd':DURATION,'seed':seed,
      'form':['8-bar signal statement','8-bar lower contrasting horizon','8-bar expanded return'],
      'motif':('D-E rising fourth to A, G-sharp and F-sharp answer; breathing rests.' if state=='exploration' else 'D-E rising fourth to A, descending G-F answer; displaced eighth-grid accents.'),
      'harmony':[{'bar':i+1,'symbol':s,'bassMidi':r,'voicing':v} for i,(s,r,v) in enumerate(harmony)],
      'melody':melody,'notes':[asdict(n) for n in notes],
      'percussion':[{'beat':b,'instrument':k,'velocity':v,'pan':p} for b,k,v,p in drums],
      'midiLimit':'GM programs are editable approximations; only this Python synthesizer reproduces the authored master.'}
    (output/'masters'/f'{state}.score.json').write_text(json.dumps(score,indent=2)+'\n')
    result={'title':TITLES[state],'noteCount':len(notes),'percussionCount':len(drums),'renderGainDb':gain,
      'codecs':{ext:signal_metrics(output/('masters' if ext=='wav' else 'assets')/f'{state}.{ext}',state) for ext in ['wav','ogg','mp3']}}
    print(json.dumps({'state':state,'codecs':{ext:{k:r[k] for k in ['durationSeconds','integratedLUFS','truePeakDbTP','boundaryDeltaDbFS','boundaryDeltaVsLocal99p','boundaryCurvatureVsLocal99p','passed']} for ext,r in result['codecs'].items()}}),flush=True)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=BASE)
    p.add_argument('--track',choices=['all','exploration','combat'],default='all');p.add_argument('--verify-only',action='store_true')
    p.add_argument('--reference-tables',type=Path,default=BASE/'provenance/reference-melody-tables.json');args=p.parse_args()
    output=args.output.resolve()
    for d in ['masters','assets','evidence','evidence/intermediates','provenance']:(output/d).mkdir(exist_ok=True,parents=True)
    report_path=output/'validation.json';report=json.loads(report_path.read_text()) if report_path.exists() else {}
    report.update({'suite':'Starfall Outpost','pilotOnly':True,'bpm':BPM,'sampleRate':SR,
      'listeningStatus':'No subjective listening, browser/game execution or physical-device audition performed.',
      'toolchain':{'python':sys.version,'numpy':np.__version__,'scipy':scipy.__version__,
        'ffmpeg':subprocess.run(['ffmpeg','-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]},
      'composerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'distinction':distinction(args.reference_tables)})
    report.setdefault('tracks',{})
    for state in ['exploration','combat']:
        if args.track in ('all',state):
            if args.verify_only:
                notes,drums=composition(state)
                report['tracks'][state]={'title':TITLES[state],'noteCount':len(notes),'percussionCount':len(drums),
                  'codecs':{ext:signal_metrics(output/('masters' if ext=='wav' else 'assets')/f'{state}.{ext}',state) for ext in ['wav','ogg','mp3']}}
            else:report['tracks'][state]=render(state,output)
    report['allSignalChecksPassed']=all(r['passed'] for t in report['tracks'].values() for r in t['codecs'].values())
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    manifest={s:{'src':f'assets/{s}.ogg','fallback':f'assets/{s}.mp3','title':TITLES[s],'key':KEYS[s],'bpm':BPM,
      'bars':BARS,'timeSignature':[4,4],'duration':DURATION,'loop':True,'loopStart':0,'loopEnd':DURATION,'volume':VOLUMES[s]} for s in report['tracks']}
    (output/'pilot-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    if not report['allSignalChecksPassed']:raise SystemExit('Signal check failed; review validation.json')

if __name__=='__main__':main()
