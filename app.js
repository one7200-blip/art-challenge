'use strict';
const $=id=>document.getElementById(id);
const config=window.APP_CONFIG||{};
const connected=Boolean(config.SUPABASE_URL&&config.SUPABASE_PUBLISHABLE_KEY);
const state={player:null,quiz:null,index:0,answers:[],busy:false,result:null,winners:[],total:0};
let demoBank;
const DEMO_KEY='feel-art-demo-winners-v1';
$('preview-note').hidden=connected;
function shuffled(items){const a=[...items];for(let i=a.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=Math.floor(n[0]/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
async function rpc(name,args={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(config.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal});
  const data=await response.json();
  if(!response.ok)throw new Error('연결을 확인한 뒤 다시 시도해 주세요.');
  return data;
 }catch(e){throw new Error(e.name==='AbortError'?'연결이 늦어지고 있어요. 다시 눌러 주세요.':'연결을 확인한 뒤 다시 시도해 주세요.');}finally{clearTimeout(timer)}
}
function show(view){['home','quiz','result'].forEach(id=>$(id).hidden=id!==view);window.scrollTo({top:0,behavior:'instant'});if(view==='home')loadWinners();}
function demoWinners(){try{return JSON.parse(localStorage.getItem(DEMO_KEY)||'[]')}catch{return []}}
async function startQuiz(){
 if(state.busy)return;
 state.busy=true;$('start-error').textContent='';$('start-btn').disabled=true;$('start-btn').textContent='그림을 준비하고 있어요…';
 try{
  if(connected){state.quiz=await rpc('quiz_start',{p_name:state.player.name,p_class_no:state.player.classNo,p_student_no:state.player.studentNo});}
  else{
   if(!demoBank){const res=await fetch('artworks.json?v=20261104');if(!res.ok)throw new Error('작품을 불러오지 못했어요. 다시 시도해 주세요.');demoBank=await res.json();}
   state.quiz={id:crypto.randomUUID(),questions:shuffled(demoBank).slice(0,10).map(a=>({id:a.id,image:a.image,correct:a.title,choices:shuffled([a.title,...shuffled(demoBank.filter(b=>b.id!==a.id)).slice(0,2).map(b=>b.title)])}))};
  }
  state.index=0;state.answers=[];state.result=null;$('player-label').textContent=`3학년 ${state.player.classNo}반 · ${state.player.name}`;show('quiz');renderQuestion();
 }catch(e){$('start-error').textContent=e.message;}
 finally{state.busy=false;$('start-btn').disabled=false;$('start-btn').innerHTML='퀴즈 시작하기 <span>→</span>';}
}
$('entry-form').addEventListener('submit',e=>{e.preventDefault();const name=$('student-name').value.trim();if(!name||name.length>20||/[<>\x00-\x1f]/.test(name)){$('start-error').textContent='내 이름을 바르게 적어 주세요.';$('student-name').focus();return;}state.player={name,classNo:Number($('class-no').value),studentNo:Number($('student-no').value)};startQuiz();});
function imagePath(path){return path.replace(/^\//,'');}
function renderQuestion(){
 const q=state.quiz.questions[state.index];$('quiz-error').textContent='';$('image-error').hidden=true;
 $('question-image').src=imagePath(q.image);$('zoom-image').src=imagePath(q.image);
 $('progress-label').textContent=`문제 ${state.index+1} / 10`;$('progress-fill').style.width=`${state.index*10}%`;$('progress').setAttribute('aria-valuenow',String(state.index));$('question-small').textContent=`QUESTION ${String(state.index+1).padStart(2,'0')}`;
 $('choices').replaceChildren();q.choices.forEach((title,i)=>{const b=document.createElement('button');b.type='button';b.className='choice';b.setAttribute('aria-pressed','false');const n=document.createElement('span');n.className='number';n.textContent=String(i+1);const t=document.createElement('span');t.textContent=title;b.append(n,t);b.addEventListener('click',()=>{if(state.busy)return;state.answers[state.index]=title;Array.from($('choices').children).forEach(c=>{c.classList.remove('selected');c.setAttribute('aria-pressed','false')});b.classList.add('selected');b.setAttribute('aria-pressed','true');$('next-btn').disabled=false;$('answer-note').textContent='좋아요! 다음으로 넘어가 볼까요?';});$('choices').append(b)});
 $('next-btn').disabled=true;$('next-btn').innerHTML=state.index===9?'결과 확인하기 <span>→</span>':'다음 문제 <span>→</span>';$('answer-note').textContent='답을 고르면 다음으로 갈 수 있어요.';
 $('quiz-title').focus({preventScroll:true});
}
$('question-image').addEventListener('error',()=>{$('image-error').hidden=false});
$('image-retry').addEventListener('click',()=>{$('image-error').hidden=true;$('question-image').src=imagePath(state.quiz.questions[state.index].image)+'?retry='+Date.now()});
$('next-btn').addEventListener('click',async()=>{
 if(state.busy||!state.answers[state.index])return;
 if(state.index<9){state.index++;renderQuestion();window.scrollTo({top:0,behavior:'instant'});return;}
 state.busy=true;$('next-btn').disabled=true;$('leave-btn').disabled=true;$('next-btn').textContent='결과를 확인하고 있어요…';$('quiz-error').textContent='';
 try{
  if(connected){state.result=await rpc('quiz_finish',{p_attempt_id:state.quiz.id,p_answers:state.answers});}
  else{
   const score=state.quiz.questions.filter((q,i)=>q.correct===state.answers[i]).length;
   state.result={score,success:score>=6,review:state.quiz.questions.map(q=>({image:q.image,title:q.correct})),saved:true};
   if(score>=6){const list=demoWinners();const key=`${state.player.classNo}:${state.player.studentNo}:${state.player.name}`;if(!list.some(p=>p.key===key))list.unshift({key,name:state.player.name,classNo:state.player.classNo});try{localStorage.setItem(DEMO_KEY,JSON.stringify(list))}catch{state.result.saved=false}}
  }
  renderResult();show('result');$('result-title').focus({preventScroll:true});
 }catch(e){$('quiz-error').textContent=e.message;$('next-btn').innerHTML='결과 다시 확인하기 <span>→</span>';$('next-btn').disabled=false;}
 finally{state.busy=false;$('leave-btn').disabled=false;}
});
function renderResult(){
 const {score,success,review}=state.result;$('score').textContent=score;$('result-star').textContent=success?'★':'✦';$('result-title').textContent=success?'명화 챌린지 성공!':'끝까지 도전했어요!';$('result-message').textContent=success?`${state.player.name} 탐험가, 멋져요! 그림을 정말 잘 기억하고 있네요.`:`${state.player.name} 탐험가, 잘했어요. 그림을 다시 공부한 뒤 도전해 주세요.`;
 $('result-save').textContent=success?(state.result.saved===false?'이 기기에서 저장이 제한되어 명단을 저장하지 못했어요.':connected?'성공한 명화 탐험가 명단에 이름을 올렸어요!':'체험 명단에 이름을 올렸어요. 이 기기에서만 보여요.'):'6문제 이상 맞히면 명화 탐험가 명단에 이름이 올라가요.';
 $('home-btn').textContent=success?'성공한 친구들 보기 →':'처음 화면으로 →';$('review-list').replaceChildren();document.querySelector('.review').open=false;
 review.forEach((q,i)=>{const item=document.createElement('div');item.className='review-item';const img=document.createElement('img');img.src=imagePath(q.image);img.alt=q.title;img.loading='lazy';const content=document.createElement('div');const status=document.createElement('span');const correct=q.title===state.answers[i];status.className='review-state'+(correct?'':' wrong');status.textContent=`${i+1}번 · ${correct?'정답이에요 ✓':'다시 기억해 봐요'}`;const title=document.createElement('p');title.textContent=q.title;content.append(status,title);if(!correct){const mine=document.createElement('small');mine.textContent='내가 고른 답: '+state.answers[i];content.append(mine)}item.append(img,content);$('review-list').append(item)});
}
let hallLoading=false;
async function loadWinners(more=false){
 if(hallLoading)return;hallLoading=true;$('refresh-btn').disabled=true;$('more-btn').disabled=true;
 if(!more)$('hall-status').textContent='탐험가 명단을 불러오고 있어요…';
 try{
  let response;if(connected)response=await rpc('hall_list',{p_offset:more?state.winners.length:0});else{const list=demoWinners();const offset=more?state.winners.length:0;response={winners:list.slice(offset,offset+60),total:list.length};}
  state.winners=more?[...state.winners,...response.winners]:response.winners;state.total=response.total;$('winner-list').replaceChildren();$('hall-status').replaceChildren();
  if(state.total===0){const empty=document.createElement('div');empty.className='empty';const title=document.createElement('strong');title.textContent='첫 번째 명화 탐험가를 기다리고 있어요!';const p=document.createElement('span');p.textContent='도전에 성공하고 여기에 내 이름을 남겨 봐요.';empty.append(title,p);$('hall-status').append(empty);}else{const count=document.createElement('p');count.className='hall-count';count.textContent=`지금까지 ${state.total}명의 친구가 성공했어요.`;$('hall-status').append(count);}
  state.winners.forEach(w=>{const item=document.createElement('div');item.className='winner';const badge=document.createElement('span');badge.className='badge';badge.textContent='★';const data=document.createElement('div');const name=document.createElement('strong');name.textContent=w.name;const group=document.createElement('small');group.textContent=`3학년 ${w.classNo}반 · 명화 탐험가`;data.append(name,group);item.append(badge,data);$('winner-list').append(item)});$('more-btn').hidden=state.winners.length>=state.total;
 }catch(e){$('hall-status').textContent='명단을 불러오지 못했어요. 새로고침을 눌러 주세요.';}
 finally{hallLoading=false;$('refresh-btn').disabled=false;$('more-btn').disabled=false;}
}
$('refresh-btn').addEventListener('click',()=>loadWinners());$('more-btn').addEventListener('click',()=>loadWinners(true));
$('home-btn').addEventListener('click',()=>{show('home');$('hall-title').scrollIntoView({behavior:'smooth',block:'start'})});
$('leave-btn').addEventListener('click',()=>$('leave-dialog').showModal());$('leave-cancel').addEventListener('click',()=>$('leave-dialog').close());$('leave-confirm').addEventListener('click',()=>{$('leave-dialog').close();state.quiz=null;state.answers=[];show('home')});
$('zoom-btn').addEventListener('click',()=>$('zoom-dialog').showModal());$('zoom-close').addEventListener('click',()=>$('zoom-dialog').close());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('home').hidden)loadWinners()});
window.addEventListener('storage',e=>{if(e.key===DEMO_KEY&&!$('home').hidden)loadWinners()});
setInterval(()=>{if(!document.hidden&&!$('home').hidden)loadWinners()},30000);
loadWinners();
