#!/usr/bin/env python3
"""Original sample-free Mythic bank; never modifies the Christmas score/assets.

Reuses compose_frontier's note model, oscillator voices, envelopes, percussion,
periodic mixing, room, MIDI writer and export conventions. New score tables and
two additional mathematical voices are authored here. No network or samples.
"""
from dataclasses import asdict, replace
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import shutil
import struct
import subprocess
import sys

import numpy as np
import scipy
from scipy.io.wavfile import write
from scipy.signal import butter, sosfilt

sys.dont_write_bytecode = True
import compose_frontier as core

SR, BPM, BEAT, TAU = core.SR, core.BPM, core.BEAT, core.TAU
SEED = 20261009
DEFAULT_OUTPUT = Path(__file__).resolve().parents[3] / 'mythic-audio-evidence/mythic-bank'
TARGET_LUFS = {'menu':-20.2,'exploration':-19.7,'tension':-19.7,'combat':-19.1,
               'victory':-19.0,'defeat':-20.2}

# E modal language with a characteristic raised sixth in exploration and a
# darker C-natural/B-dominant response in combat. These are newly written
# harmonic/phrase sequences, not renamed/transposed Christmas note tables.
EXP_HARMONY = [
    ('Em(add9)',40,[55,59,64,66]), ('D/E',40,[54,57,62,66]),
    ('A(add9)/E',40,[57,59,61,64]), ('Em',40,[55,59,64,67]),
    ('Gmaj7',43,[55,59,62,66]), ('D/F#',42,[54,57,62,66]),
    ('A(add9)',45,[57,59,61,64]), ('Bsus4',47,[54,59,64,66]),
    ('Cmaj7',48,[55,59,60,64]), ('G/B',47,[55,59,62,67]),
    ('Am(add9)',45,[57,59,60,64]), ('Em/G',43,[55,59,64,67]),
    ('D(add9)',38,[54,57,62,64]), ('A/C#',37,[57,61,64,69]),
    ('Em/B',47,[55,59,64,67]), ('Bsus4',47,[54,59,64,66]),
    ('Em(add9)',40,[55,59,64,66]), ('Gmaj7/D',38,[55,59,62,66]),
    ('A(add9)',45,[57,59,61,64]), ('Em/G',43,[55,59,64,67]),
    ('Cmaj7',48,[55,59,60,64]), ('D(add9)',38,[54,57,62,64]),
    ('A/E',40,[57,61,64,69]), ('Bsus4',47,[54,59,64,66]),
]
EXP_MELODY = [
    [(0,59,1.45),(1.75,64,.70),(3,66,.80)],
    [(.5,69,1.30),(2.25,66,.65),(3.25,62,.55)],
    [(0,64,1.25),(1.5,61,.75),(2.75,59,.90)],
    [(.25,55,.80),(1.5,59,.80),(2.75,64,.95)],
    [(0,67,1.60),(2,66,.55),(3,62,.75)],
    [(.5,64,.75),(1.75,66,1.65)],
    [(0,69,.75),(1,68,.45),(1.75,66,.75),(3,64,.70)],
    [(.25,66,1.0),(1.75,64,.85),(3,59,.70)],
    [(0,71,1.70),(2.25,67,.70),(3.25,64,.55)],
    [(.5,62,.75),(1.75,67,1.65)],
    [(0,69,1.2),(1.5,71,.45),(2.25,72,.65),(3.25,71,.55)],
    [(.25,67,.80),(1.5,64,1.85)],
    [(0,66,.80),(1.25,69,.55),(2.25,74,1.25)],
    [(.5,73,1.2),(2,69,.75),(3.25,68,.50)],
    [(0,67,1.15),(1.5,66,.70),(2.75,64,.90)],
    [(.5,66,.8),(2,64,.65),(3,59,.70)],
    [(0,64,1.45),(1.75,59,.70),(3,66,.80)],
    [(.5,67,1.30),(2.25,71,.65),(3.25,69,.55)],
    [(0,69,.8),(1.25,68,.50),(2,66,1.45)],
    [(.25,64,.85),(1.5,59,.75),(2.75,55,.90)],
    [(0,59,1.40),(1.75,64,.70),(3,67,.80)],
    [(.5,69,.80),(1.75,66,1.60)],
    [(0,64,1.30),(1.75,61,.85),(3,59,.70)],
    [(.25,54,.80),(1.5,59,1.10),(3,66,.70)],
]
COMBAT_HARMONY = [
    ('Em',40,[55,59,64,67]), ('Em/D',38,[55,59,64,67]),
    ('Cmaj7',36,[55,59,60,64]), ('Dsus2',38,[57,62,64,69]),
    ('Em',40,[55,59,64,67]), ('G6',43,[55,59,62,64]),
    ('Am',45,[57,60,64,69]), ('B7',47,[57,59,63,66]),
    ('Em',40,[55,59,64,67]), ('C/E',40,[55,60,64,67]),
    ('Am',45,[57,60,64,69]), ('B7/F#',42,[57,59,63,66]),
    ('Cmaj7',36,[55,59,60,64]), ('D',38,[54,57,62,66]),
    ('Em/B',47,[55,59,64,67]), ('B7',47,[57,59,63,66]),
    ('Em',40,[55,59,64,67]), ('G/D',38,[55,59,62,67]),
    ('Cmaj7',36,[55,59,60,64]), ('Am',45,[57,60,64,69]),
    ('Em/G',43,[55,59,64,67]), ('D/F#',42,[54,57,62,66]),
    ('Cmaj7',36,[55,59,60,64]), ('B7',47,[57,59,63,66]),
]
COMBAT_MELODY = [
    [(0,59,.45),(.75,64,.55),(1.5,67,.45),(2.5,66,.90)],
    [(.25,64,.65),(1.25,59,.45),(2,55,.65),(3.25,59,.45)],
    [(0,60,.75),(1,64,.40),(1.75,67,.65),(3,71,.55)],
    [(.5,69,.65),(1.5,64,.45),(2.25,62,1.10)],
    [(0,64,.45),(.75,67,.55),(1.5,71,.45),(2.5,69,.90)],
    [(.25,67,.65),(1.25,64,.40),(2,62,.65),(3.25,59,.45)],
    [(0,60,.70),(1,64,.45),(1.75,69,.65),(3,67,.55)],
    [(.5,66,.65),(1.5,63,.45),(2.25,59,1.10)],
    [(0,71,.90),(1.5,67,.60),(2.5,64,.45),(3.25,66,.40)],
    [(.25,67,.60),(1.25,72,.70),(2.5,71,.90)],
    [(0,69,.75),(1.25,64,.50),(2,60,.60),(3,64,.65)],
    [(.5,63,.80),(1.75,66,.60),(2.75,69,.75)],
    [(0,67,.70),(1,71,.45),(1.75,72,.65),(3,76,.55)],
    [(.5,74,.65),(1.5,69,.45),(2.25,66,1.10)],
    [(0,67,.85),(1.5,64,.60),(2.5,59,.85)],
    [(.25,63,.60),(1.25,66,.75),(2.5,59,.90)],
    [(0,59,.45),(.75,64,.55),(1.5,67,.45),(2.5,71,.90)],
    [(.25,74,.65),(1.25,71,.45),(2,67,.65),(3.25,62,.45)],
    [(0,64,.75),(1,60,.45),(1.75,59,.65),(3,55,.55)],
    [(.5,57,.65),(1.5,60,.45),(2.25,64,1.10)],
    [(0,67,.45),(.75,64,.55),(1.5,59,.45),(2.5,55,.90)],
    [(.25,57,.65),(1.25,62,.45),(2,66,.65),(3.25,69,.45)],
    [(0,67,.75),(1,64,.45),(1.75,60,.65),(3,59,.55)],
    [(.5,57,.60),(1.5,54,.45),(2.25,59,.55),(3.25,63,.45)],
]


def note(events, instrument, beat, midi, duration, velocity=.3, pan=0):
    core.note(events, instrument, beat, midi, duration, velocity, pan)


def synth_note(event):
    """Two new additive voices; the remaining voices use the retained synth."""
    if event.instrument not in ('viol', 'lute'):
        return core.synth_note(event)
    gate = event.duration * BEAT
    release = .38 if event.instrument == 'viol' else .48
    t = np.arange(round((gate + release) * SR), dtype=np.float64) / SR
    phase = TAU * core.hz(event.midi) * t
    if event.instrument == 'viol':
        # Slow, deliberately small vibrato; soft harmonic rolloff avoids a
        # sharp synthetic string edge on small speakers. No recorded bow noise.
        y = np.zeros_like(t)
        for detune, weight in ((.9982, .45), (1.0018, .55)):
            p = phase * detune + .10 * np.sin(TAU * 4.3 * t) * (1 - np.exp(-t / .5))
            y += weight * sum(np.sin(k * p + .09 * k) / k**1.65 for k in range(1, 9))
        y *= core.adsr(t, gate, .075, .25, .68, release) * .42
    else:
        y = sum(np.sin(k * phase + .07 * k) * np.exp(-t * (2.5 + .65 * k)) / k**1.55
                for k in range(1, 9))
        y *= (1 - np.exp(-t / .006)) * np.where(t > gate, np.exp(-(t-gate) / .13), 1) * .58
    y *= event.velocity
    ramp = min(128, len(y) // 2)
    y[:ramp] *= np.linspace(0, 1, ramp)
    y[-ramp:] *= np.linspace(1, 0, ramp)
    return y.astype(np.float32)


def exploration():
    notes, drums = [], []
    for bar, (_, root, chord) in enumerate(EXP_HARMONY):
        section = bar // 8
        for j, pitch in enumerate(chord):
            note(notes, 'viol', bar*4+.015, pitch, 3.82, .125 if section != 1 else .10,
                 (-.32, -.10, .10, .32)[j])
        note(notes, 'bass', bar*4, root, 2.65, .28)
        if bar % 2:
            note(notes, 'bass', bar*4+3, root+12, .60, .13)
        # A measured two-beat pluck response, with a different second phrase.
        pattern = [(0, 0), (1.5, 2), (2.75, 1)] if section != 1 else [(.75, 1), (2, 3)]
        for beat, index in pattern:
            note(notes, 'lute', bar*4+beat, chord[index]+(12 if index == 0 else 0),
                 .72, .20 if beat == 0 else .15, -.22)
        lead = 'flute' if section == 1 else 'horn'
        core.phrase(notes, lead, bar, EXP_MELODY[bar], .30 if lead == 'horn' else .27, .10)
        # Descending woodwind answers sit in melodic rests, rather than a
        # constant decorative bell layer. Last phrase changes the answer shape.
        if section != 1 and bar % 4 in (1, 3):
            for beat, pitch in ((0, chord[2]+12), (1.25, chord[1]+12)):
                note(notes, 'flute', bar*4+beat, pitch, .68, .13, -.08)
        if section == 2 and bar % 4 == 0:
            note(notes, 'horn', bar*4+2.25, chord[0], 1.10, .12, -.16)
        if bar % 2 == 0:
            drums.append((bar*4, 'tom', .105, -.05))
        if section != 1:
            drums.append((bar*4+2.5, 'shaker', .048, .16))
    return notes, drums, 96


def combat():
    notes, drums = [], []
    for bar, (_, root, chord) in enumerate(COMBAT_HARMONY):
        section = bar // 8
        for j, pitch in enumerate(chord):
            note(notes, 'pad', bar*4, pitch, 3.78, .075, (-.3, -.1, .1, .3)[j])
        for beat, pitch, duration, velocity in ((0,root,.70,.32), (1.5,root,.45,.23),
                                                  (2.5,root+12,.60,.19)):
            note(notes, 'bass', bar*4+beat, pitch, duration, velocity)
        # Bows use a 3+3+2 accent grouping with gaps; plucks answer on offbeats.
        pulse = [(0,0),(.5,1),(1.5,2),(2,1),(3,0),(3.5,2)]
        if section == 1:
            pulse = [(0,0),(1.5,1),(2.5,2),(3.5,1)]
        for beat, index in pulse:
            note(notes, 'viol', bar*4+beat, chord[index], .31,
                 .18 if beat in (0,1.5,3) else .11, -.18)
        for beat, index in ((.75,2),(2.25,1)):
            note(notes, 'lute', bar*4+beat, chord[index]+12, .33, .135, .19)
        lead = 'flute' if section == 1 else 'horn'
        core.phrase(notes, lead, bar, COMBAT_MELODY[bar], .31 if lead == 'horn' else .29, .07)
        if section == 2 and bar % 2 == 0:
            core.phrase(notes, 'horn', bar,
                        [(beat,pitch-12,duration) for beat,pitch,duration in COMBAT_MELODY[bar]],
                        .11, -.09)
        drums.extend([(bar*4,'kick',.26,0), (bar*4+1.5,'tom',.18,-.12),
                      (bar*4+3,'tom',.145,.12)])
        if section != 1:
            drums.append((bar*4+2,'snare',.115,-.04))
        for beat in (0,1.5,2.5,3.5):
            drums.append((bar*4+beat,'shaker',.068 if beat == 0 else .042,.15))
        if bar % 8 == 7:
            drums.append((bar*4+3.5,'tom',.13,0))
    return notes, drums, 96


MENU_BARS = list(range(8))+list(range(16,24))
MENU_HARMONY = [EXP_HARMONY[i] for i in MENU_BARS]
MENU_MELODY = [EXP_MELODY[i] for i in MENU_BARS]
TENSION_HARMONY = COMBAT_HARMONY[:16]
TENSION_MELODY = [[(.5,phrase[0][1],1.0),(2.25,phrase[1][1],.80)]
                   for phrase in COMBAT_MELODY[:16]]
VICTORY_HARMONY = [('Aadd9',45,[57,59,61,64]),('B',47,[54,59,63,66]),
                   ('Emaj9',40,[56,59,64,66])]
DEFEAT_HARMONY = [('Cmaj7',36,[55,59,60,64]),('Am(add9)',45,[57,59,60,64]),
                  ('Bsus4',47,[54,59,64,66]),('Em',40,[55,59,64,67])]
VICTORY_MELODY = [[(0,59,.62),(1,64,.62),(2,66,.65),(3,68,.86)],
                   [(0,71,.55),(.75,69,.50),(1.5,68,.50),(2,76,3.6)],[]]
DEFEAT_MELODY = [[(0,59,.86),(1.25,64,.86),(2.5,66,1.10)],
                  [(.25,64,1.0),(1.5,62,.95),(2.75,59,.9)],
                  [(.25,57,.85),(1.5,55,1.15)],[(0,52,2.1)]]


def menu():
    notes, drums = [], []
    for bar,(_,root,chord) in enumerate(MENU_HARMONY):
        for j,pitch in enumerate(chord):
            note(notes,'viol',bar*4,pitch,3.8,.105,(-.30,-.10,.10,.30)[j])
        note(notes,'bass',bar*4,root,3.0,.22)
        for beat,index in ((.25,0),(2.25,2)):
            note(notes,'lute',bar*4+beat,chord[index]+(12 if index==0 else 0),1.0,.16,-.20)
        core.phrase(notes,'horn' if bar<8 else 'flute',bar,MENU_MELODY[bar],
                    .255 if bar<8 else .245,.09)
        if bar%4==3:
            note(notes,'horn',bar*4+.5,chord[0],1.4,.09,-.12)
    return notes,drums,64


def tension():
    notes,drums=[],[]
    for bar,(_,root,chord) in enumerate(TENSION_HARMONY):
        for j,pitch in enumerate(chord):
            note(notes,'viol',bar*4,pitch,3.80,.105,(-.30,-.10,.10,.30)[j])
        note(notes,'bass',bar*4,root,2.8,.24)
        for beat,index in ((.25,0),(1.75,2),(3.25,1)):
            note(notes,'lute',bar*4+beat,chord[index],.48,.21 if beat==.25 else .16,-.18)
        if bar%2==0 or bar>=8:
            core.phrase(notes,'flute' if bar<8 else 'horn',bar,TENSION_MELODY[bar],.25,.08)
        if bar%2:
            note(notes,'horn',bar*4+.75,chord[0],1.15,.11,-.08)
        if bar%2==0:
            drums.append((bar*4,'tom',.135,0))
        for beat in (1,3):
            drums.append((bar*4+beat,'shaker',.052 if bar<8 else .066,.10))
    return notes,drums,64


def victory():
    notes,drums=[],[]
    for bar,phrase in enumerate(VICTORY_MELODY):
        core.phrase(notes,'horn',bar,phrase,.34,.06)
        if bar==1:
            core.phrase(notes,'flute',bar,phrase,.16,-.07)
    for start,duration,(_,root,chord) in zip((0,3,6),(2.7,2.7,4.75),VICTORY_HARMONY):
        note(notes,'bass',start,root,duration,.30)
        for j,pitch in enumerate(chord):
            note(notes,'viol',start,pitch,duration,.16,(-.30,-.10,.10,.30)[j])
        for j,pitch in enumerate(chord):
            note(notes,'lute',start+j*.18,pitch+12,1.5,.16,-.20+j*.10)
    note(notes,'horn',6,64,3.4,.14,-.12)
    drums=[(0,'tom',.18,-.10),(1,'tom',.13,.10),(3,'tom',.18,0),(6,'kick',.25,0)]
    return notes,drums,12


def defeat():
    notes,drums=[],[]
    for bar,phrase in enumerate(DEFEAT_MELODY):
        core.phrase(notes,'flute',bar,phrase,.26,.06)
    for start,duration,(_,root,chord) in zip((0,4,8,12),(3.75,3.75,3.75,2.9),DEFEAT_HARMONY):
        note(notes,'bass',start,root,duration,.23)
        for j,pitch in enumerate(chord):
            note(notes,'viol',start,pitch,duration,.13,(-.30,-.10,.10,.30)[j])
        for j,pitch in enumerate(chord[:3]):
            note(notes,'lute',start+.25+j*.5,pitch,.9,.14,-.17+j*.10)
    note(notes,'horn',12,52,2.3,.14,-.08)
    return notes,drums,16


TRACKS = {'menu':menu,'exploration':exploration,'tension':tension,'combat':combat,
          'victory':victory,'defeat':defeat}
TITLES = {'menu':'The Citadel Gates','exploration':'Banners Above the Vale',
          'tension':'Watchfires on the Rampart','combat':'The Ironwatch Muster',
          'victory':'Standards at Dawn','defeat':'The Silent Courtyard'}
HARMONIES = {'menu':MENU_HARMONY,'exploration':EXP_HARMONY,'tension':TENSION_HARMONY,
             'combat':COMBAT_HARMONY,'victory':VICTORY_HARMONY,'defeat':DEFEAT_HARMONY}
MELODIES = {'menu':MENU_MELODY,'exploration':EXP_MELODY,'tension':TENSION_MELODY,
           'combat':COMBAT_MELODY,'victory':VICTORY_MELODY,'defeat':DEFEAT_MELODY}
KEYS = {'menu':'E minor / Dorian modal mixture','exploration':'E minor / Dorian modal mixture',
        'tension':'E minor','combat':'E minor','victory':'E major','defeat':'E minor'}


def loudness(path):
    result = subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af',
        'loudnorm=I=-19:TP=-3:LRA=11:print_format=json','-f','null','-'],
        capture_output=True, text=True, check=True)
    match = re.search(r'\{\s*"input_i"[\s\S]+?\}', result.stderr)
    if not match:
        raise RuntimeError(f'No loudness result for {path}')
    values = json.loads(match.group())
    return {'integratedLUFS':float(values['input_i']), 'truePeakDbTP':float(values['input_tp']),
            'loudnessRangeLU':float(values['input_lra'])}


def verify(path, expected_frames, loop=True):
    meta = json.loads(subprocess.run(['ffprobe','-v','error','-select_streams','a:0',
        '-show_entries','stream=codec_name,sample_fmt,sample_rate,channels,duration',
        '-of','json',str(path)], capture_output=True,text=True,check=True).stdout)['streams'][0]
    decoded = subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(path),
        '-f','f32le','-acodec','pcm_f32le','-'], capture_output=True,check=True).stdout
    signal = np.frombuffer(decoded,np.float32).reshape(-1,2)
    delta = float(np.max(np.abs(signal[0]-signal[-1])))
    steps = np.abs(np.diff(signal,axis=0))
    sample_peak = float(np.max(np.abs(signal)))
    # Spectral balance and mono fold-down are measurable proxies only; they
    # are not a substitute for auditioning on a physical phone or headphones.
    mono = signal.mean(axis=1).astype(np.float64)
    mono_rms = float(np.sqrt(np.mean(mono**2)))
    stereo_rms = float(np.sqrt(np.mean(signal.astype(np.float64)**2)))
    # Inspect the derivative at the actual join against a local 20 ms window,
    # rather than comparing only with the largest transient anywhere in a cue.
    local_samples = round(.02*SR)
    local_steps = np.concatenate([steps[:local_samples],steps[-local_samples:]])
    before_slope = signal[-1]-signal[-2]
    seam_slope = signal[0]-signal[-1]
    after_slope = signal[1]-signal[0]
    slope_change = float(max(np.max(np.abs(seam_slope-before_slope)),
                             np.max(np.abs(after_slope-seam_slope))))
    local_curvature = np.concatenate([np.diff(signal[:local_samples],n=2,axis=0),
                                      np.diff(signal[-local_samples:],n=2,axis=0)])
    window = SR
    rms_windows = np.sqrt(np.mean(signal[:len(signal)//window*window].reshape(-1,window,2).astype(np.float64)**2,axis=(1,2)))
    rms_db = 20*np.log10(np.maximum(rms_windows,1e-12))
    result = {'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'decodedPcmSha256':hashlib.sha256(decoded).hexdigest(),
        'codec':meta['codec_name'],'sampleFormat':meta['sample_fmt'],
        'sampleRate':int(meta['sample_rate']),'channels':int(meta['channels']),
        'frames':len(signal),'durationSeconds':len(signal)/SR,
        'durationExact':len(signal)==expected_frames,
        **loudness(path),'samplePeakDbFS':20*math.log10(sample_peak),
        'clippedSamples':int(np.count_nonzero(np.abs(signal)>=1)),
        'dcOffsetMax':float(np.max(np.abs(np.mean(signal.astype(np.float64),axis=0)))),
        'stereoCorrelation':float(np.corrcoef(signal.T)[0,1]),
        'monoFoldDownDb':20*math.log10(mono_rms/stereo_rms),
        'boundaryDelta':delta, 'boundaryDeltaDbFS':20*math.log10(max(delta,1e-12)),
        'maxSampleStep':float(steps.max()),'sampleStep99p':float(np.quantile(steps,.99)),
        'seamStepBelowTrackMax':delta<float(steps.max()),
        'seamStepBelow99p':delta<float(np.quantile(steps,.99)),
        'joinWindowRmsBefore':float(np.sqrt(np.mean(signal[-int(.02*SR):]**2))),
        'joinWindowRmsAfter':float(np.sqrt(np.mean(signal[:int(.02*SR)]**2))),
        'seamLocalWindowMs':20,
        'seamStepVsLocal99p':delta/max(float(np.quantile(local_steps,.99)),1e-12),
        'seamSlopeChangeMax':slope_change,
        'seamSlopeChangeVsLocal99p':slope_change/max(float(np.quantile(np.abs(local_curvature),.99)),1e-12),
        'oneSecondRmsDb':{'minimum':float(rms_db.min()),'maximum':float(rms_db.max()),
                          'range':float(np.ptp(rms_db)), 'standardDeviation':float(np.std(rms_db)),
                          'values':[round(float(value),3) for value in rms_db]},
        'ending100msPeakDbFS':20*math.log10(max(float(np.max(np.abs(signal[-round(.1*SR):]))),1e-12)),
    }
    assert result['codec'] == {'wav':'pcm_s16le','ogg':'vorbis','mp3':'mp3'}[path.suffix[1:]]
    assert result['sampleRate']==SR and result['channels']==2
    assert result['durationExact'] and not result['clippedSamples'], result
    assert result['truePeakDbTP'] < -3 and result['dcOffsetMax'] < .0001, result
    assert -21 < result['integratedLUFS'] < -18, result
    if loop:
        assert result['seamStepBelowTrackMax'] and result['seamStepBelow99p'], result
    else:
        assert result['ending100msPeakDbFS'] < -55, result
    return result


def midi_export(path, notes, drums, beats):
    """Keep the retained GM exporter, then extend each track to the loop end."""
    core.midi_export(path,notes,drums,beats)
    instruments = list(dict.fromkeys(event.instrument for event in notes))
    last_ticks = [0] + [max(round((event.beat+event.duration)*480)
                            for event in notes if event.instrument==instrument)
                       for instrument in instruments]
    if drums:
        last_ticks.append(max(round(beat*480)+60 for beat,_,_,_ in drums))
    data = path.read_bytes()
    chunks = [data[:14]]
    offset = 14
    for last in last_ticks:
        assert data[offset:offset+4] == b'MTrk'
        length = struct.unpack('>I',data[offset+4:offset+8])[0]
        track = data[offset+8:offset+8+length]
        assert track[-4:]==b'\x00\xff\x2f\x00'
        delta = round(beats*480)-last
        assert delta >= 0
        vlq = [delta&127]
        delta >>= 7
        while delta:
            vlq.insert(0,(delta&127)|128)
            delta >>= 7
        track = track[:-4]+bytes(vlq)+b'\xff\x2f\x00'
        chunks.append(b'MTrk'+struct.pack('>I',len(track))+track)
        offset += 8+length
    assert offset == len(data)
    path.write_bytes(b''.join(chunks))


def normalized_phrase_signature(phrase):
    first = phrase[0][1]
    return [(beat, pitch-first, duration) for beat,pitch,duration in phrase]


def render(name, output):
    seed = SEED + sum(map(ord,name))
    core.rng = np.random.default_rng(seed)
    notes, drums, beats = TRACKS[name]()
    loop = name not in ('victory','defeat')
    frames = round(beats*BEAT*SR)
    mix = np.zeros((frames,2),np.float32)
    for event in notes:
        delta = 0 if event.beat % 4 < .05 else float(core.rng.uniform(-.005,.005))
        core.add_periodic(mix,synth_note(event),event.beat*BEAT+delta,event.pan,loop)
    for beat,kind,velocity,pan in drums:
        core.add_periodic(mix,core.drum(kind,velocity),beat*BEAT,pan,loop)
    mix = core.room_reverb(mix,loop)
    # Periodic filter pre-roll preserves the loop join; low-end control is
    # modestly firmer than the retained Christmas render for denser low brass.
    filters = [butter(2,55,btype='highpass',fs=SR,output='sos'),
               butter(2,7600,btype='lowpass',fs=SR,output='sos')]
    for filt in filters:
        if loop:
            mix = sosfilt(filt,np.concatenate([mix[-SR:],mix]),axis=0)[SR:].astype(np.float32)
        else:
            mix = sosfilt(filt,mix,axis=0).astype(np.float32)
    mix = .90*mix + .10*np.tanh(mix)
    mix -= mix.mean(axis=0,dtype=np.float64).astype(np.float32)
    if not loop:
        fade = round(1.6*SR)
        mix[-fade:] *= np.linspace(1,0,fade)[:,None]**1.6
    mix *= .12 / float(np.sqrt(np.mean(mix**2)))
    wav = output/'masters'/f'{name}.wav'
    calibration = output/'masters'/f'.{name}-calibration.wav'
    write(calibration,SR,mix)
    measured = loudness(calibration)
    gain_db = min(TARGET_LUFS[name]-measured['integratedLUFS'], -3.8-measured['truePeakDbTP'])
    mix *= 10**(gain_db/20)
    # TPDF dither to the final 16-bit master, with no loop fade or edge padding.
    mix += (core.rng.uniform(-.5,.5,mix.shape)+core.rng.uniform(-.5,.5,mix.shape)).astype(np.float32)/32768
    pcm = np.clip(np.rint(mix*32768),-32768,32767).astype(np.int16)
    write(wav,SR,pcm)
    calibration.unlink()
    for ext,args in [('ogg',['-codec:a','libvorbis','-q:a','5']),
                     ('mp3',['-codec:a','libmp3lame','-b:a','128k','-write_xing','1'])]:
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(wav),
            '-map_metadata','-1',*args,str(output/'assets'/f'{name}.{ext}')],check=True)
    # General MIDI is an editable note reduction, not a rendering of custom
    # timbres/reverb. Aliases use compatible built-in orchestral GM programs.
    aliases = {'viol':'pad','lute':'harp'}
    midi_notes = [replace(event,instrument=aliases.get(event.instrument,event.instrument)) for event in notes]
    midi_export(output/'masters'/f'{name}.mid',midi_notes,drums,beats)
    melody = MELODIES[name]
    harmony = HARMONIES[name]
    old_phrases = [normalized_phrase_signature(p) for p in core.EXP_MELODY+core.COMBAT_MELODY]
    matching_bars = [i for i,p in enumerate(melody) if p and normalized_phrase_signature(p) in old_phrases]
    assert not matching_bars, 'A full melody bar duplicates the retained score under transposition'
    score = {'suite':'Mythic','title':TITLES[name],'state':name,'bpm':BPM,'beats':beats,
        'bars':beats//4,'timeSignature':[4,4],'loop':loop,'durationSeconds':beats*BEAT,
        'key':KEYS[name],
        'seed':seed,'targetLUFS':TARGET_LUFS[name],
        'form':({'menu':['eight-bar quiet brass statement','eight-bar woodwind return'],
                 'exploration':['eight-bar brass statement','eight-bar woodwind development','eight-bar varied return'],
                 'tension':['eight-bar sparse fragments','eight-bar firmer horn watch'],
                 'combat':['eight-bar brass statement','eight-bar woodwind development','eight-bar varied return'],
                 'victory':['six-beat ascending fanfare','E-major arrival, held chord and finite release'],
                 'defeat':['broken exploration motif','descending answer','suspension','E-minor release']})[name],
        'harmony':[{'beat':(0,3,6)[i] if name=='victory' else i*4,'symbol':symbol,'bassMidi':root,'voicing':chord}
                   for i,(symbol,root,chord) in enumerate(harmony)],
        'melody':melody,'notes':[asdict(event) for event in notes],
        'percussion':[{'beat':beat,'instrument':kind,'velocity':velocity,'pan':pan}
                      for beat,kind,velocity,pan in drums],
        'midiVoiceAliases':aliases,'midiLimit':'GM playback differs from the synthesized master.'}
    (output/'masters'/f'{name}.score.json').write_text(json.dumps(score,indent=2)+'\n')
    result = {'title':TITLES[name],'bars':beats//4,'bpm':BPM,'durationSeconds':beats*BEAT,'loop':loop,
        'noteCount':len(notes),'percussionCount':len(drums),
        'transpositionEquivalentMelodyBarsVsChristmas':matching_bars,
        'codecs':{ext:verify(output/('masters' if ext=='wav' else 'assets')/f'{name}.{ext}',frames,loop)
                  for ext in ('wav','ogg','mp3')}}
    print(json.dumps({'state':name,**{ext:{key:row[key] for key in
        ('durationSeconds','integratedLUFS','truePeakDbTP','dcOffsetMax','boundaryDeltaDbFS')}
        for ext,row in result['codecs'].items()}}),flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--track',choices=['all',*TRACKS],default='all')
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    parser.add_argument('--preserve-pilots',type=Path,
                        help='Copy accepted exploration/combat deliverables byte-for-byte; render only other states')
    args = parser.parse_args()
    output = args.output.resolve()
    # Guard against accidental mutation of the currently shipped soundtrack.
    shipped = Path(__file__).resolve().parents[2]/'public/assets/audio'
    if output == shipped or shipped in output.parents:
        parser.error('Use an evidence/output directory, not shipped audio assets.')
    for directory in ('assets','masters'):
        (output/directory).mkdir(parents=True,exist_ok=True)
    report_path = output/'validation.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    report.update({'method':'Decoded FFmpeg PCM, ffprobe metadata and FFmpeg EBU R128 loudnorm; no subjective audition',
        'toolchain':{'python':sys.version.split()[0],'numpy':np.__version__,'scipy':scipy.__version__,
                     'ffmpeg':subprocess.run(['ffmpeg','-version'],capture_output=True,text=True,check=True).stdout.splitlines()[0]},
        'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'retainedComposerSha256':hashlib.sha256(Path(core.__file__).read_bytes()).hexdigest()})
    report.setdefault('cues',{})
    pilot_report = None
    if args.preserve_pilots:
        pilot_root = args.preserve_pilots.resolve()
        if pilot_root == output:
            parser.error('The accepted-pilot and bank directories must differ.')
        pilot_report = json.loads((pilot_root/'validation.json').read_text())
        report['preservedPilotSourceSha256'] = pilot_report['sourceSha256']
        report['preservedPilotFiles'] = []
    for name in TRACKS:
        if args.track in ('all',name):
            if pilot_report and name in ('exploration','combat'):
                for folder,extension in [('assets','ogg'),('assets','mp3'),('masters','wav'),
                                         ('masters','mid'),('masters','score.json')]:
                    relative = Path(folder)/f'{name}.{extension}'
                    source = pilot_root/relative
                    dest = output/relative
                    shutil.copyfile(source,dest)
                    checksum = hashlib.sha256(source.read_bytes()).hexdigest()
                    assert hashlib.sha256(dest.read_bytes()).hexdigest() == checksum
                    report['preservedPilotFiles'].append({'path':str(relative),'sha256':checksum,'byteIdentical':True})
                report['cues'][name] = pilot_report['cues'][name]
                report['cues'][name]['loop'] = True
                report['cues'][name]['compositionSourceSha256'] = pilot_report['sourceSha256']
                print(f'{name}: accepted pilot copied byte-for-byte; no synthesis or re-encoding',flush=True)
            else:
                report['cues'][name] = render(name,output)
                report['cues'][name]['compositionSourceSha256'] = report['sourceSha256']
            report_path.write_text(json.dumps(report,indent=2)+'\n')
    volumes = {'menu':.80,'exploration':.72,'tension':.71,'combat':.68,'victory':.68,'defeat':.73}
    manifest = {}
    for name in TRACKS:
        if name not in report['cues']:
            continue
        cue = report['cues'][name]
        duration = cue['codecs']['ogg']['durationSeconds']
        assert duration == cue['codecs']['mp3']['durationSeconds']
        entry = {'src':f'assets/audio/mythic/{name}.ogg',
                 'fallback':f'assets/audio/mythic/{name}.mp3',
                 'bpm':BPM,'duration':duration,'loop':name not in ('victory','defeat'),
                 'volume':volumes[name],'title':TITLES[name],'key':KEYS[name],
                 'bars':cue['bars'],'timeSignature':[4,4]}
        if entry['loop']:
            entry.update({'loopStart':0,'loopEnd':duration})
        manifest[name] = entry
        cue['manifestVolume'] = volumes[name]
        cue['estimatedOggLUFSAfterManifestGain'] = round(cue['codecs']['ogg']['integratedLUFS']+20*math.log10(volumes[name]),2)
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    report['totalEncodedBytes'] = sum(row['bytes'] for cue in report['cues'].values()
                                      for ext,row in cue['codecs'].items() if ext in ('ogg','mp3'))
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    (output/'PROVENANCE.md').write_text('''# Mythic soundtrack bank

Six newly composed, instrumental, sample-free arrangements for Frontier Command.
No music-generation service, artist prompt, commercial recording, sample pack,
soundfont, voice, downloaded instrument, external account or upload was used.
No existing song quotation or named-artist imitation was requested or used.
This describes the authoring process, not an exhaustive music-catalog similarity search.

- Menu: “The Citadel Gates”, E minor / Dorian modal mixture, 16 bars / 40 seconds.
- Exploration: “Banners Above the Vale”, E minor / Dorian mixture, 24 bars / 60 seconds.
- Tension: “Watchfires on the Rampart”, E minor, 16 bars / 40 seconds.
- Combat: “The Ironwatch Muster”, E minor, 24 bars / 60 seconds.
- Victory: “Standards at Dawn”, E major, 3 bars / 7.5 seconds, finite.
- Defeat: “The Silent Courtyard”, E minor, 4 bars / 10 seconds, finite.
- All cues use 4/4, 96 BPM, stereo 44,100 Hz audio.
- The 24-bar exploration/combat form is a deliberate three-section pilot within the requested
  40–80-second range, rather than the earlier guide's preferred 16/32-bar forms.
- Exploration/combat use new melody, harmony and rhythm tables, with three
  eight-bar sections from brass statement through woodwind development to return.
- Menu quietly restates the exploration motif; tension fragments the combat
  theme; victory changes the opening interval cell into an E-major arrival;
  defeat breaks the cell into a descending response and E-minor release.
- Low horns, flutes, bowed strings, muted plucked strings, round bass and quiet
  drum/shaker accents. No celesta, bell or marimba part appears in this bank.
- Original additive viol and lute voices extend compose_frontier.py's synthesis.
  Note model, envelopes, retained oscillator voices, percussion, periodic mixer,
  room-reverb implementation and GM MIDI writer come from that retained source.
- The original composer and all shipped assets are read-only inputs to this task.

## Files and regeneration

Run python3 scripts/audio/compose_mythic.py --output /path/to/evidence/mythic-bank
--preserve-pilots /path/to/evidence/mythic-pilots from the candidate checkout.
This copies accepted exploration/combat WAV, MIDI, score JSON and both codecs
byte-for-byte and renders only the four other states. --track selects one cue.
Without --preserve-pilots all selected cues regenerate; a newer source can differ.
The retained pilot source snapshot is provenance/compose_mythic.pilots.py.
The pilot validation and copied-file hash list preserve that distinct provenance.
Outputs: stereo 16-bit PCM
WAV, editable General MIDI, complete score JSON, Vorbis quality 5 and 128 kbps MP3.
GM instruments approximate the custom voices; a MIDI player will not reproduce
the WAV sound. PCM is deterministic within the recorded toolchain. Encoded Ogg
container bytes can change due to container serials, even with identical PCM.

## Mastering and technical evidence

Release tails and room reflections wrap into the beginning of each loop. The
periodic high-pass (55 Hz) and low-pass (7.6 kHz) controls precede conservative
saturation and fixed loudness gain. Loops have no end fade. Finite outcome
arrangements use a natural tail plus a gentle final 1.6-second fade, never wrapping.
Targets span -20.2 to -19.0 LUFS according to state, capped at -3.8 dBTP
before encoding. TPDF dither is added for 16-bit quantization. validation.json
contains measured codec identity, exact decoded frames, hashes, LUFS, true peak,
DC, clipping, stereo/mono fold-down, one-second RMS variation and loop-boundary
slope/curvature against a local 20 ms neighborhood. Finite outcomes additionally
require their last 100 ms to remain below -55 dBFS.

manifest.json uses assets/audio/mythic/<state>.ogg and MP3 fallback paths, measured
decoded durations, exact loop bounds and the existing conservative per-state
volume multipliers. The gain is applied once by the existing runtime; these are
not changes to user preference values. validation.json estimates post-manifest
LUFS from the measured Ogg loudness and fixed gain; it is not a game-mix measurement.

The transposition check compares each complete lead-melody bar's relative pitch,
rhythm and durations against both retained Christmas lead tables. It is a limited
mechanical distinction check, not proof of musical originality across all works.

## Review limits

No subjective listening, actual game transition audition, physical phone-speaker
test or headphones test is claimed. Low-pass, low-end control, moderate loudness
and a measured mono fold-down are technical precautions, not a listening pass.
A small sample-boundary step does not prove that the musical loop feels natural.
The pilot's independent waveform, spectrogram, RMS and seam review authorized
extension to this six-state bank. That was technical/compositional inspection,
not subjective listening acceptance. Actual device/transition audition remains open.
''')


if __name__ == '__main__':
    main()
