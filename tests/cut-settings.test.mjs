import test from 'node:test';
import assert from 'node:assert/strict';
import {CUT,CUT_DEFAULTS,CUT_BASELINE,CUT_FIELDS,CUT_STORAGE_KEY,CUT_PRESET_KEY,CUT_DEFAULTS_REVISION,applyCutSettings,sanitizeCutSettings,cutSettingsSnapshot,cutSettingsFromDraft,saveCutPreset,readCutPreset,restoreCutPreset,flushCutSettings} from '../dist/cut-settings.js';
import {cutKinematics,advanceCutFragment,cutCameraOffset} from '../dist/cut-motion.js';
import {cutParticles} from '../dist/cut-feedback.js';
import {BOMB_FIELDS,BOMB_DEFAULTS} from '../dist/bomb-settings.js';
import {SCORE_DEFAULTS} from '../dist/score-feedback.js';
import {NUCLEAR_FIELDS,NUCLEAR_DEFAULTS} from '../dist/nuclear-settings.js';
test('approved preset matches all requested parameters and retains meteor defaults',()=>{
  assert.equal(CUT_FIELDS.length,32+BOMB_FIELDS.length+Object.keys(SCORE_DEFAULTS).length+NUCLEAR_FIELDS.length);assert.deepEqual(CUT,CUT_DEFAULTS);
  assert.deepEqual(CUT_DEFAULTS,{meteorSpeed:30,meteorGravity:34,
    normalBase:2,normalExtra:2.8,alongBase:.3,alongExtra:.59,inherit:.7,speedFull:5,variation:.14,
    spinBase:540,spinExtra:720,hitStop:.075,hitCooldown:.18,burst:.2,spinRecovery:7,formation:.36,gravity:375,drag:.95,
    particleBase:18,particleExtra:15,particleSpeed:1.6,particleSize:2.9,particleLife:.46,flashFrames:4,flashWidth:6,
    bladeLife:.13,bladeExtra:.1,bladeWidth:1.2,bladeLength:.45,cameraBase:12,cameraExtra:10,cameraDuration:.19,...BOMB_DEFAULTS,...SCORE_DEFAULTS,...NUCLEAR_DEFAULTS});
});

test('upgrade replaces legacy cut drafts once, preserves meteor tuning, then honors new drafts',()=>{
  const legacy={version:1,values:{normalBase:10,particleSize:2,meteorSpeed:80,meteorGravity:120}};
  const upgraded=cutSettingsFromDraft(legacy);
  assert.equal(upgraded.normalBase,2);assert.equal(upgraded.particleSize,2.9);
  assert.equal(upgraded.meteorSpeed,80);assert.equal(upgraded.meteorGravity,120);
  assert.equal(cutSettingsFromDraft({...legacy,defaultsRevision:CUT_DEFAULTS_REVISION}).normalBase,10);
  assert.deepEqual(cutSettingsFromDraft(null),CUT_DEFAULTS);
});

test('explicit preset survives further auto-saved edits, restores all fields and reports storage failure',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}});
  try{
    assert.equal(readCutPreset(),null);assert.equal(restoreCutPreset(),false);
    applyCutSettings({...CUT_DEFAULTS,normalBase:5,meteorSpeed:80},{persist:false});const saved=cutSettingsSnapshot();
    assert.equal(saveCutPreset(),true);assert.deepEqual(readCutPreset().values,saved);
    applyCutSettings({normalBase:8,meteorSpeed:110},{persist:false});flushCutSettings();
    assert.equal(JSON.parse(data.get(CUT_STORAGE_KEY)).values.normalBase,8);
    assert.deepEqual(readCutPreset().values,saved,'auto-saving edits does not overwrite the manual snapshot');
    assert.equal(restoreCutPreset(),true);assert.deepEqual(CUT,saved);flushCutSettings();
    data.set(CUT_PRESET_KEY,'broken json');assert.equal(restoreCutPreset(),false);assert.deepEqual(CUT,saved);
    data.set(CUT_PRESET_KEY,JSON.stringify({version:1,values:{normalBase:'invalid'}}));assert.equal(readCutPreset(),null);
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}}});
    assert.equal(saveCutPreset(),false);assert.equal(readCutPreset(),null);
  }finally{
    applyCutSettings(CUT_DEFAULTS,{persist:false});flushCutSettings();
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;
  }
});

test('older saved settings acquire the new fall parameters without losing cut tuning',()=>{
  const migrated=sanitizeCutSettings({normalBase:10,hitStop:.12});
  assert.equal(migrated.normalBase,10);assert.equal(migrated.hitStop,.12);
  assert.equal(migrated.meteorSpeed,30);assert.equal(migrated.meteorGravity,34);
  assert.ok(migrated.meteorSpeed>CUT_BASELINE.meteorSpeed);
});
test('stored and live values are clamped and invalid numbers cannot reach the physics',()=>{
  const result=sanitizeCutSettings({normalBase:1000,gravity:-20,drag:NaN,cameraDuration:Infinity,particleBase:6.7,unknown:12});
  assert.equal(result.normalBase,16);assert.equal(result.gravity,0);assert.equal(result.drag,CUT_DEFAULTS.drag);
  assert.equal(result.cameraDuration,CUT_DEFAULTS.cameraDuration);assert.equal(result.particleBase,7);assert.equal(result.unknown,undefined);
});
test('live slider values drive the next impulse, particles and camera from one configuration',()=>{
  const m={size:82,vx:24,vy:100,tilt:.2},a={x:0,y:0},b={x:100,y:0};
  applyCutSettings(CUT_BASELINE,{persist:false});const previous=cutKinematics(m,a,b,{speed:2000},()=>.5);
  applyCutSettings(CUT_DEFAULTS,{persist:false});const strong=cutKinematics(m,a,b,{speed:2000},()=>.5);
  assert.ok(strong.impulses[0].separation>previous.impulses[0].separation*2);
  assert.ok(cutParticles({id:1,kinematics:strong}).length>cutParticles({id:1,kinematics:previous}).length);
  const cue={time:0,dir:{x:1,y:0},strength:1};assert.ok(cutCameraOffset(cue,.008).x>10);
  const snapshot=cutSettingsSnapshot();snapshot.normalBase=0;assert.equal(CUT.normalBase,2);
});
test('zero gravity, drag and camera duration remain finite and actually disable those effects',()=>{
  applyCutSettings({gravity:0,drag:0,cameraDuration:0,spinBase:0,spinExtra:0,particleBase:0,particleExtra:0},{persist:false});
  const p={x:100,y:100,vx:50,vy:0,motionAge:1,spinAngle:0,angularVelocity:0};advanceCutFragment(p,.5);
  assert.equal(p.x,125);assert.equal(p.y,100);assert.ok(Number.isFinite(p.spinAngle));
  assert.deepEqual(cutCameraOffset({time:0,dir:{x:1,y:0},strength:1},0),{x:0,y:0});
  const k=cutKinematics({size:82,vx:1,vy:2,tilt:0},{x:0,y:0},{x:100,y:0},{speed:1200},()=>.5);
  assert.deepEqual(cutParticles({id:1,kinematics:k}),[]);applyCutSettings(CUT_DEFAULTS,{persist:false});
});
