import test from 'node:test';
import assert from 'node:assert/strict';
import {creditsOffset} from '../dist/game-credits.js';

test('credits roll forward on the audio clock and settle for its last eight seconds',()=>{
  for(const [duration,distance,viewport] of [[227.254,3700,900],[227.254,2600,844],[32,700,390],[12,400,390]]){
    const at=t=>creditsOffset(t,duration,distance,viewport),hold=duration-8;
    assert.equal(at(0),0);
    let previous=0;
    for(let t=.1;t<hold;t+=.1){
      const offset=at(t);
      assert.ok(offset>previous&&offset<distance);
      previous=offset;
    }
    assert.ok(at(hold-.1)<distance);
    assert.equal(at(hold),distance);
    assert.equal(at(hold+4),distance);
    assert.equal(at(duration),distance);
  }
});
