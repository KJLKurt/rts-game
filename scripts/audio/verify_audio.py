#!/usr/bin/env python3
"""Verify shipped codecs technically. This script does not listen or judge musical quality."""
from pathlib import Path
import hashlib,json,re,subprocess
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
entries=json.loads((ROOT/'public/assets/audio/manifest.json').read_text())
report={'method':'FFmpeg decoded PCM and EBU R128; no subjective listening','cues':{}}
for name,entry in entries.items():
    row={'title':entry['title'],'loop':entry['loop'],'durationSeconds':entry['duration'],'codecs':{}}
    for codec,key in [('ogg','src'),('mp3','fallback')]:
        path=ROOT/'public'/entry[key]
        metadata=json.loads(subprocess.run(['ffprobe','-v','error','-select_streams','a:0','-show_entries','stream=sample_rate,channels','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)['streams'][0]
        rate=int(metadata['sample_rate']);assert metadata['channels']==2
        decoded=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True).stdout
        audio=np.frombuffer(decoded,np.float32).reshape(-1,2)
        levels=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-19:TP=-3:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
        loud=json.loads(re.search(r'\{\s*"input_i"[\s\S]+?\}',levels).group())
        delta=float(np.max(np.abs(audio[0]-audio[-1])));maximum_step=float(np.max(np.abs(np.diff(audio,axis=0))))
        result={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sampleRate':rate,'frames':len(audio),'durationExact':len(audio)==round(entry['duration']*rate),'integratedLUFS':float(loud['input_i']),'truePeakDbTP':float(loud['input_tp']),'clippedSamples':int(np.count_nonzero(np.abs(audio)>=1)),'dcOffsetMax':float(np.max(np.abs(np.mean(audio.astype(float),axis=0)))),'stereoCorrelation':round(float(np.corrcoef(audio.T)[0,1]),4),'boundaryDelta':delta,'maxSampleStep':maximum_step,'seamStepBelowTrackMax':delta<maximum_step}
        assert result['durationExact'] and result['clippedSamples']==0,(name,codec,result)
        assert result['truePeakDbTP']<-3 and result['dcOffsetMax']<.0001,(name,codec,result)
        if entry['loop']:assert result['seamStepBelowTrackMax'],(name,codec,result)
        row['codecs'][codec]=result
    report['cues'][name]=row
report['totalEncodedBytes']=sum(codec['bytes'] for row in report['cues'].values() for codec in row['codecs'].values())
(ROOT/'docs/AUDIO_VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({name:{ext:{key:value for key,value in codec.items() if key in ('integratedLUFS','truePeakDbTP','durationExact')} for ext,codec in row['codecs'].items()} for name,row in report['cues'].items()},indent=2))
