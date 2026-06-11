import { MemoForm } from './MemoForm';

export function MemoCreate() {
  return (
    <>
      <div className="mb-5"><h2 className="text-xl font-bold">สร้างบันทึกใหม่</h2>
        <p className="text-gray-500 text-[13px]">เลขรันจะออกอัตโนมัติแบบ atomic เมื่อกดส่ง</p></div>
      <MemoForm />
    </>
  );
}
