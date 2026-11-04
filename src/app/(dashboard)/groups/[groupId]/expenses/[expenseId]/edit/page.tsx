'use client';
import {useParams} from 'next/navigation';import {ExpenseForm} from '@/components/expense-form';
export default function EditExpensePage(){const {groupId,expenseId}=useParams<{groupId:string;expenseId:string}>();return <ExpenseForm groupId={groupId} expenseId={expenseId}/>}
