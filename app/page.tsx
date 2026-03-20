import Image from 'next/image';

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0F3D2E] text-white p-10">
      <Image src="/logos/afrisendiq-logo.png" alt="AfriSendIQ" width={240} height={64} priority className="h-16 w-auto object-contain" />
      <h1 className="text-4xl font-bold text-center mb-10">AfriSendIQ Rankings</h1>
      {/* Other content */}
    </main>
  );
}