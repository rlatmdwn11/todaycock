'use strict';

window.TodayCockSchedule = (() => {
  const gradeScore = {S:5,A:4,B:3,C:2,D:1};

  const shuffle = (arr) => {
    const copy = [...arr];
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  };

  const pairKey = (a,b) => [a.id,b.id].sort().join('|');

  function validPair(a,b,matchType){
    if(matchType==='women') return a.gender==='여' && b.gender==='여';
    if(matchType==='men') return a.gender==='남' && b.gender==='남';
    if(matchType==='mixed') return a.gender!==b.gender;
    return true;
  }

  function chooseBestPair(pool, used, games, partners, matchType, settings){
    const candidates=[];
    for(let i=0;i<pool.length;i++){
      for(let j=i+1;j<pool.length;j++){
        const a=pool[i],b=pool[j];
        if(used.has(a.id)||used.has(b.id)) continue;
        if(!validPair(a,b,matchType)) continue;
        const balance=Math.abs((gradeScore[a.grade]||0)-(gradeScore[b.grade]||0));
        let score=Math.random();
        if(settings?.balanceGames!==false)score+=(games[a.id]||0)+(games[b.id]||0);
        if(settings?.minimizePartners!==false)score+=(partners[pairKey(a,b)]||0)*5;
        if(settings?.balanceGrade!==false)score+=balance*.25;
        candidates.push({pair:[a,b],score});
      }
    }
    candidates.sort((x,y)=>x.score-y.score);
    return candidates[0]?.pair||null;
  }

  function createInternal(players, settings, randomMode){
    const games={},partners={},opponents={},partnerGrades={};
    players.forEach(p=>{games[p.id]=0;partnerGrades[p.id]={};});
    const schedule=[]; let made=0;
    const target=settings.targetGames || settings.courts*settings.rounds;
    const byId=new Map(players.map(p=>[p.id,p]));
    const fixed=(settings.partialPairs||[])
      .filter(x=>x.a&&x.b&&x.a!==x.b&&Number(x.count)>0&&byId.has(x.a)&&byId.has(x.b))
      .map(x=>({a:x.a,b:x.b,target:Number(x.count),used:0}));

    const pkey=(a,b)=>[a.id,b.id].sort().join('|');
    const okey=(a,b)=>[a.id,b.id].sort().join('|');
    const comboKey=(a,b)=>[a.grade,b.grade].sort((x,y)=>(gradeScore[y]||0)-(gradeScore[x]||0)).join('');
    const strength=pair=>(gradeScore[pair[0].grade]||0)+(gradeScore[pair[1].grade]||0);

    function allPairs(used){
      const out=[];
      for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
        const a=players[i],b=players[j];
        if(used.has(a.id)||used.has(b.id)||!validPair(a,b,settings.matchType))continue;
        out.push([a,b]);
      }
      return out;
    }
    function forcedRuleFor(pair){
      const a=pair[0].id,b=pair[1].id;
      return fixed.find(x=>x.used<x.target&&((x.a===a&&x.b===b)||(x.a===b&&x.b===a)))||null;
    }
    function hasPendingForcedPlayer(p){
      return fixed.some(x=>x.used<x.target&&(x.a===p.id||x.b===p.id));
    }
    function pairHistoryScore(pair){
      if(randomMode)return Math.random();
      const [a,b]=pair;
      let score=Math.random()*.03;
      if(settings.balanceGames!==false)score+=((games[a.id]||0)+(games[b.id]||0))*3;
      if(settings.minimizePartners!==false)score+=(partners[pkey(a,b)]||0)*8;
      if(settings.balanceGrade!==false){
        const ca=(partnerGrades[a.id]&&partnerGrades[a.id][b.grade])||0;
        const cb=(partnerGrades[b.id]&&partnerGrades[b.id][a.grade])||0;
        score+=(ca+cb)*5;
      }
      return score;
    }
    function matchupScore(a,b){
      const ca=comboKey(a[0],a[1]),cb=comboKey(b[0],b[1]);
      let score=0;
      if(settings.balanceGrade!==false){
        // Exact composition is the goal: AA-AA, AB-AB, BB-BB, etc.
        if(ca!==cb)score+=10000;
        score+=Math.abs(strength(a)-strength(b))*1000;
      }
      score+=pairHistoryScore(a)+pairHistoryScore(b);
      if(settings.minimizeOpponents!==false){
        for(const x of a)for(const y of b)score+=(opponents[okey(x,y)]||0)*4;
      }
      return score;
    }
    function candidateMatches(used){
      const pairs=allPairs(used),out=[];
      for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
        const a=pairs[i],b=pairs[j];
        if(a.some(p=>b.some(q=>q.id===p.id)))continue;
        const fa=forcedRuleFor(a),fb=forcedRuleFor(b);
        // Pending partial-fixed pairs get first priority; don't consume one member
        // in a different pair while its required pair can be scheduled.
        let forcedPriority=(fa?1:0)+(fb?1:0);
        const breaksPending=[...a,...b].some(p=>hasPendingForcedPlayer(p))&&!fa&&!fb;
        out.push({a,b,fa,fb,forcedPriority,breaksPending,score:matchupScore(a,b)});
      }
      out.sort((x,y)=>{
        if(x.forcedPriority!==y.forcedPriority)return y.forcedPriority-x.forcedPriority;
        if(x.breaksPending!==y.breaksPending)return Number(x.breaksPending)-Number(y.breaksPending);
        return x.score-y.score;
      });
      return out;
    }

    for(let round=1;round<=settings.rounds&&made<target;round++){
      const matches=[],used=new Set();
      for(let court=1;court<=settings.courts&&made<target;court++){
        let candidates=candidateMatches(used);
        if(!candidates.length)break;
        if(settings.balanceGrade!==false){
          // If an exact same-composition matchup exists, never choose AA-BB merely
          // because it improves another heuristic.
          const exact=candidates.filter(c=>comboKey(c.a[0],c.a[1])===comboKey(c.b[0],c.b[1]));
          const bestForced=candidates[0]?.forcedPriority||0;
          const exactForced=exact.filter(c=>c.forcedPriority===bestForced);
          if(exactForced.length)candidates=exactForced;
          else if(exact.length&&bestForced===0)candidates=exact;
        }
        const pick=candidates[0]; if(!pick)break;
        const {a:pairA,b:pairB}=pick;
        [...pairA,...pairB].forEach(p=>{used.add(p.id);games[p.id]=(games[p.id]||0)+1;});
        if(pick.fa)pick.fa.used++;
        if(pick.fb&&pick.fb!==pick.fa)pick.fb.used++;
        partners[pkey(...pairA)]=(partners[pkey(...pairA)]||0)+1;
        partners[pkey(...pairB)]=(partners[pkey(...pairB)]||0)+1;
        partnerGrades[pairA[0].id][pairA[1].grade]=(partnerGrades[pairA[0].id][pairA[1].grade]||0)+1;
        partnerGrades[pairA[1].id][pairA[0].grade]=(partnerGrades[pairA[1].id][pairA[0].grade]||0)+1;
        partnerGrades[pairB[0].id][pairB[1].grade]=(partnerGrades[pairB[0].id][pairB[1].grade]||0)+1;
        partnerGrades[pairB[1].id][pairB[0].grade]=(partnerGrades[pairB[1].id][pairB[0].grade]||0)+1;
        for(const x of pairA)for(const y of pairB)opponents[okey(x,y)]=(opponents[okey(x,y)]||0)+1;
        matches.push({court,team1:pairA,team2:pairB,score1:'',score2:''});made++;
      }
      if(matches.length)schedule.push({round,matches});
    }
    return schedule;
  }

  function resolveFixedPairs(players,settings,team,key){
    const byId=new Map(players.filter(p=>p.team===team).map(p=>[p.id,p]));
    return ((settings.fixedPairs||{})[key]||[]).map(ids=>ids.map(id=>byId.get(id)).filter(Boolean)).filter(pair=>pair.length===2);
  }

  function createFixed(players,settings){
    const pairs1=resolveFixedPairs(players,settings,'팀1','team1');
    const pairs2=resolveFixedPairs(players,settings,'팀2','team2');
    if(!pairs1.length||!pairs2.length)return [];
    const schedule=[];let made=0;
    const target=settings.targetGames||settings.courts*settings.rounds;
    const use1={},use2={},opponents={};
    for(let round=1;round<=settings.rounds&&made<target;round++){
      const matches=[],used1=new Set(),used2=new Set();
      for(let court=1;court<=settings.courts&&made<target;court++){
        const candidates=[];
        pairs1.forEach((a,i)=>pairs2.forEach((b,j)=>{
          if(used1.has(i)||used2.has(j))return;
          const key=`${i}|${j}`;
          const gradeA=a.reduce((s,p)=>s+(gradeScore[p.grade]||0),0),gradeB=b.reduce((s,p)=>s+(gradeScore[p.grade]||0),0);
          const score=(use1[i]||0)+(use2[j]||0)+(opponents[key]||0)*6+Math.abs(gradeA-gradeB)*.3+Math.random();
          candidates.push({i,j,a,b,key,score});
        }));
        candidates.sort((x,y)=>x.score-y.score);
        const pick=candidates[0];if(!pick)break;
        used1.add(pick.i);used2.add(pick.j);use1[pick.i]=(use1[pick.i]||0)+1;use2[pick.j]=(use2[pick.j]||0)+1;opponents[pick.key]=(opponents[pick.key]||0)+1;
        matches.push({court,team1:pick.a,team2:pick.b,score1:'',score2:''});made++;
      }
      if(matches.length)schedule.push({round,matches});
    }
    return schedule;
  }

  function createTeam(players, settings){
    const t1=players.filter(p=>p.team==='팀1');
    const t2=players.filter(p=>p.team==='팀2');
    const games={},partners={};
    players.forEach(p=>games[p.id]=0);
    const schedule=[];let made=0;
    const target=settings.targetGames || settings.courts*settings.rounds;
    for(let round=1;round<=settings.rounds && made<target;round++){
      const matches=[],used=new Set();
      for(let court=1;court<=settings.courts && made<target;court++){
        const pairA=chooseBestPair(t1,used,games,partners,settings.matchType,settings);if(!pairA)break;
        pairA.forEach(p=>used.add(p.id));
        const pairB=chooseBestPair(t2,used,games,partners,settings.matchType,settings);if(!pairB)break;
        [...pairA,...pairB].forEach(p=>{used.add(p.id);games[p.id]=(games[p.id]||0)+1});
        partners[pairKey(pairA[0],pairA[1])] = (partners[pairKey(pairA[0],pairA[1])]||0)+1;
        partners[pairKey(pairB[0],pairB[1])] = (partners[pairKey(pairB[0],pairB[1])]||0)+1;
        matches.push({court,team1:pairA,team2:pairB,score1:'',score2:''});made++;
      }
      if(matches.length)schedule.push({round,matches});
    }
    return schedule;
  }

  function generate(players, settings){
    if(settings.mode==='fixed')return createFixed(players,settings);
    if(settings.mode==='team')return createTeam(players,settings);
    return createInternal(players,settings,settings.mode==='random');
  }

return {generate,validPair};
})();
