// RELOJ
function tick(){
  var d=new Date();
  document.getElementById('clock').textContent=
    String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
tick();setInterval(tick,1000);

// BARRAS VELOCIDAD
var VB_COLS=4,VB_ROWS=14,vbCols=[];
(function(){
  var w=document.getElementById('velBars');
  w.style.cssText='display:flex;gap:2px;width:90px;flex-shrink:0;height:100%;';
  for(var c=0;c<VB_COLS;c++){
    var col=document.createElement('div');
    col.style.cssText='display:flex;flex-direction:column-reverse;gap:2px;flex:1;height:100%;';
    var segs=[];
    for(var r=0;r<VB_ROWS;r++){
      var s=document.createElement('div');
      s.className='b';
      col.appendChild(s);segs.push(s);
    }
    w.appendChild(col);vbCols.push(segs);
  }
})();

function setVelBars(frac){
  var on=Math.round(frac*VB_ROWS);
  vbCols.forEach(function(segs){
    segs.forEach(function(s,i){
      var t=i/VB_ROWS;
      if(i<on){
        if(t<0.65){s.style.background='#3dff66';s.style.boxShadow='0 0 4px #3dff66';}
        else if(t<0.85){s.style.background='#ffb000';s.style.boxShadow='0 0 4px #ffb000';}
        else{s.style.background='#ff2a17';s.style.boxShadow='0 0 4px #ff2a17';}
      } else {
        s.style.background='#091409';s.style.boxShadow='none';
      }
    });
  });
}

// ARCO RPM
var rsvg=document.getElementById('rpmArc'),RL=48,rDots=[];
(function(){
  var ns='http://www.w3.org/2000/svg';
  var defs=document.createElementNS(ns,'defs');
  function mkF(id,col){
    var f=document.createElementNS(ns,'filter');f.setAttribute('id',id);
    var fe=document.createElementNS(ns,'feDropShadow');
    fe.setAttribute('dx','0');fe.setAttribute('dy','0');fe.setAttribute('stdDeviation','2');
    fe.setAttribute('flood-color',col);fe.setAttribute('flood-opacity','0.8');
    f.appendChild(fe);defs.appendChild(f);
  }
  mkF('rg','#ff2a17');mkF('ag','#ffb000');mkF('gg','#3dff66');
  rsvg.appendChild(defs);
  var P0=[6,105],P1=[190,5],P2=[374,60];
  function bez(t){
    return[
      (1-t)*(1-t)*P0[0]+2*(1-t)*t*P1[0]+t*t*P2[0],
      (1-t)*(1-t)*P0[1]+2*(1-t)*t*P1[1]+t*t*P2[1]
    ];
  }
  [['0',0],['2k',.22],['4k',.5],['6k',.72],['8k',1]].forEach(function(p){
    var pt=bez(p[1]),tx=document.createElementNS(ns,'text');
    tx.setAttribute('x',pt[0]);tx.setAttribute('y',Math.max(12,pt[1]-8));
    tx.setAttribute('text-anchor','middle');tx.setAttribute('font-size','8');
    tx.setAttribute('fill','#3a3a3a');tx.setAttribute('font-family','Eurostile,sans-serif');
    tx.textContent=p[0];rsvg.appendChild(tx);
  });
  for(var i=0;i<RL;i++){
    var t=i/(RL-1),pt=bez(t);
    var dot=document.createElementNS(ns,'circle');
    dot.setAttribute('cx',pt[0]);dot.setAttribute('cy',pt[1]);dot.setAttribute('r','5');
    dot.setAttribute('fill','#0d1a0d');
    rsvg.appendChild(dot);rDots.push(dot);
  }
  var bg=document.createElementNS(ns,'rect');
  bg.setAttribute('x','215');bg.setAttribute('y','68');bg.setAttribute('width','100');bg.setAttribute('height','44');
  bg.setAttribute('fill','#080808');bg.setAttribute('stroke','#222');bg.setAttribute('stroke-width','1');bg.setAttribute('rx','3');
  rsvg.appendChild(bg);
  var nEl=document.createElementNS(ns,'text');
  nEl.setAttribute('id','rpmNum');nEl.setAttribute('x','265');nEl.setAttribute('y','107');
  nEl.setAttribute('text-anchor','middle');nEl.setAttribute('font-size','38');
  nEl.setAttribute('fill','#ff2a17');nEl.setAttribute('font-family','DSEG7,monospace');
  nEl.setAttribute('filter','url(#rg)');nEl.textContent='000';rsvg.appendChild(nEl);
  var rbg=document.createElementNS(ns,'rect');
  rbg.setAttribute('x','320');rbg.setAttribute('y','98');rbg.setAttribute('width','42');rbg.setAttribute('height','16');
  rbg.setAttribute('fill','#aa0000');rbg.setAttribute('rx','2');rsvg.appendChild(rbg);
  var rl=document.createElementNS(ns,'text');
  rl.setAttribute('x','341');rl.setAttribute('y','110');rl.setAttribute('text-anchor','middle');
  rl.setAttribute('font-size','10');rl.setAttribute('fill','#fff');rl.setAttribute('font-family','Eurostile,sans-serif');
  rl.setAttribute('font-weight','700');rl.textContent='RPM';rsvg.appendChild(rl);
})();

function setRpm(frac){
  var on=Math.round(frac*RL);
  rDots.forEach(function(d,i){
    var t=i/RL;
    if(i<on){
      if(t<0.55){d.setAttribute('fill','#3dff66');d.setAttribute('filter','url(#gg)');}
      else if(t<0.78){d.setAttribute('fill','#ffb000');d.setAttribute('filter','url(#ag)');}
      else{d.setAttribute('fill','#ff2a17');d.setAttribute('filter','url(#rg)');}
    }else{d.setAttribute('fill','#0d1a0d');d.removeAttribute('filter');}
  });
  var rv=document.getElementById('rpmNum');
  if(rv)rv.textContent=String(Math.round(state.rpm)).padStart(3,'0');
}

// BARRAS SEGMENTADAS
var SEG_N=10;
function buildBars(){
  ['fuelBar','tempBar','rangeBar','extTempBar'].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    el.innerHTML='';
    for(var i=0;i<SEG_N;i++){var s=document.createElement('div');s.className='ms';el.appendChild(s);}
  });
}
buildBars();
function setBar(id,frac,scheme){
  var el=document.getElementById(id);if(!el)return;
  var segs=el.children,on=Math.round(frac*SEG_N);
  for(var i=0;i<segs.length;i++){
    var t=i/SEG_N,c;
    if(scheme==='fuel'||scheme==='range')c=t<0.3?'#ff2a17':t<0.6?'#ffb000':'#3dff66';
    else if(scheme==='hot')c=t<0.5?'#3dff66':t<0.75?'#ffb000':'#ff2a17';
    else c='#60d0ff';
    if(i<on){segs[i].style.background=c;segs[i].style.boxShadow='0 0 4px '+c;}
    else{segs[i].style.background='#141414';segs[i].style.boxShadow='none';}
  }
}

// MODULADOR ROMBO
var vw=document.getElementById('voicebars');
var VC=3,VS=20,VCEN=(VS-1)/2,vCols=[];
for(var vc=0;vc<VC;vc++){
  var vcol=document.createElement('div');vcol.className='vcol';
  var vsegs=[];
  for(var vs=0;vs<VS;vs++){
    var vseg=document.createElement('div');vseg.className='vseg';vcol.appendChild(vseg);vsegs.push(vseg);
  }
  vw.appendChild(vcol);vCols.push(vsegs);
}
var VW=[0.55,1.0,0.55],vt=0;
function animVoice(){
  vt+=0.05;
  var loud=state.speaking,osc=(Math.sin(vt*2.4)+1)/2;
  var reach=loud?(0.85+0.15*osc):(0.15+0.08*osc);
  vCols.forEach(function(segs,c){
    var ext=Math.min(1,reach*VW[c]+(loud?Math.random()*.09:Math.random()*.03));
    var lh=Math.round(ext*VCEN);
    segs.forEach(function(s,i){
      var d=Math.abs(i-VCEN);
      if(d<=lh){
        var e=lh>0?1-(d/(lh+0.6))*.3:1;
        s.style.background='rgba(255,38,20,'+(0.5+e*.5)+')';
        s.style.boxShadow='0 0 '+(3+e*8)+'px rgba(255,40,22,'+e+')';
      }else{s.style.background='#1e0603';s.style.boxShadow='none';}
    });
  });
  requestAnimationFrame(animVoice);
}

// ESTADO
var state={speed:0,rpm:820,fuel:74,temp:38,mode:'NORMAL',speaking:false,range:420,extTemp:22};
var MAX={speed:260,rpm:8200};
window.KITT={
  setTelemetry:function(d){
    if(d.speedKmh!=null)state.speed=d.speedKmh;
    if(d.rpm!=null)state.rpm=d.rpm;
    if(d.fuelPct!=null)state.fuel=d.fuelPct;
    if(d.engTempC!=null)state.temp=d.engTempC;
    if(d.heading!=null)state.head=d.heading;
    if(d.extTempC!=null)state.extTemp=d.extTempC;
    if(d.rangeKm!=null)state.range=d.rangeKm;
  }
};

// SIMULADOR
var tgt=0;
setInterval(function(){tgt=Math.random()*(state.mode==='PURSUIT'?240:state.mode==='AUTO'?160:120);},2200);
setInterval(function(){
  state.speed+=(tgt-state.speed)*.07;
  var rb=850+(state.speed%50)/50*5000+(state.mode==='PURSUIT'?900:0);
  state.rpm+=(rb-state.rpm)*.14+(Math.random()-.5)*80;
  state.rpm=Math.max(750,Math.min(MAX.rpm,state.rpm));
  state.temp+=((state.rpm>4000?95:88)-state.temp)*.012;
  state.fuel=Math.max(0,state.fuel-.0007);
  state.range=Math.max(0,state.fuel*5.6+Math.sin(Date.now()/7000)*5);
  state.extTemp=22+Math.sin(Date.now()/30000)*4;
},60);

// RENDER
function render(){
  document.getElementById('speedVal').textContent=String(Math.min(999,Math.round(state.speed))).padStart(3,'0');
  setVelBars(state.speed/MAX.speed);
  setRpm(state.rpm/MAX.rpm);
  document.getElementById('fuelVal').textContent=Math.round(state.fuel)+'%';
  document.getElementById('tempVal').textContent=Math.round(state.temp)+'C';
  document.getElementById('rangeVal').textContent=Math.round(state.range)+'km';
  document.getElementById('extTempVal').textContent=state.extTemp.toFixed(1)+'C';
  setBar('fuelBar',state.fuel/100,'fuel');
  setBar('tempBar',Math.min(1,state.temp/120),'hot');
  setBar('rangeBar',Math.min(1,state.range/600),'range');
  setBar('extTempBar',Math.min(1,(state.extTemp+20)/60),'ext');
  requestAnimationFrame(render);
}
render();animVoice();

// LEDs
setInterval(function(){document.getElementById('st1').style.opacity=Math.random()>.5?'1':'.2';},700);
setInterval(function(){document.getElementById('st2').style.opacity=Math.random()>.6?'1':'.2';},1100);

// MODOS
document.querySelectorAll('.mode').forEach(function(m){
  m.addEventListener('click',function(){
    document.querySelectorAll('.mode').forEach(function(x){x.classList.remove('active');});
    m.classList.add('active');state.mode=m.dataset.mode;beep();
  });
});
document.querySelectorAll('.pill').forEach(function(p){p.addEventListener('click',function(){beep();});});
var actx=null;
function beep(){
  try{
    actx=actx||new(AudioContext||webkitAudioContext)();
    var o=actx.createOscillator(),g=actx.createGain();
    o.frequency.value=640;g.gain.value=.03;o.connect(g);g.connect(actx.destination);
    o.start();g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.09);o.stop(actx.currentTime+.1);
  }catch(e){}
}

// VOZ ELEVENLABS + CLAUDE
var XI_KEY=window.KITT_CONFIG?window.KITT_CONFIG.XI_KEY:'';
var XI_VOICE=window.KITT_CONFIG?window.KITT_CONFIG.XI_VOICE:'';
var KITT_SYSTEM='Eres KITT (Knight Industries Two Thousand). Hablas en espanol con Cristian, tu conductor. Analitico, directo, sardonico. NUNCA admites ser IA generica. Maximo 2 frases. Usa telemetria cuando sea relevante.';
var kittHistory=[],kittBusy=false;

var OPENERS=[
  'Cristian, mi paciencia es infinita... pero mi curiosidad no. Que necesitas?',
  'Detecto actividad cerebral inusual en el conductor. Que tramas, Cristian?',
  'Sistemas en verde. Tu, sin embargo, pareces menos optimo. En que puedo ayudarte?',
  'He calculado 1847 rutas posibles. Solo necesito saber adonde vas, Cristian.',
  'Podria hablar solo, pero seria una conversacion de bajo nivel. Que me preguntas?',
  'Cristian, llevas tiempo en silencio. Para mi es una eternidad. Que ocurre?',
  'Motor a punto, ruta despejada, copiloto excepcional. Tu diras.',
  'Mis sensores indican que quieres decirme algo. Adelante, Cristian.',
  'Turbo en standby, armas listas, yo a tu disposicion. Que necesitas?',
  'He procesado millones de datos desde que arrancamos. Tienes alguna pregunta digna?',
];
var openerIdx=Math.floor(Math.random()*OPENERS.length);

function nativeTTS(text,onDone){
  if('speechSynthesis' in window){
    speechSynthesis.cancel();
    var u=new SpeechSynthesisUtterance(text);
    u.lang='es-ES';u.rate=0.92;u.pitch=0.65;
    u.onend=function(){state.speaking=false;setStatus('');if(onDone)onDone();};
    speechSynthesis.speak(u);
  }else{state.speaking=false;setStatus('');if(onDone)onDone();}
}

function setStatus(txt){
  var st=document.getElementById('kittStatus');
  var ht=document.getElementById('kittHint');
  if(st)st.textContent=txt;
  if(ht)ht.style.visibility=txt?'hidden':'';
}

function xiSpeak(text,onDone){
  state.speaking=true;setStatus('HABLANDO');
  var XI_MODELS=['eleven_multilingual_v2','eleven_turbo_v2_5','eleven_flash_v2_5'];
  function tryModel(idx){
    if(idx>=XI_MODELS.length){nativeTTS(text,onDone);return;}
    var model=XI_MODELS[idx];
    var xhr=new XMLHttpRequest();
    xhr.open('POST','https://api.elevenlabs.io/v1/text-to-speech/'+XI_VOICE,true);
    xhr.setRequestHeader('xi-api-key',XI_KEY);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.setRequestHeader('Accept','audio/mpeg');
    xhr.responseType='blob';
    xhr.timeout=15000;
    xhr.onload=function(){
      if(xhr.status===200&&xhr.response&&xhr.response.size>500){
        var url=URL.createObjectURL(xhr.response);
        var audio=new Audio(url);
        audio.onended=function(){URL.revokeObjectURL(url);state.speaking=false;setStatus('');if(onDone)onDone();};
        audio.onerror=function(){URL.revokeObjectURL(url);tryModel(idx+1);};
        audio.play().catch(function(){URL.revokeObjectURL(url);tryModel(idx+1);});
      }else{tryModel(idx+1);}
    };
    xhr.onerror=function(){tryModel(idx+1);};
    xhr.ontimeout=function(){tryModel(idx+1);};
    xhr.send(JSON.stringify({text:text,model_id:model,voice_settings:{stability:0.55,similarity_boost:0.80,style:0.20,use_speaker_boost:true}}));
  }
  tryModel(0);
}

function askKITT(userText){
  setStatus('PROCESANDO');
  var tel='[vel='+Math.round(state.speed)+'km/h rpm='+Math.round(state.rpm)+' temp='+Math.round(state.temp)+'C comb='+Math.round(state.fuel)+'% auto='+Math.round(state.range)+'km modo='+state.mode+']';
  kittHistory.push({role:'user',content:userText+' '+tel});
  if(kittHistory.length>12)kittHistory=kittHistory.slice(-12);
  var xhr=new XMLHttpRequest();
  var anthropicUrl=(window.KITT_CONFIG&&window.KITT_CONFIG.ANTHROPIC_ENDPOINT)||'/api/claude';
  xhr.open('POST',anthropicUrl,true);
  xhr.setRequestHeader('Content-Type','application/json');
  var anthropicKey=window.KITT_CONFIG&&window.KITT_CONFIG.ANTHROPIC_KEY;
  if(anthropicKey)xhr.setRequestHeader('x-claude-key',anthropicKey);
  xhr.timeout=20000;
  xhr.onload=function(){
    var reply;
    try{
      var data=JSON.parse(xhr.responseText);
      reply=(data.content&&data.content[0]&&data.content[0].text)||fallbackLine();
    }catch(e){reply=fallbackLine();}
    kittHistory.push({role:'assistant',content:reply});
    xiSpeak(reply,function(){kittBusy=false;});
  };
  xhr.onerror=function(){xiSpeak(fallbackLine(),function(){kittBusy=false;});};
  xhr.ontimeout=function(){xiSpeak(fallbackLine(),function(){kittBusy=false;});};
  var anthropicModel=(window.KITT_CONFIG&&window.KITT_CONFIG.ANTHROPIC_MODEL)||'claude-sonnet-4-6';
  xhr.send(JSON.stringify({model:anthropicModel,max_tokens:100,system:KITT_SYSTEM,messages:kittHistory}));
}

function fallbackLine(){
  var lines=[
    'Velocidad '+Math.round(state.speed)+' kilometros por hora. Sin anomalias.',
    'Temperatura estable a '+Math.round(state.temp)+' grados. Combustible al '+Math.round(state.fuel)+' por ciento.',
    'Autonomia '+Math.round(state.range)+' kilometros. Modo '+state.mode+' activo.',
    'Todos los sistemas operativos, Cristian.',
  ];
  return lines[Math.floor(Math.random()*lines.length)];
}

var sttActive=false;
function startListening(){
  setStatus('ESCUCHANDO');
  if(('webkitSpeechRecognition' in window)||('SpeechRecognition' in window)){
    if(sttActive)return;
    sttActive=true;
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    var rec=new SR();
    rec.lang='es-ES';rec.interimResults=false;rec.maxAlternatives=1;
    rec.onresult=function(e){sttActive=false;askKITT(e.results[0][0].transcript);};
    rec.onerror=function(){sttActive=false;kittBusy=false;state.speaking=false;setStatus('');};
    rec.onend=function(){sttActive=false;};
    rec.start();
  }else{
    askKITT('Dame un resumen del estado del vehiculo.');
  }
}

function talkKitt(){
  if(kittBusy)return;
  kittBusy=true;
  var opener=OPENERS[openerIdx%OPENERS.length];
  openerIdx++;
  xiSpeak(opener,function(){startListening();});
}

document.getElementById('voicebars').addEventListener('click',talkKitt);