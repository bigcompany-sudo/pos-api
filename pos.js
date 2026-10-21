const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const app = express();
app.use(express.json());

const API_KEY     = process.env.API_KEY     || 'super-secret-key-change-this';
const USDT_WALLET = process.env.USDT_WALLET || 'TL48fdo5R8yMHMStt2MtnKZRuq2ppR1Bdy';
const PORT        = process.env.PORT        || 3000;
const HOT_PK      = process.env.HOT_WALLET_PK || '';

const FILE = __dirname + '/data.json';
let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE,'utf8')) : {cards:[],txns:[]};
const save = () => fs.writeFileSync(FILE, JSON.stringify(db,null,2));

let tronWeb = null;
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
if (HOT_PK) {
  try { tronWeb = new (require('tronweb').TronWeb)({ fullHost:'https://api.trongrid.io', privateKey:HOT_PK }); }
  catch(e){ console.log('tronweb skip:', e.message); }
}
async function sendUSDT(to, amt){
  const c = await tronWeb.contract().at(USDT_CONTRACT);
  return c.transfer(to, Math.floor(amt*1e6)).send();
}

const auth = (req,res,next)=> req.headers['x-api-key']===API_KEY ? next() : res.status(401).json({error:'bad api key'});

app.post('/cards', auth, (req,res)=>{
  const {card_no,exp,cvv,holder,balance}=req.body;
  const e=db.cards.find(c=>c.card_no===card_no);
  if(e) Object.assign(e,{exp,cvv,holder,balance,status:'active'});
  else db.cards.push({card_no,exp,cvv,holder,balance:balance||0,status:'active'});
  save(); res.json({ok:true,card_no,balance:balance||0});
});
app.get('/cards', auth,(_,res)=>res.json(db.cards));

app.post('/preauth', auth,(req,res)=>{
  const {card_no,amount,protocol='101.1'}=req.body;
  const c=db.cards.find(x=>x.card_no===card_no);
  if(!c) return res.status(404).json({error:'card not found'});
  if(c.status!=='active') return res.status(400).json({error:'card blocked'});
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
  t.status='completed'; t.completed_at=new Date().toISOString(); save();
  let txid=null;
  if(tronWeb){ try{ txid=await sendUSDT(USDT_WALLET,t.amount);}catch(e){txid='ERR:'+e.message;} }
  res.json({step:'COMPLETE',released:true,ref,amount_usdt:t.amount,wallet:USDT_WALLET,network:'TRC20',txid});
});

app.get('/transactions', auth,(_,res)=>res.json(db.txns.slice().reverse()));
app.get('/health',(_,res)=>res.json({ok:true,protocols:['101.1','101.2','101.3','201.3'],wallet:USDT_WALLET}));

const HTML = `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1">
<title>POS 101.1</title><style>
*{box-sizing:border-box}
body{background:#000;color:#0f0;font-family:monospace;padding:14px;font-size:15px;margin:0}
h2{border-bottom:1px solid #0f0;padding-bottom:6px;margin-top:18px}
input,select,button{background:#000;color:#0f0;border:1px solid #0f0;padding:9px;font-family:monospace;width:100%;margin:5px 0;font-size:15px}
button{cursor:pointer}button:active{background:#0f0;color:#000}
.row{display:flex;gap:6px}.row>*{flex:1}
pre{white-space:pre-wrap;font-size:12px;border-top:1px dashed #0f0;padding-top:8px}
.hidden{display:none}.err{color:#f55}.small{font-size:12px;color:#0a0}
.card{border:1px solid #0a0;padding:6px;margin:4px 0;font-size:12px}
</style></head><body>
<h2>► PROTOCOL POS</h2>
<div id=s1>
<label>CARD</label><input id=card value="4111111111111111">
<div class=row><div><label>EXP</label><input id=exp value="12/27"></div>
<div><label>CVV</label><input id=cvv value="123"></div></div>
<label>AMOUNT</label><input id=amt value="100">
<label>PROTOCOL</label><select id=proto><option>101.1</option><option>201.3</option></select>
<button onclick=pre()>PRE-AUTH</button></div>
<div id=s2 class=hidden><label>APPROVAL CODE (auto)</label><input id=code>
<button onclick=comp()>COMPLETE</button></div>

<h2>► ADD CARD</h2>
<label>CARD NO</label><input id=nc placeholder="4111111111111111">
<div class=row><div><label>EXP</label><input id=nexp placeholder="12/27"></div>
<div><label>CVV</label><input id=ncvv></div></div>
<div class=row><div><label>HOLDER</label><input id=nholder></div>
<div><label>BALANCE</label><input id=nbal value="1000"></div></div>
<button onclick=addCard()>+ ADD CARD</button>

<h2>► CARDS <span class=small onclick=loadCards()>[refresh]</span></h2>
<div id=cards></div>
<h2>► TRANSACTIONS <span class=small onclick=loadTxns()>[refresh]</span></h2>
<div id=txns></div>

<pre id=out>ready.</pre>
<script>
let ref=null,key='super-secret-key-change-this';
const H={'Content-Type':'application/json','X-API-KEY':key};
const o=(d,err)=>{const el=document.getElementById('out');el.className=err?'err':'';el.textContent=JSON.stringify(d,null,2);};
const g=id=>document.getElementById(id);
async function j(u,op){const r=await fetch(u,op);return r.json();}
async function pre(){
  const d=await j('/preauth',{method:'POST',headers:H,body:JSON.stringify({card_no:g('card').value,exp:g('exp').value,cvv:g('cvv').value,amount:+g('amt').value,protocol:g('proto').value})});
  o(d,!!d.error);
  if(d.ref){ref=d.ref;g('code').value=d.approval_code;g('s2').classList.remove('hidden');}
  else g('s2').classList.add('hidden');
}
async function comp(){
  const d=await j('/complete',{method:'POST',headers:H,body:JSON.stringify({ref,approval_code:g('code').value})});
  o(d,!!d.error);
  if(d.released){g('s2').classList.add('hidden');ref=null;loadTxns();loadCards();}
}
async function addCard(){
  const d=await j('/cards',{method:'POST',headers:H,body:JSON.stringify({card_no:g('nc').value,exp:g('nexp').value,cvv:g('ncvv').value,holder:g('nholder').value,balance:+g('nbal').value})});
  o(d,!!d.error);loadCards();
}
async function loadCards(){
  const d=await j('/cards',{headers:H});
  g('cards').innerHTML=(Array.isArray(d)?d:[]).map(c=>'<div class=card>'+c.card_no+' | '+c.exp+' | bal:'+c.balance+' | <b>'+c.status+'</b></div>').join('')||'<div class=small>no cards</div>';
}
async function loadTxns(){
  const d=await j('/transactions',{headers:H});
  g('txns').innerHTML=(Array.isArray(d)?d:[]).slice(0,10).map(t=>'<div class=card>'+t.ref+' | '+t.amount+' | '+t.protocol+' | '+t.status+'</div>').join('')||'<div class=small>no txns</div>';
}
loadCards();loadTxns();
</script></body></html>`;
app.get('/',(_,res)=>res.send(HTML));

app.listen(PORT,()=>console.log('POS live on '+PORT));
