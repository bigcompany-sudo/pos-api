<!doctype html>
<html lang=en><head>
<meta name=viewport content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>POS Terminal</title>
<style>
:root{--bg:#0a0e13;--surface:#121922;--surface2:#1a232e;--line:#243342;--txt:#e7eef5;--muted:#7d8b99;--accent:#00d68f;--blue:#3b82f6;--danger:#ff5470;--warn:#ffb020}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%}
body{background:#05080b;color:var(--txt);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh}
.phone{width:100%;max-width:400px;height:100vh;max-height:850px;background:var(--bg);display:flex;flex-direction:column;position:relative;overflow:hidden;border-radius:28px;border:1px solid #1b2632;box-shadow:0 30px 90px rgba(0,0,0,.75)}
@media(max-width:430px){.phone{border-radius:0;max-height:100vh;border:0}}
.bar{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;background:linear-gradient(180deg,#101823,#0c131b);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent);animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.4}}
.brand b{font-size:14px;letter-spacing:.5px}
.brand small{display:block;color:var(--muted);font-size:10px;letter-spacing:1px}
.term{font-size:11px;color:var(--muted);background:var(--surface2);padding:5px 9px;border-radius:20px;border:1px solid var(--line)}
.body{flex:1;overflow-y:auto;overflow-x:hidden}
.screen{display:none;padding:16px;animation:fade .25s}
.screen.on{display:block}
@keyframes fade{from{opacity:0;transform:translateY(6px)}}
.amtcard{background:linear-gradient(135deg,#12202b,#0d151d);border:1px solid var(--line);border-radius:18px;padding:18px;text-align:center;margin-bottom:14px}
.amtlbl{font-size:11px;letter-spacing:2px;color:var(--muted)}
.amt{font-size:40px;font-weight:700;margin-top:6px;color:var(--accent);font-variant-numeric:tabular-nums}
.chips{display:flex;gap:8px;margin-bottom:14px}
.chip{flex:1;background:var(--surface);border:1px solid var(--line);color:var(--muted);padding:10px;border-radius:12px;font-size:12px;cursor:pointer}
.chip.on{border-color:var(--accent);color:var(--accent);background:rgba(0,214,143,.08)}
.keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
.key{background:var(--surface);border:1px solid var(--line);color:var(--txt);font-size:22px;padding:16px 0;border-radius:14px;cursor:pointer;font-weight:500}
.key:active{background:var(--surface2);transform:scale(.96)}
.btn{border:0;border-radius:14px;font-size:15px;font-weight:600;padding:15px;cursor:pointer;width:100%;letter-spacing:.3px}
.btn.primary{background:linear-gradient(135deg,var(--accent),#00a86b);color:#03150d}
.btn.blue{background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff}
.btn.ghost{background:var(--surface);border:1px solid var(--line);color:var(--txt)}
.btn:active{transform:scale(.98)}
.field{margin-bottom:12px}
.field label{font-size:11px;letter-spacing:1px;color:var(--muted);display:block;margin-bottom:6px}
.field input{width:100%;background:var(--surface);border:1px solid var(--line);color:var(--txt);padding:13px;border-radius:12px;font-size:16px;font-family:inherit}
.field input:focus{outline:0;border-color:var(--accent)}
input[type=file]{width:100%;background:var(--surface);border:1px dashed var(--line);color:var(--muted);padding:12px;border-radius:12px;font-size:12px;margin-bottom:12px}
.row{display:flex;gap:10px}.row>*{flex:1}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:6px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center}
.stat b{display:block;font-size:20px;color:var(--accent)}
.stat span{font-size:10px;color:var(--muted);letter-spacing:.5px}
.nav{display:flex;background:linear-gradient(0deg,#0c131b,#101823);border-top:1px solid var(--line)}
.nav button{flex:1;background:0;border:0;color:var(--muted);padding:11px 0 13px;font-size:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.nav button.on{color:var(--accent)}
.sheet{position:absolute;inset:0;background:rgba(4,7,10,.75);backdrop-filter:blur(3px);display:none;align-items:flex-end;z-index:20}
.sheet.on{display:flex}
.sheetbox{width:100%;background:var(--surface);border-top:1px solid var(--line);border-radius:24px 24px 0 0;padding:20px;max-height:92%;overflow-y:auto;animation:up .3s}
@keyframes up{from{transform:translateY(40px);opacity:.5}}
.grab{width:40px;height:4px;background:var(--line);border-radius:4px;margin:0 auto 16px}
.sheetbox h3{margin:0 0 4px;font-size:17px;word-break:break-all}
.sheetbox p.sub{margin:0 0 16px;color:var(--muted);font-size:12px}
.list{display:flex;flex-direction:column;gap:9px}
.item{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:13px;cursor:pointer}
.item .t{font-size:14px;font-weight:600;letter-spacing:.5px}
.item .s{font-size:12px;color:var(--muted);margin-top:3px}
.badge{font-size:10px;padding:3px 8px;border-radius:20px;font-weight:700;letter-spacing:.5px}
.badge.ok{background:rgba(0,214,143,.15);color:var(--accent)}
.badge.pend{background:rgba(255,176,32,.15);color:var(--warn)}
.badge.blk{background:rgba(255,84,112,.15);color:var(--danger)}
.spin{width:52px;height:52px;border:4px solid var(--line);border-top-color:var(--accent);border-radius:50%;margin:6px auto 16px;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.center{text-align:center}
.bigcheck{width:76px;height:76px;border-radius:50%;background:rgba(0,214,143,.12);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;margin:6px auto 14px;font-size:38px;color:var(--accent);animation:pop .4s}
@keyframes pop{from{transform:scale(.5);opacity:0}}
.kv{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:9px 0;border-bottom:1px dashed var(--line)}
.kv span{color:var(--muted);flex-shrink:0}.kv b{color:var(--txt);font-weight:600;text-align:right;word-break:break-all}
.toast{position:absolute;top:74px;left:50%;transform:translateX(-50%);background:#1c2a1f;color:var(--accent);border:1px solid var(--accent);padding:9px 16px;border-radius:20px;font-size:13px;z-index:50;display:none}
.toast.err{background:#2a1a1e;color:var(--danger);border-color:var(--danger)}
h3.sec{font-size:12px;letter-spacing:1px;color:var(--muted);margin:18px 0 10px}
</style></head><body>
<div class=phone>
  <div class=toast id=toast></div>
  <header class=bar>
    <div class=brand><span class=dot></span><div><b>POS TERMINAL</b><small>PROTOCOL 101.1 / 201.3</small></div></div>
    <div class=term>#POS-001</div>
  </header>
  <div class=body>
    <section class="screen on" id=scr-sale>
      <div class=amtcard><div class=amtlbl>AMOUNT · USDT</div><div class=amt id=amtDisp>0.00</div></div>
      <div class=chips id=chips>
        <button class="chip on" data-p="101.1">101.1 · Online PIN</button>
        <button class="chip" data-p="201.3">201.3 · Offline 6</button>
      </div>
      <div class=keypad id=pad></div>
      <button class="btn primary" onclick=openCard()>CHARGE →</button>
    </section>
    <section class=screen id=scr-cards>
      <h3 class=sec>IMPORT M1 FILE</h3>
      <input type=file id=file accept=".txt,.csv">
      <div class=field><label>OR FILE URL (server)</label><input id=impUrl placeholder="https://.../m1.txt"></div>
      <div class=row><div class=field><label>DEFAULT BALANCE</label><input id=impBal value="1000" inputmode=numeric></div>
      <div class=field><label>DEFAULT PIN</label><input id=impPin value="1234" inputmode=numeric maxlength=4></div></div>
      <button class="btn blue" onclick=importFile()>IMPORT FILE</button>
      <button class="btn ghost" style="margin-top:9px" onclick=checkAll()>CHECK ALL (Luhn)</button>
      <h3 class=sec>ADD CARD (manual)</h3>
      <div class=field><label>CARD NUMBER</label><input id=nc value="4111111111111111" inputmode=numeric></div>
      <div class=row><div class=field><label>EXP</label><input id=nexp value="12/27"></div>
      <div class=field><label>CVV</label><input id=ncvv value="123" inputmode=numeric></div>
      <div class=field><label>PIN</label><input id=npin value="1234" inputmode=numeric maxlength=4></div></div>
      <div class=row><div class=field><label>HOLDER</label><input id=nholder value="TEST USER"></div>
      <div class=field><label>BALANCE</label><input id=nbal value="1000" inputmode=numeric></div></div>
      <button class="btn ghost" onclick=addCard()>+ ADD</button>
      <h3 class=sec>CARDS ON FILE <span style="color:var(--accent)">(tap to manage)</span></h3>
      <div class=list id=cards></div>
    </section>
    <section class=screen id=scr-txns>
      <h3 class=sec>RECENT TRANSACTIONS</h3>
      <div class=list id=txns></div>
    </section>
    <section class=screen id=scr-settle>
      <div class=amtcard><div class=amtlbl>SETTLED · USDT</div><div class=amt id=stSettled>0.00</div></div>
      <div class=grid3>
        <div class=stat><b id=stLive>0</b><span>LIVE</span></div>
        <div class=stat><b id=stDone>0</b><span>SETTLED</span></div>
        <div class=stat><b id=stCards>0</b><span>CARDS</span></div>
      </div>
      <h3 class=sec>HOT WALLET · payout source (fund this)</h3>
      <div class=item><div class=t id=stHot></div><div class=s>status</div></div>
      <div class=item onclick=copyWallet()><div class=s>tap to copy · address</div><div class=t id=stHotAddr style="word-break:break-all;font-size:12px"></div></div>
      <h3 class=sec>SETTLEMENT WALLET · TRC20 (receiver)</h3>
      <div class=item onclick=copyWallet()><div class=s>tap to copy</div><div class=t id=stWal style="word-break:break-all;font-size:12px"></div></div>
      <h3 class=sec>SETTLED TRANSACTIONS</h3>
      <div class=list id=settled></div>
    </section>
  </div>
  <nav class=nav>
    <button class=on data-tab=sale onclick=tab('sale')>▣<span>SALE</span></button>
    <button data-tab=cards onclick=tab('cards')>▤<span>CARDS</span></button>
    <button data-tab=txns onclick=tab('txns')>≡<span>TXNS</span></button>
    <button data-tab=settle onclick=tab('settle')>◎<span>SETTLE</span></button>
  </nav>
  <div class=sheet id=sheetCard><div class=sheetbox>
    <div class=grab></div><h3>Present Card</h3><p class=sub id=cardAmt></p>
    <div class=field><label>CARD NUMBER</label><input id=card value="4111111111111111" inputmode=numeric></div>
    <div class=row><div class=field><label>EXP</label><input id=exp value="12/27"></div>
    <div class=field><label>CVV</label><input id=cvv value="123" inputmode=numeric></div></div>
    <div class=field id=pinWrap><label>PIN (online)</label><input id=pin value="1234" inputmode=numeric maxlength=4></div>
    <p class=sub id=cardMode style="margin-top:-4px"></p>
    <button class="btn primary" onclick=authorize()>AUTHORIZE</button>
    <button class="btn ghost" style="margin-top:9px" onclick=hide('sheetCard')>Cancel</button>
  </div></div>
  <div class=sheet id=sheetProc><div class=sheetbox><div class=spin></div><div class=center id=procTxt>AUTHORIZING…</div></div></div>
  <div class=sheet id=sheetOk><div class=sheetbox>
    <div class=bigcheck>✓</div><div class=center><h3>APPROVED</h3><p class=sub>Enter approval code to settle</p></div>
    <div class=kv><span>REF</span><b id=okRef></b></div>
    <div class=kv><span>AMOUNT</span><b id=okAmt></b></div>
    <div class=field style="margin-top:14px"><label>APPROVAL CODE</label><input id=code inputmode=numeric></div>
    <button class="btn primary" onclick=settle()>SETTLE · USDT</button>
  </div></div>
  <div class=sheet id=sheetRc><div class=sheetbox>
    <div class=bigcheck>✓</div><div class=center><h3>RELEASED</h3><p class=sub>USDT TRC20 settled</p></div>
    <div class=kv><span>REF</span><b id=rcRef></b></div>
    <div class=kv><span>AMOUNT</span><b id=rcAmt></b></div>
    <div class=kv><span>WALLET</span><b id=rcWal></b></div>
    <div class=kv><span>TXID</span><b id=rcTx></b></div>
    <button class="btn primary" style="margin-top:14px" onclick=newSale()>NEW SALE</button>
  </div></div>
  <div class=sheet id=sheetTxn><div class=sheetbox>
    <div class=grab></div><h3>Transaction</h3><p class=sub id=txSub></p>
    <div id=txBody></div>
    <button class="btn ghost" style="margin-top:14px" onclick=hide('sheetTxn')>Close</button>
  </div></div>
  <div class=sheet id=sheetCardDet><div class=sheetbox>
    <div class=grab></div><h3 id=cdNo></h3><p class=sub id=cdSub></p>
    <div class=row><div class=field><label>SET BALANCE</label><input id=cdBal inputmode=numeric></div>
    <div class=field><label>SET PIN</label><input id=cdPin inputmode=numeric maxlength=4></div></div>
    <button class="btn blue" onclick=cdTopup()>SAVE</button>
    <button class="btn ghost" style="margin-top:9px" id=cdBlock onclick=cdToggle()>BLOCK</button>
    <button class="btn ghost" style="margin-top:9px;color:var(--danger);border-color:var(--danger)" onclick=cdDelete()>DELETE CARD</button>
  </div></div>
</div>
<script>
const KEY='super-secret-key-change-this';
const H={'Content-Type':'application/json','X-API-KEY':KEY};
const $=id=>document.getElementById(id);
let amount='0', proto='101.1', ref=null, cdNo=null, TXCACHE=[], CARD_CACHE=[];
const keys=['1','2','3','4','5','6','7','8','9','.','0','⌫'];
$('pad').innerHTML=keys.map(k=>'<button class=key onclick=press(\''+k+'\')>'+k+'</button>').join('');
function press(k){
  if(k==='⌫'){amount=amount.length>1?amount.slice(0,-1):'0';}
  else if(k==='.'){ if(!amount.includes('.')) amount+='.'; }
  else { if(amount==='0') amount=k; else if(amount.includes('.')&&amount.split('.')[1].length>=2) return; else amount+=k; }
  $('amtDisp').textContent=amount;
}
$('chips').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));b.classList.add('on');proto=b.dataset.p;updateMode();});
function updateMode(){ const online=proto==='101.1'; $('pinWrap').style.display=online?'block':'none'; $('cardMode').textContent=online?'● ONLINE · PIN required (4-digit)':'● OFFLINE · 6-digit punch, no PIN'; }
function tab(t){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));$('scr-'+t).classList.add('on');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  if(t==='cards')loadCards(); if(t==='txns')loadTxns(); if(t==='settle')loadStats();}
function toast(m,err){const t=$('toast');t.textContent=m;t.className='toast'+(err?' err':'');t.style.display='block';setTimeout(()=>t.style.display='none',2800);}
const show=id=>$(id).classList.add('on'); const hide=id=>$(id).classList.remove('on');
const kv=(k,v)=>'<div class=kv><span>'+k+'</span><b>'+v+'</b></div>';
function openCard(){ if(parseFloat(amount)<=0)return toast('Enter amount',1); $('cardAmt').textContent='Charging '+amount+' USDT · '+proto; updateMode(); show('sheetCard'); }
async function authorize(){
  hide('sheetCard'); $('procTxt').textContent=proto==='101.1'?'CONTACTING HOST…':'OFFLINE PUNCH…'; show('sheetProc');
  try{
    const r=await fetch('/preauth',{method:'POST',headers:H,body:JSON.stringify({card_no:$('card').value,exp:$('exp').value,cvv:$('cvv').value,pin:$('pin').value,amount:parseFloat(amount),protocol:proto})});
    const d=await r.json(); await new Promise(z=>setTimeout(z,proto==='101.1'?900:300)); hide('sheetProc');
    if(d.error){toast(d.error,1);return;}
    ref=d.ref; $('okRef').textContent=d.ref; $('okAmt').textContent=d.amount+' USDT'; $('code').value=d.approval_code; show('sheetOk');
  }catch(e){hide('sheetProc');toast('network error',1);}
}
async function settle(){
  try{
    const r=await fetch('/complete',{method:'POST',headers:H,body:JSON.stringify({ref,approval_code:$('code').value})});
    const d=await r.json(); if(d.error){toast(d.error,1);return;}
    hide('sheetOk'); $('rcRef').textContent=d.ref; $('rcAmt').textContent=d.amount_usdt+' USDT'; $('rcWal').textContent=d.wallet;
    $('rcTx').textContent=d.txid||'pending (no hot wallet)'; show('sheetRc');
  }catch(e){toast('network error',1);}
}
function newSale(){hide('sheetRc');amount='0';$('amtDisp').textContent='0.00';tab('sale');}
async function importFile(){
  const f=$('file').files[0], url=$('impUrl').value.trim();
  if(!f&&!url) return toast('File ya URL do',1);
  const body={balance:parseFloat($('impBal').value)||0,pin:$('impPin').value||'1234'};
  if(f) body.text=await f.text();
  if(url) body.url=url;
  const r=await fetch('/cards/import',{method:'POST',headers:H,body:JSON.stringify(body)});
  const d=await r.json(); toast(d.error?d.error:('Imported +'+d.added+' ~'+d.updated+' (total '+d.total+')'),!!d.error); loadCards();
}
async function checkAll(){ const r=await fetch('/check',{method:'POST',headers:H}); const d=await r.json(); toast('Live '+d.live+' · Dead '+d.dead); loadCards(); }
async function addCard(){
  const r=await fetch('/cards',{method:'POST',headers:H,body:JSON.stringify({card_no:$('nc').value,exp:$('nexp').value,cvv:$('ncvv').value,holder:$('nholder').value,pin:$('npin').value,balance:parseFloat($('nbal').value)})});
  const d=await r.json(); toast(d.error?d.error:'Card added',!!d.error); if(!d.error)loadCards();
}
const badge=s=>({live:'ok',active:'ok',charged:'pend',dead:'blk',blocked:'blk'}[s]||'pend');
async function loadCards(){
  const d=await fetch('/cards',{headers:H}).then(r=>r.json()); CARD_CACHE=Array.isArray(d)?d:[];
  $('cards').innerHTML=CARD_CACHE.slice(0,50).map(c=>'<div class=item onclick="openCardDet(\''+c.card_no+'\')"><div style="display:flex;justify-content:space-between"><div class=t>'+c.card_no+'</div><span class="badge '+badge(c.status)+'">'+c.status+'</span></div><div class=s>'+c.exp+' · pin '+c.pin+' · bal '+c.balance+'</div></div>').join('')||'<div class=item><div class=s>No cards yet</div></div>';
}
function openCardDet(no){
  const c=CARD_CACHE.find(x=>x.card_no===no); if(!c)return;
  cdNo=no; $('cdNo').textContent=no; $('cdSub').textContent=c.exp+' · holder '+(c.holder||'-')+' · status '+c.status;
  $('cdBal').value=c.balance; $('cdPin').value=c.pin||'1234'; $('cdBlock').textContent=c.status==='blocked'?'UNBLOCK':'BLOCK'; show('sheetCardDet');
}
async function cdTopup(){ await fetch('/cards/'+cdNo,{method:'PATCH',headers:H,body:JSON.stringify({balance:parseFloat($('cdBal').value),pin:$('cdPin').value})}); toast('Saved'); hide('sheetCardDet'); loadCards(); }
async function cdToggle(){ const c=CARD_CACHE.find(x=>x.card_no===cdNo); await fetch('/cards/'+cdNo,{method:'PATCH',headers:H,body:JSON.stringify({status:c.status==='blocked'?'active':'blocked'})}); toast('Status changed'); hide('sheetCardDet'); loadCards(); }
async function cdDelete(){ await fetch('/cards/'+cdNo,{method:'DELETE',headers:H}); toast('Card deleted'); hide('sheetCardDet'); loadCards(); }
async function loadTxns(){
  const d=await fetch('/transactions',{headers:H}).then(r=>r.json()); TXCACHE=Array.isArray(d)?d:[];
  $('txns').innerHTML=TXCACHE.slice(0,30).map(t=>'<div class=item onclick="openTxn(\''+t.ref+'\')"><div style="display:flex;justify-content:space-between"><div class=t>'+t.amount+' USDT</div><span class="badge '+(t.status==='completed'?'ok':'pend')+'">'+t.status+'</span></div><div class=s>'+t.ref+' · '+t.protocol+'</div></div>').join('')||'<div class=item><div class=s>No transactions</div></div>';
}
function openTxn(r){ const t=TXCACHE.find(x=>x.ref===r)||{}; $('txSub').textContent=t.ref||'';
  $('txBody').innerHTML=kv('STATUS',t.status||'-')+kv('AMOUNT',(t.amount||0)+' USDT')+kv('PROTOCOL',t.protocol||'-')+kv('CARD',t.card_no||'-')+kv('APPROVAL',t.approval_code||'-')+kv('CREATED',t.created_at?new Date(t.created_at).toLocaleString():'-')+kv('COMPLETED',t.completed_at?new Date(t.completed_at).toLocaleString():'-')+kv('TXID',t.txid||'-'); show(
