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

const HTML = fs.readFileSync(__dirname+'/ui.html','utf8');
app.get('/',(_,res)=>res.send(HTML));

app.listen(PORT,()=>console.log('POS live on '+PORT));
