'use strict';

window.TodayCockFirebase = (() => {
  let app = null;
  let auth = null;
  let db = null;
  let user = null;

  function init(){
    if(!window.firebase || !window.TODAYCOCK_FIREBASE_CONFIG){
      throw new Error('Firebase SDK 또는 설정이 없습니다.');
    }
    app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.TODAYCOCK_FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.database();
    return {app,auth,db};
  }

  async function ensureAnonymousUser(){
    if(!auth || !db) init();
    if(auth.currentUser){
      user = auth.currentUser;
      return user;
    }
    const credential = await auth.signInAnonymously();
    user = credential.user;
    return user;
  }

  async function saveNickname(nickname){
    const current = await ensureAnonymousUser();
    await db.ref(`users/${current.uid}`).update({
      nickname,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
    return current;
  }

  function roomRef(code){
    if(!db) init();
    return db.ref(`rooms/${code}`);
  }

  function serverTimestamp(){
    return firebase.database.ServerValue.TIMESTAMP;
  }

  function getCurrentUser(){
    return auth?.currentUser || user;
  }

  return {init,ensureAnonymousUser,saveNickname,roomRef,serverTimestamp,getCurrentUser};
})();
