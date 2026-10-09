#!/usr/bin/env python3
"""Hollow Lanterns: two original sample-free, 96 BPM pilot loops.

All note tables and synthesized voices are new for this pilot. No recording,
soundfont, instrument/sample library, pretrained audio model or network is used.
Engineering conventions (periodic tail mixing, filtering, loudness analysis and
GM export) follow the read-only Frontier/Mythic composers; no audio is imported.
Outputs are restricted to this pilot folder or a descendant.
"""
from pathlib import Path
from dataclasses import dataclass, asdict
import argparse, hashlib, json, math, re, struct, subprocess, sys
import numpy as np
import scipy
from scipy.io.wavfile import write
from scipy.signal import butter, sosfilt

SR=44100; BPM=96; BEAT=60/BPM; TAU=2*np.pi; BARS=24; BEATS=BARS*4
FRAMES=round(BEATS*BEAT*SR); SEED=202610091406
BASE=Path(__file__).resolve().parent
TITLES={'exploration':'Lanterns Through the Pumpkin Rows','combat':'The Scarecrow Procession'}
TARGET={'exploration':-20.2,'combat':-19.6}
VOLUMES={'exploration':.72,'combat':.68}
KEY='G minor, with harmonic-minor turns and E-flat Lydian color'

# Twenty-four separately authored bars: wandering A, warmer B, altered A return.
EXP_HARMONY=[
 ('Gm(add9)',43,[55,58,62,69]),('Ebmaj7/G',43,[55,58,62,63]),
 ('Cm6',48,[55,57,60,63]),('D7(b9)',38,[54,60,63,69]),
 ('Gm/Bb',46,[55,58,62,67]),('F6/A',45,[53,57,60,62]),
 ('Ebmaj7',39,[55,58,62,63]),('D7',38,[54,57,60,62]),
 ('Ebmaj7(#11)',39,[55,57,62,63]),('Bb/D',38,[53,58,62,65]),
 ('Cm(add9)',48,[55,60,62,63]),('F7',41,[57,60,63,65]),
 ('Bbmaj7',46,[53,57,62,65]),('Gm/D',38,[55,58,62,67]),
 ('Aø7',45,[55,57,60,63]),('D7(b9)',38,[54,60,63,69]),
 ('Gm(add9)',43,[55,58,62,69]),('Eb/G',43,[55,58,63,67]),
 ('Cm6',48,[55,57,60,63]),('D7/F#',42,[54,57,60,62]),
 ('Gm/Bb',46,[55,58,62,67]),('Ebmaj7',39,[55,58,62,63]),
 ('Cm6/D',38,[55,57,60,63]),('D7(b9)',38,[54,60,63,69]),
]
EXP_MELODY=[
 [(0,67,.28),(.5,70,.35),(1.25,69,.60),(2.5,75,.48),(3.25,74,.48)],
 [(.25,70,.52),(1,67,.33),(1.75,62,.70),(3.25,67,.45)],
 [(0,72,.40),(.625,75,.32),(1.5,74,.70),(2.75,69,.85)],
 [(.25,66,.35),(1,69,.50),(2,63,.28),(2.5,62,1.15)],
 [(0,70,.40),(.625,74,.35),(1.5,72,.70),(2.75,67,.78)],
 [(.5,69,.55),(1.5,65,.38),(2.25,62,.50),(3.125,65,.60)],
 [(0,67,.35),(.5,70,.33),(1.25,74,.70),(2.75,75,.70)],
 [(.25,69,.42),(1,66,.50),(2,62,.68),(3.375,66,.28)],
 [(0,75,1.25),(1.625,74,.65),(2.625,69,.85)],
 [(.375,70,.70),(1.5,77,.50),(2.375,74,1.15)],
 [(0,75,.55),(.875,74,.35),(1.5,72,.75),(2.75,67,.90)],
 [(.375,69,.52),(1.25,72,.70),(2.375,75,1.10)],
 [(0,77,.62),(1,74,.48),(1.875,70,.85),(3.25,69,.43)],
 [(.375,70,1.1),(1.875,67,.62),(2.875,62,.85)],
 [(0,63,.50),(.875,67,.55),(1.75,69,.60),(2.875,72,.85)],
 [(.375,69,.50),(1.25,66,.40),(2,63,.55),(3.125,62,.65)],
 [(0,67,.28),(.5,70,.35),(1.25,69,.60),(2.5,74,.48),(3.25,79,.48)],
 [(.25,75,.52),(1,74,.33),(1.75,70,.70),(3.25,67,.45)],
 [(0,72,.40),(.625,69,.32),(1.5,75,.70),(2.75,74,.85)],
 [(.25,69,.35),(1,66,.50),(2,63,.28),(2.5,62,1.15)],
 [(0,70,.40),(.625,67,.35),(1.5,62,.70),(2.75,67,.78)],
 [(.5,70,.55),(1.5,74,.38),(2.25,75,.50),(3.125,74,.60)],
 [(0,72,.35),(.5,69,.33),(1.25,67,.70),(2.75,63,.70)],
 [(.25,62,.42),(1,66,.50),(2,69,.68),(3.375,66,.28)],
]
COMBAT_HARMONY=[
 ('Gm',43,[55,58,62,67]),('D7/F#',42,[54,57,60,62]),
 ('Ebmaj7',39,[55,58,62,63]),('D7(b9)',38,[54,60,63,69]),
 ('Gm',43,[55,58,62,67]),('Cm6/G',43,[55,57,60,63]),
 ('Aø7',45,[55,57,60,63]),('D7',38,[54,57,60,62]),
 ('Cm',48,[55,60,63,67]),('Abmaj7',44,[55,60,63,68]),
 ('Eb/G',43,[55,58,63,67]),('D7/F#',42,[54,57,60,62]),
 ('Gm/D',38,[55,58,62,67]),('Ebmaj7',39,[55,58,62,63]),
 ('Cm6',48,[55,57,60,63]),('D7(b9)',38,[54,60,63,69]),
 ('Gm',43,[55,58,62,67]),('D7/F#',42,[54,57,60,62]),
 ('Ebmaj7',39,[55,58,62,63]),('D7',38,[54,57,60,62]),
 ('Gm/Bb',46,[55,58,62,67]),('Cm6',48,[55,57,60,63]),
 ('Aø7/D',38,[55,57,60,63]),('D7(b9)',38,[54,60,63,69]),
]
COMBAT_MELODY=[
 [(0,67,.25),(.375,67,.25),(1,70,.38),(1.625,69,.28),(2.25,63,.46),(3,62,.62)],
 [(.125,66,.40),(.875,69,.28),(1.5,74,.68),(2.625,72,.42),(3.375,69,.32)],
 [(0,70,.28),(.5,74,.32),(1.125,75,.58),(2.125,74,.32),(2.75,67,.75)],
 [(.25,69,.35),(1,66,.32),(1.625,63,.55),(2.625,62,.80)],
 [(0,67,.25),(.375,70,.25),(1,74,.38),(1.625,72,.28),(2.25,70,.46),(3,67,.62)],
 [(.125,69,.40),(.875,72,.28),(1.5,75,.68),(2.625,74,.42),(3.375,72,.32)],
 [(0,69,.28),(.5,72,.32),(1.125,75,.58),(2.125,72,.32),(2.75,67,.75)],
 [(.25,66,.35),(1,69,.32),(1.625,74,.55),(2.625,66,.80)],
 [(0,72,.45),(.75,75,.45),(1.5,79,.80),(2.875,75,.70)],
 [(.25,80,.55),(1.125,79,.30),(1.75,75,.70),(2.875,72,.70)],
 [(0,79,.45),(.75,75,.45),(1.5,74,.80),(2.875,70,.70)],
 [(.25,72,.55),(1.125,69,.30),(1.75,66,.70),(2.875,62,.70)],
 [(0,67,.45),(.75,70,.45),(1.5,74,.80),(2.875,79,.70)],
 [(.25,75,.55),(1.125,74,.30),(1.75,70,.70),(2.875,67,.70)],
 [(0,69,.45),(.75,72,.45),(1.5,75,.80),(2.875,74,.70)],
 [(.25,69,.55),(1.125,66,.30),(1.75,63,.70),(2.875,62,.70)],
 [(0,67,.25),(.375,67,.25),(1,70,.38),(1.625,74,.28),(2.25,75,.46),(3,74,.62)],
 [(.125,72,.40),(.875,69,.28),(1.5,66,.68),(2.625,69,.42),(3.375,74,.32)],
 [(0,75,.28),(.5,74,.32),(1.125,70,.58),(2.125,67,.32),(2.75,70,.75)],
 [(.25,69,.35),(1,66,.32),(1.625,62,.55),(2.625,69,.80)],
 [(0,70,.25),(.375,67,.25),(1,62,.38),(1.625,67,.28),(2.25,70,.46),(3,74,.62)],
 [(.125,75,.40),(.875,74,.28),(1.5,72,.68),(2.625,69,.42),(3.375,67,.32)],
 [(0,69,.28),(.5,72,.32),(1.125,75,.58),(2.125,72,.32),(2.75,63,.75)],
 [(.25,62,.35),(1,66,.32),(1.625,69,.55),(2.625,66,.80)],
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
    harmony=EXP_HARMONY if state=='exploration' else COMBAT_HARMONY
    melody=EXP_MELODY if state=='exploration' else COMBAT_MELODY
    notes=[]; drums=[]
    def add(ins,beat,pitch,duration,vel,pan=0):
        notes.append(Note(ins,beat,int(pitch),duration,vel,pan))
    for bar,(_,root,chord) in enumerate(harmony):
        b=bar*4; middle=8<=bar<16; ending=bar>=16; busy=state=='combat'
        # No broad orchestra pad: soft organ-like air between dry wood attacks.
        for j,p in enumerate(chord):
            add('reed_air',b+.08,p,3.60,.052 if busy else (.065 if middle else .044),(-.36,-.12,.12,.36)[j])
        if not busy:
            for off,p,d,v in [(0,root,.85,.35),(2.25,root+12,.55,.20)]:
                add('plucked_bass',b+off,p,d,v)
            # Irregular tiny wood answers leave room for the tune.
            for off,idx in ([(.875,1),(2,2)] if middle else [(1.875,2),(2.875,1)]):
                add('jackbox',b+off,chord[idx],.34,.17,-.28)
            lead='reed' if middle else 'jackbox'
            for i,(off,p,d) in enumerate(melody[bar]):
                add(lead,b+off,p,d, (.30 if middle else .41)*(1-.05*(i%3)), .08 if middle else .18)
            if bar%4==2:
                add('glass',b+.75,chord[-1]+12,1.10,.12,-.36)
            if ending and bar%2==1:
                add('reed',b+.5,chord[1],.70,.16,-.10)
            if bar%2==0: drums.append((b,'gourd',.13,-.03))
            for off in ([1.25,3.25] if middle else [3.25]):
                drums.append((b+off,'seeds',.063,.25))
        else:
            # A staggered 2+2 half-beat march, different from Mythic's 3+3+2.
            for off,p,d,v in [(0,root,.40,.34),(1,root+12,.30,.22),(2,root,.40,.32),(3.25,root+7,.31,.21)]:
                add('plucked_bass',b+off,p,d,v)
            for i,off in enumerate([.25,.75,1.75,2.25,2.75,3.75] if not middle else [.75,1.75,2.75,3.75]):
                add('jackbox',b+off,chord[(i+bar)%4],.24,.19 if i%2==0 else .13,-.27)
            for i,(off,p,d) in enumerate(melody[bar]):
                add('reed',b+off,p,d,.32*(1-.05*(i%3)),.07)
                if ending and i in (0,3): add('jackbox',b+off,p-12,.27,.16,.26)
            if middle and bar%2==0:
                add('glass',b+.25,chord[-1]+12,.90,.14,.30)
            for off,v in [(0,.25),(2,.22)]:drums.append((b+off,'gourd',v,0))
            for off,v in [(1,.14),(3,.12)]:drums.append((b+off,'twig',v,-.17))
            for off in [.5,1.5,2.5,3.5]:drums.append((b+off,'seeds',.08 if off==.5 else .055,.25))
            if bar%8==7:
                for off in (3.5,3.75):drums.append((b+off,'gourd',.11,-.1 if off==3.5 else .1))
    return notes,drums

def envelope(t,gate,attack,decay,sustain,release):
    a=np.minimum(t/attack,1)
    d=np.where(t>attack,sustain+(1-sustain)*np.exp(-(t-attack)/decay),1)
    r=np.where(t>gate,np.maximum(1-(t-gate)/release,0)**2,1)
    return a*d*r

def synth(n):
    gate=n.duration*BEAT
    release={'jackbox':.31,'reed':.14,'glass':1.05,'reed_air':.48,'plucked_bass':.17}[n.instrument]
    t=np.arange(round((gate+release)*SR))/SR; f=440*2**((n.midi-69)/12); p=TAU*f*t
    if n.instrument=='jackbox':
        # Modal wooden resonator. Soft 3 ms mallet, quick bright upper modes.
        y=sum(a*np.sin(r*p+q)*np.exp(-t/tau) for r,a,tau,q in
              [(1,1,.36,0),(2.756,.19,.10,.12),(5.404,.061,.049,.26),(8.933,.018,.027,0)])
        y*=(1-np.exp(-t/.0035))*np.where(t>gate,np.exp(-(t-gate)/.11),1)*.66
    elif n.instrument=='reed':
        # Odd-partial emphasis and small delayed vibrato, no recorded breath.
        pv=p+.055*np.sin(TAU*5.2*t)*(1-np.exp(-t/.32))
        y=sum(a*np.sin(k*pv+.025*k) for k,a in [(1,1),(2,.09),(3,.34),(4,.045),(5,.14),(7,.064),(9,.027)])
        y*=envelope(t,gate,.021,.085,.73,release)*.46
    elif n.instrument=='glass':
        y=sum(a*np.sin(r*p)*np.exp(-t/tau) for r,a,tau in
              [(1,1,.83),(2.001,.20,.55),(2.76,.065,.28),(4.02,.028,.16)])
        y*=(1-np.exp(-t/.012))*np.where(t>gate,np.exp(-(t-gate)/.36),1)*.43
    elif n.instrument=='reed_air':
        y=np.zeros_like(t)
        for det,amp in [(.9991,.48),(1.0009,.52)]:
            pp=p*det
            y+=amp*(np.sin(pp)+.21*np.sin(3*pp)+.06*np.sin(5*pp))
        y*=envelope(t,gate,.12,.65,.69,release)*(.98+.02*np.sin(TAU*.61*t))*.33
    elif n.instrument=='plucked_bass':
        pp=p+.04*np.exp(-t/.025)
        y=(np.sin(pp)+.27*np.sin(2*pp)*np.exp(-t/.14)+.055*np.sin(4*pp)*np.exp(-t/.045))
        y*=envelope(t,gate,.008,.12,.25,release)*np.exp(-t/.8)*.69
    else:raise ValueError(n.instrument)
    y*=n.velocity
    ramp=min(96,len(y)//2); y[:ramp]*=np.linspace(0,1,ramp);y[-ramp:]*=np.linspace(1,0,ramp)
    return y.astype(np.float32)

def percussion(kind,velocity,rng):
    dur={'gourd':.28,'twig':.095,'seeds':.115}[kind]
    t=np.arange(round(dur*SR))/SR
    if kind=='gourd':
        phase=TAU*(78*t+17*.028*(1-np.exp(-t/.028)))
        y=(np.sin(phase)*np.exp(-t/.065)+.28*np.sin(1.61*phase)*np.exp(-t/.029)+.08*np.sin(2.34*phase)*np.exp(-t/.018))*.70
    else:
        noise=rng.normal(0,1,len(t))
        lo,hi=(1700,4800) if kind=='twig' else (3500,7200)
        noise=sosfilt(butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),noise)
        if kind=='twig':y=(noise*np.exp(-t/.012)+.23*np.sin(TAU*1340*t)*np.exp(-t/.01))*.45
        else:y=noise*(1-np.exp(-t/.006))*np.exp(-t/.025)*(.75+.25*np.sin(TAU*38*t))*.38
    y*=velocity;y[:64]*=np.linspace(0,1,64);y[-96:]*=np.linspace(1,0,96)
    return y.astype(np.float32)

def add_periodic(dest,signal,seconds,pan):
    start=round(seconds*SR)%len(dest); size=min(len(signal),len(dest)-start)
    for ch,g in enumerate([math.sqrt((1-pan)/2),math.sqrt((1+pan)/2)]):
        dest[start:start+size,ch]+=signal[:size]*g
        if size<len(signal):dest[:len(signal)-size,ch]+=signal[size:]*g

def periodic_filter(signal,sos):
    return sosfilt(sos,np.concatenate([signal[-SR:],signal]),axis=0)[SR:].astype(np.float32)

def room(signal):
    wet=np.zeros_like(signal)
    for sec,amp,swap in [(.031,.10,False),(.071,.087,True),(.113,.066,False),(.181,.050,True),(.263,.037,False),(.359,.026,True),(.467,.018,False),(.617,.010,True)]:
        wet+=np.roll(signal[:,::-1] if swap else signal,round(sec*SR),axis=0)*amp
    wet=periodic_filter(wet,butter(2,4200,fs=SR,output='sos'))
    return signal+wet

def loudness(path):
    run=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-20:TP=-3:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    m=re.search(r'\{\s*"input_i"[\s\S]+?\}',run.stderr)
    if not m:raise ValueError('Missing loudness measurements')
    v=json.loads(m.group())
    return {'integratedLUFS':float(v['input_i']),'truePeakDbTP':float(v['input_tp']),'loudnessRangeLU':float(v['input_lra'])}

def vlq(v):
    out=[v&127];v>>=7
    while v:out.insert(0,(v&127)|128);v>>=7
    return bytes(out)

def midi_export(path,notes,drums,title):
    programs={'jackbox':15,'reed':70,'glass':11,'reed_air':20,'plucked_bass':32}
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
    events=[(0,0,name('gourd, twig, seeds (GM approximation)'))]
    for b,kind,v,pan in drums:
        key={'gourd':64,'twig':76,'seeds':70}[kind]
        events.extend([(round(b*480),2,bytes([0x99,key,max(1,round(v*250))])),(round(b*480)+40,1,bytes([0x89,key,0]))])
    chunks.append(chunk(events))
    path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(chunks),480)+b''.join(chunks))

def signal_metrics(path):
    meta=json.loads(subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=codec_name,sample_fmt,sample_rate,channels','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)['streams'][0]
    decoded=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True).stdout
    x=np.frombuffer(decoded,np.float32).reshape(-1,2).astype(np.float64)
    steps=np.abs(np.diff(x,axis=0)); k=round(.02*SR)
    local_steps=np.r_[steps[:k],steps[-k:]]
    curvature=np.abs(np.r_[np.diff(x[:k],n=2,axis=0),np.diff(x[-k:],n=2,axis=0)])
    seam=x[0]-x[-1]; delta=float(np.max(np.abs(seam)))
    bend=float(max(np.max(np.abs(seam-(x[-1]-x[-2]))),np.max(np.abs(x[1]-x[0]-seam))))
    rms=np.sqrt(np.mean(x**2));mono=x.mean(axis=1)
    windows=np.sqrt(np.mean(x.reshape(-1,SR,2)**2,axis=(1,2)))
    db=20*np.log10(np.maximum(windows,1e-12))
    result={'file':str(path.relative_to(BASE)) if path.is_relative_to(BASE) else str(path),
      'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'decodedPcmSha256':hashlib.sha256(decoded).hexdigest(),'codec':meta['codec_name'],
      'sampleRate':int(meta['sample_rate']),'channels':int(meta['channels']),
      'frames':len(x),'expectedFrames':FRAMES,'durationSeconds':len(x)/SR,'durationExact':len(x)==FRAMES,
      **loudness(path),'samplePeakDbFS':20*np.log10(np.max(np.abs(x))),
      'rmsDbFS':20*np.log10(rms),'crestDb':20*np.log10(np.max(np.abs(x))/rms),
      'clippedSamples':int(np.count_nonzero(np.abs(x)>=1)),
      'dcOffsetMax':float(np.max(np.abs(np.mean(x,axis=0)))),
      'stereoCorrelation':float(np.corrcoef(x.T)[0,1]),
      'monoFoldDownDb':20*np.log10(np.sqrt(np.mean(mono**2))/rms),
      'boundaryDelta':delta,'boundaryDeltaDbFS':20*np.log10(max(delta,1e-12)),
      'boundaryDeltaVsTrack99p':delta/max(float(np.quantile(steps,.99)),1e-12),
      'boundaryDeltaVsLocal99p':delta/max(float(np.quantile(local_steps,.99)),1e-12),
      'boundaryCurvature':bend,'boundaryCurvatureVsLocal99p':bend/max(float(np.quantile(curvature,.99)),1e-12),
      'join20msRmsDbBefore':20*np.log10(np.sqrt(np.mean(x[-k:]**2))),
      'join20msRmsDbAfter':20*np.log10(np.sqrt(np.mean(x[:k]**2))),
      'oneSecondRmsDb':{'min':float(db.min()),'max':float(db.max()),'range':float(np.ptp(db)),'standardDeviation':float(db.std()),'values':[round(float(v),3) for v in db]}}
    checks={'correctCodec':result['codec']=={'wav':'pcm_s16le','ogg':'vorbis','mp3':'mp3'}[path.suffix[1:]],
       'exactDuration':result['durationExact'],'stereo44100':result['sampleRate']==SR and result['channels']==2,
       'noClipping':result['clippedSamples']==0,'truePeakHeadroom':result['truePeakDbTP'] < -3.5,
       'loudnessTargetRange':-21<result['integratedLUFS']<-18.8,'dcBelow0001':result['dcOffsetMax']<.0001,
       'loopStepBelowTrack99p':result['boundaryDeltaVsTrack99p']<1,
       'monoLossBelow1dB':result['monoFoldDownDb']> -1}
    checks={key:bool(value) for key,value in checks.items()}
    result['checks']=checks;result['passed']=all(checks.values())
    return result

def melody_signature(phrase):
    return tuple((b,p-phrase[0][1],d) for b,p,d in phrase)

def distinction():
    # Read-only reference tables are copied as provenance, never synthesized.
    references=json.loads((BASE/'provenance/reference-melody-tables.json').read_text())
    reports={}
    for bank,reference in references.items():
        tables=reference['tables']
        old=[melody_signature(p) for p in tables['EXP_MELODY']+tables['COMBAT_MELODY']]
        reports[bank]={'sourceSha256':reference['sourceSha256'],
          'transpositionEquivalentCompleteMelodyBars':{state:[i+1 for i,p in enumerate(new) if melody_signature(p) in old] for state,new in [('exploration',EXP_MELODY),('combat',COMBAT_MELODY)]}}
    assert all(not bars for report in reports.values() for bars in report['transpositionEquivalentCompleteMelodyBars'].values())
    return {'method':'Compare each complete bar: relative pitches, exact onsets and durations, against both reference lead tables.',
      'limit':'Limited mechanical distinction check. Not a music-catalog similarity search or proof of legal originality.',
      'referenceBanks':reports}

def render(state,output):
    seed=SEED+sum(map(ord,state));rng=np.random.default_rng(seed)
    notes,drums=composition(state);mix=np.zeros((FRAMES,2),np.float32)
    for n in notes:
        # Fixed score placement; no random tempo offsets. Exact loop pulse.
        add_periodic(mix,synth(n),n.beat*BEAT,n.pan)
    for b,kind,vel,pan in drums:add_periodic(mix,percussion(kind,vel,rng),b*BEAT,pan)
    mix=room(mix)
    for sos in (butter(2,48,btype='highpass',fs=SR,output='sos'),butter(2,6900,btype='lowpass',fs=SR,output='sos')):
        mix=periodic_filter(mix,sos)
    mix=.95*mix+.05*np.tanh(mix)
    mix-=mix.mean(axis=0,dtype=np.float64).astype(np.float32)
    mix*=.10/np.sqrt(np.mean(mix**2))
    calibration=output/'evidence/intermediates'/f'{state}-calibration.wav';write(calibration,SR,mix)
    measured=loudness(calibration)
    gain=min(TARGET[state]-measured['integratedLUFS'],-4.3-measured['truePeakDbTP'])
    mix*=10**(gain/20)
    mix+=(rng.uniform(-.5,.5,mix.shape)+rng.uniform(-.5,.5,mix.shape)).astype(np.float32)/32768
    pcm=np.clip(np.rint(mix*32768),-32768,32767).astype(np.int16)
    wav=output/'masters'/f'{state}.wav';write(wav,SR,pcm)
    # Calibration is a reproducibility artifact, not an alternative deliverable.
    for ext,args in [('ogg',['-codec:a','libvorbis','-q:a','5']),('mp3',['-codec:a','libmp3lame','-b:a','128k','-write_xing','1'])]:
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),'-map_metadata','-1',*args,str(output/'assets'/f'{state}.{ext}')],check=True)
    midi_export(output/'masters'/f'{state}.mid',notes,drums,TITLES[state])
    harmony=EXP_HARMONY if state=='exploration' else COMBAT_HARMONY
    melody=EXP_MELODY if state=='exploration' else COMBAT_MELODY
    score={'suite':'Hollow Lanterns','title':TITLES[state],'state':state,'key':KEY,'bpm':BPM,'timeSignature':[4,4],
      'bars':BARS,'beats':BEATS,'durationSeconds':60,'loop':True,'loopStart':0,'loopEnd':60,'seed':seed,
      'form':['8-bar statement','8-bar contrasting development','8-bar altered return'],
      'motif':('Short G-Bb-A skip to Eb-D; a sly F-sharp pickup returns to G.' if state=='exploration' else 'Double G tap, Bb-A turn, falling Eb-D; staggered march and chromatic middle.'),
      'harmony':[{'bar':i+1,'symbol':s,'bassMidi':r,'voicing':v} for i,(s,r,v) in enumerate(harmony)],
      'melody':melody,'notes':[asdict(n) for n in notes],
      'percussion':[{'beat':b,'instrument':k,'velocity':v,'pan':p} for b,k,v,p in drums],
      'midiLimit':'GM programs are editable approximations; they do not reproduce these synthesized voices.'}
    (output/'masters'/f'{state}.score.json').write_text(json.dumps(score,indent=2)+'\n')
    result={'title':TITLES[state],'noteCount':len(notes),'percussionCount':len(drums),'renderGainDb':gain,
      'codecs':{ext:signal_metrics(output/('masters' if ext=='wav' else 'assets')/f'{state}.{ext}') for ext in ['wav','ogg','mp3']}}
    print(json.dumps({'state':state,'codecs':{ext:{k:r[k] for k in ['durationSeconds','integratedLUFS','truePeakDbTP','boundaryDeltaDbFS','boundaryDeltaVsLocal99p','boundaryCurvatureVsLocal99p','passed']} for ext,r in result['codecs'].items()}}),flush=True)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=BASE)
    p.add_argument('--track',choices=['all','exploration','combat'],default='all')
    p.add_argument('--verify-only',action='store_true',help='Inspect existing output bytes without rendering again')
    args=p.parse_args()
    output=args.output.resolve()
    if not output.is_relative_to(BASE):p.error('Output must remain within the Halloween pilot audio folder.')
    for d in ['masters','assets','evidence','evidence/intermediates','provenance']:(output/d).mkdir(exist_ok=True,parents=True)
    report_path=output/'validation.json'
    report=json.loads(report_path.read_text()) if report_path.exists() else {}
    report.update({'suite':'Hollow Lanterns','pilotOnly':True,'bpm':BPM,'sampleRate':SR,
      'listeningStatus':'No subjective listening or game/device audition performed.',
      'toolchain':{'python':sys.version,'numpy':np.__version__,'scipy':scipy.__version__,
        'ffmpeg':subprocess.run(['ffmpeg','-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]},
      'composerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'distinction':distinction()})
    report.setdefault('tracks',{})
    for state in ['exploration','combat']:
        if args.track in ('all',state):
            if args.verify_only:
                notes,drums=composition(state)
                report['tracks'][state]={'title':TITLES[state],'noteCount':len(notes),'percussionCount':len(drums),
                  'codecs':{ext:signal_metrics(output/('masters' if ext=='wav' else 'assets')/f'{state}.{ext}') for ext in ['wav','ogg','mp3']}}
            else:report['tracks'][state]=render(state,output)
    report['allSignalChecksPassed']=all(r['passed'] for t in report['tracks'].values() for r in t['codecs'].values())
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    manifest={s:{'src':f'assets/{s}.ogg','fallback':f'assets/{s}.mp3','title':TITLES[s],'key':KEY,'bpm':BPM,
      'bars':BARS,'timeSignature':[4,4],'duration':60,'loop':True,'loopStart':0,'loopEnd':60,'volume':VOLUMES[s]} for s in report['tracks']}
    (output/'pilot-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    if not report['allSignalChecksPassed']:raise SystemExit('Signal check failed; review validation.json')

if __name__=='__main__':main()
