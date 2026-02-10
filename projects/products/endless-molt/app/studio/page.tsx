import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';
import StudioClient from './studioClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function StudioSetupPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <BrandLink />
        <p className="mt-4 text-[12px] font-medium">Cal Studio.</p>

        <StudioClient />

        <MinimalFooter />
      </div>
    </div>
  );
}
