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
    const pairStrength=pair=>(gradeScore[pair[0].grade]||0)+(gradeScore[pair[1].grade]||0);

    function allPairs(pool,used){
      const out=[];
      for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
        const a=pool[i],b=pool[j];
        if(used.has(a.id)||used.has(b.id)||!validPair(a,b,settings.matchType))continue;
        out.push([a,b]);
      }
      return out;
    }
    function desiredPair(used){
      const choices=fixed.filter(x=>x.used<x.target&&!used.has(x.a)&&!used.has(x.b))
        .map(x=>({rule:x,pair:[byId.get(x.a),byId.get(x.b)]}))
        .filter(x=>x.pair.every(Boolean)&&validPair(x.pair[0],x.pair[1],settings.matchType));
      choices.sort((x,y)=>(games[x.pair[0].id]+games[x.pair[1].id])-(games[y.pair[0].id]+games[y.pair[1].id]));
      return choices[0]||null;
    }
    function gradePartnerBalanceScore(a,b){
      if(settings.balanceGrade===false)return 0;
      // Compare players of the same grade: prefer giving them a similar distribution
      // of partner grades (AA/AB/AC..., BB/BC..., etc.).
      const count=(p,g)=>(partnerGrades[p.id]&&partnerGrades[p.id][g])||0;
      const peersA=players.filter(p=>p.id!==a.id&&p.grade===a.grade);
      const peersB=players.filter(p=>p.id!==b.id&&p.grade===b.grade);
      const avg=(peers,g)=>peers.length?peers.reduce((sum,p)=>sum+count(p,g),0)/peers.length:0;
      const afterA=count(a,b.grade)+1;
      const afterB=count(b,a.grade)+1;
      // Strong weight so total partner-grade distribution matters more than a tiny random tie break.
      return (Math.abs(afterA-avg(peersA,b.grade))+Math.abs(afterB-avg(peersB,a.grade)))*8;
    }
    function pairBaseScore(pair){
      if(randomMode)return Math.random();
      let sc=Math.random()*.05;
      if(settings.balanceGames!==false)sc+=(games[pair[0].id]||0)+(games[pair[1].id]||0)*1;
      if(settings.minimizePartners!==false)sc+=(partners[pkey(...pair)]||0)*5;
      sc+=gradePartnerBalanceScore(pair[0],pair[1]);
      return sc;
    }
    function chooseOpponentPair(pool,used,firstPair){
      const pairs=allPairs(pool,used); if(!pairs.length)return null;
      const s1=pairStrength(firstPair);
      pairs.sort((x,y)=>{
        const gradeX=settings.balanceGrade===false?0:Math.abs(s1-pairStrength(x))*100;
        const gradeY=settings.balanceGrade===false?0:Math.abs(s1-pairStrength(y))*100;
        let ox=0,oy=0;
        if(settings.minimizeOpponents!==false){
          for(const a of firstPair)for(const b of x)ox+=(opponents[okey(a,b)]||0)*3;
          for(const a of firstPair)for(const b of y)oy+=(opponents[okey(a,b)]||0)*3;
        }
        return (gradeX+pairBaseScore(x)+ox)-(gradeY+pairBaseScore(y)+oy);
      });
      return pairs[0];
    }

    for(let round=1;round<=settings.rounds&&made<target;round++){
      const matches=[],used=new Set();
      for(let court=1;court<=settings.courts&&made<target;court++){
        const pool=randomMode?shuffle(players):players;
        let forced=desiredPair(used),pairA;
        if(forced){pairA=forced.pair}
        else{
          const pairs=allPairs(pool,used);
          pairs.sort((x,y)=>pairBaseScore(x)-pairBaseScore(y));
          pairA=pairs[0]||null;
        }
        if(!pairA)break;
        pairA.forEach(p=>used.add(p.id));
        const pairB=chooseOpponentPair(pool,used,pairA);
        if(!pairB){pairA.forEach(p=>used.delete(p.id));break}
        pairB.forEach(p=>used.add(p.id));

        if(forced)forced.rule.used++;
        [...pairA,...pairB].forEach(p=>games[p.id]=(games[p.id]||0)+1);
        partners[pkey(...pairA)]=(partners[pkey(...pairA)]||0)+1;
        partners[pkey(...pairB)]=(partners[pkey(...pairB)]||0)+1;
        // Track the grade of each player's partner so later matches can compensate.
        partnerGrades[pairA[0].id][pairA[1].grade]=(partnerGrades[pairA[0].id][pairA[1].grade]||0)+1;
        partnerGrades[pairA[1].id][pairA[0].grade]=(partnerGrades[pairA[1].id][pairA[0].grade]||0)+1;
        partnerGrades[pairB[0].id][pairB[1].grade]=(partnerGrades[pairB[0].id][pairB[1].grade]||0)+1;
        partnerGrades[pairB[1].id][pairB[0].grade]=(partnerGrades[pairB[1].id][pairB[0].grade]||0)+1;
        for(const a of pairA)for(const b of pairB)opponents[okey(a,b)]=(opponents[okey(a,b)]||0)+1;
        matches.push({court,team1:pairA,team2:pairB,score1:'',score2:''}); made++;
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
