#!/usr/bin/env python3
"""Original six-state Starfall Outpost soundtrack, offline and sample-free.

The accepted pilot source is preserved verbatim in compose_starfall_outpost_core.py.
This extension adds four separately authored arrangements. No runtime is modified.
"""
from pathlib import Path
from dataclasses import asdict
import argparse, hashlib, json, math, shutil, subprocess, sys
import numpy as np
import scipy
from scipy.io.wavfile import write
from scipy.signal import butter, sosfilt
import compose_starfall_outpost_core as core

BASE=Path(__file__).resolve().parent
STATES=['menu','exploration','tension','combat','victory','defeat']
PILOTS=['exploration','combat']
NEW=['menu','tension','victory','defeat']
SR=core.SR; BPM=core.BPM; BEAT=core.BEAT
CORE_HASH='869cc5fdabb5755440d2850590ac39347b7b4bb5a3f4b6303cb6e07649754cd4'
PILOT_HASHES={
 'masters/combat.mid':'5038c55faba8c4a133ffa2c16c4c26b6906b716ef816f6a1f6e13fab4f4233ca',
 'masters/combat.score.json':'abf9b34a1d60bd19e409cfa9f314485d254f75a7dec2f6dbf6cff6fbca07e98f',
 'masters/combat.wav':'83eeee1e006bf07fda79f9628f2b0ef12043a9d7f161da07b1e79f64cefd1f8d',
 'masters/exploration.mid':'328e95279010707364a4d820d203cbe2f0fc203a518c6584666d475b6281a407',
 'masters/exploration.score.json':'bbb528afe56c8d4dec70275449016f75da123aee238d9a7ed3f8416b35e2752b',
 'masters/exploration.wav':'38ff0d35431c03cc49bb67fa0dec9427cfd3ce303ef0747927a5e72b35a72032',
 'assets/combat.mp3':'f37e2938735658452f2b17e1db65259bad8f1b26168a3007dfa11ffbf121cc5c',
 'assets/combat.ogg':'5d80101acf92555d3e76c38e093b266155a308bce2c0023f06199eebc209ab36',
 'assets/exploration.mp3':'b3e9f9aeef09d2d1b67cc1ca5197bf2eaf7da1ed8b2aad2635769545870f0992',
 'assets/exploration.ogg':'6108ea352918ac0b579bfa989b9c30a434f520c2e34476caf056ceaf7093efd4',
}
VOLUMES={'menu':.80,'exploration':.72,'tension':.71,'combat':.68,'victory':.68,'defeat':.73}
BARS={'menu':16,'exploration':24,'tension':16,'combat':24,'victory':4,'defeat':5}
TARGET={'menu':-21.0,'tension':-20.1,'victory':-19.7,'defeat':-20.8}
TITLES={**core.TITLES,'menu':'A Beacon at the Edge of Dawn','tension':'Motion Beneath the Silent Array',
        'victory':'The Outpost Answers the Stars','defeat':'One Light Beyond the Debris'}
KEYS={**core.KEYS,'menu':'D major / Lydian; spacious added-sixth and ninth colors',
 'tension':'D Dorian with an E-flat Phrygian inflection; D-pedal and suspended fifths',
 'victory':'D major / Lydian; ascending signal and open D6/9 cadence',
 'defeat':'D Aeolian; descending signal dissolving into an open D minor ninth'}
FORMS={'menu':['4-bar distant beacon','4-bar widening horizon','4-bar B-minor reflection','4-bar homeward answer'],
 'tension':['4-bar low relay','4-bar interrupted response','4-bar close orbit','4-bar suspended return'],
 'victory':['1-bar ascending call','1-bar answering lift','1-bar home cadence','1-bar natural quiet tail'],
 'defeat':['1-bar descending call','1-bar falling reply','1-bar low final light','2-bar natural quiet tail']}

# Each full lead bar is newly authored, including its onset/duration pattern.
MENU_HARMONY=[
 ('D6/9',38,[54,57,59,64]),('Dmaj9/C#',37,[54,57,61,64]),
 ('Gmaj7/B',35,[55,59,62,66]),('A6sus2',33,[52,57,59,66]),
 ('Dmaj9/F#',30,[54,57,61,64]),('Eadd9/G#',32,[56,59,64,66]),
 ('Bm11',35,[54,57,61,64]),('Aadd9',33,[52,57,59,64]),
 ('Bm9',35,[54,57,61,66]),('Gmaj9',31,[54,57,59,62]),
 ('D6/A',33,[54,57,59,62]),('E6/B',35,[56,59,61,64]),
 ('Dmaj9/F#',30,[54,57,61,64]),('Gmaj9',31,[54,57,59,62]),
 ('Eadd9/G#',32,[56,59,64,66]),('A6sus2',33,[52,57,59,66]),
]
MENU_MELODY=[
 [(.375,74,.95),(2.125,81,1.2)],[(.625,78,.8),(2.375,76,.95)],
 [(.375,79,.7),(1.625,78,.6),(2.875,74,.8)],[(.875,76,1.1),(2.625,73,.7)],
 [(.375,78,.85),(2.125,81,1.05)],[(.625,80,.6),(1.875,83,.75),(3.125,80,.55)],
 [(.375,78,1.15),(2.375,73,.95)],[(.875,76,.8),(2.375,71,1.0)],
 [(.375,73,.95),(2.125,78,1.2)],[(.625,74,.8),(2.375,71,.95)],
 [(.375,69,.7),(1.625,71,.6),(2.875,74,.8)],[(.875,76,1.1),(2.625,80,.7)],
 [(.375,81,.85),(2.125,85,1.05)],[(.625,83,.6),(1.875,81,.75),(3.125,78,.55)],
 [(.375,80,1.15),(2.375,78,.95)],[(.875,76,.8),(2.375,73,1.0)],
]
TENSION_HARMONY=[
 ('Dm(add9)',38,[53,57,62,64]),('Dsus4(add9)',38,[55,57,62,64]),
 ('Cmaj7/D',38,[55,59,60,64]),('Dm6',38,[53,57,59,62]),
 ('Ebmaj7/D',38,[55,58,62,63]),('Dm(add9)',38,[53,57,62,64]),
 ('G6/D',38,[55,59,62,64]),('Asus4/D',38,[55,57,62,64]),
 ('Dm9/A',33,[53,57,60,64]),('G6/B',35,[55,59,62,64]),
 ('Cmaj7/D',38,[55,59,60,64]),('Dm6',38,[53,57,59,62]),
 ('Ebmaj7/D',38,[55,58,62,63]),('Dm(add9)',38,[53,57,62,64]),
 ('G6/D',38,[55,59,62,64]),('Asus4(add9)',33,[55,59,62,64]),
]
TENSION_MELODY=[
 [(.125,74,.22),(.625,75,.22),(2.125,81,.48),(3.375,76,.28)],
 [(.375,79,.38),(1.875,76,.28),(3.125,74,.48)],
 [(.125,76,.22),(.875,72,.38),(2.375,71,.48)],
 [(.625,74,.48),(2.125,77,.28),(3.375,76,.22)],
 [(.125,75,.22),(.625,79,.22),(2.125,82,.48),(3.375,79,.28)],
 [(.375,77,.38),(1.875,76,.28),(3.125,74,.48)],
 [(.125,71,.22),(.875,74,.38),(2.375,79,.48)],
 [(.625,81,.48),(2.125,79,.28),(3.375,76,.22)],
 [(.125,74,.22),(.625,76,.22),(2.125,77,.48),(3.375,81,.28)],
 [(.375,83,.38),(1.875,81,.28),(3.125,79,.48)],
 [(.125,84,.22),(.875,83,.38),(2.375,79,.48)],
 [(.625,77,.48),(2.125,76,.28),(3.375,74,.22)],
 [(.125,75,.22),(.625,74,.22),(2.125,70,.48),(3.375,67,.28)],
 [(.375,69,.38),(1.875,74,.28),(3.125,76,.48)],
 [(.125,79,.22),(.875,83,.38),(2.375,81,.48)],
 [(.625,79,.48),(2.125,76,.28),(3.375,69,.22)],
]
VICTORY_HARMONY=[('D6/9',38,[54,57,59,64]),('E6/G#',32,[56,59,61,64]),
                 ('D6/9',38,[54,57,59,64]),('quiet tail',None,[])]
VICTORY_MELODY=[[(.125,74,.34),(.875,76,.34),(1.625,81,.62),(2.875,85,.74)],
 [(0,83,.38),(.875,80,.34),(1.625,83,.62),(2.625,88,.95)],
 [(.125,86,1.7)],[]]
DEFEAT_HARMONY=[('Dm9',38,[53,57,60,64]),('Bbmaj7/D',38,[53,57,58,62]),
                ('Dm(add9)',26,[53,57,62,64]),('quiet tail',None,[]),('quiet tail',None,[])]
DEFEAT_MELODY=[[(.375,81,.8),(1.875,77,.85),(3.125,76,.55)],
 [(.625,74,.95),(2.375,72,1.1)],[(.375,62,1.75)],[],[]]
HARMONIES={'menu':MENU_HARMONY,'tension':TENSION_HARMONY,'victory':VICTORY_HARMONY,'defeat':DEFEAT_HARMONY}
MELODIES={'menu':MENU_MELODY,'tension':TENSION_MELODY,'victory':VICTORY_MELODY,'defeat':DEFEAT_MELODY}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def configure(state):
    core.BARS=BARS[state];core.BEATS=core.BARS*4
    core.FRAMES=round(core.BEATS*BEAT*SR);core.DURATION=core.FRAMES/SR
    core.VOLUMES.update(VOLUMES)

def composition(state):
    if state in PILOTS:return core.composition(state)
    notes=[];drums=[]
    def add(ins,b,p,d,v,pan=0):notes.append(core.Note(ins,b,int(p),d,v,pan))
    for bar,(_,root,chord) in enumerate(HARMONIES[state]):
        if root is None:continue
        b=bar*4
        finite=state in ['victory','defeat'];last=finite and bar==2
        pad_gate=1.8 if last else 3.7
        for j,p in enumerate(chord):add('horizon_pad',b+.05,p,pad_gate,.046 if state!='tension' else .033,[-.3,-.1,.1,.3][j])
        if state=='menu':
            add('pulse_bass',b,root,2.1,.28)
            if bar%2:add('pulse_bass',b+2.875,root+12,.6,.15)
            for off,idx in [(1.375,1),(3.375,3)]:add('orbit_pluck',b+off,chord[idx]+12,.35,.11,-.26)
            if bar%4==2:add('beacon_sine',b+1.625,chord[2]+12,1.45,.095,-.12)
            if bar%4==0:drums.append((b,'ion_kick',.095,0))
            if bar%2==1:drums.append((b+3.125,'dust_tick',.048,.23))
        elif state=='tension':
            for off,interval,vel in [(0,0,.30),(.875,12,.15),(2.125,0,.24),(3.375,7,.17)]:
                add('pulse_bass',b+off,root+interval,.27,vel)
            for i,off in enumerate([.375,1.125,1.875,2.875]):
                add('orbit_pluck',b+off,chord[(bar+i)%4]+12,.15,.13 if i%2 else .10,-.24 if i%2 else .24)
            if bar%4==3:add('beacon_sine',b+1.125,chord[2]+12,1.25,.078,-.12)
            for off,vel in [(0,.17),(2.125,.13)]:drums.append((b+off,'ion_kick',vel,0))
            for i,off in enumerate([.375,1.125,1.875,2.875,3.625]):drums.append((b+off,'dust_tick',.064 if i%2 else .043,.20))
            if bar%2:drums.append((b+3.125,'circuit_snap',.068,-.13))
        elif state=='victory':
            add('pulse_bass',b,root,1.65 if last else .85,.34)
            if not last:
                add('pulse_bass',b+2.125,root+12,.60,.22)
                for i,off in enumerate([.375,1.125,2.375,3.375]):add('orbit_pluck',b+off,chord[i]+12,.35,.14,-.24)
                for off in [0,1.625,2.625]:drums.append((b+off,'ion_kick',.18,0))
                for off in [.5,1.25,2.25,3.25]:drums.append((b+off,'dust_tick',.065,.2))
                drums.append((b+3,'circuit_snap',.075,-.1))
            else:
                add('orbit_pluck',b+.375,81,.65,.17,-.2)
                add('beacon_sine',b+.125,74,1.65,.16,-.13)
                drums.append((b,'ion_kick',.16,0))
        else:
            add('pulse_bass',b,root,1.7 if last else 2.4,.30 if last else .26)
            add('orbit_pluck',b+.875,chord[1]+12,.48,.09,-.25)
            if bar==1:add('beacon_sine',b+.625,65,2,.11,-.13)
            if bar==0:
                drums.extend([(b,'ion_kick',.10,0),(b+2.625,'dust_tick',.043,.2)])
        for i,(off,p,d) in enumerate(MELODIES[state][bar]):
            velocity={'menu':.29,'tension':.24,'victory':.33,'defeat':.28}[state]
            add('signal_pluck',b+off,p,d,velocity*(1-.06*(i%2)),.14)
    return notes,drums

def add_finite(dest,signal,seconds,pan):
    start=round(seconds*SR);size=min(len(signal),len(dest)-start)
    assert start>=0 and size>=len(signal),'Finite voice release must fit naturally'
    for ch,g in enumerate([math.sqrt((1-pan)/2),math.sqrt((1+pan)/2)]):dest[start:start+size,ch]+=signal[:size]*g

def finite_reflections(signal):
    wet=np.zeros_like(signal)
    for seconds,amp,swap in [(.150,.080,True),(.300,.054,False),(.450,.035,True),(.750,.018,False)]:
        delay=round(seconds*SR);src=signal[:,::-1] if swap else signal
        wet[delay:]+=src[:-delay]*amp
    return signal+sosfilt(butter(2,4600,fs=SR,output='sos'),wet,axis=0).astype(np.float32)

def metrics(path,state):
    configure(state);result=core.signal_metrics(path,state)
    result['loop']=state not in ['victory','defeat']
    if not result['loop']:
        raw=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True).stdout
        x=np.frombuffer(raw,np.float32).reshape(-1,2)
        result['ending200msPeakDbFS']=float(20*np.log10(max(float(np.max(np.abs(x[-8820:]))),1e-12)))
        result['ending500msRmsDbFS']=float(20*np.log10(max(float(np.sqrt(np.mean(x[-22050:]**2))),1e-12)))
        result['checks'].pop('loopStepBelowTrack99p')
        result['checks']['quietFiniteTail']=result['ending200msPeakDbFS']<-75 and result['ending500msRmsDbFS']<-80
        result['boundaryInterpretation']='Finite cue: start/end difference is not a loop seam; tail quietness is gated instead.'
    result['passed']=all(result['checks'].values())
    return result

def render_new(state,output):
    configure(state);seed=core.SEED+sum(map(ord,state));rng=np.random.default_rng(seed)
    notes,drums=composition(state);pitched=np.zeros((core.FRAMES,2),np.float32);dry=np.zeros_like(pitched)
    loop=state not in ['victory','defeat'];add=core.add_periodic if loop else add_finite
    for n in notes:add(dry if n.instrument=='pulse_bass' else pitched,core.synth(n),n.beat*BEAT,n.pan)
    for b,kind,vel,pan in drums:add(dry,core.percussion(kind,vel,rng),b*BEAT,pan)
    mix=(core.sky_reflections(pitched) if loop else finite_reflections(pitched))+dry
    for sos in (butter(2,36,btype='highpass',fs=SR,output='sos'),butter(2,8800,btype='lowpass',fs=SR,output='sos')):
        mix=core.periodic_filter(mix,sos) if loop else sosfilt(sos,mix,axis=0).astype(np.float32)
    if loop:mix-=mix.mean(axis=0,dtype=np.float64).astype(np.float32)
    mix*=.1/np.sqrt(np.mean(mix**2))
    calibration=output/'evidence/intermediates'/f'{state}-calibration.wav';write(calibration,SR,mix)
    measured=core.loudness(calibration);gain=min(TARGET[state]-measured['integratedLUFS'],-5.5-measured['truePeakDbTP'])
    mix*=10**(gain/20)
    mix+=(rng.uniform(-.5,.5,mix.shape)+rng.uniform(-.5,.5,mix.shape)).astype(np.float32)/32768
    assert np.max(np.abs(mix))<1,'Do not clip or silently limit'
    wav=output/'masters'/f'{state}.wav';write(wav,SR,np.rint(mix*32768).astype(np.int16))
    for ext,args in [('ogg',['-codec:a','libvorbis','-q:a','5']),('mp3',['-codec:a','libmp3lame','-b:a','128k','-write_xing','1'])]:
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),'-map_metadata','-1',*args,'-fflags','+bitexact',str(output/'assets'/f'{state}.{ext}')],check=True)
    core.midi_export(output/'masters'/f'{state}.mid',notes,drums,TITLES[state])
    score={'suite':'Starfall Outpost','title':TITLES[state],'state':state,'key':KEYS[state],'bpm':BPM,'timeSignature':[4,4],
      'bars':BARS[state],'beats':BARS[state]*4,'durationSeconds':core.DURATION,'loop':loop,'seed':seed,'form':FORMS[state],
      'harmony':[{'bar':i+1,'symbol':s,'bassMidi':r,'voicing':v} for i,(s,r,v) in enumerate(HARMONIES[state])],
      'melody':MELODIES[state],'notes':[asdict(n) for n in notes],
      'percussion':[{'beat':b,'instrument':k,'velocity':v,'pan':p} for b,k,v,p in drums],
      'midiLimit':'GM programs approximate custom mathematical voices; this synthesizer alone reproduces the master.'}
    if loop:score.update({'loopStart':0,'loopEnd':core.DURATION})
    (output/'masters'/f'{state}.score.json').write_text(json.dumps(score,indent=2)+'\n')
    return {'title':TITLES[state],'noteCount':len(notes),'percussionCount':len(drums),'renderGainDb':gain,
      'codecs':{e:metrics(output/('masters' if e=='wav' else 'assets')/f'{state}.{e}',state) for e in ['wav','ogg','mp3']}}

def check_pilots(output):
    records={s:{'expectedSha256':h,'actualSha256':sha(output/s),'passed':sha(output/s)==h} for s,h in PILOT_HASHES.items()}
    assert all(r['passed'] for r in records.values()),'Accepted pilot bytes changed; never substitute a new render'
    return records

def distinction(reference):
    report=core.distinction(reference)
    new={s:m for s,m in MELODIES.items()}
    for bank,data in json.loads(reference.read_text()).items():
        old=[core.melody_signature(p) for p in data['tables']['EXP_MELODY']+data['tables']['COMBAT_MELODY']]
        matches={s:[i+1 for i,p in enumerate(m) if p and core.melody_signature(p) in old] for s,m in new.items()}
        report['referenceBanks'][bank]['transpositionEquivalentCompleteMelodyBars'].update(matches)
        assert all(not v for v in matches.values())
    pilots=[core.melody_signature(p) for p in core.EXP_MELODY+core.COMBAT_MELODY]
    # Single-note cadences intentionally belong to the shared signal family;
    # this within-suite check considers multi-note phrases only.
    report['newMultiNoteBarsMatchingAcceptedPilots']={s:[i+1 for i,p in enumerate(m) if len(p)>1 and core.melody_signature(p) in pilots] for s,m in new.items()}
    assert all(not v for v in report['newMultiNoteBarsMatchingAcceptedPilots'].values())
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=BASE)
    parser.add_argument('--pilot-input',type=Path,help='Copy the ten accepted files verbatim from this pilot directory; absent means regenerate and hash-guard them.')
    parser.add_argument('--verify-only',action='store_true')
    parser.add_argument('--reference-tables',type=Path,default=BASE/'provenance/reference-melody-tables.json')
    args=parser.parse_args();output=args.output.resolve()
    assert sha(Path(core.__file__))==CORE_HASH,'Frozen core source changed'
    assert not (output/'pilot-manifest.json').exists(),'Refusing to write into a pilot output directory'
    if args.pilot_input:assert args.pilot_input.resolve()!=output
    for d in ['masters','assets','evidence','evidence/intermediates','provenance']:(output/d).mkdir(parents=True,exist_ok=True)
    report={'suite':'Starfall Outpost','pilotOnly':False,'states':STATES,'bpm':BPM,'sampleRate':SR,
      'listeningStatus':'No subjective listening, browser/game execution or physical-device audition performed.',
      'toolchain':{'python':sys.version,'numpy':np.__version__,'scipy':scipy.__version__,'ffmpeg':subprocess.run(['ffmpeg','-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]},
      'composerSha256':sha(Path(__file__)),'frozenCoreSha256':CORE_HASH,'distinction':distinction(args.reference_tables),'tracks':{}}
    for state in PILOTS+NEW:
        configure(state)
        if args.verify_only or (state in PILOTS and args.pilot_input):
            if not args.verify_only:
                for relative,expected in PILOT_HASHES.items():
                    if Path(relative).name.split('.')[0]==state:
                        source=args.pilot_input/relative
                        assert sha(source)==expected,f'Unaccepted pilot input: {source}'
                        shutil.copyfile(source,output/relative)
            notes,drums=composition(state)
            result={'title':TITLES[state],'noteCount':len(notes),'percussionCount':len(drums),'codecs':{e:metrics(output/('masters' if e=='wav' else 'assets')/f'{state}.{e}',state) for e in ['wav','ogg','mp3']}}
        elif state in PILOTS:result=core.render(state,output)
        else:result=render_new(state,output)
        report['tracks'][state]=result
        print(json.dumps({'state':state,'codecs':{e:{k:v[k] for k in ['integratedLUFS','truePeakDbTP','boundaryDeltaDbFS','passed']} for e,v in result['codecs'].items()}}),flush=True)
    report['acceptedPilotIdentity']=check_pilots(output)
    report['allSignalChecksPassed']=all(c['passed'] for t in report['tracks'].values() for c in t['codecs'].values())
    (output/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    manifest={}
    for state in STATES:
        duration=round(BARS[state]*4*BEAT*SR)/SR;loop=state not in ['victory','defeat']
        manifest[state]={'src':f'assets/{state}.ogg','fallback':f'assets/{state}.mp3','bpm':BPM,'duration':duration,'loop':loop,'volume':VOLUMES[state],
          'title':TITLES[state],'key':KEYS[state],'bars':BARS[state],'timeSignature':[4,4]}
        if loop:manifest[state].update({'loopStart':0,'loopEnd':duration})
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    assert report['allSignalChecksPassed'],'Review validation.json: a declared signal gate failed'

if __name__=='__main__':main()
