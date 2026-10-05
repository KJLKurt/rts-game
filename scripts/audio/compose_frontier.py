#!/usr/bin/env python3
"""Original sample-free Frontier Command score, reconstructed from retained source excerpts.

The recovered exploration/combat codecs are preserved in the game. This source
restores the original note tables, synthesis and four missing state arrangements.
Missing-state encoded-file byte identity with the lost working directory is not
claimed. Generation is deterministic at the PCM level within a toolchain; Ogg
container serial numbers can vary. Requires NumPy, SciPy and FFmpeg; no network.
"""
from pathlib import Path
from dataclasses import dataclass, asdict
import json, math, subprocess, struct
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io.wavfile import write

SR=44100
BPM=96
BEAT=60/BPM
SEED=20261004
TAU=2*np.pi
rng=np.random.default_rng(SEED)
ROOT=Path('/tmp/frontier-command-audio-recovered')

@dataclass
class Note:
    instrument:str
    beat:float
    midi:int
    duration:float
    velocity:float
    pan:float=0.0

def hz(midi): return 440.0*2**((midi-69)/12)

def adsr(t,gate,a=.035,d=.14,s=.78,r=.2):
    env=np.minimum(t/max(a,.0001),1)
    env*=np.where(t>a,s+(1-s)*np.exp(-(t-a)/d),1)
    return env*np.where(t>gate,np.maximum(1-(t-gate)/r,0)**1.7,1)

def synth_note(n):
    f=hz(n.midi);gate=n.duration*BEAT
    release={'celesta':1.5,'harp':1.3,'flute':.23,'pad':.6,'bass':.13,'horn':.18,'marimba':.65}.get(n.instrument,.4)
    t=np.arange(round((gate+release)*SR),dtype=np.float64)/SR
    phase=TAU*f*t
    if n.instrument=='celesta':
        y=(np.sin(phase)*np.exp(-t/1.00)+.24*np.sin(2*phase+.13)*np.exp(-t/.43)+.13*np.sin(3*phase+.3)*np.exp(-t/.23)+.04*np.sin(4.02*phase)*np.exp(-t/.09))
        env=(1-np.exp(-t/.006))*np.where(t>gate,np.exp(-(t-gate)/.33),1)
        y*=env*.60
    elif n.instrument=='harp':
        y=sum(np.sin(k*phase+.11*k)*np.exp(-t*(1.5+k*.58))/(k**1.7) for k in range(1,8))
        y*=(1-np.exp(-t/.003))*np.where(t>gate,np.exp(-(t-gate)/.30),1)*.61
    elif n.instrument=='flute':
        vibrato=.007*TAU*f/(TAU*4.6)*(1-np.exp(-t/1.0))*np.sin(TAU*4.6*t)
        p=phase+vibrato
        y=(np.sin(p)+.16*np.sin(2*p)+.055*np.sin(3*p)+.011*np.sin(5*p))
        breath=rng.normal(0,1,len(t));breath=sosfilt(butter(2,[1400,5200],btype='bandpass',fs=SR,output='sos'),breath)
        y=(y+.019*breath)*adsr(t,gate,.060,.17,.84,.23)*.53
    elif n.instrument=='pad':
        y=np.zeros_like(t)
        for detune,amp in [(.9972,.34),(1,.4),(1.0028,.26)]:
            p=phase*detune+.018*np.sin(TAU*.7*t)
            y+=amp*sum(np.sin(k*p+.2*k)/(k**2.05) for k in range(1,7))
        y*=adsr(t,gate,.27,.9,.77,.6)*.40
    elif n.instrument=='bass':
        y=(np.sin(phase)+.21*np.sin(2*phase)+.065*np.sin(3*phase))*adsr(t,gate,.012,.13,.63,.13)*.63
    elif n.instrument=='horn':
        p=phase+.022*np.sin(TAU*4.8*t)
        y=sum(np.sin(k*p)/(k**1.9) for k in range(1,8))
        y*=adsr(t,gate,.042,.15,.78,.18)*.54
    elif n.instrument=='marimba':
        y=(np.sin(phase)*np.exp(-t/.22)+.2*np.sin(4.01*phase)*np.exp(-t/.075)+.018*np.sin(9.2*phase)*np.exp(-t/.026))
        y*=(1-np.exp(-t/.002))*np.where(t>gate,np.exp(-(t-gate)/.12),1)*.68
    else: raise ValueError(n.instrument)
    y*=n.velocity
    ramp=min(128,len(y)//2);y[:ramp]*=np.linspace(0,1,ramp);y[-ramp:]*=np.linspace(1,0,ramp)
    return y.astype(np.float32)

def drum(kind,velocity):
    dur={'kick':.32,'snare':.20,'shaker':.08,'bell':.55,'tom':.34}[kind]
    t=np.arange(round(dur*SR))/SR
    if kind=='kick':
        phase=TAU*(45*t+28*.031*(1-np.exp(-t/.031)))
        y=np.sin(phase)*np.exp(-t/.073)+.055*rng.normal(size=len(t))*np.exp(-t/.006)
    elif kind=='tom':
        phase=TAU*(98*t+23*.043*(1-np.exp(-t/.043)))
        y=np.sin(phase)*np.exp(-t/.088)+.10*np.sin(1.42*phase)*np.exp(-t/.038)
    elif kind=='snare':
        noise=sosfilt(butter(2,[1300,6500],btype='bandpass',fs=SR,output='sos'),rng.normal(size=len(t)))
        y=.34*noise*np.exp(-t/.046)+.22*np.sin(TAU*180*t)*np.exp(-t/.026)
    elif kind=='shaker':
        noise=sosfilt(butter(2,[4700,11500],btype='bandpass',fs=SR,output='sos'),rng.normal(size=len(t)))
        y=noise*(1-np.exp(-t/.002))*np.exp(-t/.017)*.40
    else:
        y=sum(np.sin(TAU*f*t)*np.exp(-t/(.07+i*.022)) for i,f in enumerate([2471,3119,4217,5681]))*.16
    y*=velocity;y[:64]*=np.linspace(0,1,64);y[-128:]*=np.linspace(1,0,128)
    return y.astype(np.float32)

def note(events,instrument,beat,midi,duration,velocity=.35,pan=0):
    if midi is not None:events.append(Note(instrument,beat,int(midi),duration,velocity,pan))

def phrase(events,instrument,bar,notes,vel=.4,pan=.08,transpose=0):
    for i,(beat,midi,duration) in enumerate(notes):
        note(events,instrument,bar*4+beat,midi+transpose,duration,vel*(.94+.09*math.sin(i*1.3+bar)),pan)

EXP_CHORDS=[
 ('Dmaj9',38,[54,57,61,64]),('A/C#',37,[52,57,61,64]),('Bm7',35,[54,57,62,66]),('Gmaj7',31,[54,57,59,62]),
 ('D/F#',30,[54,57,62,64]),('Em7',28,[55,59,62,66]),('Gmaj7',31,[54,57,59,62]),('Asus-A',33,[52,57,61,64]),
 ('Dmaj9',38,[54,57,61,64]),('F#m7',30,[52,57,61,66]),('Bm7',35,[54,57,62,66]),('Gmaj9',31,[54,57,59,62]),
 ('Em7',28,[55,59,62,66]),('Aadd9',33,[52,57,59,61]),('Dmaj7/F#',30,[54,57,61,62]),('A',33,[52,57,61,64]),
]
EXP_MELODY=[
 [(0,66,1),(1.25,69,.65),(2,71,.8),(3,69,.75)],[(0,64,1.45),(2,66,.75),(3,64,.65)],
 [(0,62,.9),(1.25,66,.7),(2.25,69,1.0)],[(0,67,1.25),(1.5,66,.7),(2.5,62,1.15)],
 [(0,64,.75),(1,66,1.45),(3,69,.65)],[(0,71,.85),(1,69,.85),(2,67,.85),(3,66,.7)],
 [(0,67,1.2),(1.5,71,.7),(2.5,69,.6),(3.25,67,.55)],[(0,64,1.8),(2.5,61,.55),(3.25,64,.5)],
 [(0,69,1.2),(1.5,73,.65),(2.5,74,.95)],[(0,73,.85),(1,69,1.2),(2.5,68,1.1)],
 [(0,66,1.1),(1.5,69,.65),(2.5,71,1.0)],[(0,74,1.1),(1.5,71,.65),(2.5,69,1.05)],
 [(0,67,.8),(1,66,.8),(2,64,1.5)],[(0,64,.65),(1,66,.65),(2,64,.6),(3,61,.65)],
 [(0,62,2.0),(2.5,66,.8)],[(0,64,1.25),(2,61,1.4)],
]
COMBAT_CHORDS=[
 ('Bm',35,[54,59,62,66]),('G',31,[55,59,62,67]),('D',38,[54,57,62,66]),('A',33,[52,57,61,64]),
 ('Bm',35,[54,59,62,66]),('Gmaj7',31,[54,59,62,67]),('Em',28,[55,59,64,67]),('F#m7',30,[54,57,61,64]),
 ('G',31,[55,59,62,67]),('D/F#',30,[54,57,62,66]),('Em7',28,[55,59,62,67]),('A',33,[52,57,61,64]),
 ('Bm',35,[54,59,62,66]),('G',31,[55,59,62,67]),('A',33,[52,57,61,64]),('F#sus4-F#',30,[54,58,61,66]),
]
COMBAT_MELODY=[
 [(0,66,.65),(1,66,.4),(1.75,69,.55),(2.5,71,1.0)],[(0,74,.9),(1.5,71,.6),(2.5,67,.9)],
 [(0,69,.7),(1,66,.6),(2,64,.65),(3,66,.6)],[(0,64,1.15),(1.5,61,.55),(2.5,64,1.0)],
 [(0,66,.6),(1,69,.4),(1.75,71,.55),(2.5,74,.9)],[(0,71,.7),(1,69,.5),(2,67,.65),(3,66,.65)],
 [(0,67,.9),(1.5,71,.55),(2.5,76,.85)],[(0,73,.9),(1.5,69,.55),(2.5,66,1.0)],
 [(0,74,1.35),(2,71,.6),(3,69,.6)],[(0,69,.8),(1.25,66,.6),(2.5,62,1.1)],
 [(0,64,.7),(1,67,.6),(2,71,1.2)],[(0,73,.85),(1.5,71,.6),(2.5,69,1.0)],
 [(0,71,.65),(1,74,.6),(2,78,.9),(3.25,74,.45)],[(0,74,.7),(1,71,.65),(2,67,1.1)],
 [(0,69,.8),(1.25,64,.55),(2.25,61,1.0)],[(0,66,1.0),(1.5,65,.55),(2.5,66,1.0)],
]

def exploration():
    e=[];drums=[]
    for bar in range(32):
        _,root,voicing=EXP_CHORDS[bar%16]
        for j,p in enumerate(voicing):note(e,'pad',bar*4+.02,p,3.85,.14,(-.36,-.12,.12,.36)[j])
        for beat,p,d,v in [(0,root,1.65,.38),(2,root+12,1.1,.22)]:note(e,'bass',bar*4+beat,p,d,v,-.02)
        arp=[voicing[0]+12,voicing[1]+12,voicing[2]+12,voicing[3]+12]
        for j,b in enumerate([.0,.75,1.5,2.5,3.25]):note(e,'harp',bar*4+b,arp[(j+(bar%2))%4],.56,.17 if j else .22,-.27)
        ins='celesta' if bar<16 else 'flute';phrase(e,ins,bar,EXP_MELODY[bar%16],.40 if ins=='celesta' else .31,.16)
        if bar>=16:note(e,'celesta',bar*4+2.75,voicing[(bar+1)%4]+12,.55,.17,-.25)
        if bar%4 in (1,3):note(e,'celesta',bar*4+3.5,voicing[1]+24,.36,.09,.40)
        if bar>=8:drums.extend([(bar*4+.0,'shaker',.12,-.3),(bar*4+2,'shaker',.10,.3)])
        if bar%4==0:drums.append((bar*4,'bell',.10,.25))
    return e,drums,128

def combat():
    e=[];drums=[]
    for bar in range(32):
        _,root,voicing=COMBAT_CHORDS[bar%16]
        for j,p in enumerate(voicing):note(e,'pad',bar*4,p,3.8,.12,(-.3,-.1,.1,.3)[j])
        for b in [0,1.5,2,3]:note(e,'bass',bar*4+b,root+(12 if b==3 else 0),.57,.36 if b in [0,2] else .24,0)
        pat=[0,2,1,2,0,3,1,2] if bar<16 else [0,1,2,1,0,2,3,1]
        for j,idx in enumerate(pat):note(e,'marimba',bar*4+j*.5,voicing[idx]+12,.34,.21 if j%2==0 else .14,-.24)
        phrase(e,'horn' if bar<16 else 'flute',bar,COMBAT_MELODY[bar%16],.31 if bar<16 else .34,.1)
        if bar>=16:phrase(e,'horn',bar,[(b,p-12,d) for b,p,d in COMBAT_MELODY[bar%16]],.16,-.05)
        for b in [0,2]:drums.append((bar*4+b,'kick',.40,0))
        for b in [1,3]:drums.append((bar*4+b,'snare',.30,-.09))
        for j in range(8):drums.append((bar*4+j*.5+.006,'shaker',.11 if j%2 else .15,.23 if j%2 else -.23))
        if bar%4==3:
            for b,v in [(2.75,.17),(3.25,.22),(3.5,.25)]:drums.append((bar*4+b,'tom',v,.12))
        if bar%4==0:drums.append((bar*4,'bell',.10,.32))
    return e,drums,128

def menu():
    e=[];drums=[]
    for bar in range(16):
        _,root,voicing=EXP_CHORDS[bar]
        for j,p in enumerate(voicing):note(e,'pad',bar*4,p,3.87,.18,(-.35,-.1,.1,.35)[j])
        note(e,'bass',bar*4,root,3.55,.22,0);phrase(e,'celesta',bar,EXP_MELODY[bar],.37,.07)
        for b,idx in [(0,0),(1.5,1),(2.5,2)]:note(e,'harp',bar*4+b,voicing[idx]+12,1.0,.17,-.24)
        if bar%4==0:note(e,'celesta',bar*4,voicing[3]+12,2,.13,.30)
    return e,drums,64

def victory():
    e=[];drums=[]
    for b,p,d in [(0,66,.65),(.75,69,.65),(1.5,71,.65),(2.25,73,.65),(3,74,3.5)]:
        note(e,'celesta',b,p,d,.48,.1);note(e,'horn',b,p-12,d,.27,-.1)
    for j,p in enumerate([50,54,57,61,66]):note(e,'pad',3,p,4.7,.18,(-.25,-.1,0,.1,.25)[j])
    for j,p in enumerate([62,66,69,74,78]):note(e,'harp',3+j*.12,p,3.0,.24,-.18+j*.09)
    note(e,'bass',0,33,1.4,.28);note(e,'bass',1.5,33,1.25,.25);note(e,'bass',3,38,3.0,.40)
    drums=[(0,'tom',.25,-.1),(1.5,'tom',.30,.1),(3,'kick',.35,0),(3,'bell',.20,.2)]
    return e,drums,12

def tension():
    e=[];drums=[]
    for bar in range(16):
        _,root,voicing=COMBAT_CHORDS[bar]
        for j,p in enumerate(voicing):note(e,'pad',bar*4,p,3.85,.16,(-.3,-.1,.1,.3)[j])
        note(e,'bass',bar*4,root,2.8,.28,0)
        if bar%2:note(e,'bass',bar*4+3,root+12,.6,.16,0)
        for j,b in enumerate([0,.75,1.5,2.5,3.25]):note(e,'marimba',bar*4+b,voicing[(j+bar%2)%4]+12,.48,.15 if j%2 else .21,-.23)
        motif=COMBAT_MELODY[bar]
        phrase(e,'flute' if bar<8 else 'horn',bar,motif[:2] if bar%2==0 else motif[1:],.24,.14,0 if bar<8 else -12)
        if bar>=8:note(e,'harp',bar*4+2.75,voicing[2]+12,.9,.17,.24)
        if bar%2==0:drums.append((bar*4,'tom',.16,0))
        for b in [1,3]:drums.append((bar*4+b,'shaker',.10,-.2 if b==1 else .2))
    return e,drums,64

def defeat():
    e=[];drums=[]
    for b,p,d in [(0,74,1.3),(1.5,71,1.1),(3,69,.8),(4,66,1.7),(6,64,1.2),(7.5,62,1.0),(9,59,3.5)]:
        note(e,'flute',b,p,d,.31,.10);note(e,'celesta',b+.12,p-12,d,.22,-.17)
    for beat,root,voicing,dur in [(0,31,[55,59,62,66],3.8),(4,30,[54,57,61,64],4.8),(9,35,[54,59,62,66],4.2)]:
        for j,p in enumerate(voicing):note(e,'pad',beat,p,dur,.18,(-.3,-.1,.1,.3)[j])
        note(e,'bass',beat,root,dur,.27,0)
        for j,p in enumerate(voicing):note(e,'harp',beat+j*.3,p+12,1.8,.15,-.2+j*.12)
    return e,drums,16

def add_periodic(dest,mono,start_seconds,pan,loop):
    n=len(dest);start=round(start_seconds*SR);gains=[math.sqrt((1-pan)/2),math.sqrt((1+pan)/2)]
    if loop:
        start%=n;stop=min(len(mono),n-start)
        for ch,g in enumerate(gains):
            dest[start:start+stop,ch]+=mono[:stop]*g
            if stop<len(mono):dest[:len(mono)-stop,ch]+=mono[stop:]*g
    elif start<n:
        m=min(len(mono),n-start)
        for ch,g in enumerate(gains):dest[start:start+m,ch]+=mono[:m]*g

def room_reverb(x,loop=True):
    wet=np.zeros_like(x)
    for seconds,g,swap in [(.037,.12,False),(.059,.10,True),(.101,.085,False),(.147,.07,True),(.211,.060,False),(.293,.047,True),(.397,.034,False),(.503,.024,True),(.641,.014,False)]:
        d=round(seconds*SR);src=x[:,::-1] if swap else x
        if loop:wet+=np.roll(src,d,axis=0)*g
        else:wet[d:]+=src[:-d]*g
    filt=butter(2,5200,fs=SR,output='sos')
    if loop:wet=sosfilt(filt,np.concatenate([wet[-SR:],wet]),axis=0)[SR:].astype(np.float32)
    else:wet=sosfilt(filt,wet,axis=0).astype(np.float32)
    return x+wet

def midi_export(path,notes,percussion,beats):
    instruments=list(dict.fromkeys(n.instrument for n in notes));programs={'celesta':8,'harp':46,'flute':73,'pad':48,'bass':32,'horn':60,'marimba':12}
    def vlq(v):
        out=[v&127];v>>=7
        while v:out.insert(0,(v&127)|128);v>>=7
        return bytes(out)
    def track(events):
        data=bytearray();prev=0
        for tick,order,msg in sorted(events,key=lambda x:(x[0],x[1])):data+=vlq(tick-prev)+msg;prev=tick
        data+=b'\x00\xff\x2f\x00'
        return b'MTrk'+struct.pack('>I',len(data))+data
    tempo=int(60_000_000/BPM);chunks=[track([(0,0,b'\xff\x51\x03'+tempo.to_bytes(3,'big')),(0,1,b'\xff\x58\x04\x04\x02\x18\x08')])]
    for ch,ins in enumerate(instruments):
        ev=[(0,0,bytes([0xC0+ch,programs[ins]]))]
        for n in notes:
            if n.instrument!=ins:continue
            tick=round(n.beat*480);end=round((n.beat+n.duration)*480)
            ev.extend([(tick,2,bytes([0x90+ch,n.midi,max(1,min(127,round(n.velocity*180)))])),(end,1,bytes([0x80+ch,n.midi,0]))])
        chunks.append(track(ev))
    ev=[];drumsmap={'kick':36,'snare':38,'tom':45,'shaker':70,'bell':83}
    for beat,kind,vel,pan in percussion:
        tick=round(beat*480);p=drumsmap[kind];ev.extend([(tick,2,bytes([0x99,p,max(1,round(vel*220))])),(tick+60,1,bytes([0x89,p,0]))])
    if ev:chunks.append(track(ev))
    path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(chunks),480)+b''.join(chunks))

def render(name,fn):
    global rng
    rng=np.random.default_rng(SEED+sum(map(ord,name)))
    notes,percussion,beats=fn();loop=name not in ('victory','defeat');duration=beats*BEAT;n=round(duration*SR)
    mix=np.zeros((n,2),np.float32)
    for event in notes:
        delta=0 if event.beat%4<.05 else float(rng.uniform(-.008,.008))
        add_periodic(mix,synth_note(event),event.beat*BEAT+delta,event.pan,loop)
    for beat,kind,v,pan in percussion:add_periodic(mix,drum(kind,v),beat*BEAT,pan,loop)
    mix=room_reverb(mix,loop);filt=butter(2,40,btype='highpass',fs=SR,output='sos')
    if loop:mix=sosfilt(filt,np.concatenate([mix[-SR:],mix]),axis=0)[SR:].astype(np.float32)
    else:mix=sosfilt(filt,mix,axis=0).astype(np.float32)
    mix=.90*mix+.10*np.tanh(mix)
    peak=float(np.max(np.abs(mix)));rms=float(np.sqrt(np.mean(mix**2)))
    target={'exploration':.092,'combat':.100,'menu':.079,'victory':.105,'tension':.086,'defeat':.086}[name]
    mix*=min(target/rms,.79/peak)
    if not loop:
        fade=round(1.6*SR);mix[-fade:]*=np.linspace(1,0,fade)[:,None]**1.6
    mix+=rng.uniform(-.5/32768,.5/32768,mix.shape).astype(np.float32)
    pcm=np.clip(mix*32767,-32768,32767).astype(np.int16)
    wav=ROOT/'masters'/f'{name}.wav';write(wav,SR,pcm)
    for ext,args in [('mp3',['-codec:a','libmp3lame','-b:a','112k','-write_xing','1']),('ogg',['-codec:a','libvorbis','-q:a','5' if name=='defeat' else '3'])]:
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),'-map_metadata','-1',*args,str(ROOT/'assets'/f'{name}.{ext}')],check=True)
    midi_export(ROOT/'masters'/f'{name}.mid',notes,percussion,beats)
    score={'bpm':BPM,'beats':beats,'timeSignature':[4,4],'seed':SEED+sum(map(ord,name)),'notes':[asdict(e) for e in notes],'percussion':[{'beat':b,'instrument':k,'velocity':v,'pan':p} for b,k,v,p in percussion]}
    (ROOT/'masters'/f'{name}.score.json').write_text(json.dumps(score,indent=2)+'\n')
    result={'frames':n,'durationSeconds':duration,'peakDbFS':round(float(20*np.log10(np.max(np.abs(pcm.astype(float)/32768)))),2),'noteCount':len(notes),'percussionCount':len(percussion)}
    print(name,json.dumps(result),flush=True);return result

if __name__=='__main__':
    import argparse
    tracks={'menu':menu,'exploration':exploration,'tension':tension,'combat':combat,'victory':victory,'defeat':defeat}
    p=argparse.ArgumentParser();p.add_argument('--track',choices=['all',*tracks],default='all');p.add_argument('--output',type=Path,default=ROOT);args=p.parse_args();ROOT=args.output.resolve()
    for d in ['assets','masters']:(ROOT/d).mkdir(parents=True,exist_ok=True)
    report=json.loads((ROOT/'render-validation.json').read_text()) if (ROOT/'render-validation.json').exists() else {}
    for name,fn in tracks.items():
        if args.track in ('all',name):report[name]=render(name,fn)
    (ROOT/'render-validation.json').write_text(json.dumps(report,indent=2)+'\n')
