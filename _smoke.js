/* 생각대로 · 배포 전 자동 점검 (읽기 전용 — 데이터를 만들거나 지우지 않는다)
   쓰는 법: fetch('/_smoke.js').then(r=>r.text()).then(t=>eval(t))
   BLOCK 이면 배포 금지. 사고가 나면 그 자리서 한 줄 추가한다. */
(async function(){
  const R=[], ok=(n,m)=>R.push(['✅',n,m||'']), warn=(n,m)=>R.push(['⚠️',n,m||'']), bad=(n,m)=>R.push(['❌',n,m||'']);
  const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);

  /* ── 1. 문법: 메인 스크립트가 통째로 죽지 않았나 ── */
  let src='';
  try{
    const html=await (await fetch('index.html',{cache:'no-store'})).text();
    const blocks=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
    src=blocks.join('\n');
    let broken=-1;
    blocks.forEach((b,i)=>{ try{ new Function(b) }catch(e){ if(broken<0) broken=i } });
    broken<0 ? ok('문법', blocks.length+'개 블록 정상')
             : bad('문법', (broken+1)+'번째 <script> 파싱 실패 — 앱이 백지가 된다');
  }catch(e){ bad('문법','index.html 을 읽지 못함: '+e.message) }

  /* ── 2. 함수 생존: 뭘 지우다 옆 함수까지 잘리는 사고 ── */
  const FN=['capture','renderHome','renderDo','renderStore','renderCal','renderMe','renderAll',
            'rowHtml','mergeAll','syncNow','syRpc','doLogin','showLock','openPw','openPhoto','renderPv',
            'shrink','imgPut','imgGet','ingest','addPending','countTo','go','toast','save','touch','bury'];
  const dead=FN.filter(f=>!new RegExp('function\\s+'+f+'\\b|(const|let|var)\\s+'+f+'\\s*=').test(src));
  dead.length ? bad('함수 생존','사라짐: '+dead.join(', ')) : ok('함수 생존',FN.length+'개 전부 있음');

  /* ── 3. 요소 생존: 버튼이 실종되어 흐름이 끊기는 사고 ── */
  const IDS=['cap','cap-btn','cap-ph','kind-bar','pick-later','home-list','dock','sheet','tb-set','tb-lock',
             'lock','lg-code','lg-pin','lock-go','pw-ov','pw-go','scr-sync','sy-now','scr-photo','pv-side',
             'dz','strip','ph-file','set-lock','set-admin','set-export','set-import','toast'];
  const gone=IDS.filter(i=>!document.getElementById(i));
  gone.length ? bad('요소 생존','없음: '+gone.join(', ')) : ok('요소 생존',IDS.length+'개 전부 있음');

  /* ── 4. 데이터 무결: 조용한 오염 ── */
  try{
    const notes=JSON.parse(localStorage.getItem('sgd-notes')||'[]');
    const noId=notes.filter(n=>!n||!n.id).length;
    const badKind=notes.filter(n=>n.kind&&!['memo','idea','todo'].includes(n.kind)).length;
    const badSt=notes.filter(n=>!['live','done','skip'].includes(n.st)).length;
    const doneNoTs=notes.filter(n=>n.st==='done'&&!n.doneTs).length;
    const msg=notes.length+'개 · id없음'+noId+' · 종류이상'+badKind+' · 상태이상'+badSt+' · 완료무시각'+doneNoTs;
    (noId||badKind||badSt||doneNoTs) ? bad('데이터 무결',msg) : ok('데이터 무결',msg);
    /* 사진 메타와 실제 이미지가 어긋났나 (고아 방지) */
    const pids=[]; notes.forEach(n=>(n.photos||[]).forEach(p=>pids.push(p.id)));
    if(pids.length){
      const db=await new Promise(res=>{const q=indexedDB.open('sgd-img',1);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)});
      if(db){
        const keys=await new Promise(res=>{const tx=db.transaction('img','readonly');const g=tx.objectStore('img').getAllKeys();g.onsuccess=()=>res(g.result||[]);g.onerror=()=>res([])});
        const miss=pids.filter(id=>!keys.includes(id)).length;
        const orphan=keys.filter(k=>!pids.includes(k)).length;
        (miss||orphan) ? warn('사진 짝맞춤','메타만 있고 사진 없음 '+miss+' · 버려진 사진 '+orphan)
                       : ok('사진 짝맞춤',pids.length+'장 정상');
      }
    } else ok('사진 짝맞춤','사진 없음');
  }catch(e){ bad('데이터 무결','읽기 실패: '+e.message) }

  /* ── 5. 화면: 가로 넘침 (폰에서 옆으로 새는 것) ── */
  const W=document.documentElement.clientWidth, over=[];
  $$('body *').forEach(el=>{
    const s=getComputedStyle(el);
    if(s.display==='none'||s.visibility==='hidden'||s.position==='fixed') return;
    const r=el.getBoundingClientRect();
    if(r.width&&r.right>W+2) over.push((el.id||el.className||el.tagName).toString().slice(0,28));
  });
  over.length ? bad('가로 넘침',over.slice(0,6).join(' / ')) : ok('가로 넘침','없음');

  /* ── 6. 헌법: 상시 반복 모션 (발열·눈 피로) ── */
  let inf=0, infWho=[];
  for(const ss of document.styleSheets){
    let rs; try{ rs=ss.cssRules }catch(e){ continue }
    for(const r of rs||[]){
      if(r.style&&/infinite/.test(r.style.animation||r.style.animationIterationCount||'')){
        inf++; if(infWho.length<4) infWho.push(r.selectorText||'?');
      }
    }
  }
  /* 전역 차단 규칙이 있으면 실제로는 안 돈다 */
  const guard=/animation-iteration-count:\s*1\s*!important/.test(
    [...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join(''));
  inf===0 ? ok('반복 모션','0개')
    : guard ? warn('반복 모션',inf+'개 선언돼 있으나 전역 차단(iteration-count:1)이 이김: '+infWho.join(','))
            : bad('반복 모션',inf+'개가 계속 돈다 — 헌법 위반: '+infWho.join(','));

  /* ── 7. 로그인 화면에 계정·비번이 적혀 있나 (2026-08-15 사고) ── */
  const lockTxt=($('#lock')||{textContent:''}).textContent||'';
  /(qkdna|EEEEEE|2222|0000)/i.test(lockTxt)
    ? bad('로그인 화면 비밀','계정/비번이 화면에 노출됨 — 지울 것')
    : ok('로그인 화면 비밀','노출 없음');

  /* ── 8. 입력칸 16px 미만 (아이폰 자동 확대) ── */
  const small=[...$$('input,textarea,select')].filter(el=>parseFloat(getComputedStyle(el).fontSize)<16)
    .map(el=>el.id||el.className);
  small.length ? bad('입력칸 16px',small.join(', ')) : ok('입력칸 16px','전부 16px 이상');

  /* ── 9. 폐기 확인: 되살아나면 안 되는 것 ── */
  const revived=[];
  if($('#lg-local')) revived.push('«로그인 없이 쓸게요» 버튼');
  if(/autocapitalize="characters"/.test(await (await fetch('index.html',{cache:'no-store'})).text())) revived.push('대문자 강제');
  revived.length ? bad('폐기 확인','되살아남: '+revived.join(', ')) : ok('폐기 확인','없음');

  /* ── 10. 오른쪽 상단 규칙 (로그아웃/뒤로) ── */
  const tbr=$('.tb-r');
  tbr && tbr.querySelector('#tb-lock') && tbr.querySelector('#tb-back')
    ? ok('오른쪽 상단','로그아웃·뒤로 제자리')
    : bad('오른쪽 상단','로그아웃 또는 뒤로 버튼이 상단 오른쪽에 없음');

  /* ── 결과 ── */
  const nBad=R.filter(r=>r[0]==='❌').length, nWarn=R.filter(r=>r[0]==='⚠️').length;
  const verdict=nBad?'BLOCK':(nWarn?'PASS_WITH_WARN':'PASS');
  console.log('%c생각대로 스모크 — '+verdict,'font-weight:800;font-size:14px');
  console.table(R.map(r=>({'':r[0],항목:r[1],내용:r[2]})));
  return {verdict, 실패:nBad, 경고:nWarn, 표:R};
})();
