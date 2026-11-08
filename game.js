(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    playerHealth: document.getElementById('playerHealth'), enemyHealth: document.getElementById('enemyHealth'),
    playerMeter: document.getElementById('playerMeter'), enemyMeter: document.getElementById('enemyMeter'),
    timer: document.getElementById('timer'), status: document.getElementById('roundStatus'), overlay: document.getElementById('centerMessage'),
    start: document.getElementById('startButton'), restart: document.getElementById('restartButton'), flash: document.getElementById('hitFlash'), sound: document.getElementById('soundToggle')
  };
  const W = 960, H = 540, floor = 440;
  const keys = new Set(), pressed = new Set();
  let running = false, ended = false, soundOn = true, last = 0, elapsed = 0, timer = 60, shake = 0, hitstop = 0, audioCtx = null;
  let particles = [], projectiles = [], player, enemy;

  function makeFighter(name, x, facing, playerSide) {
    return {name, x, y:floor, vx:0, vy:0, facing, hp:100, meter:28, playerSide, grounded:true, action:'idle', actionT:0, cooldown:0, hitTarget:false, invuln:0, flash:0, combo:0, comboT:0, aiT:.5, walkT:0};
  }
  function reset() {
    player = makeFighter('KAI', 300, 1, true); enemy = makeFighter('BRICK', 660, -1, false);
    particles=[];projectiles=[];timer=60;elapsed=0;shake=0;hitstop=0;running=false;ended=false;
    ui.timer.textContent='60';ui.status.textContent='READY';ui.overlay.classList.remove('hidden');ui.start.querySelector('span').textContent='ENTER THE FIGHT';
    ui.overlay.querySelector('.message-kicker').textContent='ONE NIGHT. ONE ROOFTOP.';ui.overlay.querySelector('h1').innerHTML='NEON<br><em>CLASH</em>';ui.overlay.querySelector('p').textContent='Two fighters. No way out. Make your move.';
    updateHud();
  }
  function updateHud() {
    ui.playerHealth.style.width=Math.max(0,player.hp)+'%';ui.enemyHealth.style.width=Math.max(0,enemy.hp)+'%';
    ui.playerMeter.style.width=player.meter+'%';ui.enemyMeter.style.width=enemy.meter+'%';
    ui.timer.textContent=String(Math.ceil(timer)).padStart(2,'0');
  }
  function begin() { if(ended) reset(); running=true;ui.overlay.classList.add('hidden');ui.status.textContent='FIGHT!';ui.overlay.querySelector('.message-kicker').textContent='ONE NIGHT. ONE ROOFTOP.';ui.overlay.querySelector('h1').innerHTML='NEON<br><em>CLASH</em>';ui.overlay.querySelector('p').textContent='Two fighters. No way out. Make your move.';playTone(420,.08,'triangle'); }
  function setAction(f, action, duration, cooldown=duration) { f.action=action;f.actionT=duration;f.cooldown=Math.max(f.cooldown,cooldown);f.hitTarget=false; }
  function playTone(freq,duration=.08,type='sine') {
    if(!soundOn)return;
    try { audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.055,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration); } catch(_){ }
  }
  function emit(x,y,color,count=9,power=1) { for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=(1+Math.random()*4)*power;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:.3+Math.random()*.38,max:.68,size:2+Math.random()*4,color});} }
  function flash() { ui.flash.classList.remove('flash');void ui.flash.offsetWidth;ui.flash.classList.add('flash'); }
  function hit(attacker, target, damage, knock, color='#fff') {
    if(target.invuln>0)return;
    target.hp=Math.max(0,target.hp-damage);target.invuln=.32;target.flash=.18;target.vx=attacker.facing*knock;target.vy=-2.4;target.grounded=false;setAction(target,'hurt',.24,.24);
    attacker.meter=Math.min(100,attacker.meter+9);target.meter=Math.min(100,target.meter+4);attacker.combo++;attacker.comboT=1.1;
    emit(target.x,target.y-86,color,16,1.3);shake=7;hitstop=.055;playTone(145+Math.random()*60,.12,'sawtooth');flash();
    if(target.hp<=0)finish(attacker.playerSide);
  }
  function finish(playerWon) {
    if(ended)return;ended=true;running=false;ui.status.textContent=playerWon?'K.O.':'K.O.';
    ui.overlay.classList.remove('hidden');ui.start.querySelector('span').textContent=playerWon?'RUN IT BACK?':'TRY AGAIN';
    ui.overlay.querySelector('.message-kicker').textContent=playerWon?'ROOFTOP LEGEND':'THE NIGHT ISN’T OVER';
    ui.overlay.querySelector('h1').innerHTML=playerWon?'YOU<br><em>WIN</em>':'KNOCK<br><em>OUT</em>';
    ui.overlay.querySelector('p').textContent=playerWon?'Kai owns the skyline. That was clean.':'Brick takes the rooftop. One more round?';
    playTone(playerWon?620:110,.35,'triangle');
  }
  function attack(f, kind) {
    if(!running||f.cooldown>0||f.action==='hurt'||f.action==='dash')return;
    const foe=f===player?enemy:player;
    if(kind==='punch'){setAction(f,'punch',.32,.42);f.meter=Math.min(100,f.meter+2);playTone(300,.04);}
    else if(kind==='kick'){setAction(f,'kick',.48,.61);f.meter=Math.min(100,f.meter+3);playTone(240,.05);}
    else if(kind==='comet'){
      if(f.meter<22)return;f.meter-=22;setAction(f,'cast',.42,.78);
      projectiles.push({x:f.x+f.facing*44,y:f.y-99,vx:f.facing*470,life:2,owner:f,kind:'comet'});emit(f.x+f.facing*38,f.y-102,'#6cf6ff',7,1);playTone(520,.16,'sawtooth');
    } else if(kind==='rise'){
      if(f.meter<32)return;f.meter-=32;setAction(f,'rise',.62,.92);f.vy=-520;f.grounded=false;f.vx=f.facing*60;playTone(380,.2,'triangle');emit(f.x,f.y-55,'#ffb866',12,1.1);
      if(Math.abs(f.x-foe.x)<125)hit(f,foe,20,7,'#ffd178');
    } else if(kind==='blink'){
      if(f.meter<26)return;f.meter-=26;setAction(f,'dash',.32,.72);f.invuln=.3;f.vx=f.facing*590;emit(f.x,f.y-50,f.playerSide?'#63eaf0':'#ff715d',14,1.2);playTone(700,.1,'sine');
    }
  }
  function actKey(k) {
    if(k==='enter'||k===' '){if(!running)begin();return;}
    if(k==='escape'){if(running){running=false;ui.status.textContent='PAUSED';ui.overlay.classList.remove('hidden');ui.start.querySelector('span').textContent='RESUME FIGHT';ui.overlay.querySelector('.message-kicker').textContent='TAKE A BREATH';ui.overlay.querySelector('h1').innerHTML='PAUSE<br><em>BREAK</em>';ui.overlay.querySelector('p').textContent='Your rooftop duel is waiting.';}else if(!ended)begin();return;}
    if(!running)return;
    if(k==='j')attack(player,'punch');if(k==='k')attack(player,'kick');if(k==='q')attack(player,'comet');if(k==='e')attack(player,'rise');if(k==='r')attack(player,'blink');
  }
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup',' '].includes(k))e.preventDefault();if(!keys.has(k)){pressed.add(k);actKey(k);}keys.add(k);});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  ui.start.addEventListener('click',begin);ui.restart.addEventListener('click',reset);
  ui.sound.addEventListener('click',()=>{soundOn=!soundOn;ui.sound.querySelector('.sound-label').textContent=soundOn?'SOUND ON':'SOUND OFF';ui.sound.querySelector('.sound-icon').textContent=soundOn?'♪':'×';if(soundOn)playTone(500,.06);});
  document.querySelectorAll('[data-key]').forEach(btn=>{const k=btn.dataset.key;const down=e=>{e.preventDefault();if(!keys.has(k)){pressed.add(k);actKey(k);}keys.add(k);btn.classList.add('active');};const up=e=>{e.preventDefault();keys.delete(k);btn.classList.remove('active');};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);});

  function update(dt) {
    if(running){elapsed+=dt;timer=Math.max(0,60-elapsed);if(timer<=0){finish(player.hp>=enemy.hp);}
      updateFighter(player,dt,true);updateFighter(enemy,dt,false);updateProjectiles(dt);checkMelee(player,enemy);checkMelee(enemy,player);updateAI(dt);
      if(player.comboT>0)player.comboT-=dt;if(enemy.comboT>0)enemy.comboT-=dt;
    }
    particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.vy+=.12;});
    if(shake>0)shake=Math.max(0,shake-dt*32);if(hitstop>0)hitstop-=dt;updateHud();pressed.clear();
  }
  function updateFighter(f,dt,isPlayer) {
    if(f.cooldown>0)f.cooldown-=dt;if(f.invuln>0)f.invuln-=dt;if(f.flash>0)f.flash-=dt;
    if(f.actionT>0){f.actionT-=dt;if(f.actionT<=0&&['punch','kick','cast','rise','dash','hurt'].includes(f.action)){f.action='idle';f.actionT=0;}}
    if(isPlayer){const frozen=['punch','kick','cast','rise','hurt'].includes(f.action);if(!frozen){let speed=235;if(keys.has('a')||keys.has('arrowleft')){f.vx=-speed;f.facing=-1;f.walkT+=dt*10;}else if(keys.has('d')||keys.has('arrowright')){f.vx=speed;f.facing=1;f.walkT+=dt*10;}else if(f.action!=='dash'){f.vx*=Math.pow(.001,dt);if(Math.abs(f.vx)<8)f.vx=0;}
        if((keys.has('w')||keys.has('arrowup'))&&f.grounded&&f.action!=='dash'){f.vy=-510;f.grounded=false;f.action='jump';playTone(260,.06);}
      }}
    f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=1450*dt;
    if(f.y>=floor){f.y=floor;f.vy=0;f.grounded=true;if(f.action==='jump')f.action='idle';}
    f.x=Math.max(55,Math.min(W-55,f.x));
  }
  function checkMelee(a,b) {
    if(a.hitTarget||a.actionT<=0)return;
    let range=0,damage=0,window=false,knock=4,color='#fff';
    if(a.action==='punch'){range=95;damage=8;window=a.actionT<.21&&a.actionT>.07;knock=3.5;color='#d8fbff';}
    if(a.action==='kick'){range=119;damage=13;window=a.actionT<.30&&a.actionT>.11;knock=5;color='#ffc28c';}
    if(window&&Math.abs(a.x-b.x)<range&&Math.abs((a.y-85)-(b.y-85))<95&&a.facing===Math.sign(b.x-a.x)){a.hitTarget=true;hit(a,b,damage,knock,color);}
  }
  function updateProjectiles(dt) {
    projectiles=projectiles.filter(p=>p.life>0);
    for(const p of projectiles){p.x+=p.vx*dt;p.life-=dt;const foe=p.owner===player?enemy:player;if(Math.abs(p.x-foe.x)<34&&Math.abs(p.y-(foe.y-90))<54){hit(p.owner,foe,16,6,p.kind==='comet'?'#65f7ff':'#ff7755');p.life=0;emit(p.x,p.y,'#b7ffff',18,1.5);} }
  }
  function updateAI(dt) {
    if(!running||enemy.hp<=0)return;const d=player.x-enemy.x,ad=Math.abs(d);enemy.facing=d<0?-1:1;enemy.aiT-=dt;
    if(enemy.action==='hurt'||['punch','kick','cast','rise','dash'].includes(enemy.action))return;
    if(enemy.aiT>0)return;enemy.aiT=.28+Math.random()*.32;
    if(ad>190){if(Math.random()<.2&&enemy.meter>22)attack(enemy,'comet');else{enemy.vx=Math.sign(d)*145;enemy.action='idle';}}
    else if(ad>110){enemy.vx=Math.sign(d)*110;if(Math.random()<.45)attack(enemy,'kick');}
    else {enemy.vx=0;const r=Math.random();if(r<.42)attack(enemy,'punch');else if(r<.76)attack(enemy,'kick');else if(enemy.meter>32)attack(enemy,'rise');else if(Math.random()<.5)enemy.vx=-Math.sign(d)*120;}
  }

  function drawBackground() {
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#111925');g.addColorStop(.42,'#33243c');g.addColorStop(.72,'#b64750');g.addColorStop(1,'#e56b4f');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // moon and atmospheric glow
    const glow=ctx.createRadialGradient(690,147,8,690,147,210);glow.addColorStop(0,'#ffd79a44');glow.addColorStop(1,'#ffbd8500');ctx.fillStyle=glow;ctx.fillRect(440,0,500,370);
    ctx.fillStyle='#ffddb7';ctx.beginPath();ctx.arc(690,132,46,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ed8a7370';ctx.fillRect(0,286,W,2);
    // far skyline
    for(let i=0;i<17;i++){let x=i*64-14,w=43+(i%3)*8,h=90+(i*47%120),y=330-h;ctx.fillStyle=i%2?'#202337':'#252237';ctx.fillRect(x,y,w,h);ctx.fillStyle='#f6a66a';for(let wy=y+14;wy<326;wy+=19)for(let wx=x+8;wx<x+w-5;wx+=13)if(((wx+wy+i)%4)<2){ctx.globalAlpha=.22+((i+wy)%3)*.08;ctx.fillRect(wx,wy,4,7);}ctx.globalAlpha=1;}
    // signature neon signs
    sign(72,235,105,45,'HOTEL','NEON');sign(782,215,112,58,'NO SLEEP','CITY');
    // close rooftops
    ctx.fillStyle='#181b2a';ctx.beginPath();ctx.moveTo(0,348);ctx.lineTo(120,318);ctx.lineTo(239,350);ctx.lineTo(320,331);ctx.lineTo(390,355);ctx.lineTo(390,440);ctx.lineTo(0,440);ctx.fill();
    ctx.fillStyle='#232034';ctx.beginPath();ctx.moveTo(640,350);ctx.lineTo(750,324);ctx.lineTo(835,348);ctx.lineTo(960,313);ctx.lineTo(960,440);ctx.lineTo(640,440);ctx.fill();
    // railing and rooftop floor
    ctx.fillStyle='#252533';ctx.fillRect(0,385,W,13);ctx.fillStyle='#54505a';ctx.fillRect(0,385,W,2);ctx.fillStyle='#a4615b';ctx.fillRect(0,398,W,3);
    for(let x=14;x<W;x+=74){ctx.fillStyle='#8c5c61';ctx.fillRect(x,394,3,44);ctx.fillStyle='#ff8b67';ctx.fillRect(x,394,3,2);}
    const fg=ctx.createLinearGradient(0,410,0,H);fg.addColorStop(0,'#282637');fg.addColorStop(1,'#141824');ctx.fillStyle=fg;ctx.fillRect(0,400,W,H-400);
    ctx.fillStyle='#48404d';ctx.fillRect(0,439,W,3);ctx.strokeStyle='#4b3b49';ctx.lineWidth=1;for(let x=-100;x<1100;x+=95){ctx.beginPath();ctx.moveTo(480,440);ctx.lineTo(x,540);ctx.stroke();}ctx.strokeStyle='#413541';for(let y=464;y<550;y+=26){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // small puddle glints
    ctx.globalAlpha=.5;ctx.fillStyle='#70b8cb';ctx.fillRect(88,477,74,2);ctx.fillRect(744,501,105,2);ctx.fillStyle='#ff926c';ctx.fillRect(325,462,45,2);ctx.globalAlpha=1;
    const vignette=ctx.createRadialGradient(W/2,H/2,120,W/2,H/2,590);vignette.addColorStop(.55,'#090d1600');vignette.addColorStop(1,'#080b18b5');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  }
  function sign(x,y,w,h,line1,line2){ctx.fillStyle='#171725';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#f46172';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.shadowColor='#ff5a78';ctx.shadowBlur=14;ctx.fillStyle='#ffb3a5';ctx.textAlign='center';ctx.font='800 16px Barlow Condensed, sans-serif';ctx.fillText(line1,x+w/2,y+20);ctx.fillStyle='#ff7588';ctx.font='900 22px Barlow Condensed, sans-serif';ctx.fillText(line2,x+w/2,y+42);ctx.shadowBlur=0;ctx.textAlign='left';}
  function line(points,color,width=12,outline='#171925') {
    ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
    ctx.strokeStyle=outline;ctx.lineWidth=width+5;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function drawFighter(f) {
    const moving=Math.abs(f.vx)>35, bob=f.grounded&&f.action==='idle'?Math.sin(elapsed*5+(f.playerSide?0:1))*2:0;
    const isKai=f.playerSide, skin=isKai?'#d89b78':'#be8067', shirt=isKai?'#e7e5df':'#8c3941', dark=isKai?'#252b3b':'#24232d', accent=isKai?'#48d6df':'#d9aa62';
    const x=f.x, y=f.y+bob;ctx.save();ctx.translate(x,y);ctx.scale(f.facing,1);
    // shadow
    ctx.save();ctx.scale(1,.27);ctx.fillStyle='#080b13aa';ctx.beginPath();ctx.ellipse(0,0,45,19,0,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.translate(0,-(f.grounded?0:Math.min(14,(floor-f.y)*.04)));
    let frontArm=[ [13,-108],[28,-97],[16,-87] ], backArm=[[-14,-107],[-29,-96],[-18,-86]], legsA=[[-8,-62],[-13,-34],[-19,-10]], legsB=[[8,-62],[14,-33],[19,-10]];
    if(f.action==='punch'){frontArm=[[13,-109],[36,-107],[66,-104]];backArm=[[-14,-105],[-28,-93],[-30,-79]];}
    if(f.action==='kick'){legsB=[[8,-61],[21,-62],[57,-70]];frontArm=[[13,-109],[31,-97],[39,-84]];}
    if(f.action==='rise'){frontArm=[[13,-108],[27,-126],[30,-151]];backArm=[[-14,-105],[-26,-125],[-30,-149]];legsB=[[8,-61],[19,-48],[32,-26]];}
    if(f.action==='cast'){frontArm=[[13,-109],[33,-109],[55,-111]];backArm=[[-14,-105],[-5,-101],[20,-105]];}
    if(f.action==='dash'){frontArm=[[13,-109],[34,-98],[47,-91]];backArm=[[-14,-105],[-31,-93],[-39,-86]];}
    const runningLeg=moving?Math.sin(f.walkT)*12:0;if(f.action==='idle'||f.action==='jump'){if(moving){legsA[1][0]-=runningLeg*.45;legsA[1][1]+=Math.abs(runningLeg)*.18;legsB[1][0]+=runningLeg*.45;legsB[1][1]-=Math.abs(runningLeg)*.15;}}
    // back limbs
    line(legsA,dark,14);line(legsB,dark,14);
    // boots
    ctx.fillStyle=isKai?'#f0ede7':'#4a252a';ctx.beginPath();ctx.ellipse(-20,-8,15,7,-.12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(19,-8,15,7,.1,0,Math.PI*2);ctx.fill();
    // shin wraps
    ctx.fillStyle=accent;ctx.fillRect(-21,-37,15,5);ctx.fillRect(7,-37,15,5);
    // back arm then body
    line(backArm,dark,13);ctx.fillStyle=skin;ctx.beginPath();ctx.arc(backArm[2][0],backArm[2][1],7,0,Math.PI*2);ctx.fill();
    // torso silhouette
    ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-17,-119);ctx.lineTo(15,-119);ctx.lineTo(22,-79);ctx.lineTo(13,-57);ctx.lineTo(-14,-57);ctx.lineTo(-23,-80);ctx.closePath();ctx.fill();
    ctx.fillStyle=shirt;ctx.beginPath();ctx.moveTo(-14,-116);ctx.lineTo(13,-116);ctx.lineTo(17,-82);ctx.lineTo(10,-63);ctx.lineTo(-11,-63);ctx.lineTo(-18,-82);ctx.closePath();ctx.fill();
    // chest and belt accents
    ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(-13,-108);ctx.lineTo(-4,-112);ctx.lineTo(9,-80);ctx.lineTo(2,-77);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e9d8bd';ctx.fillRect(-14,-66,29,6);ctx.fillStyle='#222633';ctx.fillRect(-2,-67,7,8);
    // neck and head
    ctx.fillStyle=skin;ctx.fillRect(-6,-126,12,12);ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-140,15,19,-.08,0,Math.PI*2);ctx.fill();
    // hair/headband and facial details
    ctx.fillStyle=isKai?'#24232c':'#26232a';ctx.beginPath();ctx.moveTo(-15,-143);ctx.lineTo(-14,-156);ctx.lineTo(-3,-162);ctx.lineTo(8,-157);ctx.lineTo(15,-146);ctx.lineTo(7,-150);ctx.lineTo(-2,-153);ctx.lineTo(-8,-147);ctx.closePath();ctx.fill();
    if(isKai){ctx.fillStyle='#ff784e';ctx.beginPath();ctx.moveTo(-14,-151);ctx.lineTo(-6,-155);ctx.lineTo(12,-151);ctx.lineTo(13,-146);ctx.lineTo(-7,-149);ctx.closePath();ctx.fill();ctx.fillStyle='#ff764c';ctx.beginPath();ctx.moveTo(-9,-153);ctx.lineTo(-24,-162);ctx.lineTo(-16,-149);ctx.fill();}
    ctx.fillStyle='#28212a';ctx.fillRect(4,-141,5,2);ctx.fillStyle='#fff4d8';ctx.fillRect(6,-141,2,2);
    // front arm on top
    line(frontArm,dark,14);ctx.fillStyle=skin;ctx.beginPath();ctx.arc(frontArm[2][0],frontArm[2][1],8,0,Math.PI*2);ctx.fill();
    // gloves and wraps
    ctx.fillStyle=isKai?'#4ccad5':'#d8a654';ctx.beginPath();ctx.ellipse(frontArm[2][0]+2,frontArm[2][1],10,7,0,0,Math.PI*2);ctx.fill();
    if(isKai){ctx.fillStyle='#ff774d';ctx.beginPath();ctx.moveTo(-17,-95);ctx.lineTo(-43,-91);ctx.lineTo(-55,-86);ctx.lineTo(-37,-96);ctx.lineTo(-17,-102);ctx.fill();}
    // action aura/impact glint
    if(f.action==='cast'){ctx.shadowColor='#69f7ff';ctx.shadowBlur=22;ctx.strokeStyle='#89ffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(57,-111,12,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
    if(f.flash>0){ctx.globalCompositeOperation='screen';ctx.fillStyle='#fff';ctx.globalAlpha=.6;ctx.fillRect(-23,-159,47,151);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
    ctx.restore();
  }
  function drawProjectiles() {
    for(const p of projectiles){const c=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,29);c.addColorStop(0,'#eaffff');c.addColorStop(.24,'#8effff');c.addColorStop(1,'#23bbff00');ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,29,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e2ffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.4;ctx.strokeStyle='#73f7ff';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(p.x-p.vx*.12,p.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.globalAlpha=1;}
  }
  function drawParticles() { for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=10;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.shadowBlur=0;}ctx.globalAlpha=1; }
  function drawCombo(f) {if(f.comboT<=0||f.combo<2)return;ctx.save();ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=8;ctx.fillStyle=f.playerSide?'#ffb16d':'#78e9ee';ctx.font='900 27px Barlow Condensed, sans-serif';ctx.fillText(f.combo+' HIT!',f.x,f.y-196);ctx.restore();}
  function render() {
    ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawBackground();
    // stage accent pools beneath fighters
    for(const f of [player,enemy]){const color=f.playerSide?'#4ee5eb':'#ff715d';const glow=ctx.createRadialGradient(f.x,floor,2,f.x,floor,75);glow.addColorStop(0,color+'44');glow.addColorStop(1,color+'00');ctx.fillStyle=glow;ctx.fillRect(f.x-80,floor-12,160,40);}
    // Draw the higher fighter first for readable depth
    const order=[player,enemy].sort((a,b)=>a.y-b.y);order.forEach(drawFighter);drawProjectiles();drawParticles();drawCombo(player);drawCombo(enemy);
    if(!running&&!ended){ctx.fillStyle='#d8edf0';ctx.globalAlpha=.45;ctx.font='700 9px DM Sans';ctx.fillText('READY?',W/2-21,476);ctx.globalAlpha=1;}
    ctx.restore();
  }
  function loop(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;if(hitstop<=0)update(dt);else {hitstop-=dt;updateHud();}render();requestAnimationFrame(loop);}
  reset();requestAnimationFrame(loop);
})();
