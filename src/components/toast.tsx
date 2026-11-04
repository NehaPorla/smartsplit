'use client';
import {createContext,useCallback,useContext,useState} from 'react';
type Notice={id:number;kind:'success'|'error';message:string};const ToastContext=createContext<(kind:Notice['kind'],message:string)=>void>(()=>{});
export const useToast=()=>useContext(ToastContext);
export function ToastProvider({children}:{children:React.ReactNode}){const [notices,setNotices]=useState<Notice[]>([]);const toast=useCallback((kind:Notice['kind'],message:string)=>{const id=Date.now()+Math.random();setNotices(current=>[...current,{id,kind,message}]);setTimeout(()=>setNotices(current=>current.filter(item=>item.id!==id)),4000)},[]);return <ToastContext.Provider value={toast}>{children}<div className="toast-stack" aria-live="polite">{notices.map(item=><div className={`toast toast-${item.kind}`} key={item.id}>{item.message}</div>)}</div></ToastContext.Provider>}
