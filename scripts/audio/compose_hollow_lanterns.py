#!/usr/bin/env python3
"""Complete the original sample-free Hollow Lanterns six-state soundtrack.

Accepted exploration/combat bytes are preserved. Only menu, tension, victory and
 defeat are rendered. Synthesis comes from the retained exact pilot source; the
new arrangements are authored here. No recorded samples, services or network.
Portable beside compose_frontier.py/compose_mythic.py with the retained core
module. --output selects a review directory; --preserve-pilots selects accepted
masters/assets whose exact hashes are enforced before any bank is generated.
"""
from pathlib import Path
from dataclasses import asdict
import argparse,hashlib,importlib.util,json,math,re,shutil,subprocess,sys
import numpy as np
import scipy
from scipy.io.wavfile import write
from scipy.signal import butter,sosfilt
sys.dont_write_bytecode=True
BASE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('hollow_pilot_core',BASE/'compose_hollow_lanterns_core.py')
core=importlib.util.module_from_spec(spec);sys.modules[spec.name]=core;spec.loader.exec_module(core)
SR=core.SR;BPM=core.BPM;BEAT=core.BEAT;SEED=202610091424
PILOT_HASHES={'assets/exploration.ogg': '399d42d246aeb1cf495944f1e7f4d074b540b594c87f84add69b40bcaadcd080', 'assets/exploration.mp3': '41c21787594e029247dec54a6458a86ac474012012d29dab67c664d85f4d4cac', 'masters/exploration.wav': '4d895997eed7f5b5c893b93a64dc5e424fa2e5f81d517dcd09f20688bc6ab04b', 'masters/exploration.mid': '1396ee178849d6e1f31efb7128889c4f9fb6dc1fbd221a74ab85950f99070e85', 'masters/exploration.score.json': '935ecbdc0458736cf91e804b36b8b423e1ea9f4be9b3fea3ffbe4fa91d1d0243', 'assets/combat.ogg': '3b101f842b9a0409b642f3620da9c0f0f9ae7a579b9032b04ad3d656304e324b', 'assets/combat.mp3': '194c7632b15fd21205721298e96817060c197f80a67700311bda0e40bea27e4a', 'masters/combat.wav': '54680a9460c41ea19525d7f80ba2dd7513132f46a94ef4dc234ad991fbc73881', 'masters/combat.mid': 'cf2ac3230db4970fdccec4fe35ac1c7994eeb8e0019fc96817a1cde5b0a15daa', 'masters/combat.score.json': '273ba44f02eba2337b86159e7ae0842d029f86a68462b79a9a4413003b8f7365'}
STATES=['menu','exploration','tension','combat','victory','defeat']
NEW_STATES=['menu','tension','victory','defeat']
BEATS={'menu':64,'exploration':96,'tension':64,'combat':96,'victory':12,'defeat':16}
TITLES={**core.TITLES,'menu':'The Lanternkeeper’s Gate','tension':'Footsteps Beyond the Haystacks','victory':'First Light at the Harvest Fair','defeat':'The Last Ember in the Field'}
TARGET={'menu':-20.7,'exploration':-20.2,'tension':-20.1,'combat':-19.6,'victory':-19.5,'defeat':-20.7}
VOLUMES={'menu':.80,'exploration':.72,'tension':.71,'combat':.68,'victory':.68,'defeat':.73}
KEYS={s:core.KEY for s in STATES};KEYS['victory']='G major, Picardy-color transformation of the Hollow Lanterns cell';KEYS['defeat']='G minor'
FORMS={'menu':['eight-bar quiet wooden statement','eight-bar reed response and altered return'],
 'tension':['eight-bar sparse watch','eight-bar gathering footfalls'],
 'victory':['major-color motif','short dominant lift','G-major arrival and finite release'],
 'defeat':['broken lantern motif','descending echo','dominant shadow','G-minor rest and finite release']}
MENU_BARS=list(range(8))+list(range(16,24))
HARMONIES={'menu':[(i*4,*core.EXP_HARMONY[index]) for i,index in enumerate(MENU_BARS)],
 'tension':[(i*4,*core.COMBAT_HARMONY[i]) for i in range(16)],
 'victory':[(0,'G6',43,[55,59,62,64]),(4,'Cmaj7',48,[55,59,60,64]),(6,'D7',38,[54,57,60,62]),(8,'G6',43,[55,59,62,64])],
 'defeat':[(0,'Gm(add9)',43,[55,58,62,69]),(4,'Ebmaj7',39,[55,58,62,63]),(8,'Cm6/D',38,[55,57,60,63]),(12,'Gm',43,[55,58,62,67])]}
MELODIES={'menu':[core.EXP_MELODY[i] for i in MENU_BARS],
 'tension':[[ (.5,bar[0][1]-12,.75),(2.25,bar[2][1]-12,.60)] for bar in core.COMBAT_MELODY[:16]],
 'victory':[[(0,67,.32),(.5,71,.38),(1.25,69,.58),(2.5,76,.46),(3.25,74,.50)],[(0,72,.6),(1,71,.55),(2,69,.5),(3,74,.6)],[(0,79,1.85)]],
 'defeat':[[(.125,67,.70),(1.375,70,.62),(2.625,69,.95)],[(.25,63,.85),(1.75,62,.80),(3,58,.65)],[(.25,60,.80),(1.75,57,.80),(3,54,.70)],[(0,55,2.0)]]}

def looped(state):return state not in ('victory','defeat')

def composition(state):
    notes=[];drums=[]
    def add(ins,b,p,d,v,pan=0):notes.append(core.Note(ins,b,p,d,v,pan))
    if state=='menu':
        for bar,(_,_,root,chord) in enumerate(HARMONIES[state]):
            b=bar*4
            for j,p in enumerate(chord):add('reed_air',b+.04,p,3.72,.058,(-.33,-.11,.11,.33)[j])
            add('plucked_bass',b,root,1.25,.26)
            for off,idx in [(.875,1),(2.875,2)]:add('jackbox',b+off,chord[idx],.4,.14,-.26)
            lead='jackbox' if bar<8 else 'reed'
            for i,(off,p,d) in enumerate(MELODIES[state][bar]):add(lead,b+off,p,d,.31 if lead=='jackbox' else .23,.12)
            if bar%4==0:add('glass',b+2.0,chord[2]+12,1.1,.085,.30)
            if bar in (0,8):drums.append((b,'gourd',.075,0))
    elif state=='tension':
        for bar,(_,_,root,chord) in enumerate(HARMONIES[state]):
            b=bar*4;dense=bar>=8
            for j,p in enumerate(chord):add('reed_air',b+.03,p,3.74,.06,(-.3,-.1,.1,.3)[j])
            add('plucked_bass',b,root,1.10,.31)
            if dense:add('plucked_bass',b+2.25,root,.52,.19)
            for off,idx in ([(.75,0),(1.75,2),(3.25,1)] if dense else [(.75,0),(2.75,2)]):
                add('jackbox',b+off,chord[idx],.28,.18 if off==.75 else .13,-.23)
            for off,p,d in MELODIES[state][bar]:add('reed',b+off,p,d,.23 if dense else .21,.08)
            if bar in (3,11):add('glass',b+2.5,chord[2]+12,1.0,.075,.26)
            if bar%2==0:drums.append((b,'gourd',.15 if dense else .12,0))
            for off in ([1.5,3.5] if dense else [3.5]):drums.append((b+off,'seeds',.06,.25))
            if bar in (7,15):drums.append((b+3,'twig',.055,-.16))
    elif state=='victory':
        for bar,phrase in enumerate(MELODIES[state]):
            for off,p,d in phrase:
                add('jackbox',bar*4+off,p,d,.35,.14)
                add('reed',bar*4+off,p-12,d,.23,-.07)
        for idx,(b,_,root,chord) in enumerate(HARMONIES[state]):
            duration=[3.7,1.7,1.7,2.0][idx]
            for j,p in enumerate(chord):add('reed_air',b,p,duration,.115,(-.3,-.1,.1,.3)[j])
            add('plucked_bass',b,root,1.0 if b<8 else 1.7,.34)
            for j,p in enumerate(chord):add('jackbox',b+j*.12,p+12,.75,.16,-.24+j*.12)
        add('glass',8,79,1.8,.17,.28)
        drums=[(0,'gourd',.18,0),(4,'gourd',.14,-.08),(6,'twig',.09,.08),(8,'gourd',.23,0),(8.5,'seeds',.10,.2)]
    elif state=='defeat':
        for bar,phrase in enumerate(MELODIES[state]):
            for off,p,d in phrase:
                add('reed',bar*4+off,p,d,.24,.04)
                if bar<2:add('jackbox',bar*4+off+.16,p-12,.5,.12,-.18)
        for bar,(b,_,root,chord) in enumerate(HARMONIES[state]):
            duration=3.5 if bar<3 else 2.1
            for j,p in enumerate(chord):add('reed_air',b,p,duration,.10,(-.3,-.1,.1,.3)[j])
            add('plucked_bass',b,root,1.5,.24)
            for j,p in enumerate(chord[:3]):add('jackbox',b+.5+j*.375,p,.6,.12,-.20+j*.12)
        add('glass',4.375,70,1.4,.065,.25)
        add('glass',12.125,67,1.2,.052,.2)
        drums=[(0,'gourd',.075,0)]
    else:raise ValueError(state)
    return notes,drums

def finite_add(dest,signal,seconds,pan):
    start=round(seconds*SR);length=min(len(signal),len(dest)-start)
    if length<=0:return
    for ch,g in enumerate([math.sqrt((1-pan)/2),math.sqrt((1+pan)/2)]):dest[start:start+length,ch]+=signal[:length]*g

def finite_room(signal):
    wet=np.zeros_like(signal)
    for sec,amp,swap in [(.031,.10,False),(.071,.087,True),(.113,.066,False),(.181,.050,True),(.263,.037,False),(.359,.026,True),(.467,.018,False),(.617,.010,True)]:
        d=round(sec*SR);src=signal[:,::-1] if swap else signal
        wet[d:]+=src[:-d]*amp
    return signal+sosfilt(butter(2,4200,fs=SR,output='sos'),wet,axis=0).astype(np.float32)

def verify(path,state):
    frames=round(BEATS[state]*BEAT*SR)
    meta=json.loads(subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=codec_name,sample_fmt,sample_rate,channels','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)['streams'][0]
    decoded=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True).stdout
    x=np.frombuffer(decoded,np.float32).reshape(-1,2).astype(np.float64)
    steps=np.abs(np.diff(x,axis=0));k=round(.02*SR);local_steps=np.r_[steps[:k],steps[-k:]]
    curvature=np.abs(np.r_[np.diff(x[:k],n=2,axis=0),np.diff(x[-k:],n=2,axis=0)])
    seam=x[0]-x[-1];delta=float(np.max(np.abs(seam)))
    bend=float(max(np.max(np.abs(seam-(x[-1]-x[-2]))),np.max(np.abs(x[1]-x[0]-seam))))
    rms=np.sqrt(np.mean(x**2));mono=x.mean(axis=1);size=len(x)//SR*SR
    windows=np.sqrt(np.mean(x[:size].reshape(-1,SR,2)**2,axis=(1,2)));db=20*np.log10(np.maximum(windows,1e-12))
    result={'file':str(Path(path.parent.name)/path.name),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'decodedPcmSha256':hashlib.sha256(decoded).hexdigest(),'codec':meta['codec_name'],'sampleRate':int(meta['sample_rate']),'channels':int(meta['channels']),
      'frames':len(x),'expectedFrames':frames,'durationSeconds':len(x)/SR,'durationExact':len(x)==frames,'loop':looped(state),
      **core.loudness(path),'samplePeakDbFS':float(20*np.log10(np.max(np.abs(x)))),
      'rmsDbFS':float(20*np.log10(rms)),'crestDb':float(20*np.log10(np.max(np.abs(x))/rms)),
      'clippedSamples':int(np.count_nonzero(np.abs(x)>=1)),
      'dcOffsetMax':float(np.max(np.abs(np.mean(x,axis=0)))),'stereoCorrelation':float(np.corrcoef(x.T)[0,1]),
      'monoFoldDownDb':float(20*np.log10(np.sqrt(np.mean(mono**2))/rms)),
      'boundaryDelta':delta,'boundaryDeltaDbFS':float(20*np.log10(max(delta,1e-12))),
      'boundaryDeltaVsTrack99p':delta/max(float(np.quantile(steps,.99)),1e-12),
      'boundaryDeltaVsLocal99p':delta/max(float(np.quantile(local_steps,.99)),1e-12),
      'boundaryCurvature':bend,'boundaryCurvatureVsLocal99p':bend/max(float(np.quantile(curvature,.99)),1e-12),
      'ending100msPeakDbFS':float(20*np.log10(max(np.max(np.abs(x[-round(.1*SR):])),1e-12))),
      'oneSecondRmsDb':{'min':float(db.min()),'max':float(db.max()),'range':float(np.ptp(db)),'standardDeviation':float(db.std()),'values':[round(float(v),3) for v in db]},
      'estimatedPostManifestLUFS':None}
    result['estimatedPostManifestLUFS']=result['integratedLUFS']+20*math.log10(VOLUMES[state])
    checks={'correctCodec':result['codec']=={'wav':'pcm_s16le','ogg':'vorbis','mp3':'mp3'}[path.suffix[1:]],
      'exactDuration':result['durationExact'],'stereo44100':result['sampleRate']==SR and result['channels']==2,
      'noClipping':result['clippedSamples']==0,'truePeakHeadroom':result['truePeakDbTP']< -3.5,
      'loudnessTargetRange':-21.5<result['integratedLUFS']< -18.8,'dcBelow0001':result['dcOffsetMax']<.0001,
      'monoLossBelow1dB':result['monoFoldDownDb']> -1}
    if looped(state):checks['loopStepBelowTrack99p']=result['boundaryDeltaVsTrack99p']<1
    else:checks['finiteCodaBelowMinus55dBFS']=result['ending100msPeakDbFS']< -55
    result['checks']=checks;result['passed']=all(checks.values());return result

def preserve_pilots(output,source_root):
    for rel,expected in PILOT_HASHES.items():
        source=source_root/rel
        assert source.is_file(),f'Missing accepted pilot input: {source}'
        assert hashlib.sha256(source.read_bytes()).hexdigest()==expected,f'Accepted pilot hash mismatch: {source}'
    results={}
    for rel,expected in PILOT_HASHES.items():
        source=source_root/rel;target=output/rel
        if source.resolve()!=target.resolve():shutil.copyfile(source,target)
        results[rel]={'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'matchesAcceptedPilot':hashlib.sha256(target.read_bytes()).hexdigest()==expected}
    return results

def midi_export(path,notes,drums,state):
    previous=core.BEATS;core.BEATS=BEATS[state]
    try:core.midi_export(path,notes,drums,TITLES[state])
    finally:core.BEATS=previous

def render(state,output):
    seed=SEED+sum(map(ord,state));rng=np.random.default_rng(seed)
    notes,drums=composition(state);beats=BEATS[state];is_loop=looped(state)
    mix=np.zeros((round(beats*BEAT*SR),2),np.float32);add=core.add_periodic if is_loop else finite_add
    for note in notes:add(mix,core.synth(note),note.beat*BEAT,note.pan)
    for b,kind,v,pan in drums:add(mix,core.percussion(kind,v,rng),b*BEAT,pan)
    mix=core.room(mix) if is_loop else finite_room(mix)
    for sos in [butter(2,48,btype='highpass',fs=SR,output='sos'),butter(2,6900,btype='lowpass',fs=SR,output='sos')]:
        mix=core.periodic_filter(mix,sos) if is_loop else sosfilt(sos,mix,axis=0).astype(np.float32)
    mix=.95*mix+.05*np.tanh(mix)
    if is_loop:mix-=mix.mean(axis=0,dtype=np.float64).astype(np.float32)
    else:
        fade=round(1.4*SR);mix[-fade:]*=np.linspace(1,0,fade)[:,None]**1.8
    mix*=.10/np.sqrt(np.mean(mix**2))
    calibration=output/'evidence/intermediates'/f'{state}-calibration.wav';write(calibration,SR,mix)
    measured=core.loudness(calibration);gain=min(TARGET[state]-measured['integratedLUFS'],-4.3-measured['truePeakDbTP'])
    mix*=10**(gain/20);mix+=(rng.uniform(-.5,.5,mix.shape)+rng.uniform(-.5,.5,mix.shape)).astype(np.float32)/32768
    pcm=np.clip(np.rint(mix*32768),-32768,32767).astype(np.int16);wav=output/'masters'/f'{state}.wav';write(wav,SR,pcm)
    for ext,args in [('ogg',['-codec:a','libvorbis','-q:a','5']),('mp3',['-codec:a','libmp3lame','-b:a','128k','-write_xing','1'])]:
        subprocess.run(['ffmpeg','-y','-v','error','-i',str(wav),'-map_metadata','-1',*args,str(output/'assets'/f'{state}.{ext}')],check=True)
    midi_export(output/'masters'/f'{state}.mid',notes,drums,state)
    score={'suite':'Hollow Lanterns','title':TITLES[state],'state':state,'key':KEYS[state],'bpm':BPM,'timeSignature':[4,4],
      'bars':beats//4,'beats':beats,'durationSeconds':beats*BEAT,'loop':is_loop,'seed':seed,'form':FORMS[state],
      'harmony':[{'beat':b,'symbol':s,'bassMidi':r,'voicing':v} for b,s,r,v in HARMONIES[state]],
      'melody':MELODIES[state],'notes':[asdict(n) for n in notes],
      'percussion':[{'beat':b,'instrument':k,'velocity':v,'pan':p} for b,k,v,p in drums],
      'midiLimit':'GM programs approximate the custom pilot voices and do not reproduce the master.',
      'source':'New state arrangement using the exact retained Hollow Lanterns pilot synthesizer.'}
    if is_loop:score.update({'loopStart':0,'loopEnd':beats*BEAT})
    (output/'masters'/f'{state}.score.json').write_text(json.dumps(score,indent=2)+'\n')
    result={'title':TITLES[state],'noteCount':len(notes),'percussionCount':len(drums),'renderGainDb':gain,
       'codecs':{ext:verify(output/('masters' if ext=='wav' else 'assets')/f'{state}.{ext}',state) for ext in ['wav','ogg','mp3']}}
    print(json.dumps({'state':state,'codecs':{ext:{key:row[key] for key in ['durationSeconds','integratedLUFS','truePeakDbTP','boundaryDeltaDbFS','boundaryCurvatureVsLocal99p','ending100msPeakDbFS','passed']} for ext,row in result['codecs'].items()}}),flush=True)
    return result

def distinction(reference_path=None):
    import ast
    cached=reference_path or BASE/'provenance/reference-melody-tables.json'
    if cached.exists():references=json.loads(cached.read_text())
    else:
        # When installed alongside the existing composers, parse literal tables
        # for comparison only. No existing music code is imported or rendered.
        references={}
        for bank,name in [('Christmas','compose_frontier.py'),('Mythic','compose_mythic.py')]:
            path=BASE/name;tables={}
            for node in ast.parse(path.read_text()).body:
                if isinstance(node,ast.Assign):
                    for target in node.targets:
                        if isinstance(target,ast.Name) and target.id in ['EXP_MELODY','COMBAT_MELODY']:
                            tables[target.id]=ast.literal_eval(node.value)
            references[bank]={'tables':tables,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    out={}
    melodies={**MELODIES,'exploration':core.EXP_MELODY,'combat':core.COMBAT_MELODY}
    for bank,reference in references.items():
        old=[core.melody_signature(p) for name in ['EXP_MELODY','COMBAT_MELODY'] for p in reference['tables'][name]]
        out[bank]={state:[i+1 for i,p in enumerate(phrases) if p and core.melody_signature(p) in old] for state,phrases in melodies.items()}
    assert all(not bars for bank in out.values() for bars in bank.values())
    return {'transpositionEquivalentCompleteMelodyBars':out,'limit':'Relative pitches plus exact rhythms/durations of a full bar only. Not a catalog search or legal originality proof.'}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--preserve-pilots',type=Path,default=BASE,help='Accepted pilot directory with assets/ and masters/; exact embedded hashes are required.')
    parser.add_argument('--reference-tables',type=Path,help='Optional comparison-only reference melody JSON; otherwise use bundled provenance or adjacent reference composers.')
    parser.add_argument('--track',choices=['all',*STATES],default='all');parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
    output=args.output.resolve()
    pilot_source=args.preserve_pilots.resolve()
    if output==pilot_source and (pilot_source/'pilot-manifest.json').exists():parser.error('Do not write a complete bank into the accepted pilot directory.')
    for name in ['assets','masters','evidence/intermediates','provenance']:(output/name).mkdir(parents=True,exist_ok=True)
    preservation=preserve_pilots(output,pilot_source)
    report_path=output/'validation.json';report=json.loads(report_path.read_text()) if report_path.exists() else {}
    report.update({'suite':'Hollow Lanterns','pilotOnly':False,'bpm':BPM,'sampleRate':SR,
      'listeningStatus':'No subjective listening, browser/game transition or physical-device audition performed.',
      'composerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'retainedPilotComposerSha256':hashlib.sha256((BASE/'compose_hollow_lanterns_core.py').read_bytes()).hexdigest(),
      'toolchain':{'python':sys.version,'numpy':np.__version__,'scipy':scipy.__version__,'ffmpeg':subprocess.run(['ffmpeg','-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]},
      'pilotPreservation':preservation,'distinction':distinction(args.reference_tables)})
    report.setdefault('tracks',{})
    for state in STATES:
        if state in ['exploration','combat'] or args.track in ['all',state]:
            if state not in NEW_STATES or args.verify_only:
                score=json.loads((output/'masters'/f'{state}.score.json').read_text())
                report['tracks'][state]={'title':TITLES[state],'noteCount':len(score['notes']),'percussionCount':len(score['percussion']),
                  'preservedPilot':state not in NEW_STATES,'codecs':{ext:verify(output/('masters' if ext=='wav' else 'assets')/f'{state}.{ext}',state) for ext in ['wav','ogg','mp3']}}
            else:report['tracks'][state]=render(state,output)
    report['completeBank']=set(report['tracks'])==set(STATES)
    report['allSignalChecksPassed']=all(c['passed'] for t in report['tracks'].values() for c in t['codecs'].values())
    manifest={};local={}
    for state in STATES:
        if state not in report['tracks']:continue
        entry={'src':f'assets/audio/halloween/{state}.ogg','fallback':f'assets/audio/halloween/{state}.mp3','bpm':BPM,'duration':BEATS[state]*BEAT,
          'loop':looped(state),'volume':VOLUMES[state],'title':TITLES[state],'key':KEYS[state],'bars':BEATS[state]//4,'timeSignature':[4,4]}
        if looped(state):entry.update({'loopStart':0,'loopEnd':BEATS[state]*BEAT})
        manifest[state]=entry;local[state]={**entry,'src':f'assets/{state}.ogg','fallback':f'assets/{state}.mp3'}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(output/'review-manifest.json').write_text(json.dumps(local,indent=2)+'\n')
    report['budgetAssumptions']={'encodedAssetBytes':sum(c['bytes'] for t in report['tracks'].values() for ext,c in t['codecs'].items() if ext!='wav'),
      'maximumDecodedTrackFrames':2646000,'decodedFloat32StereoBytesPer60SecondTrack':2646000*2*4,
      'sharedCacheMaximumEntriesIncludingPending':3,'connectedMusicSourceMaximum':2,
      'worstCaseThreeDecoded60SecondTracksBytes':3*2646000*2*4,
      'conservativeCachePlusTwoDistinctSourceBuffersBytes':5*2646000*2*4,
      'note':'Inherited runtime contract assumptions only; no runtime edit, browser test or integration is part of bank authoring. Three entries are shared across all themes. Cache residency is not a whole-process memory cap: two connected sources can still reference evicted buffers. A conservative five-distinct-buffer allowance excludes decoder temporaries, garbage collection lag and other audio. WAV/MIDI/scores are editing evidence, not browser assets.'}
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    if not report['allSignalChecksPassed']:raise SystemExit('A signal check failed; inspect validation.json.')

if __name__=='__main__':main()
