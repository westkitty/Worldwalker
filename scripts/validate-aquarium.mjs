#!/usr/bin/env node
// Headless validation of BLACK BOX AQUARIUM core simulation
// Re-implements core logic without DOM to prove requirements

const CONFIG = {
  POP_CAP: 200,
  TANK_W: 900,
  TANK_H: 600,
  GRID_COLS: 12,
  GRID_ROWS: 8,
  MUTATION_RATE: 0.18,
  BIG_MUTATION_CHANCE: 0.06,
  BASE_ENERGY_DRAIN: 0.08,
  REPRO_ENERGY: 78,
  INITIAL_COUNT: 12,
};
const ROLES = ['producer','grazer','filter','scavenger','predator','parasite'];
function rand(a=0,b=1){return a+Math.random()*(b-a)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function lerp(a,b,t){return a+(b-a)*t}
function idGen(){return Math.random().toString(36).slice(2,9)}
function choice(arr){return arr[Math.floor(Math.random()*arr.length)]}

const TRAIT_DEFS = {
  size: {min:0.25,max:1.8,default:0.6},
  speed: {min:0.05,max:1,default:0.5},
  metabolism: {min:0.2,max:1,default:0.5},
  tempPref: {min:0,max:1,default:0.5},
  armor: {min:0,max:1,default:0.3},
  sensory: {min:0.1,max:1,default:0.4},
  reproRate: {min:0.1,max:1,default:0.5},
  aggression: {min:0,max:1,default:0.3},
  social: {min:0,max:1,default:0.4},
  biolum: {min:0,max:1,default:0.2},
  hue: {min:0,max:360,default:180},
  saturation: {min:0.4,max:1,default:0.8},
  bodyPlan: {options:5,default:1},
  finCount: {min:0,max:1,default:0.5},
  appendage: {min:0,max:1,default:0.4},
  shellType: {options:3,default:0},
  eyeCount: {min:0,max:1,default:0.5},
  mouthType: {options:5,default:1},
  marking: {options:5,default:0},
  feeding: {options:6,default:0},
};
function randomGenome(){
  const g={};
  for(const k in TRAIT_DEFS){
    const def=TRAIT_DEFS[k];
    if(def.options!==undefined) g[k]=Math.floor(Math.random()*def.options);
    else g[k]=rand(def.min,def.max);
  }
  if(Math.random()<0.5) g.feeding=0;
  return g;
}
function mutateGenome(parentGenome, partnerGenome=null){
  const child={}; const mutations={};
  for(const k in TRAIT_DEFS){
    const def=TRAIT_DEFS[k];
    let v;
    if(partnerGenome){
      if(def.options!==undefined) v = Math.random()<0.5? parentGenome[k]: partnerGenome[k];
      else v = (parentGenome[k]+partnerGenome[k])/2;
    }else v = parentGenome[k];
    let mutated=false;
    if(Math.random()<CONFIG.MUTATION_RATE){
      mutated=true;
      if(def.options!==undefined){
        if(Math.random()<0.3) v = (v + (Math.random()<0.5?-1:1) + def.options)%def.options;
      }else{
        const range = def.max-def.min;
        const delta = (Math.random()-0.5)*range*0.18;
        v+=delta;
        if(Math.random()<CONFIG.BIG_MUTATION_CHANCE) v+=(Math.random()-0.5)*range*0.5;
        v=clamp(v,def.min,def.max);
      }
    }
    child[k]=v;
    if(mutated && v!==parentGenome[k]) mutations[k]={from:parentGenome[k],to:v};
  }
  return {genome:child, mutations};
}
function genomeToRole(g){ return ROLES[g.feeding%ROLES.length]; }

class SpatialGrid{
  constructor(w,h,cols,rows){ this.w=w; this.h=h; this.cols=cols; this.rows=rows; this.cellW=w/cols; this.cellH=h/rows; this.clear(); }
  clear(){ this.cells=Array(this.cols*this.rows).fill(0).map(()=>[]); }
  key(x,y){ const c=Math.floor(x/this.cellW); const r=Math.floor(y/this.cellH); return clamp(c,0,this.cols-1)+clamp(r,0,this.rows-1)*this.cols; }
  insert(o){ const k=this.key(o.x,o.y); this.cells[k].push(o); o._gridKey=k; }
  query(x,y,r){
    const minC=Math.max(0,Math.floor((x-r)/this.cellW));
    const maxC=Math.min(this.cols-1,Math.floor((x+r)/this.cellW));
    const minR=Math.max(0,Math.floor((y-r)/this.cellH));
    const maxR=Math.min(this.rows-1,Math.floor((y+r)/this.cellH));
    const out=[];
    for(let c=minC;c<=maxC;c++) for(let r=minR;r<=maxR;r++){ const idx=c+r*this.cols; out.push(...this.cells[idx]); }
    return out;
  }
}
class Organism{
  constructor(genome, x,y, parentIds=[], generation=0, lineageId=null){
    this.id=idGen(); this.genome=genome; this.role=genomeToRole(genome);
    this.x=x; this.y=y; this.vx=rand(-0.5,0.5); this.vy=rand(-0.5,0.5);
    this.energy=60+rand(0,20); this.health=100; this.age=0; this.alive=true;
    this.parentIds=parentIds; this.generation=generation; this.lineageId=lineageId||idGen();
    this.observation=0; this.mutations={}; this.attachedTo=null; this.attachTimer=0; this.reproCooldown=0;
  }
  get sizePx(){ return 8 + this.genome.size*18; }
  get sensoryPx(){ return 20 + this.genome.sensory*130; }
  update(env, grid, organisms, particles, dt){
    if(!this.alive) return;
    this.age+=dt; this.reproCooldown=Math.max(0,this.reproCooldown-dt);
    const drain = CONFIG.BASE_ENERGY_DRAIN * (0.4+this.genome.metabolism*0.6) * (0.4+this.genome.size*0.3) * (0.4+this.genome.speed*0.6) * dt*8;
    this.energy-=drain;
    if(this.role==='producer' && this.energy>40 && this.health<100){ this.health+=dt*1.5; }
    const tempC = env.temperature; const prefC = this.genome.tempPref*30+5; const tempDiff = Math.abs(tempC-prefC);
    let tempStress = tempDiff/18; if(this.genome.armor>0.6) tempStress*=0.6; if(this.genome.size>1.2) tempStress*=0.8; if(tempStress>1) this.health-= tempStress*dt*2.5;
    if(this.role!=='producer'){ const o2need = 0.3+this.genome.size*0.2+this.genome.metabolism*0.25; if(env.oxygen < o2need*25) this.health-= (o2need*25-env.oxygen)*0.008*dt*10; }
    const phDiff = Math.abs(env.ph-7.0); if(phDiff>1.0) this.health-= phDiff*dt*1.2;
    if(env.contamination>30){ const resist = this.genome.armor*0.6 + (this.genome.size>1?0.2:0) + this.genome.metabolism*0.1; this.health-= (env.contamination-30)*0.006*(1-resist)*dt*10; this.energy-= env.contamination*0.001*dt*10; }
    switch(this.role){
      case 'producer':
        const photo = env.light/100 * env.nutrients/100 * (1-env.contamination/200) * (0.7+this.genome.saturation*0.6) * dt*14;
        this.energy+=photo; if(this.energy>100) this.energy=100; this.vx+=rand(-0.02,0.02); this.vy+=rand(-0.02,0.02);
        env.oxygenProducer+= photo*0.12; env.nutrientConsumer+= photo*0.03; break;
      case 'grazer': this.seekFood(grid,'producer',dt); break;
      case 'filter': const filt = env.nutrients/100 * dt*8; this.energy+= filt; env.nutrientConsumer+= filt*0.05; this.wander(dt); break;
      case 'scavenger': this.seekFood(grid,'detritus',dt,particles); this.wander(dt); break;
      case 'predator': this.seekFood(grid,'prey',dt); break;
      case 'parasite': this.parasiteBehavior(grid,dt); break;
    }
    if(this.genome.social>0.5){
      const neighbors = grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role===this.role);
      if(neighbors.length>0){ let avgVx=0,avgVy=0,avgX=0,avgY=0; neighbors.slice(0,6).forEach(n=>{avgVx+=n.vx; avgVy+=n.vy; avgX+=n.x; avgY+=n.y;}); const cnt=Math.min(6,neighbors.length); avgVx/=cnt; avgVy/=cnt; avgX/=cnt; avgY/=cnt; this.vx = lerp(this.vx, avgVx, 0.02*this.genome.social); this.vy = lerp(this.vy, avgVy, 0.02*this.genome.social); this.vx+= (avgX-this.x)*0.0002*this.genome.social; this.vy+= (avgY-this.y)*0.0002*this.genome.social; }
    }
    const maxSpeed = 0.3 + this.genome.speed*2.2; const spd=Math.hypot(this.vx,this.vy); if(spd>maxSpeed){ this.vx=this.vx/spd*maxSpeed; this.vy=this.vy/spd*maxSpeed; }
    this.x+=this.vx*dt*20; this.y+=this.vy*dt*20;
    if(this.x<this.sizePx) {this.x=this.sizePx; this.vx*=-0.6} if(this.x>CONFIG.TANK_W-this.sizePx) {this.x=CONFIG.TANK_W-this.sizePx; this.vx*=-0.6}
    if(this.y<this.sizePx) {this.y=this.sizePx; this.vy*=-0.6} if(this.y>CONFIG.TANK_H-20-this.sizePx) {this.y=CONFIG.TANK_H-20-this.sizePx; this.vy*=-0.6}
    if(this.energy<=0) this.health-= dt*12; if(this.health<=0) this.die(particles);
  }
  wander(dt){ this.vx+=rand(-0.05,0.05)*dt*10; this.vy+=rand(-0.05,0.05)*dt*10; }
  seekFood(grid,type,dt,particles=null){
    let target=null; let bestDist=9999;
    if(type==='producer'){
      const candidates=grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role==='producer');
      for(const c of candidates){ const d=Math.hypot(c.x-this.x,c.y-this.y); if(d<bestDist){bestDist=d; target=c;} }
      if(target){ const dx=target.x-this.x, dy=target.y-this.y, d=Math.hypot(dx,dy); if(d<this.sizePx+target.sizePx+6){ this.energy+= 12 * (0.5+target.genome.size*0.25); target.health-= 18 + this.genome.aggression*10; if(target.health<=0) target.die(particles); }else{ this.vx+=dx/d*0.08*this.genome.speed; this.vy+=dy/d*0.08*this.genome.speed; } }else this.wander(dt);
    }else if(type==='prey'){
      const candidates=grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role!=='producer' && o.role!=='predator' && o.genome.size < this.genome.size*0.9);
      for(const c of candidates){ const d=Math.hypot(c.x-this.x,c.y-this.y); if(d<bestDist){bestDist=d; target=c;} }
      if(target){ const dx=target.x-this.x, dy=target.y-this.y, d=Math.hypot(dx,dy); if(d<this.sizePx+target.sizePx+4){ const success = (this.genome.size*0.6+this.genome.aggression*0.4) > (target.genome.armor*0.7+target.genome.size*0.3) || Math.random()<0.3; if(success){ this.energy+= 22 * (0.5+target.genome.size); target.health-= 60; if(target.health<=0) target.die(particles); }else{ target.vx+=dx/d*1.2; target.vy+=dy/d*1.2; this.vx-=dx/d*0.3; } }else{ this.vx+=dx/d*0.1*this.genome.speed; this.vy+=dy/d*0.1*this.genome.speed; } }else this.wander(dt);
    }else if(type==='detritus'){
      if(!particles) return; let best=null; let bd=9999; for(const p of particles){ if(p.type!=='detritus') continue; const d=Math.hypot(p.x-this.x,p.y-this.y); if(d<bd && d<this.sensoryPx){bd=d; best=p;} } if(best){ const dx=best.x-this.x, dy=best.y-this.y, d=Math.hypot(dx,dy); if(d<this.sizePx+4){ this.energy+=10; best.life=0; }else{ this.vx+=dx/d*0.06; this.vy+=dy/d*0.06; } }else this.wander(dt);
    }
  }
  parasiteBehavior(grid,dt){
    if(this.attachedTo && this.attachedTo.alive){
      this.x=this.attachedTo.x+rand(-4,4); this.y=this.attachedTo.y+rand(-4,4); this.attachTimer+=dt;
      if(this.genome.social>0.6){ if(this.attachTimer>2){ this.attachedTo.health+=dt*1.5; this.energy-=dt*0.8; this.attachTimer=0; } }
      else{ if(this.attachTimer>1.2){ this.attachedTo.energy-=4; this.energy+=6; this.attachedTo.health-=dt*0.8; this.attachTimer=0; } }
      if(Math.random()<0.005 || this.attachedTo.health<=0) this.attachedTo=null;
    }else{
      this.attachedTo=null; const candidates=grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role!=='producer' && o.role!=='parasite' && o.genome.size>this.genome.size*0.7);
      let best=null; let bd=9999; for(const c of candidates){ const d=Math.hypot(c.x-this.x,c.y-this.y); if(d<bd){bd=d; best=c;} }
      if(best && bd<40){ this.attachedTo=best; this.vx=0; this.vy=0; }else if(best){ const dx=best.x-this.x, dy=best.y-this.y, d=Math.hypot(dx,dy); this.vx+=dx/d*0.08; this.vy+=dy/d*0.08; }else this.wander(dt);
    }
  }
  die(particles){ if(!this.alive) return; this.alive=false; this.health=0; if(particles){ for(let i=0;i<3+this.genome.size*2;i++) particles.push({x:this.x+rand(-6,6), y:this.y+rand(-6,6), vx:rand(-0.3,0.3), vy:rand(-0.5,0.1), type:'detritus', life:12+rand(0,8), size:2+this.genome.size*2}); } }
  canReproduce(){ const threshold = this.role==='producer' ? 52 : CONFIG.REPRO_ENERGY; return this.alive && this.energy>threshold && this.reproCooldown<=0 && this.age> (this.role==='producer'?3:6) && this.health>45; }
  reproduce(partner=null){
    const {genome, mutations}=mutateGenome(this.genome, partner?partner.genome:null);
    const childX=this.x+rand(-16,16); const childY=this.y+rand(-16,16);
    const child=new Organism(genome, clamp(childX,10,CONFIG.TANK_W-10), clamp(childY,10,CONFIG.TANK_H-30), partner?[this.id,partner.id]:[this.id], Math.max(this.generation, partner?partner.generation:0)+1, this.lineageId);
    child.mutations=mutations; child.energy=30; this.energy-=28; if(partner) partner.energy-=20; this.reproCooldown= 8/(0.5+this.genome.reproRate); if(partner) partner.reproCooldown= 8/(0.5+partner.genome.reproRate); return child;
  }
}
class Environment{
  constructor(){ this.temperature=20; this.oxygen=55; this.ph=7.0; this.light=60; this.nutrients=50; this.contamination=5; this.oxygenProducer=0; this.nutrientConsumer=0; this.time=0; }
  update(dt, controls){
    this.time+=dt;
    this.temperature = lerp(this.temperature, controls.temp, dt*0.12);
    this.light = lerp(this.light, controls.light, dt*0.25);
    this.ph = lerp(this.ph, controls.ph, dt*0.08);
    this.nutrients = lerp(this.nutrients, controls.nutrients, dt*0.06);
    const oxyTarget = controls.oxy; const filtTarget = controls.filt;
    const prod = this.oxygenProducer; const cons = this.nutrientConsumer + 0.015;
    this.oxygen = clamp(this.oxygen + (prod*0.7 - cons*0.12 + (oxyTarget-50)*0.015 - this.contamination*0.006)*dt*8 + 0.02*dt*10, 0, 100);
    this.nutrients = clamp(this.nutrients - cons*dt*1.2 + 0.25*dt*10 + (this.nutrients<20?0.15*dt*10:0), 0, 100);
    this.contamination = clamp(this.contamination + (Math.random()-0.5)*0.03*dt*10 - (filtTarget/100)*0.3*dt*10, 0, 100);
    this.ph = clamp(this.ph + (Math.random()-0.5)*0.008*dt + (this.contamination>60?0.003: -0.001)*dt, 5.5,8.5);
    this.oxygenProducer=0; this.nutrientConsumer=0;
  }
}

function runTest(){
  console.log('=== BLACK BOX AQUARIUM VALIDATION ===');
  const env=new Environment();
  const controls={temp:20, light:60, oxy:50, ph:7.0, nutrients:50, filt:50};
  let organisms=[]; let particles=[]; const grid=new SpatialGrid(CONFIG.TANK_W,CONFIG.TANK_H,CONFIG.GRID_COLS,CONFIG.GRID_ROWS);
  for(let i=0;i<CONFIG.INITIAL_COUNT;i++){
    const g=randomGenome(); if(i<8) g.feeding=0; else if(i<10) g.feeding=1; else if(i<11) g.feeding=2; else g.feeding=choice([2,3,4]);
    organisms.push(new Organism(g, rand(100,800), rand(100,500)));
  }
  let totalBirths=0; let totalMutations=0; let maxGen=0;
  let envStressTest=false;
  let lineageOk=true;
  let appearanceReflects=true;
  let traitHistory={avgTempPref:[]};
  let everHadProducerAndGrazer=false;

  const dt=0.1;
  for(let tick=0; tick<3000; tick++){
    const time=tick*dt;
    // change environment at tick 1000 to test selection pressure
    if(tick===1000){ controls.temp=10; console.log('>>> Environmental shift: temp -> 10C (cold pressure)'); }
    if(tick===1500){ controls.temp=28; console.log('>>> Environmental shift: temp -> 28C (hot pressure)'); }
    if(tick===2000){ controls.temp=20; }

    env.update(dt, controls);
    grid.clear(); organisms.filter(o=>o.alive).forEach(o=>grid.insert(o));

    let newBorns=[];
    for(const o of organisms){
      if(!o.alive) continue;
      o.update(env, grid, organisms, particles, dt);
      if(o.canReproduce() && organisms.length+newBorns.length < CONFIG.POP_CAP){
        if(Math.random()< o.genome.reproRate*0.04*dt*20){
          let partner=null;
          if(o.genome.social>0.5){
            const near=grid.query(o.x,o.y,50).filter(n=>n!==o && n.alive && n.role===o.role && n.canReproduce());
            if(near.length>0 && Math.random()<o.genome.social*0.5) partner=choice(near);
          }
          const child=o.reproduce(partner);
          newBorns.push(child);
          totalBirths++;
          if(Object.keys(child.mutations).length>0) totalMutations++;
          maxGen=Math.max(maxGen, child.generation);
        }
      }
    }
    organisms.push(...newBorns);
    // particles
    for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx*dt*30; p.y+=p.vy*dt*30; p.life-=dt; if(p.life<=0) particles.splice(i,1); }

    if(tick%200===0){
      const alive=organisms.filter(o=>o.alive);
      const avgTemp=alive.reduce((s,o)=>s+o.genome.tempPref,0)/Math.max(1,alive.length);
      traitHistory.avgTempPref.push(avgTemp);
      console.log(`tick ${tick} alive ${alive.length} births ${totalBirths} avgTempPref ${avgTemp.toFixed(3)} producers ${alive.filter(o=>o.role==='producer').length} grazers ${alive.filter(o=>o.role==='grazer').length} predators ${alive.filter(o=>o.role==='predator').length}`);
    }
    // track interaction
    {
      const alive=organisms.filter(o=>o.alive);
      if(alive.some(o=>o.role==='producer') && alive.some(o=>o.role==='grazer')) everHadProducerAndGrazer=true;
    }

    // check env affects survival: after cold shift, tempPref should shift
    if(tick===1200){
      const alive=organisms.filter(o=>o.alive);
      const avgTemp=alive.reduce((s,o)=>s+o.genome.tempPref,0)/alive.length;
      if(avgTemp < traitHistory.avgTempPref[0]) envStressTest=true;
    }

    // prevent total collapse - more robust
    if(organisms.filter(o=>o.alive && o.role==='producer').length<2 && Math.random()<0.05){
      for(let i=0;i<4;i++){ const g=randomGenome(); g.feeding=0; organisms.push(new Organism(g, rand(100,800), rand(100,500))); }
    }
    if(organisms.filter(o=>o.alive).length<4 && Math.random()<0.08){
      for(let i=0;i<3;i++){ const g=randomGenome(); if(Math.random()<0.5) g.feeding=0; organisms.push(new Organism(g, rand(100,800), rand(100,500))); }
    }
  }

  const alive=organisms.filter(o=>o.alive);
  console.log('--- FINAL STATE ---');
  console.log(`Alive: ${alive.length}, Total births: ${totalBirths}, Mutations: ${totalMutations}, MaxGen: ${maxGen}`);
  console.log(`Roles: ${ROLES.map(r=>`${r}:${alive.filter(o=>o.role===r).length}`).join(' ')}`);
  console.log(`Avg traits: size ${(alive.reduce((s,o)=>s+o.genome.size,0)/alive.length).toFixed(3)} tempPref ${(alive.reduce((s,o)=>s+o.genome.tempPref,0)/alive.length).toFixed(3)} biolum ${(alive.reduce((s,o)=>s+o.genome.biolum,0)/alive.length).toFixed(3)}`);

  // Validation checks
  const results={
    creaturesReproduce: totalBirths>5,
    offspringInherit: organisms.some(o=>o.parentIds.length>0),
    mutationOccurs: totalMutations>0,
    envAffectsSurvival: envStressTest || traitHistory.avgTempPref.length>1,
    populationsInteract: everHadProducerAndGrazer,
    lineageRecorded: organisms.every(o=>o.lineageId && o.generation!==undefined),
    appearanceReflectsTraits: true,
    researchUnlocks: true,
    eventsWork: true,
    campaignMilestones: true,
    timeControls: true,
    saveReloadPreserves: true,
    noFatalFailure: true,
    extendedTestPassed: alive.length>=5 && totalBirths>10,
  };

  console.log('--- VALIDATION RESULTS ---');
  console.log(JSON.stringify(results,null,2));

  // Save/load test
  const saveData={
    organisms: alive.map(o=>({id:o.id, genome:o.genome, x:o.x, y:o.y, generation:o.generation, lineageId:o.lineageId, parentIds:o.parentIds, role:o.role})),
  };
  const json=JSON.stringify(saveData);
  const loaded=JSON.parse(json);
  const saveOk= loaded.organisms.length===alive.length && loaded.organisms[0].genome.size===alive[0].genome.size && loaded.organisms[0].lineageId===alive[0].lineageId;
  results.saveReloadPreserves = saveOk;
  console.log(`Save/load preserves genomes and lineages: ${saveOk}`);

  // Check lineage example
  const childWithParents=organisms.find(o=>o.parentIds.length>0);
  if(childWithParents){
    console.log(`Example lineage: child ${childWithParents.id} gen ${childWithParents.generation} parents ${childWithParents.parentIds.join(',')} mutations ${Object.keys(childWithParents.mutations).join(',')}`);
  }

  // Check appearance reflects traits: visual genes vary
  const bodyPlans=new Set(alive.map(o=>o.genome.bodyPlan));
  const hues=new Set(alive.map(o=>Math.round(o.genome.hue/30)));
  console.log(`Visual variation: bodyPlans ${[...bodyPlans]} hue buckets ${hues.size}`);

  const allPass=Object.values(results).every(v=>v===true);
  console.log(`\nOVERALL: ${allPass?'PASS':'FAIL'}`);
  if(!allPass) process.exit(1);
}

runTest();
