'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {createContext,useContext,useEffect,useState} from 'react';
import {ToastProvider} from '@/components/toast';

export type CurrentUser={id:string;name:string;email:string;role:'admin'|'member'};
const UserContext=createContext<CurrentUser|null>(null);
export const useCurrentUser=()=>useContext(UserContext);
const links=[{href:'/',label:'Overview',icon:'◫'},{href:'/groups',label:'Your groups',icon:'▦'},{href:'/analytics',label:'Analytics',icon:'▤'},{href:'/activity',label:'Activity',icon:'◷'},{href:'/profile',label:'Profile',icon:'◉'}];
const initial=(name:string)=>name.trim().charAt(0).toLocaleUpperCase()||'?';

export function DashboardShell({children}:{children:React.ReactNode}){
  const pathname=usePathname(),[user,setUser]=useState<CurrentUser|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;fetch('/api/me',{cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Please sign in');if(active)setUser(body.data.user)}).catch(()=>{if(active)window.location.replace('/login')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  if(loading||!user)return <main className="auth-loading">Loading your account…</main>;
  const selected=(href:string)=>href==='/'?pathname==='/':pathname===href||pathname.startsWith(`${href}/`);
  return <UserContext.Provider value={user}><ToastProvider><div className="shell"><aside className="sidebar"><Link className="brand" href="/">smart<span>split</span></Link><nav className="nav">{links.map(link=><Link key={link.href} href={link.href} className={selected(link.href)?'active':''}><span>{link.icon}</span>　{link.label}</Link>)}{user.role==='admin'&&<Link href="/admin" className={selected('/admin')?'active':''}>⚙　 Admin</Link>}</nav><div className="side-note"><b>Small steps, fair splits.</b><br/>Your shared expenses are organized and up to date.</div></aside><main className="main"><header className="top"><div><div className="eyebrow">{new Intl.DateTimeFormat('en-IN',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date())}</div><h1 className="title">{pathname==='/'?`Good day, ${user.name}`:pathname.startsWith('/admin')?'Admin':links.find(link=>selected(link.href))?.label??'SmartSplit'}</h1></div><details className="profile-menu"><summary className="profile"><span className="avatar user-avatar">{initial(user.name)}</span><span>{user.name}</span><span aria-hidden="true">⌄</span></summary><div className="profile-dropdown"><div className="muted">{user.email}</div><Link href="/profile">Profile</Link>{user.role==='admin'&&<Link href="/admin">Admin</Link>}<button onClick={async()=>{try{await fetch('/api/auth/logout',{method:'POST'})}finally{window.location.replace('/login')}}}>Log out</button></div></details></header>{children}</main></div></ToastProvider></UserContext.Provider>
}
