(()=>{
'use strict';
/* Shared behaviour for the shop pages (not loaded on the home page, which has its own bag). */
const SHOP='nike-makknzjs.myshopify.com';
const KEY='runway-styling-bag-v3'; /* same key as the home page, so the bag is shared */
const cat=window.SITE_CATALOG;
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let entries=[];
try{
  const raw=JSON.parse(localStorage.getItem(KEY)||'[]');
  if(Array.isArray(raw)) entries=raw.filter(e=>e&&Number.isSafeInteger(e.id)&&Number.isSafeInteger(e.quantity)&&e.quantity>=1&&e.quantity<=20).slice(0,50).map(e=>({id:e.id,quantity:e.quantity}));
}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(entries))}catch(e){}};
const find=id=>{for(const it of cat.items){const v=it.variants.find(v=>v.id===id);if(v) return {item:it,variant:v}}return null};
/* drop entries the catalog no longer knows */
entries=entries.filter(e=>find(e.id));
const count=()=>entries.reduce((s,e)=>s+e.quantity,0);
const counter=()=>$$('[data-cart-count]').forEach(n=>n.textContent=String(count()));
let toastT=0;
const toast=m=>{const el=$('#bag-status');if(!el) return;el.textContent=m;el.classList.add('is-on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('is-on'),2500)};
const add=(id,q)=>{
  const f=find(id);if(!f||!f.variant.a) throw new Error('unavailable');
  const ex=entries.find(e=>e.id===id);
  if(ex) ex.quantity=Math.min(20,ex.quantity+(q||1)); else entries.push({id,quantity:q||1});
  save();counter();
};
const subtotal=()=>entries.reduce((s,e)=>{const f=find(e.id);return s+(f?f.item.price*e.quantity:0)},0);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls) n.className=cls;if(text!=null) n.textContent=text;return n};

/* ---- product pages ---- */
$$('[data-product]').forEach(card=>{
  const btn=$('[data-add]',card);if(!btn) return;
  const label=btn.textContent;
  btn.addEventListener('click',()=>{
    const r=$('input[type=radio]:checked',card);
    if(!r){toast('Choose a size first');return}
    try{add(+r.dataset.id,1)}catch(e){toast('That size is unavailable');return}
    btn.textContent='Added to bag ✓';
    const b=$('[data-bag-link]',card);if(b) b.hidden=false;
    toast('Piece saved to your bag');
    setTimeout(()=>{btn.textContent=label},1800);
  });
});

/* ---- bag page ---- */
const bagRoot=$('[data-bag]');
const drawBag=()=>{
  if(!bagRoot) return;
  const rows=$('[data-rows]',bagRoot),sum=$('[data-sum]',bagRoot),empty=$('[data-empty]',bagRoot);
  rows.textContent='';
  const has=entries.length>0;
  empty.hidden=has;sum.hidden=!has;rows.hidden=!has;
  entries.forEach(e=>{
    const f=find(e.id);if(!f) return;
    const row=el('div','sx-row');
    const im=el('div','sx-row__img');const img=document.createElement('img');img.src=f.item.image;img.alt=f.item.name;img.width=84;img.height=105;im.appendChild(img);
    const d=el('div');d.append(el('h3',null,f.item.name),el('p',null,(f.item.sizes.length>4?'Shoe size ':'Size ')+f.variant.o.join(' / ')),el('p',null,money(f.item.price)));
    const end=el('div','sx-row__end');
    const q=el('div','sx-qty');
    const minus=el('button',null,'−');minus.type='button';minus.setAttribute('aria-label','Decrease quantity: '+f.item.name);
    const out=el('output',null,String(e.quantity));
    const plus=el('button',null,'+');plus.type='button';plus.setAttribute('aria-label','Increase quantity: '+f.item.name);
    minus.addEventListener('click',()=>{if(e.quantity>1){e.quantity--;save();counter();drawBag()}});
    plus.addEventListener('click',()=>{if(e.quantity<20){e.quantity++;save();counter();drawBag()}});
    q.append(minus,out,plus);
    const rm=el('button','sx-rm','Remove');rm.type='button';rm.setAttribute('aria-label','Remove '+f.item.name);
    rm.addEventListener('click',()=>{entries=entries.filter(x=>x!==e);save();counter();drawBag()});
    const tot=el('span',null,money(f.item.price*e.quantity));
    end.append(q,tot,rm);
    row.append(im,d,end);rows.appendChild(row);
  });
  $('[data-subtotal]',bagRoot).textContent=money(subtotal());
  $('[data-count]',bagRoot).textContent=count()+(count()===1?' piece':' pieces');
};

/* ---- checkout page ---- */
const co=$('[data-checkout]');
const drawCheckout=()=>{
  if(!co) return;
  const rows=$('[data-lines]',co);rows.textContent='';
  const has=entries.length>0;
  $('[data-co-empty]',co).hidden=has;$('[data-co-main]',co).hidden=!has;
  entries.forEach(e=>{
    const f=find(e.id);if(!f) return;
    const r=el('div','sx-sum__r');
    r.append(el('span',null,`${f.item.name} · ${f.variant.o.join(' / ')} × ${e.quantity}`),el('span',null,money(f.item.price*e.quantity)));
    rows.appendChild(r);
  });
  $('[data-subtotal]',co).textContent=money(subtotal());
  const go=$('[data-handoff]',co);
  /* Shopify cart permalink: /cart/VARIANT:QTY,VARIANT:QTY */
  const url=new URL('https://'+SHOP+'/cart/'+entries.map(e=>e.id+':'+e.quantity).join(','));
  go.href=url.hostname===SHOP?url.href:'#';
};

counter();drawBag();drawCheckout();
})();
