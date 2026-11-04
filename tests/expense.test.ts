import {describe,expect,it} from 'vitest';
import {calculateSplits,moneyToPaise,paiseToMoney} from '../src/lib/expense';
const ids=['a','b','c'];

describe('expense money and allocation rules',()=>{
  it('parses currency exactly into paise',()=>{expect(moneyToPaise('123.45')).toBe(12345n);expect(paiseToMoney(12345n)).toBe('123.45')});
  it('splits equal shares and assigns remainder paise deterministically',()=>{expect(calculateSplits(100n,'equal',ids.map(userId=>({userId}))).map(x=>x.paise)).toEqual([34n,33n,33n])});
  it('validates exact splits without floating point arithmetic',()=>{expect(calculateSplits(1001n,'exact',[{userId:'a',amount:'5.00'},{userId:'b',amount:'5.01'}]).map(x=>x.paise)).toEqual([500n,501n])});
  it('validates percentage totals and allocates remainder cents',()=>{expect(calculateSplits(10001n,'percentage',[{userId:'a',percentage:'50'},{userId:'b',percentage:'30'},{userId:'c',percentage:'20'}]).map(x=>x.paise)).toEqual([5001n,3000n,2000n])});
  it('splits integer weights with a deterministic remainder',()=>{expect(calculateSplits(101n,'shares',[{userId:'a',shares:1},{userId:'b',shares:2},{userId:'c',shares:3}]).map(x=>x.paise)).toEqual([17n,34n,50n])});
  it('rejects malformed totals, duplicate members and invalid weights',()=>{expect(()=>moneyToPaise('2.999')).toThrow();expect(()=>calculateSplits(100n,'exact',[{userId:'a',amount:'0.20'}])).toThrow();expect(()=>calculateSplits(100n,'percentage',[{userId:'a',percentage:'60'},{userId:'b',percentage:'30'}])).toThrow();expect(()=>calculateSplits(100n,'shares',[{userId:'a',shares:0}])).toThrow();expect(()=>calculateSplits(100n,'equal',[{userId:'a'},{userId:'a'}])).toThrow()});
  it('preserves the total for generated ledgers and all split modes',()=>{let seed=817;const random=(max:number)=>{seed=(seed*48271)%2147483647;return seed%max};for(let n=1;n<25;n++){const total=BigInt(random(100000)+1),members=Array.from({length:random(8)+1},(_,i)=>({userId:`u${i}`}));const equal=calculateSplits(total,'equal',members);expect(equal.reduce((s,x)=>s+x.paise,0n)).toBe(total);const weights=members.map((m)=>({...m,shares:random(99)+1}));const weighted=calculateSplits(total,'shares',weights);expect(weighted.reduce((s,x)=>s+x.paise,0n)).toBe(total);const pct=members.map((m,i)=>({...m,percentage:i===members.length-1?String(100-(members.length-1)*Math.floor(100/members.length)):String(Math.floor(100/members.length))}));const percentages=calculateSplits(total,'percentage',pct);expect(percentages.reduce((s,x)=>s+x.paise,0n)).toBe(total)}});
});
