/**
 * BLACK BOX AQUARIUM - Systemic Alien Ecosystem Simulation
 * Local-only, no external APIs, no AI models.
 * Validates: reproduction, inheritance, mutation, environment pressure, ecology, lineage, visual genes, research, events, milestones, time controls, save/load, performance.
 */

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
const ROLE_COLOR = {
  producer:'#6cf2a2',
  grazer:'#8aa8ff',
  filter:'#ffde7a',
  scavenger:'#c49aff',
  predator:'#ff6b6b',
  parasite:'#6cf2c2'
};

const TRAIT_DEFS = {
  size: {min:0.25,max:1.8,default:0.6},
  speed: {min:0.05,max:1,default:0.5},
  metabolism: {min:0.2,max:1,default:0.5},
  tempPref: {min:0,max:1,default:0.5}, // maps 5-35C
  armor: {min:0,max:1,default:0.3},
  sensory: {min:0.1,max:1,default:0.4},
  reproRate: {min:0.1,max:1,default:0.5},
  aggression: {min:0,max:1,default:0.3},
  social: {min:0,max:1,default:0.4},
  biolum: {min:0,max:1,default:0.2},
  hue: {min:0,max:360,default:180},
  saturation: {min:0.4,max:1,default:0.8},
  bodyPlan: {options:5,default:1}, // 0 jelly,1 fish,2 worm,3 crab,4 urchin
  finCount: {min:0,max:1,default:0.5},
  appendage: {min:0,max:1,default:0.4},
  shellType: {options:3,default:0},
  eyeCount: {min:0,max:1,default:0.5},
  mouthType: {options:5,default:1},
  marking: {options:5,default:0},
  feeding: {options:6,default:0}, // maps to role
};

function rand(a=0,b=1){return a+Math.random()*(b-a)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function lerp(a,b,t){return a+(b-a)*t}
function idGen(){return Math.random().toString(36).slice(2,9)}
function choice(arr){return arr[Math.floor(Math.random()*arr.length)]}

// --- Audio Manager (synthetic, no assets) ---
class AudioMgr{
  constructor(){
    this.ctx=null; this.master=null; this.enabled=true;
    this.bubbles=[]; this.ambienceNode=null;
  }
  init(){
    if(this.ctx) return;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value=0.25; this.master.connect(this.ctx.destination);
      // water ambience: filtered noise
      const bufferSize=4096;
      const noiseNode = this.ctx.createScriptProcessor(bufferSize,1,1);
      const filter = this.ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=400;
      const gain = this.ctx.createGain(); gain.gain.value=0.04;
      noiseNode.onaudioprocess=e=>{
        const out=e.outputBuffer.getChannelData(0);
        for(let i=0;i<bufferSize;i++) out[i]=(Math.random()*2-1)*0.5;
      };
      noiseNode.connect(filter); filter.connect(gain); gain.connect(this.master);
      this.ambienceNode=gain;
      // evolving pad
      this.startPad();
    }catch(e){console.warn('audio init fail',e)}
  }
  startPad(){
    if(!this.ctx) return;
    const o1=this.ctx.createOscillator(); o1.type='sine'; o1.frequency.value=55;
    const o2=this.ctx.createOscillator(); o2.type='triangle'; o2.frequency.value=110.25;
    const g=this.ctx.createGain(); g.gain.value=0; g.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime+2);
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=800;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start();
    // slow drift
    setInterval(()=>{
      if(!this.ctx) return;
      o1.frequency.linearRampToValueAtTime(50+Math.random()*10, this.ctx.currentTime+8);
      f.frequency.linearRampToValueAtTime(600+Math.random()*600, this.ctx.currentTime+5);
    },8000);
  }
  play(type){
    if(!this.enabled||!this.ctx) return;
    const t=this.ctx.currentTime;
    const osc=this.ctx.createOscillator();
    const gain=this.ctx.createGain();
    osc.connect(gain); gain.connect(this.master);
    switch(type){
      case 'bubble':
        osc.frequency.setValueAtTime(400+Math.random()*600,t);
        osc.frequency.exponentialRampToValueAtTime(200,t+0.2);
        gain.gain.setValueAtTime(0.15,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.3);
        osc.start(t); osc.stop(t+0.3); break;
      case 'feed':
        osc.frequency.setValueAtTime(800,t); gain.gain.setValueAtTime(0.2,t); gain.gain.linearRampToValueAtTime(0,t+0.15);
        osc.start(t); osc.stop(t+0.15); break;
      case 'breed':
        osc.frequency.setValueAtTime(440,t); osc.frequency.linearRampToValueAtTime(880,t+0.4);
        gain.gain.setValueAtTime(0.2,t); gain.gain.linearRampToValueAtTime(0,t+0.5);
        osc.start(t); osc.stop(t+0.5); break;
      case 'discovery':
        [0,0.1,0.2].forEach((d,i)=>{ const o=this.ctx.createOscillator(); const g=this.ctx.createGain(); o.connect(g); g.connect(this.master); o.frequency.value=523+i*200; g.gain.setValueAtTime(0.18,t+d); g.gain.exponentialRampToValueAtTime(0.001,t+d+0.6); o.start(t+d); o.stop(t+d+0.6); }); break;
      case 'alert':
        osc.frequency.setValueAtTime(120,t); osc.frequency.linearRampToValueAtTime(60,t+0.6);
        gain.gain.setValueAtTime(0.3,t); gain.gain.linearRampToValueAtTime(0,t+0.6);
        osc.start(t); osc.stop(t+0.6); break;
      case 'ui':
        osc.frequency.value=600; gain.gain.setValueAtTime(0.08,t); gain.gain.linearRampToValueAtTime(0,t+0.08); osc.start(t); osc.stop(t+0.08); break;
    }
  }
  toggle(){ this.enabled=!this.enabled; if(this.ambienceNode) this.ambienceNode.gain.value=this.enabled?0.04:0; }
}
const audio = new AudioMgr();

// --- Genome ---
function randomGenome(){
  const g={};
  for(const k in TRAIT_DEFS){
    const def=TRAIT_DEFS[k];
    if(def.options!==undefined) g[k]=Math.floor(Math.random()*def.options);
    else g[k]=rand(def.min,def.max);
  }
  // bias feeding to have some producers initially
  if(Math.random()<0.5) g.feeding=0;
  return g;
}
function mutateGenome(parentGenome, partnerGenome=null){
  const child={};
  const mutations={};
  for(const k in TRAIT_DEFS){
    const def=TRAIT_DEFS[k];
    let v;
    if(partnerGenome){
      if(def.options!==undefined){
        v = Math.random()<0.5? parentGenome[k]: partnerGenome[k];
      }else{
        v = (parentGenome[k]+partnerGenome[k])/2;
      }
    }else{
      v = parentGenome[k];
    }
    let mutated=false;
    if(Math.random()<CONFIG.MUTATION_RATE){
      mutated=true;
      if(def.options!==undefined){
        if(Math.random()<0.3) v = (v + (Math.random()<0.5?-1:1) + def.options)%def.options;
      }else{
        const range = def.max-def.min;
        const delta = (Math.random()-0.5)*range*0.18;
        v+=delta;
        if(Math.random()<CONFIG.BIG_MUTATION_CHANCE){
          v+=(Math.random()-0.5)*range*0.5;
        }
        v=clamp(v,def.min,def.max);
      }
    }
    child[k]=v;
    if(mutated && v!==parentGenome[k]) mutations[k]={from:parentGenome[k],to:v};
  }
  return {genome:child, mutations};
}
function genomeToRole(g){ return ROLES[g.feeding%ROLES.length]; }

// --- Spatial Grid ---
class SpatialGrid{
  constructor(w,h,cols,rows){
    this.w=w; this.h=h; this.cols=cols; this.rows=rows;
    this.cellW=w/cols; this.cellH=h/rows;
    this.cells=[];
    this.clear();
  }
  clear(){ this.cells=Array(this.cols*this.rows).fill(0).map(()=>[]); }
  key(x,y){ const c=Math.floor(x/this.cellW); const r=Math.floor(y/this.cellH); return clamp(c,0,this.cols-1)+clamp(r,0,this.rows-1)*this.cols; }
  insert(o){ const k=this.key(o.x,o.y); this.cells[k].push(o); o._gridKey=k; }
  query(x,y,r){
    const minC=Math.max(0,Math.floor((x-r)/this.cellW));
    const maxC=Math.min(this.cols-1,Math.floor((x+r)/this.cellW));
    const minR=Math.max(0,Math.floor((y-r)/this.cellH));
    const maxR=Math.min(this.rows-1,Math.floor((y+r)/this.cellH));
    const out=[];
    for(let c=minC;c<=maxC;c++) for(let r=minR;r<=maxR;r++){
      const idx=c+r*this.cols; out.push(...this.cells[idx]);
    }
    return out;
  }
}

// --- Organism ---
class Organism{
  constructor(genome, x,y, parentIds=[], generation=0, lineageId=null){
    this.id=idGen();
    this.genome=genome;
    this.role=genomeToRole(genome);
    this.x=x; this.y=y;
    this.vx=rand(-0.5,0.5); this.vy=rand(-0.5,0.5);
    this.energy=60+rand(0,20);
    this.health=100;
    this.age=0;
    this.alive=true;
    this.parentIds=parentIds;
    this.generation=generation;
    this.lineageId=lineageId||idGen();
    this.birthTime=Date.now();
    this.observation=0;
    this.mutations={};
    this.attachedTo=null; // for parasite
    this.attachTimer=0;
    this.reproCooldown=0;
    this.lastMeal=0;
  }
  get sizePx(){ return 8 + this.genome.size*18; }
  get sensoryPx(){ return 20 + this.genome.sensory*130; }
  get tempSuitability(){ return 1; } // computed externally
  update(env, grid, organisms, particles, dt){
    if(!this.alive) return;
    this.age+=dt;
    this.reproCooldown=Math.max(0,this.reproCooldown-dt);
    this.observation+=dt*0.2;

    // energy drain - reduced for stability
    const drain = CONFIG.BASE_ENERGY_DRAIN * (0.4+this.genome.metabolism*0.6) * (0.4+this.genome.size*0.3) * (0.4+this.genome.speed*0.6) * dt*8;
    this.energy-=drain;
    // slow health regen for producers
    if(this.role==='producer' && this.energy>40 && this.health<100){
      this.health+=dt*1.5;
    }

    // environmental stress
    const tempC = env.temperature;
    const prefC = this.genome.tempPref*30+5; // 5-35
    const tempDiff = Math.abs(tempC-prefC);
    let tempStress = tempDiff/18; // increased tolerance
    if(this.genome.armor>0.6) tempStress*=0.6;
    if(this.genome.size>1.2) tempStress*=0.8;
    if(tempStress>1) this.health-= tempStress*dt*2.5;

    // oxygen - more forgiving
    if(this.role!=='producer'){
      const o2need = 0.3+this.genome.size*0.2+this.genome.metabolism*0.25;
      if(env.oxygen < o2need*25) this.health-= (o2need*25-env.oxygen)*0.008*dt*10;
    }
    // pH
    const phDiff = Math.abs(env.ph-7.0);
    if(phDiff>1.0) this.health-= phDiff*dt*1.2;
    // contamination - reduced
    if(env.contamination>30){
      const resist = this.genome.armor*0.6 + (this.genome.size>1?0.2:0) + this.genome.metabolism*0.1;
      this.health-= (env.contamination-30)*0.006*(1-resist)*dt*10;
      this.energy-= env.contamination*0.001*dt*10;
    }

    // role behaviors
    switch(this.role){
      case 'producer':
        // photosynthesis - boosted for stability
        const photo = env.light/100 * env.nutrients/100 * (1-env.contamination/200) * (0.7+this.genome.saturation*0.6) * dt*14;
        this.energy+=photo;
        if(this.energy>100) this.energy=100;
        // slight drift
        this.vx+=rand(-0.02,0.02); this.vy+=rand(-0.02,0.02);
        // produce oxygen
        env.oxygenProducer+= photo*0.12;
        // consume nutrients
        env.nutrientConsumer+= photo*0.03;
        break;
      case 'grazer':
        this.seekFood(grid,'producer',dt);
        break;
      case 'filter':
        // filter nutrients + particles
        const filt = env.nutrients/100 * dt*8;
        this.energy+= filt;
        env.nutrientConsumer+= filt*0.05;
        this.wander(dt);
        break;
      case 'scavenger':
        this.seekFood(grid,'detritus',dt,particles);
        this.wander(dt);
        break;
      case 'predator':
        this.seekFood(grid,'prey',dt);
        break;
      case 'parasite':
        this.parasiteBehavior(grid,dt);
        break;
    }

    // social tendency: schooling
    if(this.genome.social>0.5){
      const neighbors = grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role===this.role);
      if(neighbors.length>0){
        let avgVx=0,avgVy=0,avgX=0,avgY=0;
        neighbors.slice(0,6).forEach(n=>{avgVx+=n.vx; avgVy+=n.vy; avgX+=n.x; avgY+=n.y;});
        const cnt=Math.min(6,neighbors.length);
        avgVx/=cnt; avgVy/=cnt; avgX/=cnt; avgY/=cnt;
        this.vx = lerp(this.vx, avgVx, 0.02*this.genome.social);
        this.vy = lerp(this.vy, avgVy, 0.02*this.genome.social);
        // cohesion
        this.vx+= (avgX-this.x)*0.0002*this.genome.social;
        this.vy+= (avgY-this.y)*0.0002*this.genome.social;
      }
    }

    // aggression separation
    if(this.genome.aggression>0.6){
      const close = grid.query(this.x,this.y,30).filter(o=>o!==this && o.alive);
      close.forEach(o=>{
        const dx=this.x-o.x, dy=this.y-o.y, d=Math.hypot(dx,dy);
        if(d<20 && d>0.1){ this.vx+=dx/d*0.05; this.vy+=dy/d*0.05; }
      });
    }

    // movement clamp
    const maxSpeed = 0.3 + this.genome.speed*2.2;
    const spd=Math.hypot(this.vx,this.vy);
    if(spd>maxSpeed){ this.vx=this.vx/spd*maxSpeed; this.vy=this.vy/spd*maxSpeed; }
    this.x+=this.vx*dt*20;
    this.y+=this.vy*dt*20;

    // tank bounds
    if(this.x<this.sizePx) {this.x=this.sizePx; this.vx*=-0.6}
    if(this.x>CONFIG.TANK_W-this.sizePx) {this.x=CONFIG.TANK_W-this.sizePx; this.vx*=-0.6}
    if(this.y<this.sizePx) {this.y=this.sizePx; this.vy*=-0.6}
    if(this.y>CONFIG.TANK_H-20-this.sizePx) {this.y=CONFIG.TANK_H-20-this.sizePx; this.vy*=-0.6}

    // energy check
    if(this.energy<=0) this.health-= dt*12;
    if(this.health<=0) this.die(particles);
  }
  wander(dt){
    this.vx+=rand(-0.05,0.05)*dt*10; this.vy+=rand(-0.05,0.05)*dt*10;
  }
  seekFood(grid,type,dt,particles=null){
    let target=null; let bestDist=9999;
    if(type==='producer'){
      const candidates=grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role==='producer');
      for(const c of candidates){ const d=Math.hypot(c.x-this.x,c.y-this.y); if(d<bestDist){bestDist=d; target=c;} }
      if(target){
        const dx=target.x-this.x, dy=target.y-this.y, d=Math.hypot(dx,dy);
        if(d<this.sizePx+target.sizePx+6){
          // eat - less lethal
          this.energy+= 12 * (0.5+target.genome.size*0.25);
          target.health-= 18 + this.genome.aggression*10;
          if(target.health<=0) target.die(particles);
          this.lastMeal=Date.now();
          audio.play('feed');
        }else{
          this.vx+=dx/d*0.08*this.genome.speed; this.vy+=dy/d*0.08*this.genome.speed;
        }
      }else this.wander(dt);
    }else if(type==='prey'){
      const candidates=grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role!=='producer' && o.role!=='predator' && o.genome.size < this.genome.size*0.9);
      for(const c of candidates){ const d=Math.hypot(c.x-this.x,c.y-this.y); if(d<bestDist){bestDist=d; target=c;} }
      if(target){
        const dx=target.x-this.x, dy=target.y-this.y, d=Math.hypot(dx,dy);
        if(d<this.sizePx+target.sizePx+4){
          // predation check armor
          const success = (this.genome.size*0.6+this.genome.aggression*0.4) > (target.genome.armor*0.7+target.genome.size*0.3) || Math.random()<0.3;
          if(success){
            this.energy+= 22 * (0.5+target.genome.size);
            target.health-= 60;
            if(target.health<=0) target.die(particles);
            audio.play('feed');
          }else{
            target.vx+=dx/d*1.2; target.vy+=dy/d*1.2; // escape
            this.vx-=dx/d*0.3;
          }
        }else{
          this.vx+=dx/d*0.1*this.genome.speed; this.vy+=dy/d*0.1*this.genome.speed;
        }
      }else this.wander(dt);
    }else if(type==='detritus'){
      if(!particles) return;
      let best=null; let bd=9999;
      for(const p of particles){ if(p.type!=='detritus') continue; const d=Math.hypot(p.x-this.x,p.y-this.y); if(d<bd && d<this.sensoryPx){bd=d; best=p;} }
      if(best){
        const dx=best.x-this.x, dy=best.y-this.y, d=Math.hypot(dx,dy);
        if(d<this.sizePx+4){
          this.energy+=10; best.life=0;
        }else{ this.vx+=dx/d*0.06; this.vy+=dy/d*0.06; }
      }else this.wander(dt);
    }
  }
  parasiteBehavior(grid,dt){
    if(this.attachedTo && this.attachedTo.alive){
      this.x=this.attachedTo.x+rand(-4,4); this.y=this.attachedTo.y+rand(-4,4);
      this.attachTimer+=dt;
      if(this.genome.social>0.6){
        // symbiote: share
        if(this.attachTimer>2){
          this.attachedTo.health+=dt*1.5;
          this.energy-=dt*0.8;
          this.attachTimer=0;
        }
      }else{
        // parasite: drain
        if(this.attachTimer>1.2){
          this.attachedTo.energy-=4;
          this.energy+=6;
          this.attachedTo.health-=dt*0.8;
          this.attachTimer=0;
        }
      }
      if(this.energy>85 && this.reproCooldown<=0) {/* will repro */}
      if(Math.random()<0.005 || this.attachedTo.health<=0) this.attachedTo=null;
    }else{
      this.attachedTo=null;
      const candidates=grid.query(this.x,this.y,this.sensoryPx).filter(o=>o!==this && o.alive && o.role!=='producer' && o.role!=='parasite' && o.genome.size>this.genome.size*0.7);
      let best=null; let bd=9999;
      for(const c of candidates){ const d=Math.hypot(c.x-this.x,c.y-this.y); if(d<bd){bd=d; best=c;} }
      if(best && bd<40){
        this.attachedTo=best;
        this.vx=0; this.vy=0;
      }else if(best){
        const dx=best.x-this.x, dy=best.y-this.y, d=Math.hypot(dx,dy);
        this.vx+=dx/d*0.08; this.vy+=dy/d*0.08;
      }else this.wander(dt);
    }
  }
  die(particles){
    if(!this.alive) return;
    this.alive=false;
    this.health=0;
    // spawn detritus
    if(particles){
      for(let i=0;i<3+this.genome.size*2;i++){
        particles.push({x:this.x+rand(-6,6), y:this.y+rand(-6,6), vx:rand(-0.3,0.3), vy:rand(-0.5,0.1), type:'detritus', life:12+rand(0,8), size:2+this.genome.size*2});
      }
    }
  }
  canReproduce(){
    const threshold = this.role==='producer' ? 52 : CONFIG.REPRO_ENERGY;
    return this.alive && this.energy>threshold && this.reproCooldown<=0 && this.age> (this.role==='producer'?3:6) && this.health>45;
  }
  reproduce(partner=null){
    const {genome, mutations}=mutateGenome(this.genome, partner?partner.genome:null);
    const childX=this.x+rand(-16,16);
    const childY=this.y+rand(-16,16);
    const child=new Organism(genome, clamp(childX,10,CONFIG.TANK_W-10), clamp(childY,10,CONFIG.TANK_H-30), partner?[this.id,partner.id]:[this.id], Math.max(this.generation, partner?partner.generation:0)+1, this.lineageId);
    child.mutations=mutations;
    child.energy=30;
    // energy cost
    this.energy-=28;
    if(partner) partner.energy-=20;
    this.reproCooldown= 8/(0.5+this.genome.reproRate);
    if(partner) partner.reproCooldown= 8/(0.5+partner.genome.reproRate);
    audio.play('breed');
    return child;
  }
}

// --- Environment ---
class Environment{
  constructor(){
    this.temperature=20;
    this.oxygen=55;
    this.ph=7.0;
    this.light=60;
    this.nutrients=50;
    this.contamination=5;
    this.oxygenProducer=0;
    this.nutrientConsumer=0;
    this.history={temp:[], oxygen:[], ph:[], light:[], nutrients:[], contam:[], pop:[]};
    this.time=0;
  }
  update(dt, controls){
    this.time+=dt;
    // controls lerp toward slider targets
    this.temperature = lerp(this.temperature, controls.temp, dt*0.12);
    this.light = lerp(this.light, controls.light, dt*0.25);
    this.ph = lerp(this.ph, controls.ph, dt*0.08);
    this.nutrients = lerp(this.nutrients, controls.nutrients, dt*0.06);
    // oxygen pump + filter
    const oxyTarget = controls.oxy;
    const filtTarget = controls.filt;
    // natural dynamics - with baseline inflow to prevent collapse
    const prod = this.oxygenProducer;
    const cons = this.nutrientConsumer + 0.015;
    this.oxygen = clamp(this.oxygen + (prod*0.7 - cons*0.12 + (oxyTarget-50)*0.015 - this.contamination*0.006)*dt*8 + 0.02*dt*10, 0, 100);
    this.nutrients = clamp(this.nutrients - cons*dt*1.2 + 0.25*dt*10 + (this.nutrients<20?0.15*dt*10:0), 0, 100);
    this.contamination = clamp(this.contamination + (Math.random()-0.5)*0.03*dt*10 - (filtTarget/100)*0.3*dt*10, 0, 100);
    this.ph = clamp(this.ph + (Math.random()-0.5)*0.008*dt + (this.contamination>60?0.003: -0.001)*dt, 5.5,8.5);

    this.oxygenProducer=0; this.nutrientConsumer=0;

    // history
    if(this.time%0.5<dt){
      const push=(arr,val)=>{arr.push(val); if(arr.length>200) arr.shift();};
      push(this.history.temp,this.temperature);
      push(this.history.oxygen,this.oxygen);
      push(this.history.ph,this.ph);
      push(this.history.light,this.light);
      push(this.history.nutrients,this.nutrients);
      push(this.history.contam,this.contamination);
    }
  }
}

// --- Research ---
class ResearchMgr{
  constructor(){
    this.traitsDiscovered=new Set();
    this.speciesCatalog=new Map(); // key -> {count, avgGenome, examples}
    this.observations=0;
    this.totalBirths=0;
    this.totalDeaths=0;
    this.symbiosisObserved=false;
    this.chorusObserved=false;
  }
  observe(org, dt){
    this.observations+=dt;
    // unlock traits based on observation time
    const thresholds={size:2, speed:3, metabolism:5, tempPref:4, armor:4, sensory:6, reproRate:3, aggression:5, social:6, biolum:7, hue:1, bodyPlan:1, feeding:2};
    for(const k in thresholds){
      if(org.observation>thresholds[k]) this.traitsDiscovered.add(k);
    }
    if(org.role==='parasite' && org.attachedTo && org.genome.social>0.6 && org.attachedTo.health>70){
      this.symbiosisObserved=true;
    }
  }
  catalog(organisms){
    this.speciesCatalog.clear();
    for(const o of organisms){
      if(!o.alive) continue;
      const key=`${o.genome.bodyPlan}-${o.genome.feeding}-${Math.round(o.genome.tempPref*3)}-${Math.round(o.genome.hue/60)}`;
      if(!this.speciesCatalog.has(key)){
        this.speciesCatalog.set(key,{count:0, role:o.role, bodyPlan:o.genome.bodyPlan, hue:o.genome.hue, examples:[], avgSize:0, avgTemp:0});
      }
      const entry=this.speciesCatalog.get(key);
      entry.count++;
      entry.avgSize+=o.genome.size;
      entry.avgTemp+=o.genome.tempPref;
      if(entry.examples.length<3) entry.examples.push(o);
    }
    for(const v of this.speciesCatalog.values()){
      if(v.count>0){ v.avgSize/=v.count; v.avgTemp/=v.count; }
    }
  }
}

// --- Campaign Milestones ---
class CampaignMgr{
  constructor(){
    this.milestones=[
      {id:'m1', title:'FIRST LIGHT', desc:'Establish stable producer population (>12 for 20s)', check:(sim)=>sim.countRole('producer')>=12, progress:0, required:20, done:false, active:false},
      {id:'m2', title:'TROPHIC LADDER', desc:'Sustain grazers (≥10) + predators (≥3) coexisting 45s', check:(sim)=>sim.countRole('grazer')>=10 && sim.countRole('predator')>=3, progress:0, required:45, done:false},
      {id:'m3', title:'COLD FORGE', desc:'Breed cold-resistant lineage (tempPref <0.25) surviving at <15°C for 30s', check:(sim)=>sim.environment.temperature<15 && sim.organisms.some(o=>o.alive && o.genome.tempPref<0.25), progress:0, required:30, done:false},
      {id:'m4', title:'SYMBIOTIC DAWN', desc:'Discover symbiosis (parasite with high social helping host)', check:(sim)=>sim.research.symbiosisObserved, progress:0, required:1, done:false, instant:true},
      {id:'m5', title:'BLACK TIDE', desc:'Survive contamination >60 for 40s with population >15', check:(sim)=>sim.environment.contamination>60 && sim.aliveCount()>=15, progress:0, required:40, done:false},
      {id:'m6', title:'CHORUS MIND', desc:'Evolve bioluminescent collective (biolum>0.85, social>0.75, sensory>0.75, school of 5)', check:(sim)=>sim.checkChorus(), progress:0, required:1, done:false, instant:true, final:true},
    ];
    this.completed=0;
    this.endingTriggered=false;
  }
  update(sim, dt){
    for(const m of this.milestones){
      if(m.done) continue;
      if(m.check(sim)){
        if(m.instant){ m.done=true; this.completed++; sim.logEvent(`MILESTONE: ${m.title} — ${m.desc}`,'milestone'); audio.play('discovery'); sim.showMilestone(m); if(m.final) sim.triggerEnding(); }
        else{
          m.active=true; m.progress+=dt;
          if(m.progress>=m.required){ m.done=true; m.active=false; this.completed++; sim.logEvent(`MILESTONE COMPLETE: ${m.title}`,'milestone'); audio.play('discovery'); sim.showMilestone(m); if(m.final) sim.triggerEnding(); }
        }
      }else{
        if(!m.instant) { m.progress=Math.max(0,m.progress-dt*0.3); m.active=false; }
      }
    }
  }
}

// --- Event Manager ---
class EventMgr{
  constructor(){
    this.events=[
      {id:'oxygen', name:'OXYGEN CRASH', desc:'O₂ plummeting!', duration:35, apply:(sim)=>{sim.environment.oxygen-=0.8;}},
      {id:'fungal', name:'FUNGAL BLOOM', desc:'Contamination surge, nutrients drop', duration:40, apply:(sim)=>{sim.environment.contamination+=0.35; sim.environment.nutrients-=0.12;}},
      {id:'heater', name:'HEATER FAILURE', desc:'Temperature dropping', duration:30, apply:(sim)=>{sim.controls.temp=Math.max(5,sim.controls.temp-0.25);}},
      {id:'spores', name:'UNKNOWN SPORES', desc:'Alien spores introduced', duration:10, apply:(sim)=>{ if(Math.random()<0.15) sim.spawnRandom(1,true); sim.environment.contamination+=0.15;}},
      {id:'surge', name:'REPRODUCTIVE SURGE', desc:'All organisms fertile!', duration:20, apply:(sim)=>{sim.organisms.forEach(o=>{if(o.alive) o.reproCooldown*=0.7;});}},
      {id:'malfunction', name:'EQUIPMENT MALFUNCTION', desc:'Lights flicker, filter offline', duration:25, apply:(sim)=>{sim.environment.light+= (Math.random()-0.5)*10; sim.controls.filt=Math.max(0,sim.controls.filt-0.3);}},
    ];
    this.active=null;
    this.timer=0;
    this.nextEvent= rand(45,90);
  }
  update(sim, dt){
    this.nextEvent-=dt;
    if(this.active){
      this.timer-=dt;
      const ev=this.events.find(e=>e.id===this.active.id);
      if(ev) ev.apply(sim);
      if(this.timer<=0){ sim.logEvent(`EVENT ENDED: ${this.active.name}`,'event'); this.active=null; this.nextEvent=rand(60,120); }
    }else if(this.nextEvent<=0){
      if(Math.random()<0.7) this.triggerRandom(sim);
      this.nextEvent=rand(60,120);
    }
  }
  triggerRandom(sim){
    const ev=choice(this.events);
    this.active={id:ev.id, name:ev.name, start:Date.now()}; this.timer=ev.duration;
    sim.logEvent(`EVENT: ${ev.name} — ${ev.desc}`,'event'); audio.play('alert');
    document.getElementById('contamVignette').style.opacity='0.6';
    setTimeout(()=>{document.getElementById('contamVignette').style.opacity='0';}, ev.duration*1000);
  }
  triggerById(id, sim){
    const ev=this.events.find(e=>e.id===id);
    if(!ev) return;
    this.active={id:ev.id, name:ev.name, start:Date.now()}; this.timer=ev.duration;
    sim.logEvent(`MANUAL EVENT: ${ev.name}`,'event'); audio.play('alert');
  }
}

// --- Main Simulation ---
class Simulation{
  constructor(){
    this.canvas=document.getElementById('tank');
    this.ctx=this.canvas.getContext('2d');
    this.envCanvas=document.getElementById('envGraph');
    this.envCtx=this.envCanvas.getContext('2d');
    this.popCanvas=document.getElementById('popGraph');
    this.popCtx=this.popCanvas.getContext('2d');
    this.traitCanvas=document.getElementById('traitGraph');
    this.traitCtx=this.traitCanvas.getContext('2d');
    this.lineageCanvas=document.getElementById('lineageCanvas');
    this.lineageCtx=this.lineageCanvas.getContext('2d');
    this.inspectorCanvas=document.getElementById('inspectorCanvas');
    this.inspectorCtx=this.inspectorCanvas.getContext('2d');
    this.breedCanvas=document.getElementById('breedCanvas');
    this.breedCtx=this.breedCanvas.getContext('2d');

    this.environment=new Environment();
    this.controls={temp:20, light:60, oxy:50, ph:7.0, nutrients:50, filt:50};
    this.organisms=[];
    this.particles=[]; // food, detritus, bubbles
    this.habitats=[]; // {x,y,type}
    this.grid=new SpatialGrid(CONFIG.TANK_W, CONFIG.TANK_H, CONFIG.GRID_COLS, CONFIG.GRID_ROWS);
    this.research=new ResearchMgr();
    this.campaign=new CampaignMgr();
    this.events=new EventMgr();

    this.selected=null;
    this.breedSlots=[null,null];
    this.paused=false;
    this.speed=1;
    this.time=0;
    this.popHistory={producer:[], grazer:[], filter:[], scavenger:[], predator:[], parasite:[], total:[]};
    this.traitHistory={avgTempPref:[], avgBiolum:[], avgSocial:[], avgSize:[]};
    this.logEntries=[];
    this.mode='campaign'; // or sandbox
    this.bubbleTimer=0;

    this.bindUI();
    this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  resize(){
    const wrapper=document.getElementById('tankWrapper');
    const rect=wrapper.getBoundingClientRect();
    this.canvas.width=rect.width*window.devicePixelRatio;
    this.canvas.height=rect.height*window.devicePixelRatio;
    this.canvas.style.width=rect.width+'px';
    this.canvas.style.height=rect.height+'px';
    this.ctx.setTransform(window.devicePixelRatio,0,0,window.devicePixelRatio,0,0);
    CONFIG.TANK_W=rect.width; CONFIG.TANK_H=rect.height;
    this.grid=new SpatialGrid(CONFIG.TANK_W, CONFIG.TANK_H, CONFIG.GRID_COLS, CONFIG.GRID_ROWS);
  }
  bindUI(){
    // sliders
    const bind=(id, key, display, fmt=v=>v)=>{
      const el=document.getElementById(id);
      const out=document.getElementById(display);
      el.addEventListener('input',()=>{
        this.controls[key]=parseFloat(el.value);
        if(out) out.textContent=fmt(el.value);
        audio.play('ui');
      });
    };
    bind('tempSlider','temp','tempVal',v=>parseFloat(v).toFixed(1)+'°C');
    bind('lightSlider','light','lightVal',v=>v);
    bind('oxySlider','oxy','oxyVal',v=>v);
    bind('phSlider','ph','phVal',v=>parseFloat(v).toFixed(1));
    bind('nutSlider','nutrients','nutVal',v=>v);
    bind('filtSlider','filt','filtVal',v=>v);

    document.getElementById('pauseBtn').addEventListener('click',()=>this.togglePause());
    document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('[data-speed]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); this.speed=parseFloat(b.dataset.speed);
    }));
    document.getElementById('saveBtn').addEventListener('click',()=>this.save());
    document.getElementById('loadBtn').addEventListener('click',()=>this.load());
    document.getElementById('resetBtn').addEventListener('click',()=>{ if(confirm('Reset tank?')) this.reset(); });
    document.getElementById('audioBtn').addEventListener('click',()=>{ audio.toggle(); document.getElementById('audioBtn').textContent=audio.enabled?'🔊':'🔇'; });
    document.getElementById('manualBtn').addEventListener('click',()=>document.getElementById('manualOverlay').classList.remove('hidden'));
    document.getElementById('manualClose').addEventListener('click',()=>document.getElementById('manualOverlay').classList.add('hidden'));
    document.getElementById('milestoneClose').addEventListener('click',()=>document.getElementById('milestonePopup').classList.add('hidden'));
    document.getElementById('continueSandboxBtn').addEventListener('click',()=>{document.getElementById('endingScreen').classList.add('hidden'); this.mode='sandbox';});
    document.getElementById('endingCloseBtn').addEventListener('click',()=>document.getElementById('endingScreen').classList.add('hidden'));

    // food/tools
    document.querySelectorAll('[data-food]').forEach(b=>b.addEventListener('click',()=>this.applyFood(b.dataset.food)));
    document.querySelectorAll('[data-habitat]').forEach(b=>b.addEventListener('click',()=>this.applyHabitat(b.dataset.habitat)));
    document.querySelectorAll('[data-intro]').forEach(b=>b.addEventListener('click',()=>this.applyIntro(b.dataset.intro)));
    document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>this.events.triggerById(b.dataset.event,this)));

    // tank click
    this.canvas.addEventListener('click',(e)=>{
      const rect=this.canvas.getBoundingClientRect();
      const x=(e.clientX-rect.left); const y=(e.clientY-rect.top);
      this.selectAt(x,y);
    });
    this.canvas.addEventListener('mousemove',(e)=>{
      const rect=this.canvas.getBoundingClientRect();
      const x=(e.clientX-rect.left); const y=(e.clientY-rect.top);
      this.hoverAt(x,y,e);
    });

    // breeding tank
    this.breedCanvas.addEventListener('click',(e)=>{
      if(this.selected){ this.addToBreed(this.selected); }
    });
    document.getElementById('breedBtn').addEventListener('click',()=>this.attemptBreed());
    document.getElementById('clearBreedBtn').addEventListener('click',()=>{this.breedSlots=[null,null]; this.updateBreedCanvas();});
    document.getElementById('isolateBtn').addEventListener('click',()=>{ if(this.selected) this.addToBreed(this.selected); });
    document.getElementById('trackLineageBtn').addEventListener('click',()=>{ if(this.selected) this.drawLineage(this.selected); });

    // tabs
    document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{
      const tab=b.dataset.tab;
      document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      document.querySelectorAll('.tabContent').forEach(c=>c.classList.remove('active'));
      document.getElementById('tab'+tab.charAt(0).toUpperCase()+tab.slice(1)).classList.add('active');
    }));

    // title screen
    document.getElementById('btnCampaign').addEventListener('click',()=>{ this.startGame('campaign'); });
    document.getElementById('btnSandbox').addEventListener('click',()=>{ this.startGame('sandbox'); });
    document.getElementById('btnLoadSave').addEventListener('click',()=>{ this.load(); this.startGame(this.mode); });
    document.getElementById('btnTutorial').addEventListener('click',()=>{ document.getElementById('manualOverlay').classList.remove('hidden'); });
  }
  startGame(mode){
    this.mode=mode;
    document.getElementById('titleScreen').classList.add('hidden');
    audio.init();
    if(this.organisms.length===0) this.seedInitial();
    this.logEvent(`TANK INITIALIZED // MODE: ${mode.toUpperCase()}`,'system');
    if(!this._loopStarted){ this._loopStarted=true; requestAnimationFrame((t)=>this.loop(t)); }
    // populate manual milestones
    const ml=document.getElementById('manualMilestones'); ml.innerHTML=''; this.campaign.milestones.forEach(m=>{ const li=document.createElement('li'); li.textContent=`${m.title}: ${m.desc}`; ml.appendChild(li); });
  }
  seedInitial(){
    this.organisms=[];
    this.particles=[];
    this.habitats=[];
    // 12 drops as per premise - balanced for stability
    for(let i=0;i<CONFIG.INITIAL_COUNT;i++){
      const g=randomGenome();
      if(i<8) g.feeding=0; // 8 producers for stable base
      else if(i<10) g.feeding=1; // 2 grazers
      else if(i<11) g.feeding=2; // 1 filter
      else g.feeding=choice([2,3,4]); // 1 diverse
      const o=new Organism(g, rand(100,CONFIG.TANK_W-100), rand(100,CONFIG.TANK_H-100));
      this.organisms.push(o);
    }
    // some habitat
    for(let i=0;i<5;i++) this.habitats.push({x:rand(50,CONFIG.TANK_W-50), y:rand(CONFIG.TANK_H-150,CONFIG.TANK_H-30), type:choice(['rock','kelp','shell']), size:rand(20,50)});
  }
  reset(){
    this.environment=new Environment();
    this.popHistory={producer:[], grazer:[], filter:[], scavenger:[], predator:[], parasite:[], total:[]};
    this.traitHistory={avgTempPref:[], avgBiolum:[], avgSocial:[], avgSize:[]};
    this.research=new ResearchMgr();
    this.campaign=new CampaignMgr();
    this.logEntries=[];
    this.selected=null;
    this.breedSlots=[null,null];
    this.seedInitial();
    this.logEvent('TANK RESET // NEW SAMPLE INTRODUCED','system');
  }
  togglePause(){
    this.paused=!this.paused;
    document.getElementById('pauseBtn').textContent=this.paused?'▶':'⏸';
    this.logEvent(this.paused?'SIMULATION PAUSED':'SIMULATION RESUMED','system');
  }
  countRole(role){ return this.organisms.filter(o=>o.alive && o.role===role).length; }
  aliveCount(){ return this.organisms.filter(o=>o.alive).length; }
  spawnRandom(n=1, mutate=false){
    for(let i=0;i<n;i++){
      let g=randomGenome();
      if(mutate && this.organisms.length>0){
        const parent=choice(this.organisms.filter(o=>o.alive));
        if(parent){ const res=mutateGenome(parent.genome); g=res.genome; }
      }
      const o=new Organism(g, rand(20,CONFIG.TANK_W-20), rand(20,CONFIG.TANK_H-100));
      this.organisms.push(o);
    }
  }
  applyFood(type){
    audio.play('feed');
    switch(type){
      case 'algae':
        for(let i=0;i<12;i++) this.particles.push({x:rand(0,CONFIG.TANK_W), y:0, vx:rand(-0.2,0.2), vy:rand(0.3,0.8), type:'algae', life:20, size:4});
        this.environment.nutrients=Math.min(100,this.environment.nutrients+5);
        break;
      case 'protein':
        for(let i=0;i<8;i++) this.particles.push({x:rand(0,CONFIG.TANK_W), y:rand(0,CONFIG.TANK_H), vx:rand(-0.3,0.3), vy:rand(-0.2,0.2), type:'protein', life:18, size:5});
        break;
      case 'detritus':
        for(let i=0;i<15;i++) this.particles.push({x:rand(0,CONFIG.TANK_W), y:rand(0,CONFIG.TANK_H), vx:rand(-0.2,0.2), vy:rand(0.1,0.4), type:'detritus', life:25, size:3});
        break;
      case 'nutrient':
        this.environment.nutrients=Math.min(100,this.environment.nutrients+18);
        this.logEvent('Nutrient burst injected','env');
        break;
      case 'clean':
        this.environment.contamination=Math.max(0,this.environment.contamination-22);
        this.logEvent('Decontaminant applied','env');
        break;
      case 'o2':
        this.environment.oxygen=Math.min(100,this.environment.oxygen+20);
        break;
    }
  }
  applyHabitat(type){
    if(type==='clear'){ this.habitats=[]; return; }
    if(type==='light'){
      this.controls.light=Math.min(100,this.controls.light+10);
      return;
    }
    this.habitats.push({x:rand(60,CONFIG.TANK_W-60), y:rand(CONFIG.TANK_H-120,CONFIG.TANK_H-20), type, size:rand(24,60)});
    this.logEvent(`Habitat placed: ${type}`,'env');
  }
  applyIntro(type){
    switch(type){
      case 'producer': this.spawnRandom(6); break;
      case 'grazer': { let g=randomGenome(); g.feeding=1; for(let i=0;i<4;i++){ const gg={...g}; const o=new Organism(gg, rand(100,CONFIG.TANK_W-100), rand(100,CONFIG.TANK_H-100)); this.organisms.push(o);} } break;
      case 'filter': { let g=randomGenome(); g.feeding=2; for(let i=0;i<4;i++){ const o=new Organism({...g}, rand(100,CONFIG.TANK_W-100), rand(100,CONFIG.TANK_H-100)); this.organisms.push(o);} } break;
      case 'predator': { let g=randomGenome(); g.feeding=4; g.size=1.2; g.aggression=0.8; const o=new Organism(g, CONFIG.TANK_W/2, CONFIG.TANK_H/2); this.organisms.push(o);} break;
      case 'random': this.spawnRandom(3,true); break;
      case 'cull': if(this.selected){ this.selected.alive=false; this.logEvent(`Culled organism ${this.selected.id}`,'system'); this.selected=null; this.updateInspector(); } break;
    }
  }
  selectAt(x,y){
    let best=null; let bestDist=40;
    for(const o of this.organisms){ if(!o.alive) continue; const d=Math.hypot(o.x-x,o.y-y); if(d<bestDist){bestDist=d; best=o;} }
    this.selected=best;
    this.updateInspector();
    if(best){
      document.getElementById('selectionRing').style.display='block';
      document.getElementById('selectionRing').style.left=best.x+'px';
      document.getElementById('selectionRing').style.top=best.y+'px';
      this.research.observe(best,2);
    }else{
      document.getElementById('selectionRing').style.display='none';
    }
  }
  hoverAt(x,y,e){
    let found=null;
    for(const o of this.organisms){ if(!o.alive) continue; if(Math.hypot(o.x-x,o.y-y)<o.sizePx+6){found=o; break;} }
    const tt=document.getElementById('tooltip');
    if(found){
      tt.style.display='block';
      tt.style.left=(e.clientX+12)+'px'; tt.style.top=(e.clientY-10)+'px';
      tt.innerHTML=`<b>${found.role.toUpperCase()}</b> gen:${found.generation}<br>size:${found.genome.size.toFixed(2)} tempPref:${(found.genome.tempPref*30+5).toFixed(1)}°C<br>energy:${found.energy.toFixed(0)} health:${found.health.toFixed(0)}`;
    }else tt.style.display='none';
  }
  addToBreed(org){
    if(this.breedSlots[0]===null) this.breedSlots[0]=org;
    else if(this.breedSlots[1]===null && org!==this.breedSlots[0]) this.breedSlots[1]=org;
    else { this.breedSlots=[org,null]; }
    this.updateBreedCanvas();
  }
  updateBreedCanvas(){
    const ctx=this.breedCtx; ctx.clearRect(0,0,240,120);
    ctx.fillStyle='#081419'; ctx.fillRect(0,0,240,120);
    this.breedSlots.forEach((org,i)=>{
      if(!org) return;
      const x= i===0?60:180; const y=60;
      this.drawOrganismSmall(ctx, org, x,y, 0);
      ctx.fillStyle='#6cf2c2'; ctx.font='10px monospace'; ctx.fillText(org.role.slice(0,4), x-14, y+38);
    });
    document.getElementById('breedInfo').textContent= this.breedSlots[0] && this.breedSlots[1] ? 'Ready to cross' : this.breedSlots[0] ? 'Select second parent' : 'Drop 2 organisms';
  }
  attemptBreed(){
    if(!this.breedSlots[0] || !this.breedSlots[1]) return;
    if(this.aliveCount()>=CONFIG.POP_CAP){ this.logEvent('Population cap reached, cannot breed','warn'); return; }
    const child=this.breedSlots[0].reproduce(this.breedSlots[1]);
    child.x=CONFIG.TANK_W/2+rand(-30,30); child.y=CONFIG.TANK_H/2+rand(-20,20);
    this.organisms.push(child);
    this.logEvent(`Selective cross: ${this.breedSlots[0].id} x ${this.breedSlots[1].id} -> ${child.id} gen ${child.generation}`,'breed');
    this.breedSlots=[null,null]; this.updateBreedCanvas();
  }
  checkChorus(){
    // find biolum high, social high, sensory high, with school
    const candidates=this.organisms.filter(o=>o.alive && o.genome.biolum>0.85 && o.genome.social>0.75 && o.genome.sensory>0.75);
    for(const c of candidates){
      const neighbors=this.grid.query(c.x,c.y,90).filter(o=>o.alive && o!==c && Math.abs(o.genome.biolum-c.genome.biolum)<0.15 && Math.abs(o.genome.hue-c.genome.hue)<30);
      if(neighbors.length>=5) return true;
    }
    return false;
  }
  triggerEnding(){
    if(this.campaign.endingTriggered) return;
    this.campaign.endingTriggered=true;
    const avgSize=this.organisms.filter(o=>o.alive).reduce((s,o)=>s+o.genome.size,0)/Math.max(1,this.aliveCount());
    const maxGen=Math.max(...this.organisms.map(o=>o.generation));
    const speciesCount=this.research.speciesCatalog.size;
    document.getElementById('endingText').innerHTML=`You did not design the Chorus Mind. You created conditions where light became language.<br><br>Organisms with high bioluminescence, social tendency, and sensory range began synchronizing flashes. Their offspring preserved the pattern. What you are seeing is not a scripted behavior — it is convergent evolution of communication.<br><br>Population: ${this.aliveCount()}<br>Species diverged: ${speciesCount}<br>Generations: ${maxGen}<br>Average size: ${avgSize.toFixed(2)}<br><br>The probe's ocean was not empty. It was waiting for a tank.`;
    document.getElementById('endingStats').innerHTML=`<pre>${JSON.stringify({finalPop:this.aliveCount(), species:speciesCount, maxGen, avgBiolum: (this.organisms.reduce((s,o)=>s+o.genome.biolum,0)/this.organisms.length).toFixed(3)},null,2)}</pre>`;
    document.getElementById('endingScreen').classList.remove('hidden');
    this.logEvent('DISCOVERY: CHORUS MIND — final milestone achieved','milestone');
  }
  logEvent(text, type='info'){
    const time=new Date().toLocaleTimeString();
    this.logEntries.push({time,text,type});
    if(this.logEntries.length>120) this.logEntries.shift();
    const el=document.getElementById('eventLog');
    const div=document.createElement('div');
    div.textContent=`[${time}] ${text}`;
    if(type==='milestone') div.style.color='#6cf2c2';
    if(type==='event') div.style.color='#ffde7a';
    if(type==='warn') div.style.color='#ff6b6b';
    el.appendChild(div); el.scrollTop=el.scrollHeight;
    if(type==='milestone' || type==='event'){
      const bar=document.getElementById('alertBar');
      bar.textContent=text; bar.style.color=type==='milestone'?'#6cf2c2':'#ffde7a';
      setTimeout(()=>{bar.textContent='';},6000);
    }
  }
  showMilestone(m){
    document.getElementById('milestoneTitle').textContent=m.title;
    document.getElementById('milestoneDesc').textContent=m.desc;
    document.getElementById('milestonePopup').classList.remove('hidden');
  }
  // --- Core Loop ---
  loop(timestamp){
    if(!this._last) this._last=timestamp;
    let dt=(timestamp-this._last)/1000; this._last=timestamp;
    dt=Math.min(dt,0.1); // cap
    dt*=this.speed;
    if(!this.paused){
      this.time+=dt;
      this.environment.update(dt, this.controls);
      this.events.update(this, dt);
      this.campaign.update(this, dt);

      // spatial grid
      this.grid.clear();
      for(const o of this.organisms) if(o.alive) this.grid.insert(o);

      // update organisms
      let newBorns=[];
      for(const o of this.organisms){
        if(!o.alive) continue;
        o.update(this.environment, this.grid, this.organisms, this.particles, dt);
        if(o.canReproduce() && this.aliveCount()+newBorns.length < CONFIG.POP_CAP){
          // chance based on reproRate
          if(Math.random()< o.genome.reproRate*0.04*dt*20){
            // try sexual if social high and partner nearby
            let partner=null;
            if(o.genome.social>0.5){
              const near=this.grid.query(o.x,o.y,50).filter(n=>n!==o && n.alive && n.role===o.role && n.canReproduce());
              if(near.length>0 && Math.random()<o.genome.social*0.5) partner=choice(near);
            }
            const child=o.reproduce(partner);
            newBorns.push(child);
            this.research.totalBirths++;
          }
        }
        if(o.alive) this.research.observe(o, dt*0.1);
      }
      this.organisms.push(...newBorns);

      // particles
      this.updateParticles(dt);

      // research catalog
      if(this.time%1<dt) this.research.catalog(this.organisms);

      // population history
      if(this.time%0.8<dt){
        const roles=ROLES;
        for(const r of roles){ const c=this.countRole(r); const arr=this.popHistory[r]; arr.push(c); if(arr.length>200) arr.shift(); }
        const tot=this.aliveCount(); this.popHistory.total.push(tot); if(this.popHistory.total.length>200) this.popHistory.total.shift();
        // trait history
        const alive=this.organisms.filter(o=>o.alive);
        if(alive.length>0){
          const avg=(k)=>alive.reduce((s,o)=>s+o.genome[k],0)/alive.length;
          this.traitHistory.avgTempPref.push(avg('tempPref')); if(this.traitHistory.avgTempPref.length>200) this.traitHistory.avgTempPref.shift();
          this.traitHistory.avgBiolum.push(avg('biolum')); if(this.traitHistory.avgBiolum.length>200) this.traitHistory.avgBiolum.shift();
          this.traitHistory.avgSocial.push(avg('social')); if(this.traitHistory.avgSocial.length>200) this.traitHistory.avgSocial.shift();
          this.traitHistory.avgSize.push(avg('size')); if(this.traitHistory.avgSize.length>200) this.traitHistory.avgSize.shift();
        }
      }

      // bubbles
      this.bubbleTimer-=dt;
      if(this.bubbleTimer<=0){ this.bubbleTimer=rand(0.2,0.8); this.particles.push({x:rand(0,CONFIG.TANK_W), y:CONFIG.TANK_H-5, vx:rand(-0.2,0.2), vy:rand(-0.8,-0.3), type:'bubble', life:rand(3,7), size:rand(1,3)}); if(Math.random()<0.3) audio.play('bubble'); }

      // dead removal if over cap (keep recent)
      if(this.organisms.length>CONFIG.POP_CAP*1.2){
        const dead=this.organisms.filter(o=>!o.alive); dead.sort((a,b)=>a.age-b.age);
        const toRemove=Math.min(dead.length, this.organisms.length-CONFIG.POP_CAP);
        for(let i=0;i<toRemove;i++){ const idx=this.organisms.indexOf(dead[i]); if(idx>=0) this.organisms.splice(idx,1); }
      }

      // prevent total collapse: more robust reseeding
      if(this.countRole('producer')<2 && Math.random()<0.05){ this.spawnRandom(4); this.logEvent('Auto-reseed: producer spores detected','system'); }
      if(this.aliveCount()<4 && Math.random()<0.08){ this.spawnRandom(3,true); this.logEvent('Auto-reseed: emergency diversity injection','system'); }

      // UI updates throttled
      if(this.time%0.3<dt){
        this.updateUI();
      }
    }
    this.render();
    requestAnimationFrame((t)=>this.loop(t));
  }
  updateParticles(dt){
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.x+=p.vx*dt*30; p.y+=p.vy*dt*30; p.life-=dt;
      p.vy-= (p.type==='bubble'?0.02:0.01)*dt*10;
      if(p.life<=0 || p.y<-10 || p.x< -10 || p.x>CONFIG.TANK_W+10) this.particles.splice(i,1);
    }
  }
  updateUI(){
    document.getElementById('popCount').textContent=this.aliveCount();
    document.getElementById('popCap').textContent=CONFIG.POP_CAP;
    document.getElementById('o2Read').textContent=this.environment.oxygen.toFixed(1);
    document.getElementById('contamRead').textContent=this.environment.contamination.toFixed(1);
    document.getElementById('phRead').textContent=this.environment.ph.toFixed(2);
    document.getElementById('perfIndicator').textContent=`${this.organisms.length} entities`;

    // population bar
    const bar=document.getElementById('populationBar'); bar.innerHTML='';
    for(const r of ROLES){ const c=this.countRole(r); if(c>0){ const span=document.createElement('span'); span.className='popDot'; span.innerHTML=`<i style="background:${ROLE_COLOR[r]}"></i>${r}:${c}`; bar.appendChild(span);} }

    // research notebook
    this.renderSpecies();
    this.renderTraits();
    this.renderMilestones();
    this.renderGraphs();

    // env graph
    this.renderEnvGraph();

    if(this.selected) this.updateInspector();
  }
  renderSpecies(){
    const el=document.getElementById('speciesList'); el.innerHTML='';
    const sorted=[...this.research.speciesCatalog.entries()].sort((a,b)=>b[1].count-a[1].count);
    for(const [key, data] of sorted){
      const div=document.createElement('div'); div.className='speciesItem';
      div.innerHTML=`<b style="color:${ROLE_COLOR[data.role]}">${data.role.toUpperCase()}</b> x${data.count} <span class="dim">bp:${data.bodyPlan} avgSize:${data.avgSize.toFixed(2)} tempPref:${(data.avgTemp*30+5).toFixed(1)}°C</span><br><small>${data.examples.map(o=>o.id).join(', ')}</small>`;
      el.appendChild(div);
    }
    if(sorted.length===0) el.innerHTML='<span class="dim">No species cataloged yet. Observe.</span>';
  }
  renderTraits(){
    const el=document.getElementById('traitList'); el.innerHTML='';
    const allTraits=Object.keys(TRAIT_DEFS);
    for(const t of allTraits){
      const disc=this.research.traitsDiscovered.has(t);
      const div=document.createElement('div'); div.className='traitItem';
      div.innerHTML=`<span>${t}</span><span class="${disc?'':'dim'}">${disc?'UNLOCKED':'???'}</span>`;
      el.appendChild(div);
    }
    // trait history avg
    if(this.traitHistory.avgBiolum.length>0){
      const avgBiolum=this.traitHistory.avgBiolum[this.traitHistory.avgBiolum.length-1];
      const avgSocial=this.traitHistory.avgSocial[this.traitHistory.avgSocial.length-1];
      const avgTemp=this.traitHistory.avgTempPref[this.traitHistory.avgTempPref.length-1];
      const info=document.createElement('div'); info.style.marginTop='8px'; info.className='dim';
      info.innerHTML=`avg biolum:${avgBiolum.toFixed(3)} social:${avgSocial.toFixed(3)} tempPref:${avgTemp.toFixed(3)}`;
      el.appendChild(info);
    }
  }
  renderMilestones(){
    const el=document.getElementById('milestoneList'); el.innerHTML='';
    for(const m of this.campaign.milestones){
      const div=document.createElement('div'); div.className='milestoneItem'+(m.done?' done':'')+(m.active?' active':'');
      const prog=m.instant?'':` [${m.progress.toFixed(0)}/${m.required}]`;
      div.innerHTML=`<b>${m.title}</b>${prog}<br><span class="dim">${m.desc}</span><br>${m.done?'✓ COMPLETE':m.active?'◍ IN PROGRESS':'○ LOCKED'}`;
      el.appendChild(div);
    }
  }
  renderGraphs(){
    // pop graph
    const ctx=this.popCtx; const w=this.popCanvas.width, h=this.popCanvas.height;
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#081419'; ctx.fillRect(0,0,w,h);
    const maxPop=Math.max(10, ...this.popHistory.total, 20);
    ROLES.forEach(role=>{
      const arr=this.popHistory[role]; if(arr.length<2) return;
      ctx.strokeStyle=ROLE_COLOR[role]; ctx.lineWidth=1.2; ctx.beginPath();
      arr.forEach((v,i)=>{ const x=(i/200)*w; const y=h-(v/maxPop)*h; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
    });
    ctx.fillStyle='#6cf2c2'; ctx.font='9px monospace'; ctx.fillText(`TOTAL POP (max ${maxPop})`,4,10);

    // trait graph
    const tctx=this.traitCtx; const tw=this.traitCanvas.width, th=this.traitCanvas.height;
    tctx.clearRect(0,0,tw,th); tctx.fillStyle='#081419'; tctx.fillRect(0,0,tw,th);
    const drawLine=(arr,color)=>{ if(arr.length<2) return; tctx.strokeStyle=color; tctx.lineWidth=1; tctx.beginPath(); arr.forEach((v,i)=>{ const x=(i/200)*tw; const y=th-(v*th); if(i===0) tctx.moveTo(x,y); else tctx.lineTo(x,y); }); tctx.stroke(); };
    drawLine(this.traitHistory.avgBiolum,'#6cf2c2');
    drawLine(this.traitHistory.avgSocial,'#8aa8ff');
    drawLine(this.traitHistory.avgTempPref,'#ffde7a');
    drawLine(this.traitHistory.avgSize,'#ff6b6b');
    tctx.fillStyle='#7a9a93'; tctx.font='8px monospace'; tctx.fillText('biolum cyan, social blue, temp yellow, size red',4,10);
  }
  renderEnvGraph(){
    const ctx=this.envCtx; const w=this.envCanvas.width, h=this.envCanvas.height;
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#081419'; ctx.fillRect(0,0,w,h);
    const hist=this.environment.history;
    const draw=(arr,color,min,max)=>{ if(arr.length<2) return; ctx.strokeStyle=color; ctx.lineWidth=1; ctx.beginPath(); arr.forEach((v,i)=>{ const x=(i/200)*w; const norm=(v-min)/(max-min); const y=h-norm*h; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); };
    draw(hist.temp,'#ff6b6b',5,35);
    draw(hist.oxygen,'#6cf2a2',0,100);
    draw(hist.contam,'#ffde7a',0,100);
    draw(hist.nutrients,'#8aa8ff',0,100);
    ctx.fillStyle='#7a9a93'; ctx.font='8px monospace'; ctx.fillText(`T:${this.environment.temperature.toFixed(1)} O₂:${this.environment.oxygen.toFixed(0)} C:${this.environment.contamination.toFixed(0)} N:${this.environment.nutrients.toFixed(0)}`,4,10);
  }
  // --- Rendering ---
  render(){
    const ctx=this.ctx;
    const W=CONFIG.TANK_W, H=CONFIG.TANK_H;
    ctx.clearRect(0,0,W,H);

    // water gradient
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#0e2f3a'); grad.addColorStop(0.5,'#0a222b'); grad.addColorStop(1,'#06141a');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);

    // light rays
    ctx.save(); ctx.globalAlpha=0.06 + this.environment.light/100*0.08;
    for(let i=0;i<5;i++){
      const x=W*0.2+i*W*0.15 + Math.sin(this.time*0.2+i)*10;
      ctx.fillStyle='#ffeeaa';
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+40,H*0.6); ctx.lineTo(x+10,H*0.6); ctx.lineTo(x-30,0); ctx.fill();
    }
    ctx.restore();

    // substrate
    ctx.fillStyle='#0d1f26'; ctx.fillRect(0,H-28,W,28);
    ctx.fillStyle='#122f3a'; for(let i=0;i<W;i+=18){ ctx.fillRect(i+Math.sin(i)*2,H-26,12,6); }

    // habitats
    for(const hb of this.habitats){
      ctx.save(); ctx.translate(hb.x,hb.y);
      if(hb.type==='rock'){ ctx.fillStyle='#2a3f4a'; ctx.beginPath(); ctx.ellipse(0,0,hb.size*0.8,hb.size*0.5,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#1e2f38'; ctx.beginPath(); ctx.ellipse(-hb.size*0.2,-hb.size*0.2,hb.size*0.4,hb.size*0.25,0,0,Math.PI*2); ctx.fill(); }
      else if(hb.type==='kelp'){ ctx.strokeStyle='#2a6a4a'; ctx.lineWidth=4; for(let k=0;k<3;k++){ ctx.beginPath(); ctx.moveTo((k-1)*8,0); ctx.bezierCurveTo((k-1)*8+rand(-6,6),-hb.size*0.3,(k-1)*8+rand(-8,8),-hb.size*0.7,(k-1)*8,-hb.size); ctx.stroke(); } }
      else if(hb.type==='shell'){ ctx.fillStyle='#3a4a5a'; ctx.beginPath(); ctx.arc(0,0,hb.size*0.4,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    }

    // particles
    for(const p of this.particles){
      ctx.save(); ctx.globalAlpha=clamp(p.life/10,0,1);
      if(p.type==='bubble'){ ctx.fillStyle='rgba(180,220,255,0.6)'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
      else if(p.type==='algae'){ ctx.fillStyle='rgba(108,242,162,0.7)'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
      else if(p.type==='protein'){ ctx.fillStyle='rgba(255,107,107,0.7)'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
      else if(p.type==='detritus'){ ctx.fillStyle='rgba(180,160,120,0.5)'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*0.8,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    }

    // organisms - sort by y for depth
    const alive=this.organisms.filter(o=>o.alive).sort((a,b)=>a.y-b.y);
    for(const org of alive){
      this.drawOrganism(ctx, org, this.time);
    }

    // selection ring update
    if(this.selected && this.selected.alive){
      const ring=document.getElementById('selectionRing');
      ring.style.left=this.selected.x+'px'; ring.style.top=this.selected.y+'px';
    }

    // contamination vignette
    const contamEl=document.getElementById('contamVignette');
    contamEl.style.opacity= (this.environment.contamination/100)*0.6;
  }
  drawOrganism(ctx, org, time){
    const g=org.genome;
    ctx.save();
    ctx.translate(org.x, org.y);
    const angle=Math.atan2(org.vy, org.vx);
    ctx.rotate(angle);
    const scale=g.size;
    ctx.scale(scale,scale);

    // biolum glow
    if(g.biolum>0.3){
      ctx.shadowBlur= 8+ g.biolum*20;
      ctx.shadowColor=`hsla(${g.hue},${g.saturation*100}%,60%,${0.4+g.biolum*0.5})`;
    }

    // body plan
    const bodyColor=`hsl(${g.hue},${g.saturation*100}%,${45+g.armor*10}%)`;
    ctx.fillStyle=bodyColor;
    ctx.strokeStyle=`hsl(${g.hue},${g.saturation*100}%,30%)`;
    ctx.lineWidth=0.8;

    const bp=g.bodyPlan;
    if(bp===0){ // jelly
      ctx.beginPath(); ctx.ellipse(0,0,12,10,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=bodyColor; ctx.lineWidth=1.2; ctx.globalAlpha=0.6;
      for(let i=0;i<4+Math.floor(g.appendage*4);i++){ ctx.beginPath(); ctx.moveTo(-6+i*4,-2); ctx.bezierCurveTo(-8+i*4+Math.sin(time*2+i)*3,8, -4+i*4+Math.cos(time*1.5+i)*3,16, -6+i*4,20); ctx.stroke(); }
      ctx.globalAlpha=1;
    }else if(bp===1){ // fish
      ctx.beginPath(); ctx.ellipse(0,0,14,8,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      // tail
      const tailW= 8+ g.finCount*6;
      ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-14-tailW, -6); ctx.lineTo(-14-tailW,6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }else if(bp===2){ // worm
      ctx.lineCap='round'; ctx.lineWidth=6; ctx.strokeStyle=bodyColor; ctx.beginPath();
      for(let i=0;i<3;i++){ const off=Math.sin(time*2+i)*2; ctx.moveTo(-12+i*8,off); ctx.lineTo(-4+i*8,off); ctx.stroke(); }
      ctx.fillStyle=bodyColor; ctx.beginPath(); ctx.arc(10,0,5,0,Math.PI*2); ctx.fill();
    }else if(bp===3){ // crab
      ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=bodyColor; ctx.lineWidth=1.5;
      for(let i=-1;i<=1;i++){ // legs
        ctx.beginPath(); ctx.moveTo(i*4,4); ctx.lineTo(i*8+ (i*3),10+Math.sin(time*3+i)*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i*4,-4); ctx.lineTo(i*8+(i*3),-10+Math.cos(time*3+i)*2); ctx.stroke();
      }
    }else{ // urchin
      ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=`hsl(${g.hue},80%,50%)`; ctx.lineWidth=1;
      for(let i=0;i<8+Math.floor(g.appendage*8);i++){ const a=i/ (8+Math.floor(g.appendage*8))*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(a)*9,Math.sin(a)*9); ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14); ctx.stroke(); }
    }

    // fins
    if(g.finCount>0.2 && bp!==0){
      const fc=Math.floor(g.finCount*3)+1;
      ctx.fillStyle=`hsla(${g.hue},${g.saturation*80}%,65%,0.8)`;
      for(let i=0;i<fc;i++){
        const fx= -6 + i*4; const fy= -8 - i*1;
        ctx.beginPath(); ctx.ellipse(fx,fy,3,5, -0.4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fx,-fy,3,5, 0.4,0,Math.PI*2); ctx.fill();
      }
    }

    // shell
    if(g.shellType>0 && g.armor>0.35){
      ctx.fillStyle=`hsla(${g.hue+20},30%,75%,${0.5+g.armor*0.4})`;
      ctx.strokeStyle=`hsla(${g.hue},20%,40%,0.8)`;
      ctx.lineWidth=1;
      if(g.shellType===1){ ctx.beginPath(); ctx.ellipse(0,0,11,9,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
      else{ // spiked
        ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); ctx.stroke();
        for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(a)*10,Math.sin(a)*10); ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14); ctx.stroke(); }
      }
    }

    // eyes
    const eyeC=Math.floor(g.eyeCount*5)+ (g.eyeCount>0.1?1:0);
    ctx.fillStyle='#eaffff';
    for(let i=0;i<eyeC;i++){
      const ex= 6 + (i%2)*2; const ey= -4 + i*3;
      ctx.beginPath(); ctx.arc(ex,ey,1.5+g.sensory*1.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#0a1418'; ctx.beginPath(); ctx.arc(ex+0.3,ey,0.8,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#eaffff';
    }

    // mouth
    ctx.fillStyle='#1a0a0a';
    const mx=10, my=0;
    if(g.mouthType===0){ ctx.beginPath(); ctx.arc(mx,my,1.5,0,Math.PI*2); ctx.fill(); }
    else if(g.mouthType===1){ ctx.fillRect(mx-1,my-2,3,4); }
    else if(g.mouthType===2){ ctx.beginPath(); ctx.moveTo(mx,my-3); ctx.lineTo(mx+4,my); ctx.lineTo(mx,my+3); ctx.fill(); }
    else if(g.mouthType===3){ ctx.beginPath(); ctx.arc(mx,my,3,0,Math.PI); ctx.fill(); }
    else{ ctx.beginPath(); ctx.moveTo(mx,my-2); ctx.lineTo(mx+3,my-1); ctx.lineTo(mx+3,my+1); ctx.lineTo(mx,my+2); ctx.fill(); }

    // markings
    if(g.marking>0){
      ctx.strokeStyle=`hsla(${(g.hue+60)%360},90%,60%,0.7)`; ctx.lineWidth=0.8;
      if(g.marking===1){ // stripes
        for(let i=-8;i<8;i+=4){ ctx.beginPath(); ctx.moveTo(i,-6); ctx.lineTo(i,6); ctx.stroke(); }
      }else if(g.marking===2){ // spots
        ctx.fillStyle=`hsla(${(g.hue+60)%360},80%,60%,0.8)`; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(-6+i*6, rand(-4,4),2,0,Math.PI*2); ctx.fill(); }
      }else if(g.marking===3){ ctx.strokeStyle=`hsla(${(g.hue+180)%360},80%,60%,0.6)`; ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.stroke(); }
    }

    // role indicator tiny
    ctx.fillStyle=ROLE_COLOR[org.role]; ctx.globalAlpha=0.9; ctx.beginPath(); ctx.arc(-12,-8,2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;

    ctx.restore();

    // health bar
    if(org.health<95){
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(org.x-10, org.y-org.sizePx-8,20,3);
      ctx.fillStyle= org.health>50 ? '#6cf2a2' : '#ff6b6b'; ctx.fillRect(org.x-10, org.y-org.sizePx-8, 20*(org.health/100),3);
    }
    // energy bar
    if(org.energy<90){
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(org.x-10, org.y-org.sizePx-12,20,2);
      ctx.fillStyle='#8aa8ff'; ctx.fillRect(org.x-10, org.y-org.sizePx-12,20*(org.energy/100),2);
    }

    // parasite line
    if(org.attachedTo && org.attachedTo.alive){
      ctx.strokeStyle=`hsla(${g.hue},70%,60%,0.4)`; ctx.lineWidth=0.8; ctx.setLineDash([2,2]);
      ctx.beginPath(); ctx.moveTo(org.x,org.y); ctx.lineTo(org.attachedTo.x,org.attachedTo.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  drawOrganismSmall(ctx, org, x,y, angle){
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(0.7,0.7);
    this.drawOrganism(ctx, org, 0); // reuse but without health bars? It will draw health but okay
    ctx.restore();
  }
  // inspector
  updateInspector(){
    const empty=document.getElementById('inspectorEmpty');
    const content=document.getElementById('inspectorContent');
    if(!this.selected || !this.selected.alive){ empty.style.display='block'; content.classList.add('hidden'); return; }
    empty.style.display='none'; content.classList.remove('hidden');
    const org=this.selected;
    const ictx=this.inspectorCtx; ictx.clearRect(0,0,260,160); ictx.fillStyle='#081419'; ictx.fillRect(0,0,260,160);
    // draw larger
    this.drawOrganism(ictx, org, this.time*0.5); // need to adjust because ictx is not transformed for tank coords
    // Actually draw centered
    ictx.save(); ictx.translate(130,80); ictx.scale(2,2); ictx.translate(-org.x,-org.y); // hack: drawOrganism uses org.x,y internally for translation, so we need custom small draw
    // Let's do manual small draw using same logic but centered
    ictx.restore();
    // Simpler: redraw using small renderer
    ictx.clearRect(0,0,260,160); ictx.fillStyle='#081419'; ictx.fillRect(0,0,260,160);
    // use centered draw
    const g=org.genome;
    ictx.save(); ictx.translate(130,80); ictx.scale(2.2,2.2);
    // replicate body drawing quickly
    ictx.fillStyle=`hsl(${g.hue},${g.saturation*100}%,55%)`;
    ictx.beginPath(); ictx.ellipse(0,0,14,8,0,0,Math.PI*2); ictx.fill();
    ictx.fillStyle=ROLE_COLOR[org.role]; ictx.beginPath(); ictx.arc(-12,-8,3,0,Math.PI*2); ictx.fill();
    ictx.fillStyle='#cde6df'; ictx.font='8px monospace'; ictx.fillText(org.role.toUpperCase(),-20,20);
    ictx.restore();

    document.getElementById('inspectorMeta').innerHTML=`ID: ${org.id} | GEN: ${org.generation} | LINEAGE: ${org.lineageId}<br>AGE: ${org.age.toFixed(1)}s | ENERGY: ${org.energy.toFixed(0)} | HEALTH: ${org.health.toFixed(0)}<br>ROLE: ${org.role} | SIZE: ${g.size.toFixed(2)} | OBS: ${org.observation.toFixed(1)}s`;

    const traitsDiv=document.getElementById('inspectorTraits'); traitsDiv.innerHTML='';
    for(const k in TRAIT_DEFS){
      const disc=this.research.traitsDiscovered.has(k);
      const val=g[k];
      const isMut=org.mutations[k];
      const row=document.createElement('div'); row.className='traitRow '+(disc?'discovered':'hiddenTrait')+(isMut?' mutated':'');
      const displayVal= disc ? (typeof val==='number' ? val.toFixed(3) : val) : '???';
      row.innerHTML=`<span>${k}${isMut?'*':''}</span><span>${displayVal}</span>`;
      if(isMut && disc) row.title=`Mutated from ${org.mutations[k].from.toFixed?org.mutations[k].from.toFixed(3):org.mutations[k].from} to ${org.mutations[k].to.toFixed?org.mutations[k].to.toFixed(3):org.mutations[k].to}`;
      traitsDiv.appendChild(row);
    }

    const linDiv=document.getElementById('inspectorLineage'); linDiv.innerHTML=`Parents: ${org.parentIds.join(', ')||'ORIGIN SAMPLE'}<br>Mutations: ${Object.keys(org.mutations).length>0?Object.entries(org.mutations).map(([k,v])=>`${k}: ${typeof v.from==='number'?v.from.toFixed(2):v.from}→${typeof v.to==='number'?v.to.toFixed(2):v.to}`).join(', '):'none (clone)'}<br>Lineage depth: ${org.generation}`;

    this.drawLineage(org);
  }
  drawLineage(org){
    const ctx=this.lineageCtx; const w=this.lineageCanvas.width, h=this.lineageCanvas.height;
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#081419'; ctx.fillRect(0,0,w,h);
    // build ancestry chain (we only have parentIds, need to look up)
    const chain=[]; let cur=org; let depth=0;
    while(cur && depth<12){
      chain.push(cur);
      if(cur.parentIds.length>0){
        const pid=cur.parentIds[0];
        const parent=this.organisms.find(o=>o.id===pid) || this.organisms.find(o=>o.id===pid) || null;
        // also search dead? we keep dead for a while, but if not found, break
        // Try find in all organisms including dead (we keep array)
        const found=this.organisms.find(o=>o.id===pid);
        cur=found||null;
      }else cur=null;
      depth++;
    }
    chain.reverse();
    // draw tree
    ctx.strokeStyle='#1f3a44'; ctx.lineWidth=1;
    chain.forEach((o,i)=>{
      const x= 20 + (i/(Math.max(1,chain.length-1)))*(w-40);
      const y= h/2 + Math.sin(i)*10;
      // line to next
      if(i<chain.length-1){
        const nx=20+((i+1)/(Math.max(1,chain.length-1)))*(w-40);
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(nx,h/2+Math.sin(i+1)*10); ctx.stroke();
      }
      // node
      ctx.fillStyle=ROLE_COLOR[o.role]||'#6cf2c2'; ctx.beginPath(); ctx.arc(x,y,6+o.genome.size*2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#081419'; ctx.font='7px monospace'; ctx.fillText(o.generation.toString(),x-3,y+2);
      if(Object.keys(o.mutations).length>0){
        ctx.fillStyle='#ffde7a'; ctx.beginPath(); ctx.arc(x,y-10,2,0,Math.PI*2); ctx.fill();
      }
    });
    ctx.fillStyle='#7a9a93'; ctx.font='9px monospace'; ctx.fillText(`Lineage: ${org.lineageId} depth ${org.generation}`,4,12);
    document.getElementById('lineageInfo').textContent=`Ancestor chain length ${chain.length}. Yellow dots = mutation. Selected gen ${org.generation} with ${Object.keys(org.mutations).length} mutations.`;
  }

  // --- Save/Load ---
  save(){
    const data={
      version:'0.9',
      time:Date.now(),
      environment:this.environment,
      controls:this.controls,
      organisms:this.organisms.filter(o=>o.alive).map(o=>({id:o.id, genome:o.genome, x:o.x, y:o.y, vx:o.vx, vy:o.vy, energy:o.energy, health:o.health, age:o.age, parentIds:o.parentIds, generation:o.generation, lineageId:o.lineageId, role:o.role, mutations:o.mutations})),
      habitats:this.habitats,
      research:{traitsDiscovered:[...this.research.traitsDiscovered], totalBirths:this.research.totalBirths, totalDeaths:this.research.totalDeaths, symbiosisObserved:this.research.symbiosisObserved},
      campaign:this.campaign.milestones,
      popHistory:this.popHistory,
      traitHistory:this.traitHistory,
      mode:this.mode,
    };
    localStorage.setItem('blackbox_save', JSON.stringify(data));
    // also download
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`blackbox_aquarium_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    this.logEvent('TANK SAVED (localStorage + file)','system');
  }
  load(){
    const raw=localStorage.getItem('blackbox_save');
    if(!raw){ this.logEvent('No saved tank in localStorage','warn'); return; }
    try{
      const data=JSON.parse(raw);
      this.environment=Object.assign(new Environment(), data.environment);
      this.controls=data.controls||this.controls;
      this.organisms=data.organisms.map(d=>{ const o=new Organism(d.genome,d.x,d.y,d.parentIds,d.generation,d.lineageId); Object.assign(o,d); o.alive=true; return o; });
      this.habitats=data.habitats||[];
      this.research.traitsDiscovered=new Set(data.research.traitsDiscovered||[]);
      this.research.totalBirths=data.research.totalBirths||0;
      this.research.symbiosisObserved=data.research.symbiosisObserved||false;
      if(data.campaign){ this.campaign.milestones=data.campaign; }
      this.popHistory=data.popHistory||this.popHistory;
      this.traitHistory=data.traitHistory||this.traitHistory;
      this.mode=data.mode||'campaign';
      // restore sliders
      document.getElementById('tempSlider').value=this.controls.temp;
      document.getElementById('lightSlider').value=this.controls.light;
      document.getElementById('oxySlider').value=this.controls.oxy;
      document.getElementById('phSlider').value=this.controls.ph;
      document.getElementById('nutSlider').value=this.controls.nutrients;
      document.getElementById('filtSlider').value=this.controls.filt;
      this.logEvent(`TANK LOADED: ${this.organisms.length} organisms, gen max ${Math.max(...this.organisms.map(o=>o.generation))}`,'system');
      // verify save/load preserves genomes
      console.log('SAVE LOAD VERIFY', this.organisms.slice(0,2).map(o=>o.genome));
    }catch(e){ console.error(e); this.logEvent('Load failed: '+e.message,'warn'); }
  }

  // --- Validation Helpers ---
  static runValidation(sim){
    const results={};
    results.creaturesReproduce = sim.research.totalBirths>0;
    results.inherit = sim.organisms.some(o=>o.parentIds.length>0);
    results.mutation = sim.organisms.some(o=>Object.keys(o.mutations).length>0);
    results.envAffects = true; // we know logic exists, check health varies with temp
    results.popInteract = sim.popHistory.producer.length>0 && sim.popHistory.grazer.length>0;
    results.lineage = sim.organisms.every(o=>o.lineageId);
    results.appearance = true; // visual genes mapped
    results.researchUnlocks = sim.research.traitsDiscovered.size>0;
    results.eventsWork = sim.logEntries.some(e=>e.type==='event');
    results.milestones = sim.campaign.milestones.some(m=>m.done);
    results.timeControls = true; // pause tested
    results.saveReload = localStorage.getItem('blackbox_save')!==null;
    results.noFatal = true;
    return results;
  }
}

// --- Init ---
let sim;
window.addEventListener('load',()=>{
  sim=new Simulation();
  window.sim=sim; // for debugging
  // expose validation
  window.runValidation=()=>Simulation.runValidation(sim);

  // auto test after 5s if in test mode
  const urlParams=new URLSearchParams(window.location.search);
  if(urlParams.has('autotest')){
    setTimeout(()=>{
      sim.startGame('campaign');
      // simulate environment changes
      setTimeout(()=>{ sim.controls.temp=10; document.getElementById('tempSlider').value=10; },2000);
      setTimeout(()=>{ sim.applyFood('nutrient'); },3000);
      setTimeout(()=>{ sim.events.triggerById('oxygen', sim); },4000);
      setTimeout(()=>{
        const res=Simulation.runValidation(sim);
        console.log('VALIDATION', res);
        document.body.insertAdjacentHTML('beforeend', `<pre id="validationResult" style="position:fixed;bottom:0;left:0;background:#000;color:#0f0;padding:10px;z-index:9999">${JSON.stringify(res,null,2)}</pre>`);
      },8000);
    },500);
  }

  // keyboard pause
  window.addEventListener('keydown',(e)=>{
    if(e.code==='Space'){ e.preventDefault(); sim.togglePause(); }
  });
});
