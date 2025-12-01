<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Isla del Tesoro — Corrección robusta</title>
  <style>
    html,body{height:100%;margin:0;background:#7ec8ff;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial}
    #gameWrap{width:800px;margin:18px auto;position:relative}
    canvas{display:block;width:800px;height:600px;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.35);background:#88ccff}
    .overlay{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    .panel{background:rgba(255,255,255,0.96);padding:18px;border-radius:10px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.14)}
    button{font-size:15px;padding:8px 14px;margin:6px;cursor:pointer;border-radius:8px;border:0;background:#2b8aef;color:white}
    #hud{position:absolute;left:12px;top:12px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.6);font-weight:700;pointer-events:none}
    #controls{position:absolute;right:12px;top:12px;display:flex;gap:8px}
    #hint{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.6)}
    #log{position:absolute;left:12px;bottom:12px;color:#08324b;background:rgba(255,255,255,0.85);padding:6px;border-radius:6px;font-size:12px;max-width:420px;max-height:120px;overflow:auto}
  </style>
</head>
<body>
  <div id="gameWrap">
    <div id="hud">Nivel 1 — Tesoro: enterrado</div>
    <div id="controls">
      <button id="pauseBtn">Pausa</button>
      <button id="zoomBtn">Ver isla</button>
    </div>
    <canvas id="screen" width="320" height="240"></canvas>

    <div id="startOverlay" class="overlay">
      <div class="panel">
        <h1>Isla del Tesoro — Corrección robusta</h1>
        <p>Mueve con las flechas. Mantén ESPACIO para desenterrar. Si aparece algo raro, mira el recuadro LOG abajo.</p>
        <div>
          <button id="startBtn">Iniciar (Nivel 1)</button>
          <button id="exitBtn">Salir</button>
        </div>
      </div>
    </div>

    <div id="levelCompleteOverlay" class="overlay" style="display:none">
      <div class="panel">
        <h2 id="levelTitle">Nivel completado</h2>
        <p id="levelMsg"></p>
        <div>
          <button id="nextLevelBtn">Siguiente nivel</button>
          <button id="retryLevelBtn">Repetir nivel</button>
        </div>
      </div>
    </div>

    <div id="deathOverlay" class="overlay" style="display:none">
      <div class="panel">
        <h2 id="deathTitle">Has sido alcanzado</h2>
        <p id="deathMsg">Has sido golpeado por una flecha. Repite el nivel.</p>
        <div>
          <button id="deathOkBtn">Reintentar</button>
        </div>
      </div>
    </div>

    <div id="hint" class="hint"></div>
    <div id="log"></div>
  </div>

  <script>
  (function(){
    // Short debug log helper (writes both console and on-screen #log)
    const logEl = document.getElementById('log');
    function log(msg){
      console.log(msg);
      const p = document.createElement('div');
      p.textContent = msg;
      logEl.prepend(p);
      while(logEl.children.length > 12) logEl.removeChild(logEl.lastChild);
    }

    window.addEventListener('error', function(e){
      log('ERROR: ' + (e && e.message ? e.message : String(e)));
      console.error(e);
    });
    window.addEventListener('unhandledrejection', function(e){
      log('Promise rejection: ' + (e && e.reason ? e.reason : String(e)));
      console.error(e);
    });

    // ---- Buffer & Canvas ----
    const BUF_W = 160, BUF_H = 120;
    const screen = document.getElementById('screen');
    const buf = document.createElement('canvas'); buf.width = BUF_W; buf.height = BUF_H;
    const bctx = buf.getContext('2d'), sctx = screen.getContext('2d');
    sctx.imageSmoothingEnabled = false; bctx.imageSmoothingEnabled = false;

    // ---- World/grid ----
    const WORLD_W = 720, WORLD_H = 540;
    const worldCenter = {x: WORLD_W/2, y: WORLD_H/2};
    const TILE_SIZE = 12;
    const GRID_W = Math.ceil(WORLD_W / TILE_SIZE);
    const GRID_H = Math.ceil(WORLD_H / TILE_SIZE);

    // ---- Levels / constants ----
    const LEVELS = [
      { numBuried: 6, numPalms: 20, numRocks: 14, numBushes: 50, digSeconds: 5.0, noise: 0.38, islets: 0, enemies: 2 },
      { numBuried: 8, numPalms: 26, numRocks: 20, numBushes: 64, digSeconds: 6.0, noise: 0.46, islets: 0, enemies: 3 },
      { numBuried: 10, numPalms: 30, numRocks: 28, numBushes: 74, digSeconds: 7.5, noise: 0.52, islets: 1, enemies: 4 },
      { numBuried: 13, numPalms: 34, numRocks: 36, numBushes: 90, digSeconds: 9.0, noise: 0.6, islets: 2, enemies: 5 },
      { numBuried: 18, numPalms: 40, numRocks: 44, numBushes: 110, digSeconds: 11.0, noise: 0.72, islets: 3, enemies: 7 }
    ];
    const MAX_LEVEL = LEVELS.length;
    const WATER_SLOW_MULT = 0.455;

    // ---- DOM refs ----
    const hud = document.getElementById('hud');
    const hintEl = document.getElementById('hint');

    // ---- State ----
    let keys = {};
    window.addEventListener('keydown', e => { keys[e.key] = true; if(e.key.startsWith('Arrow')) e.preventDefault(); });
    window.addEventListener('keyup', e => { keys[e.key] = false; });

    let running=false, paused=false, showFullIsland=false, time=0, currentLevel=1;
    let lastTime = 0;

    // ---- Entities ----
    const player = { x:0, y:0, w:6, h:8, speed:24, _inWater:false };
    let landTiles = null;
    let palms=[], bushes=[], rocks=[], buriedItems=[], seaSprites=[], waves=[], particles=[];
    let enemies=[], arrows=[];

    // ---- Small helpers ----
    function randRange(a,b){ return a + Math.random()*(b-a); }
    function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
    function createEmptyGrid(){ const g=[]; for(let y=0;y<GRID_H;y++) g[y] = new Array(GRID_W).fill(false); return g; }

    // ---- Island generation ----
    function seedIsland(grid, noise){
      const cx = Math.floor(worldCenter.x/TILE_SIZE), cy = Math.floor(worldCenter.y/TILE_SIZE);
      const rxTiles = Math.floor(220 / TILE_SIZE), ryTiles = Math.floor(140 / TILE_SIZE);
      for(let ty = cy - ryTiles - 3; ty <= cy + ryTiles + 3; ty++){
        if(ty<0||ty>=GRID_H) continue;
        for(let tx = cx - rxTiles - 6; tx <= cx + rxTiles + 6; tx++){
          if(tx<0||tx>=GRID_W) continue;
          const wx = (tx+0.5)*TILE_SIZE, wy = (ty+0.5)*TILE_SIZE;
          const dx = (wx - worldCenter.x)/220, dy = (wy - worldCenter.y)/140;
          const d2 = dx*dx + dy*dy;
          const pBase = 1 - Math.pow(d2, 0.9);
          const pNoise = randRange(-noise*0.9, noise*0.9);
          if(pBase + pNoise > 0.12) grid[ty][tx] = true;
        }
      }
    }
    function smoothGrid(grid, iterations){
      for(let it=0; it<iterations; it++){
        const copy = createEmptyGrid();
        for(let y=0;y<GRID_H;y++){
          for(let x=0;x<GRID_W;x++){
            let c=0;
            for(let oy=-1; oy<=1; oy++) for(let ox=-1; ox<=1; ox++){
              const nx=x+ox, ny=y+oy;
              if(nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && grid[ny][nx]) c++;
            }
            if(c>=5) copy[y][x]=true; else if(c>=3 && grid[y][x]) copy[y][x]=true;
          }
        }
        grid = copy;
      }
      return grid;
    }
    function connectIslands(grid){
      const visited = Array.from({length:GRID_H}, ()=>new Array(GRID_W).fill(false));
      const comps = [];
      for(let y=0;y<GRID_H;y++) for(let x=0;x<GRID_W;x++){
        if(grid[y][x] && !visited[y][x]){
          const stack=[[x,y]]; visited[y][x]=true; const comp=[];
          while(stack.length){
            const [cx,cy]=stack.pop(); comp.push({x:cx,y:cy});
            for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
              const nx=cx+ox, ny=cy+oy;
              if(nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && !visited[ny][nx] && grid[ny][nx]){ visited[ny][nx]=true; stack.push([nx,ny]); }
            }
          }
          comps.push(comp);
        }
      }
      if(comps.length <= 1) return grid;
      comps.sort((a,b)=>b.length - a.length);
      const main = comps[0];
      for(let i=1;i<comps.length;i++){
        const comp = comps[i];
        let best=null, bestD=1e9;
        for(const a of comp) for(const b of main){ const dx=a.x-b.x, dy=a.y-b.y, d=dx*dx+dy*dy; if(d<bestD){ bestD=d; best={a,b}; } }
        if(!best) continue;
        let x0=best.a.x,y0=best.a.y,x1=best.b.x,y1=best.b.y;
        const dx = Math.abs(x1-x0), sx = x0<x1?1:-1;
        const dy = -Math.abs(y1-y0), sy = y0<y1?1:-1;
        let err = dx+dy;
        while(true){
          grid[y0][x0] = true;
          if(x0===x1 && y0===y1) break;
          const e2 = 2*err;
          if(e2 >= dy){ err += dy; x0 += sx; }
          if(e2 <= dx){ err += dx; y0 += sy; }
        }
      }
      return grid;
    }
    function buildTileIslandSafely(level){
      try{
        const cfg = LEVELS[level-1] || LEVELS[0];
        let grid = createEmptyGrid();
        seedIsland(grid, cfg.noise);
        grid = smoothGrid(grid, 3);
        grid = connectIslands(grid);
        let any=false;
        for(let y=0;y<GRID_H;y++) for(let x=0;x<GRID_W;x++) if(grid[y][x]) any=true;
        if(!any){
          log('WARN: generación devolvió 0 tiles, forzando isla central.');
          const cx = Math.floor(GRID_W/2), cy = Math.floor(GRID_H/2);
          const r = Math.max(3, Math.floor(Math.min(GRID_W, GRID_H) * 0.12));
          for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
            const nx = cx + dx, ny = cy + dy;
            if(nx>=0 && nx<GRID_W && ny>=0 && ny<GRID_H && Math.hypot(dx,dy) <= r) grid[ny][nx] = true;
          }
        }
        landTiles = grid;
        log('land tiles = ' + countLandTiles(grid));
      }catch(err){
        log('ERROR building island: ' + err);
        const grid = createEmptyGrid();
        const cx = Math.floor(GRID_W/2), cy = Math.floor(GRID_H/2);
        for(let dy=-3; dy<=3; dy++) for(let dx=-3; dx<=3; dx++){
          const nx = cx+dx, ny = cy+dy;
          if(nx>=0&&nx<GRID_W&&ny>=0&&ny<GRID_H) grid[ny][nx] = true;
        }
        landTiles = grid;
      }
    }
    function countLandTiles(grid){ let c=0; for(let y=0;y<GRID_H;y++) for(let x=0;x<GRID_W;x++) if(grid[y][x]) c++; return c; }
    function isPointInIsland(wx,wy){ if(!landTiles) return false; const tx = Math.floor(wx/TILE_SIZE), ty = Math.floor(wy/TILE_SIZE); if(tx<0||tx>=GRID_W||ty<0||ty>=GRID_H) return false; return !!landTiles[ty][tx]; }

    // ---- Enemies / arrows ----
    function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
    function spawnEnemiesForLevel(level){
      const cfg = LEVELS[level-1] || LEVELS[0];
      enemies = [];
      const centers=[];
      for(let ty=0; ty<GRID_H; ty++) for(let tx=0; tx<GRID_W; tx++) if(landTiles[ty][tx]) centers.push({x:tx*TILE_SIZE+TILE_SIZE/2,y:ty*TILE_SIZE+TILE_SIZE/2});
      const cand = shuffle(centers.slice());
      let placed=0;
      for(const c of cand){
        if(placed>=cfg.enemies) break;
        if(Math.hypot(c.x-player.x,c.y-player.y) < TILE_SIZE*6) continue;
        enemies.push({x:c.x,y:c.y-1,w:6,h:8,speed:18,lastShot:-999,cooldown:1.2,wanderTarget:null, spawnX:c.x, spawnY:c.y});
        placed++;
      }
      for(const c of cand){
        if(placed>=cfg.enemies) break;
        enemies.push({x:c.x,y:c.y-1,w:6,h:8,speed:18,lastShot:-999,cooldown:1.2,wanderTarget:null, spawnX:c.x, spawnY:c.y});
        placed++;
      }
    }

    const ARROW_SPEED = 170, ARROW_MAX_TURN = Math.PI * 1.2;
    function spawnArrowFromEnemy(enemy, targetX, targetY){
      const sx = enemy.x, sy = enemy.y;
      const dx = targetX - sx, dy = targetY - sy; const d = Math.hypot(dx,dy);
      if(d===0) return;
      const angle = Math.atan2(dy,dx);
      arrows.push({ x:sx, y:sy, vx:Math.cos(angle)*ARROW_SPEED, vy:Math.sin(angle)*ARROW_SPEED, speed:ARROW_SPEED, life:5.0, angle:angle, homing:true });
    }

    function updateArrows(dt){
      for(let i=arrows.length-1;i>=0;i--){
        const a = arrows[i];
        try{
          if(a.homing){
            const px = player.x + player.w/2, py = player.y + player.h/2;
            const desired = Math.atan2(py - a.y, px - a.x);
            let diff = desired - a.angle;
            while(diff > Math.PI) diff -= 2*Math.PI;
            while(diff < -Math.PI) diff += 2*Math.PI;
            const maxStep = ARROW_MAX_TURN * dt;
            if(Math.abs(diff) > maxStep) diff = diff > 0 ? maxStep : -maxStep;
            a.angle += diff;
            a.vx = Math.cos(a.angle) * a.speed;
            a.vy = Math.sin(a.angle) * a.speed;
          }
          a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
          if(a.x < 0 || a.x > WORLD_W || a.y < 0 || a.y > WORLD_H){ arrows.splice(i,1); continue; }
          const tx = Math.floor(a.x / TILE_SIZE), ty = Math.floor(a.y / TILE_SIZE);
          if(tx>=0&&tx<GRID_W&&ty>=0&&ty<GRID_H && landTiles[ty][tx]){ arrows.splice(i,1); continue; }
          const pbox = {x:player.x,y:player.y,w:player.w,h:player.h}, abox = {x:a.x-2,y:a.y-1,w:3,h:2};
          if(rectIntersect(pbox, abox)){
            arrows.splice(i,1);
            log('Has sido golpeado por una flecha — reiniciando nivel.');
            // immediate restart of current level
            generateLevelWrapper(currentLevel);
            running = true;
            paused = false;
            lastTime = performance.now();
            requestAnimationFrame(loop);
            return;
          }
          if(a.life <= 0) arrows.splice(i,1);
        }catch(err){
          log('ERROR updateArrows: ' + err);
          arrows.splice(i,1);
        }
      }
    }

    // enemy AI: limited chase radius
    const ENEMY_MAX_FOLLOW_TILES = 10, SIGHT_TILES = 4, SHOOT_TILES = 2;
    function tilesDistance(ax,ay,bx,by){ const atx=Math.floor(ax/TILE_SIZE), aty=Math.floor(ay/TILE_SIZE), btx=Math.floor(bx/TILE_SIZE), bty=Math.floor(by/TILE_SIZE); return Math.hypot(atx-btx, aty-bty); }
    function hasLineOfSight(ax,ay,bx,by){
      const atx=Math.floor(ax/TILE_SIZE), aty=Math.floor(ay/TILE_SIZE), btx=Math.floor(bx/TILE_SIZE), bty=Math.floor(by/TILE_SIZE);
      let x0=atx,y0=aty,x1=btx,y1=bty; const dx=Math.abs(x1-x0), sx=x0<x1?1:-1; const dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy;
      while(true){
        if(x0<0||x0>=GRID_W||y0<0||y0>=GRID_H) return false;
        if(!landTiles[y0][x0]) return false;
        if(x0===x1 && y0===y1) break;
        const e2 = 2*err;
        if(e2 >= dy){ err += dy; x0 += sx; }
        if(e2 <= dx){ err += dx; y0 += sy; }
      }
      return true;
    }

    function enemyUpdate(dt){
      for(const e of enemies){
        const px = player.x + player.w/2, py = player.y + player.h/2;
        const distTilesToPlayer = tilesDistance(e.x, e.y, px, py);
        const distTilesSpawnToPlayer = tilesDistance(e.spawnX, e.spawnY, px, py);
        const canChase = distTilesSpawnToPlayer <= ENEMY_MAX_FOLLOW_TILES;
        const sees = distTilesToPlayer <= SIGHT_TILES && hasLineOfSight(e.x, e.y, px, py) && canChase;
        if(sees){
          if(distTilesToPlayer <= SHOOT_TILES){
            if(time - e.lastShot >= e.cooldown){ e.lastShot = time; spawnArrowFromEnemy(e, px, py); }
            if(!e.wanderTarget || Math.random() < 0.02){ const angle = Math.atan2(py - e.y, px - e.x) + (Math.random()<0.5?Math.PI/2:-Math.PI/2); e.wanderTarget = { x: e.x + Math.cos(angle)*TILE_SIZE, y: e.y + Math.sin(angle)*TILE_SIZE }; }
          } else {
            e.wanderTarget = { x: px, y: py };
          }
        } else {
          const distSpawnToEnemyTiles = tilesDistance(e.spawnX, e.spawnY, e.x, e.y);
          if(distSpawnToEnemyTiles > 1 && (!e.wanderTarget || e.wanderTarget.x !== e.spawnX || e.wanderTarget.y !== e.spawnY)){
            e.wanderTarget = { x: e.spawnX, y: e.spawnY };
          } else if(!e.wanderTarget || Math.random() < 0.01 || Math.hypot(e.wanderTarget.x - e.x, e.wanderTarget.y - e.y) < 6){
            const rx = e.x + randRange(-TILE_SIZE*4, TILE_SIZE*4), ry = e.y + randRange(-TILE_SIZE*4, TILE_SIZE*4);
            if(isPointInIsland(rx, ry)) e.wanderTarget = { x: rx, y: ry }; else e.wanderTarget = null;
          }
        }
        if(e.wanderTarget){
          const dx = e.wanderTarget.x - e.x, dy = e.wanderTarget.y - e.y;
          const dist = Math.hypot(dx, dy);
          if(dist > 1){
            const vx = (dx / dist) * e.speed * dt, vy = (dy / dist) * e.speed * dt;
            tryMoveEntity(e, vx, vy);
          } else e.wanderTarget = null;
        }
      }
    }

    function tryMoveEntity(ent, dx, dy){
      const newX = ent.x + dx, newY = ent.y + dy;
      const box = { x:newX, y:newY, w:ent.w, h:ent.h };
      const obstacles = [];
      for(const p of palms) obstacles.push(palmHitbox(p));
      for(const r of rocks) obstacles.push(rockHitbox(r));
      for(const b of obstacles){
        if(rectIntersect(box,b)){
          const testX = { x:newX, y:ent.y, w:ent.w, h:ent.h }, testY = { x:ent.x, y:newY, w:ent.w, h:ent.h };
          if(!rectIntersect(testX,b)){ ent.x = newX; return; } else if(!rectIntersect(testY,b)){ ent.y = newY; return; } else return;
        }
      }
      ent.x = newX; ent.y = newY;
    }

    // Hitboxes & movement
    function palmHitbox(p){ return { x: p.x - 2, y: p.y - 8, w: 4, h: 10 }; }
    function rockHitbox(r){ return { x: r.x - 3, y: r.y - 2, w: 6, h: 4 }; }
    function rectIntersect(a,b,pad=0){ return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y; }
    function tryMove(dx,dy){ const newX = player.x + dx, newY = player.y + dy; const pbox={x:newX,y:newY,w:player.w,h:player.h}; const boxes=[]; for(const p of palms) boxes.push(palmHitbox(p)); for(const r of rocks) boxes.push(rockHitbox(r)); for(const b of boxes){ if(rectIntersect(pbox,b)){ const testX={x:newX,y:player.y,w:player.w,h:player.h}, testY={x:player.x,y:newY,w:player.w,h:player.h}; if(!rectIntersect(testX,b)){ player.x=newX; return; } else if(!rectIntersect(testY,b)){ player.y=newY; return; } else return; } } player.x=newX; player.y=newY; }

    // Level builder wrapper
    function generateLevelWrapper(level){
      try{
        showFullIsland = false;
        document.getElementById('zoomBtn').textContent = 'Ver isla';
        buildTileIslandSafely(level);

        palms=[]; bushes=[]; rocks=[]; buriedItems=[]; seaSprites=[]; waves=[]; particles=[]; enemies=[]; arrows=[];

        const landCenters=[];
        for(let ty=0; ty<GRID_H; ty++) for(let tx=0; tx<GRID_W; tx++) if(landTiles[ty][tx]) landCenters.push({x:tx*TILE_SIZE+TILE_SIZE/2, y:ty*TILE_SIZE+TILE_SIZE/2});
        const cfg = LEVELS[level-1] || LEVELS[0];

        if(landCenters.length){ const c = landCenters[Math.floor(landCenters.length/2)]; player.x = c.x - 8; player.y = c.y - 12; } else { player.x = worldCenter.x - 8; player.y = worldCenter.y - 12; }

        const shuffled = shuffle(landCenters.slice());
        for(let i=0;i<Math.min(cfg.numPalms, shuffled.length); i++){ const c = shuffled[i]; palms.push({x:c.x + randRange(-3,3), y:c.y + randRange(-3,3), w:10, h:16}); }
        for(let i=0;i<Math.min(cfg.numBushes, Math.floor(landCenters.length*0.5)); i++){ const c = landCenters[Math.floor(Math.random()*landCenters.length)]; bushes.push({x:c.x + randRange(-2,2), y:c.y + randRange(-2,2), w:6, h:4}); }

        for(let ty=1; ty<GRID_H-1; ty++) for(let tx=1; tx<GRID_W-1; tx++){
          if(landTiles[ty][tx]){ let neighborWater=false; for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){ const nx=tx+ox, ny=ty+oy; if(nx>=0&&nx<GRID_W&&ny>=0&&ny<GRID_H && !landTiles[ny][nx]) neighborWater=true; } if(neighborWater && Math.random()<0.02) rocks.push({x:tx*TILE_SIZE+TILE_SIZE/2+randRange(-2,2), y:ty*TILE_SIZE+TILE_SIZE/2+randRange(-2,2), w:8, h:6}); }
        }

        const candidates = shuffle(landCenters.slice());
        const chosen = [];
        for(const c of candidates){ if(chosen.length>=cfg.numBuried) break; let ok=true; for(const ch of chosen) if(Math.hypot(ch.x-c.x,ch.y-c.y) < TILE_SIZE*2.4){ ok=false; break; } if(ok) chosen.push(c); }
        let idx=0; while(chosen.length < cfg.numBuried && idx < candidates.length) chosen.push(candidates[idx++]);
        const realIndex = Math.floor(Math.random()*chosen.length);
        buriedItems = chosen.map((c,i)=>({ x:c.x-4, y:c.y-3, w:8, h:6, type: i===realIndex ? 'real' : 'fake', buried:true, dugProgress:0, found:false }));

        for(let i=0;i<120;i++) seaSprites.push({ x: randRange(0,WORLD_W), y: randRange(0,WORLD_H), dir: Math.random()>0.5?1:-1, speed: randRange(6,24), bobAmp: randRange(1,4), phase: Math.random()*Math.PI*2, type: Math.random()<0.7?'fish':'bubble' });
        for(let i=0;i<28;i++) waves.push({ x: randRange(worldCenter.x - 300, worldCenter.x + 300), y: randRange(worldCenter.y - 300, worldCenter.y + 300), t: Math.random()*10, speed: randRange(0.4,1.2), size: randRange(6,14) });

        spawnEnemiesForLevel(level);

        lastTime = performance.now();
        time = 0;

        updateHUD();
      }catch(err){
        log('ERROR generateLevelWrapper: ' + err);
      }
    }

    function updateHUD(){ hud.textContent = `Nivel ${currentLevel} — Tesoro: enterrado`; }

    // Drawing
    function worldToView(wx, wy){
      if(showFullIsland){
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for(let ty=0; ty<GRID_H; ty++) for(let tx=0; tx<GRID_W; tx++) if(landTiles[ty][tx]){ const wxc = tx*TILE_SIZE + TILE_SIZE/2, wyc = ty*TILE_SIZE + TILE_SIZE/2; if(wxc < minX) minX = wxc; if(wxc > maxX) maxX = wxc; if(wyc < minY) minY = wyc; if(wyc > maxY) maxY = wyc; }
        if(minX===Infinity){ minX = worldCenter.x - 220; minY = worldCenter.y - 140; maxX = worldCenter.x + 220; maxY = worldCenter.y + 140; }
        const pad = 20;
        const islandPixelWidth = (maxX - minX) + pad, islandPixelHeight = (maxY - minY) + pad;
        const fitX = BUF_W / islandPixelWidth, fitY = BUF_H / islandPixelHeight;
        const base = Math.min(fitX, fitY);
        zoom = clamp(base, 0.18, 1.0);
        const centerX = (minX + maxX)/2, centerY = (minY + maxY)/2;
        cam.x = centerX - (BUF_W / (2 * zoom));
        cam.y = centerY - (BUF_H / (2 * zoom));
      } else {
        zoom = 1.0;
        cam.x = player.x + player.w/2 - (BUF_W/2)/zoom;
        cam.y = player.y + player.h/2 - (BUF_H/2)/zoom;
      }
      cam.x = clamp(cam.x, 0, Math.max(0, WORLD_W - BUF_W/zoom));
      cam.y = clamp(cam.y, 0, Math.max(0, WORLD_H - BUF_H/zoom));
      if(!isFinite(cam.x)) cam.x = 0;
      if(!isFinite(cam.y)) cam.y = 0;
      return { x: Math.round((wx - cam.x) * zoom), y: Math.round((wy - cam.y) * zoom) };
    }
    let zoom = 1.0, cam = {x:0,y:0};

    function drawTileIsland(){
      bctx.fillStyle = '#2ea6ff'; bctx.fillRect(0,0,BUF_W,BUF_H);
      if(!landTiles){
        log('WARN: landTiles undefined — dibujando fallback visual.');
        const cx = Math.floor(BUF_W/2), cy = Math.floor(BUF_H/2), r = 18;
        for(let yy=-r; yy<=r; yy++) for(let xx=-r; xx<=r; xx++){ if(Math.hypot(xx,yy) <= r) setPixel(cx+xx, cy+yy, '#6ec26b'); }
        return;
      }
      for(let ty=0; ty<GRID_H; ty++){
        for(let tx=0; tx<GRID_W; tx++){
          if(landTiles[ty][tx]){
            let edge=false;
            for(let oy=-1; oy<=1; oy++) for(let ox=-1; ox<=1; ox++){
              if(ox===0 && oy===0) continue;
              const nx=tx+ox, ny=ty+oy;
              if(nx<0||nx>=GRID_W||ny<0||ny>=GRID_H || !landTiles[ny][nx]) edge=true;
            }
            const wx = tx*TILE_SIZE + 1, wy = ty*TILE_SIZE + 1;
            const v = worldToView(wx, wy);
            const tw = Math.max(1, Math.round(TILE_SIZE * zoom)), th = Math.max(1, Math.round(TILE_SIZE * zoom));
            if(edge) fillRectPixel(v.x, v.y, tw, th, '#f3e2b3', true); else fillRectPixel(v.x, v.y, tw, th, '#6ec26b', true);
          }
        }
      }
    }

    function fillRectPixel(x,y,w,h,color,outline=false){ bctx.fillStyle = color; bctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); if(outline){ bctx.fillStyle='#000'; bctx.fillRect(Math.round(x), Math.round(y)-1, Math.round(w), 1); bctx.fillRect(Math.round(x), Math.round(y)+Math.round(h), Math.round(w), 1); bctx.fillRect(Math.round(x)-1, Math.round(y), 1, Math.round(h)); bctx.fillRect(Math.round(x)+Math.round(w), Math.round(y), 1, Math.round(h)); } }
    function setPixel(x,y,color){ bctx.fillStyle = color; bctx.fillRect(Math.round(x), Math.round(y), 1, 1); }

    function drawPalm(px,py){ const v = worldToView(px,py); if(showFullIsland) fillRectPixel(v.x-1,v.y-1,2,2,'#2b8c3b',true); else { fillRectPixel(v.x-1,v.y-6,3,6,'#7a4f2a',true); fillRectPixel(v.x-4,v.y-8,3,2,'#2b8c3b',true); fillRectPixel(v.x+2,v.y-9,4,2,'#2b8c3b',true); fillRectPixel(v.x-2,v.y-10,5,2,'#2b8c3b',true); } }
    function drawBush(x,y){ const v=worldToView(x,y); if(showFullIsland) setPixel(v.x,v.y,'#3fa64a'); else fillRectPixel(v.x-3,v.y-1,6,3,'#3fa64a',true); }
    function drawRock(x,y){ const v=worldToView(x,y); if(showFullIsland) setPixel(v.x,v.y,'#8f8f8f'); else fillRectPixel(v.x-3,v.y-1,6,2,'#8f8f8f',true); }
    function drawPlayer(){ const v=worldToView(player.x,player.y); fillRectPixel(v.x-3, v.y+player.h+2, 7, 1, 'rgba(0,0,0,0.25)'); fillRectPixel(v.x-2, v.y+1, 5, 4, '#12343b', true); fillRectPixel(v.x-1, v.y-2, 3, 3, '#f8d6c2', true); fillRectPixel(v.x-2, v.y-3, 5, 2, '#e74c3c', true); setPixel(v.x, v.y-1, '#000'); setPixel(v.x+1, v.y-1, '#000'); }

    function drawAll(){
      bctx.fillStyle = '#9fd7ff'; bctx.fillRect(0,0,BUF_W,BUF_H);
      drawTileIsland();
      for(const r of rocks) drawRock(r.x, r.y);
      for(const b of bushes) drawBush(b.x, b.y);
      for(const p of palms) drawPalm(p.x, p.y);
      for(const s of seaSprites){ if(!isPointInIsland(s.x,s.y)){ const v=worldToView(s.x,s.y); if(v.x<-8||v.x>BUF_W+8||v.y<-8||v.y>BUF_H+8) continue; fillRectPixel(v.x,v.y,3,1,'#ffd54d',true); setPixel(v.x+2,v.y,'#000'); } }
      for(const w of waves){ const v=worldToView(w.x,w.y); setPixel(v.x,v.y,'rgba(255,255,255,0.9)'); }
      for(const it of buriedItems){ const v=worldToView(it.x,it.y); if(it.buried) fillRectPixel(v.x,v.y,Math.max(1,Math.round(4*zoom)),Math.max(1,Math.round(2*zoom)),'#b07b4a',true); else { if(it.type==='real'){ fillRectPixel(v.x,v.y,Math.max(1,Math.round(it.w*zoom)),Math.max(1,Math.round(it.h*zoom)),'#8c5a0b',true); fillRectPixel(v.x+1,v.y,Math.max(1,Math.round(2*zoom)),1,'#ffda7a',true); } else fillRectPixel(v.x,v.y,Math.max(1,Math.round(it.w*zoom)),Math.max(1,Math.round(it.h*zoom)),'#7a6f55',true); } }
      for(const e of enemies){ const v=worldToView(e.x,e.y); fillRectPixel(v.x-3,v.y+e.h+2,7,1,'rgba(0,0,0,0.25)'); fillRectPixel(v.x-2,v.y+1,5,4,'#2b6cf6',true); fillRectPixel(v.x-1,v.y-2,3,3,'#f8d6c2',true); fillRectPixel(v.x-2,v.y-3,5,2,'#3b82f6',true); setPixel(v.x,v.y-1,'#000'); setPixel(v.x+1,v.y-1,'#000'); }
      for(const a of arrows){ const v=worldToView(a.x,a.y); fillRectPixel(v.x-1,v.y,3,1,'#ffd54d',true); setPixel(v.x+2,v.y,'#000'); }
      for(const pt of particles){ const v=worldToView(pt.x,pt.y); const alpha = Math.max(0, Math.min(1, pt.life/pt.max)); fillRectPixel(Math.round(v.x), Math.round(v.y), 1, 1, 'rgba(255,255,255,'+alpha+')'); }
      drawPlayer();
      const near = findNearbyBuriedItem(14);
      if(near && near.buried){ const v = worldToView(near.x + near.w/2, near.y - 6); fillRectPixel(v.x-8, v.y-6, 16, 3, '#222'); fillRectPixel(v.x-7, v.y-5, Math.max(1, Math.round(14*(near.dugProgress/100))), 1, '#ffd65a', true); }
      sctx.clearRect(0,0,screen.width,screen.height);
      sctx.drawImage(buf,0,0,screen.width,screen.height);
    }

    // Digging helpers
    function findNearbyBuriedItem(pad){ for(const it of buriedItems){ const box={x:it.x,y:it.y,w:it.w,h:it.h}; const pbox={x:player.x,y:player.y,w:player.w,h:player.h}; if(rectIntersect(pbox, box, pad)) return it; } return null; }
    function handleDigging(dt){ const cfg = LEVELS[currentLevel-1] || LEVELS[0]; const it = findNearbyBuriedItem(14); if(!it){ hintEl.textContent=''; return; } if(it.buried) hintEl.textContent='Presiona ESPACIO para desenterrar'; else hintEl.textContent = it.type==='real'? 'Tesoro real: recógelo' : 'Objeto falso descubierto'; if(it.buried && (keys[' '] || keys['Spacebar'] || keys['Space'])){ it.dugProgress += (dt / cfg.digSeconds) * 100; if(it.dugProgress>100) it.dugProgress=100; } else it.dugProgress = Math.max(0, it.dugProgress - (6 * dt)); if(it.buried && it.dugProgress >= 100){ it.buried=false; it.found=true; if(it.type==='real'){ hud.textContent = `Nivel ${currentLevel} — Tesoro: descubierto`; for(let k=0;k<20;k++) particles.push({x:it.x + randRange(-6,6), y:it.y + randRange(-6,6), vx:randRange(-0.8,0.8), vy:randRange(-1.2,-0.2), size:1, life:0.8, max:0.8}); } else { for(let k=0;k<10;k++) particles.push({x:it.x + randRange(-4,4), y:it.y + randRange(-4,4), vx:randRange(-0.6,0.6), vy:randRange(-0.9,-0.2), size:1, life:0.6, max:0.6}); } } if(!it.buried && it.type==='real' && rectIntersect(player, {x:it.x,y:it.y,w:it.w,h:it.h}, 0)){ running=false; document.getElementById('levelTitle').textContent = `Nivel ${currentLevel} completado`; document.getElementById('levelMsg').textContent = currentLevel < MAX_LEVEL ? 'Puedes avanzar al siguiente nivel o repetir este nivel.' : 'Has completado el último nivel.'; document.getElementById('levelCompleteOverlay').style.display = 'flex'; } }

    // UI wiring
    document.getElementById('startBtn').onclick = ()=>{ document.getElementById('startOverlay').style.display='none'; currentLevel=1; generateLevelWrapper(currentLevel); running=true; paused=false; lastTime = performance.now(); requestAnimationFrame(loop); };
    document.getElementById('exitBtn').onclick = ()=>{ alert('Cierra la pestaña para salir.'); };
    document.getElementById('pauseBtn').onclick = ()=>{ if(!running) return; paused = !paused; document.getElementById('pauseBtn').textContent = paused? 'Reanudar' : 'Pausa'; };
    document.getElementById('zoomBtn').onclick = ()=>{ showFullIsland = !showFullIsland; document.getElementById('zoomBtn').textContent = showFullIsland? 'Seguir jugador' : 'Ver isla'; };
    document.getElementById('nextLevelBtn').onclick = ()=>{ document.getElementById('levelCompleteOverlay').style.display='none'; if(currentLevel < MAX_LEVEL){ currentLevel++; generateLevelWrapper(currentLevel); running=true; paused=false; lastTime = performance.now(); requestAnimationFrame(loop); } else { /* end */ } };
    document.getElementById('retryLevelBtn').onclick = ()=>{ document.getElementById('levelCompleteOverlay').style.display='none'; generateLevelWrapper(currentLevel); running=true; paused=false; lastTime = performance.now(); requestAnimationFrame(loop); };
    document.getElementById('deathOkBtn').onclick = ()=>{ document.getElementById('deathOverlay').style.display='none'; generateLevelWrapper(currentLevel); running=true; paused=false; lastTime = performance.now(); requestAnimationFrame(loop); };

    // init
    try{
      generateLevelWrapper(1);
      drawAll();
      log('Inicializado correctamente (vista previa).');
    }catch(err){
      log('ERROR init: ' + err);
    }

    // main loop
    function loop(ts){
      if(!running) return;
      if(!lastTime) lastTime = ts;
      const dtMs = Math.min(100, ts - lastTime);
      const dt = dtMs / 1000;
      lastTime = ts;
      if(!paused){
        try{ update(dt); } catch(err){ log('ERROR update loop: ' + err); }
      }
      try{ drawAll(); } catch(err){ log('ERROR drawAll: ' + err); }
      requestAnimationFrame(loop);
    }

    // update wrapper
    function update(dt){
      if(paused) return;
      time += dt;
      // player movement
      let mx=0,my=0;
      if(keys['ArrowLeft']) mx -= 1;
      if(keys['ArrowRight']) mx += 1;
      if(keys['ArrowUp']) my -= 1;
      if(keys['ArrowDown']) my += 1;
      if(mx!==0 && my!==0){ mx *= 0.7071; my *= 0.7071; }
      const footX = player.x + player.w/2, footY = player.y + player.h;
      const inWater = !isPointInIsland(footX, footY);
      const speed = player.speed * (inWater ? WATER_SLOW_MULT : 1.0);
      if(mx || my){
        const dx = mx * speed * dt, dy = my * speed * dt;
        tryMove(dx, dy);
        if(inWater && (!player._inWater || Math.random() < 0.04)) spawnSplash(footX, footY);
      }
      player._inWater = inWater;

      enemyUpdate(dt);

      // check physical collision with enemies (if enemy touches player -> restart)
      for(const e of enemies){
        if(rectIntersect({x:player.x,y:player.y,w:player.w,h:player.h}, {x:e.x,y:e.y,w:e.w,h:e.h})){
          log('Has sido tocado por un enemigo — reiniciando nivel.');
          generateLevelWrapper(currentLevel);
          running = true;
          paused = false;
          lastTime = performance.now();
          requestAnimationFrame(loop);
          return;
        }
      }

      updateArrows(dt);
      updateParticles(dt);
      updateSea(dt);
      handleDigging(dt);
    }

    // helper particle/sea
    function updateParticles(dt){ for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx*60*dt; p.y+=p.vy*60*dt; p.vy+=0.06*60*dt; p.life-=dt; if(p.life<=0) particles.splice(i,1); } }
    function updateSea(dt){ for(const s of seaSprites){ s.x += s.dir * s.speed * dt; s.y += Math.sin(time*1.2 + s.phase) * (s.bobAmp * 0.02); if(s.x < -40) s.x = WORLD_W + 40; if(s.x > WORLD_W + 40) s.x = -40; } for(const w of waves){ w.t += dt * w.speed; if(w.t > 10){ w.x = randRange(worldCenter.x - 300, worldCenter.x + 300); w.y = randRange(worldCenter.y - 300, worldCenter.y + 300); w.t = 0; } } }
    function spawnSplash(x,y){ for(let i=0;i<8;i++) particles.push({ x,y, vx: randRange(-0.8,0.8), vy: randRange(-1.4,-0.4), size: randRange(0.4,1.2), life:0.5+Math.random()*0.8, max: 0.5+Math.random()*0.8 }); }

    // shortcuts
    window.addEventListener('keydown', e=>{ if(e.key === 'p' || e.key === 'P') document.getElementById('pauseBtn').click(); if(e.key === 'z' || e.key === 'Z') document.getElementById('zoomBtn').click(); });

    // debug accessor
    window.__game = ()=>({ currentLevel, landCount: landTiles?countLandTiles(landTiles):0, enemies: enemies.length, arrows: arrows.length });

  })();
  </script>
</body>
</html>
