// @ts-nocheck
// Verbatim copy of cogfall.html script body. Each Phase 1 commit peels one
// section out of this file into a typed module under src/, until this file
// can be deleted in the final wiring commit.

// Phase 1 step 2: data tables peeled out into src/data/*.ts.
import { TERRAIN_TYPES } from './data/terrain';
import { UNIT_TYPES } from './data/units';
import { BUILDING_TYPES } from './data/buildings';
import { TECHS, TECH_BRANCHES } from './data/techs';
import { FACTIONS, MAP_SIZES, CITY_NAMES } from './data/factions';
import { PERSONALITIES, AI_THINKING_LINES } from './data/personalities';

// 'use strict' is implicit in ES modules; the prototype's directive is dropped.

// ============================================================================
// HEX MATH (pointy-top, axial coordinates)
// ============================================================================
const HEX_SIZE=30,SQRT3=Math.sqrt(3);
function hexToPixel(q,r){return{x:HEX_SIZE*SQRT3*(q+r/2),y:HEX_SIZE*1.5*r}}
function pixelToHex(x,y){const q=(SQRT3/3*x-y/3)/HEX_SIZE,r=(2/3*y)/HEX_SIZE;return roundHex(q,r)}
function roundHex(q,r){const s=-q-r;let rq=Math.round(q),rr=Math.round(r),rs=Math.round(s);const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs-s);if(dq>dr&&dq>ds)rq=-rr-rs;else if(dr>ds)rr=-rq-rs;return{q:rq,r:rr}}
const HEX_DIRS=[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}];
function hexNeighbors(q,r){return HEX_DIRS.map(d=>({q:q+d.q,r:r+d.r}))}
function hexDistance(a,b){return(Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2}
function hexKey(q,r){return q+','+r}

// (DATA section moved to src/data/*.ts — see imports at top of file.)

// ============================================================================
// GAME STATE
// ============================================================================
const G={
  map:null,factions:[],units:[],cities:[],turn:1,
  currentFactionIdx:0,playerFactionIdx:0,
  difficulty:'medium',goldHegemonyThreshold:5000,goldHegemonyRequired:3,
  selected:null,moveTargets:[],attackTargets:[],
  events:[],goldHegemonyCounter:{},
  cameraX:0,cameraY:0,zoom:1,
  isDragging:false,dragStart:null,
  nextUnitId:1,nextCityId:1,
  gameOver:false,aiMemory:{}
};
const canvas=document.getElementById('map-canvas');
const ctx=canvas.getContext('2d');
const svg=document.getElementById('overlay-svg');
function resizeCanvas(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;svg.setAttribute('width',window.innerWidth);svg.setAttribute('height',window.innerHeight);if(G.map)render()}
window.addEventListener('resize',resizeCanvas);

// ============================================================================
// MAP GENERATION
// ============================================================================
function generateMap(size){
  const dim=MAP_SIZES[size],tiles=new Map(),w=dim.w,h=dim.h;
  for(let row=0;row<h;row++){
    for(let col=0;col<w;col++){
      const q=col-Math.floor(row/2),r=row;
      tiles.set(hexKey(q,r),{q,r,terrain:'PLAINS',resource:null,improvement:null,owner:null,cityId:null,unitId:null,visibility:{}});
    }
  }
  const seed=Math.random()*1000;
  function hash2(x,y){let h=x*374761393+y*668265263;h=(h^(h>>13))*1274126177;return((h^(h>>16))>>>0)/4294967295}
  function fakeNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const a=hash2(ix,iy),b=hash2(ix+1,iy),c=hash2(ix,iy+1),d=hash2(ix+1,iy+1);const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v}
  function noise(x,y){let n=0,amp=1,freq=0.15,sum=0;for(let o=0;o<4;o++){n+=amp*fakeNoise(x*freq+seed,y*freq+seed*1.3);sum+=amp;amp*=0.5;freq*=2}return n/sum}
  for(const tile of tiles.values()){
    const px=tile.q+tile.r*0.5,py=tile.r;
    const elevation=noise(px,py),moisture=noise(px+99,py+99);
    if(elevation>0.78)tile.terrain='MOUNTAINS';
    else if(elevation>0.66)tile.terrain='HILLS';
    else if(elevation<0.32&&moisture<0.4)tile.terrain='WASTES';
    else if(moisture>0.62)tile.terrain='FOREST';
    else tile.terrain='PLAINS';
  }
  // Border ring
  for(const tile of tiles.values()){
    const offCol=tile.q+Math.floor(tile.r/2);
    if(offCol<=0||offCol>=w-1||tile.r<=0||tile.r>=h-1){
      tile.terrain=Math.random()<0.5?'MOUNTAINS':'WASTES';
    }
  }
  const candidates=[...tiles.values()].filter(t=>t.terrain==='PLAINS'||t.terrain==='HILLS'||t.terrain==='WASTES');
  shuffle(candidates);
  const ruinCount=Math.floor(tiles.size*0.025),aetherCount=Math.floor(tiles.size*0.018);
  for(let i=0;i<ruinCount&&i<candidates.length;i++)candidates[i].terrain='RUINS';
  for(let i=ruinCount;i<ruinCount+aetherCount&&i<candidates.length;i++)candidates[i].terrain='AETHER';
  return{w,h,tiles};
}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

function findFactionStarts(numFactions){
  const walkable=[...G.map.tiles.values()].filter(t=>TERRAIN_TYPES[t.terrain].walkable&&!TERRAIN_TYPES[t.terrain].isAether&&!TERRAIN_TYPES[t.terrain].isRuin);
  const starts=[];
  let attempts=0;
  const minDist=Math.max(6,Math.floor(Math.sqrt(G.map.tiles.size/numFactions)*1.2));
  while(starts.length<numFactions&&attempts<3000){
    const candidate=walkable[Math.floor(Math.random()*walkable.length)];
    const ok=starts.every(s=>hexDistance(s,candidate)>=minDist);
    if(ok){
      const goodNeighbors=hexNeighbors(candidate.q,candidate.r).filter(n=>{const t=G.map.tiles.get(hexKey(n.q,n.r));return t&&TERRAIN_TYPES[t.terrain].walkable}).length;
      if(goodNeighbors>=3)starts.push(candidate);
    }
    attempts++;
  }
  // Fallback if not enough
  while(starts.length<numFactions){
    starts.push(walkable[Math.floor(Math.random()*walkable.length)]);
  }
  return starts;
}

// ============================================================================
// FACTIONS / UNITS / CITIES
// ============================================================================
function createFaction(template,isAI,idx){
  const f={idx,id:template.id,name:template.name,color:template.color,glyph:template.glyph,personality:template.personality,desc:template.desc,isAI,alive:true,resources:{gold:50,aether:0},science:0,researchProgress:0,techs:new Set(template.startTechs||[]),currentResearch:null,score:0,diplo:{}};
  if(template.id==='coin')f.resources.gold+=50;
  return f;
}
function createUnit(typeId,factionIdx,q,r){
  const tpl=UNIT_TYPES[typeId];
  const u={id:G.nextUnitId++,typeId,factionIdx,q,r,hp:tpl.hp,maxHp:tpl.hp,mp:tpl.mp,maxMp:tpl.mp,fortified:false};
  G.units.push(u);
  const tile=getTile(q,r);
  if(tile)tile.unitId=u.id;
  return u;
}
function createCity(factionIdx,q,r,name){
  const c={id:G.nextCityId++,factionIdx,q,r,name,population:1,foodStored:0,foodNeeded:10,productionStored:0,buildings:new Set(),buildQueue:null,isCapital:false,hp:50,maxHp:50};
  G.cities.push(c);
  const tile=getTile(q,r);
  if(tile){tile.cityId=c.id;tile.owner=factionIdx}
  for(const n of hexNeighbors(q,r)){const t=getTile(n.q,n.r);if(t&&t.owner==null)t.owner=factionIdx}
  return c;
}
function getTile(q,r){return G.map.tiles.get(hexKey(q,r))}
function getUnitAt(q,r){const t=getTile(q,r);return t&&t.unitId!=null?G.units.find(u=>u.id===t.unitId):null}
function getCityAt(q,r){const t=getTile(q,r);return t&&t.cityId!=null?G.cities.find(c=>c.id===t.cityId):null}

// ============================================================================
// VISIBILITY
// ============================================================================
function recomputeVisibility(){
  for(const tile of G.map.tiles.values()){
    for(const f of G.factions){
      if(tile.visibility[f.idx]==='visible')tile.visibility[f.idx]='seen';
    }
  }
  for(const c of G.cities)setVisibleAround(c.factionIdx,c.q,c.r,2);
  for(const u of G.units){const sight=UNIT_TYPES[u.typeId].sight;setVisibleAround(u.factionIdx,u.q,u.r,sight)}
}
function setVisibleAround(factionIdx,q,r,sight){
  for(const tile of G.map.tiles.values()){
    if(hexDistance({q,r},tile)<=sight)tile.visibility[factionIdx]='visible';
  }
}
// ============================================================================
// MOVEMENT / COMBAT
// ============================================================================
function computeMoveTargets(unit){
  const start={q:unit.q,r:unit.r};
  const visited=new Map();
  visited.set(hexKey(start.q,start.r),{cost:0});
  const frontier=[{q:start.q,r:start.r,cost:0}];
  while(frontier.length){
    frontier.sort((a,b)=>a.cost-b.cost);
    const cur=frontier.shift();
    for(const n of hexNeighbors(cur.q,cur.r)){
      const t=getTile(n.q,n.r);
      if(!t)continue;
      const tt=TERRAIN_TYPES[t.terrain];
      if(!tt.walkable)continue;
      const newCost=cur.cost+tt.moveCost;
      if(newCost>unit.mp)continue;
      const occupant=getUnitAt(n.q,n.r);
      if(occupant&&occupant.factionIdx!==unit.factionIdx)continue;
      if(occupant&&occupant.factionIdx===unit.factionIdx){
        const c=getCityAt(n.q,n.r);
        if(!(c&&c.factionIdx===unit.factionIdx))continue;
      }
      const key=hexKey(n.q,n.r);
      if(!visited.has(key)||visited.get(key).cost>newCost){
        visited.set(key,{cost:newCost});
        frontier.push({q:n.q,r:n.r,cost:newCost});
      }
    }
  }
  visited.delete(hexKey(start.q,start.r));
  const result=[];
  for(const[k,v]of visited.entries()){const[q,r]=k.split(',').map(Number);result.push({q,r,cost:v.cost})}
  return result;
}
function computeAttackTargets(unit){
  if(UNIT_TYPES[unit.typeId].atk===0)return[];
  const result=[];
  for(const n of hexNeighbors(unit.q,unit.r)){
    const t=getTile(n.q,n.r);
    if(!t)continue;
    const enemy=getUnitAt(n.q,n.r);
    const enemyCity=getCityAt(n.q,n.r);
    if(enemy&&enemy.factionIdx!==unit.factionIdx)result.push({q:n.q,r:n.r,target:'unit'});
    else if(enemyCity&&enemyCity.factionIdx!==unit.factionIdx)result.push({q:n.q,r:n.r,target:'city'});
  }
  return result;
}
function moveUnit(unit,q,r){
  const targets=computeMoveTargets(unit);
  const target=targets.find(t=>t.q===q&&t.r===r);
  if(!target)return false;
  const oldTile=getTile(unit.q,unit.r);
  const newTile=getTile(q,r);
  if(oldTile&&oldTile.unitId===unit.id)oldTile.unitId=null;
  unit.q=q;unit.r=r;
  if(newTile)newTile.unitId=unit.id;
  unit.mp-=target.cost;
  if(unit.mp<0)unit.mp=0;
  unit.fortified=false;
  recomputeVisibility();
  if(newTile&&TERRAIN_TYPES[newTile.terrain].isRuin&&!newTile.improvement){
    handleRuinDiscovery(unit,newTile);
  }
  return true;
}
function handleRuinDiscovery(unit,tile){
  tile.improvement='looted';
  const f=G.factions[unit.factionIdx];
  const roll=Math.random();
  if(roll<0.35){const g=30+Math.floor(Math.random()*50);f.resources.gold+=g;log(`${f.name} sifted ${g} gold from Old World ruins.`,'good',unit.factionIdx===G.playerFactionIdx)}
  else if(roll<0.65){const s=30+Math.floor(Math.random()*40);f.science+=s;log(`${f.name} recovered ancient blueprints (${s} science).`,'tech',unit.factionIdx===G.playerFactionIdx)}
  else if(roll<0.85){const a=5+Math.floor(Math.random()*10);f.resources.aether+=a;log(`${f.name} pried ${a} aether crystals from a sealed vault.`,'tech',unit.factionIdx===G.playerFactionIdx)}
  else log(`${f.name} found only dust and broken cogs in the ruin.`,'flavor',unit.factionIdx===G.playerFactionIdx);
}

function combat(attacker,defenderQR){
  const defender=getUnitAt(defenderQR.q,defenderQR.r);
  const defCity=getCityAt(defenderQR.q,defenderQR.r);
  // Auto-declare war if not already
  if(defender){autoDeclare(attacker.factionIdx,defender.factionIdx)}
  else if(defCity){autoDeclare(attacker.factionIdx,defCity.factionIdx)}
  
  if(defender){
    const aTpl=UNIT_TYPES[attacker.typeId],dTpl=UNIT_TYPES[defender.typeId];
    const defTile=getTile(defender.q,defender.r);
    const terrainDef=TERRAIN_TYPES[defTile.terrain].defBonus;
    const fortifyBonus=defender.fortified?0.3:0;
    let cityDef=0,factionDefBonus=0;
    const cityHere=getCityAt(defender.q,defender.r);
    if(cityHere){
      cityDef=0.25;
      if(cityHere.buildings.has('walls'))cityDef+=0.5;
      if(cityHere.buildings.has('citadel'))cityDef+=1.0;
      if(G.factions[defender.factionIdx].id==='verdant')factionDefBonus+=0.25;
    }
    const aFac=G.factions[attacker.factionIdx],dFac=G.factions[defender.factionIdx];
    const ironBonus=aFac.id==='iron'?0.2:0;
    const aiBonus=getDifficultyAtkBonus(attacker.factionIdx);
    const atkPow=aTpl.atk*(1+ironBonus+aiBonus)*(attacker.hp/attacker.maxHp);
    const defPow=dTpl.def*(1+terrainDef+fortifyBonus+cityDef+factionDefBonus)*(defender.hp/defender.maxHp);
    const ratio=atkPow/Math.max(0.5,defPow);
    const atkDmg=Math.max(2,Math.round(8*ratio+Math.random()*4));
    const defDmg=Math.max(1,Math.round(8/ratio+Math.random()*3));
    defender.hp-=atkDmg;
    attacker.hp-=defDmg;
    attacker.mp=0;
    log(`${aFac.name}'s ${aTpl.name} attacks ${dFac.name}'s ${dTpl.name}: ${atkDmg} dealt, ${defDmg} taken.`,'combat',attacker.factionIdx===G.playerFactionIdx||defender.factionIdx===G.playerFactionIdx);
    if(defender.hp<=0)killUnit(defender);
    if(attacker.hp<=0){killUnit(attacker);return}
    if(G.aiMemory[defender.factionIdx])G.aiMemory[defender.factionIdx].grudges[attacker.factionIdx]=(G.aiMemory[defender.factionIdx].grudges[attacker.factionIdx]||0)+30;
  }else if(defCity){
    const aTpl=UNIT_TYPES[attacker.typeId];
    let cityDef=25;
    if(defCity.buildings.has('walls'))cityDef+=25;
    if(defCity.buildings.has('citadel'))cityDef+=50;
    if(G.factions[defCity.factionIdx].id==='verdant')cityDef+=15;
    const aiBonus=getDifficultyAtkBonus(attacker.factionIdx);
    const atkPow=aTpl.atk*(attacker.hp/attacker.maxHp)*(1+aiBonus);
    const dmg=Math.max(2,Math.round(atkPow*60/cityDef));
    defCity.hp-=dmg;
    attacker.hp-=3;
    attacker.mp=0;
    log(`${G.factions[attacker.factionIdx].name} assaults ${defCity.name}: ${dmg} damage.`,'combat',true);
    if(defCity.hp<=0){captureCity(defCity,attacker.factionIdx);moveUnit(attacker,defCity.q,defCity.r)}
    if(attacker.hp<=0)killUnit(attacker);
    if(G.aiMemory[defCity.factionIdx])G.aiMemory[defCity.factionIdx].grudges[attacker.factionIdx]=(G.aiMemory[defCity.factionIdx].grudges[attacker.factionIdx]||0)+50;
  }
}

function getDifficultyAtkBonus(factionIdx){
  if(factionIdx===G.playerFactionIdx)return 0;
  if(G.difficulty==='easy')return -0.15;
  if(G.difficulty==='hard')return 0.15;
  return 0;
}

function autoDeclare(a,b){
  const fa=G.factions[a],fb=G.factions[b];
  if(fa.diplo[b]!=='war'){fa.diplo[b]='war';fb.diplo[a]='war';log(`${fa.name} and ${fb.name} are at war!`,'warning',a===G.playerFactionIdx||b===G.playerFactionIdx)}
}

function killUnit(unit){
  G.units=G.units.filter(u=>u.id!==unit.id);
  const t=getTile(unit.q,unit.r);
  if(t&&t.unitId===unit.id)t.unitId=null;
}

function captureCity(city,newFactionIdx){
  const oldFac=G.factions[city.factionIdx],newFac=G.factions[newFactionIdx];
  log(`${city.name} falls to ${newFac.name}!`,'warning',true);
  city.factionIdx=newFactionIdx;
  city.hp=Math.max(20,Math.floor(city.maxHp/2));
  city.population=Math.max(1,city.population-1);
  city.buildQueue=null;
  // Clear half buildings (sack)
  const blds=[...city.buildings];shuffle(blds);for(let i=0;i<Math.floor(blds.length/3);i++)city.buildings.delete(blds[i]);
  const loot=50+city.population*30;newFac.resources.gold+=loot;
  for(const t of G.map.tiles.values())if(t.cityId===city.id)t.owner=newFactionIdx;
  for(const n of hexNeighbors(city.q,city.r)){const t=getTile(n.q,n.r);if(t&&t.owner===oldFac.idx)t.owner=newFactionIdx}
  if(city.isCapital){
    const remaining=G.cities.filter(c=>c.factionIdx===oldFac.idx);
    if(remaining.length===0)eliminateFaction(oldFac.idx);
    else{remaining[0].isCapital=true}
  }
}

function eliminateFaction(factionIdx){
  const f=G.factions[factionIdx];
  if(!f.alive)return;
  f.alive=false;
  log(`${f.name} has been wiped from the map!`,'warning',true);
  G.units=G.units.filter(u=>u.factionIdx!==factionIdx);
  for(const t of G.map.tiles.values()){
    if(t.unitId!=null){const u=G.units.find(uu=>uu.id===t.unitId);if(!u)t.unitId=null}
  }
}

// ============================================================================
// CITY PRODUCTION
// ============================================================================
function cityYields(city){
  const fac=G.factions[city.factionIdx];
  let food=2,prod=1,gold=1,sci=0,aether=0;
  const candidates=hexNeighbors(city.q,city.r).map(n=>getTile(n.q,n.r))
    .filter(t=>t&&t.owner===city.factionIdx&&!t.cityId&&TERRAIN_TYPES[t.terrain].walkable)
    .map(t=>{const tt=TERRAIN_TYPES[t.terrain];let f=tt.food,p=tt.prod,g=tt.gold;if(t.improvement==='mine')p+=2;if(t.improvement==='farm')f+=2;if(t.improvement==='road')g+=1;return{f,p,g,score:f*1.2+p*1.0+g*0.7,terrain:t.terrain}})
    .sort((a,b)=>b.score-a.score);
  const numWorked=Math.min(city.population,candidates.length);
  for(let i=0;i<numWorked;i++){food+=candidates[i].f;prod+=candidates[i].p;gold+=candidates[i].g;
    // Aether vents worked yield aether
    if(candidates[i].terrain==='AETHER')aether+=2;
  }
  for(const b of city.buildings){
    const bt=BUILDING_TYPES[b];
    if(!bt||!bt.yields)continue;
    food+=bt.yields.food||0;prod+=bt.yields.prod||0;gold+=bt.yields.gold||0;sci+=bt.yields.science||0;aether+=bt.yields.aether||0;
  }
  if(fac.id==='aetheric')aether+=1;
  food-=city.population;
  // Difficulty bonus for AI
  if(fac.idx!==G.playerFactionIdx){
    if(G.difficulty==='hard'){gold=Math.round(gold*1.1);prod=Math.round(prod*1.1);sci=Math.round(sci*1.15)}
    else if(G.difficulty==='easy'){gold=Math.round(gold*0.9);prod=Math.round(prod*0.9);sci=Math.round(sci*0.85)}
  }
  return{food,prod,gold,sci,aether};
}

function processCity(city){
  const y=cityYields(city);
  const fac=G.factions[city.factionIdx];
  fac.resources.gold+=y.gold;
  fac.resources.aether+=y.aether;
  fac.science+=y.sci;
  city.foodStored+=y.food;
  if(city.foodStored<0)city.foodStored=0;
  city.productionStored+=y.prod;
  if(city.foodStored>=city.foodNeeded){
    city.foodStored-=city.foodNeeded;city.population++;
    city.foodNeeded=10+city.population*6;
    city.maxHp=50+city.population*10;
    city.hp=Math.min(city.maxHp,city.hp+10);
    log(`${city.name} grows to size ${city.population}.`,'good',city.factionIdx===G.playerFactionIdx);
  }
  if(city.hp<city.maxHp)city.hp=Math.min(city.maxHp,city.hp+4);
  for(const u of G.units.filter(u=>u.factionIdx===city.factionIdx&&u.q===city.q&&u.r===city.r))u.hp=Math.min(u.maxHp,u.hp+3);
  if(city.buildQueue){
    const item=city.buildQueue;
    let cost=0;
    if(item.kind==='unit')cost=UNIT_TYPES[item.id].cost;
    else if(item.kind==='building')cost=BUILDING_TYPES[item.id].cost;
    if(city.productionStored>=cost){
      city.productionStored-=cost;
      if(item.kind==='unit'){
        let spawnQ=city.q,spawnR=city.r;
        const occupant=getUnitAt(city.q,city.r);
        if(occupant){
          if(occupant.factionIdx!==city.factionIdx)return;
          const spot=hexNeighbors(city.q,city.r).find(n=>{const t=getTile(n.q,n.r);return t&&TERRAIN_TYPES[t.terrain].walkable&&!getUnitAt(n.q,n.r)});
          if(spot){spawnQ=spot.q;spawnR=spot.r}
          else{city.productionStored+=cost;return}
        }
        createUnit(item.id,city.factionIdx,spawnQ,spawnR);
        log(`${city.name} musters a ${UNIT_TYPES[item.id].name}.`,'good',city.factionIdx===G.playerFactionIdx);
      }else if(item.kind==='building'){
        city.buildings.add(item.id);
        log(`${city.name} completes ${BUILDING_TYPES[item.id].name}.`,'good',city.factionIdx===G.playerFactionIdx);
      }
      city.buildQueue=null;
    }
  }
}

// ============================================================================
// RESEARCH
// ============================================================================
function getAvailableTechs(faction){
  return Object.entries(TECHS).filter(([id,tech])=>{if(faction.techs.has(id))return false;return tech.prereqs.every(p=>faction.techs.has(p))}).map(([id,tech])=>({id,...tech}));
}
function processResearch(faction){
  if(!faction.currentResearch){faction.science=0;return}
  const tech=TECHS[faction.currentResearch];
  faction.researchProgress=(faction.researchProgress||0)+faction.science;
  if(faction.researchProgress>=tech.cost){
    faction.techs.add(faction.currentResearch);
    log(`${faction.name} has rediscovered ${tech.name}!`,'tech',true);
    faction.researchProgress=0;
    const completed=faction.currentResearch;
    faction.currentResearch=null;
    if(completed==='grand_apparatus'){triggerVictory(faction.idx,'ascension')}
  }
  faction.science=0;
}

// ============================================================================
// CITY NAMES
// ============================================================================
const usedNames=new Set();
function pickCityName(){
  const avail=CITY_NAMES.filter(n=>!usedNames.has(n));
  let name;
  if(avail.length)name=avail[Math.floor(Math.random()*avail.length)];
  else name='Outpost '+(G.cities.length+1);
  usedNames.add(name);
  return name;
}

// ============================================================================
// LOG
// ============================================================================
function log(msg,type='',visibleToPlayer=true){
  if(!visibleToPlayer)return;
  G.events.unshift({turn:G.turn,msg,type});
  if(G.events.length>100)G.events.pop();
  renderLog();
}
function renderLog(){
  const el=document.getElementById('event-log');
  el.innerHTML=G.events.slice(0,20).map(e=>`<div class="log-entry ${e.type}"><span class="turn-tag">T${e.turn}</span>${e.msg}</div>`).join('');
}
// ============================================================================
// AI
// ============================================================================
function initAIMemory(factionIdx){
  G.aiMemory[factionIdx]={grudges:{},strategicPhase:'expand',targetEnemy:null,lastDeclareWarTurn:0};
}

function aiPlayTurn(faction){
  if(!faction.alive)return;
  updateAIStrategy(faction);
  if(!faction.currentResearch){const c=aiPickTech(faction);if(c)faction.currentResearch=c}
  for(const city of G.cities.filter(c=>c.factionIdx===faction.idx)){
    if(!city.buildQueue){const c=aiPickBuild(faction,city);if(c)city.buildQueue=c}
  }
  const myUnits=G.units.filter(u=>u.factionIdx===faction.idx).slice();
  myUnits.sort((a,b)=>aiUnitPriority(a)-aiUnitPriority(b));
  for(const unit of myUnits)aiUnitTurn(faction,unit);
  aiDiplomacy(faction);
  aiTelegraph(faction);
}

function aiUnitPriority(u){if(u.typeId==='PIONEER')return 0;if(u.typeId==='WORKER')return 5;if(u.typeId==='SCOUT')return 4;return 1}

function updateAIStrategy(faction){
  const mem=G.aiMemory[faction.idx];
  const myCities=G.cities.filter(c=>c.factionIdx===faction.idx).length;
  const myStr=aiFactionMilitaryStrength(faction.idx);
  const totalStr=G.factions.reduce((s,f)=>s+(f.alive?aiFactionMilitaryStrength(f.idx):0),0);
  const myStrShare=totalStr>0?myStr/totalStr:0;
  if(myCities<=2&&G.turn<25)mem.strategicPhase='expand';
  else if(myStrShare<0.20&&PERSONALITIES[faction.personality].agg<0.6)mem.strategicPhase='fortify';
  else if(faction.techs.has('aether_war')||faction.techs.has('steam_armor'))mem.strategicPhase='ascend';
  else mem.strategicPhase='contest';
}

function aiFactionMilitaryStrength(factionIdx){
  let s=0;
  for(const u of G.units)if(u.factionIdx===factionIdx){const t=UNIT_TYPES[u.typeId];s+=(t.atk+t.def)*(u.hp/u.maxHp)}
  for(const c of G.cities)if(c.factionIdx===factionIdx)s+=5+c.population*2;
  return s;
}

function aiPickTech(faction){
  const avail=getAvailableTechs(faction);
  if(!avail.length)return null;
  const p=PERSONALITIES[faction.personality];
  const scored=avail.map(t=>{
    let score=100-t.cost*0.1;
    if(t.branch===p.prefBranch)score+=60;
    if(t.branch==='science')score+=p.sci*30;
    if(t.branch==='industry')score+=(p.mil+p.econ)*20;
    if(t.branch==='economy')score+=p.econ*30;
    if(t.branch==='expansion')score+=p.expand*25;
    if(t.unlocks)score+=40*p.mil;
    if(t.id==='grand_apparatus')score+=120+p.sci*60;
    if(t.id==='gunpowder'&&p.mil>0.6)score+=50;
    if(t.id==='steam_armor')score+=35*p.mil;
    if(t.id==='aether_war')score+=30*p.sci;
    score+=Math.random()*8;
    return{id:t.id,score};
  });
  scored.sort((a,b)=>b.score-a.score);
  return scored[0].id;
}

function aiPickBuild(faction,city){
  const p=PERSONALITIES[faction.personality];
  const phase=G.aiMemory[faction.idx].strategicPhase;
  const myCityCount=G.cities.filter(c=>c.factionIdx===faction.idx).length;
  const myUnits=G.units.filter(u=>u.factionIdx===faction.idx);
  const myMilUnits=myUnits.filter(u=>UNIT_TYPES[u.typeId].atk>0);
  const myPioneers=myUnits.filter(u=>u.typeId==='PIONEER').length;
  const atWar=G.factions.some((f,i)=>i!==faction.idx&&faction.diplo[i]==='war');
  const garrison=myUnits.find(u=>u.q===city.q&&u.r===city.r&&UNIT_TYPES[u.typeId].atk>0);
  const options=[];
  for(const[bid,b]of Object.entries(BUILDING_TYPES)){
    if(city.buildings.has(bid))continue;
    if(b.requires&&!faction.techs.has(b.requires))continue;
    let score=30;
    if(bid==='workshop')score+=50;
    if(bid==='granary')score+=30+(city.population<3?30:0);
    if(bid==='walls')score+=30+(atWar?40:0)+p.defenseFocus*30;
    if(bid==='foundry')score+=50*p.econ;
    if(bid==='bank')score+=60*p.econ;
    if(bid==='library')score+=60*p.sci;
    if(bid==='spire')score+=70*p.sci;
    if(bid==='academy')score+=80*p.sci;
    if(bid==='citadel')score+=50*p.defenseFocus+(atWar?30:0);
    score-=b.cost*0.15;
    options.push({kind:'building',id:bid,score});
  }
  const milTypes=['AETHERMECH','STEAMTANK','MUSKETEER','COGMAN'].filter(t=>{const tpl=UNIT_TYPES[t];return!tpl.requires||faction.techs.has(tpl.requires)});
  const bestMil=milTypes[0];
  if(bestMil){
    let score=30+p.mil*60;
    if(atWar)score+=80;
    if(!garrison)score+=50;
    if(myMilUnits.length<myCityCount*2)score+=30;
    if(phase==='contest')score+=25;
    score-=UNIT_TYPES[bestMil].cost*0.1;
    options.push({kind:'unit',id:bestMil,score});
  }
  if(phase==='expand'&&myPioneers<1&&myCityCount<5){
    let score=80+p.expand*40;
    if(G.turn>30)score-=20;
    if(myCityCount>=4)score-=40;
    options.push({kind:'unit',id:'PIONEER',score});
  }
  const scouts=myUnits.filter(u=>u.typeId==='SCOUT').length;
  if(G.turn<20&&scouts<1)options.push({kind:'unit',id:'SCOUT',score:50});
  const workers=myUnits.filter(u=>u.typeId==='WORKER').length;
  if(myCityCount>=2&&workers<myCityCount)options.push({kind:'unit',id:'WORKER',score:40+p.econ*30});
  if(!options.length)return null;
  options.sort((a,b)=>b.score-a.score);
  if(options.length>1&&Math.random()<0.15)return options[1];
  return options[0];
}

function aiUnitTurn(faction,unit){
  if(unit.mp<=0)return;
  if(unit.typeId==='PIONEER'){aiPioneerAction(faction,unit);return}
  if(unit.typeId==='WORKER'){aiWorkerAction(faction,unit);return}
  if(unit.typeId==='SCOUT'){aiScoutAction(faction,unit);return}
  aiMilitaryAction(faction,unit);
}

function aiPioneerAction(faction,unit){
  let best=null,bestScore=-Infinity;
  for(const t of G.map.tiles.values()){
    if(!TERRAIN_TYPES[t.terrain].walkable)continue;
    if(t.cityId)continue;
    if(TERRAIN_TYPES[t.terrain].isAether||TERRAIN_TYPES[t.terrain].isRuin)continue;
    const dist=hexDistance({q:unit.q,r:unit.r},t);
    if(dist>14)continue;
    let tooClose=false,myDist=Infinity;
    for(const c of G.cities){
      const d=hexDistance({q:c.q,r:c.r},t);
      if(d<4)tooClose=true;
      if(c.factionIdx===faction.idx)myDist=Math.min(myDist,d);
    }
    if(tooClose)continue;
    let score=-dist*2;
    if(myDist<8)score+=20;
    let yieldSum=0;
    for(const n of hexNeighbors(t.q,t.r)){
      const nt=getTile(n.q,n.r);if(!nt)continue;
      const tt=TERRAIN_TYPES[nt.terrain];
      yieldSum+=tt.food+tt.prod*0.8+tt.gold*0.6;
      if(nt.terrain==='AETHER')yieldSum+=5;
      if(nt.terrain==='RUINS'&&!nt.improvement)yieldSum+=3;
    }
    score+=yieldSum*4;
    if(t.owner!=null&&t.owner!==faction.idx)score-=50;
    if(score>bestScore){bestScore=score;best=t}
  }
  if(!best){
    const targets=computeMoveTargets(unit);
    if(targets.length){const t=targets[Math.floor(Math.random()*targets.length)];moveUnit(unit,t.q,t.r)}
    else unit.mp=0;
    return;
  }
  if(best.q===unit.q&&best.r===unit.r){
    const name=pickCityName();
    const c=createCity(faction.idx,unit.q,unit.r,name);
    if(G.cities.filter(cc=>cc.factionIdx===faction.idx).length===1)c.isCapital=true;
    log(`${faction.name} founds ${name}.`,'good',faction.idx===G.playerFactionIdx);
    killUnit(unit);
    recomputeVisibility();
    return;
  }
  aiMoveToward(unit,best.q,best.r);
}

function aiWorkerAction(faction,unit){
  const t=getTile(unit.q,unit.r);
  if(t&&t.owner===faction.idx&&!t.improvement&&!t.cityId&&['PLAINS','HILLS','FOREST'].includes(t.terrain)){
    if(t.terrain==='PLAINS')t.improvement='farm';
    else if(t.terrain==='HILLS')t.improvement='mine';
    else t.improvement='road';
    unit.mp=0;return;
  }
  let best=null,bestDist=Infinity;
  for(const tile of G.map.tiles.values()){
    if(tile.owner!==faction.idx||tile.improvement||tile.cityId)continue;
    if(!['PLAINS','HILLS','FOREST'].includes(tile.terrain))continue;
    const d=hexDistance({q:unit.q,r:unit.r},tile);
    if(d<bestDist){bestDist=d;best=tile}
  }
  if(best)aiMoveToward(unit,best.q,best.r);else unit.mp=0;
}

function aiScoutAction(faction,unit){
  let best=null,bestScore=-Infinity;
  for(const t of G.map.tiles.values()){
    if(!TERRAIN_TYPES[t.terrain].walkable)continue;
    const vis=t.visibility[faction.idx];
    if(vis==='visible')continue;
    const d=hexDistance({q:unit.q,r:unit.r},t);
    let score=-d;
    if(!vis||vis==='unseen')score+=10;
    if(TERRAIN_TYPES[t.terrain].isRuin&&!t.improvement)score+=30;
    if(score>bestScore){bestScore=score;best=t}
  }
  if(best)aiMoveToward(unit,best.q,best.r);else unit.mp=0;
}

function aiMilitaryAction(faction,unit){
  const p=PERSONALITIES[faction.personality];
  const phase=G.aiMemory[faction.idx].strategicPhase;
  const atkTargets=computeAttackTargets(unit);
  if(atkTargets.length){
    let best=null,bestScore=-Infinity;
    for(const t of atkTargets){
      let score=20;
      const enemy=getUnitAt(t.q,t.r);
      const enemyCity=getCityAt(t.q,t.r);
      const targetFac=(enemy||enemyCity).factionIdx;
      // Don't attack non-war targets unless we're the militaristic type
      if(faction.diplo[targetFac]!=='war'&&p.agg<0.7)score-=200;
      else if(faction.diplo[targetFac]!=='war')score-=50;
      if(enemy){
        const eTpl=UNIT_TYPES[enemy.typeId],myTpl=UNIT_TYPES[unit.typeId];
        const myPow=myTpl.atk*(unit.hp/unit.maxHp);
        const enPow=eTpl.def*(enemy.hp/enemy.maxHp);
        score+=(myPow-enPow)*5;
        if(enemy.hp/enemy.maxHp<0.4)score+=30;
      }
      if(enemyCity){score+=80;if(enemyCity.hp/enemyCity.maxHp<0.4)score+=60}
      if(score>bestScore){bestScore=score;best=t}
    }
    if(best&&bestScore>0){combat(unit,best);return}
  }
  const warEnemies=G.factions.filter(f=>f.alive&&faction.diplo[f.idx]==='war').map(f=>f.idx);
  if(warEnemies.length&&(phase==='contest'||phase==='ascend'||p.agg>0.7)){
    let best=null,bestScore=-Infinity;
    for(const c of G.cities){
      if(!warEnemies.includes(c.factionIdx))continue;
      const t=getTile(c.q,c.r);
      if(t.visibility[faction.idx]==='unseen'||!t.visibility[faction.idx])continue;
      const d=hexDistance({q:unit.q,r:unit.r},c);
      let score=-d*1.5+(c.maxHp-c.hp)*0.5-c.population*4;
      if(c.isCapital)score+=30;
      if(score>bestScore){bestScore=score;best=c}
    }
    if(best){aiMoveToward(unit,best.q,best.r);return}
  }
  const myCities=G.cities.filter(c=>c.factionIdx===faction.idx);
  if(myCities.length){
    let nearest=null,ndist=Infinity;
    for(const c of myCities){const d=hexDistance({q:unit.q,r:unit.r},c);if(d<ndist){ndist=d;nearest=c}}
    if(ndist<=2){unit.fortified=true;unit.mp=0;return}
    else{aiMoveToward(unit,nearest.q,nearest.r);return}
  }
  unit.mp=0;
}

function aiMoveToward(unit,tq,tr){
  const targets=computeMoveTargets(unit);
  if(!targets.length){unit.mp=0;return}
  let best=null,bestDist=Infinity;
  for(const t of targets){const d=hexDistance({q:t.q,r:t.r},{q:tq,r:tr});if(d<bestDist){bestDist=d;best=t}}
  if(best)moveUnit(unit,best.q,best.r);else unit.mp=0;
}

function aiDiplomacy(faction){
  const mem=G.aiMemory[faction.idx];
  const p=PERSONALITIES[faction.personality];
  const myStr=aiFactionMilitaryStrength(faction.idx);
  for(const other of G.factions){
    if(!other.alive||other.idx===faction.idx)continue;
    const cur=faction.diplo[other.idx]||'unmet';
    if(cur==='unmet'){
      // First contact when they see each other
      const sawMe=[...G.map.tiles.values()].some(t=>t.cityId&&getCityAt(t.q,t.r).factionIdx===faction.idx&&t.visibility[other.idx]==='visible');
      if(sawMe){faction.diplo[other.idx]='peace';other.diplo[faction.idx]='peace';log(`${faction.name} has met ${other.name}.`,'diplo',faction.idx===G.playerFactionIdx||other.idx===G.playerFactionIdx)}
      continue;
    }
    const grudge=mem.grudges[other.idx]||0;
    const otherStr=aiFactionMilitaryStrength(other.idx);
    const ratio=myStr/Math.max(1,otherStr);
    if(cur==='peace'){
      let warScore=grudge*0.5+p.agg*30+(ratio-1)*50;
      if(G.turn-mem.lastDeclareWarTurn<8)warScore-=50;
      if(warScore>60&&Math.random()<0.25){
        faction.diplo[other.idx]='war';other.diplo[faction.idx]='war';
        mem.lastDeclareWarTurn=G.turn;
        log(`${faction.name} declares war on ${other.name}!`,'warning',true);
      }
    }else if(cur==='war'){
      let peaceScore=(1-ratio)*40+(1-p.agg)*20-grudge*0.3;
      if(peaceScore>35&&Math.random()<0.2){
        faction.diplo[other.idx]='peace';other.diplo[faction.idx]='peace';
        mem.grudges[other.idx]=Math.max(0,(mem.grudges[other.idx]||0)-50);
        log(`${faction.name} sues for peace with ${other.name}.`,'diplo',true);
      }
    }
  }
  for(const k of Object.keys(mem.grudges))mem.grudges[k]=Math.max(0,mem.grudges[k]-1);
}

function aiTelegraph(faction){
  if(faction.idx===G.playerFactionIdx)return;
  const player=G.factions[G.playerFactionIdx];
  if(!player.alive)return;
  if(faction.diplo[G.playerFactionIdx]!=='war')return;
  const playerSighted=G.units.filter(u=>u.factionIdx===G.playerFactionIdx).map(u=>({q:u.q,r:u.r}));
  for(const c of G.cities)if(c.factionIdx===G.playerFactionIdx)playerSighted.push({q:c.q,r:c.r});
  const aiMil=G.units.filter(u=>u.factionIdx===faction.idx&&UNIT_TYPES[u.typeId].atk>=4);
  let nearbyCount=0;
  for(const m of aiMil){for(const ps of playerSighted){if(hexDistance(m,ps)<=5){nearbyCount++;break}}}
  if(nearbyCount>=2&&Math.random()<0.4){
    const lines=AI_THINKING_LINES[faction.personality];
    const line=lines[Math.floor(Math.random()*lines.length)];
    log(`${faction.name} ${line.replace('...','')} — ${nearbyCount} hostile companies near your borders.`,'warning',true);
  }
}

// ============================================================================
// TURN MANAGEMENT / VICTORY
// ============================================================================
function endTurn(){
  if(G.gameOver)return;
  const cur=G.factions[G.currentFactionIdx];
  for(const c of G.cities.filter(c=>c.factionIdx===cur.idx))processCity(c);
  processResearch(cur);
  if(cur.resources.gold>=G.goldHegemonyThreshold){
    G.goldHegemonyCounter[cur.idx]=(G.goldHegemonyCounter[cur.idx]||0)+1;
    if(G.goldHegemonyCounter[cur.idx]>=G.goldHegemonyRequired){triggerVictory(cur.idx,'hegemony');return}
  }else G.goldHegemonyCounter[cur.idx]=0;
  cur.score=computeFactionScore(cur);
  G.currentFactionIdx=(G.currentFactionIdx+1)%G.factions.length;
  let safety=10;
  while(!G.factions[G.currentFactionIdx].alive&&safety-->0)G.currentFactionIdx=(G.currentFactionIdx+1)%G.factions.length;
  if(G.currentFactionIdx===0)G.turn++;
  const next=G.factions[G.currentFactionIdx];
  for(const u of G.units.filter(u=>u.factionIdx===next.idx))u.mp=UNIT_TYPES[u.typeId].mp;
  recomputeVisibility();
  const aliveOpps=G.factions.filter(f=>f.alive&&f.idx!==G.playerFactionIdx);
  if(aliveOpps.length===0&&G.factions[G.playerFactionIdx].alive){triggerVictory(G.playerFactionIdx,'domination');return}
  if(!G.factions[G.playerFactionIdx].alive){triggerDefeat();return}
  G.selected=null;G.moveTargets=[];G.attackTargets=[];
  if(next.isAI)runAITurn(next);
  else{updateUI();render()}
}

function runAITurn(faction){
  const lines=AI_THINKING_LINES[faction.personality];
  const line=lines[Math.floor(Math.random()*lines.length)];
  showAIThinking(`${faction.name} ${line}`);
  setTimeout(()=>{
    aiPlayTurn(faction);
    hideAIThinking();
    updateUI();render();
    setTimeout(endTurn,300);
  },450+Math.random()*300);
}
function showAIThinking(text){document.getElementById('ai-thinking-text').textContent=text;document.getElementById('ai-thinking').style.display='flex'}
function hideAIThinking(){document.getElementById('ai-thinking').style.display='none'}

function computeFactionScore(faction){
  let s=0;
  s+=G.cities.filter(c=>c.factionIdx===faction.idx).reduce((acc,c)=>acc+10+c.population*4,0);
  s+=G.units.filter(u=>u.factionIdx===faction.idx).length*3;
  s+=faction.techs.size*8;
  s+=faction.resources.gold*0.05;
  s+=faction.resources.aether*0.5;
  return Math.round(s);
}

function triggerVictory(factionIdx,type){
  G.gameOver=true;
  const fac=G.factions[factionIdx];
  const isPlayer=factionIdx===G.playerFactionIdx;
  const messages={
    domination:{title:'Domination',flavor:`${fac.name} has crushed all rivals beneath the weight of their banners.`},
    ascension:{title:'Ascension',flavor:`${fac.name} has restored the Grand Apparatus. The Old World awakens — under their hand.`},
    hegemony:{title:'Economic Hegemony',flavor:`${fac.name} has bought the world. The other banners bend, or starve.`}
  };
  const m=messages[type];
  const banner=isPlayer?`<div class="victory-banner win"><h2 style="color:#99ee99">VICTORY: ${m.title}</h2><p style="margin-top:10px;font-style:italic">${m.flavor}</p></div>`:`<div class="victory-banner lose"><h2 style="color:var(--danger)">DEFEAT</h2><p style="margin-top:10px">${fac.name} has achieved ${m.title}.</p><p style="margin-top:6px;font-style:italic">${m.flavor}</p></div>`;
  document.getElementById('game-over-content').innerHTML=banner+scorecard();
  document.getElementById('game-over-modal').classList.add('show');
}
function triggerDefeat(){
  G.gameOver=true;
  const banner=`<div class="victory-banner lose"><h2 style="color:var(--danger)">DEFEAT</h2><p style="margin-top:10px">Your last city has fallen. Your banner is dust.</p></div>`;
  document.getElementById('game-over-content').innerHTML=banner+scorecard();
  document.getElementById('game-over-modal').classList.add('show');
}
function scorecard(){
  const sorted=G.factions.slice().sort((a,b)=>computeFactionScore(b)-computeFactionScore(a));
  let html='<h3 style="color:var(--brass);margin-bottom:8px">Final Tally</h3>';
  for(const f of sorted){
    const status=f.alive?'':' <span style="color:var(--danger)">(eliminated)</span>';
    html+=`<div class="row"><span><span style="color:${f.color}">${f.glyph}</span> ${f.name}${status}</span><span>${computeFactionScore(f)}</span></div>`;
  }
  return html;
}
// ============================================================================
// RENDERING
// ============================================================================
function hexCorner(cx,cy,i){const angle=Math.PI/180*(60*i-30);return{x:cx+HEX_SIZE*Math.cos(angle),y:cy+HEX_SIZE*Math.sin(angle)}}

function render(){
  ctx.save();
  ctx.fillStyle='#0a0805';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.translate(G.cameraX,G.cameraY);
  ctx.scale(G.zoom,G.zoom);
  const playerIdx=G.playerFactionIdx;
  for(const tile of G.map.tiles.values()){
    const vis=tile.visibility[playerIdx];
    if(!vis||vis==='unseen')continue;
    drawHex(tile,vis);
  }
  drawOwnership();
  for(const c of G.cities){
    const t=getTile(c.q,c.r);
    if(!t||!t.visibility[playerIdx]||t.visibility[playerIdx]==='unseen')continue;
    drawCity(c);
  }
  for(const u of G.units){
    const t=getTile(u.q,u.r);
    if(!t||t.visibility[playerIdx]!=='visible')continue;
    drawUnit(u);
  }
  drawSelection();
  ctx.restore();
  renderSVGOverlay();
}

function drawHex(tile,vis){
  const{x,y}=hexToPixel(tile.q,tile.r);
  const tt=TERRAIN_TYPES[tile.terrain];
  ctx.beginPath();
  for(let i=0;i<6;i++){const c=hexCorner(x,y,i);if(i===0)ctx.moveTo(c.x,c.y);else ctx.lineTo(c.x,c.y)}
  ctx.closePath();
  ctx.fillStyle=tt.color;
  ctx.fill();
  if(vis==='seen'){ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fill()}
  ctx.strokeStyle=tt.edge;
  ctx.lineWidth=1;
  ctx.stroke();
  if(tt.glyph){
    ctx.fillStyle=vis==='seen'?'rgba(244,228,188,0.35)':'rgba(244,228,188,0.55)';
    ctx.font=`${HEX_SIZE*0.85}px serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(tt.glyph,x,y);
  }
  if(tile.improvement&&tile.improvement!=='looted'){
    ctx.fillStyle=vis==='seen'?'rgba(212,160,23,0.4)':'#d4a017';
    ctx.font=`${HEX_SIZE*0.5}px serif`;
    let g='·';
    if(tile.improvement==='farm')g='✿';
    if(tile.improvement==='mine')g='⛏';
    if(tile.improvement==='road')g='═';
    ctx.fillText(g,x+HEX_SIZE*0.4,y+HEX_SIZE*0.4);
  }
  if(tile.improvement==='looted'){
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.font=`${HEX_SIZE*0.5}px serif`;
    ctx.fillText('×',x+HEX_SIZE*0.4,y+HEX_SIZE*0.4);
  }
}

function drawOwnership(){
  const playerIdx=G.playerFactionIdx;
  const dirs=[{q:1,r:-1},{q:1,r:0},{q:0,r:1},{q:-1,r:1},{q:-1,r:0},{q:0,r:-1}];
  for(const tile of G.map.tiles.values()){
    if(!tile.visibility[playerIdx]||tile.visibility[playerIdx]==='unseen')continue;
    if(tile.owner==null)continue;
    const fac=G.factions[tile.owner];
    const{x,y}=hexToPixel(tile.q,tile.r);
    for(let i=0;i<6;i++){
      const d=dirs[i];
      const nt=getTile(tile.q+d.q,tile.r+d.r);
      if(!nt||nt.owner!==tile.owner){
        const c1=hexCorner(x,y,i);
        const c2=hexCorner(x,y,(i+1)%6);
        ctx.strokeStyle=fac.color;
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(c1.x,c1.y);
        ctx.lineTo(c2.x,c2.y);
        ctx.stroke();
      }
    }
  }
}

function drawCity(c){
  const fac=G.factions[c.factionIdx];
  const{x,y}=hexToPixel(c.q,c.r);
  ctx.beginPath();
  ctx.arc(x,y,HEX_SIZE*0.65,0,Math.PI*2);
  ctx.fillStyle='#1a1108';
  ctx.fill();
  ctx.strokeStyle=fac.color;
  ctx.lineWidth=3;
  ctx.stroke();
  ctx.fillStyle=fac.color;
  ctx.font=`bold ${HEX_SIZE*0.7}px serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(fac.glyph,x,y);
  if(c.isCapital){
    ctx.fillStyle='#f4e4bc';
    ctx.font=`${HEX_SIZE*0.4}px serif`;
    ctx.fillText('★',x,y-HEX_SIZE*0.45);
  }
  ctx.fillStyle='#f4e4bc';
  ctx.font=`bold 11px Georgia`;
  ctx.fillText(c.name+' ('+c.population+')',x,y+HEX_SIZE*0.85);
  if(c.hp<c.maxHp){
    const w=HEX_SIZE*0.9;
    ctx.fillStyle='#222';
    ctx.fillRect(x-w/2,y-HEX_SIZE*0.85,w,4);
    ctx.fillStyle=c.hp>c.maxHp*0.5?'#6fdb6f':c.hp>c.maxHp*0.25?'#ddd66f':'#d44a3a';
    ctx.fillRect(x-w/2,y-HEX_SIZE*0.85,w*(c.hp/c.maxHp),4);
  }
}

function drawUnit(u){
  const fac=G.factions[u.factionIdx];
  const tpl=UNIT_TYPES[u.typeId];
  const{x,y}=hexToPixel(u.q,u.r);
  const cityHere=getCityAt(u.q,u.r);
  const offY=cityHere?HEX_SIZE*0.35:0;
  ctx.beginPath();
  ctx.arc(x,y-offY,HEX_SIZE*0.42,0,Math.PI*2);
  ctx.fillStyle='#0a0805';
  ctx.fill();
  ctx.strokeStyle=fac.color;
  ctx.lineWidth=2.5;
  ctx.stroke();
  ctx.fillStyle=fac.color;
  ctx.font=`bold ${HEX_SIZE*0.55}px serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(tpl.glyph,x,y-offY);
  if(u.hp<u.maxHp){
    const w=HEX_SIZE*0.7;
    ctx.fillStyle='#222';
    ctx.fillRect(x-w/2,y-offY+HEX_SIZE*0.5,w,3);
    ctx.fillStyle=u.hp>u.maxHp*0.5?'#6fdb6f':u.hp>u.maxHp*0.25?'#ddd66f':'#d44a3a';
    ctx.fillRect(x-w/2,y-offY+HEX_SIZE*0.5,w*(u.hp/u.maxHp),3);
  }
  if(u.factionIdx===G.playerFactionIdx&&u.mp>0){
    ctx.fillStyle='#4ecdc4';
    ctx.beginPath();
    ctx.arc(x+HEX_SIZE*0.35,y-offY-HEX_SIZE*0.3,3.5,0,Math.PI*2);
    ctx.fill();
  }
  if(u.fortified){
    ctx.fillStyle='#d4a017';
    ctx.font=`${HEX_SIZE*0.3}px serif`;
    ctx.fillText('◫',x-HEX_SIZE*0.35,y-offY-HEX_SIZE*0.3);
  }
}

function drawSelection(){
  if(!G.selected)return;
  let q,r;
  if(G.selected.type==='unit'){q=G.selected.ref.q;r=G.selected.ref.r}
  else if(G.selected.type==='tile'||G.selected.type==='city'){q=G.selected.ref.q;r=G.selected.ref.r}
  else return;
  const{x,y}=hexToPixel(q,r);
  ctx.beginPath();
  for(let i=0;i<6;i++){const c=hexCorner(x,y,i);if(i===0)ctx.moveTo(c.x,c.y);else ctx.lineTo(c.x,c.y)}
  ctx.closePath();
  ctx.strokeStyle='#f4e4bc';
  ctx.lineWidth=3;
  ctx.shadowColor='#f4e4bc';
  ctx.shadowBlur=8;
  ctx.stroke();
  ctx.shadowBlur=0;
}

function renderSVGOverlay(){
  let html='';
  for(const t of G.moveTargets){
    const{x,y}=hexToPixel(t.q,t.r);
    const px=x*G.zoom+G.cameraX,py=y*G.zoom+G.cameraY;
    const r=HEX_SIZE*0.3*G.zoom;
    html+=`<circle cx="${px}" cy="${py}" r="${r}" fill="rgba(78,205,196,0.5)" stroke="#4ecdc4" stroke-width="2"/>`;
  }
  for(const t of G.attackTargets){
    const{x,y}=hexToPixel(t.q,t.r);
    const px=x*G.zoom+G.cameraX,py=y*G.zoom+G.cameraY;
    const r=HEX_SIZE*0.45*G.zoom;
    html+=`<circle cx="${px}" cy="${py}" r="${r}" fill="rgba(212,74,58,0.4)" stroke="#d44a3a" stroke-width="3"/>`;
    html+=`<text x="${px}" y="${py+6}" text-anchor="middle" font-size="${18*G.zoom}" fill="#f4e4bc" font-family="serif">⚔</text>`;
  }
  svg.innerHTML=html;
}

// ============================================================================
// INPUT
// ============================================================================
canvas.addEventListener('mousedown',(e)=>{
  if(e.button===2){G.isDragging=true;G.dragStart={x:e.clientX-G.cameraX,y:e.clientY-G.cameraY};e.preventDefault()}
});
window.addEventListener('mouseup',()=>{G.isDragging=false});
canvas.addEventListener('mousemove',(e)=>{
  if(G.isDragging){G.cameraX=e.clientX-G.dragStart.x;G.cameraY=e.clientY-G.dragStart.y;render()}
  else handleHover(e);
});
canvas.addEventListener('contextmenu',(e)=>e.preventDefault());
canvas.addEventListener('wheel',(e)=>{
  const oldZoom=G.zoom;
  G.zoom*=(e.deltaY<0)?1.12:1/1.12;
  G.zoom=Math.max(0.4,Math.min(2.5,G.zoom));
  const k=G.zoom/oldZoom;
  G.cameraX=e.clientX-(e.clientX-G.cameraX)*k;
  G.cameraY=e.clientY-(e.clientY-G.cameraY)*k;
  render();
  e.preventDefault();
});

canvas.addEventListener('click',(e)=>{
  if(G.gameOver)return;
  if(G.factions[G.currentFactionIdx].isAI)return;
  const wx=(e.clientX-G.cameraX)/G.zoom;
  const wy=(e.clientY-G.cameraY)/G.zoom;
  const{q,r}=pixelToHex(wx,wy);
  const tile=getTile(q,r);
  if(!tile)return;
  if(!tile.visibility[G.playerFactionIdx]||tile.visibility[G.playerFactionIdx]==='unseen')return;
  if(G.selected&&G.selected.type==='unit'&&G.selected.ref.factionIdx===G.playerFactionIdx){
    const u=G.selected.ref;
    if(G.attackTargets.some(t=>t.q===q&&t.r===r)){
      combat(u,{q,r});
      if(G.units.includes(u)){G.moveTargets=computeMoveTargets(u);G.attackTargets=computeAttackTargets(u)}
      else{G.selected=null;G.moveTargets=[];G.attackTargets=[]}
      render();updateUI();return;
    }
    if(G.moveTargets.some(t=>t.q===q&&t.r===r)){
      moveUnit(u,q,r);
      G.moveTargets=computeMoveTargets(u);
      G.attackTargets=computeAttackTargets(u);
      render();updateUI();return;
    }
  }
  const unit=getUnitAt(q,r);
  const city=getCityAt(q,r);
  if(unit&&unit.factionIdx===G.playerFactionIdx){
    G.selected={type:'unit',ref:unit};
    G.moveTargets=computeMoveTargets(unit);
    G.attackTargets=computeAttackTargets(unit);
  }else if(city&&city.factionIdx===G.playerFactionIdx){
    G.selected={type:'city',ref:city};
    G.moveTargets=[];G.attackTargets=[];
  }else{
    G.selected={type:'tile',ref:tile};
    G.moveTargets=[];G.attackTargets=[];
  }
  render();updateUI();
});

function handleHover(e){
  const wx=(e.clientX-G.cameraX)/G.zoom;
  const wy=(e.clientY-G.cameraY)/G.zoom;
  const{q,r}=pixelToHex(wx,wy);
  const tile=getTile(q,r);
  const tip=document.getElementById('tooltip');
  if(!tile||!tile.visibility[G.playerFactionIdx]||tile.visibility[G.playerFactionIdx]==='unseen'){tip.style.display='none';return}
  const tt=TERRAIN_TYPES[tile.terrain];
  const unit=getUnitAt(q,r);
  const city=getCityAt(q,r);
  let html=`<h4>${tt.name}</h4>`;
  if(tile.visibility[G.playerFactionIdx]!=='visible')html+=`<div class="stat" style="font-style:italic">(remembered)</div>`;
  html+=`<div class="stat">Food: <strong>${tt.food}</strong> · Prod: <strong>${tt.prod}</strong> · Gold: <strong>${tt.gold}</strong></div>`;
  if(tt.defBonus>0)html+=`<div class="stat">Defense: +${Math.round(tt.defBonus*100)}%</div>`;
  if(tile.improvement&&tile.improvement!=='looted')html+=`<div class="stat">Improvement: <strong>${tile.improvement}</strong></div>`;
  if(city){
    const fac=G.factions[city.factionIdx];
    html+=`<hr style="border-color:var(--brass-d);margin:6px 0">`;
    html+=`<h4 style="color:${fac.color}">${city.name}</h4>`;
    html+=`<div class="stat">${fac.name}${city.isCapital?' ★':''}</div>`;
    html+=`<div class="stat">Pop: <strong>${city.population}</strong> · HP: <strong>${city.hp}/${city.maxHp}</strong></div>`;
  }
  if(unit){
    const fac=G.factions[unit.factionIdx];
    const tpl=UNIT_TYPES[unit.typeId];
    html+=`<hr style="border-color:var(--brass-d);margin:6px 0">`;
    html+=`<h4 style="color:${fac.color}">${tpl.name}</h4>`;
    html+=`<div class="stat">${fac.name}</div>`;
    html+=`<div class="stat">HP: <strong>${unit.hp}/${unit.maxHp}</strong> · Atk: <strong>${tpl.atk}</strong> · Def: <strong>${tpl.def}</strong></div>`;
    html+=`<div class="stat">MP: <strong>${unit.mp}/${unit.maxMp}</strong></div>`;
  }
  tip.innerHTML=html;
  tip.style.display='block';
  tip.style.left=Math.min(window.innerWidth-280,e.clientX+18)+'px';
  tip.style.top=Math.min(window.innerHeight-160,e.clientY+18)+'px';
}

window.addEventListener('keydown',(e)=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
  if(G.gameOver)return;
  if(e.key===' '||e.key==='Enter'){if(!G.factions[G.currentFactionIdx].isAI)endTurn();e.preventDefault()}
  if(e.key==='n'||e.key==='N')selectNextUnit();
  if(e.key==='f'||e.key==='F'){
    if(G.selected&&G.selected.type==='unit'&&G.selected.ref.factionIdx===G.playerFactionIdx){G.selected.ref.fortified=true;G.selected.ref.mp=0;render();updateUI()}
  }
  if(e.key==='Escape'){closeAllModals();G.selected=null;G.moveTargets=[];G.attackTargets=[];render();updateUI()}
});

function selectNextUnit(){
  const myUnits=G.units.filter(u=>u.factionIdx===G.playerFactionIdx&&u.mp>0&&!u.fortified);
  if(!myUnits.length)return;
  let idx=0;
  if(G.selected&&G.selected.type==='unit'){
    const cur=G.selected.ref;
    const i=myUnits.findIndex(u=>u.id===cur.id);
    if(i!==-1)idx=(i+1)%myUnits.length;
  }
  const u=myUnits[idx];
  G.selected={type:'unit',ref:u};
  G.moveTargets=computeMoveTargets(u);
  G.attackTargets=computeAttackTargets(u);
  centerOnHex(u.q,u.r);
  render();updateUI();
}

function centerOnHex(q,r){
  const{x,y}=hexToPixel(q,r);
  G.cameraX=window.innerWidth/2-x*G.zoom;
  G.cameraY=window.innerHeight/2-y*G.zoom;
}

// ============================================================================
// UI UPDATES
// ============================================================================
function updateUI(){
  const player=G.factions[G.playerFactionIdx];
  document.getElementById('cur-faction-emblem').textContent=player.glyph;
  document.getElementById('cur-faction-emblem').style.borderColor=player.color;
  document.getElementById('cur-faction-emblem').style.color=player.color;
  document.getElementById('cur-faction-name').textContent=player.name;
  document.getElementById('cur-faction-name').style.color=player.color;
  const cur=G.factions[G.currentFactionIdx];
  document.getElementById('cur-turn').textContent=`Turn ${G.turn}${cur.idx===G.playerFactionIdx?' — your move':' — '+cur.name+' moves'}`;
  document.getElementById('r-gold').textContent=Math.floor(player.resources.gold);
  document.getElementById('r-aether').textContent=Math.floor(player.resources.aether);
  // Calculate per-turn deltas
  let goldD=0,aetherD=0,sciD=0;
  for(const c of G.cities.filter(c=>c.factionIdx===G.playerFactionIdx)){
    const y=cityYields(c);
    goldD+=y.gold;aetherD+=y.aether;sciD+=y.sci;
  }
  document.getElementById('r-gold-d').textContent=(goldD>=0?'+':'')+goldD;
  document.getElementById('r-gold-d').className='delta'+(goldD<0?' neg':'');
  document.getElementById('r-aether-d').textContent=(aetherD>=0?'+':'')+aetherD;
  document.getElementById('r-sci-d').textContent='+'+sciD;
  // Selection panel
  updateSelectionPanel();
  // Status
  const isPlayerTurn=cur.idx===G.playerFactionIdx;
  const myUnitsWithMP=G.units.filter(u=>u.factionIdx===G.playerFactionIdx&&u.mp>0&&!u.fortified).length;
  if(isPlayerTurn){
    if(myUnitsWithMP>0)document.getElementById('status-text').textContent=`${myUnitsWithMP} unit${myUnitsWithMP>1?'s':''} await${myUnitsWithMP>1?'':'s'} orders.`;
    else document.getElementById('status-text').textContent='All forces have moved.';
    document.getElementById('end-turn-btn').disabled=false;
  }else{
    document.getElementById('status-text').textContent=`${cur.name} is plotting...`;
    document.getElementById('end-turn-btn').disabled=true;
  }
}

function updateSelectionPanel(){
  const sel=G.selected;
  const c=document.getElementById('selection-content');
  if(!sel){c.innerHTML='<span style="color:var(--parchment-d);font-style:italic">Click a tile to inspect.</span>';document.getElementById('right-panel').style.display='none';return}
  if(sel.type==='unit'){renderUnitPanel(sel.ref);renderUnitDetailsRight(sel.ref)}
  else if(sel.type==='city'){renderCityPanel(sel.ref);renderCityDetailsRight(sel.ref)}
  else if(sel.type==='tile'){renderTilePanel(sel.ref);document.getElementById('right-panel').style.display='none'}
}

function renderUnitPanel(unit){
  const fac=G.factions[unit.factionIdx];
  const tpl=UNIT_TYPES[unit.typeId];
  let html=`<div class="unit-card"><div class="name" style="color:${fac.color}">${tpl.glyph} ${tpl.name}</div>`;
  html+=`<div class="stat-row"><span>HP ${unit.hp}/${unit.maxHp}</span><span>Atk ${tpl.atk}</span><span>Def ${tpl.def}</span><span>MP ${unit.mp}/${unit.maxMp}</span></div>`;
  html+=`<div class="hp-bar"><div style="width:${(unit.hp/unit.maxHp)*100}%"></div></div>`;
  html+=`<div style="font-size:11px;color:var(--parchment-d);margin-top:4px;font-style:italic">${tpl.desc}</div>`;
  html+=`</div>`;
  if(unit.factionIdx===G.playerFactionIdx){
    if(unit.typeId==='PIONEER'&&unit.mp>0){
      const tile=getTile(unit.q,unit.r);
      const tooClose=G.cities.some(c=>hexDistance({q:c.q,r:c.r},tile)<4);
      const cityHere=getCityAt(unit.q,unit.r);
      html+=`<button class="action-btn" ${tooClose||cityHere?'disabled':''} onclick="playerFoundCity()">⌂ Found city here${tooClose?' (too close)':''}</button>`;
    }
    if(unit.typeId==='WORKER'&&unit.mp>0){
      const t=getTile(unit.q,unit.r);
      const ok=t&&t.owner===unit.factionIdx&&!t.improvement&&!t.cityId&&['PLAINS','HILLS','FOREST'].includes(t.terrain);
      let imp='farm';
      if(t&&t.terrain==='HILLS')imp='mine';
      else if(t&&t.terrain==='FOREST')imp='road';
      html+=`<button class="action-btn" ${ok?'':'disabled'} onclick="playerImprove()">⚒ Build ${imp}</button>`;
    }
    if(UNIT_TYPES[unit.typeId].atk>0&&!unit.fortified){
      html+=`<button class="action-btn" onclick="playerFortify()">◫ Fortify (+30% def)</button>`;
    }
  }
  document.getElementById('selection-content').innerHTML=html;
}

function renderUnitDetailsRight(){document.getElementById('right-panel').style.display='none'}

function renderCityPanel(city){
  const fac=G.factions[city.factionIdx];
  const y=cityYields(city);
  let html=`<div class="unit-card"><div class="name" style="color:${fac.color}">${fac.glyph} ${city.name}${city.isCapital?' ★':''}</div>`;
  html+=`<div class="stat-row"><span>Pop ${city.population}</span><span>HP ${city.hp}/${city.maxHp}</span></div>`;
  html+=`<div class="stat-row"><span>Food ${city.foodStored}/${city.foodNeeded} (${y.food>=0?'+':''}${y.food})</span></div>`;
  html+=`<div class="stat-row"><span>Prod (${y.prod})</span><span>Gold (+${y.gold})</span><span>Sci (+${y.sci})</span></div>`;
  html+=`</div>`;
  document.getElementById('selection-content').innerHTML=html;
  if(city.factionIdx===G.playerFactionIdx)renderCityDetailsRight(city);
  else document.getElementById('right-panel').style.display='none';
}

function renderCityDetailsRight(city){
  const right=document.getElementById('right-panel');
  right.style.display='block';
  document.getElementById('right-title').textContent=city.name+' — Production';
  const fac=G.factions[city.factionIdx];
  let html='';
  if(city.buildQueue){
    const item=city.buildQueue;
    let cost=0,name='';
    if(item.kind==='unit'){cost=UNIT_TYPES[item.id].cost;name=UNIT_TYPES[item.id].name}
    else{cost=BUILDING_TYPES[item.id].cost;name=BUILDING_TYPES[item.id].name}
    const remaining=cost-city.productionStored;
    html+=`<div style="margin-bottom:10px;padding:8px;background:rgba(78,205,196,0.1);border:1px solid var(--aether);border-radius:4px">Building <strong>${name}</strong>: ${city.productionStored}/${cost} <span style="color:var(--parchment-d)">(${Math.max(0,Math.ceil(remaining/Math.max(1,cityYields(city).prod)))} turns)</span></div>`;
  }
  html+=`<h4>Units</h4><div class="build-list">`;
  for(const[uid,tpl]of Object.entries(UNIT_TYPES)){
    if(tpl.requires&&!fac.techs.has(tpl.requires))continue;
    const isCur=city.buildQueue&&city.buildQueue.kind==='unit'&&city.buildQueue.id===uid;
    html+=`<div class="build-item ${isCur?'current':''}" onclick="setCityBuild(${city.id},'unit','${uid}')">`;
    html+=`<div class="name">${tpl.glyph} ${tpl.name}</div>`;
    html+=`<div class="desc">${tpl.desc}</div>`;
    html+=`<div class="meta">Cost: ${tpl.cost} prod · HP ${tpl.hp} Atk ${tpl.atk} Def ${tpl.def} MP ${tpl.mp}</div>`;
    html+=`</div>`;
  }
  html+=`</div><h4>Buildings</h4><div class="build-list">`;
  for(const[bid,b]of Object.entries(BUILDING_TYPES)){
    if(city.buildings.has(bid))continue;
    const locked=b.requires&&!fac.techs.has(b.requires);
    const isCur=city.buildQueue&&city.buildQueue.kind==='building'&&city.buildQueue.id===bid;
    html+=`<div class="build-item ${isCur?'current':''} ${locked?'locked':''}" ${!locked?`onclick="setCityBuild(${city.id},'building','${bid}')"`:''}>`;
    html+=`<div class="name">${b.glyph} ${b.name}</div>`;
    html+=`<div class="desc">${b.desc}</div>`;
    html+=`<div class="meta">Cost: ${b.cost} prod${locked?' · Requires '+TECHS[b.requires].name:''}</div>`;
    html+=`</div>`;
  }
  if(city.buildings.size>0){
    html+=`</div><h4>Already Built</h4><div style="font-size:11px;color:var(--parchment-d)">`;
    for(const b of city.buildings)html+=`<div>${BUILDING_TYPES[b].glyph} ${BUILDING_TYPES[b].name}</div>`;
    html+=`</div>`;
  }else html+=`</div>`;
  document.getElementById('right-content').innerHTML=html;
}

function renderTilePanel(tile){
  const tt=TERRAIN_TYPES[tile.terrain];
  let html=`<div class="unit-card"><div class="name">${tt.name}</div>`;
  html+=`<div class="stat-row"><span>F ${tt.food}</span><span>P ${tt.prod}</span><span>G ${tt.gold}</span></div>`;
  if(tt.defBonus>0)html+=`<div class="stat-row"><span>Defense bonus: +${Math.round(tt.defBonus*100)}%</span></div>`;
  if(tile.owner!=null)html+=`<div class="stat-row"><span>Claimed by ${G.factions[tile.owner].name}</span></div>`;
  html+=`</div>`;
  document.getElementById('selection-content').innerHTML=html;
}

// Player action handlers
window.playerFoundCity=()=>{
  const u=G.selected.ref;
  const tile=getTile(u.q,u.r);
  if(getCityAt(u.q,u.r))return;
  const tooClose=G.cities.some(c=>hexDistance({q:c.q,r:c.r},tile)<4);
  if(tooClose)return;
  const name=pickCityName();
  const c=createCity(u.factionIdx,u.q,u.r,name);
  if(G.cities.filter(cc=>cc.factionIdx===u.factionIdx).length===1)c.isCapital=true;
  log(`You founded ${name}.`,'good');
  killUnit(u);
  G.selected={type:'city',ref:c};
  G.moveTargets=[];G.attackTargets=[];
  recomputeVisibility();
  render();updateUI();
};
window.playerImprove=()=>{
  const u=G.selected.ref;
  const t=getTile(u.q,u.r);
  if(!t||t.owner!==u.factionIdx||t.improvement||t.cityId)return;
  if(t.terrain==='PLAINS')t.improvement='farm';
  else if(t.terrain==='HILLS')t.improvement='mine';
  else if(t.terrain==='FOREST')t.improvement='road';
  else return;
  log(`Engineer built ${t.improvement}.`,'good');
  u.mp=0;
  render();updateUI();
};
window.playerFortify=()=>{
  const u=G.selected.ref;
  u.fortified=true;u.mp=0;
  render();updateUI();
};
window.setCityBuild=(cityId,kind,id)=>{
  const c=G.cities.find(c=>c.id===cityId);
  if(!c||c.factionIdx!==G.playerFactionIdx)return;
  const player=G.factions[G.playerFactionIdx];
  if(kind==='unit'&&UNIT_TYPES[id].requires&&!player.techs.has(UNIT_TYPES[id].requires))return;
  if(kind==='building'&&BUILDING_TYPES[id].requires&&!player.techs.has(BUILDING_TYPES[id].requires))return;
  c.buildQueue={kind,id};
  updateUI();
};

// ============================================================================
// MODALS
// ============================================================================
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
window.closeModal=closeModal;
function closeAllModals(){document.querySelectorAll('.modal.show').forEach(m=>{if(m.id!=='setup-modal'&&m.id!=='game-over-modal')m.classList.remove('show')})}

document.getElementById('tech-btn').addEventListener('click',()=>{renderTechTree();openModal('tech-modal')});
document.getElementById('diplo-btn').addEventListener('click',()=>{renderDiploScreen();openModal('diplo-modal')});
document.getElementById('end-turn-btn').addEventListener('click',()=>{if(!G.factions[G.currentFactionIdx].isAI)endTurn()});
document.getElementById('next-unit-btn').addEventListener('click',selectNextUnit);

function renderTechTree(){
  const player=G.factions[G.playerFactionIdx];
  let status='';
  if(player.currentResearch){
    const t=TECHS[player.currentResearch];
    const sciPerTurn=G.cities.filter(c=>c.factionIdx===G.playerFactionIdx).reduce((s,c)=>s+cityYields(c).sci,0);
    const remaining=t.cost-(player.researchProgress||0);
    const turns=sciPerTurn>0?Math.ceil(remaining/sciPerTurn):'∞';
    status=`Researching <strong>${t.name}</strong>: ${player.researchProgress||0}/${t.cost} (${turns} turn${turns!==1?'s':''} at +${sciPerTurn}/turn)`;
  }else status='Choose what to rediscover.';
  document.getElementById('research-status').innerHTML=status;
  const branches=['science','industry','economy','expansion'];
  let html='<div class="tech-tree-grid">';
  for(const branch of branches){
    html+=`<div class="tech-column"><h3 style="color:${TECH_BRANCHES[branch].color}">${TECH_BRANCHES[branch].name}</h3>`;
    const techs=Object.entries(TECHS).filter(([,t])=>t.branch===branch);
    techs.sort((a,b)=>a[1].cost-b[1].cost);
    for(const[id,t]of techs){
      const has=player.techs.has(id);
      const can=t.prereqs.every(p=>player.techs.has(p));
      const isCur=player.currentResearch===id;
      let cls='tech-node ';
      if(has)cls+='researched';
      else if(isCur)cls+='researching';
      else if(can)cls+='available';
      else cls+='locked';
      html+=`<div class="${cls}" ${can&&!has&&!isCur?`onclick="pickResearch('${id}')"`:''}>`;
      html+=`<div class="tech-name">${t.name}${t.isVictory?' ✦':''}</div>`;
      html+=`<div class="tech-cost">${t.cost} sci${has?' · researched':isCur?` · ${player.researchProgress||0}/${t.cost}`:''}</div>`;
      if(t.unlocks)html+=`<div class="tech-unlock">Unlocks: ${t.unlocks.map(u=>UNIT_TYPES[u]?UNIT_TYPES[u].name:u).join(', ')}</div>`;
      if(t.prereqs.length>0&&!can)html+=`<div class="tech-cost">Needs: ${t.prereqs.map(p=>TECHS[p].name).join(', ')}</div>`;
      html+=`<div class="tech-flavor">${t.flavor}</div>`;
      html+=`</div>`;
    }
    html+='</div>';
  }
  html+='</div>';
  document.getElementById('tech-tree-container').innerHTML=html;
}
window.pickResearch=(id)=>{
  const player=G.factions[G.playerFactionIdx];
  if(player.currentResearch===id)return;
  // If switching from a partial, we keep progress only if same prereq line - simplified: lose progress
  if(player.currentResearch&&player.currentResearch!==id)player.researchProgress=0;
  player.currentResearch=id;
  renderTechTree();
  updateUI();
};

function renderDiploScreen(){
  const player=G.factions[G.playerFactionIdx];
  let html='';
  for(const f of G.factions){
    if(f.idx===player.idx||!f.alive)continue;
    const status=player.diplo[f.idx]||'unmet';
    const grudge=G.aiMemory[f.idx]?G.aiMemory[f.idx].grudges[player.idx]||0:0;
    const myStr=Math.round(aiFactionMilitaryStrength(player.idx));
    const theirStr=Math.round(aiFactionMilitaryStrength(f.idx));
    let mood='';
    if(status==='unmet')mood='Not yet met.';
    else if(grudge>50)mood=`<span style="color:var(--danger)">Holds a deep grudge.</span>`;
    else if(grudge>20)mood=`<span style="color:var(--rust)">Wary, suspicious.</span>`;
    else mood=`<span style="color:var(--parchment-d)">Calm — for now.</span>`;
    html+=`<div class="diplo-row">`;
    html+=`<div class="swatch" style="background:${f.color}33;border-color:${f.color}">${f.glyph}</div>`;
    html+=`<div class="info"><div class="name" style="color:${f.color}">${f.name}</div>`;
    html+=`<div class="status status-${status}">${status.toUpperCase()}</div>`;
    html+=`<div style="font-size:11px;color:var(--parchment-d);margin-top:2px">${mood} · Power: ${theirStr} (yours: ${myStr})</div>`;
    html+=`</div>`;
    html+=`<div class="actions">`;
    if(status==='peace')html+=`<button class="btn small danger" onclick="declareWar(${f.idx})">Declare War</button>`;
    else if(status==='war')html+=`<button class="btn small" onclick="offerPeace(${f.idx})">Offer Peace</button>`;
    html+=`</div></div>`;
  }
  if(!html)html='<p style="color:var(--parchment-d);font-style:italic">No other banners stand.</p>';
  document.getElementById('diplo-content').innerHTML=html;
}
window.declareWar=(idx)=>{
  const player=G.factions[G.playerFactionIdx];
  player.diplo[idx]='war';G.factions[idx].diplo[player.idx]='war';
  G.aiMemory[idx].grudges[player.idx]=(G.aiMemory[idx].grudges[player.idx]||0)+30;
  log(`You declared war on ${G.factions[idx].name}!`,'warning');
  renderDiploScreen();updateUI();
};
window.offerPeace=(idx)=>{
  const player=G.factions[G.playerFactionIdx];
  const other=G.factions[idx];
  const grudge=G.aiMemory[idx].grudges[player.idx]||0;
  const myStr=aiFactionMilitaryStrength(player.idx);
  const theirStr=aiFactionMilitaryStrength(idx);
  // Accept if losing or grudge low
  const ratio=theirStr/Math.max(1,myStr);
  let acceptScore=20-grudge*0.3+(ratio<0.7?40:0)+(ratio>1.3?-20:0);
  if(PERSONALITIES[other.personality].agg>0.7)acceptScore-=20;
  if(acceptScore>0||Math.random()<0.3){
    player.diplo[idx]='peace';other.diplo[player.idx]='peace';
    log(`${other.name} accepted your offer of peace.`,'diplo');
  }else log(`${other.name} rejected your offer of peace. The war drags on.`,'warning');
  renderDiploScreen();updateUI();
};

// ============================================================================
// SETUP / INIT
// ============================================================================
let setupSelectedFaction=0;
function renderFactionList(){
  const el=document.getElementById('faction-list');
  el.innerHTML=FACTIONS.map((f,i)=>`<div class="faction-card ${i===setupSelectedFaction?'selected':''}" onclick="setupSelectFaction(${i})"><div class="swatch" style="background:${f.color}33;border-color:${f.color}">${f.glyph}</div><div class="info"><div class="title" style="color:${f.color}">${f.name}</div><div class="desc">${f.desc}</div><div class="traits">${f.traits}</div></div></div>`).join('');
}
window.setupSelectFaction=(i)=>{setupSelectedFaction=i;renderFactionList()};

document.getElementById('start-game').addEventListener('click',startGame);

function startGame(){
  const mapSize=document.getElementById('map-size').value;
  const opponentCount=Math.max(1,Math.min(4,parseInt(document.getElementById('opponent-count').value)||3));
  G.difficulty=document.getElementById('difficulty').value;
  const speed=document.getElementById('game-speed').value;
  G.goldHegemonyThreshold=speed==='quick'?3000:speed==='long'?8000:5000;
  
  G.map=generateMap(mapSize);
  
  // Build factions: player + N AI
  const playerFaction=FACTIONS[setupSelectedFaction];
  const aiCandidates=FACTIONS.filter((_,i)=>i!==setupSelectedFaction);
  shuffle(aiCandidates);
  G.factions=[];
  G.factions.push(createFaction(playerFaction,false,0));
  for(let i=0;i<opponentCount;i++){
    G.factions.push(createFaction(aiCandidates[i],true,i+1));
  }
  G.playerFactionIdx=0;
  G.currentFactionIdx=0;
  
  // Initial diplo: all unmet
  for(const f of G.factions){
    for(const f2 of G.factions){
      if(f!==f2)f.diplo[f2.idx]='unmet';
    }
  }
  // Init AI memory
  for(const f of G.factions)if(f.isAI)initAIMemory(f.idx);
  
  // Place starting units/cities
  const starts=findFactionStarts(G.factions.length);
  for(let i=0;i<G.factions.length;i++){
    const f=G.factions[i];
    const s=starts[i];
    // Found capital
    const c=createCity(f.idx,s.q,s.r,pickCityName());
    c.isCapital=true;
    // Initial garrison
    const cogSpot=hexNeighbors(s.q,s.r).find(n=>{const t=getTile(n.q,n.r);return t&&TERRAIN_TYPES[t.terrain].walkable&&!getUnitAt(n.q,n.r)});
    if(cogSpot)createUnit('COGMAN',f.idx,cogSpot.q,cogSpot.r);
    // Faction-specific bonus units
    const tpl=FACTIONS.find(ff=>ff.id===f.id);
    if(tpl.startBonus==='extra_warrior'){
      const spot=hexNeighbors(s.q,s.r).find(n=>{const t=getTile(n.q,n.r);return t&&TERRAIN_TYPES[t.terrain].walkable&&!getUnitAt(n.q,n.r)});
      if(spot)createUnit('COGMAN',f.idx,spot.q,spot.r);
    }
    if(tpl.startBonus==='extra_pioneer'){
      const spot=hexNeighbors(s.q,s.r).find(n=>{const t=getTile(n.q,n.r);return t&&TERRAIN_TYPES[t.terrain].walkable&&!getUnitAt(n.q,n.r)});
      if(spot)createUnit('PIONEER',f.idx,spot.q,spot.r);
    }
    // Everyone gets a pioneer + scout to start
    const spot2=hexNeighbors(s.q,s.r).find(n=>{const t=getTile(n.q,n.r);return t&&TERRAIN_TYPES[t.terrain].walkable&&!getUnitAt(n.q,n.r)});
    if(spot2)createUnit('PIONEER',f.idx,spot2.q,spot2.r);
    const spot3=hexNeighbors(s.q,s.r).find(n=>{const t=getTile(n.q,n.r);return t&&TERRAIN_TYPES[t.terrain].walkable&&!getUnitAt(n.q,n.r)});
    if(spot3)createUnit('SCOUT',f.idx,spot3.q,spot3.r);
  }
  
  // Initial difficulty resource bonus for AI
  if(G.difficulty==='hard'){
    for(const f of G.factions)if(f.isAI){f.resources.gold+=100;f.science+=20}
  }
  
  recomputeVisibility();
  // Center camera on player capital
  const myCap=G.cities.find(c=>c.factionIdx===G.playerFactionIdx);
  centerOnHex(myCap.q,myCap.r);
  
  closeModal('setup-modal');
  resizeCanvas();
  log(`The Awakening begins. ${G.factions[0].name} stirs from the ash.`,'flavor');
  log(`Your goal: dominate, ascend, or amass ${G.goldHegemonyThreshold} gold for ${G.goldHegemonyRequired} turns.`,'flavor');
  // Refresh starting MP
  for(const u of G.units.filter(u=>u.factionIdx===0))u.mp=UNIT_TYPES[u.typeId].mp;
  updateUI();render();
}

renderFactionList();
resizeCanvas();

