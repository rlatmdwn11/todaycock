'use strict';

const DEFAULT_ADMIN_CODE='1111';
const SETTINGS_PASSWORD='todaycock01';
const ADMIN_CODE_KEY='todaycock2_admin_code';
const NICKNAME_KEY='todaycock2_nickname';
const APP_STATE_KEY='todaycock2_stable_state_v1';
const LEGACY_STATE_KEYS=['todaycock2_alpha2_state','todaycock2_state'];
const SAVE_META_KEY='todaycock2_stable_save_meta';

const $=(id)=>document.getElementById(id);
const state={
  players:[],
  schedule:[],
  currentRoundIndex:0,
  filter:'all',
  fixedPairs:{team1:[],team2:[]},
  settings:{
    mode:'balanced',matchType:'women',courts:3,rounds:5,targetGames:null,
    eventInfoEnabled:false,eventName:'',eventDate:'',team1Name:'팀1',team2Name:'팀2'
  }
};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function uid(){return `p_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');window.scrollTo({top:0,behavior:'instant'})}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
function getAdminCode(){return localStorage.getItem(ADMIN_CODE_KEY)||DEFAULT_ADMIN_CODE}
let saveTimer=null;

function setSaveStatus(status,message){
  const statusEl=document.getElementById('autoSaveStatus');
  const timeEl=document.getElementById('lastSavedTime');
  if(!statusEl)return;
  statusEl.classList.remove('saving','saved','error');
  statusEl.classList.add(status);
  statusEl.textContent=message;
  if(timeEl&&status==='saved'){
    const now=new Date();
    timeEl.textContent=`마지막 저장 ${now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  }
}

function sanitizeLoadedState(saved){
  if(!saved||typeof saved!=='object')return null;
  return {
    players:Array.isArray(saved.players)?saved.players:[],
    schedule:Array.isArray(saved.schedule)?saved.schedule:[],
    currentRoundIndex:Number.isInteger(saved.currentRoundIndex)?saved.currentRoundIndex:0,
    filter:saved.filter||'all',
    fixedPairs:saved.fixedPairs&&typeof saved.fixedPairs==='object'
      ? saved.fixedPairs:{team1:[],team2:[]},
    settings:{
      ...state.settings,
      ...(saved.settings&&typeof saved.settings==='object'?saved.settings:{})
    }
  };
}

function persistStateNow(){
  try{
    setSaveStatus('saving','● 저장 중');
    const payload={
      version:1,
      savedAt:new Date().toISOString(),
      state:state
    };
    localStorage.setItem(APP_STATE_KEY,JSON.stringify(payload));
    localStorage.setItem(SAVE_META_KEY,payload.savedAt);
    setSaveStatus('saved','● 자동 저장됨');
    return true;
  }catch(error){
    console.error('TODAYCOCK save failed',error);
    setSaveStatus('error','● 저장 실패');
    return false;
  }
}

function saveState(){
  clearTimeout(saveTimer);
  setSaveStatus('saving','● 저장 중');
  saveTimer=setTimeout(persistStateNow,120);
}

function loadState(){
  let raw=null;
  try{
    raw=localStorage.getItem(APP_STATE_KEY);
    if(raw){
      const parsed=JSON.parse(raw);
      const loaded=sanitizeLoadedState(parsed.state||parsed);
      if(loaded)Object.assign(state,loaded);
      return;
    }

    for(const key of LEGACY_STATE_KEYS){
      const legacyRaw=localStorage.getItem(key);
      if(!legacyRaw)continue;
      const legacy=JSON.parse(legacyRaw);
      const loaded=sanitizeLoadedState(legacy.state||legacy);
      if(loaded){
        Object.assign(state,loaded);
        persistStateNow();
        break;
      }
    }
  }catch(error){
    console.error('TODAYCOCK load failed',error);
    setSaveStatus('error','● 저장 데이터 읽기 실패');
  }
}

$('openAdminBtn').addEventListener('click',()=>{$('adminCode').value='';$('nickname').value=localStorage.getItem(NICKNAME_KEY)||'';$('adminError').textContent='';showScreen('adminLoginScreen')});
$('openViewerBtn').addEventListener('click',()=>{$('roomCode').value='';$('viewerError').textContent='';showScreen('viewerCodeScreen')});
document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.back)));
$('homeBtn').addEventListener('click',()=>showScreen('homeScreen'));

$('startAdminBtn').addEventListener('click',()=>{
  const code=$('adminCode').value.trim(),nickname=$('nickname').value.trim();
  if(!code){$('adminError').textContent='운영자 코드를 입력해주세요.';return}
  if(code!==getAdminCode()){$('adminError').textContent='운영자 코드가 올바르지 않습니다.';return}
  if(nickname)localStorage.setItem(NICKNAME_KEY,nickname);
  $('welcomeText').textContent=nickname?`${nickname} 운영자님`:'운영자 화면';
  showScreen('adminMainScreen');
});

$('watchBtn').addEventListener('click',()=>{
  const code=$('roomCode').value.trim().toUpperCase();
  if(!code){$('viewerError').textContent='팀전 코드를 입력해주세요.';return}
  $('viewerRoomTitle').textContent=code;showScreen('viewerScreen');
});

$('settingsBtn').addEventListener('click',()=>{
  $('settingsPassword').value='';$('newAdminCode').value='';$('confirmAdminCode').value='';
  $('settingsError').textContent='';$('changeCodeFields').hidden=true;$('settingsActionBtn').textContent='확인';
  $('settingsModal').classList.add('open');
});
$('closeSettingsBtn').addEventListener('click',()=>$('settingsModal').classList.remove('open'));
$('settingsActionBtn').addEventListener('click',()=>{
  const fields=$('changeCodeFields');
  if(fields.hidden){
    if($('settingsPassword').value!==SETTINGS_PASSWORD){$('settingsError').textContent='설정 비밀번호가 올바르지 않습니다.';return}
    $('settingsError').textContent='';fields.hidden=false;$('settingsActionBtn').textContent='운영자 코드 변경';return;
  }
  const next=$('newAdminCode').value.trim(),confirm=$('confirmAdminCode').value.trim();
  if(next.length<4){$('settingsError').textContent='새 운영자 코드는 4자 이상 입력해주세요.';return}
  if(next!==confirm){$('settingsError').textContent='새 운영자 코드가 서로 다릅니다.';return}
  localStorage.setItem(ADMIN_CODE_KEY,next);$('settingsModal').classList.remove('open');toast('운영자 코드가 변경되었습니다.');
});

function readSettings(){
  state.settings={
    mode:$('matchMode').value,
    matchType:$('matchType').value,
    courts:Math.max(1,Number($('courtCount').value)||1),
    rounds:Math.max(1,Number($('roundCount').value)||1),
    targetGames:Number($('targetGames').value)||null,
    eventInfoEnabled:$('eventInfoEnabled').checked,
    eventName:$('eventName').value.trim(),
    eventDate:$('eventDate').value,
    team1Name:$('team1Name').value.trim()||'팀1',
    team2Name:$('team2Name').value.trim()||'팀2'
  };
}
function applySettings(){
  $('matchMode').value=state.settings.mode;
  $('matchType').value=state.settings.matchType;
  $('courtCount').value=state.settings.courts;
  $('roundCount').value=state.settings.rounds;
  $('targetGames').value=state.settings.targetGames||'';
  $('eventInfoEnabled').checked=!!state.settings.eventInfoEnabled;
  $('eventName').value=state.settings.eventName||'';
  $('eventDate').value=state.settings.eventDate||'';
  $('team1Name').value=state.settings.team1Name||'팀1';
  $('team2Name').value=state.settings.team2Name||'팀2';
  $('eventInfoFields').classList.toggle('hidden',!state.settings.eventInfoEnabled);
  updateModePanels();
}
['matchMode','matchType','courtCount','roundCount','targetGames','eventName','eventDate','team1Name','team2Name'].forEach(id=>{
  $(id).addEventListener('change',()=>{readSettings();updateModePanels();saveState();renderReady();renderAiAdvice()});
});
$('eventInfoEnabled').addEventListener('change',()=>{
  $('eventInfoFields').classList.toggle('hidden',!$('eventInfoEnabled').checked);
  readSettings();saveState();
});


function updateModePanels(){
  const fixed=state.settings.mode==='fixed';
  $('fixedPartnerPanel').classList.toggle('hidden',!fixed);
  $('fixedTeam1Title').textContent=state.settings.team1Name||'팀1';
  $('fixedTeam2Title').textContent=state.settings.team2Name||'팀2';
  if(fixed)renderFixedPartners();
}
function teamPlayers(team){return state.players.filter(p=>p.team===team)}
function normalizeFixedPairs(){
  if(!state.fixedPairs)state.fixedPairs={team1:[],team2:[]};
  ['team1','team2'].forEach((key,idx)=>{
    const team=idx===0?'팀1':'팀2';
    const valid=new Set(teamPlayers(team).map(p=>p.id));
    state.fixedPairs[key]=(state.fixedPairs[key]||[])
      .map(pair=>(pair||[]).filter(id=>valid.has(id)).slice(0,2))
      .filter(pair=>pair.length);
  });
}
function fixedOptions(team,selected){
  return `<option value="">파트너 선택</option>`+teamPlayers(team).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)} (${p.grade})</option>`).join('');
}
function renderFixedTeam(team,key,targetId){
  const players=teamPlayers(team);
  const count=Math.ceil(players.length/2);
  const pairs=state.fixedPairs[key]||[];
  while(pairs.length<count)pairs.push([]);
  if(pairs.length>count)pairs.length=count;
  $(targetId).innerHTML=count?pairs.map((pair,i)=>`<div class="fixed-pair-row"><span>${i+1}조</span><select data-fixed="${key}|${i}|0">${fixedOptions(team,pair[0])}</select><b>↔</b><select data-fixed="${key}|${i}|1">${fixedOptions(team,pair[1])}</select></div>`).join(''):'<p class="help">해당 팀 선수를 먼저 등록해주세요.</p>';
}
function renderFixedPartners(){
  normalizeFixedPairs();
  renderFixedTeam('팀1','team1','fixedTeam1Pairs');
  renderFixedTeam('팀2','team2','fixedTeam2Pairs');
  document.querySelectorAll('[data-fixed]').forEach(sel=>sel.addEventListener('change',()=>{
    const [key,row,pos]=sel.dataset.fixed.split('|');
    const duplicate=(state.fixedPairs[key]||[]).some((pair,i)=>i!==Number(row)&&pair.includes(sel.value));
    if(sel.value&&duplicate){toast('같은 선수를 두 조에 중복 지정할 수 없습니다.');renderFixedPartners();return}
    state.fixedPairs[key][Number(row)][Number(pos)]=sel.value;
    saveState();renderReady();renderAiAdvice();
  }));
}
function autoPairPartners(){
  const grade={S:5,A:4,B:3,C:2,D:1};
  ['팀1','팀2'].forEach((team,idx)=>{
    const key=idx===0?'team1':'team2';
    const list=[...teamPlayers(team)].sort((a,b)=>(grade[b.grade]||0)-(grade[a.grade]||0));
    const pairs=[];
    while(list.length){const a=list.shift();const b=list.pop();pairs.push([a?.id,b?.id].filter(Boolean))}
    state.fixedPairs[key]=pairs;
  });
  saveState();renderFixedPartners();renderReady();renderAiAdvice();toast('급수 균형을 고려해 자동으로 짝지었습니다.');
}
$('autoPairBtn').addEventListener('click',autoPairPartners);
function fixedPairsComplete(){
  normalizeFixedPairs();
  return ['team1','team2'].every((key,idx)=>{
    const team=idx===0?'팀1':'팀2';
    const ids=(state.fixedPairs[key]||[]).flat().filter(Boolean);
    return ids.length===teamPlayers(team).length && new Set(ids).size===ids.length && (state.fixedPairs[key]||[]).every(p=>p.length===2);
  });
}
function analyzeSetup(){
  readSettings();
  const n=state.players.length,capacity=state.settings.courts*4;
  const desired=state.settings.targetGames||state.settings.courts*state.settings.rounds;
  const appearances=desired*4;
  const average=n?appearances/n:0;
  const teamMode=['team','fixed'].includes(state.settings.mode);
  const t1=teamPlayers('팀1').length,t2=teamPlayers('팀2').length;
  let title='설정 준비 중',text='선수를 4명 이상 등록해주세요.';
  if(n>=4){
    title=average>=3?'경기 수가 충분해요':'선수별 경기 수가 적을 수 있어요';
    text=`예상 1인 평균 ${average.toFixed(1)}경기 · 한 라운드 최대 ${Math.min(capacity,n-n%4)}명 출전.`;
    if(n>capacity)text+=` 라운드마다 약 ${n-capacity}명이 쉬게 됩니다.`;
    if(teamMode&&t1!==t2)text+=` 두 팀 인원이 ${Math.abs(t1-t2)}명 차이 나므로 출전 수 차이가 생길 수 있어요.`;
    if(state.settings.mode==='fixed'&&!fixedPairsComplete())text+=' 고정 파트너 설정을 모두 완료해주세요.';
  }
  return {title,text};
}
function renderAiAdvice(){const a=analyzeSetup();$('aiAdviceTitle').textContent=a.title;$('aiAdviceText').textContent=a.text}
$('aiAnalyzeBtn').addEventListener('click',()=>{renderAiAdvice();toast('AI 대진 분석을 완료했습니다.')});

$('addPlayerBtn').addEventListener('click',addPlayer);
$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')addPlayer()});
function addPlayer(){
  const name=$('playerName').value.trim();
  if(!name){toast('선수 이름을 입력해주세요.');return}
  state.players.push({id:uid(),name,team:$('playerTeam').value,gender:$('playerGender').value,grade:$('playerGrade').value});
  $('playerName').value='';normalizeFixedPairs();saveState();renderPlayers();renderFixedPartners();renderReady();renderAiAdvice();
}
$('clearPlayersBtn').addEventListener('click',()=>{
  if(!state.players.length)return;
  if(confirm('선수 명단을 모두 삭제할까요?')){state.players=[];state.schedule=[];state.fixedPairs={team1:[],team2:[]};saveState();renderAll();}
});
$('teamFilter').addEventListener('click',e=>{
  const btn=e.target.closest('button[data-filter]');if(!btn)return;
  state.filter=btn.dataset.filter;
  document.querySelectorAll('#teamFilter button').forEach(b=>b.classList.toggle('active',b===btn));
  renderPlayers();
});

function renderPlayers(){
  const t1=state.players.filter(p=>p.team==='팀1').length,t2=state.players.filter(p=>p.team==='팀2').length;
  $('playerSummary').innerHTML=`<span>전체 ${state.players.length}명</span><span>팀1 ${t1}명</span><span>팀2 ${t2}명</span>`;
  const list=state.filter==='all'?state.players:state.players.filter(p=>p.team===state.filter);
  $('playerList').innerHTML=list.length?list.map(p=>`
    <div class="player-row">
      <div><strong>${esc(p.name)}</strong><div class="meta">${esc(p.team)}</div></div>
      <span>${esc(p.team)}</span><span>${esc(p.gender)}</span><span>${esc(p.grade)}</span>
      <button class="delete-player" data-delete="${p.id}">×</button>
    </div>`).join(''):'<p class="help">등록된 선수가 없습니다.</p>';
  document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{
    state.players=state.players.filter(p=>p.id!==b.dataset.delete);
    state.schedule=[];normalizeFixedPairs();saveState();renderAll();
  }));
}

function renderReady(){
  readSettings();
  const teamMode=['team','fixed'].includes(state.settings.mode);
  const t1=state.players.filter(p=>p.team==='팀1').length,t2=state.players.filter(p=>p.team==='팀2').length;
  let msg=`선수 ${state.players.length}명 · ${state.settings.courts}코트 · ${state.settings.rounds}라운드`;
  let ok=state.players.length>=4;
  if(teamMode){msg+=` · 팀1 ${t1}명 / 팀2 ${t2}명`;ok=ok&&t1>=2&&t2>=2}
  if(state.settings.mode==='fixed'){const complete=fixedPairsComplete();ok=ok&&complete;msg+=complete?' · 파트너 설정 완료':' · 파트너 설정 필요'}
  $('readyMessage').textContent=ok?`${msg} · 생성 가능`: `${msg} · 선수 구성을 확인해주세요.`;
  $('generateBtn').disabled=!ok;
  $('generateBtn').style.opacity=ok?'1':'.5';
  $('generateBtn').textContent=state.schedule.length?'🔄 대진표 다시 만들기':'🏸 대진표 만들기';
}

$('generateBtn').addEventListener('click',()=>{
  readSettings();
  if(state.schedule.length&&!confirm('기존 대진표를 지우고 다시 만들까요?'))return;
  state.settings.fixedPairs=cloneData(state.fixedPairs);
  state.schedule=TodayCockSchedule.generate(state.players,state.settings);
  state.currentRoundIndex=0;
  if(!state.schedule.length){toast('현재 설정으로 대진을 만들 수 없습니다. 복식 종류와 인원을 확인해주세요.');return}
  saveState();renderAll();toast('대진표를 만들었습니다.');
  $('currentRoundCard').scrollIntoView({behavior:'smooth'});
});

function sideLabel(side){
  const teamMode=['team','fixed'].includes(state.settings.mode);
  if(!teamMode)return side===1?'조 A':'조 B';
  return side===1?(state.settings.team1Name||'팀1'):(state.settings.team2Name||'팀2');
}
function playerOptions(selected,side){
  const teamMode=['team','fixed'].includes(state.settings.mode);
  let pool=state.players;
  if(teamMode)pool=pool.filter(p=>p.team===(side===1?'팀1':'팀2'));
  return pool.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)} (${p.grade})</option>`).join('');
}

function renderCurrentRound(){
  if(!state.schedule.length){$('currentRoundCard').classList.add('hidden');return}
  $('currentRoundCard').classList.remove('hidden');
  const round=state.schedule[state.currentRoundIndex];
  $('currentRoundLabel').textContent=`${round.round}라운드 · ${round.matches.length}경기`;
  $('currentRoundMatches').innerHTML=round.matches.map((m,mi)=>`
    <div class="match-card">
      <div class="match-head"><span>${m.court}코트</span><span>${m.score1!==''&&m.score2!==''?'완료':'진행 전'}</span></div>
      <div class="match-sides">
        <div class="side-box">${esc(m.team1.map(p=>p.name).join(' / '))}</div><b>VS</b>
        <div class="side-box">${esc(m.team2.map(p=>p.name).join(' / '))}</div>
      </div>
      <div class="score-inputs">
        <input type="number" inputmode="numeric" placeholder="${esc(sideLabel(1))}" value="${m.score1}" data-score="${state.currentRoundIndex}|${mi}|1">
        <b>:</b>
        <input type="number" inputmode="numeric" placeholder="${esc(sideLabel(2))}" value="${m.score2}" data-score="${state.currentRoundIndex}|${mi}|2">
      </div>
    </div>`).join('');
  document.querySelectorAll('[data-score]').forEach(inp=>inp.addEventListener('input',()=>{
    const [ri,mi,side]=inp.dataset.score.split('|').map(Number);
    state.schedule[ri].matches[mi][side===1?'score1':'score2']=inp.value;
    saveState();renderSchedule();renderOverview();renderStats();
  }));
}
$('prevRoundBtn').addEventListener('click',()=>{if(state.currentRoundIndex>0){state.currentRoundIndex--;saveState();renderCurrentRound()}});
$('nextRoundBtn').addEventListener('click',()=>{if(state.currentRoundIndex<state.schedule.length-1){state.currentRoundIndex++;saveState();renderCurrentRound()}});

function renderSchedule(){
  if(!state.schedule.length){$('scheduleCard').classList.add('hidden');return}
  $('scheduleCard').classList.remove('hidden');
  $('scheduleList').innerHTML=state.schedule.map((r,ri)=>`
    <div class="round-block"><h4>${r.round}라운드</h4>
      <div class="schedule-edit-list">${r.matches.map((m,mi)=>`
        <div class="schedule-edit-card">
          <div class="schedule-edit-head"><strong>${m.court}코트</strong><span>${m.score1===''?'-':m.score1} : ${m.score2===''?'-':m.score2}</span></div>
          <div class="schedule-edit-sides">
            <div class="edit-side"><b>${esc(sideLabel(1))}</b><select data-player="${ri}|${mi}|1|0">${playerOptions(m.team1[0]?.id,1)}</select><select data-player="${ri}|${mi}|1|1">${playerOptions(m.team1[1]?.id,1)}</select></div>
            <div class="edit-vs">VS</div>
            <div class="edit-side"><b>${esc(sideLabel(2))}</b><select data-player="${ri}|${mi}|2|0">${playerOptions(m.team2[0]?.id,2)}</select><select data-player="${ri}|${mi}|2|1">${playerOptions(m.team2[1]?.id,2)}</select></div>
          </div>
        </div>`).join('')}</div>
    </div>`).join('');
  document.querySelectorAll('[data-player]').forEach(sel=>sel.addEventListener('change',()=>{
    const [ri,mi,side,pos]=sel.dataset.player.split('|').map(Number);
    const p=state.players.find(x=>x.id===sel.value);if(!p)return;
    state.schedule[ri].matches[mi][side===1?'team1':'team2'][pos]=p;
    saveState();renderCurrentRound();renderOverview();renderStats();
  }));
}

function renderOverview(){
  if(!state.schedule.length){$('overviewCard').classList.add('hidden');return}
  $('overviewCard').classList.remove('hidden');
  const rows=state.schedule.flatMap(r=>r.matches.map(m=>`
    <tr><td>${r.round}</td><td>${m.court}</td><td>${esc(m.team1.map(p=>p.name).join(' / '))}</td>
    <td>${m.score1===''?'-':m.score1} : ${m.score2===''?'-':m.score2}</td>
    <td>${esc(m.team2.map(p=>p.name).join(' / '))}</td></tr>`)).join('');
  $('overviewTableWrap').innerHTML=`<table><thead><tr><th>라운드</th><th>코트</th><th>${esc(sideLabel(1))}</th><th>점수</th><th>${esc(sideLabel(2))}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderStats(){
  if(!state.schedule.length){$('statsCard').classList.add('hidden');return}
  $('statsCard').classList.remove('hidden');
  const stats={};let t1w=0,t2w=0,draws=0;
  state.players.forEach(p=>stats[p.id]={name:p.name,team:p.team,games:0,wins:0,losses:0,draws:0});
  state.schedule.forEach(r=>r.matches.forEach(m=>{
    [...m.team1,...m.team2].forEach(p=>{if(stats[p.id])stats[p.id].games++});
    if(m.score1===''||m.score2==='')return;
    const a=Number(m.score1),b=Number(m.score2);
    if(a>b){t1w++;m.team1.forEach(p=>stats[p.id].wins++);m.team2.forEach(p=>stats[p.id].losses++)}
    else if(b>a){t2w++;m.team2.forEach(p=>stats[p.id].wins++);m.team1.forEach(p=>stats[p.id].losses++)}
    else{draws++;[...m.team1,...m.team2].forEach(p=>stats[p.id].draws++)}
  }));
  const teamMode=['team','fixed'].includes(state.settings.mode);
  $('teamScoreboard').innerHTML=teamMode?`<div class="team-scoreboard"><div class="team-score"><span>${esc(sideLabel(1))}</span><strong>${t1w}승</strong></div><b>VS</b><div class="team-score"><span>${esc(sideLabel(2))}</span><strong>${t2w}승</strong></div></div>`:'';
  const table=(title,rows)=>`<div class="team-stats-block"><h4>${esc(title)}</h4><div class="table-wrap"><table><thead><tr><th>선수</th><th>경기</th><th>승</th><th>패</th><th>무</th><th>승률</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${esc(s.name)}</td><td>${s.games}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td><td>${s.games?Math.round(s.wins/s.games*100):0}%</td></tr>`).join('')}</tbody></table></div></div>`;
  const all=Object.values(stats).sort((a,b)=>b.games-a.games||b.wins-a.wins);
  if(teamMode){
    $('statsTableWrap').innerHTML=`<div class="team-stats-grid">${table(sideLabel(1),all.filter(s=>s.team==='팀1'))}${table(sideLabel(2),all.filter(s=>s.team==='팀2'))}</div>`;
  }else{
    $('statsTableWrap').innerHTML=table('전체 선수',all);
  }
}

$('exportCsvBtn').addEventListener('click',()=>{
  if(!state.schedule.length)return;
  const rows=[['라운드','코트',`${sideLabel(1)} 선수1`,`${sideLabel(1)} 선수2`,`${sideLabel(1)} 점수`,`${sideLabel(2)} 선수1`,`${sideLabel(2)} 선수2`,`${sideLabel(2)} 점수`]];
  state.schedule.forEach(r=>r.matches.forEach(m=>rows.push([r.round,m.court,m.team1[0]?.name||'',m.team1[1]?.name||'',m.score1,m.team2[0]?.name||'',m.team2[1]?.name||'',m.score2])));
  const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='오늘콕_대진표.csv';a.click();URL.revokeObjectURL(url);
});

function renderAll(){applySettings();normalizeFixedPairs();renderPlayers();renderFixedPartners();renderReady();renderAiAdvice();renderCurrentRound();renderSchedule();renderOverview();renderStats()}
loadState();renderAll();

const room=new URLSearchParams(location.search).get('room');
if(room){$('viewerRoomTitle').textContent=room.toUpperCase();showScreen('viewerScreen')}


// ===== Alpha 3 Firebase realtime sharing =====
const LIVE_ROOM_KEY='todaycock2_live_room';
let liveSyncTimer=null;
let nicknameContinuation=false;

function initRealtime(){
  try{
    TodayCockFirebase.init();
    restoreLiveRoomUi();
    updateLiveOperatorUi();
  }catch(error){
    console.error(error);
    setLiveStatus('Firebase 오류','error');
  }
}

function getSavedNickname(){
  return localStorage.getItem(NICKNAME_KEY)||'';
}

function updateLiveOperatorUi(){
  const nickname=getSavedNickname();
  $('liveOperatorName').textContent=nickname||'닉네임 미설정';
}

function setLiveStatus(text,type=''){
  const badge=$('liveStatusBadge');
  badge.textContent=text;
  badge.classList.remove('active','error');
  if(type)badge.classList.add(type);
}

function generateRoomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='KOK-';
  for(let i=0;i<5;i++)code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function viewerUrl(code){
  const base=location.href.replace(/index\.html.*$/,'').replace(/\?.*$/,'');
  return `${base}viewer.html?room=${encodeURIComponent(code)}`;
}

function currentRoundNumber(){
  if(!state.schedule.length)return 1;
  const incomplete=state.schedule.find(r=>r.matches.some(m=>m.score1===''||m.score2===''));
  return incomplete?incomplete.round:state.schedule[state.schedule.length-1].round;
}

function livePayload(active=true){
  const flat=state.schedule.flatMap(r=>r.matches);
  const completed=flat.filter(m=>m.score1!==''&&m.score2!=='').length;
  let team1Wins=0,team2Wins=0,draws=0;

  flat.forEach(m=>{
    if(m.score1===''||m.score2==='')return;
    const a=Number(m.score1),b=Number(m.score2);
    if(a>b)team1Wins++;
    else if(b>a)team2Wins++;
    else draws++;
  });

  const currentUser=TodayCockFirebase.getCurrentUser();

  return {
    active,
    ownerUid:currentUser?.uid||'',
    ownerNickname:getSavedNickname(),
    updatedAt:TodayCockFirebase.serverTimestamp(),
    eventInfo:{
      enabled:!!state.settings.eventInfoEnabled,
      name:state.settings.eventName||'오늘콕 경기',
      date:state.settings.eventDate||'',
      team1:state.settings.team1Name||'팀1',
      team2:state.settings.team2Name||'팀2'
    },
    mode:state.settings.mode,
    matchType:state.settings.matchType,
    currentRound:currentRoundNumber(),
    progress:{
      completed,
      total:flat.length,
      percent:flat.length?Math.round(completed/flat.length*100):0
    },
    scoreboard:{team1Wins,team2Wins,draws},
    schedule:state.schedule.map(r=>({
      round:r.round,
      matches:r.matches.map(m=>({
        court:m.court,
        team1:m.team1.map(p=>({id:p.id,name:p.name,team:p.team,gender:p.gender,grade:p.grade})),
        team2:m.team2.map(p=>({id:p.id,name:p.name,team:p.team,gender:p.gender,grade:p.grade})),
        score1:m.score1,
        score2:m.score2
      }))
    }))
  };
}

async function ensureShareIdentity(){
  const nickname=getSavedNickname();
  if(!nickname){
    $('shareNickname').value='';
    $('shareNicknameError').textContent='';
    nicknameContinuation=true;
    $('nicknameModal').classList.add('open');
    throw new Error('NICKNAME_REQUIRED');
  }
  await TodayCockFirebase.saveNickname(nickname);
  updateLiveOperatorUi();
}

async function startLiveShare(){
  if(!state.schedule.length){
    toast('먼저 대진표를 만들어주세요.');
    return;
  }
  try{
    await ensureShareIdentity();
    let code=localStorage.getItem(LIVE_ROOM_KEY);
    if(!code)code=generateRoomCode();

    await TodayCockFirebase.roomRef(code).set(livePayload(true));

    localStorage.setItem(LIVE_ROOM_KEY,code);
    $('liveRoomCode').textContent=code;
    $('liveViewerUrl').value=viewerUrl(code);
    setLiveStatus('공유 중','active');
    toast('실시간 공유를 시작했습니다.');
  }catch(error){
    if(error.message!=='NICKNAME_REQUIRED'){
      console.error(error);
      setLiveStatus('공유 오류','error');
      toast('실시간 공유를 시작하지 못했습니다.');
    }
  }
}

async function syncLiveRoom(){
  const code=localStorage.getItem(LIVE_ROOM_KEY);
  if(!code||!state.schedule.length)return;

  clearTimeout(liveSyncTimer);
  liveSyncTimer=setTimeout(async()=>{
    try{
      await ensureShareIdentity();
      await TodayCockFirebase.roomRef(code).update(livePayload(true));
      setLiveStatus('공유 중','active');
    }catch(error){
      if(error.message!=='NICKNAME_REQUIRED'){
        console.error(error);
        setLiveStatus('동기화 오류','error');
      }
    }
  },180);
}

async function stopLiveShare(){
  const code=localStorage.getItem(LIVE_ROOM_KEY);
  if(!code){
    toast('현재 공유 중인 경기가 없습니다.');
    return;
  }
  try{
    await ensureShareIdentity();
    await TodayCockFirebase.roomRef(code).update({
      active:false,
      updatedAt:TodayCockFirebase.serverTimestamp()
    });
    localStorage.removeItem(LIVE_ROOM_KEY);
    $('liveRoomCode').textContent='-';
    $('liveViewerUrl').value='';
    setLiveStatus('공유 종료');
    toast('실시간 공유를 종료했습니다.');
  }catch(error){
    if(error.message!=='NICKNAME_REQUIRED'){
      console.error(error);
      toast('공유 종료에 실패했습니다.');
    }
  }
}

function restoreLiveRoomUi(){
  const code=localStorage.getItem(LIVE_ROOM_KEY);
  if(code){
    $('liveRoomCode').textContent=code;
    $('liveViewerUrl').value=viewerUrl(code);
    setLiveStatus('공유 중','active');
  }else{
    $('liveRoomCode').textContent='-';
    $('liveViewerUrl').value='';
    setLiveStatus('공유 안 함');
  }
}

async function copyLiveLink(){
  const url=$('liveViewerUrl').value;
  if(!url){
    toast('먼저 공유를 시작해주세요.');
    return;
  }
  try{
    await navigator.clipboard.writeText(url);
    toast('관람 링크를 복사했습니다.');
  }catch{
    prompt('아래 링크를 복사해주세요.',url);
  }
}

$('startLiveBtn').addEventListener('click',startLiveShare);
$('copyLiveLinkBtn').addEventListener('click',copyLiveLink);
$('stopLiveBtn').addEventListener('click',stopLiveShare);

$('closeNicknameBtn').addEventListener('click',()=>{
  nicknameContinuation=false;
  $('nicknameModal').classList.remove('open');
});

$('saveNicknameBtn').addEventListener('click',async()=>{
  const nickname=$('shareNickname').value.trim();
  if(!nickname){
    $('shareNicknameError').textContent='닉네임을 입력해주세요.';
    return;
  }
  localStorage.setItem(NICKNAME_KEY,nickname);
  try{
    await TodayCockFirebase.saveNickname(nickname);
    $('nicknameModal').classList.remove('open');
    updateLiveOperatorUi();
    if(nicknameContinuation){
      nicknameContinuation=false;
      await startLiveShare();
    }
  }catch(error){
    console.error(error);
    $('shareNicknameError').textContent='Firebase 연결에 실패했습니다.';
  }
});

// Existing nickname entry on admin login should update realtime identity.
const originalStartAdminClick = $('startAdminBtn').onclick;
$('startAdminBtn').addEventListener('click',()=>{
  const nickname=$('nickname').value.trim();
  if(nickname){
    localStorage.setItem(NICKNAME_KEY,nickname);
    TodayCockFirebase.saveNickname(nickname).catch(console.error);
    updateLiveOperatorUi();
  }
});

// Patch saveState so active rooms update automatically.
const originalSaveState=saveState;
saveState=function(){
  originalSaveState();
  syncLiveRoom();
};

initRealtime();


// ===== Version 2.0 Final features =====
const RECORDS_KEY='todaycock2_records';
const UNDO_KEY='todaycock2_undo';
let scheduleLocked=false;
let undoStack=[];

function cloneData(value){return JSON.parse(JSON.stringify(value));}
function pushUndo(){
  undoStack.push(cloneData({players:state.players,schedule:state.schedule,currentRoundIndex:state.currentRoundIndex,settings:state.settings}));
  if(undoStack.length>20)undoStack.shift();
  localStorage.setItem(UNDO_KEY,JSON.stringify(undoStack));
  updateUndoButton();
}
function restoreUndoStack(){
  try{undoStack=JSON.parse(localStorage.getItem(UNDO_KEY)||'[]')}catch{undoStack=[]}
  updateUndoButton();
}
function updateUndoButton(){
  $('undoBtn').disabled=!undoStack.length;
}
function undoLast(){
  const previous=undoStack.pop();
  if(!previous){toast('실행취소할 내용이 없습니다.');return}
  state.players=previous.players||[];
  state.schedule=previous.schedule||[];
  state.currentRoundIndex=previous.currentRoundIndex||0;
  state.settings=previous.settings||state.settings;
  localStorage.setItem(UNDO_KEY,JSON.stringify(undoStack));
  saveState();renderAll();updateUndoButton();toast('이전 상태로 되돌렸습니다.');
}
$('undoBtn').addEventListener('click',undoLast);

function setScheduleLocked(value){
  scheduleLocked=value;
  $('toggleLockBtn').classList.toggle('active',scheduleLocked);
  $('toggleLockBtn').textContent=scheduleLocked?'🔒 대진 잠금 해제':'🔓 대진 잠금';
  $('scheduleCard').classList.toggle('locked',scheduleLocked);
  document.querySelectorAll('[data-player]').forEach(el=>el.disabled=scheduleLocked);
}
$('toggleLockBtn').addEventListener('click',()=>{setScheduleLocked(!scheduleLocked);toast(scheduleLocked?'대진표를 잠갔습니다.':'대진표 잠금을 해제했습니다.')});

function calcFinalStats(){
  const stats={};
  state.players.forEach(p=>stats[p.id]={id:p.id,name:p.name,team:p.team,games:0,wins:0,losses:0,draws:0,partners:{},opponents:{}});
  let team1Wins=0,team2Wins=0,draws=0,team1Points=0,team2Points=0;

  state.schedule.forEach(r=>r.matches.forEach(m=>{
    [...m.team1,...m.team2].forEach(p=>{if(stats[p.id])stats[p.id].games++});
    m.team1.forEach(a=>{
      m.team1.filter(b=>b.id!==a.id).forEach(b=>stats[a.id].partners[b.id]=(stats[a.id].partners[b.id]||0)+1);
      m.team2.forEach(b=>stats[a.id].opponents[b.id]=(stats[a.id].opponents[b.id]||0)+1);
    });
    m.team2.forEach(a=>{
      m.team2.filter(b=>b.id!==a.id).forEach(b=>stats[a.id].partners[b.id]=(stats[a.id].partners[b.id]||0)+1);
      m.team1.forEach(b=>stats[a.id].opponents[b.id]=(stats[a.id].opponents[b.id]||0)+1);
    });
    if(m.score1===''||m.score2==='')return;
    const a=Number(m.score1),b=Number(m.score2);
    team1Points+=a;team2Points+=b;
    if(a>b){team1Wins++;m.team1.forEach(p=>stats[p.id].wins++);m.team2.forEach(p=>stats[p.id].losses++)}
    else if(b>a){team2Wins++;m.team2.forEach(p=>stats[p.id].wins++);m.team1.forEach(p=>stats[p.id].losses++)}
    else{draws++;[...m.team1,...m.team2].forEach(p=>stats[p.id].draws++)}
  }));

  const players=Object.values(stats).map(s=>({...s,rate:s.games?Math.round(s.wins/s.games*100):0}));
  const mvp=[...players].sort((a,b)=>b.wins-a.wins||b.rate-a.rate||b.games-a.games)[0]||null;
  const bestRate=[...players].filter(p=>p.games>0).sort((a,b)=>b.rate-a.rate||b.games-a.games)[0]||null;
  const mostGames=[...players].sort((a,b)=>b.games-a.games||b.wins-a.wins)[0]||null;

  return {players,team1Wins,team2Wins,draws,team1Points,team2Points,mvp,bestRate,mostGames};
}

function renderFinalResult(){
  const box=$('finalResultSummary');
  if(!box)return;
  if(!state.schedule.length){box.innerHTML='<p class="help">대진표를 만들고 점수를 입력하면 결과가 표시됩니다.</p>';return}
  const s=calcFinalStats(),teamMode=['team','fixed'].includes(state.settings.mode);
  const winner=teamMode?(s.team1Wins===s.team2Wins?'무승부':s.team1Wins>s.team2Wins?sideLabel(1):sideLabel(2)):'개인 경기';
  box.innerHTML=`
    <div class="result-hero">
      <div class="result-team"><span>${esc(sideLabel(1))}</span><strong>${s.team1Wins}</strong><small>득점 ${s.team1Points}</small></div>
      <div><b>${teamMode?`🏆 ${esc(winner)}`:'경기 결과'}</b><br><small>${s.draws}무</small></div>
      <div class="result-team"><span>${esc(sideLabel(2))}</span><strong>${s.team2Wins}</strong><small>득점 ${s.team2Points}</small></div>
    </div>
    <div class="award-grid">
      <div class="award-card"><span>🏅 MVP</span><strong>${esc(s.mvp?.name||'-')}</strong><small>${s.mvp?s.mvp.wins+'승 '+s.mvp.losses+'패':'기록 없음'}</small></div>
      <div class="award-card"><span>⭐ 최고 승률</span><strong>${esc(s.bestRate?.name||'-')}</strong><small>${s.bestRate?s.bestRate.rate+'%':'기록 없음'}</small></div>
      <div class="award-card"><span>🔥 최다 출전</span><strong>${esc(s.mostGames?.name||'-')}</strong><small>${s.mostGames?s.mostGames.games+'경기':'기록 없음'}</small></div>
    </div>`;
}

function getRecords(){try{return JSON.parse(localStorage.getItem(RECORDS_KEY)||'[]')}catch{return[]}}
function saveRecords(records){localStorage.setItem(RECORDS_KEY,JSON.stringify(records))}
function saveRecord(){
  if(!state.schedule.length){toast('저장할 대진표가 없습니다.');return}
  const summary=calcFinalStats();
  const record={
    id:`record_${Date.now()}`,savedAt:new Date().toISOString(),
    eventInfo:{
      name:state.settings.eventName||'오늘콕 경기',
      date:state.settings.eventDate||new Date().toISOString().slice(0,10),
      team1:state.settings.team1Name||'팀1',team2:state.settings.team2Name||'팀2'
    },
    mode:state.settings.mode,matchType:state.settings.matchType,
    players:cloneData(state.players),schedule:cloneData(state.schedule),
    summary:{team1Wins:summary.team1Wins,team2Wins:summary.team2Wins,draws:summary.draws,team1Points:summary.team1Points,team2Points:summary.team2Points,mvp:summary.mvp,bestRate:summary.bestRate,mostGames:summary.mostGames}
  };
  const records=getRecords();records.unshift(record);saveRecords(records.slice(0,50));renderRecords();toast('경기 기록을 저장했습니다.');
}
$('saveRecordBtn').addEventListener('click',saveRecord);

function renderRecords(){
  const box=$('recordsList');if(!box)return;
  const records=getRecords();
  if(!records.length){box.innerHTML='<p class="help">저장된 기록이 없습니다.</p>';return}
  box.innerHTML=records.map(r=>`
    <div class="record-item">
      <div class="record-item-head">
        <div><h4>${esc(r.eventInfo.name)}</h4><div class="record-meta">${esc(r.eventInfo.date)}<br>${esc(r.eventInfo.team1)} ${r.summary.team1Wins}승 : ${r.summary.team2Wins}승 ${esc(r.eventInfo.team2)}</div></div>
      </div>
      <div class="record-actions">
        <button class="btn secondary" data-record-view="${r.id}">기록 보기</button>
        <button class="btn danger" data-record-delete="${r.id}">삭제</button>
      </div>
    </div>`).join('');
  document.querySelectorAll('[data-record-view]').forEach(b=>b.addEventListener('click',()=>openRecord(b.dataset.recordView)));
  document.querySelectorAll('[data-record-delete]').forEach(b=>b.addEventListener('click',()=>deleteRecord(b.dataset.recordDelete)));
}
function openRecord(id){
  const r=getRecords().find(x=>x.id===id);if(!r)return;
  $('recordModalTitle').textContent=r.eventInfo.name;
  $('recordModalContent').innerHTML=`
    <p class="record-meta">${esc(r.eventInfo.date)} · ${esc(r.eventInfo.team1)} ${r.summary.team1Wins}승 : ${r.summary.team2Wins}승 ${esc(r.eventInfo.team2)}</p>
    <div class="award-grid">
      <div class="award-card"><span>MVP</span><strong>${esc(r.summary.mvp?.name||'-')}</strong></div>
      <div class="award-card"><span>최고 승률</span><strong>${esc(r.summary.bestRate?.name||'-')}</strong></div>
      <div class="award-card"><span>최다 출전</span><strong>${esc(r.summary.mostGames?.name||'-')}</strong></div>
    </div>
    ${(r.schedule||[]).map(round=>`<div class="record-round"><h4>${round.round}라운드</h4>${round.matches.map(m=>`<div class="record-match"><b>${m.court}코트</b><br>${esc(m.team1.map(p=>p.name).join(' / '))} <b>${m.score1===''?'-':m.score1} : ${m.score2===''?'-':m.score2}</b> ${esc(m.team2.map(p=>p.name).join(' / '))}</div>`).join('')}</div>`).join('')}`;
  $('recordModal').classList.add('open');
}
function deleteRecord(id){
  if(!confirm('이 기록을 삭제할까요?'))return;
  saveRecords(getRecords().filter(r=>r.id!==id));renderRecords();
}
$('closeRecordBtn').addEventListener('click',()=>$('recordModal').classList.remove('open'));

$('printResultBtn').addEventListener('click',()=>{renderFinalResult();window.print()});

function showQr(){
  const url=$('liveViewerUrl').value;
  if(!url){toast('먼저 공유를 시작해주세요.');return}
  $('qrCodeBox').innerHTML='';
  $('qrLinkInput').value=url;
  new QRCode($('qrCodeBox'),{text:url,width:200,height:200});
  $('qrModal').classList.add('open');
}
$('showQrBtn').addEventListener('click',showQr);
$('closeQrBtn').addEventListener('click',()=>$('qrModal').classList.remove('open'));
$('copyQrLinkBtn').addEventListener('click',copyLiveLink);

function completeCurrentRound(){
  if(!state.schedule.length)return;
  const round=state.schedule[state.currentRoundIndex];
  const incomplete=round.matches.filter(m=>m.score1===''||m.score2==='');
  if(incomplete.length){toast(`점수가 입력되지 않은 경기가 ${incomplete.length}개 있습니다.`);return}
  if(state.currentRoundIndex<state.schedule.length-1){
    state.currentRoundIndex++;
    saveState();renderAll();toast('다음 라운드로 이동했습니다.');
  }else{
    renderFinalResult();toast('모든 라운드가 완료되었습니다.');
  }
}
$('completeRoundBtn').addEventListener('click',completeCurrentRound);

// Add per-match quick completion buttons after current round render
const originalRenderCurrentRoundFinal=renderCurrentRound;
renderCurrentRound=function(){
  originalRenderCurrentRoundFinal();
  document.querySelectorAll('#currentRoundMatches .match-card').forEach((card,index)=>{
    const button=document.createElement('button');
    button.className='quick-complete';
    button.textContent='✓ 경기 완료';
    button.addEventListener('click',()=>{
      const match=state.schedule[state.currentRoundIndex].matches[index];
      if(match.score1===''||match.score2===''){toast('점수를 먼저 입력해주세요.');return}
      renderStats();renderFinalResult();syncLiveRoom();toast('경기 결과를 반영했습니다.');
    });
    card.appendChild(button);
  });
};

// Push undo before destructive or mutable actions
$('generateBtn').addEventListener('click',()=>pushUndo(),true);
$('clearPlayersBtn').addEventListener('click',()=>pushUndo(),true);
document.addEventListener('change',e=>{if(e.target.matches('[data-player]'))pushUndo()},{capture:true});

// Keep final result refreshed
const originalRenderAllFinal=renderAll;
renderAll=function(){
  originalRenderAllFinal();
  setScheduleLocked(scheduleLocked);
  renderFinalResult();
  renderRecords();
};
const originalRenderStatsFinal=renderStats;
renderStats=function(){
  originalRenderStatsFinal();
  renderFinalResult();
};

restoreUndoStack();
renderFinalResult();
renderRecords();


// ===== Stable Fix 5: recovery and portable backup =====
function hasRecoverableGame(){
  return state.players.length>0 || state.schedule.length>0;
}

function recoveryDescription(){
  const matches=state.schedule.reduce((sum,round)=>sum+(round.matches?.length||0),0);
  const completed=state.schedule.reduce(
    (sum,round)=>sum+(round.matches||[]).filter(match=>match.score1!==''&&match.score2!=='').length,
    0
  );
  const savedAt=localStorage.getItem(SAVE_META_KEY);
  const savedText=savedAt?new Date(savedAt).toLocaleString('ko-KR'):'저장 시간 미확인';
  return `선수 ${state.players.length}명 · 대진 ${matches}경기 · 완료 ${completed}경기\n${savedText}`;
}

function showRecoveryModalIfNeeded(){
  if(!hasRecoverableGame())return;
  const modal=document.getElementById('recoveryModal');
  const summary=document.getElementById('recoverySummary');
  if(summary)summary.textContent=recoveryDescription();
  modal?.classList.add('open');
}

document.getElementById('continueGameBtn')?.addEventListener('click',()=>{
  document.getElementById('recoveryModal')?.classList.remove('open');
  renderAll();
  toast('이전 경기 상태를 복구했습니다.');
});

document.getElementById('startFreshBtn')?.addEventListener('click',()=>{
  if(!confirm('현재 진행 중인 명단과 대진을 초기화할까요?'))return;
  state.players=[];
  state.schedule=[];
  state.currentRoundIndex=0;
  state.filter='all';
  state.fixedPairs={team1:[],team2:[]};
  localStorage.removeItem(APP_STATE_KEY);
  localStorage.removeItem(SAVE_META_KEY);
  document.getElementById('recoveryModal')?.classList.remove('open');
  renderAll();
  persistStateNow();
  toast('새 경기로 초기화했습니다.');
});

function downloadBackup(){
  persistStateNow();
  const backup={
    app:'TODAYCOCK',
    version:'2.0-stable-fix5',
    exportedAt:new Date().toISOString(),
    state:JSON.parse(JSON.stringify(state)),
    records:getRecords()
  };
  const text=JSON.stringify(backup,null,2);
  const blob=new Blob([text],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const date=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`오늘콕_백업_${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('백업 파일을 저장했습니다.');
}

document.getElementById('exportBackupBtn')?.addEventListener('click',downloadBackup);
document.getElementById('importBackupBtn')?.addEventListener('click',()=>{
  document.getElementById('backupFileInput')?.click();
});

document.getElementById('backupFileInput')?.addEventListener('change',async(event)=>{
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  try{
    const text=await file.text();
    const backup=JSON.parse(text);
    if(backup.app!=='TODAYCOCK'||!backup.state)throw new Error('INVALID_BACKUP');
    if(!confirm('현재 진행 중인 내용을 백업 파일로 교체할까요?'))return;
    const loaded=sanitizeLoadedState(backup.state);
    if(!loaded)throw new Error('INVALID_STATE');
    Object.assign(state,loaded);
    if(Array.isArray(backup.records))saveRecords(backup.records);
    persistStateNow();
    renderAll();
    toast('백업을 복구했습니다.');
  }catch(error){
    console.error(error);
    alert('오늘콕 백업 파일을 읽지 못했습니다.');
  }
});

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')persistStateNow();
});
window.addEventListener('pagehide',persistStateNow);
window.addEventListener('beforeunload',persistStateNow);

setTimeout(()=>{
  const savedAt=localStorage.getItem(SAVE_META_KEY);
  if(savedAt){
    const el=document.getElementById('lastSavedTime');
    if(el)el.textContent=`마지막 저장 ${new Date(savedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
    setSaveStatus('saved','● 자동 저장됨');
  }else{
    setSaveStatus('saved','● 자동 저장 준비');
  }
  showRecoveryModalIfNeeded();
},250);
