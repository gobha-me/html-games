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

// Phase 1 step 6: turn loop + victory triggers in src/systems/turn.ts.
import {
  endTurn,
  runAITurn,
  computeFactionScore,
  triggerVictory,
  triggerDefeat,
  scorecard,
  setRequestRedraw,
} from './systems/turn';

// Phase 1 step 7: rendering in src/render/.
import { canvas, ctx, render, resizeCanvas, centerOnHex } from './render/canvas';
import { svg } from './render/overlay';

// Phase 1 step 8: UI panels and modals in src/ui/.
import { openModal, closeAllModals } from './ui/modals';
import { handleHover } from './ui/tooltip';
import { updateUI } from './ui/topbar';
import { renderTechTree } from './ui/techModal';
import { renderDiploScreen } from './ui/diploModal';
import { renderFactionList, getSelectedFactionIdx } from './ui/setupModal';

// 'use strict' is implicit in ES modules; the prototype's directive is dropped.

// (HEX MATH section moved to src/core/hex.ts — see imports above.)

// (DATA section moved to src/data/*.ts — see imports at top of file.)

// (GAME STATE singleton moved to src/core/state.ts — see import above.)
// (canvas/ctx/svg refs + resizeCanvas + render moved to src/render/.)

// (MAP GENERATION moved to src/systems/mapgen.ts.)

// RENDERING
// ============================================================================

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


// ============================================================================
// UI UPDATES
// ============================================================================


document.getElementById('tech-btn').addEventListener('click',()=>{renderTechTree();openModal('tech-modal')});
document.getElementById('diplo-btn').addEventListener('click',()=>{renderDiploScreen();openModal('diplo-modal')});
document.getElementById('end-turn-btn').addEventListener('click',()=>{if(!G.factions[G.currentFactionIdx].isAI)endTurn()});
document.getElementById('next-unit-btn').addEventListener('click',selectNextUnit);



document.getElementById('start-game').addEventListener('click',startGame);

function startGame(){
  const mapSize=document.getElementById('map-size').value;
  const opponentCount=Math.max(1,Math.min(4,parseInt(document.getElementById('opponent-count').value)||3));
  G.difficulty=document.getElementById('difficulty').value;
  const speed=document.getElementById('game-speed').value;
  G.goldHegemonyThreshold=speed==='quick'?3000:speed==='long'?8000:5000;
  
  G.map=generateMap(mapSize);
  
  // Build factions: player + N AI
  const _selFactionIdx=getSelectedFactionIdx();
  const playerFaction=FACTIONS[_selFactionIdx];
  const aiCandidates=FACTIONS.filter((_,i)=>i!==_selFactionIdx);
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

// Phase 1 step 6 wiring: turn.ts publishes a redraw hook; fill it in here
// while updateUI/render still live in legacy.ts. Step 10 will move this
// wiring into main.ts.
setRequestRedraw(() => {
  updateUI();
  render();
});

renderFactionList();
resizeCanvas();

