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

// Phase 1 step 3: core utilities (hex math, state, types, rng, dom IDs).
import {
  HEX_SIZE,
  SQRT3,
  HEX_DIRS,
  hexToPixel,
  pixelToHex,
  roundHex,
  hexNeighbors,
  hexDistance,
  hexKey,
} from './core/hex';
import { G, getTile, getUnitAt, getCityAt } from './core/state';
import { shuffle } from './core/rng';
import { log, renderLog } from './core/log';

// Phase 1 step 4: systems peeled out into src/systems/*.ts.
import { recomputeVisibility, setVisibleAround } from './systems/visibility';
import { generateMap, findFactionStarts } from './systems/mapgen';
import {
  createUnit,
  killUnit,
  computeMoveTargets,
  computeAttackTargets,
  moveUnit,
  handleRuinDiscovery,
} from './systems/movement';
import {
  combat,
  getDifficultyAtkBonus,
  autoDeclare,
  captureCity,
  eliminateFaction,
} from './systems/combat';
import { createCity, cityYields, processCity, pickCityName } from './systems/city';
import { getAvailableTechs, processResearch } from './systems/research';

// Phase 1 step 5: AI modules peeled out into src/ai/*.ts.
import { initAIMemory } from './ai/memory';
import {
  aiPlayTurn,
  aiUnitPriority,
  updateAIStrategy,
  aiFactionMilitaryStrength,
} from './ai/strategy';
import { aiPickTech } from './ai/techAI';
import { aiPickBuild } from './ai/cityAI';
import {
  aiUnitTurn,
  aiPioneerAction,
  aiWorkerAction,
  aiScoutAction,
  aiMilitaryAction,
  aiMoveToward,
} from './ai/unitAI';
import { aiDiplomacy, aiTelegraph } from './ai/diploAI';

// 'use strict' is implicit in ES modules; the prototype's directive is dropped.

// (HEX MATH section moved to src/core/hex.ts — see imports above.)

// (DATA section moved to src/data/*.ts — see imports at top of file.)

// (GAME STATE singleton moved to src/core/state.ts — see import above.)
// canvas/ctx/svg refs and resizeCanvas remain here until render/canvas.ts
// is created in step 7.
const canvas=document.getElementById('map-canvas');
const ctx=canvas.getContext('2d');
const svg=document.getElementById('overlay-svg');
function resizeCanvas(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;svg.setAttribute('width',window.innerWidth);svg.setAttribute('height',window.innerHeight);if(G.map)render()}
window.addEventListener('resize',resizeCanvas);

// (MAP GENERATION moved to src/systems/mapgen.ts.)

// ============================================================================
// TURN MANAGEMENT / VICTORY
// ============================================================================
function endTurn(){
  if(G.gameOver)return;
  const cur=G.factions[G.currentFactionIdx];
  for(const c of G.cities.filter(c=>c.factionIdx===cur.idx))processCity(c);
  const _research=processResearch(cur);
  if(_research.ascensionTriggered){triggerVictory(cur.idx,'ascension');return}
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

