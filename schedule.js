\
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

  function chooseBestPair(pool, used, games, partners, matchType){
    const candidates=[];
    for(let i=0;i<pool.length;i++){
      for(let j=i+1;j<pool.length;j++){
        const a=pool[i],b=pool[j];
        if(used.has(a.id)||used.has(b.id)) continue;
        if(!validPair(a,b,matchType)) continue;
        const balance=Math.abs((gradeScore[a.grade]||0)-(gradeScore[b.grade]||0));
        const score=(games[a.id]||0)+(games[b.id]||0)+(partners[pairKey(a,b)]||0)*5+balance*.25+Math.random();
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
          ? chooseBestPair(pool,used,{}, {}, settings.matchType)
          : chooseBestPair(pool,used,games,partners,settings.matchType);
        if(!pairA) break;
        pairA.forEach(p=>used.add(p.id));
        const pairB=randomMode
          ? chooseBestPair(pool,used,{}, {}, settings.matchType)
          : chooseBestPair(pool,used,games,partners,settings.matchType);
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

  function createTeam(players, settings, fixed){
    const t1=players.filter(p=>p.team==='팀1');
    const t2=players.filter(p=>p.team==='팀2');
    const games={},partners={};
    players.forEach(p=>games[p.id]=0);
    const schedule=[];
    let made=0;
    const target=settings.targetGames || settings.courts*settings.rounds;

    for(let round=1;round<=settings.rounds && made<target;round++){
      const matches=[],used=new Set();
      for(let court=1;court<=settings.courts && made<target;court++){
        const pairA=chooseBestPair(t1,used,games,partners,settings.matchType);
        if(!pairA) break;
        pairA.forEach(p=>used.add(p.id));
        const pairB=chooseBestPair(t2,used,games,partners,settings.matchType);
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

  function generate(players, settings){
    if(settings.mode==='team'||settings.mode==='fixed'){
      return createTeam(players,settings,settings.mode==='fixed');
    }
    return createInternal(players,settings,settings.mode==='random');
  }

  return {generate,validPair};
})();
