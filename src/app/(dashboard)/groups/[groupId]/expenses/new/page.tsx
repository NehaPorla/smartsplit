'use client';
import {useParams} from 'next/navigation';import {ExpenseForm} from '@/components/expense-form';
export default function NewExpensePage(){const {groupId}=useParams<{groupId:string}>();return <ExpenseForm groupId={groupId}/>}
