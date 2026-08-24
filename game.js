'use strict';
/* ============================================================
 * 淞沪血战 · 外滩1937 —— 手机端伪3D射击游戏
 * 玩法致敬《血战上海滩》：固定视角、敌人从街道远端冲来、
 * 拖动瞄准射击、可拦截敌弹、爆头双倍伤害、波次推进 + 战车BOSS
 * 纯 Canvas 实现，无任何外部资源依赖。
 * ============================================================ */

/* ---------------- 工具函数 ---------------- */
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,k)=>a+(b-a)*k;
const rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
function seedRandom(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};}
function roundPath(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
/* 本地存档安全封装：file:// 或隐私模式下 localStorage 可能被禁用，不能让它拖垮整个游戏 */
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}

/* ---------------- 画布 ---------------- */
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
let dpr=1,W=0,H=0,HORIZON=0,F=0;
const EYE=1.5;

/* ---------------- DOM ---------------- */
const ids=['menu','help','intro','clear','over','win','pause','btnPause','btnGrenade','btnFire','grenadeCount',
'btnStart','btnHelp','btnHelpBack','btnSound','btnAuto','menuBest','introTitle','introSub','btnIntroStart',
'clearTitle','clearScore','btnClearNext','overScore','btnRetry','btnMenu2','winScore','btnAgain','btnMenu3',
'btnResume','btnRestart','btnMenuP'];
const els={}; ids.forEach(id=>els[id]=document.getElementById(id));

/* ---------------- 全局状态 ---------------- */
const WEAPONS=[
 {name:'盒子炮',rate:4.5,dmg:8,spread:10,mag:999,reload:0.15,infinite:true,tracer:1},
 {name:'花机关 MP18',rate:11,dmg:9,spread:26,mag:32,reload:1.3,infinite:false,tracer:1},
 {name:'中正式步枪',rate:1.7,dmg:45,spread:5,mag:5,reload:1.7,infinite:false,tracer:2},
 {name:'捷克式轻机枪',rate:16,dmg:7,spread:55,mag:75,reload:2.4,infinite:false,tracer:1},
];
const DEF={
 rifleman:{hp:30,speed:1.7,w:0.72,h:1.75,score:100,dmg:7,fireCD:2.8,fireRange:9,hold:2.3,drop:0.16,name:'日军步兵'},
 charger:{hp:22,speed:3.6,w:0.70,h:1.72,score:120,dmg:12,melee:true,hold:1.35,drop:0.14,name:'突击兵'},
 mg:{hp:60,speed:1.1,w:0.85,h:1.78,score:150,dmg:6,fireCD:1.05,fireRange:12,hold:4.2,drop:0.30,name:'机枪手'},
 grenadier:{hp:36,speed:1.6,w:0.74,h:1.75,score:150,dmg:0,throwCD:3.6,fireRange:12,hold:6.5,drop:0.35,name:'掷弹兵'},
 officer:{hp:75,speed:1.5,w:0.76,h:1.80,score:300,dmg:9,fireCD:1.7,fireRange:10,hold:3.4,drop:0.60,name:'日军军官'},
};
const TANK={hp:650,speed:0.55,shellCD:4.5,shellDmg:14,supportCD:10,score:2000,name:'九七式战车'};

/* 敌人随机姓名池：每个敌人顶上一行随机名字 */
const NAME_POOL=['孙弋博','孙海涛','张杨煦','李昭延','杜鹏飞','刘金荣','杨程文'];
let nameCycle=[],nameIdx=0;
function nextName(){
  if(nameCycle.length===0){
    nameCycle=NAME_POOL.slice();
    for(let i=nameCycle.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const tmp=nameCycle[i];nameCycle[i]=nameCycle[j];nameCycle[j]=tmp;}
    nameIdx=0;
  }
  return nameCycle[nameIdx++%nameCycle.length];
}

function mk(type,count,xr,zr,step){const arr=[];for(let i=0;i<count;i++)arr.push({t:step*i+rand(0,step*0.6),type,x:rand(-xr,xr),z:rand(zr-6,zr)});return arr;}

const LEVELS=[
 {name:'第一关 · 外滩防线',sub:'1937年8月，日军进犯上海。保卫外滩，寸土不让！',waves:[
   [...mk('rifleman',7,4.5,46,1.5),...mk('charger',3,4,50,2.5)],
   [...mk('rifleman',6,4.5,46,1.2),...mk('charger',4,4,50,1.9),...mk('rifleman',2,3,42,2.0)],
   [...mk('rifleman',6,4.5,46,1.1),...mk('charger',5,4.5,50,1.6),...mk('rifleman',3,3.5,42,1.8)],
 ]},
 {name:'第二关 · 南京路巷战',sub:'敌军增援赶到，机枪与掷弹兵登场，火力凶猛！',waves:[
   [...mk('rifleman',6,4.5,46,1.2),...mk('charger',4,4.5,50,1.8)],
   [...mk('mg',3,4,44,2.2),...mk('rifleman',5,4.5,46,1.3)],
   [...mk('charger',5,4.5,50,1.4),...mk('grenadier',3,4,44,2.6),...mk('mg',2,4,44,3.0)],
   [...mk('rifleman',5,4.5,46,1.1),...mk('charger',4,4.5,48,1.5),...mk('mg',2,4,44,2.4),...mk('grenadier',2,3.5,44,3.0)],
 ]},
 {name:'第三关 · 四行仓库',sub:'最后的阵地！敌军军官督战，敌战车逼近——',waves:[
   [...mk('rifleman',6,4.5,46,1.2),...mk('charger',5,4.5,48,1.5),...mk('mg',2,4,44,2.8)],
   [...mk('grenadier',4,4,44,2.4),...mk('mg',3,4,44,2.2),...mk('officer',1,2,42,0)],
   [...mk('rifleman',6,4.5,46,1.0),...mk('charger',5,4.5,48,1.3),...mk('mg',2,4,44,2.2),...mk('officer',2,3,44,2.5)],
   [...mk('rifleman',4,4,46,1.8),{t:2.5,type:'tank',x:0,z:36}],
 ]},
];

const G={
 state:'menu',level:0,wave:0,score:0,best:+(lsGet('songhuBest')||0),
 hp:100,weapon:0,mag:WEAPONS[0].mag,reserve:150,grenades:3,
 fireCd:0,reloadT:0,reloadDur:0,throwCd:0,
 aim:{x:0,y:0},aimT:{x:0,y:0},firing:false,btnFire:false,autofire:true,
 aimRecoil:{x:0,y:0},hitmark:0,muzzle:0,shake:0,flashRed:0,
 banner:'',bannerSub:'',bannerT:0,bannerLife:2.2,
};
let enemies=[],bullets=[],grenades=[],pickups=[],parts=[],texts=[],decals=[],props=[];
let tank=null,spawnQueue=[],spawnTimer=0;
let menuEnemies=[],truckFxT=0;
let time=0;
let mute=lsGet('songhuMute')==='1';

/* ---------------- 音频 ---------------- */
let AC=null,master=null,musicGain=null,noiseBuf=null,musicTimer=null,musicStep=0,nextNoteT=0;
function initAudio(){
  if(AC){if(AC.state==='suspended')AC.resume();return;}
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain();master.gain.value=mute?0:0.5;
    const comp=AC.createDynamicsCompressor();master.connect(comp);comp.connect(AC.destination);
    noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    musicGain=AC.createGain();musicGain.gain.value=0.22;musicGain.connect(master);
  }catch(e){}
}
function noise(dur,type,f0,f1,gain,when){
  if(!AC)return;const t=AC.currentTime+(when||0);
  const src=AC.createBufferSource();src.buffer=noiseBuf;src.loop=true;
  const fl=AC.createBiquadFilter();fl.type=type||'lowpass';
  fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(Math.max(f1,40),t+dur);
  const gn=AC.createGain();gn.gain.setValueAtTime(gain,t);gn.gain.exponentialRampToValueAtTime(0.001,t+dur);
  src.connect(fl);fl.connect(gn);gn.connect(master);
  src.start(t);src.stop(t+dur+0.02);
}
function tone(type,f0,f1,dur,gain,when){
  if(!AC)return;const t=AC.currentTime+(when||0);
  const o=AC.createOscillator();o.type=type;
  o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(f1,20),t+dur);
  const gn=AC.createGain();gn.gain.setValueAtTime(gain,t);gn.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(gn);gn.connect(master);o.start(t);o.stop(t+dur+0.02);
}
const SFX={
 shot(w){if(!AC)return;
  if(w===2){noise(0.16,'lowpass',1800,300,0.5);tone('square',140,60,0.14,0.25);}
  else if(w===3){noise(0.09,'bandpass',2600,900,0.4);tone('square',190,120,0.05,0.18);}
  else if(w===1){noise(0.07,'bandpass',2400,1000,0.42);tone('square',210,150,0.05,0.15);}
  else{noise(0.11,'lowpass',1600,400,0.45);tone('square',150,80,0.09,0.2);}},
 hit(){tone('square',900,500,0.05,0.2);noise(0.03,'highpass',2000,2000,0.15);},
 head(){tone('square',1500,800,0.07,0.25);tone('triangle',1000,600,0.08,0.2,0.03);},
 kill(){noise(0.12,'lowpass',900,200,0.35);tone('sawtooth',300,70,0.14,0.2);},
 hurt(){tone('sine',110,50,0.18,0.5);noise(0.12,'lowpass',600,150,0.3);},
 explode(){noise(0.6,'lowpass',900,60,0.65);tone('sine',70,28,0.5,0.6);tone('sawtooth',120,40,0.25,0.15);},
 reload(){tone('square',420,300,0.05,0.2);tone('square',300,220,0.05,0.2,0.35);},
 pickup(){tone('triangle',600,900,0.09,0.25);tone('triangle',900,1300,0.1,0.22,0.08);},
 throw(){noise(0.25,'bandpass',400,1800,0.3);},
 wave(){tone('sawtooth',110,110,0.35,0.2);tone('sawtooth',165,165,0.35,0.15,0.15);},
 boss(){tone('sawtooth',70,60,0.8,0.3);tone('sawtooth',105,90,0.8,0.2,0.1);tone('sawtooth',140,120,0.8,0.15,0.2);},
 over(){tone('sawtooth',300,220,0.4,0.25);tone('sawtooth',220,150,0.4,0.25,0.35);tone('sawtooth',150,80,0.7,0.25,0.7);},
 win(){[523,659,784,1047].forEach((f,i)=>tone('triangle',f,f,0.3,0.25,i*0.16));},
 ui(){tone('square',600,400,0.04,0.15);},
};
function setMute(m){mute=m;lsSet('songhuMute',m?'1':'0');if(master)master.gain.value=m?0:0.5;}
function toggleMuteUI(){setMute(!mute);SFX.ui();}
function startMusic(){
  if(!AC||musicTimer)return;
  musicStep=0;nextNoteT=AC.currentTime+0.1;
  musicTimer=setInterval(scheduleMusic,100);
}
function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}}
function scheduleMusic(){
  if(!AC)return;
  const beat=60/120;
  while(nextNoteT<AC.currentTime+0.3){
    const s=musicStep%16;
    if(s%4===0)musicTone(1,nextNoteT);
    if(s===4||s===12)musicTone(2,nextNoteT);
    if(s%2===1)musicTone(3,nextNoteT);
    if(s===0||s===8)musicTone(4,nextNoteT);
    musicStep++;nextNoteT+=beat/2;
  }
}
function musicTone(kind,when){
  if(!AC)return;const t=when;
  if(kind===1){const o=AC.createOscillator();o.type='sine';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+0.12);
    const g=AC.createGain();g.gain.setValueAtTime(0.9,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.14);
    o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+0.16);}
  if(kind===2){noise(0.1,'bandpass',1800,900,0.4,t-AC.currentTime);}
  if(kind===3){noise(0.03,'highpass',5000,5000,0.12,t-AC.currentTime);}
  if(kind===4){const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=55;
    const fl=AC.createBiquadFilter();fl.type='lowpass';fl.frequency.value=300;
    const g=AC.createGain();g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.001,t+1.8);
    o.connect(fl);fl.connect(g);g.connect(musicGain);o.start(t);o.stop(t+1.9);}
}
const vib=ms=>{try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}};

/* ---------------- 投影 ---------------- */
function proj(x,y,z){
  const s=F/z;
  return {x:W/2+x*s,y:HORIZON+(EYE-y)*s,s};
}

/* ---------------- 精灵(程序化绘制士兵) ---------------- */
const SPR={};
function drawSoldier(c,type,phase){
  const legSwing=Math.sin(phase*Math.PI/2);
  const bob=-Math.abs(legSwing)*2.5;
  const armSwing=legSwing*3;
  const U='#9a8a55',UD='#7d7045',B='#3a3028',S='#e0b98c',HL='#5a6838';
  c.clearRect(0,0,180,260);
  const hipY=150+bob;
  function leg(side,swing){
    const lift=Math.max(0,swing*11);
    const h=(248-lift)-hipY;
    c.fillStyle=UD;c.fillRect(90+side*12-7,hipY,14,Math.max(h-12,6));
    c.fillStyle=B;c.fillRect(90+side*12-7,248-lift-12,14,12);
  }
  leg(-1,legSwing);leg(1,-legSwing);
  if(type==='mg'){c.fillStyle='#6b5a35';c.fillRect(90-19,92,38,26);c.fillStyle='rgba(0,0,0,.2)';c.fillRect(90-19,92,38,5);}
  c.fillStyle=U;
  c.beginPath();c.moveTo(90-20,96);c.lineTo(90+20,96);c.lineTo(90+15,150);c.lineTo(90-15,150);c.closePath();c.fill();
  c.fillStyle='rgba(0,0,0,0.15)';c.fillRect(90-15,140,30,12);
  c.fillStyle='#4a4028';c.fillRect(90-15,146,30,7);
  c.strokeStyle=U;c.lineWidth=11;c.lineCap='round';
  if(type==='rifleman'){
    c.fillStyle='#5a4428';c.fillRect(90-52,114,104,9);
    c.fillStyle='#333';c.fillRect(90+30,114,24,9);
    c.strokeStyle=UD;
    c.beginPath();c.moveTo(90-16,104+armSwing);c.lineTo(90-32,116);c.stroke();
    c.beginPath();c.moveTo(90+16,104-armSwing);c.lineTo(90+30,116);c.stroke();
    c.fillStyle=S;c.beginPath();c.arc(90-32,116,6,0,TAU);c.fill();c.beginPath();c.arc(90+30,116,6,0,TAU);c.fill();
  }else if(type==='charger'){
    c.save();c.translate(90,116);c.rotate(-0.5);
    c.fillStyle='#5a4428';c.fillRect(-46,-5,74,10);
    c.fillStyle='#cfcfcf';c.fillRect(28,-5,26,10);
    c.restore();
    c.strokeStyle=UD;
    c.beginPath();c.moveTo(90-16,106+armSwing);c.lineTo(90-36,122);c.stroke();
    c.beginPath();c.moveTo(90+16,104-armSwing);c.lineTo(90+40,108);c.stroke();
    c.fillStyle=S;c.beginPath();c.arc(90-36,122,6,0,TAU);c.fill();c.beginPath();c.arc(90+40,108,6,0,TAU);c.fill();
  }else if(type==='mg'){
    c.fillStyle='#222';c.fillRect(90-58,116,116,11);
    c.fillStyle='#2f2f2f';c.beginPath();c.arc(90+8,130,9,0,TAU);c.fill();
    c.fillStyle='#555';c.fillRect(90+8,128,2,14);
    c.strokeStyle=UD;
    c.beginPath();c.moveTo(90-16,104+armSwing);c.lineTo(90-34,120);c.stroke();
    c.beginPath();c.moveTo(90+16,104-armSwing);c.lineTo(90+30,120);c.stroke();
    c.fillStyle=S;c.beginPath();c.arc(90-34,120,6,0,TAU);c.fill();c.beginPath();c.arc(90+30,120,6,0,TAU);c.fill();
  }else if(type==='grenadier'){
    c.strokeStyle=UD;
    c.beginPath();c.moveTo(90-18,106+armSwing);c.lineTo(90-30,140);c.stroke();
    c.beginPath();c.moveTo(90+18,102);c.lineTo(90+42,66);c.stroke();
    c.fillStyle=S;c.beginPath();c.arc(90-30,140,6,0,TAU);c.fill();
    c.fillStyle='#2d2d2d';c.beginPath();c.arc(90+44,62,6,0,TAU);c.fill();
  }else if(type==='officer'){
    c.strokeStyle=UD;
    c.beginPath();c.moveTo(90-16,104+armSwing);c.lineTo(90-30,122);c.stroke();
    c.beginPath();c.moveTo(90+16,104-armSwing);c.lineTo(90+40,104);c.stroke();
    c.fillStyle=S;c.beginPath();c.arc(90-30,122,6,0,TAU);c.fill();c.beginPath();c.arc(90+40,104,6,0,TAU);c.fill();
    c.strokeStyle='#6b5a35';c.lineWidth=6;
    c.beginPath();c.moveTo(90-24,128);c.lineTo(90-18,190);c.stroke();
    c.fillStyle='#222';c.fillRect(90+40,98,20,8);
  }
  c.fillStyle=S;c.fillRect(90-7,82,14,12);
  c.beginPath();c.arc(90,68,13,0,TAU);c.fill();
  if(type==='officer'){
    c.fillStyle='#3f4a2a';c.beginPath();c.arc(90,58,15,Math.PI,0);c.closePath();c.fill();
    c.fillStyle='#33401f';c.beginPath();c.ellipse(90,62,20,6,0,0,TAU);c.fill();
    c.fillStyle='#5a6838';c.fillRect(90-6,52,12,4);
  }else{
    c.fillStyle=HL;c.beginPath();c.arc(90,58,15,Math.PI,0);c.closePath();c.fill();
    c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(90,66,15,6,0,0,TAU);c.fill();
    c.fillStyle='#4a4a2a';c.fillRect(90-14,76,28,3);
    if(type==='charger'){c.fillStyle='#e8e0c0';c.fillRect(90-14,46,28,6);}
  }
  c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(90,72,10,5,0,0,TAU);c.fill();
  if(type==='officer'){c.fillStyle='#4a3a2a';c.fillRect(90-8,74,16,3);}
}
function buildSprites(){
  ['rifleman','charger','mg','grenadier','officer'].forEach(t=>{
    SPR[t]=[];
    for(let f=0;f<4;f++){
      const cv=document.createElement('canvas');cv.width=180;cv.height=260;
      drawSoldier(cv.getContext('2d'),t,f);
      SPR[t].push(cv);
    }
  });
}

/* ---------------- 背景 ---------------- */
let bgCanvas=null,vigCanvas=null;
function buildBackground(){
  bgCanvas=document.createElement('canvas');bgCanvas.width=Math.round(W*dpr);bgCanvas.height=Math.round(H*dpr);
  const c=bgCanvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  const w=W,h=H,hor=HORIZON,rng=seedRandom(7);
  const sky=c.createLinearGradient(0,0,0,hor);
  sky.addColorStop(0,'#1d2129');sky.addColorStop(0.55,'#3c3a34');sky.addColorStop(1,'#8a6a45');
  c.fillStyle=sky;c.fillRect(0,0,w,hor+1);
  c.fillStyle='rgba(180,60,40,0.35)';c.beginPath();c.arc(w*0.72,hor-6,h*0.05,0,TAU);c.fill();
  c.fillStyle='rgba(30,28,26,0.5)';
  for(let i=0;i<6;i++){const x=(i*137+w*0.1)%w,y=hor-rand(10,60),r=rand(30,90);c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
  c.fillStyle='#14161c';
  let x=0;
  while(x<w){
    const bw=40+rng()*70,bh=20+rng()*50;
    c.fillRect(x,hor-bh,bw,bh+2);
    if(rng()<0.25){
      const tw=18+rng()*12,th=30+rng()*30;
      c.fillRect(x+bw/2-tw/2,hor-bh-th,tw,th+2);
      c.beginPath();c.moveTo(x+bw/2-tw/2,hor-bh-th);c.lineTo(x+bw/2+tw/2,hor-bh-th);c.lineTo(x+bw/2,hor-bh-th-rand(12,22));c.closePath();c.fill();
    }
    x+=bw+rand(2,10);
  }
  const cx=w*0.62;
  c.fillRect(cx-26,hor-120,52,122);
  c.fillRect(cx-34,hor-132,68,14);
  c.beginPath();c.moveTo(cx-26,hor-120);c.lineTo(cx+26,hor-120);c.lineTo(cx,hor-152);c.closePath();c.fill();
  c.fillStyle='#3a332a';c.fillRect(cx-7,hor-140,14,20);
  c.fillStyle='#3b3b38';c.fillRect(0,hor,w,h-hor+2);
  const sideGrad=c.createLinearGradient(0,hor,0,h);
  sideGrad.addColorStop(0,'#55503f');sideGrad.addColorStop(1,'#4a4636');
  c.fillStyle=sideGrad;
  c.beginPath();c.moveTo(0,hor);c.lineTo(w*0.16,hor);c.lineTo(w*0.05,h);c.lineTo(0,h);c.closePath();c.fill();
  c.beginPath();c.moveTo(w,hor);c.lineTo(w*0.84,hor);c.lineTo(w*0.95,h);c.lineTo(w,h);c.closePath();c.fill();
  c.strokeStyle='rgba(220,200,140,0.25)';c.lineWidth=2;
  c.beginPath();c.moveTo(w*0.16,hor);c.lineTo(w*0.05,h);c.stroke();
  c.beginPath();c.moveTo(w*0.84,hor);c.lineTo(w*0.95,h);c.stroke();
  c.strokeStyle='rgba(0,0,0,0.13)';c.lineWidth=1;
  for(let k=0;k<=10;k++){
    const bx=w/2+(k-5)*w*0.28;
    c.beginPath();c.moveTo(w/2,hor);c.lineTo(bx,h);c.stroke();
  }
  c.strokeStyle='rgba(255,255,255,0.05)';c.lineWidth=1;
  for(let n=1;n<=10;n++){
    const t=n*n/100,y=hor+(h-hor)*t;
    const lx=lerp(w*0.16,w*0.05,t),rx=lerp(w*0.84,w*0.95,t);
    c.beginPath();c.moveTo(lx,y);c.lineTo(rx,y);c.stroke();
  }
  c.strokeStyle='rgba(0,0,0,0.25)';c.lineWidth=3;
  c.beginPath();c.moveTo(w/2-90,h);c.lineTo(w/2-14,hor);c.stroke();
  c.beginPath();c.moveTo(w/2+90,h);c.lineTo(w/2+14,hor);c.stroke();
}
function buildVignette(){
  vigCanvas=document.createElement('canvas');vigCanvas.width=Math.round(W*dpr);vigCanvas.height=Math.round(H*dpr);
  const c=vigCanvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  const g=c.createRadialGradient(W/2,H/2,Math.min(W,H)*0.45,W/2,H/2,Math.max(W,H)*0.75);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.5)');
  c.fillStyle=g;c.fillRect(0,0,W,H);
}
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=window.innerWidth;H=window.innerHeight;
  canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  HORIZON=H*0.40;F=Math.max(H*1.05,260);
  buildBackground();buildVignette();
  if(G.state==='menu')resetAim();
}
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',()=>setTimeout(resize,80));

/* ---------------- 输入 ---------------- */
let aimPointer=null,aimTarget={x:0,y:0};
function resetAim(){G.aim.x=G.aimT.x=W/2;G.aim.y=G.aimT.y=H*0.62;aimTarget.x=W/2;aimTarget.y=H*0.62;}
canvas.addEventListener('pointerdown',e=>{
  initAudio();e.preventDefault();
  if(G.state==='playing'){
    aimPointer=e.pointerId;
    aimTarget.x=clamp(e.clientX,0,W);aimTarget.y=clamp(e.clientY,0,H);
    if(G.autofire)G.firing=true;
  }
});
canvas.addEventListener('pointermove',e=>{
  if(aimPointer===e.pointerId||(e.pointerType==='mouse'&&aimPointer===null)){
    aimTarget.x=clamp(e.clientX,0,W);aimTarget.y=clamp(e.clientY,0,H);
  }
});
const endPointer=e=>{if(aimPointer===e.pointerId){aimPointer=null;G.firing=false;}};
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});
canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(e.code==='Space'){if(G.state==='playing')G.firing=true;e.preventDefault();}
  if(e.key==='r'||e.key==='R'){if(G.state==='playing')startReload();}
  if(e.key==='g'||e.key==='G'){if(G.state==='playing')throwGrenade();}
  if(e.key==='p'||e.key==='P')togglePause();
  if(e.key==='m'||e.key==='M')toggleMuteUI();
});
window.addEventListener('keyup',e=>{if(e.code==='Space')G.firing=false;});
els.btnPause.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();togglePause();});
els.btnGrenade.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();throwGrenade();});
els.btnFire.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();G.btnFire=true;});
els.btnFire.addEventListener('pointerup',e=>{G.btnFire=false;});
els.btnFire.addEventListener('pointerleave',e=>{G.btnFire=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.state==='playing')togglePause();});

/* ---------------- 场景道具 ---------------- */
function buildProps(){
  props=[
    {type:'sandbag',x:-5.4,z:8.5},
    {type:'sandbag',x:5.2,z:10},
    {type:'barricade',x:3.8,z:22},
    {type:'truck',x:-3.2,z:15.5},
    {type:'rubble',x:4.6,z:12.5},
    {type:'rubble',x:-5.8,z:20},
  ];
  truckFxT=0;
}
function spawnSmokeFromTruck(){
  const tr=props.find(p=>p.type==='truck');if(!tr)return;
  const p=proj(tr.x,1.2,tr.z);
  parts.push({x:p.x+rand(-6,6),y:p.y-rand(0,10),vx:rand(-10,10),vy:rand(-30,-14),g:-10,t:0,ttl:rand(0.6,1.2),size:rand(6,14),color:'#4a4a48',kind:'smoke'});
  if(Math.random()<0.3)parts.push({x:p.x,y:p.y,vx:rand(-14,14),vy:rand(-40,-20),g:0,t:0,ttl:0.3,size:rand(2,4),color:pick(['#ff8c3a','#ff5533'])});
}

/* ---------------- 游戏逻辑 ---------------- */
function resetState(){
  G.score=0;G.hp=100;G.weapon=0;G.mag=WEAPONS[0].mag;G.reserve=150;G.grenades=3;
  G.fireCd=0;G.reloadT=0;G.reloadDur=0;G.throwCd=0;G.firing=false;G.btnFire=false;
  G.shake=0;G.flashRed=0;G.banner='';G.bannerT=0;G.hitmark=0;G.muzzle=0;
  enemies=[];bullets=[];grenades=[];pickups=[];parts=[];texts=[];decals=[];tank=null;
  spawnQueue=[];G.wave=0;resetAim();
}
function setBanner(text,sub){
  G.banner=text;G.bannerSub=sub||'';G.bannerT=G.bannerLife=2.2;
}
function setLevelIntro(li){
  G.level=li;
  els.introTitle.textContent=LEVELS[li].name;
  els.introSub.textContent=LEVELS[li].sub;
  G.state='intro';showState();
}
function startWave(i){
  G.wave=i;spawnQueue=[];
  const L=LEVELS[G.level];
  L.waves[i].forEach(s=>spawnQueue.push(Object.assign({},s)));
  spawnQueue.sort((a,b)=>a.t-b.t);
  spawnTimer=0;
  const bossWave=L.waves[i].some(s=>s.type==='tank');
  if(bossWave){
    // 战前补给：弹药、医疗包与武器升级会自动飘向阵地
    pickups.push({type:'ammo',x:-1.6,z:5,t:0,collected:false});
    pickups.push({type:'ammo',x:1.6,z:5.5,t:0,collected:false});
    pickups.push({type:'medkit',x:0,z:6,t:0,collected:false});
    if(G.weapon<3)pickups.push({type:'weapon',x:-0.6,z:4.5,t:0,collected:false});
  }
  setBanner(bossWave?'⚠ 敌方战车逼近！':'第 '+(i+1)+' 波',L.name);
  if(bossWave)SFX.boss();else SFX.wave();
}
function startLevel(li){
  G.level=li;
  enemies=[];bullets=[];grenades=[];pickups=[];parts=[];texts=[];tank=null;
  startWave(0);
  G.state='playing';showState();
  startMusic();
}
function spawnEnemy(type,x,z){
  enemies.push({type,x,z,hp:DEF[type].hp,t:rand(0,4),fireT:rand(0.8,2),throwT:rand(1,2.5),attackT:1,flash:0,dead:0,lunge:0,fireAnim:0,name:nextName(),remove:false});
}
function damagePlayer(dmg){
  if(G.state!=='playing'||dmg<=0)return;
  G.hp-=dmg;G.flashRed=1;G.shake=Math.max(G.shake,9);SFX.hurt();vib(70);
  texts.push({x:W/2+rand(-30,30),y:H*0.35,text:'-'+dmg,color:'#ff5050',t:0,ttl:0.8,vy:-60,size:24});
  if(G.hp<=0){G.hp=0;gameOver();}
}
function gameOver(){
  if(G.state!=='playing')return;
  G.state='over';stopMusic();SFX.over();vib(200);
  saveBest();
  els.overScore.textContent='得分：'+G.score+'　最佳：'+G.best;
  showState();
}
function saveBest(){
  if(G.score>G.best){G.best=G.score;lsSet('songhuBest',String(G.best));}
}
function levelComplete(){
  if(G.state!=='playing')return;
  const bonus=500+Math.round(G.hp)*5;
  G.score+=bonus;saveBest();
  stopMusic();SFX.win();
  const last=G.level>=LEVELS.length-1;
  if(last){
    G.state='win';
    els.winScore.textContent='得分：'+G.score+'　最佳：'+G.best;
  }else{
    G.state='clear';
    els.clearTitle.textContent='第 '+(G.level+1)+' 关完成';
    els.clearScore.textContent='本关得分：'+G.score+'　（坚守奖励 +'+bonus+'）';
  }
  showState();
}
function startReload(){
  const w=WEAPONS[G.weapon];
  if(w.infinite||G.reloadT>0||G.mag===w.mag)return;
  if(G.reserve<=0){
    if(G.weapon>0){
      G.weapon=0;G.mag=WEAPONS[0].mag;
      texts.push({x:W*0.16,y:H*0.8,text:'弹药耗尽，改用盒子炮',color:'#ffd0a0',t:0,ttl:1,vy:-30,size:14});
      SFX.reload();
    }
    return;
  }
  G.reloadT=w.reload;G.reloadDur=w.reload;
  SFX.reload();
}
function finishReload(){
  const w=WEAPONS[G.weapon];
  const need=w.mag-G.mag;
  const take=Math.min(need,G.reserve);
  G.mag+=take;G.reserve-=take;
  G.reloadT=0;
  texts.push({x:W*0.16,y:H*0.8,text:'装填完成',color:'#bfd8ff',t:0,ttl:0.6,vy:-30,size:14});
}
function tryFire(){
  const w=WEAPONS[G.weapon];
  if(G.reloadT>0||G.fireCd>0)return;
  if(G.mag<=0){startReload();return;}
  if(!w.infinite)G.mag--;
  G.fireCd=1/w.rate;
  G.muzzle=0.06;G.aimRecoil.y-=3.2;G.aimRecoil.x+=rand(-1,1);
  SFX.shot(G.weapon);
  const ax=G.aim.x+G.aimRecoil.x+rand(-w.spread,w.spread);
  const ay=G.aim.y+G.aimRecoil.y+rand(-w.spread*0.6,w.spread*0.6);
  bullets.push({from:'player',x0:W/2,y0:H*0.94,tx:ax,ty:ay,x:W/2,y:H*0.94,px:W/2,py:H*0.94,t:0,ttl:0.07,hp:1,dmg:0,r:2,dead:false,shell:false});
  let intercepted=false;
  for(const b of bullets){
    if(b.from==='player'||b.dead)continue;
    if(Math.abs(b.x-ax)<b.r+8&&Math.abs(b.y-ay)<b.r+8){
      b.hp--;if(b.hp<=0){b.dead=true;interceptFx(b);}intercepted=true;break;
    }
  }
  if(!intercepted){
    for(const g of grenades){
      if(g.state!=='fly')continue;
      const gp=proj(g.x,g.y,g.z);
      if(Math.abs(gp.x-ax)<16&&Math.abs(gp.y-ay)<16){
        g.hp=(g.hp||2)-1;
        if(g.hp<=0){g.dead=true;explodeAt(g.x,g.z,g.from==='enemy'?2.0:3.4,g.from==='enemy');}
        intercepted=true;break;
      }
    }
  }
  if(!intercepted){
    const tgt=findTarget(ax,ay);
    if(tgt){
      if(tgt===tank)damageTank(w.dmg,ax,ay);
      else damageEnemy(tgt,w.dmg,ax,ay);
    }
  }
}
function findTarget(ax,ay){
  let best=null,bestZ=1e9;
  for(const e of enemies){
    if(e.dead)continue;
    const p=proj(e.x,0,e.z),d=DEF[e.type];
    const w=d.w*p.s,h=d.h*p.s;
    const x0=p.x-w/2,y0=p.y-h;
    if(ax>=x0&&ax<=x0+w&&ay>=y0&&ay<=y0+h&&e.z<bestZ){bestZ=e.z;best=e;}
  }
  if(tank&&!tank.dead){
    const p=proj(tank.x,0,tank.z);
    const w=2.6*p.s,h=1.7*p.s;
    const x0=p.x-w/2,y0=p.y-h;
    if(ax>=x0&&ax<=x0+w&&ay>=y0&&ay<=y0+h&&tank.z<bestZ){bestZ=tank.z;best=tank;}
  }
  return best;
}
function enemyBulletNear(x,y){
  for(const b of bullets){if(b.from!=='player'&&!b.dead&&Math.abs(b.x-x)<18&&Math.abs(b.y-y)<18)return true;}
  for(const g of grenades){if(g.state==='fly'){const gp=proj(g.x,g.y,g.z);if(Math.abs(gp.x-x)<20&&Math.abs(gp.y-y)<20)return true;}}
  return false;
}
function damageEnemy(e,dmg,ax,ay){
  const d=DEF[e.type];
  const p=proj(e.x,0,e.z),w=d.w*p.s,h=d.h*p.s,y0=p.y-h;
  const head=ay<y0+h*0.22;
  const mult=head?2:1;
  e.hp-=dmg*mult;e.flash=1;
  spawnBlood(ax,ay,head?8:5);
  SFX.hit();G.hitmark=0.12;
  if(e.hp<=0&&!e.dead)killEnemy(e,head);
  else if(head)texts.push({x:ax,y:ay-10,text:'爆头!',color:'#ffd75e',t:0,ttl:0.7,vy:-70,size:18});
}
function killEnemy(e,head){
  e.dead=0.65;
  const d=DEF[e.type];
  const pts=d.score*(head?2:1)+(head?50:0);
  G.score+=pts;
  const p=proj(e.x,0,e.z);
  texts.push({x:p.x,y:p.y-d.h*p.s-8,text:(e.name?e.name+' ':'')+'+'+pts,color:'#ffd75e',t:0,ttl:0.9,vy:-60,size:18});
  SFX.kill();vib(25);
  spawnBlood(p.x,p.y-d.h*p.s*0.6,10);
  decals.push({x:e.x,z:e.z,a:0.55,rot:rand(0,TAU)});
  if(decals.length>40)decals.shift();
  if(Math.random()<d.drop){
    const r=Math.random();
    let type=r<0.36?'ammo':r<0.58?'medkit':r<0.82?'grenade':'weapon';
    if(type==='weapon'&&G.weapon>=3)type='ammo';
    pickups.push({type,x:e.x+rand(-0.5,0.5),z:e.z+0.6,t:0,collected:false});
  }
  if(e.type==='officer'){explodeFx(p.x,p.y-d.h*p.s*0.5,1.4,0.5);SFX.explode();}
}
function collectPickup(p){
  p.collected=true;SFX.pickup();
  let msg='';
  if(p.type==='ammo'){G.reserve+=120;msg='弹药 +120';}
  else if(p.type==='medkit'){G.hp=Math.min(100,G.hp+30);msg='生命 +30';}
  else if(p.type==='grenade'){G.grenades+=3;msg='手雷 +3';}
  else if(p.type==='weapon'){
    if(G.weapon<3){G.weapon++;G.mag=WEAPONS[G.weapon].mag;G.reserve=Math.max(G.reserve,150);msg='获得武器：'+WEAPONS[G.weapon].name;SFX.wave();}
    else{G.reserve+=120;msg='弹药 +120';}
  }
  texts.push({x:p.x,y:p.y-20,text:msg,color:'#7dff8a',t:0,ttl:1.1,vy:-50,size:16});
}
function throwGrenade(){
  if(G.state!=='playing'||G.throwCd>0||G.grenades<=0)return;
  G.grenades--;G.throwCd=0.6;SFX.throw();
  let tx,tz;
  if(G.aim.y>HORIZON){tz=EYE*F/(G.aim.y-HORIZON);tx=(G.aim.x-W/2)*tz/F;}
  else{tz=26;tx=0;}
  tz=clamp(tz,4,44);tx=clamp(tx,-8,8);
  grenades.push({from:'player',x0:0.4,z0:1.6,y0:1.2,tx,tz,y:1.2,t:0,dur:0.95,state:'fly',fuse:0.75,hp:2,dead:false});
}
function updateGrenade(g,dt){
  g.t+=dt;
  if(g.state==='fly'){
    const k=Math.min(1,g.t/g.dur);
    g.x=lerp(g.x0,g.tx,k);g.z=lerp(g.z0,g.tz,k);
    g.y=4.2*Math.sin(Math.PI*k)+0.4;
    if(k>=1){g.state='ground';g.fuse=g.from==='enemy'?0.9:0.75;g.t=0;}
    if(Math.random()<0.4){const p=proj(g.x,g.y,g.z);parts.push({x:p.x,y:p.y,vx:rand(-8,8),vy:rand(-20,-10),g:0,t:0,ttl:0.3,size:rand(2,4),color:'#666'});}
  }else{
    g.fuse-=dt;
    if(g.fuse<=0){g.dead=true;explodeAt(g.x,g.z,g.from==='enemy'?2.0:3.4,g.from==='enemy');}
  }
}
function explodeAt(x,z,r,hostile){
  const p=proj(x,0,z);
  explodeFx(p.x,p.y,r>3?1.8:1.2,r>3?1:0.75);
  SFX.explode();G.shake=Math.max(G.shake,r>3?15:9);vib(r>3?120:80);
  if(hostile){const d=Math.hypot(x,z-1.2);if(d<3)damagePlayer(d<1.2?20:Math.max(4,Math.round(20-d*5)));}
  for(const e of enemies){
    if(e.dead)continue;
    const dd=Math.hypot(e.x-x,e.z-z);
    if(dd<r)damageEnemy(e,Math.round(100*(1-dd/r*0.6)),p.x,p.y);
  }
  if(tank&&!tank.dead){const dd=Math.hypot(tank.x-x,tank.z-z);if(dd<r)damageTank(Math.round(90*(1-dd/r*0.5)),p.x,p.y);}
  for(const b of bullets){
    if((b.from==='enemy'||b.from==='tank')&&Math.hypot(b.x-p.x,b.y-p.y)<(r>3?130:70)){b.dead=true;spark(b.x,b.y,5);}
  }
  for(const g of grenades){
    if(g.state!=='fly'){const gp=proj(g.x,0,g.z);if(Math.hypot(gp.x-p.x,gp.y-p.y)<(r>3?120:60))g.dead=true;}
  }
}
function enemyFire(e){
  const d=DEF[e.type];
  const p=proj(e.x,1.35,e.z);
  const sp=70+G.level*18;
  const ttl=Math.max(0.34,0.3+e.z*0.05);
  bullets.push({from:'enemy',x0:p.x,y0:p.y,tx:W/2+rand(-sp,sp),ty:HORIZON+rand(-30,150),x:p.x,y:p.y,px:p.x,py:p.y,t:0,ttl,hp:1,dmg:Math.round(d.dmg*(1+0.12*G.level)),r:7,dead:false,shell:false});
  e.flash=0.6;e.fireAnim=1;
}
function enemyThrowGrenade(e){
  grenades.push({from:'enemy',x0:e.x,z0:e.z,y0:1.2,tx:rand(-2.2,2.2),tz:rand(2.2,3.4),y:1.2,t:0,dur:1.0,state:'fly',fuse:0.9,hp:2,dead:false});
  e.flash=0.6;
}
function updateBullet(b,dt){
  b.t+=dt;const k=Math.min(1,b.t/b.ttl);
  b.px=b.x;b.py=b.y;
  const wob=Math.sin(b.t*40)*(1-k)*4;
  b.x=lerp(b.x0,b.tx,k)+wob;b.y=lerp(b.y0,b.ty,k)-wob*0.4;
  if(b.t>=b.ttl){b.dead=true;if(b.dmg>0)damagePlayer(b.dmg);}
}
function updateEnemy(e,dt){
  const d=DEF[e.type];
  e.t+=dt;e.flash=Math.max(0,e.flash-dt*4);
  e.fireAnim=Math.max(0,(e.fireAnim||0)-dt*8);
  if(e.dead>0){e.dead-=dt;if(e.dead<=0)e.remove=true;return;}
  const spd=d.speed*(1+0.06*G.level);
  if(e.z>d.hold)e.z-=spd*dt;
  if(Math.abs(e.x)>0.6)e.x-=Math.sign(e.x)*spd*0.35*dt;
  if(d.melee){
    e.attackT=(e.attackT||1)-dt;
    if(e.z<=1.45&&e.attackT<=0){e.attackT=1.15;damagePlayer(d.dmg);e.lunge=1;vib(40);}
  }else{
    if(e.type!=='grenadier'){
      e.fireT-=dt;
      if(e.z<d.fireRange&&e.z>1.6&&e.fireT<=0){
        e.fireT=d.fireCD*rand(0.8,1.25);
        enemyFire(e);
      }
    }else{
      e.throwT=(e.throwT||rand(1,2))-dt;
      if(e.z<d.fireRange&&e.z>5&&e.throwT<=0){e.throwT=d.throwCD*rand(0.85,1.2);enemyThrowGrenade(e);}
    }
  }
  e.lunge=Math.max(0,(e.lunge||0)-dt*3);
}
function updateTank(dt){
  if(tank.dead>0){tank.dead-=dt;if(tank.dead<=0)tank=null;return;}
  tank.flash=Math.max(0,tank.flash-dt*3);
  if(tank.z>11)tank.z-=TANK.speed*dt;
  tank.recoil=Math.max(0,tank.recoil-dt*4);
  tank.t+=dt;tank.shellT-=dt;
  if(tank.shellT<=0&&tank.z<=13){
    tank.shellT=TANK.shellCD;tank.recoil=1;
    const p=proj(tank.x,1.1,tank.z);
    bullets.push({from:'tank',x0:p.x,y0:p.y,tx:W/2+rand(-50,50),ty:HORIZON+rand(-20,60),x:p.x,y:p.y,px:p.x,py:p.y,t:0,ttl:1.05,hp:2,dmg:TANK.shellDmg,r:12,dead:false,shell:true});
    SFX.explode();G.shake=Math.max(G.shake,6);
  }
  tank.supT-=dt;
  if(tank.supT<=0){
    tank.supT=TANK.supportCD;
    const sup=enemies.filter(e=>!e.dead&&e.type==='rifleman').length;
    if(sup<3)spawnEnemy('rifleman',rand(-4,4),Math.max(tank.z+2,24));
  }
}
function damageTank(dmg,sx,sy){
  if(!tank||tank.dead)return;
  // 装甲弱点：坦克受到的伤害加成 1.5 倍
  tank.hp-=dmg*1.5;tank.flash=1;
  spark(sx,sy,6);
  SFX.hit();
  if(tank.hp<=0){
    tank.dead=3.0;G.score+=TANK.score;saveBest();
    texts.push({x:W/2,y:H*0.3,text:'战车摧毁！ +'+TANK.score,color:'#ffd75e',t:0,ttl:2,vy:-40,size:26});
    SFX.explode();G.shake=Math.max(G.shake,22);vib(300);
    for(let i=0;i<4;i++)setTimeout(()=>{if(tank){const p=proj(tank.x,0,tank.z);explodeFx(p.x+rand(-120,120),p.y-rand(0,120),rand(1,1.8),1);}},i*180);
  }
}
function interceptFx(b){
  spark(b.x,b.y,6);
  G.score+=10;
  texts.push({x:b.x,y:b.y-12,text:'拦截 +10',color:'#9fd0ff',t:0,ttl:0.5,vy:-50,size:13});
  SFX.hit();
}
function spark(x,y,n){
  n=n||8;
  for(let i=0;i<n;i++){const a=rand(0,TAU),sp=rand(30,160);parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:200,t:0,ttl:rand(0.15,0.35),size:rand(1.5,3),color:pick(['#ffe9a0','#ffc040','#fff'])});}
}
function spawnBlood(x,y,n){
  for(let i=0;i<n;i++){const a=rand(0,TAU),sp=rand(20,140);parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,g:500,t:0,ttl:rand(0.25,0.5),size:rand(2,5),color:pick(['#a01818','#c02a2a','#8a1010'])});}
}
function explodeFx(x,y,scale,strength){
  parts.push({x,y,vx:0,vy:0,g:0,t:0,ttl:0.22,size:90*scale,color:'#fff7d0',kind:'flash'});
  parts.push({x,y,vx:0,vy:0,g:0,t:0,ttl:0.3,size:60*scale,color:'#ff8c3a',kind:'flash'});
  const n=Math.round(14*strength+8);
  for(let i=0;i<n;i++){
    const a=rand(0,TAU),sp=rand(40,240)*scale;
    parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,g:300,t:0,ttl:rand(0.3,0.6),size:rand(2,5),color:pick(['#ffd75e','#ff8c3a','#ff5533','#ffaa33'])});
  }
  for(let i=0;i<8;i++){
    parts.push({x:x+rand(-20,20),y:y+rand(-20,20),vx:rand(-20,20),vy:rand(-60,-20),g:-20,t:0,ttl:rand(0.7,1.3),size:rand(14,30),color:'#555',kind:'smoke'});
  }
}
function updateParticles(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.t+=dt;if(p.t>=p.ttl){parts.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;}
}
function updateTexts(dt){
  for(let i=texts.length-1;i>=0;i--){const t=texts[i];t.t+=dt;t.y+=t.vy*dt;if(t.t>=t.ttl)texts.splice(i,1);}
}
function update(dt){
  time+=dt;
  G.aim.x=lerp(G.aim.x,aimTarget.x,Math.min(1,dt*16));
  G.aim.y=lerp(G.aim.y,aimTarget.y,Math.min(1,dt*16));
  G.aimRecoil.x*=Math.pow(0.0001,dt);G.aimRecoil.y*=Math.pow(0.0001,dt);
  G.fireCd-=dt;G.throwCd-=dt;G.muzzle-=dt;G.hitmark-=dt;
  G.shake*=Math.pow(0.0001,dt);G.flashRed=Math.max(0,G.flashRed-dt*2.2);
  G.bannerT-=dt;
  if(G.reloadT>0){G.reloadT-=dt;if(G.reloadT<=0)finishReload();}
  else if(G.mag<=0&&G.reserve>0&&G.weapon>0)startReload();
  const firing=(G.firing&&G.autofire)||G.btnFire;
  if(firing)tryFire();
  spawnTimer+=dt;
  while(spawnQueue.length&&spawnQueue[0].t<=spawnTimer){
    const s=spawnQueue.shift();
    if(s.type==='tank')tank={hp:TANK.hp,x:0,z:36,t:0,shellT:3,supT:6,flash:0,dead:0,recoil:0,name:nextName()+'的战车'};
    else spawnEnemy(s.type,s.x,s.z);
  }
  for(let i=enemies.length-1;i>=0;i--){updateEnemy(enemies[i],dt);if(enemies[i].remove)enemies.splice(i,1);}
  if(tank)updateTank(dt);
  for(let i=bullets.length-1;i>=0;i--){updateBullet(bullets[i],dt);if(bullets[i].dead)bullets.splice(i,1);}
  for(let i=grenades.length-1;i>=0;i--){updateGrenade(grenades[i],dt);if(grenades[i].dead)grenades.splice(i,1);}
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];
    if(p.collected){
      p.x=lerp(p.x,W*0.12,dt*6);p.y=lerp(p.y,H*0.86,dt*6);
      if(Math.abs(p.x-W*0.12)<8)pickups.splice(i,1);
      continue;
    }
    p.t+=dt;p.z-=2.4*dt;
    if(p.z<3.2&&Math.abs(p.x)<3.4)collectPickup(p);
    else if(p.t>12)pickups.splice(i,1);
  }
  updateParticles(dt);updateTexts(dt);
  for(let i=decals.length-1;i>=0;i--){decals[i].a-=dt*0.12;if(decals[i].a<=0)decals.splice(i,1);}
  truckFxT-=dt;
  if(truckFxT<=0){truckFxT=0.12;spawnSmokeFromTruck();}
  const alive=enemies.filter(e=>!e.dead).length;
  if(spawnQueue.length===0&&alive===0&&!tank){
    const L=LEVELS[G.level];
    if(G.wave>=L.waves.length-1)levelComplete();
    else startWave(G.wave+1);
  }
}
function updateMenu(dt){
  time+=dt;
  for(const e of menuEnemies){
    e.t+=dt;
    const spd=e.type==='charger'?1.6:0.85;
    e.z-=spd*dt;
    if(Math.abs(e.x)>0.5)e.x-=Math.sign(e.x)*0.3*dt;
    if(e.z<4.2){e.z=rand(40,50);e.x=rand(-5,5);e.type=pick(['rifleman','charger','rifleman','grenadier']);}
  }
  updateParticles(dt);updateTexts(dt);
  truckFxT-=dt;
  if(truckFxT<=0){truckFxT=0.12;spawnSmokeFromTruck();}
}

/* ---------------- 绘制 ---------------- */
function drawProp(p){
  const pr=proj(p.x,0,p.z),s=pr.s;
  ctx.save();ctx.translate(pr.x,pr.y);
  const bag=(bx,by,bw,bh)=>{
    ctx.fillStyle='#8f7f4e';roundPath((bx-bw/2)*s,(by-bh)*s,bw*s,bh*s,6);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.15)';roundPath((bx-bw/2)*s,(by-bh/2)*s,bw*s,bh/2*s,4);ctx.fill();
  };
  if(p.type==='sandbag'){
    bag(-0.7,0,1.4,0.5);bag(0.3,0,1.1,0.5);bag(-0.35,-0.45,1.1,0.5);
  }else if(p.type==='barricade'){
    ctx.fillStyle='#5a4428';ctx.fillRect(-1.2*s,-1.5*s,2.4*s,1.5*s);
    ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(-1.2*s,-0.5*s,2.4*s,0.08*s);
    ctx.fillStyle='#8f7f4e';ctx.fillRect(-1.4*s,-0.4*s,2.8*s,0.4*s);ctx.fillRect(-1.2*s,-0.8*s,2.4*s,0.4*s);
    ctx.strokeStyle='#3a2a1a';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-1.1*s,-1.4*s);ctx.lineTo(1.1*s,-0.1*s);ctx.moveTo(1.1*s,-1.4*s);ctx.lineTo(-1.1*s,-0.1*s);ctx.stroke();
  }else if(p.type==='truck'){
    ctx.fillStyle='#333a30';ctx.fillRect(-1.7*s,-1.6*s,3.4*s,1.6*s);
    ctx.fillStyle='#2a2f26';ctx.fillRect(-1.7*s,-0.7*s,3.4*s,0.7*s);
    ctx.fillStyle='#1d1d1d';
    ctx.beginPath();ctx.arc(-1.0*s,0.05*s,0.35*s,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(1.0*s,0.05*s,0.35*s,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(255,120,30,0.5)';ctx.fillRect(0.6*s,-1.5*s,0.9*s,0.8*s);
    ctx.fillStyle='rgba(255,60,20,0.35)';ctx.beginPath();ctx.arc(1.0*s,-1.1*s,0.5*s,0,TAU);ctx.fill();
  }else{
    ctx.fillStyle='#5a5548';ctx.beginPath();ctx.ellipse(0,-0.2*s,1.3*s,0.7*s,0,0,TAU);ctx.fill();
    ctx.fillStyle='#4a4638';ctx.beginPath();ctx.ellipse(-0.5*s,-0.3*s,0.6*s,0.4*s,0,0,TAU);ctx.fill();
  }
  ctx.restore();
}
function drawEnemy(e){
  const p=proj(e.x,0,e.z),d=DEF[e.type];
  const w=d.w*p.s,h=d.h*p.s;
  const spr=SPR[e.type][(Math.floor(e.t*8))%4];
  const fog=clamp(1-(e.z-26)/30,0.35,1);
  ctx.save();
  ctx.globalAlpha=fog;
  ctx.translate(p.x,p.y);
  if(e.dead>0){const k=1-e.dead/0.65;ctx.rotate(-k*1.3);ctx.globalAlpha*=Math.max(0.2,1-k);}
  if(e.lunge>0)ctx.translate(0,e.lunge*8);
  ctx.drawImage(spr,-w/2,-h,w,h);
  ctx.restore();
  if(e.flash>0.05&&!e.dead){
    ctx.fillStyle='rgba(255,255,255,'+Math.min(0.75,e.flash)+')';
    ctx.fillRect(p.x-w/2,p.y-h,w,h);
  }
  if(e.hp<d.hp&&!e.dead){
    const bw=Math.max(26,w*0.8),bh=4,bx=p.x-bw/2,by=p.y-h-12;
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(bx-1,by-1,bw+2,bh+2);
    ctx.fillStyle='#7a1414';ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='#e04040';ctx.fillRect(bx,by,bw*clamp(e.hp/d.hp,0,1),bh);
  }
  // 头顶随机姓名
  if(!e.dead&&e.name){
    const fs=clamp(p.s/8,9,18);
    ctx.font='bold '+fs+'px sans-serif';
    ctx.textAlign='center';
    const tw=ctx.measureText(e.name).width;
    const ny=p.y-h-12-fs-8;
    ctx.fillStyle='rgba(40,10,10,0.6)';
    ctx.fillRect(p.x-tw/2-4,ny-2,tw+8,fs+4);
    ctx.strokeStyle='rgba(255,200,100,0.5)';ctx.lineWidth=1;
    ctx.strokeRect(p.x-tw/2-4,ny-2,tw+8,fs+4);
    ctx.fillStyle='#ffe9b0';
    ctx.fillText(e.name,p.x,ny+fs);
  }
  if(e.fireAnim>0){
    const gp=proj(e.x,1.15,e.z);
    ctx.fillStyle='#ffd75e';ctx.beginPath();ctx.arc(gp.x,gp.y,6,0,TAU);ctx.fill();
  }
}
function drawTank(t){
  const p=proj(t.x,0,t.z),s=p.s;
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(0,0,1.5*s,0.5*s,0,0,TAU);ctx.fill();
  if(t.dead>0){ctx.globalAlpha=Math.max(0.3,1-t.dead/3);}
  // 履带
  ctx.fillStyle='#2a2a2a';
  ctx.fillRect(-1.42*s,-0.62*s,0.5*s,0.62*s);
  ctx.fillRect(0.92*s,-0.62*s,0.5*s,0.62*s);
  ctx.fillStyle='#3a3a3a';
  for(const cx of [-1.17,-0.92]){
    for(let i=0;i<4;i++){const cy=-0.1*s-i*0.13*s;ctx.beginPath();ctx.arc(cx*s,cy,0.13*s,0,TAU);ctx.fill();}
  }
  for(const cx of [1.17,1.42]){
    for(let i=0;i<4;i++){const cy=-0.1*s-i*0.13*s;ctx.beginPath();ctx.arc(cx*s,cy,0.13*s,0,TAU);ctx.fill();}
  }
  // 车体
  ctx.fillStyle=t.flash>0?'#8a9a6a':'#4f5f3a';
  ctx.beginPath();ctx.moveTo(-1.1*s,-0.62*s);ctx.lineTo(1.1*s,-0.62*s);ctx.lineTo(0.85*s,0);ctx.lineTo(-0.85*s,0);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(-1.1*s,-0.35*s,2.2*s,0.06*s);
  // 炮塔
  ctx.fillStyle=t.flash>0?'#9aaa78':'#5a6a44';
  roundPath(-0.65*s,-1.18*s,1.3*s,0.56*s,0.2*s);ctx.fill();
  ctx.fillStyle='#4a5a34';ctx.fillRect(-0.22*s,-1.28*s,0.44*s,0.1*s);
  // 炮管(指向镜头)
  const rec=1-t.recoil*0.25;
  ctx.fillStyle='#2e3a24';
  ctx.fillRect(-0.09*s,-0.95*s,0.18*s,0.75*s*rec+0.2*s);
  ctx.fillStyle='#3a4a2a';ctx.beginPath();ctx.arc(0,-0.95*s+0.75*s*rec+0.2*s,0.12*s,0,TAU);ctx.fill();
  ctx.restore();
  // 血条
  const bw=Math.min(240,s*1.6),bx=p.x-bw/2,by=p.y-s*2-16;
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(bx-1,by-1,bw+2,7);
  ctx.fillStyle='#7a1414';ctx.fillRect(bx,by,bw,5);
  ctx.fillStyle='#ff5533';ctx.fillRect(bx,by,bw*clamp(t.hp/TANK.hp,0,1),5);
  // 战车姓名
  if(t.name){
    ctx.font='bold '+Math.max(11,s/24)+'px sans-serif';
    ctx.textAlign='center';
    ctx.fillStyle='rgba(40,10,10,0.6)';
    const tw=ctx.measureText(t.name).width;
    ctx.fillRect(p.x-tw/2-5,by-24,tw+10,18);
    ctx.fillStyle='#ffd0c0';
    ctx.fillText(t.name,p.x,by-11);
  }
}
function drawPickup(p){
  if(p.collected)return;
  const bob=Math.sin(p.t*4)*0.15;
  const pr=proj(p.x,bob,p.z);
  const s=clamp(pr.s/60,0.5,3);
  ctx.save();ctx.translate(pr.x,pr.y);ctx.scale(s,s);
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.beginPath();ctx.ellipse(0,10,14,5,0,0,TAU);ctx.fill();
  if(p.type==='medkit'){
    ctx.fillStyle='#f0f0f0';ctx.fillRect(-12,-22,24,20);
    ctx.fillStyle='#d02020';ctx.fillRect(-3,-18,6,12);ctx.fillRect(-8,-13,16,6);
  }else if(p.type==='ammo'){
    ctx.fillStyle='#b8860b';ctx.fillRect(-13,-20,26,18);
    ctx.fillStyle='#8a6a0b';ctx.fillRect(-9,-16,18,10);
    ctx.fillStyle='#3a2a0a';ctx.fillRect(-6,-13,4,6);ctx.fillRect(2,-13,4,6);
  }else if(p.type==='grenade'){
    ctx.fillStyle='#2d2d2d';ctx.beginPath();ctx.arc(0,-8,9,0,TAU);ctx.fill();
    ctx.fillStyle='#555';ctx.fillRect(-2,-22,4,8);
  }else{
    ctx.fillStyle='#5a4428';ctx.fillRect(-18,-6,36,6);
    ctx.fillStyle='#222';ctx.fillRect(14,-6,8,6);
  }
  ctx.restore();
}
function drawGrenade(g){
  const p=proj(g.x,g.y,g.z);
  const blink=g.state==='ground'&&Math.sin(time*30)>0;
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle=blink?'#ff3030':'#2d2d2d';
  ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();
  ctx.fillStyle='#555';ctx.fillRect(-1.5,-6,3,4);
  ctx.restore();
}
function drawBullet(b){
  const k=b.t/b.ttl;
  ctx.save();
  if(b.shell){ctx.strokeStyle='rgba(255,140,60,0.9)';ctx.lineWidth=4;ctx.shadowColor='#ff6a2a';ctx.shadowBlur=14;}
  else{ctx.strokeStyle='rgba(255,230,150,0.85)';ctx.lineWidth=2.5;ctx.shadowColor='#ffd75e';ctx.shadowBlur=6;}
  ctx.beginPath();ctx.moveTo(b.px,b.py);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.fillStyle=b.shell?'#ff8c3a':'#fff3c0';
  ctx.beginPath();ctx.arc(b.x,b.y,b.shell?6:2.5,0,TAU);ctx.fill();
  ctx.restore();
}
function drawPart(p){
  const a=1-p.t/p.ttl;
  ctx.save();ctx.globalAlpha=Math.max(0,a);
  if(p.kind==='smoke'){
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*(0.6+p.t/p.ttl*1.4),0,TAU);ctx.fill();
  }else if(p.kind==='flash'){
    const g=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,p.size*(1-p.t/p.ttl)+2);
    g.addColorStop(0,'#fff');g.addColorStop(0.4,p.color);g.addColorStop(1,'rgba(255,120,40,0)');
    ctx.fillStyle=g;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-p.t/p.ttl)+2,0,TAU);ctx.fill();
  }else{
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();
  }
  ctx.restore();
}
function drawHUD(){
  ctx.save();
  ctx.textBaseline='middle';
  const bw=Math.min(190,W*0.4),bh=16,bx=12,by=12;
  ctx.fillStyle='rgba(0,0,0,0.5)';roundPath(bx-2,by-2,bw+4,bh+4,8);ctx.fill();
  const pct=clamp(G.hp/100,0,1);
  const grad=ctx.createLinearGradient(bx,0,bx+bw,0);
  grad.addColorStop(0,'#3ac23a');grad.addColorStop(0.55,'#d9b52a');grad.addColorStop(1,'#c2322e');
  ctx.fillStyle=grad;roundPath(bx,by,bw*pct,bh,5);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 12px sans-serif';ctx.textAlign='left';
  ctx.fillText('生命 '+Math.max(0,Math.round(G.hp)),bx+bw+10,by+bh/2);
  ctx.textAlign='right';
  ctx.font='bold 17px sans-serif';ctx.fillStyle='#ffd75e';
  ctx.fillText('得分 '+G.score,W-12-bw-40,22);
  ctx.font='12px sans-serif';ctx.fillStyle='#c9c2b0';
  const L=LEVELS[G.level];
  ctx.fillText((L?L.name:'')+' · 第'+(G.wave+1)+'波',W-12-bw-40,40);
  const w=WEAPONS[G.weapon];
  ctx.textAlign='left';
  ctx.font='bold 26px sans-serif';ctx.fillStyle='#fff';
  ctx.fillText(w.infinite?'∞':(G.mag+'/'+w.mag),12,H-52);
  ctx.font='bold 15px sans-serif';ctx.fillStyle='#e8e2d0';
  ctx.fillText(w.name,12,H-24);
  if(!w.infinite){ctx.font='12px sans-serif';ctx.fillStyle='#99a';
    ctx.fillText('后备 '+G.reserve,12+110,H-40);}
  if(G.reloadT>0){
    const k=1-G.reloadT/G.reloadDur;
    ctx.fillStyle='rgba(0,0,0,0.5)';roundPath(12,H-14,110,6,3);ctx.fill();
    ctx.fillStyle='#7db8ff';roundPath(12,H-14,110*k,6,3);ctx.fill();
  }
  if(G.bannerT>0){
    const life=G.bannerLife;
    const a=clamp(Math.min(G.bannerT,life-G.bannerT)/0.4,0,1);
    ctx.save();ctx.globalAlpha=a;ctx.textAlign='center';
    ctx.font='bold 30px sans-serif';
    ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillText(G.banner,W/2+2,H*0.27+2);
    ctx.fillStyle='#ffd75e';ctx.fillText(G.banner,W/2,H*0.27);
    if(G.bannerSub){ctx.font='15px sans-serif';ctx.fillStyle='#e8dcc0';ctx.fillText(G.bannerSub,W/2,H*0.27+34);}
    ctx.restore();
  }
  if(tank&&!tank.dead){
    const tw=Math.min(320,W*0.55),tx=W/2-tw/2,ty=12;
    ctx.textAlign='center';ctx.font='bold 12px sans-serif';ctx.fillStyle='#ffd0c0';
    ctx.fillText('敌方战车 '+Math.max(0,Math.round(tank.hp)),W/2,ty-8);
    ctx.fillStyle='rgba(0,0,0,0.5)';roundPath(tx-2,ty-2,tw+4,12,6);ctx.fill();
    ctx.fillStyle='#7a1414';roundPath(tx,ty,tw,8,4);ctx.fill();
    ctx.fillStyle='#ff5533';roundPath(tx,ty,tw*clamp(tank.hp/TANK.hp,0,1),8,4);ctx.fill();
  }
  ctx.restore();
}
function drawCrosshair(){
  if(G.state!=='playing'&&G.state!=='pause')return;
  const x=G.aim.x+G.aimRecoil.x,y=G.aim.y+G.aimRecoil.y;
  const hot=!!findTarget(x,y)||enemyBulletNear(x,y);
  ctx.save();ctx.translate(x,y);
  ctx.strokeStyle=hot?'#ff4040':'rgba(255,255,255,0.9)';
  ctx.fillStyle=hot?'#ff4040':'rgba(255,255,255,0.9)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,15,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,2,0,TAU);ctx.fill();
  for(const pair of [[1,0],[-1,0],[0,1],[0,-1]]){
    ctx.beginPath();ctx.moveTo(pair[0]*15,pair[1]*15);ctx.lineTo(pair[0]*19,pair[1]*19);ctx.stroke();
  }
  ctx.restore();
  if(G.hitmark>0){
    const a=G.hitmark/0.12;
    ctx.save();ctx.strokeStyle='rgba(255,255,255,'+a+')';ctx.lineWidth=2.5;ctx.translate(x,y);
    for(const pair of [[1,1],[-1,1],[1,-1],[-1,-1]]){
      ctx.beginPath();ctx.moveTo(pair[0]*7,pair[1]*7);ctx.lineTo(pair[0]*13,pair[1]*13);ctx.stroke();
    }
    ctx.restore();
  }
}
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.save();
  if(G.shake>0.2)ctx.translate(rand(-G.shake,G.shake)*0.5,rand(-G.shake,G.shake)*0.5);
  ctx.drawImage(bgCanvas,0,0,W,H);
  for(const d of decals){
    const p=proj(d.x,0,d.z);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(d.rot);
    const sc=clamp(p.s/30,0.5,6);
    ctx.scale(sc,sc);ctx.globalAlpha=Math.max(0,d.a);
    ctx.fillStyle='#5a0f0f';ctx.beginPath();ctx.ellipse(0,0,30,10,0,0,TAU);ctx.fill();
    ctx.restore();
  }
  const ents=[];
  props.forEach(p=>ents.push({z:p.z,draw:()=>drawProp(p)}));
  enemies.forEach(e=>{if(!e.remove)ents.push({z:e.z,draw:()=>drawEnemy(e)});});
  if(tank)ents.push({z:tank.z,draw:()=>drawTank(tank)});
  pickups.forEach(p=>{if(!p.collected)ents.push({z:p.z,draw:()=>drawPickup(p)});});
  grenades.forEach(g=>ents.push({z:g.z,draw:()=>drawGrenade(g)}));
  ents.sort((a,b)=>a.z-b.z);
  for(const en of ents)en.draw();
  if(G.state==='menu')menuEnemies.forEach(e=>drawEnemy(e));
  for(const b of bullets)drawBullet(b);
  for(const p of parts)drawPart(p);
  ctx.textAlign='center';
  for(const t of texts){
    const a=1-t.t/t.ttl;
    ctx.globalAlpha=a;
    ctx.font='bold '+t.size+'px sans-serif';
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText(t.text,t.x+1,t.y+1);
    ctx.fillStyle=t.color;ctx.fillText(t.text,t.x,t.y);
  }
  ctx.globalAlpha=1;
  ctx.restore();
  drawHUD();
  drawCrosshair();
  if(G.flashRed>0.02){
    const a=Math.min(0.55,G.flashRed);
    const g=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.7);
    g.addColorStop(0,'rgba(160,0,0,0)');g.addColorStop(1,'rgba(160,0,0,'+a+')');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  if(G.state==='playing'&&G.hp<30&&G.hp>0){
    const a=0.16+0.1*Math.sin(time*6);
    const g=ctx.createRadialGradient(W/2,H/2,H*0.15,W/2,H/2,H*0.65);
    g.addColorStop(0,'rgba(120,0,0,0)');g.addColorStop(1,'rgba(120,0,0,'+a+')');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  if(vigCanvas)ctx.drawImage(vigCanvas,0,0,W,H);
}

/* ---------------- 界面状态 ---------------- */
function updateMenuTexts(){
  els.menuBest.textContent='最佳成绩：'+G.best;
  els.btnSound.textContent=mute?'🔇 声音：关':'🔊 声音：开';
  els.btnAuto.textContent=G.autofire?'自动开火：开':'自动开火：关';
}
function showHelp(show){
  els.help.classList.toggle('hidden',!show);
}
function showState(){
  const map={menu:els.menu,intro:els.intro,clear:els.clear,over:els.over,win:els.win,pause:els.pause};
  for(const k in map)map[k].classList.toggle('hidden',k!==G.state);
  const inGame=G.state==='playing'||G.state==='pause';
  els.btnPause.style.display=inGame?'flex':'none';
  els.btnGrenade.style.display=(G.state==='playing')?'flex':'none';
  els.btnFire.style.display=(G.state==='playing'&&!G.autofire)?'flex':'none';
  if(G.state==='menu')updateMenuTexts();
}
function togglePause(){
  if(G.state==='playing'){
    G.state='pause';G.firing=false;G.btnFire=false;stopMusic();SFX.ui();showState();
  }else if(G.state==='pause'){
    G.state='playing';startMusic();showState();
  }
}
function goMenu(){
  G.state='menu';stopMusic();initMenuScene();showState();
}

/* ---------------- 菜单场景 ---------------- */
function initMenuScene(){
  menuEnemies=[];
  for(let i=0;i<6;i++)menuEnemies.push({type:pick(['rifleman','rifleman','charger','rifleman','grenadier']),x:rand(-5,5),z:rand(18,48),t:rand(0,4),dead:0,flash:0,hp:999,remove:false,lunge:0,fireAnim:0,name:nextName()});
}

/* ---------------- 按钮绑定 ---------------- */
els.btnStart.addEventListener('click',()=>{SFX.ui();resetState();setLevelIntro(0);});
els.btnIntroStart.addEventListener('click',()=>{SFX.ui();startLevel(G.level);});
els.btnClearNext.addEventListener('click',()=>{SFX.ui();setLevelIntro(G.level+1);});
els.btnRetry.addEventListener('click',()=>{SFX.ui();resetState();setLevelIntro(0);});
els.btnMenu2.addEventListener('click',()=>{SFX.ui();goMenu();});
els.btnAgain.addEventListener('click',()=>{SFX.ui();resetState();setLevelIntro(0);});
els.btnMenu3.addEventListener('click',()=>{SFX.ui();goMenu();});
els.btnResume.addEventListener('click',()=>{SFX.ui();togglePause();});
els.btnRestart.addEventListener('click',()=>{SFX.ui();resetState();setLevelIntro(G.level);});
els.btnMenuP.addEventListener('click',()=>{SFX.ui();goMenu();});
els.btnHelp.addEventListener('click',()=>{SFX.ui();showHelp(true);});
els.btnHelpBack.addEventListener('click',()=>{SFX.ui();showHelp(false);});
els.btnSound.addEventListener('click',()=>{toggleMuteUI();updateMenuTexts();});
els.btnAuto.addEventListener('click',()=>{G.autofire=!G.autofire;SFX.ui();updateMenuTexts();});

/* ---------------- 主循环与启动 ---------------- */
let lastT=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.033,(now-lastT)/1000);lastT=now;
  if(G.state==='playing')update(dt);
  else if(G.state==='menu')updateMenu(dt);
  draw();
  els.grenadeCount.textContent=G.grenades>0?G.grenades:'';
  els.grenadeCount.style.display=G.grenades>0?'':'none';
}
/* ---------------- 启动 ---------------- */
function boot(){
  buildSprites();
  resize();
  buildProps();
  initMenuScene();
  resetState();
  els.menuBest.textContent='最佳成绩：'+G.best;
  updateMenuTexts();
  showState();
  if(!lsGet('songhuHelp')){showHelp(true);lsSet('songhuHelp','1');}
  requestAnimationFrame(frame);
}
try{
  boot();
}catch(err){
  // 启动失败时把错误显示在页面上，便于排查
  const d=document.createElement('div');
  d.style.cssText='position:fixed;left:0;top:0;right:0;z-index:999;background:#14161c;color:#ff6a5e;font:13px/1.6 monospace;padding:20px;white-space:pre-wrap;word-break:break-all;';
  d.textContent='启动失败：'+err.message+'\n\n'+err.stack;
  document.body.appendChild(d);
}
