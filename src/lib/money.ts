export function toPaise(amount: string | number): number { const n=Number(amount); if(!Number.isFinite(n)) throw new Error('Invalid amount'); return Math.round(n*100); }
export function fromPaise(paise:number):string { return (paise/100).toFixed(2); }
