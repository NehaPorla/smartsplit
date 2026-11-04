import {describe,it,expect} from 'vitest';
import {expenseEmbedding,pgVector} from '../src/lib/embedding';
describe('local expense vectors',()=>{it('creates deterministic normalized 384-dimensional embeddings',()=>{const a=expenseEmbedding('Dinner at the beach'),b=expenseEmbedding('Dinner at the beach');expect(a).toHaveLength(384);expect(a).toEqual(b);expect(Math.sqrt(a.reduce((s,x)=>s+x*x,0))).toBeCloseTo(1,4)});it('formats a pgvector literal',()=>{expect(pgVector([0.1,-0.2])).toBe('[0.1,-0.2]')})});
