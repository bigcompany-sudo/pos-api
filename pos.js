
ET PIN</label><input id=cdPin inputmode=numeric maxlength=4></div></div>
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
const keys=['1','2','3','4','5','6','7','8','9','.','0','\u232b'];
$('pad').innerHTML=keys.map(k=>'<button class=key onclick=press(\''+k+'\')>'+k+'</button>').join('');
function press(k){
  if(k==='\u232b'){amount=amount.length>1?amount.slice(0,-1):'0';}
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
  $('txBody').innerHTML=kv('STATUS',t.status||'-')+kv('AMOUNT',(t.amount||0)+' USDT')+kv('PROTOCOL',t.protocol||'-')+kv('CARD',t.card_no||'-')+kv('APPROVAL',t.approval_code||'-')+kv('CREATED',t.created_at?new Date(t.created_at).toLocaleString():'-')+kv('COMPLETED',t.completed_at?new Date(t.completed_at).toLocaleString():'-')+kv('TXID',t.txid||'-'); show('sheetTxn'); }
async function loadStats(){
  const d=await fetch('/stats',{headers:H}).then(r=>r.json());
  $('stSettled').textContent=(d.settled_usdt||0).toFixed(2); $('stLive').textContent=d.live||0; $('stDone').textContent=d.completed||0; $('stCards').textContent=d.cards||0;
  $('stWal').textContent=d.wallet||'-'; $('stHotAddr').textContent=d.hot_address||'not connected';
  $('stHot').innerHTML=d.hot_wallet?'<span style="color:var(--accent)">● CONNECTED</span>':'<span style="color:var(--warn)">● NOT SET</span>';
  const s=await fetch('/transactions',{headers:H}).then(r=>r.json()); const done=(Array.isArray(s)?s:[]).filter(t=>t.status==='completed');
  $('settled').innerHTML=done.slice(0,15).map(t=>'<div class=item onclick="openTxn(\''+t.ref+'\')"><div style="display:flex;justify-content:space-between"><div class=t>'+t.amount+' USDT</div><span class="badge ok">settled</span></div><div class=s>'+(t.txid?('tx '+String(t.txid).slice(0,20)+'…'):'no txid')+'</div></div>').join('')||'<div class=item><div class=s>No settlements yet</div></div>';
}
function copyWallet(){ if(navigator.clipboard)navigator.clipboard.writeText($('stWal').textContent); toast('Copied'); }
updateMode(); loadCards(); loadTxns();
</script></body></html>`;
app.get('/',(_,res)=>res.send(HTML));

app.listen(PORT,()=>console.log('POS live on '+PORT));
