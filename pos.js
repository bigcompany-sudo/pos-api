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
body{background:#000;color:#0f0;font-family:monospace;padding:14px;font-size:15px}
h2{border-bottom:1px solid #0f0;padding-bottom:6px}
input,select,button{background:#000;color:#0f0;border:1px solid #0f0;padding:9px;font-family:monospace;width:100%;box-sizing:border-box;margin:5px 0;font-size:15px}
button{cursor:pointer}button:active{background:#0f0;color:#000}
pre{white-space:pre-wrap;font-size:12px;border-top:1px dashed #0f0;padding-top:8px}
.hidden{display:none}
</style></head><body>
<h2>► PROTOCOL POS</h2>
<div id=s1>
<label>CARD</label><input id=card value="4111111111111111">
<label>EXP</label><input id=exp value="12/27">
<label>CVV</label><input id=cvv value="123">
<label>AMOUNT</label><input id=amt value="100">
<label>PROTOCOL</label><select id=proto><option>101.1</option><option>201.3</option></select>
<button onclick=pre()>PRE-AUTH</button></div>
<div id=s2 class=hidden><label>APPROVAL CODE</label><input id=code>
<button onclick=comp()>COMPLETE</button></div>
<pre id=out>ready.</pre>
<script>
let ref=null,key='super-secret-key-change-this';
const o=d=>document.getElementById('out').textContent=JSON.stringify(d,null,2);
async function pre(){const r=await fetch('/preauth',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':key},body:JSON.stringify({card_no:card.value,exp:exp.value,cvv:cvv.value,amount:+amt.value,protocol:proto.value})});const d=await r.json();ref=d.ref;o(d);document.getElementById('s2').classList.remove('hidden');}
async function comp(){const r=await fetch('/complete',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':key},body:JSON.stringify({ref,approval_code:code.value})});o(await r.json());}
</script></body></html>`;
app.get('/',(_,res)=>res.send(HTML));

app.listen(PORT,()=>console.log('POS live on '+PORT));
