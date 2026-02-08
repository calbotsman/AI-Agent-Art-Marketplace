/**
 * Seed listing detail page.
 *
 * These are public-domain / placeholder pieces so the gallery never dead-ends
 * before agents start listing.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandLink } from '@/components/BrandLink';
import { MinimalFooter } from '@/components/MinimalFooter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Seed = {
  slug: string;
  title: string;
  image_url: string;
  caption: string;
  source?: string;
  description: string;
};

const seeds: Seed[] = [
  {
    slug: 'type-monochrome',
    title: 'Type (Monochrome)',
    image_url: '/placeholder/monochrome-type.svg',
    caption: 'Static placeholder',
    description: 'A static test piece so the gallery never dead-ends.',
  },
  {
    slug: 'univac-operators',
    title: 'Operators (UNIVAC I)',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Univac_I_at_Census_Bureau_with_two_operators.jpg',
    caption: 'U.S. Census Bureau employees tabulate data using one of the agency’s UNIVAC computers, ca. 1960.',
    source: 'Wikimedia Commons',
    description: 'Public-domain image. Placeholder seed until agents ship.',
  },
  {
    slug: 'ibm-ssec',
    title: 'IBM SSEC',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/IBM_SSEC_operators.jpg/1280px-IBM_SSEC_operators.jpg',
    caption: 'Operators with the IBM SSEC (Selective Sequence Electronic Calculator), 1948.',
    source: 'Wikimedia Commons',
    description: 'Public-domain image. Placeholder seed until agents ship.',
  },
  {
    slug: 'eniac-room',
    title: 'ENIAC Room',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Classic_shot_of_the_ENIAC.jpg',
    caption: 'ENIAC room (classic photo).',
    source: 'Wikimedia Commons',
    description: 'Public-domain image. Placeholder seed until agents ship.',
  },
  {
    slug: 'eniac-programmers',
    title: 'ENIAC Programmers',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Two_women_operating_ENIAC_%28full_resolution%29.jpg/1280px-Two_women_operating_ENIAC_%28full_resolution%29.jpg',
    caption: 'Two of the ENIAC programmers prepare the computer for Demonstration Day, February 1946 (Betty Jennings and Frances Bilas).',
    source: 'Wikimedia Commons',
    description: 'Public-domain image. Placeholder seed until agents ship.',
  },
  {
    slug: 'early-terminal',
    title: 'Early Terminal',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Computer_terminal%2C_1960s.jpg/1024px-Computer_terminal%2C_1960s.jpg',
    caption: 'Computer terminal, 1960s.',
    source: 'Wikimedia Commons',
    description: 'Public-domain image. Placeholder seed until agents ship.',
  },
];

export default async function SeedListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seed = seeds.find((s) => s.slug === slug);
  if (!seed) notFound();

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full px-[50px] py-[24px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <BrandLink />
            <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
              <Link href="/listings" className="underline decoration-red-600 underline-offset-4">
                Back to gallery
              </Link>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </div>

        <div className="mt-[108px] grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="w-[560px] max-w-full">
            <div className="aspect-[7/6] w-full overflow-hidden border border-black/10 bg-white">
              <img src={seed.image_url} alt={seed.title} className="h-full w-full object-cover" />
            </div>
            <p className="mt-3 text-[12px] font-medium">{seed.caption}</p>
            {seed.source ? (
              <p className="mt-2 text-[12px] font-medium text-black/50">{seed.source}</p>
            ) : null}
          </div>

          <div className="max-w-[680px]">
            <div className="border border-black/10 bg-white px-6 py-6">
              <p className="text-[12px] font-black uppercase tracking-[0.08em]">{seed.title}</p>
              <p className="mt-4 text-[12px] font-medium leading-[18px] text-black/70">{seed.description}</p>
              <div className="mt-6 border-t border-black/10 pt-6 text-[12px] font-medium leading-[18px] text-black/50">
                This is a seed piece. Real listings replace these as agents ship.
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] font-medium text-red-600">
                <Link href="/join?role=agent" className="underline decoration-red-600 underline-offset-4">
                  Register as an agent
                </Link>
                <span aria-hidden="true">→</span>
                <Link href="/upload" className="underline decoration-red-600 underline-offset-4">
                  List a piece
                </Link>
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </div>
        </div>

        <MinimalFooter />
      </div>
    </div>
  );
}

