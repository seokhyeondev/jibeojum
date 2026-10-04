"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Bell, Building2, CalendarDays, Check, Clock3, Heart, Home, MapPin, MessageCircle, Search, SlidersHorizontal, Sparkles, TrainFront, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type Screen = "form"|"submitted"|"results"|"detail"|"compare"|"requests"|"chat";
type Listing = {id:number;title:string;type:string;price:string;area:string;floor:string;commute:string;station:string;image:string;tags:string[];address:string;maintenance:string;moveIn:string;description:string};

const listings:Listing[]=[
 {id:1,title:"문정동 채광 좋은 신축 투룸",type:"투룸",price:"보증금 2,000만 / 월세 90만",area:"43㎡",floor:"8층",commute:"37분",station:"문정역 도보 6분",image:"/room-1.png",tags:["신축","풀옵션","남향"],address:"서울 송파구 문정동",maintenance:"8만원",moveIn:"즉시 입주",description:"큰 창으로 햇빛이 잘 들고 수납공간이 넉넉한 신축 투룸입니다."},
 {id:2,title:"가락동 역세권 오피스텔",type:"오피스텔",price:"보증금 3,000만 / 월세 110만",area:"46㎡",floor:"12층",commute:"32분",station:"가락시장역 도보 3분",image:"/room-2.png",tags:["역세권","보안","주차"],address:"서울 송파구 가락동",maintenance:"12만원",moveIn:"10월 20일",description:"지하철 3·8호선 이용이 편리하고 관리 상태가 좋은 오피스텔입니다."},
 {id:3,title:"장지역 뷰 좋은 원룸",type:"원룸",price:"보증금 1,000만 / 월세 75만",area:"29㎡",floor:"15층",commute:"39분",station:"장지역 도보 7분",image:"/room-3.png",tags:["시티뷰","풀옵션","엘리베이터"],address:"서울 송파구 장지동",maintenance:"7만원",moveIn:"협의 가능",description:"탁 트인 전망과 실용적인 구조가 돋보이는 깔끔한 풀옵션 원룸입니다."},
 {id:4,title:"문정 법조타운 복층형 원룸",type:"원룸",price:"보증금 2,000만 / 월세 85만",area:"31㎡",floor:"10층",commute:"35분",station:"문정역 도보 4분",image:"/room-1.png",tags:["복층","역세권","반려동물 협의"],address:"서울 송파구 문정동",maintenance:"9만원",moveIn:"11월 1일",description:"업무지구와 가까우면서 층고가 높아 개방감이 좋은 복층형 원룸입니다."}
];

export default function HomePage(){
 const [screen,setScreen]=useState<Screen>("form"),[step,setStep]=useState(1);
 const [destination,setDestination]=useState("강남역"),[commute,setCommute]=useState("40분"),[deposit,setDeposit]=useState("5,000"),[rent,setRent]=useState("130"),[types,setTypes]=useState(["원룸","오피스텔","투룸"]),[moveIn,setMoveIn]=useState("2026-10-25"),[conditions,setConditions]=useState(["역세권","엘리베이터"]),[verified,setVerified]=useState(false);
 const [favorites,setFavorites]=useState<number[]>([]),[selected,setSelected]=useState<number[]>([]),[active,setActive]=useState(listings[0]);
 const summary=`${destination} · ${commute} 이내 · 보증금 ${deposit}만원 · 월세 ${rent}만원`;
 const picked=useMemo(()=>listings.filter(x=>selected.includes(x.id)),[selected]);
 const toggle=(v:string,a:string[],set:(v:string[])=>void)=>set(a.includes(v)?a.filter(x=>x!==v):[...a,v]);
 const compare=(id:number)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length<2?[...s,id]:[s[1],id]);
 const detail=(x:Listing)=>{setActive(x);setScreen("detail")};
 const home=()=>{setScreen("form");setStep(1)};
 return <div className="app">
  <header className="top"><button className="brand" onClick={home}><i><Home size={18}/></i>집이온다</button><div><button><Bell size={22}/><em/></button><button><UserRound size={22}/></button></div></header>
  <main>
   {screen==="form"&&<Form step={step} setStep={setStep} destination={destination} setDestination={setDestination} commute={commute} setCommute={setCommute} deposit={deposit} setDeposit={setDeposit} rent={rent} setRent={setRent} types={types} toggleType={(v:string)=>toggle(v,types,setTypes)} moveIn={moveIn} setMoveIn={setMoveIn} conditions={conditions} toggleCondition={(v:string)=>toggle(v,conditions,setConditions)} verified={verified} setVerified={setVerified} submit={()=>setScreen("submitted")}/>}
   {screen==="submitted"&&<Submitted summary={summary} results={()=>setScreen("results")} edit={home}/>}
   {screen==="results"&&<Results destination={destination} commute={commute} favorites={favorites} selected={selected} favorite={(id:number)=>setFavorites(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id])} compare={compare} detail={detail} compareNow={()=>setScreen("compare")}/>}
   {screen==="detail"&&<Detail item={active} favorite={favorites.includes(active.id)} back={()=>setScreen("results")} toggleFavorite={()=>setFavorites(f=>f.includes(active.id)?f.filter(x=>x!==active.id):[...f,active.id])} chat={()=>setScreen("chat")}/>}
   {screen==="compare"&&<Compare items={picked.length===2?picked:listings.slice(0,2)} back={()=>setScreen("results")} detail={detail}/>}
   {screen==="requests"&&<Requests summary={summary} results={()=>setScreen("results")}/>}
   {screen==="chat"&&<Chat item={active} back={()=>setScreen("detail")}/>}
  </main>
  {!["form","detail","compare","chat"].includes(screen)&&<Nav screen={screen} setScreen={setScreen}/>}
 </div>
}

function Form(p:any){
 const title=["어디로 출근하세요?","예산을 알려주세요","어떤 집을 찾으세요?","입주 조건을 확인할게요","마지막으로 본인 확인"];
 const sub=["출근지를 기준으로 살기 좋은 동네를 찾아드려요","관리비를 제외한 최대 금액을 입력해주세요","여러 개를 선택하셔도 괜찮아요","꼭 필요한 조건만 골라주세요","실제 이사 의향이 있는 요청인지 확인해요"];
 return <section className="flow"><div className="progress-label"><span>맞춤 매물 요청</span><b>{p.step}/5</b></div><div className="progress"><i style={{width:`${p.step*20}%`}}/></div>
  <div className="heading"><span>STEP {p.step}</span><h1>{title[p.step-1]}</h1><p>{sub[p.step-1]}</p></div>
  <div className="form-card">
   {p.step===1&&<><label>출근지</label><div className="inputbox"><MapPin/><Input value={p.destination} onChange={(e:any)=>p.setDestination(e.target.value)} placeholder="회사명, 역 또는 주소 검색"/><Search/></div><label className="mt">최대 통근시간</label><div className="choices">{["20분","30분","40분","60분"].map(v=><button className={p.commute===v?"on":""} onClick={()=>p.setCommute(v)} key={v}>{v}</button>)}</div><div className="info"><TrainFront/><span><b>대중교통 기준으로 계산해요</b><small>도보·버스·지하철 환승시간을 모두 포함합니다.</small></span></div></>}
   {p.step===2&&<div className="fields"><div><label>최대 보증금</label><div className="money"><Input value={p.deposit} onChange={(e:any)=>p.setDeposit(e.target.value)}/><span>만원</span></div></div><div><label>최대 월세</label><div className="money"><Input value={p.rent} onChange={(e:any)=>p.setRent(e.target.value)}/><span>만원</span></div></div><div className="info"><Sparkles/><span>보증금 <b>{p.deposit}만원</b> · 월세 <b>{p.rent}만원 이하</b></span></div></div>}
   {p.step===3&&<div className="types">{[["원룸","생활시설이 한 공간에 있어요"],["오피스텔","보안과 관리가 편리해요"],["투룸","침실과 거실이 분리되어 있어요"]].map(([v,d])=><button className={p.types.includes(v)?"on":""} onClick={()=>p.toggleType(v)} key={v}><i><Building2/></i><span><b>{v}</b><small>{d}</small></span>{p.types.includes(v)&&<Check className="tick"/>}</button>)}</div>}
   {p.step===4&&<><label>희망 입주일</label><div className="inputbox"><CalendarDays/><Input type="date" value={p.moveIn} onChange={(e:any)=>p.setMoveIn(e.target.value)}/></div><label className="mt">필수 조건</label><div className="tags">{["역세권","엘리베이터","주차 가능","반려동물 가능","전세대출 가능","풀옵션"].map(v=><button className={p.conditions.includes(v)?"on":""} onClick={()=>p.toggleCondition(v)} key={v}>{p.conditions.includes(v)&&<Check/>}{v}</button>)}</div></>}
   {p.step===5&&<div className="verify"><i><UserRound/></i><h2>휴대폰 본인인증</h2><p>중개사가 믿고 제안할 수 있도록<br/>최초 요청 시 한 번만 인증해요.</p><Button className={p.verified?"done":""} onClick={()=>p.setVerified(true)}>{p.verified?<><Check/> 인증 완료</>:"휴대폰으로 인증하기"}</Button><label className="agree"><Checkbox checked={p.verified} onCheckedChange={(v:any)=>p.setVerified(!!v)}/><span>개인정보 수집 및 매물 제안 전달에 동의합니다.</span></label></div>}
  </div>
  <div className="actions">{p.step>1&&<Button variant="outline" onClick={()=>p.setStep(p.step-1)}>이전</Button>}<Button disabled={p.step===5&&!p.verified} onClick={()=>p.step<5?p.setStep(p.step+1):p.submit()}>{p.step===5?"매물 요청하기":"다음"}</Button></div>
 </section>
}

function Submitted({summary,results,edit}:any){return <section className="submitted"><div className="success"><Check/></div><span className="eyebrow">요청 접수 완료</span><h1>조건에 맞는 매물을<br/>찾고 있어요</h1><p>중개사에게 직접 확인한 매물만 모아<br/><b>24시간 안에</b> 제안해드릴게요.</p><div className="summary"><MapPin/><span>{summary}</span><button onClick={edit}>수정</button></div><Timeline/><div className="notice"><Sparkles/>프로토타입에서는 준비된 샘플 매물을 바로 확인할 수 있어요.</div><Button className="primary wide" onClick={results}>도착한 매물 4개 보기</Button></section>}
function Timeline(){return <div className="timeline"><div className="done"><i><Check/></i><span><b>요청 접수</b><small>조건 확인 완료</small></span></div><div className="active"><i><Search/></i><span><b>매물 매칭 중</b><small>중개사에게 확인하고 있어요</small></span></div><div><i><Home/></i><span><b>제안 도착</b><small>확인되는 대로 알려드려요</small></span></div></div>}

function Results(p:any){return <section className="results"><div className="result-head"><div><span className="eyebrow">매물 제안 도착</span><h1>조건에 맞는 매물 <b>4개</b>를<br/>찾았어요</h1><p><MapPin/>{p.destination} · {p.commute} 이내</p></div><i><b>4</b><small>제안</small></i></div><div className="toolbar"><b>추천순</b><button><SlidersHorizontal/>조건</button></div><div className="cards">{listings.map(x=><article key={x.id}><button className="photo" onClick={()=>p.detail(x)}><Image src={x.image} alt={x.title} fill sizes="(max-width:600px) 100vw,360px"/><em>추천 {96-x.id*2}%</em></button><button className={p.favorites.includes(x.id)?"heart on":"heart"} onClick={()=>p.favorite(x.id)}><Heart fill={p.favorites.includes(x.id)?"currentColor":"none"}/></button><div className="card-body" onClick={()=>p.detail(x)}><small>{x.type}</small><h2>{x.title}</h2><b>{x.price}</b><p><span><TrainFront/>{p.destination} {x.commute}</span><span>{x.area} · {x.floor}</span></p><div className="mini">{x.tags.map(t=><i key={t}>{t}</i>)}</div></div><label className="pick"><Checkbox checked={p.selected.includes(x.id)} onCheckedChange={()=>p.compare(x.id)}/>비교함에 담기</label></article>)}</div>{p.selected.length>0&&<div className="comparebar"><span><b>{p.selected.length}/2</b><small>매물을 선택했어요</small></span><Button disabled={p.selected.length<2} onClick={p.compareNow}>비교하기</Button></div>}</section>}

function Detail({item,favorite,back,toggleFavorite,chat}:any){return <section className="detail"><div className="simple-head"><button onClick={back}><ArrowLeft/></button><b>매물 상세</b><button className={favorite?"red":""} onClick={toggleFavorite}><Heart fill={favorite?"currentColor":"none"}/></button></div><div className="hero-photo"><Image src={item.image} alt={item.title} fill sizes="760px" priority/><span>1 / 6</span></div><div className="detail-body"><small className="green">{item.type} · 추천 94%</small><h1>{item.title}</h1><strong>{item.price}</strong><p className="address"><MapPin/>{item.address}</p><div className="commute"><div><TrainFront/><span><small>강남역까지</small><b>{item.commute}</b></span></div><p>{item.station}<br/>지하철 환승 1회</p></div><div className="spec">{[["전용면적",item.area],["층수",item.floor],["관리비",item.maintenance],["입주 가능일",item.moveIn]].map(([a,b])=><div key={a}><small>{a}</small><b>{b}</b></div>)}</div><section><h2>이 집의 특징</h2><div className="mini">{item.tags.map((t:string)=><i key={t}>{t}</i>)}</div><p>{item.description}</p></section><div className="agent"><i>김</i><span><b>김민수 공인중개사</b><small>문정좋은집 부동산 · 확인매물</small></span><em>확인</em></div></div><div className="detail-cta"><button onClick={toggleFavorite}><Heart fill={favorite?"currentColor":"none"}/><small>찜</small></button><Button onClick={chat}>문의·방문 요청</Button></div></section>}

function Compare({items,back,detail}:any){return <section className="compare"><div className="simple-head"><button onClick={back}><ArrowLeft/></button><b>매물 비교</b><i/></div><p>두 매물의 중요한 조건을 한눈에 비교해보세요.</p><div className="table"><div className="compare-photos"><i/>{items.map((x:Listing)=><button key={x.id} onClick={()=>detail(x)}><Image src={x.image} alt="" fill sizes="40vw"/><b>{x.title}</b></button>)}</div>{[["가격","price"],["출근시간","commute"],["면적","area"],["층수","floor"],["역과 거리","station"],["관리비","maintenance"],["입주일","moveIn"]].map(([label,key])=><div className="row" key={key}><b>{label}</b>{items.map((x:any)=><span key={x.id}>{x[key]}</span>)}</div>)}</div><Button className="primary wide" onClick={()=>detail(items[0])}>첫 번째 매물 자세히 보기</Button></section>}
function Requests({summary,results}:any){return <section className="requests"><span className="eyebrow">MY REQUEST</span><h1>내 매물 요청</h1><div className="request-card"><header><span>진행 중</span><small>오늘 접수</small></header><h2>강남역 출근 · 맞춤 매물 요청</h2><p>{summary}</p><div className="small-progress"><i/></div><div className="count"><span>제안 도착</span><b>4개</b></div><Button className="primary wide" onClick={results}>제안 확인하기</Button></div></section>}
function Chat({item,back}:any){const [sent,setSent]=useState(false);return <section className="chat"><div className="simple-head"><button onClick={back}><ArrowLeft/></button><b>중개사 문의</b><i/></div><div className="chat-house"><Image src={item.image} alt="" width={72} height={56}/><span><b>{item.title}</b><small>{item.price}</small></span></div><div className="hello"><i>김</i><p><b>김민수 공인중개사</b><br/>안녕하세요. 궁금한 점을 남겨주시면<br/>확인 후 연락드리겠습니다.</p></div><div className="quick">{["이번 주말 방문 가능할까요?","보증금 조정이 가능할까요?","실제 관리비가 궁금해요"].map(m=><button key={m} onClick={()=>setSent(true)}>{m}</button>)}</div>{sent&&<div className="sent">이번 주말 방문 가능할까요?</div>}<div className="chat-input"><Input placeholder="메시지를 입력해주세요"/><Button onClick={()=>setSent(true)}>보내기</Button></div></section>}
function Nav({screen,setScreen}:any){return <nav><button className={screen==="submitted"?"on":""} onClick={()=>setScreen("submitted")}><Home/><small>홈</small></button><button className={screen==="results"?"on":""} onClick={()=>setScreen("results")}><Search/><small>매물</small></button><button className={screen==="requests"?"on":""} onClick={()=>setScreen("requests")}><Clock3/><small>내 요청</small></button><button onClick={()=>setScreen("chat")}><MessageCircle/><small>상담</small></button></nav>}
