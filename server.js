const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const morgan = require('morgan');
require('dotenv').config();
const { db, init, settingsObject } = require('./db');

init();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, {recursive:true});

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(morgan('tiny'));
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname,'public'), { extensions:['html'] }));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_');
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB || 750) * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(video|image|audio)\//.test(file.mimetype) || ['application/pdf'].includes(file.mimetype);
    cb(allowed ? null : new Error('Unsupported file type'), allowed);
  }
});

function signUser(user) { return jwt.sign({id:user.id,email:user.email,role:user.role}, JWT_SECRET, {expiresIn:'7d'}); }
function requireAdmin(req,res,next){
  try{
    const token=req.cookies.levi_admin;
    if(!token) return res.status(401).json({error:'Unauthorized'});
    req.user=jwt.verify(token,JWT_SECRET);
    next();
  }catch{ return res.status(401).json({error:'Unauthorized'}); }
}
function slugify(s){ return String(s||'').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') || `project-${Date.now()}`; }
function parseJson(v,fallback=[]){ try{return v?JSON.parse(v):fallback}catch{return fallback} }
function formatImageUrl(url,width=0){if(!url)return '';const u=String(url).trim(),dMatch=u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||u.match(/[?&]id=([a-zA-Z0-9_-]+)/);if(dMatch&&(u.includes('drive.google.com')||u.includes('docs.google.com'))){const id=dMatch[1];return width?`https://lh3.googleusercontent.com/d/${id}=w${width}`:`https://lh3.googleusercontent.com/d/${id}`}return u;}
function publicProject(row){
  if(!row)return row;
  return {
    ...row,
    thumbnail_url:formatImageUrl(row.thumbnail_url,600),
    poster_url:formatImageUrl(row.poster_url),
    og_image:formatImageUrl(row.og_image),
    before_url:formatImageUrl(row.before_url),
    after_url:formatImageUrl(row.after_url),
    featured:Boolean(row.featured),
    timeline:parseJson(row.timeline_json,{}),
    markers:parseJson(row.markers_json,[]),
    breakdown:parseJson(row.breakdown_json,[]),
    gallery:parseJson(row.gallery_json,[]).map(x=>typeof x==='string'?formatImageUrl(x):{...x,url:formatImageUrl(x.url)})
  };
}
function hashIp(ip){ return crypto.createHash('sha256').update(String(ip||'')).digest('hex').slice(0,24); }

// Public API
app.get('/api/site', (_req,res)=>{
  const projects = db.prepare("SELECT * FROM projects WHERE status='published' AND (publish_at IS NULL OR publish_at <= datetime('now')) ORDER BY featured DESC, updated_at DESC").all().map(publicProject);
  const services = db.prepare('SELECT * FROM services WHERE published=1 ORDER BY sort_order ASC').all().map(r=>({...r,deliverables:parseJson(r.deliverables_json,[])}));
  const pricing = db.prepare('SELECT * FROM pricing WHERE published=1 ORDER BY sort_order ASC').all().map(r=>({...r,featured:Boolean(r.featured),deliverables:parseJson(r.deliverables_json,[]),features:parseJson(r.features_json,[])}));
  res.json({settings:settingsObject(),projects,services,pricing});
});
app.get('/api/projects', (req,res)=>{
  const cat = req.query.category;
  let rows;
  if(cat && cat!=='all') rows=db.prepare("SELECT * FROM projects WHERE status='published' AND category=? ORDER BY featured DESC, updated_at DESC").all(cat);
  else rows=db.prepare("SELECT * FROM projects WHERE status='published' ORDER BY featured DESC, updated_at DESC").all();
  res.json(rows.map(publicProject));
});
app.get('/api/projects/:slug', (req,res)=>{
  const row=db.prepare("SELECT * FROM projects WHERE slug=? AND status='published'").get(req.params.slug);
  if(!row) return res.status(404).json({error:'Project not found'});
  res.json(publicProject(row));
});
app.post('/api/inquiries', upload.single('attachment'), (req,res)=>{
  try{
    const b=req.body||{};
    if(!b.name || !b.email || !b.message) return res.status(400).json({error:'Name, email and message are required.'});
    const attachment=req.file ? `/uploads/${req.file.filename}` : null;
    const info=db.prepare(`INSERT INTO inquiries(name,email,company,project_type,service,budget,deadline,video_duration,platform,audience,goals,deliverables,raw_footage_available,reference_links,communication_preference,message,attachment_url,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      b.name,b.email,b.company||'',b.project_type||'',b.service||'',b.budget||'',b.deadline||'',b.video_duration||'',b.platform||'',b.audience||'',b.goals||'',b.deliverables||'',b.raw_footage_available||'',b.reference_links||'',b.communication_preference||'',b.message,attachment,b.source||'website'
    );
    res.status(201).json({ok:true,id:info.lastInsertRowid});
  }catch(err){ res.status(500).json({error:'Unable to submit inquiry.'}); }
});
app.post('/api/analytics/event',(req,res)=>{
  try{
    const {event_name,project_slug,path:pagePath,metadata}=req.body||{};
    if(!event_name) return res.status(400).json({error:'event_name required'});
    db.prepare('INSERT INTO analytics_events(event_name,project_slug,path,metadata_json,ip_hash) VALUES (?,?,?,?,?)').run(event_name,project_slug||null,pagePath||null,JSON.stringify(metadata||{}),hashIp(req.ip));
    res.status(204).end();
  }catch{res.status(204).end();}
});

// Auth
app.post('/api/admin/login',(req,res)=>{
  const {email,password}=req.body||{};
  const u=db.prepare('SELECT * FROM users WHERE email=?').get(email||'');
  if(!u || !bcrypt.compareSync(password||'',u.password_hash)) return res.status(401).json({error:'Invalid credentials'});
  const token=signUser(u);
  res.cookie('levi_admin',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:7*24*60*60*1000,path:'/'});
  res.json({ok:true,user:{email:u.email,role:u.role}});
});
app.post('/api/admin/logout',(req,res)=>{res.clearCookie('levi_admin',{httpOnly:true,sameSite:'strict',path:'/'});res.json({ok:true});});
app.get('/api/admin/session',requireAdmin,(req,res)=>res.json({authenticated:true,user:req.user}));

// Admin dashboard data
app.get('/api/admin/overview',requireAdmin,(req,res)=>{
  const counts={
    projects:db.prepare('SELECT COUNT(*) c FROM projects').get().c,
    published:db.prepare("SELECT COUNT(*) c FROM projects WHERE status='published'").get().c,
    inquiries:db.prepare('SELECT COUNT(*) c FROM inquiries').get().c,
    newInquiries:db.prepare("SELECT COUNT(*) c FROM inquiries WHERE status='new'").get().c,
    media:db.prepare('SELECT COUNT(*) c FROM media_assets').get().c
  };
  res.json(counts);
});
app.get('/api/admin/projects',requireAdmin,(req,res)=>{
  const rows=db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(rows.map(publicProject));
});
app.post('/api/admin/projects',requireAdmin,(req,res)=>{
  try{
    const b=req.body||{};
    if(!b.title || !b.category) return res.status(400).json({error:'Title and category are required.'});
    const slug=slugify(b.slug||b.title);
    const q=db.prepare(`INSERT INTO projects(title,slug,category,subcategory,year,client,client_visibility,featured,thumbnail_url,poster_url,video_url,video_hosting,video_privacy,description,objective,role,editing_approach,tools,duration,timeline_json,markers_json,raw_footage_url,before_url,after_url,breakdown_json,editing_dna,gallery_json,cta_label,cta_url,seo_title,seo_description,og_image,status,publish_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`);
    const info=q.run(b.title,slug,b.category,b.subcategory||'',b.year||null,b.client||'',b.client_visibility||'public',b.featured?1:0,b.thumbnail_url||'',b.poster_url||'',b.video_url||'',b.video_hosting||'self',b.video_privacy||'public',b.description||'',b.objective||'',b.role||'',b.editing_approach||'',b.tools||'',b.duration||'',JSON.stringify(b.timeline||{}),JSON.stringify(b.markers||[]),b.raw_footage_url||'',b.before_url||'',b.after_url||'',JSON.stringify(b.breakdown||[]),b.editing_dna||'',JSON.stringify(b.gallery||[]),b.cta_label||'Start a Project',b.cta_url||'#contact',b.seo_title||'',b.seo_description||'',b.og_image||'',b.status||'draft',b.publish_at||null);
    res.status(201).json(publicProject(db.prepare('SELECT * FROM projects WHERE id=?').get(info.lastInsertRowid)));
  }catch(err){res.status(400).json({error:err.message.includes('UNIQUE')?'Slug already exists.':err.message});}
});
app.put('/api/admin/projects/:id',requireAdmin,(req,res)=>{
  try{
    const b=req.body||{}; const id=Number(req.params.id);
    const current=db.prepare('SELECT * FROM projects WHERE id=?').get(id); if(!current)return res.status(404).json({error:'Not found'});
    const fields=['title','slug','category','subcategory','year','client','client_visibility','thumbnail_url','poster_url','video_url','video_hosting','video_privacy','description','objective','role','editing_approach','tools','duration','raw_footage_url','before_url','after_url','editing_dna','cta_label','cta_url','seo_title','seo_description','og_image','status','publish_at'];
    const vals=fields.map(k=>b[k]!==undefined?b[k]:current[k]);
    const sql=`UPDATE projects SET ${fields.map(k=>`${k}=?`).join(',')}, featured=?, timeline_json=?, markers_json=?, breakdown_json=?, gallery_json=?, updated_at=datetime('now') WHERE id=?`;
    db.prepare(sql).run(...vals,b.featured!==undefined?(b.featured?1:0):current.featured,JSON.stringify(b.timeline??parseJson(current.timeline_json,{})),JSON.stringify(b.markers??parseJson(current.markers_json,[])),JSON.stringify(b.breakdown??parseJson(current.breakdown_json,[])),JSON.stringify(b.gallery??parseJson(current.gallery_json,[])),id);
    res.json(publicProject(db.prepare('SELECT * FROM projects WHERE id=?').get(id)));
  }catch(err){res.status(400).json({error:err.message.includes('UNIQUE')?'Slug already exists.':err.message});}
});
app.delete('/api/admin/projects/:id',requireAdmin,(req,res)=>{db.prepare('DELETE FROM projects WHERE id=?').run(Number(req.params.id));res.json({ok:true});});

app.get('/api/admin/services',requireAdmin,(req,res)=>res.json(db.prepare('SELECT * FROM services ORDER BY sort_order').all().map(r=>({...r,deliverables:parseJson(r.deliverables_json,[])}))));
app.put('/api/admin/services/:id',requireAdmin,(req,res)=>{
  const b=req.body||{}; db.prepare('UPDATE services SET title=?,description=?,tools=?,deliverables_json=?,sort_order=?,published=?,updated_at=datetime(\'now\') WHERE id=?').run(b.title,b.description||'',b.tools||'',JSON.stringify(b.deliverables||[]),Number(b.sort_order||0),b.published?1:0,Number(req.params.id)); res.json({ok:true});
});

app.get('/api/admin/pricing',requireAdmin,(req,res)=>res.json(db.prepare('SELECT * FROM pricing ORDER BY sort_order').all().map(r=>({...r,deliverables:parseJson(r.deliverables_json,[]),features:parseJson(r.features_json,[])}))));
app.put('/api/admin/pricing/:id',requireAdmin,(req,res)=>{
  const b=req.body||{}; db.prepare('UPDATE pricing SET name=?,description=?,price=?,currency=?,deliverables_json=?,revisions=?,turnaround=?,features_json=?,featured=?,availability=?,cta_label=?,sort_order=?,published=?,updated_at=datetime(\'now\') WHERE id=?').run(b.name,b.description||'',b.price||'Custom quote',b.currency||'INR',JSON.stringify(b.deliverables||[]),b.revisions||'',b.turnaround||'',JSON.stringify(b.features||[]),b.featured?1:0,b.availability||'',b.cta_label||'Start a Project',Number(b.sort_order||0),b.published?1:0,Number(req.params.id)); res.json({ok:true});
});

app.get('/api/admin/settings',requireAdmin,(req,res)=>res.json(settingsObject()));
app.put('/api/admin/settings',requireAdmin,(req,res)=>{
  const body=req.body||{}; const stmt=db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.transaction(()=>Object.entries(body).forEach(([k,v])=>stmt.run(k,String(v??''))))(); res.json(settingsObject());
});

app.get('/api/admin/inquiries',requireAdmin,(req,res)=>res.json(db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all()));
app.put('/api/admin/inquiries/:id',requireAdmin,(req,res)=>{const b=req.body||{};db.prepare('UPDATE inquiries SET status=?,priority=?,updated_at=datetime(\'now\') WHERE id=?').run(b.status||'new',b.priority||'normal',Number(req.params.id));res.json({ok:true});});

app.get('/api/admin/media',requireAdmin,(req,res)=>res.json(db.prepare('SELECT * FROM media_assets ORDER BY created_at DESC').all()));
app.post('/api/admin/media',requireAdmin,upload.single('file'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'File required'});
  const type=req.file.mimetype.startsWith('video/')?'video':req.file.mimetype.startsWith('image/')?'image':req.file.mimetype.startsWith('audio/')?'audio':'file';
  const url=`/uploads/${req.file.filename}`;
  const info=db.prepare('INSERT INTO media_assets(filename,original_name,mime_type,size_bytes,url,type) VALUES (?,?,?,?,?,?)').run(req.file.filename,req.file.originalname,req.file.mimetype,req.file.size,url,type);
  res.status(201).json({...db.prepare('SELECT * FROM media_assets WHERE id=?').get(info.lastInsertRowid)});
});
app.delete('/api/admin/media/:id',requireAdmin,(req,res)=>{const row=db.prepare('SELECT * FROM media_assets WHERE id=?').get(Number(req.params.id));if(!row)return res.status(404).json({error:'Not found'});try{fs.unlinkSync(path.join(uploadDir,row.filename));}catch{}db.prepare('DELETE FROM media_assets WHERE id=?').run(row.id);res.json({ok:true});});

// Basic client presentation / review system
app.post('/api/admin/clients',requireAdmin,(req,res)=>{const b=req.body||{};if(!b.name)return res.status(400).json({error:'Client name required'});const x=db.prepare('INSERT INTO clients(name,company,email,logo_url,notes) VALUES (?,?,?,?,?)').run(b.name,b.company||'',b.email||'',b.logo_url||'',b.notes||'');res.status(201).json(db.prepare('SELECT * FROM clients WHERE id=?').get(x.lastInsertRowid));});
app.get('/api/admin/clients',requireAdmin,(req,res)=>res.json(db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all()));
app.post('/api/admin/client-access',requireAdmin,(req,res)=>{const b=req.body||{};if(!b.client_id||!b.project_id)return res.status(400).json({error:'client_id and project_id required'});const token=crypto.randomBytes(24).toString('hex');const x=db.prepare('INSERT INTO client_access(client_id,project_id,access_token,expires_at) VALUES (?,?,?,?)').run(Number(b.client_id),Number(b.project_id),token,b.expires_at||null);res.status(201).json({id:x.lastInsertRowid,token,url:`/client/${token}`});});
app.get('/api/client/:token',(req,res)=>{const a=db.prepare(`SELECT ca.*, c.name client_name,c.company, p.title,p.slug,p.description,p.poster_url,p.video_url,p.video_privacy FROM client_access ca JOIN clients c ON c.id=ca.client_id JOIN projects p ON p.id=ca.project_id WHERE ca.access_token=? AND ca.enabled=1`).get(req.params.token);if(!a)return res.status(404).json({error:'Access link not found'});if(a.expires_at && new Date(a.expires_at)<new Date())return res.status(410).json({error:'Access link expired'});const comments=db.prepare('SELECT * FROM review_comments WHERE access_id=? ORDER BY created_at ASC').all(a.id);res.json({...a,comments});});
app.post('/api/client/:token/comments',(req,res)=>{const a=db.prepare('SELECT * FROM client_access WHERE access_token=? AND enabled=1').get(req.params.token);if(!a)return res.status(404).json({error:'Access link not found'});const b=req.body||{};if(!b.author_name||!b.body)return res.status(400).json({error:'Name and comment required'});const x=db.prepare('INSERT INTO review_comments(access_id,timestamp_seconds,author_name,body) VALUES (?,?,?,?)').run(a.id,Number.isFinite(Number(b.timestamp_seconds))?Number(b.timestamp_seconds):null,b.author_name,b.body);res.status(201).json(db.prepare('SELECT * FROM review_comments WHERE id=?').get(x.lastInsertRowid));});
app.put('/api/admin/review-comments/:id',requireAdmin,(req,res)=>{const b=req.body||{};db.prepare('UPDATE review_comments SET status=? WHERE id=?').run(b.status||'open',Number(req.params.id));res.json({ok:true});});

app.get('/admin', (_req,res)=>res.sendFile(path.join(__dirname,'public','admin','index.html')));
app.get('/client/:token', (_req,res)=>res.sendFile(path.join(__dirname,'public','client.html')));
app.use((req,res,next)=>{
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found'});
  if(req.method !== 'GET') return next();
  res.sendFile(path.join(__dirname,'public','index.html'));
});

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:err.message||'Server error'});});

app.listen(PORT,()=>console.log(`Levi portfolio running at http://localhost:${PORT}`));
