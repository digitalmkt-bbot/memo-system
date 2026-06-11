import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth';

type Form = { email: string; password: string };

export function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
    defaultValues: { email: 'ploy@loveandaman.com', password: 'Password123!' },
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (d: Form) => {
    setErr('');
    try { await login(d.email, d.password); nav('/dashboard'); }
    catch (e: any) { setErr(e.message || 'เข้าสู่ระบบไม่สำเร็จ'); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-ocean to-ocean-dark p-5">
      <div className="bg-white w-full max-w-sm rounded-2xl p-9 shadow-xl">
        <h1 className="text-xl font-bold text-ocean-dark flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-ocean inline-block" />Love Island
        </h1>
        <p className="text-gray-500 text-[13px] mt-1 mb-5">ระบบจัดการบันทึกข้อความภายใน (MEMO Management System)</p>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="label">อีเมล</label>
          <input className="input" type="email" {...register('email', { required: true })} />
          <label className="label">รหัสผ่าน</label>
          <input className="input" type="password" {...register('password', { required: true })} />
          <div className="text-red-500 text-[13px] mt-2.5 min-h-[18px]">{err}</div>
          <button className="btn btn-primary w-full mt-2" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}
