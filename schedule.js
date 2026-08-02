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
    const games={},partners={};
    players.forEach(p=>games[p.id]=0);
    const schedule=[];
    let made=0;
    const target=settings.targetGames || settings.courts*settings.rounds;

    for(let round=1;round<=settings.rounds && made<target;round++){
      const matches=[],used=new Set();
      for(let court=1;court<=settings.courts && made<target;court++){
        const pool=randomMode?shuffle(players):players;
        const pairA=randomMode
          ? chooseBestPair(pool,used,{}, {}, settings.matchType,settings)
          : chooseBestPair(pool,used,games,partners,settings.matchType,settings);
        if(!pairA) break;
        pairA.forEach(p=>used.add(p.id));
        const pairB=randomMode
          ? chooseBestPair(pool,used,{}, {}, settings.matchType,settings)
          : chooseBestPair(pool,used,games,partners,settings.matchType,settings);
        if(!pairB) break;

        [...pairA,...pairB].forEach(p=>{used.add(p.id);games[p.id]=(games[p.id]||0)+1});
        partners[pairKey(pairA[0],pairA[1])] = (partners[pairKey(pairA[0],pairA[1])]||0)+1;
        partners[pairKey(pairB[0],pairB[1])] = (partners[pairKey(pairB[0],pairB[1])]||0)+1;

        matches.push({court,team1:pairA,team2:pairB,score1:'',score2:''});
        made++;
      }
      if(matches.length) schedule.push({round,matches});
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
