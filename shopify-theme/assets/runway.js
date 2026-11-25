/* Runway section: ring/classic look carousel with pins, popup view and shoppable pieces.
   Cart actions go through window.theme.cart (assets/theme.js), i.e. the real Shopify cart. */
(()=>{
'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

class RunwaySection extends HTMLElement{
  connectedCallback(){
    if(this._ready) return;
    this._ready=true;
    this._ac=new AbortController();
    this.init();
  }
  disconnectedCallback(){
    this._ready=false;
    cancelAnimationFrame(this.raf);cancelAnimationFrame(this.cRaf);
    clearTimeout(this.timer);clearTimeout(this.rzT);clearTimeout(this.lbT);
    this.io&&this.io.disconnect();this.io2&&this.io2.disconnect();this.ro&&this.ro.disconnect();
    this._ac&&this._ac.abort();
    this.undock();
  }
  $(s,r){return (r||this).querySelector(s)}
  $$(s,r){return Array.from((r||this).querySelectorAll(s))}
  init(){
    const d=this.dataset;
    this.n=this.$$('[data-rw-tick]').length;
    this.feel=d.feel==='balanced'?{K:95,lag:.04}:{K:95,lag:.04};
    this.K=this.feel.K;this.C=2*Math.sqrt(this.K);
    this.speed=+d.speed||5000;
    this.stage=this.$('[data-rw-stage]');
    this.actors=this.$('[data-rw-actors]');
    this.heroWrap=this.$('[data-rw-heroes]');
    this.heroes=this.$$('[data-rw-hero]');
    this.ticks=this.$$('[data-rw-tick]');
    this.panels=this.$$('[data-rw-panel]');
    this.panelEl=this.$('.rw__panel');
    this.live=this.$('[data-rw-live]');
    this.piecesEl=this.$('[data-rw-pieces]');
    this.lb=this.$('[data-rw-lb]');
    this.lbStage=this.$('[data-rw-lb-stage]');
    this.autoBtn=this.$('[data-rw-auto]');
    this.cursorEl=this.$('[data-rw-cursor]');
    const orig=this.$$('[data-rw-model]',this.actors);
    const base=orig.length;
    this.N=this.n*Math.ceil(8/this.n);
    for(let a=base;a<this.N;a++){
      const c=orig[a%base].cloneNode(true);
      c.setAttribute('data-rw-clone','');c.dataset.a=a;
      c.querySelectorAll('img').forEach(i=>i.loading='lazy');
      this.actors.appendChild(c);
    }
    this.bodies=this.$$('[data-rw-model]',this.actors).map((el,a)=>({el,a,look:a%this.n,hit:el.querySelector('.rw__hit'),w:0,x:0,g:0,v:0,goal:0,trip:false,from:0,last:{},settled:true}));
    this.index=0;this.target=0;this.cur=0;this.vel=0;
    this.start=reduced()?0:1.15;
    this.cur=-this.start;
    this.still=false;this.dragging=false;this.playing=false;this.engaged=false;
    this.panelHover=false;this.zoomed=false;this.visible=false;this.vh=0;this.lastW=0;this.sheet=null;
    this.hasCursor=matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.wheelAcc=0;this.wheelLock=0;this.suppressClick=0;
    this.classList.add('rw--js');
    this.decodeImages();
    this.detectFeet();
    this.bindCards();
    this.measure();
    this.setIndex(0,true);
    this.initBodies();
    this.renderAll();
    this.bind();
    this.observe();
    if(this.dataset.autoplay==='true'&&!reduced()) this.play(true);
    if(!this.hasCursor&&this.cursorEl) this.cursorEl.remove(); else this.classList.add('rw--cursor');
  }
  get mobile(){return innerWidth<=749}
  get ringMode(){return !this.mobile&&this.dataset.style==='ring'}

  /* ---- images ---- */
  decodeImages(){
    const mark=img=>img.classList.add('is-decoded');
    this.$$('img[data-model-image]').forEach(img=>{
      img.addEventListener('load',()=>mark(img),{once:true});
      if(img.decode) img.decode().then(()=>mark(img)).catch(()=>{if(img.naturalWidth) mark(img)});
      else if(img.complete&&img.naturalWidth) mark(img);
    });
  }
  detectFeet(){
    this.heroes.forEach((hero,i)=>{
      const url=hero.dataset.probe;if(!url) return;
      const img=new Image();img.crossOrigin='anonymous';
      img.onload=()=>{
        try{
          const w=48,h=Math.max(1,Math.round(w*img.naturalHeight/img.naturalWidth));
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,w,h);
          const px=cx.getImageData(0,0,w,h).data;
          let last=-1;
          for(let y=h-1;y>=0&&last<0;y--) for(let x=0;x<w;x++) if(px[(y*w+x)*4+3]>40){last=y;break}
          if(last<0) return;
          const foot=clamp((h-1-last)/h,0,.4);
          hero.style.setProperty('--rw-foot',foot);
          this.bodies.forEach(b=>{if(b.look===i) b.el.style.setProperty('--rw-foot',foot)});
        }catch(e){}
      };
      img.src=url;
    });
  }

  /* ---- measure ---- */
  measure(){
    const mobile=this.mobile;
    let hdr=0;
    document.querySelectorAll('.shopify-section-group-header-group, #shopify-section-header, #shopify-section-announcement-bar').forEach(e=>{
      if(!e.contains(this)&&e.offsetParent!==null) hdr+=e.offsetHeight;
    });
    if(mobile){
      if(!this.vh||innerWidth!==this.lastW||Math.abs(innerHeight-this.vh)>=160) this.vh=innerHeight;
      const pct=clamp(+this.dataset.mheightVh||109,50,120);
      this.style.setProperty('--rw-frame-h',(this.vh*pct/100)+'px');
    }else{
      this.vh=innerHeight;
      this.style.setProperty('--rw-frame-h',Math.max(380,innerHeight-hdr)+'px');
    }
    const modeWas=this.modeRing;
    this.lastW=innerWidth;
    const r=this.stage.getBoundingClientRect();
    this.W=r.width;this.H=r.height;
    const ring=this.ringMode;
    this.fs=ring?1.08:1;
    this.stage.style.setProperty('--rw-fs',this.fs);
    let mh;
    if(ring) mh=Math.max(200,Math.round((this.H-34-18)/1.08));
    else mh=Math.max(200,Math.round(this.H-(mobile?24:36)-18));
    this.stage.style.setProperty('--rw-model-h',mh+'px');
    this.modelH=mh;
    const hx=ring?.5*this.W:(mobile?.3*this.W:.4*this.W);
    const hy=ring?34:(mobile?22:36);
    this.stage.style.setProperty('--rw-hx',hx+'px');
    this.stage.style.setProperty('--rw-hy',hy+'px');
    this.style.setProperty('--rw-ax',(this.W?hx/this.W*100:40)+'%');
    this.bodies.forEach(b=>{b.w=b.el.offsetWidth||mh*.5625});
    if(modeWas!==undefined&&modeWas!==ring){
      this.cur=this.target;this.vel=0;
      this.initBodies(true);
      if(this.sheet&&!mobile) this.undock();
    }
    this.modeRing=ring;
    this.mobileNow=mobile;
  }
  initBodies(snap){
    const N=this.N;
    this.bodies.forEach(b=>{
      const goal=this.wrapN(b.a-this.target);
      b.goal=goal;b.trip=false;b.v=0;
      b.g=snap?goal:goal+(reduced()?0:this.start);
      b.x=b.g;b.settled=false;
    });
  }
  wrapN(v){const N=this.N;return ((v%N)+N)%N}

  /* ---- placement ---- */
  put(b,x,bottom,scale,op,blur,z){
    const W=this.W;
    if(x+b.w*scale/2<-4||x-b.w*scale/2>W+4) op=0;
    const el=b.el,s=el.style,l=b.last;
    const t=`translate3d(${x.toFixed(2)}px,${(-bottom).toFixed(2)}px,0) translateX(-50%) scale(${scale.toFixed(4)})`;
    if(l.t!==t){s.transform=t;l.t=t}
    const o=op.toFixed(3);
    if(l.o!==o){s.opacity=o;l.o=o}
    const vis=op<.01?'hidden':'visible';
    if(l.v!==vis){s.visibility=vis;l.v=vis}
    const pe=op<.5?'none':'auto';
    if(l.p!==pe){s.pointerEvents=pe;l.p=pe}
    if(l.z!==z){s.zIndex=z;l.z=z}
    const bl=Math.round(blur*10)/10;
    if(l.b!==bl){s.filter=bl>.05&&this.dataset.blur==='true'?`blur(${bl}px)`:'';l.b=bl}
  }
  renderAll(){
    if(!this.W) return;
    if(this.ringMode) this.renderRing(); else this.renderClassic();
  }
  renderRing(){
    const W=this.W,H=this.H,N=this.N,mobile=this.mobile;
    const cx=.5*W,R=(mobile?.72:.62)*W,P=(mobile?1.9:1.65)*W,floor=H-34,horizon=.36*H,step=2*Math.PI/N,fs=this.fs;
    for(const b of this.bodies){
      let phi=((b.a-this.cur)*step)%(2*Math.PI);
      if(phi>Math.PI) phi-=2*Math.PI;
      if(phi<=-Math.PI) phi+=2*Math.PI;
      if(phi<-Math.PI) phi+=2*Math.PI;
      const z=R*(1-Math.cos(phi)),persp=P/(P+z),sl=Math.abs(phi)/step;
      const scale=persp*(1+(fs-1)*clamp(1-sl,0,1));
      const x=cx+R*Math.sin(phi)*persp;
      const feet=horizon+(floor-horizon)*persp;
      const bottom=H-feet;
      const blur=sl<=1?1.8*sl:Math.min(1.8+(sl-1)*2,6.5);
      let op=clamp((Math.cos(phi)+.55)/.3,0,1);
      if(this.still&&sl<.02) op=0;
      this.put(b,x,bottom,scale,op,blur,Math.round(scale*1000));
    }
  }
  renderClassic(){
    const W=this.W,mobile=this.mobile;
    const ax=mobile?.3:.4,ay=mobile?22:36,sx=mobile?.32:.125,sy=mobile?22:58,sr=.76,ex=mobile?.55:.38,d=mobile?4:5;
    for(const b of this.bodies){
      let k=b.x,e=-1;
      if(b.trip){
        const span=Math.abs(b.goal-b.from)||1;
        const u=clamp(Math.abs(b.x-b.from)/span,0,1);
        if(b.goal>b.from){
          if(u<.5) e=2*u*1.4; else k=b.goal+2*(1-u);
        }else{
          if(u<.5) k=b.from+2*u; else e=2*(1-u)*1.4;
        }
      }else if(k<0){e=Math.min(-k,1.4)}
      if(e>=0){
        this.put(b,W*(ax-ex*e),ay-22*e,1+.14*e,Math.max(0,1-1.05*e),4*Math.min(e,1),1100);
      }else{
        const scale=Math.pow(sr,k);
        const op=k<=d-1?1-.13*k:Math.max(0,.61*(d-k));
        let o=op;
        if(this.still&&Math.abs(k)<.02) o=0;
        this.put(b,W*(ax+sx*k),ay+sy*k,scale,o,Math.min(.9*k,3.2),1000-Math.round(10*k));
      }
    }
  }

  /* ---- loop ---- */
  kick(){
    if(this.raf||!this.visible||document.hidden) return;
    this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  frame(t){
    this.raf=0;
    const dt=this.last?Math.min(.034,(t-this.last)/1000):1/60;
    this.last=t;
    let moving=false;
    if(!this.dragging) {}
    if(this.ringMode){
      const h=dt/3;
      for(let i=0;i<3;i++){
        const acc=-this.K*(this.cur-this.target)-this.C*this.vel;
        this.vel+=acc*h;this.cur+=this.vel*h;
      }
      if(Math.abs(this.cur-this.target)<=.0005&&Math.abs(this.vel)<=.0005){this.cur=this.target;this.vel=0}
      else moving=true;
      this.renderAll();
    }else{
      const N=this.N;
      for(const b of this.bodies){
        const goal=this.wrapN(b.a-this.target);
        if(Math.abs(goal-b.goal)>N/2){b.trip=true;b.from=b.x}
        b.goal=goal;
        const tau=this.dragging?.016:(b.trip?.1:.03+.04*Math.min(goal,4));
        b.g+=(goal-b.g)*(1-Math.exp(-dt/tau));
        const h=dt/3;
        for(let i=0;i<3;i++){
          const acc=-this.K*(b.x-b.g)-this.C*b.v;
          b.v+=acc*h;b.x+=b.v*h;
        }
        if(b.trip&&Math.abs(b.x-goal)<.02){b.trip=false;b.x=goal;b.g=goal;b.v=0}
        if(Math.abs(b.x-b.g)<.0006&&Math.abs(b.v)<.0006&&Math.abs(b.g-goal)<.0006&&!b.trip){b.x=goal;b.g=goal;b.v=0;b.settled=true}
        else {b.settled=false;moving=true}
      }
      this.renderAll();
    }
    if(moving||this.dragging){this.raf=requestAnimationFrame(t=>this.frame(t))}
    else{this.setStill(true);this.renderAll()}
  }
  setStill(v){
    if(this.still===v) return;
    this.still=v;this.classList.toggle('rw--still',v);
    if(v) this.renderAll();
  }
  settleNow(){
    if(this.ringMode){this.cur=this.target;this.vel=0}
    else this.bodies.forEach(b=>{const g=this.wrapN(b.a-this.target);b.goal=g;b.x=b.g=g;b.v=0;b.trip=false});
    this.setStill(true);this.renderAll();
  }

  /* ---- navigation ---- */
  moveTo(T){
    this.target=T;
    this.setStill(false);
    this.setIndex(((T%this.n)+this.n)%this.n);
    if(reduced()) this.settleNow(); else this.kick();
    if(!this.visible&&!reduced()) {this.cur=this.target;this.bodies.forEach(b=>{b.x=b.g=b.goal=this.wrapN(b.a-this.target)});this.setStill(true);this.renderAll()}
  }
  next(){this.moveTo(Math.round(this.target)+1)}
  prev(){this.moveTo(Math.round(this.target)-1)}
  go(i){
    let d=(((i-this.index)%this.n)+this.n)%this.n;
    if(d>3) d-=this.n;
    this.moveTo(Math.round(this.target)+d);
  }
  rankOf(b){
    const N=this.N;
    let k=this.wrapN(b.a-this.index);
    if(this.ringMode&&k>N/2) k-=N;
    return k;
  }
  setIndex(i,silent){
    const changed=i!==this.index;
    const old=this.index;
    this.index=i;
    this.kick();
    const lim=this.ringMode?2:3;
    for(const b of this.bodies){
      const k=this.rankOf(b);
      const ok=k!==0&&Math.abs(k)<=lim;
      if(b.hit) b.hit.tabIndex=ok?0:-1;
      if(ok) b.el.removeAttribute('aria-hidden'); else b.el.setAttribute('aria-hidden','true');
    }
    if(!changed&&!silent) return;
    if(!silent){
      this.closeZoom(true);
      if(this.mobile) this.closeSheet();
    }
    this.style.setProperty('--rw-progress',((i+1)/this.n).toFixed(3));
    this.heroes.forEach((h,j)=>{
      const on=j===i;
      h.classList.toggle('is-on',on);
      h.classList.toggle('was',j===old&&!on);
      h.setAttribute('aria-hidden',on?'false':'true');
      const z=h.querySelector('[data-rw-zoom]');if(z) z.tabIndex=on?0:-1;
    });
    const name=this.heroes[i].dataset.label;
    if(!silent){
      if(!reduced()){
        this.stage.classList.remove('is-sweep');void this.stage.offsetWidth;this.stage.classList.add('is-sweep');
      }
      if(this.live) this.live.textContent=name;
    }
    this.ticks.forEach((t,j)=>{
      t.setAttribute('aria-current',j===i?'true':'false');
      t.classList.toggle('is-past',j<i);
    });
    this.panels.forEach(p=>{p.hidden=true;p.classList.remove('is-in')});
    const p=this.panels[i];
    p.hidden=false;
    if(silent){p.classList.add('is-in')}
    else{void p.offsetWidth;p.classList.add('is-in')}
    const tpl=p.querySelector('template[data-rw-pieces-text]');
    if(this.piecesEl&&tpl){
      this.piecesEl.textContent=tpl.content.textContent||tpl.textContent;
      this.piecesEl.classList.remove('is-swap');void this.piecesEl.offsetWidth;if(!silent) this.piecesEl.classList.add('is-swap');
    }
    this.clearHot();
    this.restartBar();
  }

  /* ---- autoplay ---- */
  play(on){
    this.playing=!!on;
    this.classList.toggle('is-playing',this.playing);
    if(this.autoBtn){
      this.autoBtn.classList.toggle('is-playing',this.playing);
      this.autoBtn.setAttribute('aria-pressed',this.playing?'true':'false');
    }
    this.restartBar();
  }
  restartBar(){
    clearTimeout(this.timer);
    this.ticks.forEach(t=>t.classList.remove('is-run'));
    if(!this.playing) return;
    void this.offsetWidth;
    this.ticks[this.index]&&this.ticks[this.index].classList.add('is-run');
    this.timer=setTimeout(()=>{
      if(this.playing&&this.visible&&!this.dragging&&!document.hidden&&!this.panelHover&&!this.zoomed&&!this.engaged) this.next();
      else this.restartBar();
    },this.speed);
  }
  engage(){this.engaged=true;if(this.playing) this.play(false)}

  /* ---- observers ---- */
  observe(){
    this.io=new IntersectionObserver(es=>{
      this.visible=es.some(e=>e.isIntersecting);
      if(this.visible) this.kick();
    },{threshold:0});
    this.io.observe(this);
    const reveal=()=>{
      if(reduced()){this.classList.add('is-revealed');return}
      this.io2=new IntersectionObserver(es=>{
        if(es.some(e=>e.isIntersecting)){
          this.io2.disconnect();
          requestAnimationFrame(()=>requestAnimationFrame(()=>this.classList.add('is-revealed')));
        }
      },{threshold:0,rootMargin:'0px 0px -22% 0px'});
      this.io2.observe(this);
    };
    reveal();
    this.ro=new ResizeObserver(()=>this.onResize());
    this.ro.observe(this.stage);
    addEventListener('resize',()=>{clearTimeout(this.rzT);this.rzT=setTimeout(()=>this.onResize(),120)},{signal:this._ac.signal});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.kick();this.restartBar()}},{signal:this._ac.signal});
  }
  onResize(){
    this.measure();
    this.renderAll();
    if(this.zoomed) this.layoutZoom();
    this.kick();
  }

  /* ---- events ---- */
  bind(){
    const sig={signal:this._ac.signal};
    const st=this.stage;
    st.addEventListener('pointerdown',e=>this.pdown(e),sig);
    st.addEventListener('pointermove',e=>this.pmove(e),sig);
    st.addEventListener('pointerup',e=>this.pup(e),sig);
    st.addEventListener('pointercancel',e=>this.pup(e),sig);
    st.addEventListener('click',e=>{if(performance.now()<this.suppressClick){e.stopPropagation();e.preventDefault()}},{capture:true,signal:this._ac.signal});
    st.addEventListener('wheel',e=>{
      if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now=performance.now();
      if(now<this.wheelLock) return;
      this.wheelAcc+=e.deltaX;
      if(Math.abs(this.wheelAcc)>45){
        if(this.wheelAcc>0) this.next(); else this.prev();
        this.wheelAcc=0;this.wheelLock=now+520;
      }
    },{passive:false,signal:this._ac.signal});
    st.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'){e.preventDefault();this.next()}
      else if(e.key==='ArrowLeft'){e.preventDefault();this.prev()}
    },sig);
    this.addEventListener('keydown',e=>{
      if(e.key==='Escape') this.onEscape(e);
    },sig);
    this.addEventListener('click',e=>this.onClick(e),sig);
    this.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.rw__panel')&&e.target.closest('button,a,input,select,label')) this.engage()},sig);
    this.addEventListener('change',e=>{
      if(e.target.matches&&e.target.matches('input[data-rw-option]')){this.engage();this.onOption(e.target,true)}
      else if(e.target.closest&&e.target.closest('.rw__panel')) this.engage();
    },sig);
    if(this.panelEl){
      this.panelEl.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){this.panelHover=true}},sig);
      this.panelEl.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){this.panelHover=false;this.restartBar()}},sig);
      this.panelEl.addEventListener('pointerover',e=>{
        if(e.pointerType!=='mouse') return;
        const c=e.target.closest('.rw__item');
        if(c&&c.dataset.rwCard) this.hot(+c.dataset.rwCard,false);
      },sig);
      this.panelEl.addEventListener('pointerout',e=>{
        if(e.pointerType!=='mouse') return;
        const c=e.target.closest('.rw__item');
        if(c&&!c.contains(e.relatedTarget)) this.clearHot();
      },sig);
    }
    if(this.hasCursor&&this.cursorEl) this.bindCursor(sig);
    this.lbStage.addEventListener('click',e=>{if(e.target===this.lbStage) this.closeZoom()},sig);
  }
  onEscape(e){
    if(this.sheet){const b=this.sheet.card.querySelector('[data-rw-add]');this.closeSheet();b&&b.focus();return}
    if(this.zoomed) this.closeZoom();
  }
  pdown(e){
    if(e.pointerType==='mouse'&&e.button!==0) return;
    if(this.zoomed) return;
    this.pid=e.pointerId;this.sx=e.clientX;this.sy=e.clientY;this.t0=this.target;
    this.samples=[{x:e.clientX,t:performance.now()}];this.dragStarted=false;
  }
  unit(){return this.ringMode?Math.max(120,.3*this.W):Math.max(90,this.W*.32*1.6)}
  pmove(e){
    if(this.hasCursor&&this.cursorEl&&e.pointerType==='mouse') this.cursorMove(e);
    if(this.pid==null||e.pointerId!==this.pid) return;
    if(e.pointerType==='mouse'&&e.buttons===0){this.endDrag(e);return}
    const dx=e.clientX-this.sx,dy=e.clientY-this.sy;
    this.samples.push({x:e.clientX,t:performance.now()});
    if(this.samples.length>6) this.samples.shift();
    if(!this.dragStarted){
      if(Math.abs(dx)>8&&Math.abs(dx)>1.2*Math.abs(dy)){
        this.dragStarted=true;this.dragging=true;
        this.classList.add('is-dragging');
        try{this.stage.setPointerCapture(e.pointerId)}catch(_){}
        this.setStill(false);
      }else if(Math.abs(dy)>10){this.pid=null;return}
      else return;
    }
    this.target=this.t0-dx/this.unit();
    this.setStill(false);this.kick();
  }
  pup(e){
    if(this.pid==null||e.pointerId!==this.pid) return;
    this.endDrag(e);
  }
  endDrag(e){
    const was=this.dragStarted;
    this.pid=null;
    if(!was) return;
    this.dragging=false;this.dragStarted=false;
    this.classList.remove('is-dragging');
    try{this.stage.releasePointerCapture(e.pointerId)}catch(_){}
    this.suppressClick=performance.now()+60;
    const dx=e.clientX-this.sx;
    const f=this.samples[0],l=this.samples[this.samples.length-1];
    const vx=l.t>f.t?(l.x-f.x)/(l.t-f.t):0;
    const sign=-1,from=Math.round(this.t0);
    if(this.mobile){
      if(Math.abs(dx)>30||Math.abs(vx)>.3) this.moveTo(from+sign*(dx>0?1:-1));
      else this.moveTo(from);
    }else{
      let i=Math.round(this.target+sign*vx*160/this.unit());
      if(i===from&&Math.abs(vx)>.3) i=from+sign*(vx>0?1:-1);
      i=clamp(i,from-2,from+2);
      this.moveTo(i);
    }
  }

  /* ---- cursor ---- */
  bindCursor(sig){
    this.cx=0;this.cy=0;this.tx=0;this.ty=0;this.cFirst=true;
    this.stage.addEventListener('pointerleave',()=>{
      this.cursorEl.classList.remove('is-on','is-link','is-view');
    },sig);
  }
  cursorMove(e){
    const r=this.stage.getBoundingClientRect();
    this.tx=e.clientX-r.left;this.ty=e.clientY-r.top;
    const c=this.cursorEl;
    if(this.cFirst||!c.classList.contains('is-on')){
      this.cx=this.tx;this.cy=this.ty;this.cFirst=false;
      c.style.transform=`translate3d(${this.cx}px,${this.cy}px,0)`;
      c.classList.add('is-on');
    }
    const tgt=e.target;
    const link=!this.dragging&&!!tgt.closest('.rw__pin, .rw__hit');
    const view=!this.dragging&&!link&&!!tgt.closest('.rw__zoom');
    c.classList.toggle('is-link',link);
    c.classList.toggle('is-view',view);
    if(!this.cRaf) this.cRaf=requestAnimationFrame(()=>this.cursorLoop());
  }
  cursorLoop(){
    this.cRaf=0;
    const k=reduced()?1:.18;
    this.cx+=(this.tx-this.cx)*k;this.cy+=(this.ty-this.cy)*k;
    this.cursorEl.style.transform=`translate3d(${this.cx.toFixed(2)}px,${this.cy.toFixed(2)}px,0)`;
    if(Math.hypot(this.tx-this.cx,this.ty-this.cy)>.2) this.cRaf=requestAnimationFrame(()=>this.cursorLoop());
  }

  /* ---- click router ---- */
  onClick(e){
    const t=e.target;
    if(!t.closest) return;
    if(t.closest('[data-rw-pick-close]')){this.closeSheet();return}
    if(t.closest('[data-rw-zoom-close]')){this.closeZoom();return}
    if(this.zoomed&&(t===this.lb||t===this.lbStage)){this.closeZoom();return}
    const zoom=t.closest('[data-rw-zoom]');
    if(zoom){this.openZoom();return}
    if(t.closest('[data-rw-next]')){this.next();return}
    if(t.closest('[data-rw-prev]')){this.prev();return}
    const tick=t.closest('[data-rw-tick]');
    if(tick){this.go(+tick.dataset.rwTick);return}
    if(t.closest('[data-rw-auto]')){
      if(!this.playing) this.engaged=false;
      this.play(!this.playing);return;
    }
    const pin=t.closest('[data-rw-pin]');
    if(pin){this.engage();this.hot(+pin.dataset.rwPin,true);return}
    const go=t.closest('[data-rw-go]');
    if(go){
      const b=this.bodies.find(b=>b.hit===go);
      if(b){
        const k=this.rankOf(b);
        if(k!==0&&Math.abs(k)<6) this.moveTo(Math.round(this.target)+k);
        else if(k===0) this.openZoom();
      }
      return;
    }
    if(t.closest('[data-rw-confirm]')){this.engage();this.confirm(t.closest('[data-rw-picker]')._card);return}
    const add=t.closest('[data-rw-add]');
    if(add){this.engage();this.togglePicker(add.closest('.rw__item'));return}
    if(t.closest('[data-rw-all]')){this.engage();this.addAll(this.panels[this.index]);return}
  }

  /* ---- hot linking ---- */
  clearHot(){this.$$('.is-hot').forEach(n=>n.classList.remove('is-hot'))}
  hot(n,scroll){
    this.clearHot();
    const root=this.zoomed?this.$('.rw__lb-model'):this.heroes[this.index];
    const pin=root&&root.querySelector(`[data-rw-pin="${n}"]`);
    if(pin) pin.classList.add('is-hot');
    const card=this.panels[this.index].querySelector(`[data-rw-card="${n}"]`);
    if(card){card.classList.add('is-hot');if(scroll) this.reveal(card)}
  }
  reveal(card){
    const list=card.closest('.rw__items');
    const beh=reduced()?'auto':'smooth';
    if(list&&list.scrollWidth>list.clientWidth+2){
      list.scrollTo({left:card.getBoundingClientRect().left-list.getBoundingClientRect().left+list.scrollLeft-20,behavior:beh});
    }else if(list&&list.scrollHeight>list.clientHeight+2){
      list.scrollTo({top:card.offsetTop-list.offsetTop-12,behavior:beh});
    }else{
      const r=card.getBoundingClientRect();
      if(r.top<0||r.bottom>innerHeight-140) scrollBy({top:r.top-.3*innerHeight,behavior:beh});
    }
  }

  /* ---- popup ---- */
  openZoom(){
    if(this.zoomed) return;
    this.engage();this.clearHot();
    const hero=this.heroes[this.index];
    const wrap=document.createElement('div');wrap.className='rw__lb-model';
    const shadow=hero.querySelector('.rw__shadow').cloneNode(true);
    const fig=hero.querySelector('.rw__figure').cloneNode(true);
    fig.querySelectorAll('[data-rw-zoom]').forEach(z=>z.remove());
    fig.querySelectorAll('.rw__pin').forEach(p=>p.tabIndex=0);
    fig.querySelectorAll('img').forEach(i=>{i.loading='eager';i.classList.add('is-decoded')});
    const foot=hero.style.getPropertyValue('--rw-foot');
    if(foot) wrap.style.setProperty('--rw-foot',foot);
    wrap.append(shadow,fig);
    this.lbStage.textContent='';this.lbStage.appendChild(wrap);
    this.$('[data-rw-lb-kicker]').textContent=(this.lb.dataset.word||'Look')+' '+String(this.index+1).padStart(2,'0');
    this.$('[data-rw-lb-name]').textContent=hero.dataset.name;
    this.layoutZoom();
    const a=hero.querySelector('.rw__figure').getBoundingClientRect();
    const b=wrap.querySelector('.rw__figure').getBoundingClientRect();
    this.zoomed=true;
    if(!reduced()&&b.height){
      wrap.style.transformOrigin='0 100%';wrap.style.transition='none';
      wrap.style.transform=`translate3d(${a.left-b.left}px,${a.bottom-b.bottom}px,0) scale(${a.height/b.height})`;
      void wrap.offsetWidth;
      wrap.style.transition='';wrap.style.transform='';
    }
    this.classList.add('rw--zoom');
    this.lb.setAttribute('aria-hidden','false');
    const cb=this.$('[data-rw-zoom-close]');cb&&cb.focus({preventScroll:true});
  }
  layoutZoom(){
    const wrap=this.$('.rw__lb-model');if(!wrap) return;
    const r=this.lbStage.getBoundingClientRect();
    const h=Math.max(160,Math.min(r.height,r.width/.5625));
    wrap.style.setProperty('--rw-model-h',h+'px');
    wrap.querySelectorAll('img').forEach(i=>i.sizes=Math.round(h*.5625)+'px');
  }
  closeZoom(silent){
    if(!this.zoomed) return;
    this.zoomed=false;
    const wrap=this.$('.rw__lb-model');
    const hadFocus=this.lb.contains(document.activeElement);
    if(wrap&&!reduced()&&!silent){
      const hero=this.heroes[this.index];
      const a=hero.querySelector('.rw__figure').getBoundingClientRect();
      const b=wrap.querySelector('.rw__figure').getBoundingClientRect();
      if(b.height){
        wrap.style.transformOrigin='0 100%';
        wrap.style.transform=`translate3d(${a.left-b.left}px,${a.bottom-b.bottom}px,0) scale(${a.height/b.height})`;
      }
    }
    this.classList.remove('rw--zoom');
    this.lb.setAttribute('aria-hidden','true');
    clearTimeout(this.lbT);
    this.lbT=setTimeout(()=>{if(!this.zoomed) this.lbStage.textContent=''},reduced()?0:950);
    if(hadFocus) this.stage.focus({preventScroll:true});
    this.clearHot();
  }

  /* ---- cards, pickers ---- */
  bindCards(){
    this.$$('.rw__item').forEach(card=>{
      const picker=card.querySelector('[data-rw-picker]');
      if(!picker) return;
      card._picker=picker;picker._card=card;
      card.dataset.selected='';
      const checked=picker.querySelector('input[data-rw-option]:checked');
      if(checked){this.onOption(checked,false);return}
      const only=this.variants(picker).find(v=>v.a);
      if(only) card.dataset.selected=only.id;
    });
  }
  variants(picker){
    if(!picker._v){
      try{picker._v=JSON.parse(picker.querySelector('[data-rw-variants]').textContent)}catch(e){picker._v=[]}
    }
    return picker._v;
  }
  onOption(input,user){
    const picker=input.closest('[data-rw-picker]');
    const card=picker._card;
    const vs=this.variants(picker);
    const picked=Array.from(picker.querySelectorAll('input[data-rw-option]:checked')).map(i=>i.value);
    const v=vs.find(v=>v.o.every((x,i)=>x===picked[i]));
    picker.querySelectorAll('input[data-rw-option]').forEach(inp=>{
      const at=+inp.dataset.rwOption;
      const ok=vs.some(x=>x.a&&x.o[at]===inp.value);
      inp.closest('.rw__pill').classList.toggle('is-unavailable',!ok);
    });
    const btn=picker.querySelector('[data-rw-confirm]');
    const lab=picker.querySelector('[data-rw-confirm-label]');
    if(v&&v.a){card.dataset.selected=v.id;btn.disabled=false;lab.textContent=lab.dataset.add}
    else{card.dataset.selected='';btn.disabled=true;lab.textContent=this.dataset.msgSoldout||'Sold out'}
    if(user) card.dataset.touched='1';
  }
  togglePicker(card){
    if(!card||card.classList.contains('is-added')||card.classList.contains('is-loading')) return;
    if(card._picker.hidden) this.openPicker(card); else this.closePicker(card);
  }
  openPicker(card){
    const picker=card._picker;
    if(this.mobile){
      if(this.sheet) this.closeSheet();
      this.dock(card);
    }
    picker.hidden=false;
    card.classList.add('is-picking');
    const btn=card.querySelector('[data-rw-add]');btn.setAttribute('aria-expanded','true');
    const c=picker.querySelector('input[data-rw-option]:checked');
    if(c) c.focus({preventScroll:true});
    if(!this.mobile) this.reveal(card);
  }
  closePicker(card){
    const picker=card._picker;
    picker.hidden=true;
    card.classList.remove('is-picking');
    const btn=card.querySelector('[data-rw-add]');if(btn&&!card.classList.contains('is-added')) btn.setAttribute('aria-expanded','false');
    if(this.sheet&&this.sheet.card===card) this.undock();
  }
  closeSheet(){
    if(!this.sheet) return;
    const card=this.sheet.card;
    this.closePicker(card);
    this.undock();
  }
  dock(card){
    const picker=card._picker;
    const host=document.createElement('div');host.className='rw-sheet-host';
    const cs=getComputedStyle(this);
    ['--rw-panel','--rw-text','--rw-muted','--rw-line','--rw-accent','--rw-on-accent','--rw-btn-bg','--rw-btn-fg','--rw-btn-radius','--rw-pill-radius','--rw-bar-r','--rw-thumb-radius','--rw-pt-size','--rw-price','--rw-opt','--rw-ease','--rw-ease-sheet','--rw-ease-spring'].forEach(v=>host.style.setProperty(v,cs.getPropertyValue(v)));
    host.style.fontFamily=cs.fontFamily;host.style.color=cs.color;
    const scrim=document.createElement('button');scrim.className='rw__pick-scrim';scrim.type='button';scrim.dataset.rwPickClose='';scrim.tabIndex=-1;scrim.setAttribute('aria-hidden','true');
    host.append(scrim,picker);
    document.body.appendChild(host);
    const ac=this._ac.signal;
    host.addEventListener('click',e=>this.onClick(e),{signal:ac});
    host.addEventListener('change',e=>{if(e.target.matches('input[data-rw-option]')){this.engage();this.onOption(e.target,true)}},{signal:ac});
    host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.onEscape(e)}},{signal:ac});
    requestAnimationFrame(()=>host.classList.add('is-open'));
    this.sheet={host,card};
    this.classList.add('rw--picking');
  }
  undock(){
    if(!this.sheet) return;
    const {host,card}=this.sheet;
    this.sheet=null;
    card.appendChild(card._picker);
    host.remove();
    this.classList.remove('rw--picking');
    card.classList.remove('is-picking');
    card._picker.hidden=true;
  }
  setLoading(card,on){card.classList.toggle('is-loading',on)}
  markAdded(card){
    card.classList.remove('is-loading','is-picking');
    card.classList.add('is-added');
    const btn=card.querySelector('[data-rw-add]');
    btn.setAttribute('aria-label',btn.dataset.addedLabel);btn.removeAttribute('aria-expanded');
    card._picker.hidden=true;
    if(this.sheet&&this.sheet.card===card) this.undock();
    if(!reduced()&&navigator.vibrate&&this.mobile){try{navigator.vibrate(12)}catch(e){}}
    this.checkComplete(card.closest('[data-rw-panel]'));
  }
  checkComplete(panel){
    const cards=Array.from(panel.querySelectorAll('.rw__item'));
    if(cards.length>=2&&cards.every(c=>c.classList.contains('is-added'))){
      panel.classList.add('is-complete');
      const m=panel.querySelector('[data-rw-msg]');if(m) m.textContent='';
    }
  }
  async confirm(card){
    if(!card||card.classList.contains('is-added')||card.classList.contains('is-loading')) return;
    const id=+card.dataset.selected;
    const panel=card.closest('[data-rw-panel]');
    const msg=panel.querySelector('[data-rw-msg]');
    card.dataset.touched='1';
    this.setLoading(card,true);
    try{
      await theme.cart.add([{id,quantity:1}]);
      this.markAdded(card);
    }catch(err){
      this.setLoading(card,false);
      if(msg) msg.textContent=this.dataset.msgError;
    }
  }
  async addAll(panel){
    if(!panel||panel.classList.contains('is-complete')) return;
    const cta=panel.querySelector('[data-rw-all]');
    if(cta.classList.contains('is-loading')) return;
    const msg=panel.querySelector('[data-rw-msg]');
    msg.textContent='';
    const cards=Array.from(panel.querySelectorAll('.rw__item')).filter(c=>!c.classList.contains('is-added')&&!c.classList.contains('is-soldout'));
    const ready=cards.filter(c=>c.dataset.touched&&c.dataset.selected);
    const pending=cards.filter(c=>!ready.includes(c));
    if(ready.length){
      cta.classList.add('is-loading');ready.forEach(c=>this.setLoading(c,true));
      try{
        await theme.cart.add(ready.map(c=>({id:+c.dataset.selected,quantity:1})),this.dataset.bundleCode);
        ready.forEach(c=>this.markAdded(c));
      }catch(err){
        ready.forEach(c=>this.setLoading(c,false));
        msg.textContent=this.dataset.msgError;
      }
      cta.classList.remove('is-loading');
    }
    if(pending.length){
      const open=this.mobile?pending.slice(0,1):pending;
      open.forEach(c=>{if(c._picker.hidden) this.openPicker(c)});
      if(!this.mobile) this.reveal(pending[0]);
      msg.textContent=(this.dataset.msgChoose||'Pick a size for: [items]').replace('[items]',pending.map(c=>c.dataset.title).join(', '));
    }
  }
}
customElements.define('runway-section',RunwaySection);
})();
