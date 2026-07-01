const $ = (id) => document.getElementById(id);
const ellipsoids = {
  wgs84: { a: 6378137, invF: 298.257223563 },
  cgcs2000: { a: 6378137, invF: 298.257222101 },
  grs80: { a: 6378137, invF: 298.257222101 }
};
const modes = {
  'geo-ecef': { input: 'GEODETIC', output: 'ECEF', fields: [['lat','纬度 B','°','-90 ～ 90'],['lon','经度 L','°','-180 ～ 180'],['h','椭球高 h','m','例如 50.000']] },
  'ecef-geo': { input: 'ECEF', output: 'GEODETIC', fields: [['x','X','m','地心直角坐标'],['y','Y','m','地心直角坐标'],['z','Z','m','地心直角坐标']] },
  'ecef-enu': { input: 'ECEF', output: 'ENU', fields: [['x','X','m','目标点坐标'],['y','Y','m','目标点坐标'],['z','Z','m','目标点坐标']], origin: true },
  'enu-ecef': { input: 'ENU', output: 'ECEF', fields: [['e','东向 E','m','相对站心'],['n','北向 N','m','相对站心'],['u','天向 U','m','相对站心']], origin: true }
};

function params(){
  if ($('ellipsoid').value === 'custom') return { a:+$('semiMajor').value, invF:+$('inverseFlattening').value };
  return ellipsoids[$('ellipsoid').value];
}
function constants(){ const p=params(), f=1/p.invF; return {a:p.a, e2:f*(2-f)}; }
function geoToEcef(lat,lon,h){ const {a,e2}=constants(), b=lat*Math.PI/180,l=lon*Math.PI/180,n=a/Math.sqrt(1-e2*Math.sin(b)**2); return {x:(n+h)*Math.cos(b)*Math.cos(l),y:(n+h)*Math.cos(b)*Math.sin(l),z:(n*(1-e2)+h)*Math.sin(b)}; }
function ecefToGeo(x,y,z){
  const {a,e2}=constants(), p=Math.hypot(x,y); if(p<1e-9 && Math.abs(z)<1e-9) throw Error('地心点无法定义经纬度');
  let lon=Math.atan2(y,x), lat=Math.atan2(z,p*(1-e2)), h=0;
  for(let i=0;i<15;i++){ const n=a/Math.sqrt(1-e2*Math.sin(lat)**2); h=Math.abs(Math.cos(lat))>1e-12?p/Math.cos(lat)-n:Math.abs(z)-n*(1-e2); const next=Math.atan2(z,p*(1-e2*n/(n+h))); if(Math.abs(next-lat)<1e-14){lat=next;break} lat=next; }
  const n=a/Math.sqrt(1-e2*Math.sin(lat)**2); h=Math.abs(Math.cos(lat))>1e-12?p/Math.cos(lat)-n:Math.abs(z)-n*(1-e2);
  return {lat:lat*180/Math.PI,lon:lon*180/Math.PI,h};
}
function origin(){ const lat=+$('originLat').value,lon=+$('originLon').value,h=+$('originH').value; validateGeo(lat,lon,h); return {lat,lon,h,...geoToEcef(lat,lon,h)}; }
function ecefToEnu(x,y,z){ const o=origin(),b=o.lat*Math.PI/180,l=o.lon*Math.PI/180,dx=x-o.x,dy=y-o.y,dz=z-o.z; return {e:-Math.sin(l)*dx+Math.cos(l)*dy,n:-Math.sin(b)*Math.cos(l)*dx-Math.sin(b)*Math.sin(l)*dy+Math.cos(b)*dz,u:Math.cos(b)*Math.cos(l)*dx+Math.cos(b)*Math.sin(l)*dy+Math.sin(b)*dz}; }
function enuToEcef(e,n,u){ const o=origin(),b=o.lat*Math.PI/180,l=o.lon*Math.PI/180; return {x:o.x-Math.sin(l)*e-Math.sin(b)*Math.cos(l)*n+Math.cos(b)*Math.cos(l)*u,y:o.y+Math.cos(l)*e-Math.sin(b)*Math.sin(l)*n+Math.cos(b)*Math.sin(l)*u,z:o.z+Math.cos(b)*n+Math.sin(b)*u}; }
function validateGeo(lat,lon,h){ if(![lat,lon,h].every(Number.isFinite)) throw Error('请填写完整、有效的数字'); if(lat < -90 || lat > 90) throw Error('纬度必须位于 -90° 到 90°'); if(lon < -180 || lon > 180) throw Error('经度必须位于 -180° 到 180°'); }
function readValues(){ return Object.fromEntries(modes[$('mode').value].fields.map(([id])=>[id,+$(id).value])); }
function renderFields(){
  const m=modes[$('mode').value]; $('inputType').textContent=m.input; $('outputType').textContent=m.output;
  $('inputFields').innerHTML=m.fields.map(([id,name,unit,hint])=>`<label>${name} (${unit})<input id="${id}" type="number" step="any" placeholder="${hint}"><span class="field-hint">十进制数值</span></label>`).join('');
  $('originFields').classList.toggle('hidden',!m.origin); resetResult(); $('error').textContent='';
}
function resetResult(){ $('emptyResult').classList.remove('hidden'); $('resultContent').classList.add('hidden'); $('copyResult').classList.add('hidden'); }
function resultRows(obj){ const defs={x:['X','m'],y:['Y','m'],z:['Z','m'],lat:['B','°'],lon:['L','°'],h:['h','m'],e:['E','m'],n:['N','m'],u:['U','m']}; return Object.entries(obj).map(([k,v])=>`<div class="result-row"><span class="result-symbol">${defs[k][0]}</span><span class="result-value">${v.toFixed(defs[k][1]==='°'?9:4)}</span><span class="result-unit">${defs[k][1]}</span></div>`).join(''); }
function convert(){
  try{
    const p=params(); if(!Number.isFinite(p.a)||p.a<=0||!Number.isFinite(p.invF)||p.invF<=1) throw Error('自定义椭球参数无效');
    const mode=$('mode').value,v=readValues(); if(!Object.values(v).every(Number.isFinite)) throw Error('请填写完整、有效的数字'); let out;
    if(mode==='geo-ecef'){validateGeo(v.lat,v.lon,v.h);out=geoToEcef(v.lat,v.lon,v.h)}
    else if(mode==='ecef-geo') out=ecefToGeo(v.x,v.y,v.z);
    else if(mode==='ecef-enu') out=ecefToEnu(v.x,v.y,v.z);
    else out=enuToEcef(v.e,v.n,v.u);
    $('resultContent').innerHTML=resultRows(out); $('resultContent').classList.remove('hidden'); $('emptyResult').classList.add('hidden'); $('copyResult').classList.remove('hidden'); $('error').textContent='';
  }catch(e){$('error').textContent=e.message;resetResult()}
}
function sample(){
  const mode=$('mode').value, values=mode==='geo-ecef'?{lat:39.9042,lon:116.4074,h:50}:mode==='ecef-geo'?{x:-2179637.0666,y:4388742.8729,z:4072314.1032}:mode==='ecef-enu'?{x:-2179559.473,y:4388791.214,z:4072391.381}:{e:100,n:80,u:10};
  Object.entries(values).forEach(([k,v])=>$(k).value=v); if(modes[mode].origin){$('originLat').value=39.9042;$('originLon').value=116.4074;$('originH').value=50} convert();
}
function swap(){ const map={'geo-ecef':'ecef-geo','ecef-geo':'geo-ecef','ecef-enu':'enu-ecef','enu-ecef':'ecef-enu'}; $('mode').value=map[$('mode').value]; renderFields(); }
$('mode').addEventListener('change',renderFields); $('ellipsoid').addEventListener('change',()=>{$('customEllipsoid').classList.toggle('hidden',$('ellipsoid').value!=='custom');resetResult()});
$('convert').addEventListener('click',convert); $('fillExample').addEventListener('click',sample); $('swapMode').addEventListener('click',swap);
$('clear').addEventListener('click',()=>{document.querySelectorAll('.workbench input').forEach(x=>x.value='');$('error').textContent='';resetResult()});
$('copyResult').addEventListener('click',async()=>{const text=[...document.querySelectorAll('.result-row')].map(r=>`${r.children[0].textContent} = ${r.children[1].textContent} ${r.children[2].textContent}`).join('\n');await navigator.clipboard.writeText(text);$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1600)});
function convertDms(){
  if($('dmsMode').value==='decimal-dms') return convertDecimalToDms();
  const d=+$('dmsDegrees').value,m=+$('dmsMinutes').value,s=+$('dmsSeconds').value,dir=$('dmsDirection').value;
  try{
    if(![d,m,s].every(Number.isFinite)||[$('dmsDegrees'),$('dmsMinutes'),$('dmsSeconds')].some(x=>x.value==='')) throw Error('请完整填写度、分、秒');
    if(d<0||m<0||m>=60||s<0||s>=60) throw Error('度不能为负，分和秒必须在 0（含）到 60（不含）之间');
    const max=(dir==='N'||dir==='S')?90:180;
    if(d>max||(d===max&&(m!==0||s!==0))) throw Error(`${dir==='N'||dir==='S'?'纬度':'经度'}不能超过 ${max}°`);
    const decimal=((dir==='W'||dir==='S')?-1:1)*(d+m/60+s/3600);
    $('decimalDegrees').textContent=`${decimal.toFixed(9)}°`;
    $('copyDms').classList.remove('hidden'); $('dmsError').textContent='';
  }catch(e){$('dmsError').textContent=e.message;$('decimalDegrees').textContent='—';$('copyDms').classList.add('hidden')}
}
function convertDecimalToDms(){
  try{
    if($('decimalInput').value==='') throw Error('请输入十进制度');
    const value=+$('decimalInput').value,type=$('coordinateType').value,max=type==='latitude'?90:180;
    if(!Number.isFinite(value)) throw Error('请输入有效的十进制度');
    if(value < -max || value > max) throw Error(`${type==='latitude'?'纬度':'经度'}必须位于 -${max}° 到 ${max}°`);
    const totalSeconds=Math.round(Math.abs(value)*3600*1e6)/1e6,d=Math.floor(totalSeconds/3600),remainder=totalSeconds-d*3600,m=Math.floor(remainder/60),s=remainder-m*60;
    const direction=type==='latitude'?(value<0?'S':'N'):(value<0?'W':'E');
    $('decimalDegrees').textContent=`${d}° ${m}′ ${s.toFixed(6)}″ ${direction}`;
    $('copyDms').classList.remove('hidden');$('dmsError').textContent='';
  }catch(e){$('dmsError').textContent=e.message;$('decimalDegrees').textContent='—';$('copyDms').classList.add('hidden')}
}
function resetDmsResult(){$('decimalDegrees').textContent='—';$('dmsError').textContent='';$('copyDms').classList.add('hidden')}
$('dmsMode').addEventListener('change',()=>{const reverse=$('dmsMode').value==='decimal-dms';$('dmsInputGroup').classList.toggle('hidden',reverse);$('decimalInputGroup').classList.toggle('hidden',!reverse);$('dmsResultLabel').textContent=reverse?'度分秒':'十进制度';resetDmsResult()});
$('convertDms').addEventListener('click',convertDms);
$('clearDms').addEventListener('click',()=>{['dmsDegrees','dmsMinutes','dmsSeconds','decimalInput'].forEach(id=>$(id).value='');resetDmsResult()});
$('copyDms').addEventListener('click',async()=>{await navigator.clipboard.writeText($('decimalDegrees').textContent.replace('°',''));$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1600)});
renderFields();
