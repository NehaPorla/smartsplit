'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useState} from 'react';

export default function LoginPage(){
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [next,setNext]=useState('');useEffect(()=>{const value=new URLSearchParams(window.location.search).get('next');if(value?.startsWith('/')&&!value.startsWith('//'))setNext(value)},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');setBusy(true);const form=new FormData(event.currentTarget);try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),password:form.get('password')})});const result=await response.json();if(!response.ok)throw new Error(result.error?.message||'Could not sign in');window.location.replace(next||'/')}catch(caught){setError(caught instanceof Error?caught.message:'Could not sign in')}finally{setBusy(false)}}
  return <main className="auth-page"><section className="auth-card"><a className="brand auth-brand" href="/">smart<span>split</span></a><h1>Welcome back</h1><p className="muted">Sign in to see your groups and shared expenses.</p><form className="auth-form" onSubmit={submit}><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/>{error&&<div className="form-error" role="alert">{error}</div>}<button className="button auth-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><p className="auth-foot">New to SmartSplit? <Link href={next?`/register?next=${encodeURIComponent(next)}`:'/register'}>Create an account</Link></p></section></main>
}
