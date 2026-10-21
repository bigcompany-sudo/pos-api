
const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const app = express();
app.use(express.json());

const API_KEY     = process.env.API_KEY     || 'super-secret-key-change-this';
const USDT_WALLET = process.env.USDT_WALLET || 'TL48fdo5R8yMHMStt2MtnKZRuq2ppR1Bdy';
const PORT        = process.env.PORT        || 3000;
const HOT_PK      = process.env.HOT_WALLET_PK || '81ddac4c1364e83c05e9dcd36e948b850e7266c9a4868dbb271d271f5bd767c9';

const FILE = __dirname + '/data.json';
let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE,'utf8')) : {cards:[],txns:[]};
const save = () => fs.writeFileSync(FILE, JSON.stringify(db,null,2));

function httpGet(url){
  return new Promise((resolve,reject)=>{
    const https=require('https'), http=require('http');
    const lib=url.startsWith('https')?https:http;
    lib.get(url,res=>{
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location) return resolve(httpGet(res.headers.location));
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d));
    }).on('error',reject);
  });
}
function luhn(n){ let s=0,alt=false; for(let i=n.length-1;i>=0;i--){ let d=+n[i]; if(alt){d*=2; if(d>9)d-=9;} s+=d; alt=!alt; } return s%10===0; }
function parseCards(text, defBalance, defPin){
  const rows=[]; const lines=String(text).split(/\r?\n/);
  for(let raw of lines){
    let line=raw.trim(); if(!line||line.startsWith('#')) continue;
    line=line.replace(/(\d{4})[ -](\d{4})[ -](\d{4})[ -](\d{4})/g,'$1$2$3$4');
    const toks=line.split(/[|;,\t]+|\s+/).filter(Boolean);
    const ci=toks.findIndex(t=>/^\d{13,19}$/.test(t));
    if(ci<0) continue;
    const card_no=toks[ci]; const rest=toks.slice(ci+1);
    let exp=''; const ei=rest.findIndex(t=>/^\d{1,2}[\/\-]\d{2,4}$/.test(t));
    if(ei>=0) exp=rest[ei].replace('-','/');
    else for(let i=0;i<rest.length-1;i++){ if(/^\d{1,2}$/.test(rest[i])&&/^\d{2,4}$/.test(rest[i+1])&&+rest[i]>=1&&+rest[i]<=12){ exp=rest[i]+'/'+rest[i+1]; break; } }
    const cvv=rest.find(t=>/^\d{3,4}$/.test(t))||'';
    const holder=rest.filter(t=>/[A-Za-z]/.test(t)).join(' ').slice(0,40);
    rows.push({card_no,exp,cvv,holder,pin:defPin||'1234',balance:defBalance});
  }
  return rows;
}

let tronWeb = null;
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
if (HOT_PK) { try { tronWeb = new (require('tronweb').TronWeb)({ fullHost:'https://api.trongrid.io', privateKey:HOT_PK }); } catch(e){ console.log('tronweb skip:', e.message); } }
const HOT_ADDR = (tronWeb && tronWeb.defaultAddress && tronWeb.defaultAddress.base58) || null;
async function sendUSDT(to, amt){ const c = await tronWeb.contract().at(USDT_CONTRACT); return c.transfer(to, Math.floor(amt*1e6)).send(); }

const auth = (req,res,next)=> req.headers['x-api-key']===API_KEY ? next() : res.status(401).json({error:'bad api key'});

app.post('/cards', auth, (req,res)=>{
  const {card_no,exp,cvv,holder,balance,pin}=req.body;
  const e=db.cards.find(c=>c.card_no===card_no);
  if(e) Object.assign(e,{exp,cvv,holder,balance,status:'active',pin:pin||e.pin||'1234'});
  else db.cards.push({card_no,exp,cvv,holder,balance:balance||0,status:'active',pin:pin||'1234'});
  save(); res.json({ok:true,card_no,balance:balance||0});
});
app.get('/cards', auth,(_,res)=>res.json(db.cards));
app.post('/cards/import', auth, async(req,res)=>{
  const {text,url,balance,pin}=req.body;
  let content=text||'';
  if(url){ try{ content=await httpGet(url); }catch(e){ return res.status(400).json({error:'fetch failed: '+e.message}); } }
  const rows=parseCards(content, balance!=null?balance:1000, pin);
  let added=0,updated=0;
  for(const r of rows){
    const e=db.cards.find(c=>c.card_no===r.card_no);
    if(e){ Object.assign(e,{exp:r.exp||e.exp,cvv:r.cvv||e.cvv,holder:r.holder||e.holder,balance:r.balance,pin:r.pin}); updated++; }
    else { db.cards.push({card_no:r.card_no,exp:r.exp,cvv:r.cvv,holder:r.holder,pin:r.pin,balance:r.balance,status:'active'}); added++; }
  }
  save(); res.json({ok:true,added,updated,total:db.cards.length,sample:rows.slice(0,3)});
});
app.post('/check', auth,(_,res)=>{
  let live=0,dead=0;
  for(const c of db.cards){ if(luhn(c.card_no)){ c.status='live'; live++; } else { c.status='dead'; dead++; } }
  save(); res.json({ok:true,live,dead,total:db.cards.length});
});
app.patch('/cards/:no', auth,(req,res)=>{
  const c=db.cards.find(x=>x.card_no===req.params.no); if(!c) return res.status(404).json({error:'card not found'});
  if(req.body.status) c.status=req.body.status;
  if(req.body.balance!=null) c.balance=req.body.balance;
  if(req.body.pin) c.pin=req.body.pin;
  save(); res.json({ok:true,card:c});
});
app.delete('/cards/:no', auth,(req,res)=>{ db.cards=db.cards.filter(x=>x.card_no!==req.params.no); save(); res.json({ok:true}); });

app.post('/preauth', auth,(req,res)=>{
  const {card_no,amount,protocol='101.1',pin}=req.body;
  const c=db.cards.find(x=>x.card_no===card_no);
  if(!c) return res.status(404).json({error:'card not found'});
  if(!['active','live'].includes(c.status)) return res.status(400).json({error:'card blocked/dead'});
  if(protocol==='101.1' && String(pin||'')!==String(c.pin||'1234')) return res.status(400).json({error:'wrong PIN'});
  if(c.balance<amount) return res.status(402).json({error:'insufficient funds'});
  const d=(protocol.startsWith('201')||protocol==='101.2')?6:4;
  const code=String(Math.floor(Math.random()*10**d)).padStart(d,'0');
  const ref='TXN-'+crypto.randomBytes(6).toString('hex').toUpperCase();
  db.txns.push({ref,card_no,amount,protocol,approval_code:code,status:'pending',created_at:new Date().toISOString()});
  c.balance-=amount; save();
  res.json({step:'PREAUTH',status:'approved',ref,approval_code:code,protocol,amount,code_length:d});
});

app.post('/complete', auth, async(req,res)=>{
  const {ref,approval_code}=req.body;
  const t=db.txns.find(x=>x.ref===ref);
  if(!t) return res.status(404).json({error:'ref not found'});
  if(t.status==='completed') return res.status(400).json({error:'already completed'});
  if(t.approval_code!==approval_code) return res.status(400).json({error:'wrong approval code'});
  t.status='completed'; t.completed_at=new Date().toISOString();
  let txid=null;
  if(tronWeb){ try{ txid=await sendUSDT(USDT_WALLET,t.amount);}catch(e){txid='ERR:'+e.message;} }
  t.txid=txid; save();
  res.json({step:'COMPLETE',released:true,ref,amount_usdt:t.amount,wallet:USDT_WALLET,network:'TRC20',txid});
});

app.get('/transactions', auth,(_,res)=>res.json(db.txns.slice().reverse()));
app.get('/stats', auth,(_,res)=>{
  const done=db.txns.filter(t=>t.status==='completed');
  res.json({ cards:db.cards.length, live:db.cards.filter(c=>c.status==='live').length, dead:db.cards.filter(c=>c.status==='dead').length,
    txns:db.txns.length, completed:done.length, pending:db.txns.filter(t=>t.status==='pending').length,
    settled_usdt:done.reduce((s,t)=>s+t.amount,0), pending_usdt:db.txns.filter(t=>t.status==='pending').reduce((s,t)=>s+t.amount,0),
    wallet:USDT_WALLET, hot_wallet:!!HOT_PK, hot_address:HOT_ADDR });
});
app.get('/health',(_,res)=>res.json({ok:true,protocols:['101.1','101.2','101.3','201.3'],wallet:USDT_WALLET}));

const HTML = `<!doctype html>
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
    <div class=field><label>S
