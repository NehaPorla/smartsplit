export type Split={userId:string; paise:number};
export function equalSplit(total:number,users:string[]):Split[]{if(!Number.isInteger(total)||total<0||!users.length)throw new Error('Invalid split');const base=Math.floor(total/users.length),remainder=total%users.length;return users.map((userId,i)=>({userId,paise:base+(i<remainder?1:0)}));}
export function exactSplit(total:number,shares:Split[]):Split[]{if(shares.some(x=>!Number.isInteger(x.paise)||x.paise<0)||shares.reduce((a,x)=>a+x.paise,0)!==total)throw new Error('Split amounts must equal expense total');return shares;}
